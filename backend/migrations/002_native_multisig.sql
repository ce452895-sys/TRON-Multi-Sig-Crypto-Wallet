-- 002_native_multisig.sql
-- Adds storage for the native-TRON-permission multisig path: the raw
-- (unsigned, then progressively co-signed) transaction object that
-- TronWeb's multiSign/sendRawTransaction flow operates on. Contract-backed
-- wallets (wallets.contract_address IS NOT NULL) don't use these columns.

ALTER TABLE proposals
    ADD COLUMN IF NOT EXISTS raw_tx_json JSONB,
    ADD COLUMN IF NOT EXISTS permission_id INTEGER NOT NULL DEFAULT 2; -- 2 = 'active' permission, per docs/MULTISIG.md
