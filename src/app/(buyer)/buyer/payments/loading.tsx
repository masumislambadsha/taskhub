import { SkeletonTablePage } from "@/components/ui/Skeleton";
export default function Loading() {
  return (
    <SkeletonTablePage
      rows={5}
      cols={5}
      headers={["Date", "Coins", "Amount", "Gateway", "Status"]}
      filterCount={1}
    />
  );
}
