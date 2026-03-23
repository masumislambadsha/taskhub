import { SkeletonTablePage } from "@/components/ui/Skeleton";
export default function Loading() {
  return (
    <SkeletonTablePage
      rows={5}
      cols={6}
      headers={["Title", "Status", "Workers", "Payout", "Deadline", "Actions"]}
      filterCount={1}
    />
  );
}
