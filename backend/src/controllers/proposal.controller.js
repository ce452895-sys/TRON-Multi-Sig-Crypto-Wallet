const multisig = require('../services/multisig.service');

async function createProposal(req, res, next) {
  try {
    const { walletId, proposedBy, toAddress, valueSun, dataHex } = req.body;

    if (!walletId || !proposedBy || !toAddress || valueSun === undefined) {
      return res
        .status(400)
        .json({ error: 'walletId, proposedBy, toAddress, and valueSun are required' });
    }

    const proposal = await multisig.createProposal({
      walletId,
      proposedBy,
      toAddress,
      valueSun,
      dataHex,
    });

    res.status(201).json(proposal);
  } catch (err) {
    if (err.code === 'INSUFFICIENT_RESOURCES') {
      return res.status(422).json({
        error: 'INSUFFICIENT_RESOURCES',
        message:
          'This wallet does not currently have enough Bandwidth/Energy or TRX to cover this transfer.',
        details: err.details,
        remediation: [
          'Self-stake TRX for Energy/Bandwidth: POST /wallets/:address/stake',
          'Request transparent sponsor delegation: POST /wallets/:address/sponsor-request',
        ],
      });
    }
    next(err);
  }
}

async function getProposal(req, res, next) {
  try {
    const proposal = await multisig.getProposal(req.params.id);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    res.json(proposal);
  } catch (err) {
    next(err);
  }
}

async function signProposal(req, res, next) {
  try {
    const { signerAddress, signedRawTx } = req.body;
    if (!signerAddress) return res.status(400).json({ error: 'signerAddress is required' });

    const proposal = await multisig.confirmProposal({
      proposalId: req.params.id,
      signerAddress,
      signedRawTx,
    });

    res.json(proposal);
  } catch (err) {
    if (err.code === 'NOT_AN_OWNER') {
      return res.status(403).json({ error: err.message });
    }
    if (['MISSING_SIGNED_TX', 'NO_NEW_SIGNATURE', 'TX_MISMATCH'].includes(err.code)) {
      return res.status(400).json({ error: err.code, message: err.message });
    }
    next(err);
  }
}

async function broadcastProposal(req, res, next) {
  try {
    const result = await multisig.broadcastProposal(req.params.id);
    res.json(result);
  } catch (err) {
    if (err.code === 'NOT_ENOUGH_CONFIRMATIONS') {
      return res.status(409).json({ error: err.code, details: err.details });
    }
    if (err.code === 'BROADCAST_REJECTED') {
      return res.status(422).json({ error: err.code, message: err.message });
    }
    next(err);
  }
}

module.exports = { createProposal, getProposal, signProposal, broadcastProposal };
