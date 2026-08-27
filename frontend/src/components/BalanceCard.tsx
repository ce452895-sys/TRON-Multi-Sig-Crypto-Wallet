import { useWallet } from "../hooks/useWallet";

export default function BalanceCard() {
  const { balance } = useWallet();

  return (
    <div className="bg-slate-900 rounded-xl p-5">
      <p className="text-slate-400">Wallet Balance</p>

      <h2 className="text-4xl font-bold mt-2">
        {Number(balance).toFixed(2)} TRX
      </h2>

      <p className="text-green-400 mt-2">
        Connected to TronLink
      </p>
    </div>
  );
}
