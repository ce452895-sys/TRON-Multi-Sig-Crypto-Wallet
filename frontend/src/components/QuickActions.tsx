export default function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-4 mt-8">
      <button className="bg-blue-600 rounded-xl py-4 font-semibold">
        Send TRX
      </button>

      <button className="bg-purple-600 rounded-xl py-4 font-semibold">
        Approve TX
      </button>

      <button className="bg-green-600 rounded-xl py-4 font-semibold">
        Add Signer
      </button>

      <button className="bg-orange-600 rounded-xl py-4 font-semibold">
        History
      </button>
    </div>
  );
}
