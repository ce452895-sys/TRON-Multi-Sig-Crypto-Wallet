// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MultiSigWallet
 * @notice On-chain, weighted-threshold multi-signature wallet for TRON (TVM).
 *
 * This is the optional smart-contract approval layer described in the
 * project README (see "Multi-Sig Design" and Roadmap). It sits ON TOP of
 * TRON's native account-level multi-sig, adding features native permissions
 * don't provide on their own:
 *   - Per-transaction proposal/confirmation history stored on-chain
 *   - Arbitrary call data support (so it can call TRC-20 `transfer`,
 *     `approve`, or any other contract, not just send TRX)
 *   - Owner management (add/remove/replace signers, change threshold)
 *     that itself requires a multisig-approved transaction — no single
 *     owner can rug the wallet's own configuration
 *
 * Design mirrors the well-audited "submit -> confirm -> execute" pattern
 * used by widely-deployed multisig wallets (e.g. Gnosis Safe's original
 * MultiSigWallet). No external dependencies, so it compiles cleanly under
 * TronBox/TronIDE without an OpenZeppelin import mismatch.
 *
 * IMPORTANT: This contract holds funds. Do not deploy to mainnet without
 * an independent audit (see README Security Checklist).
 */
contract MultiSigWallet {
    // ---------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------
    event Deposit(address indexed sender, uint256 amount, uint256 balance);
    event SubmitTransaction(
        address indexed owner,
        uint256 indexed txIndex,
        address indexed to,
        uint256 value,
        bytes data
    );
    event ConfirmTransaction(address indexed owner, uint256 indexed txIndex);
    event RevokeConfirmation(address indexed owner, uint256 indexed txIndex);
    event ExecuteTransaction(address indexed owner, uint256 indexed txIndex);
    event ExecutionFailure(uint256 indexed txIndex);
    event OwnerAddition(address indexed owner);
    event OwnerRemoval(address indexed owner);
    event ThresholdChange(uint256 threshold);

    // ---------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------
    address[] public owners;
    mapping(address => bool) public isOwner;
    uint256 public threshold; // number of confirmations required

    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint256 numConfirmations;
    }

    Transaction[] public transactions;

    // txIndex => owner => confirmed?
    mapping(uint256 => mapping(address => bool)) public isConfirmed;

    // ---------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------
    modifier onlyWallet() {
        require(msg.sender == address(this), "MultiSig: caller is not the wallet itself");
        _;
    }

    modifier onlyOwner() {
        require(isOwner[msg.sender], "MultiSig: caller is not an owner");
        _;
    }

    modifier txExists(uint256 _txIndex) {
        require(_txIndex < transactions.length, "MultiSig: tx does not exist");
        _;
    }

    modifier notExecuted(uint256 _txIndex) {
        require(!transactions[_txIndex].executed, "MultiSig: tx already executed");
        _;
    }

    modifier notConfirmed(uint256 _txIndex) {
        require(!isConfirmed[_txIndex][msg.sender], "MultiSig: tx already confirmed by caller");
        _;
    }

    // ---------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------
    /**
     * @param _owners Initial list of signer addresses (e.g. 3 for a 2-of-3 wallet)
     * @param _threshold Number of confirmations required to execute a transaction
     */
    constructor(address[] memory _owners, uint256 _threshold) {
        require(_owners.length > 0, "MultiSig: owners required");
        require(
            _threshold > 0 && _threshold <= _owners.length,
            "MultiSig: invalid threshold"
        );

        for (uint256 i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            require(owner != address(0), "MultiSig: invalid owner (zero address)");
            require(!isOwner[owner], "MultiSig: duplicate owner");

            isOwner[owner] = true;
            owners.push(owner);
        }

        threshold = _threshold;
    }

    // Accept plain TRX deposits.
    receive() external payable {
        emit Deposit(msg.sender, msg.value, address(this).balance);
    }

    // ---------------------------------------------------------------
    // Core flow: submit -> confirm -> execute
    // ---------------------------------------------------------------

    /**
     * @notice Propose a transaction. Corresponds to the backend's
     *         `POST /proposals` endpoint in the README — the backend
     *         calls this once a signer builds the proposal, then relays
     *         confirmations from co-signers as they sign in the app.
     * @param _to Destination address (a wallet, or a TRC-20 contract for token transfers)
     * @param _value Amount of TRX (in SUN) to send with the call
     * @param _data Call data — empty for a plain TRX transfer, or ABI-encoded
     *              `transfer(address,uint256)` etc. for TRC-20 / contract calls
     */
    function submitTransaction(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) external onlyOwner returns (uint256 txIndex) {
        require(_to != address(0), "MultiSig: invalid destination");

        txIndex = transactions.length;

        transactions.push(
            Transaction({
                to: _to,
                value: _value,
                data: _data,
                executed: false,
                numConfirmations: 0
            })
        );

        emit SubmitTransaction(msg.sender, txIndex, _to, _value, _data);
    }

    /**
     * @notice Confirm a pending transaction. Corresponds to the backend's
     *         `POST /proposals/:id/sign` endpoint.
     */
    function confirmTransaction(uint256 _txIndex)
        external
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
        notConfirmed(_txIndex)
    {
        Transaction storage transaction = transactions[_txIndex];
        transaction.numConfirmations += 1;
        isConfirmed[_txIndex][msg.sender] = true;

        emit ConfirmTransaction(msg.sender, _txIndex);
    }

    /**
     * @notice Revoke a confirmation before execution (a signer changed their mind).
     */
    function revokeConfirmation(uint256 _txIndex)
        external
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
    {
        require(isConfirmed[_txIndex][msg.sender], "MultiSig: tx not confirmed by caller");

        Transaction storage transaction = transactions[_txIndex];
        transaction.numConfirmations -= 1;
        isConfirmed[_txIndex][msg.sender] = false;

        emit RevokeConfirmation(msg.sender, _txIndex);
    }

    /**
     * @notice Execute a transaction once it has reached the confirmation
     *         threshold. Corresponds to the backend's
     *         `POST /proposals/:id/broadcast` endpoint — the backend calls
     *         this the moment `numConfirmations >= threshold`.
     *
     *         NOTE: `_to.call` is used deliberately (not `.transfer`/`.send`)
     *         so this supports both plain TRX transfers and arbitrary
     *         contract calls (TRC-20 transfers, etc). The `nonReentrant`-
     *         style guard (`executed` flag set BEFORE the call) prevents
     *         reentrancy.
     */
    function executeTransaction(uint256 _txIndex)
        external
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
    {
        Transaction storage transaction = transactions[_txIndex];

        require(
            transaction.numConfirmations >= threshold,
            "MultiSig: not enough confirmations"
        );

        transaction.executed = true; // effects before interaction (reentrancy guard)

        (bool success, ) = transaction.to.call{value: transaction.value}(
            transaction.data
        );

        if (!success) {
            // Roll back executed flag so the transaction can be retried
            // (e.g. after topping up Energy — see README "Handling Low
            // TRX / Fee Failures") without losing confirmations.
            transaction.executed = false;
            emit ExecutionFailure(_txIndex);
            revert("MultiSig: transaction execution failed");
        }

        emit ExecuteTransaction(msg.sender, _txIndex);
    }

    // ---------------------------------------------------------------
    // Owner / threshold management
    // ---------------------------------------------------------------
    // These are intentionally restricted to `onlyWallet` — meaning they
    // can ONLY be invoked via `executeTransaction` calling back into this
    // contract itself (to = address(this)) after reaching threshold
    // confirmations. No single owner, and no external account, can change
    // the signer set or threshold unilaterally.

    function addOwner(address _owner) external onlyWallet {
        require(_owner != address(0), "MultiSig: invalid owner (zero address)");
        require(!isOwner[_owner], "MultiSig: owner already exists");

        isOwner[_owner] = true;
        owners.push(_owner);

        emit OwnerAddition(_owner);
    }

    function removeOwner(address _owner) external onlyWallet {
        require(isOwner[_owner], "MultiSig: not an owner");
        require(owners.length - 1 >= threshold, "MultiSig: would drop below threshold");

        isOwner[_owner] = false;
        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i] == _owner) {
                owners[i] = owners[owners.length - 1];
                owners.pop();
                break;
            }
        }

        emit OwnerRemoval(_owner);
    }

    function changeThreshold(uint256 _threshold) external onlyWallet {
        require(_threshold > 0 && _threshold <= owners.length, "MultiSig: invalid threshold");
        threshold = _threshold;
        emit ThresholdChange(_threshold);
    }

    // ---------------------------------------------------------------
    // Views (used by the backend's resources.service.js / API layer)
    // ---------------------------------------------------------------
    function getOwners() external view returns (address[] memory) {
        return owners;
    }

    function getTransactionCount() external view returns (uint256) {
        return transactions.length;
    }

    function getTransaction(uint256 _txIndex)
        external
        view
        returns (
            address to,
            uint256 value,
            bytes memory data,
            bool executed,
            uint256 numConfirmations
        )
    {
        Transaction storage transaction = transactions[_txIndex];
        return (
            transaction.to,
            transaction.value,
            transaction.data,
            transaction.executed,
            transaction.numConfirmations
        );
    }
}
