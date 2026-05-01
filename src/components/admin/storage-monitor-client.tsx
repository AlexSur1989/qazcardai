"use client";

import { useCallback, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBytes } from "@/lib/format-bytes";
import { formatAdminDateTime } from "@/lib/admin-format";
import { cn } from "@/lib/utils";

type FileItem = {
  id: string;
  fileName: string;
  fileType: string;
  mimeType: string;
  size: number;
  url: string | null;
  createdAt: string;
  userId: string;
  userEmail: string | null;
  generationId: string | null;
  storageKey: string;
  purpose: string | null;
};

type Config = {
  mode: "s3" | "local" | "not_configured";
  s3EndpointConfigured: boolean;
  s3BucketConfigured: boolean;
  s3PublicUrlConfigured: boolean;
  s3RegionConfigured: boolean;
  accessKeyConfigured: boolean;
  secretKeyConfigured: boolean;
  endpoint: string;
  bucket: string;
  publicUrl: string;
  region: string;
};

type Stats = {
  uploadedFilesCount: number;
  uploadedFilesSize: number;
  generatedFilesCount: number;
  generatedFilesSize: number | null;
  filesMissingStorageKeyCount: number;
};

export type StoragePageInitial = {
  config: Config;
  stats: Stats;
  recentFiles: FileItem[];
  largestFiles: FileItem[];
  warnings: string[];
};

type Props = {
  initial: StoragePageInitial;
  canRunStorageCheck: boolean;
  isProduction: boolean;
};

function boolLabel(v: boolean) {
  return v ? "Configured / Настроено" : "Missing / Не задано";
}

export function StorageMonitorClient({
  initial,
  canRunStorageCheck,
  isProduction,
}: Props) {
  const [data, setData] = useState<StoragePageInitial>(initial);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<{
    ok: boolean;
    message: string;
    detail?: string;
    checkedAt?: string;
  } | null>(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [urlCheckById, setUrlCheckById] = useState<Record<string, string>>({});
  const [urlCheckLoading, setUrlCheckLoading] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(null);
    const res = await fetch("/api/admin/storage/status");
    if (!res.ok) {
      setLoadError("Failed to load / Не удалось загрузить");
      return;
    }
    setData((await res.json()) as StoragePageInitial);
  }, []);

  const runStorageCheck = async () => {
    if (!canRunStorageCheck) return;
    setCheckLoading(true);
    setCheckResult(null);
    try {
      const res = await fetch("/api/admin/storage/check", { method: "POST" });
      const j = (await res.json()) as {
        ok?: boolean;
        message?: string;
        detail?: string;
        mode?: string;
        checkedAt?: string;
        error?: string;
      };
      if (res.status === 403) {
        setLoadError("super_admin_only");
        return;
      }
      if (j.ok) {
        setCheckResult({
          ok: true,
          message: j.message ?? "OK",
          detail: j.detail,
          checkedAt: j.checkedAt,
        });
      } else {
        setCheckResult({
          ok: false,
          message: j.message ?? "Error",
          checkedAt: j.checkedAt,
        });
      }
      await refresh();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Error");
    } finally {
      setCheckLoading(false);
    }
  };

  const checkFileUrl = async (f: FileItem) => {
    const u = f.url?.trim();
    if (!u) {
      setUrlCheckById((m) => ({ ...m, [f.id]: "No URL" }));
      return;
    }
    setUrlCheckLoading(f.id);
    setUrlCheckById((m) => {
      const n = { ...m };
      delete n[f.id];
      return n;
    });
    try {
      const res = await fetch("/api/admin/storage/check-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u }),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        error?: string;
        statusCode?: number;
        contentType?: string;
        contentLength?: string;
      };
      if (!j.ok) {
        setUrlCheckById((m) => ({
          ...m,
          [f.id]: j.error ?? `HTTP ${res.status}`,
        }));
        return;
      }
      setUrlCheckById((m) => ({
        ...m,
        [f.id]: `HTTP ${j.statusCode} · ${j.contentType} · ${j.contentLength}`,
      }));
    } catch (e) {
      setUrlCheckById((m) => ({
        ...m,
        [f.id]: e instanceof Error ? e.message : "fetch error",
      }));
    } finally {
      setUrlCheckLoading(null);
    }
  };

  const copyUrl = (u: string) => {
    void navigator.clipboard.writeText(u);
  };

  const modeLabel =
    data.config.mode === "s3"
      ? "s3"
      : data.config.mode === "local"
        ? "local"
        : "not_configured";

  return (
    <div className="space-y-8">
      {loadError && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {isProduction && data.config.mode === "local" && (
        <Alert variant="destructive">
          <AlertTitle>Production / VPS</AlertTitle>
          <AlertDescription>
            В production нельзя хранить файлы на локальном диске VPS. / Use
            S3/R2 in production.
          </AlertDescription>
        </Alert>
      )}

      {data.warnings.map((w) => (
        <Alert key={w} className="border-amber-500/50 bg-amber-500/5">
          <AlertDescription>{w}</AlertDescription>
        </Alert>
      ))}

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Storage config / Настройки</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm">
                Storage mode / Режим хранения
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-sm font-semibold">{modeLabel}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm">S3 endpoint / Endpoint S3</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono break-all text-xs">{data.config.endpoint}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm">S3 bucket / Bucket S3</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono break-all text-xs">{data.config.bucket}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm">S3 region / Регион S3</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-xs">{data.config.region}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm">
                Public URL / Публичный URL
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono break-all text-xs">{data.config.publicUrl}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm">Access key / Ключ доступа</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                {boolLabel(data.config.accessKeyConfigured)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm">Secret key / Секретный ключ</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                {boolLabel(data.config.secretKeyConfigured)}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        {canRunStorageCheck ? (
          <Button
            type="button"
            onClick={() => void runStorageCheck()}
            disabled={checkLoading}
          >
            {checkLoading ? "…" : "Check storage / Проверить хранилище"}
          </Button>
        ) : (
          <p className="text-muted-foreground text-sm">
            Check storage: SUPER_ADMIN only / Только SUPER_ADMIN
          </p>
        )}
        <Button
          type="button"
          variant="secondary"
          onClick={() => void refresh()}
        >
          Refresh / Обновить
        </Button>
      </section>

      {checkResult && (
        <Alert variant={checkResult.ok ? "default" : "destructive"}>
          <AlertTitle>{checkResult.ok ? "OK" : "Error"}</AlertTitle>
          <AlertDescription>
            {checkResult.message}
            {checkResult.detail ? ` — ${checkResult.detail}` : ""}
            {checkResult.checkedAt
              ? ` · ${formatAdminDateTime(checkResult.checkedAt)}`
              : null}
          </AlertDescription>
        </Alert>
      )}

      <section>
        <h3 className="text-sm font-semibold mb-3">Stats / Статистика</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs">
                Uploaded files / Загруженные файлы
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {data.stats.uploadedFilesCount}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs">Total size / Общий размер</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {formatBytes(data.stats.uploadedFilesSize)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs">
                Generated files / Сгенерированные
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {data.stats.generatedFilesCount}
              </p>
              <p className="text-muted-foreground text-xs">
                size:{" "}
                {data.stats.generatedFilesSize == null
                  ? "n/a"
                  : formatBytes(data.stats.generatedFilesSize)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs">Recent uploads (table below)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                {data.recentFiles.length} rows
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <FileTable
        title="Recent files / Последние файлы"
        files={data.recentFiles}
        onCheckUrl={checkFileUrl}
        onCopyUrl={copyUrl}
        urlCheckById={urlCheckById}
        urlCheckLoading={urlCheckLoading}
      />

      <FileTable
        title="Largest files / Самые большие (top 20)"
        files={data.largestFiles}
        onCheckUrl={checkFileUrl}
        onCopyUrl={copyUrl}
        urlCheckById={urlCheckById}
        urlCheckLoading={urlCheckLoading}
      />
    </div>
  );
}

