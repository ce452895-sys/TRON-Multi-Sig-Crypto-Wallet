/**
 * ABI for contracts/MultiSigWallet.sol.
 *
 * In normal dev flow this would be generated automatically by
 * `tronbox compile` (build/contracts/MultiSigWallet.json) and imported
 * from there. It's hand-copied here so the backend has zero build-step
 * coupling to the contracts/ directory — regenerate this file if the
 * contract's public interface changes.
 */
module.exports = [
  {
    inputs: [
      { internalType: 'address[]', name: '_owners', type: 'address[]' },
      { internalType: 'uint256', name: '_threshold', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    inputs: [
      { internalType: 'address', name: '_to', type: 'address' },
      { internalType: 'uint256', name: '_value', type: 'uint256' },
      { internalType: 'bytes', name: '_data', type: 'bytes' },
    ],
    name: 'submitTransaction',
    outputs: [{ internalType: 'uint256', name: 'txIndex', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '_txIndex', type: 'uint256' }],
    name: 'confirmTransaction',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '_txIndex', type: 'uint256' }],
    name: 'revokeConfirmation',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '_txIndex', type: 'uint256' }],
    name: 'executeTransaction',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getOwners',
    outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getTransactionCount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '_txIndex', type: 'uint256' }],
    name: 'getTransaction',
    outputs: [
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'value', type: 'uint256' },
      { internalType: 'bytes', name: 'data', type: 'bytes' },
      { internalType: 'bool', name: 'executed', type: 'bool' },
      { internalType: 'uint256', name: 'numConfirmations', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'threshold',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];
