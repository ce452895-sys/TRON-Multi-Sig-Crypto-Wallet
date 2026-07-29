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
  let proposal = rows[0];

  if (wallet.contract_address) {
    // Contract-backed path: submit on-chain immediately.
    const contract = tron.getMultisigContract();
    const tx = await contract.submitTransaction(toAddress, valueSun, dataHex).send({
      feeLimit: Number(process.env.FEE_LIMIT_SUN || 100_000_000),
    });

    const { rows: updated } = await db.query(
      `UPDATE proposals SET submit_txid = $1 WHERE id = $2 RETURNING *`,
      [tx.txid || tx, proposal.id]
    );
    proposal = updated[0];
  } else {
    // Native-permission path: build the UNSIGNED raw transaction now, so
    // co-signers have something concrete to run tronWeb.trx.multiSign
    // against. See docs/MULTISIG.md for the full client-side flow.
    if (dataHex !== '0x') {
      throw new Error(
        'Native-multisig proposals currently support plain TRX transfers only. ' +
          'For TRC-20/contract calls, use a contract-backed wallet (wallets.contract_address) ' +
          'or extend buildNativeUnsignedTx to call transactionBuilder.triggerSmartContract.'
      );
    }

    const permissionId = 2; // 'active' permission — see docs/MULTISIG.md
    const unsignedTx = await tron.tronWebReadOnly.transactionBuilder.sendTrx(
      toAddress,
      Number(valueSun),
      wallet.address,
      { permissionId }
    );

    const { rows: updated } = await db.query(
      `UPDATE proposals SET raw_tx_json = $1, permission_id = $2 WHERE id = $3 RETURNING *`,
      [JSON.stringify(unsignedTx), permissionId, proposal.id]
    );
    proposal = updated[0];
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
 * Record a signer's confirmation.
 *
 * - Contract-backed wallets: calls the contract's confirmTransaction.
 * - Native-permission wallets: the signer must sign the CURRENT
 *   raw_tx_json client-side (`tronWeb.trx.multiSign(rawTx, privateKey,
 *   permissionId)`) and pass the resulting object as `signedRawTx`. The
 *   backend never sees a private key — it only stores the progressively
 *   co-signed transaction object. See docs/MULTISIG.md.
 */
async function confirmProposal({ proposalId, signerAddress, signedRawTx }) {
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
  } else {
    // Native-permission path.
    if (!signedRawTx) {
      const err = new Error(
        'signedRawTx is required to confirm a native-multisig proposal — ' +
          'sign proposal.raw_tx_json client-side with tronWeb.trx.multiSign() first. ' +
          'See docs/MULTISIG.md.'
      );
      err.code = 'MISSING_SIGNED_TX';
      throw err;
    }

    const priorSigCount = (proposal.raw_tx_json?.signature || []).length;
    const newSigCount = (signedRawTx.signature || []).length;

    if (newSigCount <= priorSigCount) {
      const err = new Error(
        'signedRawTx does not contain a new signature — did tronWeb.trx.multiSign() run against the latest raw_tx_json?'
      );
      err.code = 'NO_NEW_SIGNATURE';
      throw err;
    }

    // Sanity-check the transaction identity hasn't changed underneath us
    // (to/value/data must match what was proposed) before accepting it.
    if (signedRawTx.txID !== proposal.raw_tx_json.txID) {
      const err = new Error('signedRawTx does not match the proposal being signed (txID mismatch)');
      err.code = 'TX_MISMATCH';
      throw err;
    }

    await db.query(`UPDATE proposals SET raw_tx_json = $1 WHERE id = $2`, [
      JSON.stringify(signedRawTx),
      proposalId,
    ]);
    // Actual cryptographic validity of the added signature is enforced
    // by the network itself when broadcastProposal() eventually calls
    // sendRawTransaction — an invalid signature simply fails at that
    // point rather than being silently accepted here.
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
    } else if (proposal.raw_tx_json) {
      // Native-permission path: broadcast the raw transaction that has
      // accumulated co-signer signatures via confirmProposal(). The
      // network itself validates every signature at this point — an
      // insufficient or invalid signature set causes sendRawTransaction
      // to fail/reject here rather than earlier.
      const result = await tron.tronWebReadOnly.trx.sendRawTransaction(proposal.raw_tx_json);

      if (!result.result) {
        const err = new Error(
          result.message
            ? Buffer.from(result.message, 'hex').toString('utf8')
            : 'sendRawTransaction was rejected by the network'
        );
        err.code = 'BROADCAST_REJECTED';
        throw err;
      }

      executeTxid = proposal.raw_tx_json.txID;
    } else {
      throw new Error('Proposal has no on-chain tx_index or raw_tx_json to broadcast');
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
