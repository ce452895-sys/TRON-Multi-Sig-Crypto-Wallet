-- 001_init.sql
-- Core schema for the TRON multisig wallet backend.
-- NOTE: this database NEVER stores private keys. Only public addresses,
-- proposal metadata, and signature/confirmation bookkeeping.

CREATE TABLE IF NOT EXISTS wallets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address         VARCHAR(64) UNIQUE NOT NULL,      -- base58 TRON address
    contract_address VARCHAR(64),                     -- MultiSigWallet.sol deployment, if used
    owners          JSONB NOT NULL,                    -- array of base58 owner addresses
    threshold       INTEGER NOT NULL,
    network         VARCHAR(16) NOT NULL DEFAULT 'shasta',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proposals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id       UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    tx_index        INTEGER,                            -- index in the on-chain contract, once submitted
    to_address      VARCHAR(64) NOT NULL,
    value_sun       NUMERIC(38, 0) NOT NULL DEFAULT 0,
    data_hex        TEXT NOT NULL DEFAULT '0x',
    status          VARCHAR(16) NOT NULL DEFAULT 'pending', -- pending | executed | failed | revoked
    proposed_by     VARCHAR(64) NOT NULL,               -- owner address who proposed it
    submit_txid     VARCHAR(64),                        -- on-chain txid of the submitTransaction call
    execute_txid    VARCHAR(64),                        -- on-chain txid of the executeTransaction call
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS signatures (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id     UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
    signer_address  VARCHAR(64) NOT NULL,
    confirm_txid    VARCHAR(64),                        -- on-chain txid of the confirmTransaction call
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (proposal_id, signer_address)
);

-- Transparent fee sponsorship — see README "Transparent Fee Sponsorship".
-- Records every delegation from the sponsor account so it can be reclaimed
-- and audited. No user TRX is ever recorded as moving here.
CREATE TABLE IF NOT EXISTS sponsorships (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    to_address      VARCHAR(64) NOT NULL,
    resource_type   VARCHAR(16) NOT NULL,               -- ENERGY | BANDWIDTH
    amount_sun      NUMERIC(38, 0) NOT NULL,
    delegate_txid   VARCHAR(64) NOT NULL,
    undelegate_txid VARCHAR(64),
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposals_wallet_id ON proposals(wallet_id);
CREATE INDEX IF NOT EXISTS idx_signatures_proposal_id ON signatures(proposal_id);
CREATE INDEX IF NOT EXISTS idx_sponsorships_to_address ON sponsorships(to_address);
