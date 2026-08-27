import { useState } from "react";

export default function RecentTransactions() {
  const [approvals, setApprovals] = useState(0);

  const requiredApprovals = 2;
  const completed = approvals >= requiredApprovals;

  function approveTransaction() {
    setApprovals((current) => Math.min(current + 1, requiredApprovals));
  }

  return (
    <div
  id="approve-transaction"
  className="bg-slate-900 rounded-xl p-5 mt-8"
>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold">Recent Transactions</h2>

        <span className="text-sm text-slate-400">
          Demo approval flow
        </span>
      </div>

      <div className="space-y-4">
        <div className="border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">#001</p>
              <p className="text-slate-400">500 TRX</p>
            </div>

            <div className="text-right">
              <p
                className={
                  completed
                    ? "text-green-400 font-semibold"
                    : "text-yellow-400 font-semibold"
                }
              >
                {completed ? "Completed" : "Pending"}
              </p>

              <p className="text-slate-400">
                {approvals}/{requiredApprovals} approvals
              </p>
            </div>
          </div>

          <div className="mt-4">
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${(approvals / requiredApprovals) * 100}%`,
                }}
              />
            </div>
          </div>

          <button
            onClick={approveTransaction}
            disabled={completed}
            className={`w-full mt-4 py-3 rounded-lg font-semibold transition ${
              completed
                ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                : "bg-purple-600 hover:bg-purple-700 text-white"
            }`}
          >
            {completed ? "Transaction Completed" : "Approve TX"}
          </button>
        </div>

        <div className="flex justify-between border-b border-slate-800 pb-3">
          <div>
            <p className="font-semibold">#002</p>
            <p className="text-slate-400">150 USDT</p>
          </div>

          <div className="text-right">
            <p className="text-green-400">Completed</p>
            <p className="text-slate-400">2/2 approvals</p>
          </div>
        </div>
      </div>
    </div>
  );
}
