import Link from "next/link";
import { ArrowLeft, Download, Film, RotateCcw } from "lucide-react";

import { adminTerm } from "@/lib/admin-terms";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { generationStatusLabel, generationTypeLabel } from "@/lib/generation-labels";
import type { UserGenerationDetail } from "@/lib/generation-history-data";
import type { UserFacingGenerationDetail } from "@/lib/generation-display";
import { parseOutputFilesList } from "@/lib/generation-output-utils";
import type { GenerationStatus } from "@/generated/prisma/enums";

function statusBadgeClass(status: GenerationStatus): string {
  switch (status) {
    case "COMPLETED":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200";
    case "FAILED":
    case "BLOCKED":
    case "CANCELLED":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    case "PROCESSING":
    case "QUEUED":
    case "CREATED":
      return "border-primary/30 bg-primary/10";
    case "REFUNDED":
      return "border-amber-500/35 bg-amber-500/10 text-amber-900 dark:text-amber-100";
    default:
      return "";
  }
}

function adminRepeatHref(gen: UserGenerationDetail): string {
  const path =
    gen.type === "IMAGE" ? "/dashboard/create/image" : "/dashboard/create/video";
  const p = new URLSearchParams();
  p.set("modelId", gen.model.id);
  if (gen.prompt.length < 2000) {
    p.set("prompt", gen.prompt);
  }
  return `${path}?${p.toString()}`;
}

type AdminProps = {
  showTechnicalDetails: true;
  gen: UserGenerationDetail;
  backHref: string;
  backLabel: string;
  userEmail?: string;
  userIdForAdminLink?: string;
  showRepeat?: boolean;
  adminBilingualLabels?: boolean;
  suppressFinanceAndProviderInternals?: boolean;
};

type UserProps = {
  showTechnicalDetails?: false;
  display: UserFacingGenerationDetail;
  backHref: string;
  backLabel: string;
  showRepeat?: boolean;
};

type Props = AdminProps | UserProps;

