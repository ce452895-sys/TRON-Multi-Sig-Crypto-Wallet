const MultiSigWallet = artifacts.require('MultiSigWallet');

/**
 * Run with: tronbox test --network development (or shasta/nile)
 *
 * Covers the core submit -> confirm -> execute flow plus the guards that
 * matter most for a wallet holding real funds: threshold enforcement,
 * owner-only access, double-confirmation prevention, and the self-call
 * requirement for owner/threshold management.
 */
contract('MultiSigWallet', (accounts) => {
  const [ownerA, ownerB, ownerC, notAnOwner, recipient] = accounts;
  const THRESHOLD = 2;

  let wallet;

  beforeEach(async () => {
    wallet = await MultiSigWallet.new([ownerA, ownerB, ownerC], THRESHOLD);
    // Fund the wallet so executeTransaction has something to send.
    await web3.eth.sendTransaction({
      from: ownerA,
      to: wallet.address,
      value: web3.utils.toWei('100', 'trx'),
    });
  });

  it('deploys with the correct owners and threshold', async () => {
    const owners = await wallet.getOwners();
    assert.deepEqual(owners.sort(), [ownerA, ownerB, ownerC].sort());
    assert.equal((await wallet.threshold()).toString(), String(THRESHOLD));
  });

  it('lets an owner submit a transaction', async () => {
    const value = web3.utils.toWei('10', 'trx');
    const tx = await wallet.submitTransaction(recipient, value, '0x', { from: ownerA });

    const txIndex = tx.logs[0].args.txIndex;
    const stored = await wallet.getTransaction(txIndex);

    assert.equal(stored.to, recipient);
    assert.equal(stored.value.toString(), value);
    assert.equal(stored.executed, false);
    assert.equal(stored.numConfirmations.toString(), '0');
  });

  it('rejects submission from a non-owner', async () => {
    try {
      await wallet.submitTransaction(recipient, 0, '0x', { from: notAnOwner });
      assert.fail('expected revert');
    } catch (err) {
      assert.include(err.message, 'not an owner');
    }
  });

  it('does not execute below threshold confirmations', async () => {
    const value = web3.utils.toWei('10', 'trx');
    await wallet.submitTransaction(recipient, value, '0x', { from: ownerA });
    await wallet.confirmTransaction(0, { from: ownerA }); // only 1 of 2 required

    try {
      await wallet.executeTransaction(0, { from: ownerA });
      assert.fail('expected revert');
    } catch (err) {
      assert.include(err.message, 'not enough confirmations');
    }
  });

  it('executes once threshold confirmations are reached', async () => {
    const value = web3.utils.toWei('10', 'trx');
    const balanceBefore = new web3.utils.BN(await web3.eth.getBalance(recipient));

    await wallet.submitTransaction(recipient, value, '0x', { from: ownerA });
    await wallet.confirmTransaction(0, { from: ownerA });
    await wallet.confirmTransaction(0, { from: ownerB }); // reaches threshold of 2

    await wallet.executeTransaction(0, { from: ownerA });

    const stored = await wallet.getTransaction(0);
    assert.equal(stored.executed, true);

    const balanceAfter = new web3.utils.BN(await web3.eth.getBalance(recipient));
    assert.equal(
      balanceAfter.sub(balanceBefore).toString(),
      value,
      'recipient should receive the exact transferred amount'
    );
  });

  it('prevents double confirmation by the same owner', async () => {
    await wallet.submitTransaction(recipient, 0, '0x', { from: ownerA });
    await wallet.confirmTransaction(0, { from: ownerA });

    try {
      await wallet.confirmTransaction(0, { from: ownerA });
      assert.fail('expected revert');
    } catch (err) {
      assert.include(err.message, 'already confirmed');
    }
  });

  it('allows revoking a confirmation before execution', async () => {
    await wallet.submitTransaction(recipient, 0, '0x', { from: ownerA });
    await wallet.confirmTransaction(0, { from: ownerA });
    await wallet.revokeConfirmation(0, { from: ownerA });

    const stored = await wallet.getTransaction(0);
    assert.equal(stored.numConfirmations.toString(), '0');
  });

  it('prevents executing the same transaction twice', async () => {
    await wallet.submitTransaction(recipient, 0, '0x', { from: ownerA });
    await wallet.confirmTransaction(0, { from: ownerA });
    await wallet.confirmTransaction(0, { from: ownerB });
    await wallet.executeTransaction(0, { from: ownerA });

    try {
      await wallet.executeTransaction(0, { from: ownerA });
      assert.fail('expected revert');
    } catch (err) {
      assert.include(err.message, 'already executed');
    }
  });

  it('rejects direct calls to addOwner/removeOwner/changeThreshold (self-call only)', async () => {
    try {
      await wallet.addOwner(notAnOwner, { from: ownerA });
      assert.fail('expected revert');
    } catch (err) {
      assert.include(err.message, 'not the wallet itself');
    }
  });

  it('adds a new owner via a fully-confirmed self-call transaction', async () => {
    const addOwnerData = wallet.contract.methods.addOwner(notAnOwner).encodeABI();

    await wallet.submitTransaction(wallet.address, 0, addOwnerData, { from: ownerA });
    await wallet.confirmTransaction(0, { from: ownerA });
    await wallet.confirmTransaction(0, { from: ownerB });
    await wallet.executeTransaction(0, { from: ownerA });

    const owners = await wallet.getOwners();
    assert.include(owners, notAnOwner);
  });
});
