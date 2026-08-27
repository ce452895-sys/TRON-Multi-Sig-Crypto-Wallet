import { useState } from "react";

import QuickActions from "../components/QuickActions";
import CreateTransaction from "../components/CreateTransaction";
import RecentTransactions from "../components/RecentTransactions";
import Navbar from "../components/Navbar";
import BalanceCard from "../components/BalanceCard";
import PendingCard from "../components/PendingCard";
import SignersCard from "../components/SignersCard";

type Transaction = {
  id: string;
  amount: string;
  recipient: string;
  approvals: number;
  required: number;
};

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  function addTransaction(tx: Transaction) {
    setTransactions((current) => [tx, ...current]);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <Navbar />

      <div className="grid gap-5 mt-8 md:grid-cols-3">
        <BalanceCard />

        <PendingCard />

        <SignersCard />
      </div>

      <QuickActions />

      <RecentTransactions />

      <CreateTransaction
        onTransactionCreated={addTransaction}
      />

      {transactions.length > 0 && (
        <div className="bg-slate-900 rounded-xl p-6 mt-8">
          <h2 className="text-xl font-bold mb-4">
            New Transaction
          </h2>

          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="border border-slate-800 rounded-lg p-4"
            >
              <div className="flex justify-between">
                <div>
                  <p className="font-semibold">{tx.id}</p>

                  <p className="text-slate-400">
                    {tx.amount}
                  </p>

                  <p className="text-xs text-slate-500 mt-1">
                    To: {tx.recipient}
                  </p>
                </div>

                <span className="text-yellow-400">
                  Pending
                </span>
              </div>

              <div className="mt-4">
                <p className="text-sm text-slate-400">
                  Approvals: {tx.approvals} / {tx.required}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
