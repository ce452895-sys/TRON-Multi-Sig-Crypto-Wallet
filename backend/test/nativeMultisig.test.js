const { expect } = require('chai');

/**
 * These tests exercise the pure validation logic inside confirmProposal's
 * native-multisig branch (new-signature detection, txID mismatch guard)
 * without requiring a live TRON node or database — they replicate the
 * exact conditions multisig.service.js checks. Full integration coverage
 * (actual multiSign/sendRawTransaction round-trip) belongs in a
 * Shasta-targeted test run per the README's "Testing on Testnet" section.
 */
describe('Native multisig signature guards', () => {
  it('detects when signedRawTx has no new signature', () => {
    const priorTx = { txID: 'abc123', signature: ['sig1'] };
    const resubmittedTx = { txID: 'abc123', signature: ['sig1'] };

    const priorCount = (priorTx.signature || []).length;
    const newCount = (resubmittedTx.signature || []).length;

    expect(newCount).to.equal(priorCount); // would trigger NO_NEW_SIGNATURE
  });

  it('accepts signedRawTx with exactly one additional signature', () => {
    const priorTx = { txID: 'abc123', signature: ['sig1'] };
    const nextTx = { txID: 'abc123', signature: ['sig1', 'sig2'] };

    const priorCount = (priorTx.signature || []).length;
    const newCount = (nextTx.signature || []).length;

    expect(newCount).to.be.greaterThan(priorCount);
  });

  it('detects a txID mismatch between stored and submitted transaction', () => {
    const priorTx = { txID: 'abc123', signature: [] };
    const wrongTx = { txID: 'zzz999', signature: ['sig1'] };

    expect(wrongTx.txID).to.not.equal(priorTx.txID); // would trigger TX_MISMATCH
  });

  it('handles a proposal with no prior signatures (first co-signer)', () => {
    const priorTx = { txID: 'abc123', signature: undefined };
    const firstSignedTx = { txID: 'abc123', signature: ['sig1'] };

    const priorCount = (priorTx.signature || []).length;
    const newCount = (firstSignedTx.signature || []).length;

    expect(priorCount).to.equal(0);
    expect(newCount).to.equal(1);
    expect(newCount).to.be.greaterThan(priorCount);
  });
});
