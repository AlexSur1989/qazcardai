"use client";

import { useCallback, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import { formatAdminDateTime } from "@/lib/admin-format";
import { adminTerm } from "@/lib/admin-terms";
import { cn } from "@/lib/utils";

type MonitorRow = {
  id: string;
  createdAt: string;
  endpoint: string;
  statusCode: number | null;
  errorMessage: string | null;
  generationId: string | null;
};

type Stats = {
  h24: { total: number; success: number; error: number; successRate: number };
  d7: { total: number; success: number; error: number; successRate: number };
  topErrorMessages: { message: string; count: number }[];
  topEndpoints: { endpoint: string; count: number }[];
  topRequestModels: { model: string; count: number }[];
};

export type ProvidersPageInitial = {
  provider: "KIE_AI";
  baseUrl: string;
  apiKeyConfigured: boolean;
  apiKeyMasked: string | null;
  mockKie: boolean;
  mockKieFail: boolean;
  canRunRealKieGenerations: boolean;
  lastCheck: {
    checkedAt: string;
    ok: boolean;
    statusCode?: number;
    balance?: string | null;
  } | null;
  lastErrors: MonitorRow[];
  recentRequests: MonitorRow[];
  stats: Stats;
};

type CheckResult =
  | {
      ok: true;
      statusCode: number;
      balance: string | null;
      raw: unknown;
      checkedAt: string;
    }
  | {
      ok: false;
      statusCode: number;
      error: string;
      raw: unknown;
      checkedAt: string;
    };

type Props = {
  initial: ProvidersPageInitial;
  canRunConnectionCheck: boolean;
};

function JsonDetails({ value, title }: { value: unknown; title: string }) {
  const text = JSON.stringify(value, null, 2);
  return (
    <details className="rounded-md border border-border/60 bg-card/30">
      <summary className="cursor-pointer list-none px-2 py-1.5 text-xs font-medium [&::-webkit-details-marker]:hidden">
        {title} — JSON
      </summary>
      <pre className="max-h-64 overflow-auto border-t p-2 font-mono text-[11px] leading-relaxed">
        {text}
      </pre>
    </details>
  );
}

function outcomeForRow(r: MonitorRow): "ok" | "err" {
  if ((r.errorMessage?.trim() ?? "") !== "") return "err";
  if (r.statusCode != null && r.statusCode >= 400) return "err";
  if (r.statusCode != null && (r.statusCode < 200 || r.statusCode > 299)) {
    return "err";
  }
  return "ok";
}

export function ProviderMonitorClient({
  initial,
  canRunConnectionCheck,
}: Props) {
  const [data, setData] = useState<ProvidersPageInitial>(initial);
  const [checkLoading, setCheckLoading] = useState(false);
  const [lastCheckResult, setLastCheckResult] = useState<CheckResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refetchStatus = useCallback(async () => {
    setLoadError(null);
    const res = await fetch("/api/admin/providers/kie/status");
    if (!res.ok) {
      setLoadError("Не удалось обновить данные / Failed to refresh");
      return;
    }
    const j = (await res.json()) as ProvidersPageInitial;
    setData(j);
  }, []);

  const runCheck = async () => {
    if (!canRunConnectionCheck) return;
    setCheckLoading(true);
    setLastCheckResult(null);
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/providers/kie/check", { method: "POST" });
      const j = (await res.json()) as CheckResult & { error?: string };
      if (res.status === 403) {
        setLoadError("Только SUPER_ADMIN / super_admin_only");
        return;
      }
      if ("ok" in j && (j as CheckResult).ok === true) {
        setLastCheckResult(j as CheckResult);
      } else if ("ok" in j && (j as CheckResult).ok === false) {
        setLastCheckResult(j as CheckResult);
      } else {
        setLoadError(typeof j.error === "string" ? j.error : "Unknown error");
      }
      await refetchStatus();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setCheckLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {loadError && (
        <Alert variant="destructive">
          <AlertTitle>Ошибка / Error</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Kie.ai</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">API key / API-ключ</CardTitle>
              <CardDescription>
                {data.apiKeyConfigured
                  ? "Configured / Настроен"
                  : "Missing / Не задан"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-sm break-all">
                {data.apiKeyMasked ?? "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                KIE_BASE_URL / Базовый URL Kie
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-xs break-all">{data.baseUrl}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                If empty, fallback: https://api.kie.ai
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Mock mode / Тестовый режим</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-sm">
                MOCK_KIE: <strong>{data.mockKie ? "true" : "false"}</strong>
              </p>
              <p className="text-sm">
                MOCK_KIE_FAIL: <strong>{data.mockKieFail ? "true" : "false"}</strong>
              </p>
            </CardContent>
          </Card>
        </div>
        {data.mockKie && (
          <Alert>
            <AlertTitle>MOCK_KIE</AlertTitle>
            <AlertDescription>
              Включен тестовый режим. Реальные запросы к Kie.ai не отправляются. / MOCK
              mode: real requests to Kie.ai are not made.
            </AlertDescription>
          </Alert>
        )}
        {data.mockKieFail && (
          <Alert variant="destructive">
            <AlertTitle>MOCK_KIE_FAIL</AlertTitle>
            <AlertDescription>
              Все mock-запросы будут имитировать сбой. / Mock requests will
              fail.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Real generations / Реальные генерации
            </CardTitle>
            <CardDescription>
              {data.canRunRealKieGenerations
                ? "OK — ключ есть, MOCK_KIE не мешает / Key set, not in mock"
                : "Сейчас нельзя отправлять реальные запросы в Kie (нет ключа или MOCK_KIE) / Cannot run real Kie calls now"}
            </CardDescription>
          </CardHeader>
        </Card>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">
          Balance & check / Баланс и проверка
        </h3>
        {data.lastCheck && (
          <p className="text-muted-foreground text-sm">
            Last check / Последняя проверка:{" "}
            {formatAdminDateTime(data.lastCheck.checkedAt)} —{" "}
            {data.lastCheck.ok ? "ok" : "fail"} (HTTP {data.lastCheck.statusCode ?? "—"})
            {data.lastCheck.balance != null && data.lastCheck.balance !== "" ? (
              <> — balance: {String(data.lastCheck.balance)}</>
            ) : null}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {canRunConnectionCheck ? (
            <Button
              type="button"
              onClick={() => void runCheck()}
              disabled={checkLoading}
            >
              {checkLoading
                ? "…"
                : "Check connection / Проверить подключение"}
            </Button>
          ) : (
            <p className="text-muted-foreground text-sm">
              Только SUPER_ADMIN может запускать проверку подключения. / Only
              SUPER_ADMIN can run a connection check.
            </p>
          )}
          <Button type="button" variant="secondary" onClick={() => void refetchStatus()}>
            Refresh data / Обновить
          </Button>
        </div>
        {lastCheckResult && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Result / Результат ({formatAdminDateTime(lastCheckResult.checkedAt)})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {lastCheckResult.ok ? (
                <>
                  <p className="text-sm">ok: true, HTTP {lastCheckResult.statusCode}</p>
                  {lastCheckResult.balance != null && (
                    <p className="text-sm">Balance: {lastCheckResult.balance}</p>
                  )}
                  <JsonDetails title="Response" value={lastCheckResult.raw} />
                </>
              ) : (
                <>
                  <p className="text-destructive text-sm">
                    {lastCheckResult.error} (HTTP {lastCheckResult.statusCode})
                  </p>
                  <JsonDetails title="Response" value={lastCheckResult.raw} />
                </>
              )}
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Stats / Статистика</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs">Requests 24h / Запросы 24ч</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{data.stats.h24.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs">Errors 24h / Ошибки 24ч</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-destructive">
                {data.stats.h24.error}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs">Success rate 24h / % успеха</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {data.stats.h24.successRate}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs">Requests 7d / Запросы 7д</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{data.stats.d7.total}</p>
            </CardContent>
          </Card>
        </div>
        <p className="text-muted-foreground text-xs">
          7d: success {data.stats.d7.success} · error {data.stats.d7.error} · rate{" "}
          {data.stats.d7.successRate}%
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs">Top errors 24h (msg)</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-xs">
                {data.stats.topErrorMessages.length === 0 ? (
                  <li className="text-muted-foreground">—</li>
                ) : (
                  data.stats.topErrorMessages.map((e) => (
                    <li key={e.message} className="break-all">
                      ×{e.count} {e.message}
                    </li>
                  ))
                )}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs">Top endpoints 7d</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 font-mono text-[11px] break-all">
                {data.stats.topEndpoints.map((e) => (
                  <li key={e.endpoint}>
                    ×{e.count} {e.endpoint}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs">Top request models 7d</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 font-mono text-[11px] break-all">
                {data.stats.topRequestModels.length === 0 ? (
                  <li className="text-muted-foreground">—</li>
                ) : (
                  data.stats.topRequestModels.map((e) => (
                    <li key={e.model}>
                      ×{e.count} {e.model}
                    </li>
                  ))
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">
          Last errors / Последние ошибки Kie
        </h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[1%]">
                  {adminTerm("createdAt")}
                </TableHead>
                <TableHead>{adminTerm("endpoint")}</TableHead>
                <TableHead>{adminTerm("statusCode")}</TableHead>
                <TableHead>{adminTerm("generationId")}</TableHead>
                <TableHead>{adminTerm("errorMessage")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.lastErrors.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-muted-foreground text-sm"
                  >
                    Нет записей / No entries
                  </TableCell>
                </TableRow>
              ) : (
                data.lastErrors.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatAdminDateTime(r.createdAt)}
                    </TableCell>
                    <TableCell className="max-w-[200px] font-mono text-[11px] break-all">
                      {r.endpoint}
                    </TableCell>
                    <TableCell>{r.statusCode ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.generationId ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs break-all">
                      {r.errorMessage ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">
          Recent requests / Последние запросы Kie
        </h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[1%]">
                  {adminTerm("createdAt")}
                </TableHead>
                <TableHead>{adminTerm("endpoint")}</TableHead>
                <TableHead>{adminTerm("statusCode")}</TableHead>
                <TableHead>{adminTerm("generationId")}</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recentRequests.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-muted-foreground text-sm"
                  >
                    Нет записей
                  </TableCell>
                </TableRow>
              ) : (
                data.recentRequests.map((r) => {
                  const o = outcomeForRow(r);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatAdminDateTime(r.createdAt)}
                      </TableCell>
                      <TableCell className="max-w-[200px] font-mono text-[11px] break-all">
                        {r.endpoint}
                      </TableCell>
                      <TableCell>{r.statusCode ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.generationId ?? "—"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-xs font-medium",
                            o === "ok"
                              ? "bg-emerald-500/15 text-emerald-800"
                              : "bg-destructive/10 text-destructive",
                          )}
                        >
                          {o === "ok" ? "ok" : "error"}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
