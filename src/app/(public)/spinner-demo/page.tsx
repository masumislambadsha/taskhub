import Spinner from "@/components/ui/Spinner";

const variants: {
  v: "hub" | "coin" | "task" | "earnings" | "dna";
  label: string;
  desc: string;
}[] = [
  { v: "hub", label: "Hub", desc: "Buyer → Task → Worker → Coin cycle" },
  { v: "coin", label: "Coin", desc: "TaskHub coin flipping in 3D" },
  { v: "task", label: "Task", desc: "Checklist ticking off in real time" },
  { v: "earnings", label: "Earnings", desc: "Coins raining into a wallet" },
  { v: "dna", label: "DNA", desc: "Double helix strand" },
];

export default function SpinnerDemoPage() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center gap-20 p-12"
      style={{ background: "#FFF9E5", color: "#004030" }}
    >
      <h1
        className="text-3xl font-black tracking-tight"
        style={{ fontFamily: "Manrope, sans-serif" }}
      >
        TaskHub Spinners
      </h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-12">
        {variants.map(({ v, label, desc }) => (
          <div key={v} className="flex flex-col items-center gap-4 text-center">
            <Spinner variant={v} size="lg" />
            <div>
              <p className="text-sm font-bold" style={{ color: "#004030" }}>
                {label}
              </p>
              <p className="text-xs mt-1" style={{ color: "#4A9782" }}>
                {desc}
              </p>
            </div>
          </div>
        ))}
      </div>
      <Spinner variant="hub" size="xl" label="Loading TaskHub..." />
    </main>
  );
}
