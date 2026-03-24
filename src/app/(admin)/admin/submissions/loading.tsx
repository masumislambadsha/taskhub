import {
  SkeletonTableWithCards,
  Bone,
  SkeletonStatCard,
} from "@/components/ui/Skeleton";
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Bone className="h-7 w-44" />
        <Bone className="h-4 w-60" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>
      <div className="bg-white rounded-xl border border-primary/5 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-primary/5 flex items-center justify-between">
          <Bone className="h-5 w-40" />
          <Bone className="h-3 w-16" />
        </div>
        <SkeletonTableWithCards
          rows={8}
          cols={6}
          headers={["Worker", "Task", "Buyer", "Payout", "Status", "Date"]}
          cardCount={6}
          mdBreakpoint
        />
      </div>
    </div>
  );
}
