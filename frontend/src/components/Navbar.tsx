import { useWallet } from "../hooks/useWallet";

export default function Navbar() {
  const { address, connectWallet } = useWallet();

  return (
    <nav className="flex items-center justify-between">
      <h1 className="text-2xl font-bold text-white">
        TRON Multi-Sig Wallet
      </h1>

      <button
        onClick={connectWallet}
        className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-semibold"
      >
        {address
          ? `${address.slice(0, 6)}...${address.slice(-4)}`
          : "Connect Wallet"}
      </button>
    </nav>
  );
}
