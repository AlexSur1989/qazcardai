type AdminEmptyProps = {
  title: string;
  description?: string;
};

export function AdminEmpty({ title, description }: AdminEmptyProps) {
  return (
    <div className="border-border bg-muted/30 text-muted-foreground flex min-h-[6rem] flex-col items-center justify-center rounded-lg border border-dashed px-4 py-10 text-center text-sm">
      <p className="text-foreground font-medium">{title}</p>
      {description ? <p className="mt-1 max-w-md text-xs">{description}</p> : null}
    </div>
  );
}
