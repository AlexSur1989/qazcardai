import { Skeleton } from "@/components/ui/skeleton";

export default function HistoryDetailLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Загрузка">
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-4 h-4 w-full max-w-md" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-24" />
      </div>
      <div className="space-y-4 sm:max-w-2xl">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}
