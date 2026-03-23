import Spinner from "@/components/ui/Spinner";

export default function Loading() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#FFF9E5" }}
    >
      <Spinner variant="hub" size="xl" label="Loading TaskHub..." />
    </div>
  );
}
