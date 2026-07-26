const tron = require('./tron.service');
const db = require('../config/db');

const MIN_TRX_RESERVE_SUN = Number(process.env.MIN_TRX_RESERVE || 50) * 1_000_000;
const SPONSOR_DELEGATION_LIMIT_SUN = Number(process.env.SPONSOR_DELEGATION_LIMIT_SUN || 5_000_000);
const SPONSOR_GRACE_PERIOD_HOURS = Number(process.env.SPONSOR_GRACE_PERIOD_HOURS || 24);

/**
 * Estimate whether an account can currently afford a transaction, based on
 * available Bandwidth/Energy plus its liquid TRX balance (which can cover
 * a shortfall via TRON's burn-TRX fallback). Returns a structured result
 * instead of throwing, so callers can decide what to do (block, offer
 * sponsorship, offer self-stake) rather than getting an opaque on-chain
 * failure. See README "Handling Low TRX / Fee Failures" #4.
 */
async function preflightCheck(address, { needsEnergy = false, estimatedCostSun = 0 } = {}) {
  const [resources, balanceSun] = await Promise.all([
    tron.getAccountResources(address),
    tron.getBalanceSun(address),
  ]);

  const bandwidthAvailable =
    (resources.freeNetLimit || 0) -
    (resources.freeNetUsed || 0) +
    (resources.NetLimit || 0) -
    (resources.NetUsed || 0);

  const energyAvailable = (resources.EnergyLimit || 0) - (resources.EnergyUsed || 0);

  const hasEnoughResource = needsEnergy ? energyAvailable > 0 : bandwidthAvailable > 0;
  const hasEnoughTrxFallback = balanceSun >= estimatedCostSun;

  const sufficient = hasEnoughResource || hasEnoughTrxFallback;

  return {
    sufficient,
    bandwidthAvailable,
    energyAvailable,
    balanceSun,
    estimatedCostSun,
    shortfallSun: sufficient ? 0 : Math.max(0, estimatedCostSun - balanceSun),
    belowReserve: balanceSun - estimatedCostSun < MIN_TRX_RESERVE_SUN,
  };
}

/**
 * Self-staking: the wallet freezes its OWN TRX for Bandwidth/Energy.
 * This is the default, always-preferred path — sponsorship (below) is
 * only a fallback for new/empty wallets that have no TRX to stake yet.
 */
async function selfStake({ ownerAddress, amountSun, resourceType = 'ENERGY' }) {
  const broadcaster = tron.getBroadcaster();
  // freezeBalanceV2 must be signed by the account's own owner key in a
  // real deployment (the owner signs client-side and the backend relays
  // the raw transaction). This call shape assumes a server-side signer
  // for illustration — wire it to your actual client-signing flow.
  return broadcaster.trx.freezeBalanceV2(amountSun, resourceType, ownerAddress);
}

/**
 * Delegate Energy/Bandwidth from the sponsor account to a user's wallet.
 * Does NOT move any TRX from the user — it lends transaction capacity,
 * and is revocable via sponsorUndelegate. Every call is capped at
 * SPONSOR_DELEGATION_LIMIT_SUN and recorded in the `sponsorships` table
 * for audit/reclaim. See README "Transparent Fee Sponsorship".
 */
async function sponsorDelegate({ toAddress, resourceType = 'ENERGY', amountSun }) {
  if (amountSun > SPONSOR_DELEGATION_LIMIT_SUN) {
    throw new Error(
      `Requested delegation (${amountSun} SUN) exceeds SPONSOR_DELEGATION_LIMIT_SUN (${SPONSOR_DELEGATION_LIMIT_SUN})`
    );
  }

  const sponsor = tron.getSponsor();
  const sponsorAddress = process.env.SPONSOR_ACCOUNT_ADDRESS;

  const tx = await sponsor.trx.delegateResource(
    amountSun,
    toAddress,
    resourceType,
    sponsorAddress,
    false // lock — no time-lock; we manage expiry ourselves via grace period
  );

  const expiresAt = new Date(Date.now() + SPONSOR_GRACE_PERIOD_HOURS * 3600 * 1000);

  const { rows } = await db.query(
    `INSERT INTO sponsorships (to_address, resource_type, amount_sun, delegate_txid, expires_at)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [toAddress, resourceType, amountSun, tx.txid || tx, expiresAt]
  );

  return { tx, record: rows[0] };
}

/**
 * Reclaim a sponsored delegation. Called explicitly (user no longer
 * needs it) or by a scheduled job once `expires_at` has passed.
 */
async function sponsorUndelegate({ sponsorshipId }) {
  const { rows } = await db.query('SELECT * FROM sponsorships WHERE id = $1', [sponsorshipId]);
  const record = rows[0];
  if (!record) throw new Error('Sponsorship record not found');
  if (record.undelegate_txid) return { alreadyUndelegated: true, record };

  const sponsor = tron.getSponsor();
  const sponsorAddress = process.env.SPONSOR_ACCOUNT_ADDRESS;

  const tx = await sponsor.trx.undelegateResource(
    record.amount_sun,
    record.to_address,
    record.resource_type,
    sponsorAddress
  );

  const { rows: updated } = await db.query(
    `UPDATE sponsorships SET undelegate_txid = $1 WHERE id = $2 RETURNING *`,
    [tx.txid || tx, sponsorshipId]
  );

  return { tx, record: updated[0] };
}

module.exports = {
  preflightCheck,
  selfStake,
  sponsorDelegate,
  sponsorUndelegate,
  MIN_TRX_RESERVE_SUN,
};
