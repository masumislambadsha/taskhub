import { SkeletonTablePage } from "@/components/ui/Skeleton";
export default function Loading() {
  return (
    <SkeletonTablePage
      rows={8}
      cols={6}
      headers={["User", "Role", "Coins", "Status", "Joined", "Actions"]}
      filterCount={2}
    />
  );
}
