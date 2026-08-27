import { useState } from "react";

type Transaction = {
  id: string;
  amount: string;
  recipient: string;
  approvals: number;
  required: number;
};

type Props = {
  onTransactionCreated: (tx: Transaction) => void;
};

export default function CreateTransaction({
  onTransactionCreated,
}: Props) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");

  function submitTransaction() {
    if (!recipient.trim()) {
      alert("Enter a recipient address.");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      alert("Enter a valid TRX amount.");
      return;
    }

    const tx: Transaction = {
      id: `#${Date.now().toString().slice(-4)}`,
      amount: `${amount} TRX`,
      recipient,
      approvals: 0,
      required: 2,
    };

    onTransactionCreated(tx);

    setRecipient("");
    setAmount("");

    alert("Transaction added for approval.");
  }

  return (
    <div className="bg-slate-900 rounded-xl p-6 mt-8">
      <h2 className="text-2xl font-bold mb-2">
        Create Transaction
      </h2>

      <p className="text-slate-400 text-sm mb-5">
        Create a transaction for multisig approval. No funds are sent yet.
      </p>

      <div className="space-y-4">
        <input
          type="text"
          placeholder="Recipient TRON Address"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          className="w-full rounded-lg bg-slate-800 p-3 outline-none border border-slate-700 focus:border-red-500"
        />

        <input
          type="number"
          min="0"
          step="0.1"
          placeholder="Amount (TRX)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-lg bg-slate-800 p-3 outline-none border border-slate-700 focus:border-red-500"
        />

        <button
          onClick={submitTransaction}
          className="w-full rounded-lg bg-red-600 py-3 font-semibold hover:bg-red-700 transition"
        >
          Submit for Approval
        </button>
      </div>
    </div>
  );
}
