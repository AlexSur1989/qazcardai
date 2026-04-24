import { Skeleton } from "@/components/ui/skeleton";

/** Скелетон поля формы создания (фото/видео), только UI. */
export function CreateFormSkeleton() {
  return (
    <div className="space-y-4" aria-busy aria-label="Загрузка формы">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full max-w-md" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-28 w-full" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-36" />
      </div>
    </div>
  );
}
