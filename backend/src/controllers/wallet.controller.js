const multisig = require('../services/multisig.service');
const resources = require('../services/resources.service');
const tron = require('../services/tron.service');

async function createWallet(req, res, next) {
  try {
    const { address, contractAddress, owners, threshold, network } = req.body;

    if (!address || !Array.isArray(owners) || !threshold) {
      return res.status(400).json({ error: 'address, owners[], and threshold are required' });
    }

    const wallet = await multisig.createWalletRecord({
      address,
      contractAddress,
      owners,
      threshold,
      network,
    });

    res.status(201).json(wallet);
  } catch (err) {
    next(err);
  }
}

async function getWallet(req, res, next) {
  try {
    const wallet = await multisig.getWalletByAddress(req.params.address);
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

    const balanceSun = await tron.getBalanceSun(wallet.address);
    res.json({ ...wallet, balanceSun, balanceTrx: balanceSun / 1_000_000 });
  } catch (err) {
    next(err);
  }
}

async function getWalletResources(req, res, next) {
  try {
    const address = req.params.address;
    const accountResources = await tron.getAccountResources(address);
    res.json(accountResources);
  } catch (err) {
    next(err);
  }
}

async function stakeForResources(req, res, next) {
  try {
    const { address } = req.params;
    const { amountSun, resourceType } = req.body;

    if (!amountSun || !resourceType) {
      return res.status(400).json({ error: 'amountSun and resourceType are required' });
    }

    const tx = await resources.selfStake({
      ownerAddress: address,
      amountSun,
      resourceType,
    });

    res.status(201).json({ tx });
  } catch (err) {
    next(err);
  }
}

/**
 * Request transparent, disclosed fee sponsorship (see README). This never
 * moves TRX from the requesting wallet — it only delegates Bandwidth/
 * Energy from the sponsor account, and the response is explicit about
 * that so the frontend can render the required disclosure copy.
 */
async function requestSponsorship(req, res, next) {
  try {
    const { address } = req.params;
    const { amountSun, resourceType } = req.body;

    if (!amountSun || !resourceType) {
      return res.status(400).json({ error: 'amountSun and resourceType are required' });
    }

    const { tx, record } = await resources.sponsorDelegate({
      toAddress: address,
      amountSun,
      resourceType,
    });

    res.status(201).json({
      tx,
      sponsorship: record,
      disclosure:
        'This delegates transaction capacity from a sponsor account. ' +
        'No TRX is taken from your wallet, and this delegation can be reclaimed at any time.',
    });
  } catch (err) {
    next(err);
  }
}

async function revokeSponsorship(req, res, next) {
  try {
    const { sponsorshipId } = req.body;
    if (!sponsorshipId) return res.status(400).json({ error: 'sponsorshipId is required' });

    const result = await resources.sponsorUndelegate({ sponsorshipId });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createWallet,
  getWallet,
  getWalletResources,
  stakeForResources,
  requestSponsorship,
  revokeSponsorship,
};
