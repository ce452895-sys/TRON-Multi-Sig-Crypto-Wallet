const tron = require('./tron.service');
const resources = require('./resources.service');
const db = require('../config/db');

/**
 * Create a wallet record (metadata only — the actual on-chain wallet
 * either already exists as a native multisig account, or was deployed
 * separately via `tronbox migrate`; this just tracks it in our DB).
 */
async function createWalletRecord({ address, contractAddress, owners, threshold, network }) {
  const { rows } = await db.query(
    `INSERT INTO wallets (address, contract_address, owners, threshold, network)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [address, contractAddress || null, JSON.stringify(owners), threshold, network || 'shasta']
  );
  return rows[0];
}

async function getWalletByAddress(address) {
  const { rows } = await db.query('SELECT * FROM wallets WHERE address = $1', [address]);
  return rows[0] || null;
}

/**
 * Propose a transfer. Runs the pre-flight resource check first (README
 * "Handling Low TRX / Fee Failures" #4) so the caller gets a clear,
 * actionable error instead of a silent on-chain failure later.
 *
 * @param proposedBy Address of the owner submitting the proposal (their
 *                    signature on THIS transaction is collected separately
 *                    via confirmProposal — this only records the proposal).
 */
async function createProposal({ walletId, proposedBy, toAddress, valueSun, dataHex = '0x' }) {
  const { rows: walletRows } = await db.query('SELECT * FROM wallets WHERE id = $1', [walletId]);
  const wallet = walletRows[0];
  if (!wallet) throw new Error('Wallet not found');

  const check = await resources.preflightCheck(wallet.address, {
    needsEnergy: dataHex !== '0x',
    estimatedCostSun: Number(valueSun),
  });

  if (!check.sufficient) {
    const err = new Error('INSUFFICIENT_RESOURCES');
    err.code = 'INSUFFICIENT_RESOURCES';
    err.details = check;
    throw err;
  }

  const { rows } = await db.query(
    `INSERT INTO proposals (wallet_id, to_address, value_sun, data_hex, proposed_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [walletId, toAddress, valueSun, dataHex, proposedBy]
  );
  const proposal = rows[0];

  // Submit to the on-chain contract (if this wallet uses the optional
  // contract layer). Native-multisig-only wallets skip this and rely on
  // multiSign/sendRawTransaction directly — see docs/MULTISIG.md.
  if (wallet.contract_address) {
    const contract = tron.getMultisigContract();
    const tx = await contract.submitTransaction(toAddress, valueSun, dataHex).send({
      feeLimit: Number(process.env.FEE_LIMIT_SUN || 100_000_000),
    });

    await db.query(
      `UPDATE proposals SET submit_txid = $1 WHERE id = $2`,
      [tx.txid || tx, proposal.id]
    );
  }

  return proposal;
}

async function getProposal(proposalId) {
  const { rows: proposalRows } = await db.query('SELECT * FROM proposals WHERE id = $1', [
    proposalId,
  ]);
  const proposal = proposalRows[0];
  if (!proposal) return null;

  const { rows: signatureRows } = await db.query(
    'SELECT signer_address, created_at FROM signatures WHERE proposal_id = $1 ORDER BY created_at',
    [proposalId]
  );

  const { rows: walletRows } = await db.query('SELECT * FROM wallets WHERE id = $1', [
    proposal.wallet_id,
  ]);

  return {
    ...proposal,
    signatures: signatureRows,
    threshold: walletRows[0]?.threshold,
    confirmationsRemaining: Math.max(0, (walletRows[0]?.threshold || 0) - signatureRows.length),
  };
}

/**
 * Record a signer's confirmation. Calls the contract's
 * confirmTransaction if this wallet uses the on-chain layer; for
 * native-multisig-only wallets, the signature itself (produced
 * client-side) is what's recorded here instead of a contract call.
 */
async function confirmProposal({ proposalId, signerAddress }) {
  const proposal = await getProposal(proposalId);
  if (!proposal) throw new Error('Proposal not found');
  if (proposal.status !== 'pending') throw new Error(`Proposal is already ${proposal.status}`);

  const { rows: walletRows } = await db.query('SELECT * FROM wallets WHERE id = $1', [
    proposal.wallet_id,
  ]);
  const wallet = walletRows[0];

  const owners = wallet.owners; // JSONB -> array
  if (!owners.includes(signerAddress)) {
    const err = new Error('Signer is not an owner of this wallet');
    err.code = 'NOT_AN_OWNER';
    throw err;
  }

  let confirmTxid = null;
  if (wallet.contract_address && proposal.tx_index !== null) {
    const contract = tron.getMultisigContract();
    const tx = await contract.confirmTransaction(proposal.tx_index).send({
      feeLimit: Number(process.env.FEE_LIMIT_SUN || 100_000_000),
    });
    confirmTxid = tx.txid || tx;
  }

  await db.query(
    `INSERT INTO signatures (proposal_id, signer_address, confirm_txid)
     VALUES ($1, $2, $3)
     ON CONFLICT (proposal_id, signer_address) DO NOTHING`,
    [proposalId, signerAddress, confirmTxid]
  );

  return getProposal(proposalId);
}

/**
 * Broadcast/execute once the confirmation threshold has been reached.
 * This is the ONLY function that moves funds — everything upstream is
 * just proposal/signature bookkeeping.
 */
async function broadcastProposal(proposalId) {
  const proposal = await getProposal(proposalId);
  if (!proposal) throw new Error('Proposal not found');
  if (proposal.status !== 'pending') throw new Error(`Proposal is already ${proposal.status}`);

  if (proposal.confirmationsRemaining > 0) {
    const err = new Error('NOT_ENOUGH_CONFIRMATIONS');
    err.code = 'NOT_ENOUGH_CONFIRMATIONS';
    err.details = { confirmationsRemaining: proposal.confirmationsRemaining };
    throw err;
  }

  const { rows: walletRows } = await db.query('SELECT * FROM wallets WHERE id = $1', [
    proposal.wallet_id,
  ]);
  const wallet = walletRows[0];

  try {
    let executeTxid;

    if (wallet.contract_address && proposal.tx_index !== null) {
      const contract = tron.getMultisigContract();
      const tx = await contract.executeTransaction(proposal.tx_index).send({
        feeLimit: Number(process.env.FEE_LIMIT_SUN || 100_000_000),
      });
      executeTxid = tx.txid || tx;
    } else {
      // Native-multisig-only path: broadcast the fully co-signed raw
      // transaction that was assembled from each signer's client-side
      // signature (assembly happens wherever the raw tx was built/stored
      // — wire this to that source in your actual implementation).
      throw new Error('Native-multisig broadcast path not wired in this scaffold — see docs/MULTISIG.md');
    }

    await db.query(
      `UPDATE proposals SET status = 'executed', execute_txid = $1, updated_at = now() WHERE id = $2`,
      [executeTxid, proposalId]
    );

    return { status: 'executed', executeTxid };
  } catch (err) {
    // Leave status as 'pending' (not 'failed') when the failure looks
    // like a resource/fee issue, so it can be retried after staking or
    // sponsorship — see README "Handling Low TRX / Fee Failures".
    const looksLikeResourceIssue = /energy|bandwidth|balance/i.test(err.message || '');
    await db.query(
      `UPDATE proposals SET status = $1, updated_at = now() WHERE id = $2`,
      [looksLikeResourceIssue ? 'pending' : 'failed', proposalId]
    );
    throw err;
  }
}

module.exports = {
  createWalletRecord,
  getWalletByAddress,
  createProposal,
  getProposal,
  confirmProposal,
  broadcastProposal,
};