function UserGenerationDetailBody({
  display,
  backHref,
  backLabel,
  showRepeat = true,
}: UserProps) {
  return (
    <div className="space-y-8">
      <div>
        <Link
          href={backHref}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "mb-2 inline-flex items-center gap-1",
          )}
        >
          <ArrowLeft className="size-3.5" />
          {backLabel}
        </Link>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          {display.title}
        </h1>
        {display.subtitle ? (
          <p className="text-muted-foreground mt-1 text-sm">{display.subtitle}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{display.kindLabel}</Badge>
        <Badge variant="outline" className={statusBadgeClass(display.status)}>
          {display.statusLabel}
        </Badge>
        {showRepeat && display.repeatHref ? (
          <Link
            href={display.repeatHref}
            className={cn(
              buttonVariants({ variant: "secondary", size: "sm" }),
              "inline-flex items-center gap-1",
            )}
          >
            <RotateCcw className="size-3.5" />
            Повторить
          </Link>
        ) : null}
        {display.videoSourceHref ? (
          <Link
            href={display.videoSourceHref}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "inline-flex items-center gap-1",
            )}
          >
            <Film className="size-3.5" />
            Использовать для видео
          </Link>
        ) : null}
      </div>

      {display.previewUrl && display.status === "COMPLETED" ? (
        <div className="max-w-xl">
          <p className="text-muted-foreground mb-2 text-xs font-medium">Результат</p>
          <div className="bg-muted/30 overflow-hidden rounded-lg border">
            {display.type === "VIDEO" ? (
              <video
                src={display.previewUrl}
                controls
                playsInline
                className="max-h-[min(70vh,520px)] w-full object-contain"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- remote generation URL
              <img
                src={display.previewUrl}
                alt=""
                className="max-h-[min(70vh,520px)] w-full object-contain"
              />
            )}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:max-w-xl">
        {display.scenarioLabel ? (
          <p className="text-sm">
            <span className="text-muted-foreground">Сценарий:</span>{" "}
            <span className="font-medium">{display.scenarioLabel}</span>
          </p>
        ) : null}
        {display.slideLabel ? (
          <p className="text-sm">
            <span className="text-muted-foreground">Слайд:</span>{" "}
            <span className="font-medium">{display.slideLabel}</span>
          </p>
        ) : null}
        {display.slidePurpose ? (
          <p className="text-sm">
            <span className="text-muted-foreground">Назначение:</span>{" "}
            {display.slidePurpose}
          </p>
        ) : null}
        {display.marketplaceLabel ? (
          <p className="text-sm">
            <span className="text-muted-foreground">Маркетплейс:</span>{" "}
            {display.marketplaceLabel}
          </p>
        ) : null}
        {display.categoryLabel ? (
          <p className="text-sm">
            <span className="text-muted-foreground">Категория:</span>{" "}
            {display.categoryLabel}
          </p>
        ) : null}
        <p className="text-sm">
          <span className="text-muted-foreground">Статус:</span>{" "}
          {display.statusLabel}
        </p>
        <p className="text-sm">
          <span className="text-muted-foreground">Стоимость:</span>{" "}
          <span className="tabular-nums font-medium">{display.costCredits} токенов</span>
        </p>
        <p className="text-sm">
          <span className="text-muted-foreground">Создана:</span>{" "}
          {display.createdAt.toLocaleString("ru-RU", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </p>
        {display.completedAt ? (
          <p className="text-sm">
            <span className="text-muted-foreground">Завершена:</span>{" "}
            {display.completedAt.toLocaleString("ru-RU", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </p>
        ) : null}
      </div>

      {display.canDownloadIndices.length > 0 ? (
        <div>
          <p className="text-muted-foreground mb-2 text-xs font-medium">Скачать</p>
          <ul className="flex flex-col gap-2">
            {display.canDownloadIndices.map((i) => (
              <li key={i}>
                <a
                  href={`/api/generations/${display.id}/download?index=${i}`}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "inline-flex items-center gap-1",
                  )}
                >
                  <Download className="size-3.5" />
                  {display.canDownloadIndices.length > 1 ? `Файл ${i + 1}` : "Скачать"}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {display.errorMessage ? (
        <div>
          <p className="text-destructive text-xs font-medium">Ошибка</p>
          <p className="text-destructive mt-0.5 text-sm leading-relaxed">
            {display.errorMessage}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function AdminGenerationDetailBody({
  gen,
  backHref,
  backLabel,
  userEmail,
  userIdForAdminLink,
  showRepeat = true,
  adminBilingualLabels = false,
  suppressFinanceAndProviderInternals = false,
}: AdminProps) {
  const files = parseOutputFilesList(gen.outputFiles);
  const showTech = adminBilingualLabels;
  const canDownload = (i: number) => {
    const f = files[i];
    return Boolean(f?.url?.trim() || f?.storageKey);
  };

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={backHref}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "mb-2 inline-flex items-center gap-1",
          )}
        >
          <ArrowLeft className="size-3.5" />
          {backLabel}
        </Link>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          {adminBilingualLabels ? adminTerm("generation") : "Генерация"}
        </h1>
        {showTech ? (
          <p className="text-muted-foreground mt-1 font-mono text-xs break-all">
            {gen.id}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{generationTypeLabel(gen.type)}</Badge>
        <Badge variant="outline" className={statusBadgeClass(gen.status)}>
          {generationStatusLabel(gen.status)}
        </Badge>
        {showRepeat ? (
          <Link
            href={adminRepeatHref(gen)}
            className={cn(
              buttonVariants({ variant: "secondary", size: "sm" }),
              "inline-flex items-center gap-1",
            )}
          >
            <RotateCcw className="size-3.5" />
            Повторить
          </Link>
        ) : null}
      </div>

      {userEmail ? (
        <p className="text-sm">
          <span className="text-muted-foreground">Пользователь:</span>{" "}
          {userIdForAdminLink ? (
            <Link
              href={`/admin/users/${userIdForAdminLink}`}
              className="text-primary font-medium underline"
            >
              {userEmail}
            </Link>
          ) : (
            userEmail
          )}
        </p>
      ) : null}

      <div className="grid gap-6 sm:max-w-2xl">
        <div>
          <p className="text-muted-foreground text-xs font-medium">
            {adminBilingualLabels ? adminTerm("model") : "Модель"}
          </p>
          <p className="text-foreground text-sm">
            {gen.model.name}
            {showTech ? (
              <span className="text-muted-foreground"> ({gen.model.slug})</span>
            ) : null}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs font-medium">Промпт</p>
          <p className="text-foreground mt-0.5 whitespace-pre-wrap text-sm">
            {gen.prompt}
          </p>
        </div>
        {(showTech || gen.negativePrompt?.trim()) ? (
          <div>
            <p className="text-muted-foreground text-xs font-medium">Негативный промпт</p>
            <p className="text-foreground mt-0.5 whitespace-pre-wrap text-sm">
              {gen.negativePrompt?.trim() ? gen.negativePrompt : "—"}
            </p>
          </div>
        ) : null}
        {showTech ? (
          <>
            {!suppressFinanceAndProviderInternals ? (
              <>
                <div>
                  <p className="text-muted-foreground text-xs font-medium">
                    {adminTerm("providerTaskId")}
                  </p>
                  <p className="text-foreground mt-0.5 font-mono text-sm break-all">
                    {gen.providerTaskId ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium">
                    {adminTerm("metadata")}
                  </p>
                  <pre className="bg-muted/50 text-foreground mt-1 max-h-64 overflow-auto rounded-md border p-3 font-mono text-xs">
                    {gen.metadata == null
                      ? "—"
                      : JSON.stringify(gen.metadata, null, 2)}
                  </pre>
                </div>
              </>
            ) : null}
            <div>
              <p className="text-muted-foreground text-xs font-medium">
                {adminTerm("inputFiles")}
              </p>
              <pre className="bg-muted/50 text-foreground mt-1 max-h-64 overflow-auto rounded-md border p-3 font-mono text-xs">
                {gen.inputFiles == null
                  ? "—"
                  : JSON.stringify(gen.inputFiles, null, 2)}
              </pre>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium">
                {adminTerm("outputFiles")}
              </p>
              <pre className="bg-muted/50 text-foreground mt-1 max-h-64 overflow-auto rounded-md border p-3 font-mono text-xs">
                {gen.outputFiles == null
                  ? "—"
                  : JSON.stringify(gen.outputFiles, null, 2)}
              </pre>
            </div>
          </>
        ) : null}
        {files.length > 0 && (
          <div>
            <p className="text-muted-foreground mb-2 text-xs font-medium">Скачать</p>
            <ul className="flex flex-col gap-2">
              {files.map((f, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground font-mono text-xs">#{i}</span>
                  {f.kind && (
                    <Badge variant="secondary" className="text-xs">
                      {f.kind}
                    </Badge>
                  )}
                  {gen.status === "COMPLETED" && canDownload(i) ? (
                    <a
                      href={`/api/generations/${gen.id}/download?index=${i}`}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "inline-flex items-center gap-1",
                      )}
                    >
                      <Download className="size-3.5" />
                      Файл
                    </a>
                  ) : (
                    <span className="text-muted-foreground text-xs">недоступно</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {gen.errorMessage ? (
          <div>
            <p className="text-destructive text-xs font-medium">
              {adminBilingualLabels ? adminTerm("errorMessage") : "Ошибка"}
            </p>
            <p className="text-destructive mt-0.5 whitespace-pre-wrap text-sm">
              {gen.errorMessage}
            </p>
          </div>
        ) : null}

        <div className="grid gap-1 text-sm sm:grid-cols-2">
          {!suppressFinanceAndProviderInternals ? (
            <p>
              <span className="text-muted-foreground">
                {adminBilingualLabels ? adminTerm("costCredits") : "Стоимость (токены)"}:
              </span>{" "}
              <span className="tabular-nums font-medium">{gen.costCredits}</span>
            </p>
          ) : null}
          <p
            className={cn(!suppressFinanceAndProviderInternals ? "" : "sm:col-span-2")}
          >
            <span className="text-muted-foreground">
              {adminBilingualLabels ? adminTerm("createdAt") : "Создана"}:
            </span>{" "}
            {gen.createdAt.toLocaleString("ru-RU", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </p>
          <p className="sm:col-span-2">
            <span className="text-muted-foreground">
              {adminBilingualLabels ? adminTerm("completedAt") : "Завершена"}:
            </span>{" "}
            {gen.completedAt
              ? gen.completedAt.toLocaleString("ru-RU", {
                  dateStyle: "short",
                  timeStyle: "short",
                })
              : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

export function GenerationDetailView(props: Props) {
  if (props.showTechnicalDetails) {
    return <AdminGenerationDetailBody {...props} />;
  }
  return <UserGenerationDetailBody {...props} />;
}
