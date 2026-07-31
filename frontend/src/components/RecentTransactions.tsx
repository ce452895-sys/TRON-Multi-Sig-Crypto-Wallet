export default function RecentTransactions() {
  const txs = [
    {
      id: "#001",
      amount: "500 TRX",
      status: "Pending",
      signer: "2 / 3",
    },
    {
      id: "#002",
      amount: "150 USDT",
      status: "Completed",
      signer: "3 / 3",
    },
  ];

  return (
    <div className="bg-slate-900 rounded-xl p-5 mt-8">
      <h2 className="text-xl font-bold mb-4">
        Recent Transactions
      </h2>

      <div className="space-y-4">
        {txs.map((tx) => (
          <div
            key={tx.id}
            className="flex justify-between border-b border-slate-800 pb-3"
          >
            <div>
              <p className="font-semibold">{tx.id}</p>
              <p className="text-slate-400">{tx.amount}</p>
            </div>

            <div className="text-right">
              <p>{tx.status}</p>
              <p className="text-slate-400">
                {tx.signer} signatures
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
