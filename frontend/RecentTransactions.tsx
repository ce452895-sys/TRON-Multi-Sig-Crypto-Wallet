export default function RecentTransactions() {
  const txs = [
    {
      id: "#001",
      amount: "500 TRX",
      status: "Pending",
      signer: "1 / 2",
    },
    {
      id: "#002",
      amount: "150 USDT",
      status: "Completed",
      signer: "2 / 2",
    },
  ];

  return (
    <div className="bg-slate-900 rounded-2xl p-6 mt-8 border border-slate-800 shadow-lg">
      <h2 className="text-xl font-bold mb-6 text-white">
        Recent Transactions
      </h2>

      <div className="space-y-5">
        {txs.map((tx) => (
          <div
            key={tx.id}
            className="flex items-center justify-between border-b border-slate-800 pb-4 last:border-0 last:pb-0"
          >
            <div>
              <p className="font-semibold text-white">
                {tx.id}
              </p>

              <p className="text-slate-400 mt-1">
                {tx.amount}
              </p>
            </div>

            <div className="text-right">
              <p
                className={
                  tx.status === "Pending"
                    ? "text-yellow-400 font-medium"
                    : "text-green-400 font-medium"
                }
              >
                {tx.status}
              </p>

              <p className="text-slate-400 text-sm mt-1">
                {tx.signer} signatures
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
