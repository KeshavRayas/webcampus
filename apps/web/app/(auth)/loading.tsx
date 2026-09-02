import { Skeleton } from "@webcampus/ui/components/skeleton";

export default function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <Skeleton className="mx-auto h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
