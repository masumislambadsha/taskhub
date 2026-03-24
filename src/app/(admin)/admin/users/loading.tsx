import { SkeletonAdminListPage } from "@/components/ui/Skeleton";
export default function Loading() {
  return <SkeletonAdminListPage rows={8} filterCount={2} />;
}
