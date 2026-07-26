const MultiSigWallet = artifacts.require('MultiSigWallet');

/**
 * Deploys MultiSigWallet with owners/threshold pulled from environment
 * variables so the same script works across shasta/nile/mainnet without
 * editing code — matching the README's DEFAULT_SIGNATURE_THRESHOLD /
 * DEFAULT_SIGNER_COUNT convention.
 *
 * Set before running:
 *   MULTISIG_OWNERS="TAddr1,TAddr2,TAddr3"
 *   MULTISIG_THRESHOLD="2"
 */
module.exports = function (deployer) {
  const ownersEnv = process.env.MULTISIG_OWNERS;
  const thresholdEnv = process.env.MULTISIG_THRESHOLD || '2';

  if (!ownersEnv) {
    throw new Error(
      'MULTISIG_OWNERS env var is required, e.g. ' +
        'MULTISIG_OWNERS="TAddr1,TAddr2,TAddr3" MULTISIG_THRESHOLD=2 tronbox migrate --network shasta'
    );
  }

  const owners = ownersEnv.split(',').map((a) => a.trim());
  const threshold = parseInt(thresholdEnv, 10);

  console.log('Deploying MultiSigWallet with:');
  console.log('  owners   :', owners);
  console.log('  threshold:', threshold);

  deployer.deploy(MultiSigWallet, owners, threshold);
};
