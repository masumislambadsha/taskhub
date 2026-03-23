import { SkeletonTablePage } from "@/components/ui/Skeleton";
export default function Loading() {
  return (
    <SkeletonTablePage
      rows={6}
      cols={5}
      headers={["Task", "Buyer", "Payout", "Status", "Date"]}
      filterCount={4}
    />
  );
}
