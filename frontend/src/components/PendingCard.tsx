import { useState } from "react";

type PendingTransaction = {
  id: string;
  amount: string;
  recipient: string;
  approvals: number;
  required: number;
};

export default function PendingCard() {
  const [transactions, setTransactions] = useState<PendingTransaction[]>([
    {
      id: "#001",
      amount: "500 TRX",
      recipient: "TQx...8Kp",
      approvals: 1,
      required: 2,
    },
    {
      id: "#003",
      amount: "100 TRX",
      recipient: "TB7...92L",
      approvals: 0,
      required: 2,
    },
  ]);

  const approveTransaction = (id: string) => {
    setTransactions((current) =>
      current.map((tx) =>
        tx.id === id
          ? {
              ...tx,
              approvals: Math.min(tx.approvals + 1, tx.required),
            }
          : tx
      )
    );
  };

  return (
    <div className="bg-slate-900 rounded-xl p-5">
      <p className="text-slate-400">Pending Transactions</p>

      <h2 className="text-4xl font-bold mt-2">
        {transactions.length}
      </h2>

      <p className="text-yellow-400 mt-2">
        Waiting for signatures
      </p>

      <div className="mt-6 space-y-4">
        {transactions.map((tx) => {
          const approved = tx.approvals >= tx.required;

          return (
            <div
              key={tx.id}
              className="border border-slate-800 rounded-lg p-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{tx.id}</p>

                  <p className="text-slate-400 mt-1">
                    {tx.amount}
                  </p>

                  <p className="text-xs text-slate-500 mt-1">
                    To: {tx.recipient}
                  </p>
                </div>

                <span
                  className={
                    approved
                      ? "text-green-400"
                      : "text-yellow-400"
                  }
                >
                  {approved ? "Approved" : "Pending"}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-slate-400">
                  Signatures: {tx.approvals} / {tx.required}
                </span>

                <button
                  onClick={() => approveTransaction(tx.id)}
                  disabled={approved}
                  className={`px-4 py-2 rounded-lg font-semibold ${
                    approved
                      ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                      : "bg-purple-600 hover:bg-purple-700"
                  }`}
                >
                  {approved ? "Approved" : "Approve"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
