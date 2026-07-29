# Multi-Sig Design Details

This project supports **two** multisig approaches, and they can be used
independently or together. Which one a given wallet uses is recorded on
its `wallets` row (`contract_address` is `NULL` for native-only wallets).

---

## 1. Native TRON account multisig

TRON accounts have three permission groups — `owner`, `active`, and
`witness` — each with its own list of weighted keys and a threshold.
This project only uses `owner` and `active`.

### Permission JSON schema

This is the shape passed to `updateAccountPermission`:

```json
{
  "owner_address": "TWalletAddressBase58...",
  "owner": {
    "type": 0,
    "permission_name": "owner",
    "threshold": 2,
    "keys": [
      { "address": "TSigner1Base58...", "weight": 1 },
      { "address": "TSigner2Base58...", "weight": 1 },
      { "address": "TSigner3Base58...", "weight": 1 }
    ]
  },
  "actives": [
    {
      "type": 2,
      "permission_name": "active",
      "threshold": 2,
      "operations": "7fff1fc0033ec30f000000000000000000000000000000000000000000000000000000",
      "keys": [
        { "address": "TSigner1Base58...", "weight": 1 },
        { "address": "TSigner2Base58...", "weight": 1 },
        { "address": "TSigner3Base58...", "weight": 1 }
      ]
    }
  ]
}
```

- `threshold`: sum of signer weights required to authorize an action
  under that permission.
- `operations`: a hex bitmap of which contract types this `active`
  permission is allowed to invoke (generate with `tronWeb.utils.abi` or
  TronWeb's `updateAccountPermission` helpers — don't hand-edit this
  unless you know exactly which operation bits you're toggling).

### Example TronWeb calls

```js
// 1. Update permissions (must be signed by the CURRENT owner permission
//    holder(s) — for a brand new account this is just the creator).
const updateTx = await tronWeb.transactionBuilder.updateAccountPermissions(
  ownerAddress,
  ownerPermission,
  witnessPermission, // null if unused
  [activePermission]
);
const signedUpdateTx = await tronWeb.trx.sign(updateTx, creatorPrivateKey);
await tronWeb.trx.sendRawTransaction(signedUpdateTx);

// 2. Build a transfer once permissions are set.
const unsignedTx = await tronWeb.transactionBuilder.sendTrx(
  toAddress,
  amountSun,
  ownerAddress,
  { permissionId: 2 } // 2 = active permission, per the schema above
);

// 3. Each signer signs the SAME transaction object client-side, and POSTs
//    the result to POST /proposals/:id/sign as { signerAddress, signedRawTx }.
//    The backend stores it in proposals.raw_tx_json and never sees a
//    private key. It does NOT verify the signature cryptographically —
//    the network does that when the transaction is finally broadcast.
let multiSignedTx = await tronWeb.trx.multiSign(unsignedTx, signer1PrivateKey, 2);
multiSignedTx = await tronWeb.trx.multiSign(multiSignedTx, signer2PrivateKey, 2);

// 4. Once weight >= threshold, POST /proposals/:id/broadcast calls this:
const result = await tronWeb.trx.sendRawTransaction(multiSignedTx);
```

Both paths are fully implemented in `multisig.service.js`:

- **Contract-backed** (`wallets.contract_address` set): `createProposal`
  calls `submitTransaction` on-chain immediately; `confirmProposal` calls
  `confirmTransaction`; `broadcastProposal` calls `executeTransaction`.
- **Native-permission** (`contract_address` is `NULL`): `createProposal`
  builds the *unsigned* raw transaction via
  `transactionBuilder.sendTrx(..., { permissionId: 2 })` and stores it;
  each `confirmProposal` call expects the client to have already run
  `tronWeb.trx.multiSign()` against the current `raw_tx_json` and submit
  the result as `signedRawTx`; `broadcastProposal` calls
  `tronWeb.trx.sendRawTransaction(raw_tx_json)` once enough signatures
  have accumulated. An invalid or missing signature is rejected by the
  network at broadcast time, not earlier.

**Current limitation:** the native path only supports plain TRX transfers
(`dataHex === '0x'`). TRC-20/contract calls under native permissions
require building the transaction via
`transactionBuilder.triggerSmartContract(...)` with decoded
function/parameter arguments rather than raw ABI-encoded `data` — that's
not yet wired into `createProposal`. Contract-backed wallets already
support arbitrary `data` natively, so route TRC-20 transfer proposals
through a contract-backed wallet until this is added.

---

## 2. Contract-backed multisig (`contracts/MultiSigWallet.sol`)

See the contract's NatSpec comments for the full function reference. Summary:

| Function | Who can call | Purpose |
|---|---|---|
| `submitTransaction(to, value, data)` | any owner | Propose a transaction |
| `confirmTransaction(txIndex)` | any owner | Add a confirmation |
| `revokeConfirmation(txIndex)` | any owner | Remove your own confirmation |
| `executeTransaction(txIndex)` | any owner | Execute once `numConfirmations >= threshold` |
| `addOwner` / `removeOwner` / `changeThreshold` | **the contract itself only** | Must go through submit→confirm→execute with `to = address(this)` |

This is the path the backend fully implements today (`multisig.service.js`).

### When to use which

| | Native permissions | Contract |
|---|---|---|
| Gas/fee cost per tx | Lower (no contract call overhead) | Higher (contract execution) |
| On-chain proposal/confirmation history | No — signatures are off-chain until broadcast | Yes — fully auditable on-chain |
| Arbitrary contract calls (TRC-20, etc.) | Possible but manual | Native support via `data` param |
| Owner/threshold changes | Requires another `updateAccountPermission` tx | Enforced in-contract, self-call only |
| Complexity to audit | Lower (fewer moving parts) | Higher (custom Solidity — needs its own audit) |

A common pattern: use **native permissions** as the account's actual
security boundary (so funds are never at risk even if the contract has a
bug), and use the **contract** purely as an off-chain-signature-free
coordination layer for teams that want on-chain auditability of who
proposed/confirmed what, when.
