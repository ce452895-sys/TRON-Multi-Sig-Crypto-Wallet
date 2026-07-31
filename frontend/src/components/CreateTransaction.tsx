export default function CreateTransaction() {
  return (
    <div className="bg-slate-900 rounded-xl p-6 mt-8">
      <h2 className="text-2xl font-bold mb-5">
        Create Transaction
      </h2>

      <div className="space-y-4">
        <input
          type="text"
          placeholder="Recipient Address"
          className="w-full rounded-lg bg-slate-800 p-3 outline-none"
        />

        <input
          type="number"
          placeholder="Amount"
          className="w-full rounded-lg bg-slate-800 p-3 outline-none"
        />

        <button className="w-full rounded-lg bg-red-600 py-3 font-semibold hover:bg-red-700">
          Submit for Approval
        </button>
      </div>
    </div>
  );
}
