export default function QuickActions() {
  function openApproval() {
    const section = document.getElementById("approve-transaction");

    if (section) {
      section.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      section.classList.add("ring-2", "ring-purple-500");

      setTimeout(() => {
        section.classList.remove("ring-2", "ring-purple-500");
      }, 1200);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-4 mt-8">
      <button
        className="bg-blue-600 hover:bg-blue-700 rounded-xl py-4 font-semibold transition"
      >
        Send TRX
      </button>

      <button
        onClick={openApproval}
        className="bg-purple-600 hover:bg-purple-700 rounded-xl py-4 font-semibold transition"
      >
        Approve TX
      </button>

      <button
        className="bg-green-600 hover:bg-green-700 rounded-xl py-4 font-semibold transition"
      >
        Add Signer
      </button>

      <button
        className="bg-orange-600 hover:bg-orange-700 rounded-xl py-4 font-semibold transition"
      >
        History
      </button>
    </div>
  );
}
