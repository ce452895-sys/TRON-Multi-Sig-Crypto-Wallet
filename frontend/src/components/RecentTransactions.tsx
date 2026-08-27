import { useState } from "react";

type Transaction = {
  id: string;
  amount: string;
  recipient: string;
  approvals: number;
  required: number;
  status: "Pending" | "Completed";
};

export default function RecentTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([
    {
      id: "#001",
      amount: "500 TRX",
      recipient: "TXYZ...8K2P",
      approvals: 0,
      required: 2,
      status: "Pending",
    },
    {
      id: "#002",
      amount: "150 USDT",
      recipient: "TABC...4M9Q",
      approvals: 2,
      required: 2,
      status: "Completed",
    },
  ]);

  function approveTransaction(id: string) {
    setTransactions((current) =>
      current.map((tx) => {
        if (tx.id !== id || tx.status === "Completed") {
          return tx;
        }

        const approvals = Math.min(tx.approvals + 1, tx.required);

        return {
          ...tx,
          approvals,
          status: approvals >= tx.required ? "Completed" : "Pending",
        };
      })
    );
  }

  return (
    <section
      id="recent-transactions"
      className="bg-slate-900 rounded-2xl p-6 mt-8"
    >
      <h2 className="text-2xl font-bold mb-6">
        Recent Transactions
      </h2>

      <div className="space-y-5">
        {transactions.map((tx) => (
          <div
            key={tx.id}
            className="border-b border-slate-700 pb-5 last:border-b-0 last:pb-0"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-bold text-lg">{tx.id}</p>
                <p className="text-slate-400 mt-1">
                  {tx.amount}
                </p>
                <p className="text-slate-500 text-sm mt-1">
                  To: {tx.recipient}
                </p>
              </div>

              <div className="text-right">
                <p
                  className={
                    tx.status === "Completed"
                      ? "text-green-400 font-semibold"
                      : "text-yellow-400 font-semibold"
                  }
                >
                  {tx.status}
                </p>

                <p className="text-slate-400 mt-1">
                  {tx.approvals} / {tx.required} approvals
                </p>
              </div>
            </div>

            {tx.status === "Pending" && (
              <button
                onClick={() => approveTransaction(tx.id)}
                className="w-full mt-4 rounded-lg bg-purple-600 hover:bg-purple-700 py-3 font-semibold transition"
              >
                Approve {tx.id}
              </button>
            )}

            {tx.status === "Completed" && (
              <div className="mt-4 rounded-lg bg-green-500/10 border border-green-500/30 p-3 text-center text-green-400 font-semibold">
                ✓ Transaction fully approved
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
