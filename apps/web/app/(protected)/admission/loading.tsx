import { Skeleton } from "@webcampus/ui/components/skeleton";

export default function AdmissionLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-96" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
