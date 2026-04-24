import type { ReactNode } from "react";

type DashboardSectionEmptyProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
};

export function DashboardSectionEmpty({
  title,
  description,
  icon,
  action,
}: DashboardSectionEmptyProps) {
  return (
    <div className="border-border bg-muted/30 flex min-h-[8rem] flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center">
      {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      <p className="text-foreground text-sm font-medium">{title}</p>
      {description ? (
        <p className="text-muted-foreground max-w-sm text-xs">{description}</p>
      ) : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
