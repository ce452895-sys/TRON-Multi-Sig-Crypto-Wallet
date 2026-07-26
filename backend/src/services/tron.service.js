const TronWeb = require('tronweb');
const multisigAbi = require('./multisigAbi');

const FULL_HOST = process.env.TRON_FULL_HOST || 'https://api.shasta.trongrid.io';

/**
 * Read-only TronWeb instance for balance/resource/contract-state queries.
 * No private key attached — safe to use for any GET-style operation.
 */
const tronWebReadOnly = new TronWeb({
  fullHost: FULL_HOST,
  headers: process.env.TRON_API_KEY ? { 'TRON-PRO-API-KEY': process.env.TRON_API_KEY } : {},
});

/**
 * Broadcaster TronWeb instance — used ONLY to relay a transaction that
 * has already collected enough owner signatures/confirmations (either
 * via the contract's executeTransaction, which any owner can call, or to
 * broadcast a fully co-signed raw transaction under native multisig).
 * This key never authorizes a transfer on its own; the contract/network
 * enforces the threshold independently.
 */
function getBroadcaster() {
  if (!process.env.BROADCASTER_PRIVATE_KEY) {
    throw new Error('BROADCASTER_PRIVATE_KEY is not set — cannot broadcast/execute transactions');
  }
  return new TronWeb({
    fullHost: FULL_HOST,
    headers: process.env.TRON_API_KEY ? { 'TRON-PRO-API-KEY': process.env.TRON_API_KEY } : {},
    privateKey: process.env.BROADCASTER_PRIVATE_KEY,
  });
}

/**
 * Sponsor account TronWeb instance — used ONLY for delegateResource /
 * undelegateResource calls (see resources.service.js). Never used to
 * initiate a transfer of the sponsor's TRX to a user, and never receives
 * funds from users. See README "Transparent Fee Sponsorship".
 */
function getSponsor() {
  if (!process.env.SPONSOR_ACCOUNT_PRIVATE_KEY) {
    throw new Error('SPONSOR_ACCOUNT_PRIVATE_KEY is not set — cannot delegate resources');
  }
  return new TronWeb({
    fullHost: FULL_HOST,
    headers: process.env.TRON_API_KEY ? { 'TRON-PRO-API-KEY': process.env.TRON_API_KEY } : {},
    privateKey: process.env.SPONSOR_ACCOUNT_PRIVATE_KEY,
  });
}

function getMultisigContract(tronWebInstance = tronWebReadOnly) {
  const address = process.env.MULTISIG_CONTRACT_ADDRESS;
  if (!address) {
    throw new Error('MULTISIG_CONTRACT_ADDRESS is not set');
  }
  return tronWebInstance.contract(multisigAbi, address);
}

async function getAccountResources(address) {
  return tronWebReadOnly.trx.getAccountResources(address);
}

async function getBalanceSun(address) {
  return tronWebReadOnly.trx.getBalance(address);
}

module.exports = {
  tronWebReadOnly,
  getBroadcaster,
  getSponsor,
  getMultisigContract,
  getAccountResources,
  getBalanceSun,
};
