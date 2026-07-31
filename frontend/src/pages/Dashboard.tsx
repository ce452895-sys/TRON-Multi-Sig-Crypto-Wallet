import QuickActions from "../components/QuickActions";
import CreateTransaction from "../components/CreateTransaction";
import RecentTransactions from "../components/RecentTransactions";
import Navbar from "../components/Navbar";
import BalanceCard from "../components/BalanceCard";
import PendingCard from "../components/PendingCard";
import SignersCard from "../components/SignersCard";

export default function Dashboard() {
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

      <CreateTransaction />
    </div>
  );
}
