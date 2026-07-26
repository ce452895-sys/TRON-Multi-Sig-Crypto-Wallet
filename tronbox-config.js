const port = process.env.HOST_PORT || 9090;

module.exports = {
  networks: {
    // Local TRON node (e.g. tron-quickstart docker image), for fast iteration
    development: {
      privateKey: process.env.PRIVATE_KEY_DEV,
      userFeePercentage: 100,
      feeLimit: 1_000_000_000,
      fullHost: 'http://127.0.0.1:' + port,
      network_id: '9',
    },

    // Shasta testnet — matches README's default TRON_NETWORK
    shasta: {
      privateKey: process.env.PRIVATE_KEY_SHASTA,
      userFeePercentage: 100,
      feeLimit: 1_000_000_000,
      fullHost: 'https://api.shasta.trongrid.io',
      network_id: '2',
    },

    // Nile testnet — alternate testnet used in the README's faucet list
    nile: {
      privateKey: process.env.PRIVATE_KEY_NILE,
      userFeePercentage: 100,
      feeLimit: 1_000_000_000,
      fullHost: 'https://nile.trongrid.io',
      network_id: '3',
    },

    // Mainnet — DO NOT deploy here until the Security Checklist in the
    // README (independent audit, full testnet coverage) is complete.
    mainnet: {
      privateKey: process.env.PRIVATE_KEY_MAINNET,
      userFeePercentage: 100,
      feeLimit: 1_000_000_000,
      fullHost: 'https://api.trongrid.io',
      network_id: '1',
    },
  },

  compilers: {
    solc: {
      version: '0.8.19',
    },
  },
};
