import Spinner from "@/components/ui/Spinner";

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-on-background">
      <Spinner variant="hub" size="xl" label="Loading TaskHub..." />
    </div>
  );
}