function FileTable({
  title,
  files,
  onCheckUrl,
  onCopyUrl,
  urlCheckById,
  urlCheckLoading,
}: {
  title: string;
  files: FileItem[];
  onCheckUrl: (f: FileItem) => void;
  onCopyUrl: (u: string) => void;
  urlCheckById: Record<string, string>;
  urlCheckLoading: string | null;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File / Файл</TableHead>
              <TableHead>Type / Тип</TableHead>
              <TableHead>MIME</TableHead>
              <TableHead>Size / Размер</TableHead>
              <TableHead>Purpose / Назначение</TableHead>
              <TableHead>User / Пользователь</TableHead>
              <TableHead>Generation</TableHead>
              <TableHead>Created at</TableHead>
              <TableHead>URL / Проверка</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground text-sm">
                  No files / Нет файлов
                </TableCell>
              </TableRow>
            ) : (
              files.map((f) => (
                <TableRow key={f.id}>
                  <TableCell
                    className="max-w-[140px] text-xs break-all"
                    title={f.fileName}
                  >
                    {f.fileName}
                  </TableCell>
                  <TableCell className="text-xs">{f.fileType}</TableCell>
                  <TableCell className="text-xs">{f.mimeType}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatBytes(f.size)}
                  </TableCell>
                  <TableCell className="text-xs">{f.purpose ?? "—"}</TableCell>
                  <TableCell
                    className="max-w-[120px] text-xs break-all"
                    title={f.userEmail ?? f.userId}
                  >
                    {f.userEmail ?? f.userId.slice(0, 8) + "…"}
                  </TableCell>
                  <TableCell className="font-mono text-[10px]">
                    {f.generationId ? (
                      <span className="break-all">{f.generationId}</span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatAdminDateTime(f.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-[220px] flex-col gap-1">
                      {f.url ? (
                        <a
                          className="text-primary text-xs underline break-all"
                          href={f.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open / Открыть
                        </a>
                      ) : null}
                      <div className="flex flex-wrap gap-1">
                        {f.url ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-[10px]"
                              disabled={urlCheckLoading === f.id}
                              onClick={() => onCheckUrl(f)}
                            >
                              Check URL
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 text-[10px]"
                              onClick={() => onCopyUrl(f.url!)}
                            >
                              Copy
                            </Button>
                          </>
                        ) : null}
                      </div>
                      {urlCheckById[f.id] && (
                        <span
                          className={cn(
                            "text-[10px] break-all",
                            urlCheckById[f.id].startsWith("HTTP 2")
                              ? "text-emerald-800"
                              : "text-amber-800",
                          )}
                        >
                          {urlCheckById[f.id]}
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
