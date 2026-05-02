
import { redactKieLogPayload } from "@/server/services/provider/kie";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { trySendAdminProviderErrorEmail } from "@/server/services/notificationsIntegration";
import { prisma } from "@/lib/prisma";
import { isMockKie, isMockKieFail } from "@/lib/kie-mock";

const KIE_DEFAULT_BASE = "https://api.kie.ai";
const KIE_CREDIT_PATH = "/api/v1/chat/credit";
const KIE_CHECK_FETCH_MS = 30_000;

function readKieBaseUrlForMonitor(): string {
  const raw = process.env.KIE_BASE_URL?.trim();
  return (raw && raw.length > 0 ? raw : KIE_DEFAULT_BASE).replace(/\/$/, "");
}

/**
 * РЎС‚Р°С‚РёС‡РЅР°СЏ РјР°СЃРєР° РєР»СЋС‡Р°. РћСЂРёРіРёРЅР°Р» РЅРµ РїРёС€РµС‚ РІ Р»РѕРі.
 */
export function maskApiKey(apiKey: string | null | undefined): string | null {
  if (apiKey == null) return null;
  const s = String(apiKey).trim();
  if (s.length === 0) return null;
  if (s.length <= 7) return "***";
  if (s.length <= 8) {
    return `${s.slice(0, 2)}***${s.slice(-2)}`;
  }
  return `${s.slice(0, 4)}***${s.slice(-4)}`;
}

function readKieKeyTrimmed(): string {
  return process.env.KIE_API_KEY?.trim() ?? "";
}

export type KieProviderConfigStatus = {
  provider: "KIE_AI";
  baseUrl: string;
  apiKeyConfigured: boolean;
  apiKeyMasked: string | null;
  mockKie: boolean;
  mockKieFail: boolean;
  canRunRealKieGenerations: boolean;
};

export function getKieProviderConfigStatus(): KieProviderConfigStatus {
  const key = readKieKeyTrimmed();
  const apiKeyConfigured = key.length > 0;
  const mockKie = isMockKie();
  const mockKieFail = isMockKieFail();
  return {
    provider: "KIE_AI",
    baseUrl: readKieBaseUrlForMonitor(),
    apiKeyConfigured,
    apiKeyMasked: maskApiKey(key),
    mockKie,
    mockKieFail,
    canRunRealKieGenerations: apiKeyConfigured && !mockKie,
  };
}

type LastCheckInfo = {
  checkedAt: string;
  ok: boolean;
  statusCode?: number;
  balance?: string | null;
} | null;

function parseAuditMetadata(
  m: unknown,
):
  | { ok?: boolean; statusCode?: number; checkedAt?: string; balance?: string | null }
  | undefined {
  if (!m || typeof m !== "object") return undefined;
  return m as { ok?: boolean; statusCode?: number; checkedAt?: string; balance?: string | null };
}

export async function getLastKieProviderCheckFromAudit(): Promise<LastCheckInfo> {
  const row = await prisma.adminAuditLog.findFirst({
    where: { action: "KIE_PROVIDER_CHECK_RUN" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, metadata: true },
  });
  if (!row) return null;
  const meta = parseAuditMetadata(row.metadata);
  return {
    checkedAt: (meta?.checkedAt ?? row.createdAt.toISOString()) as string,
    ok: Boolean(meta?.ok),
    statusCode: meta?.statusCode,
    balance:
      meta?.balance === undefined
        ? undefined
        : (meta?.balance as string | null),
  };
}

type LogClassifyInput = {
  statusCode: number | null;
  errorMessage: string | null;
};

function classifyLog(row: LogClassifyInput): "success" | "error" {
  const em = row.errorMessage?.trim() ?? "";
  const sc = row.statusCode;
  if (em.length > 0) return "error";
  if (sc != null && sc >= 400) return "error";
  if (sc != null && (sc < 200 || sc > 299)) return "error";
  return "success";
}

const KIE_WHERE: { provider: { in: string[] } } = {
  provider: { in: ["KIE_AI", "KIE_AI_MOCK"] },
};

type WindowStats = {
  total: number;
  success: number;
  error: number;
  successRate: number;
};

async function windowStats(
  gte: Date,
): Promise<{
  w: WindowStats;
  errorMessages: Map<string, number>;
  endpoints: Map<string, number>;
  modelHints: Map<string, number>;
}> {
  const rows = await prisma.apiLog.findMany({
    where: { ...KIE_WHERE, createdAt: { gte } },
    select: {
      statusCode: true,
      errorMessage: true,
      endpoint: true,
      requestPayload: true,
    },
  });
  let success = 0;
  let error = 0;
  const errorMessages = new Map<string, number>();
  const endpoints = new Map<string, number>();
  const modelHints = new Map<string, number>();

  for (const r of rows) {
    const rClass = classifyLog(r);
    if (rClass === "success") success += 1;
    else {
      error += 1;
      const em = r.errorMessage?.trim() || "(no message)";
      errorMessages.set(em, (errorMessages.get(em) ?? 0) + 1);
    }
    const ep = r.endpoint?.slice(0, 500) || "(unknown)";
    endpoints.set(ep, (endpoints.get(ep) ?? 0) + 1);

    const body = (() => {
      if (!r.requestPayload || typeof r.requestPayload !== "object") {
        return null;
      }
      const p = r.requestPayload as Record<string, unknown>;
      if (p.body && typeof p.body === "object") {
        return p.body as Record<string, unknown>;
      }
      return p;
    })();
    const model =
      body && typeof body.model === "string"
        ? body.model
        : body &&
            typeof (body as { input?: { model?: unknown } }).input === "object" &&
            typeof (body as { input?: { model?: string } }).input?.model === "string"
          ? (body as { input: { model: string } }).input.model
          : null;
    if (model) {
      modelHints.set(model, (modelHints.get(model) ?? 0) + 1);
    }
  }

  const total = rows.length;
  const successRate = total > 0 ? Math.round((success / total) * 1000) / 10 : 0;
  return {
    w: { total, success, error, successRate },
    errorMessages,
    endpoints,
    modelHints,
  };
}

function topNFromMap(map: Map<string, number>, n: number): { key: string; count: number }[] {
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

export type KieMonitorStats = {
  h24: WindowStats;
  d7: WindowStats;
  topErrorMessages: { message: string; count: number }[];
  topEndpoints: { endpoint: string; count: number }[];
  topRequestModels: { model: string; count: number }[];
};

export async function getKieApiLogMonitorStats(): Promise<KieMonitorStats> {
  const now = Date.now();
  const h24 = new Date(now - 24 * 60 * 60 * 1000);
  const d7 = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const [s24, s7] = await Promise.all([windowStats(h24), windowStats(d7)]);
  return {
    h24: s24.w,
    d7: s7.w,
    topErrorMessages: topNFromMap(s24.errorMessages, 5).map((x) => ({
      message: x.key,
      count: x.count,
    })),
    topEndpoints: topNFromMap(s7.endpoints, 5).map((x) => ({
      endpoint: x.key,
      count: x.count,
    })),
    topRequestModels: topNFromMap(s7.modelHints, 5).map((x) => ({
      model: x.key,
      count: x.count,
    })),
  };
}

export async function getLastKieErrorLogs(limit = 10) {
  const raw = await prisma.apiLog.findMany({
    where: {
      ...KIE_WHERE,
      errorMessage: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(50, limit * 3),
    select: {
      id: true,
      createdAt: true,
      endpoint: true,
      statusCode: true,
      errorMessage: true,
      generationId: true,
    },
  });
  return raw
    .filter((r) => (r.errorMessage?.trim() ?? "") !== "")
    .slice(0, limit);
}

export async function getRecentKieRequestLogs(limit = 10) {
  return prisma.apiLog.findMany({
    where: KIE_WHERE,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      endpoint: true,
      statusCode: true,
      errorMessage: true,
      generationId: true,
    },
  });
}

function extractBalanceFromJson(json: unknown): string | null {
  if (json == null) return null;
  if (typeof json === "number" && Number.isFinite(json)) {
    return String(json);
  }
  if (typeof json === "string" && json.trim() !== "") {
    return json.trim();
  }
  if (typeof json !== "object" || !json) return null;
  const o = json as Record<string, unknown>;
  for (const k of ["credit", "balance", "credits", "remaining"]) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  if (o.data && typeof o.data === "object" && o.data) {
    const d = o.data as Record<string, unknown>;
    for (const k of ["credit", "balance", "credits"]) {
      const v = d[k];
      if (typeof v === "number" && Number.isFinite(v)) return String(v);
      if (typeof v === "string" && v.trim() !== "") return v.trim();
    }
  }
  return null;
}

export type CheckKieConnectionResult =
  | {
      ok: true;
      statusCode: number;
      balance: string | null;
      raw: unknown;
    }
  | {
      ok: false;
      statusCode: number;
      error: string;
      raw: unknown;
    };

/**
 * Р’РЅРµС€РЅРёР№ GET Рє РІ balance endpoint Kie. РљР»СЋС‡Рё РЅРµ Р»РѕРіРёСЂСѓСЋС‚СЃСЏ.
 */
export async function checkKieConnection(): Promise<CheckKieConnectionResult> {
  const key = readKieKeyTrimmed();
  if (key.length === 0) {
    return {
      ok: false,
      statusCode: 0,
      error: "KIE_API_KEY is not set",
      raw: { reason: "no_api_key" },
    };
  }
  const base = readKieBaseUrlForMonitor();
  const url = `${base}${KIE_CREDIT_PATH}`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), KIE_CHECK_FETCH_MS);
  let res: Response;
  let text = "";
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
      signal: ctrl.signal,
    });
    text = await res.text();
  } catch (e) {
    clearTimeout(t);
    const msg =
      e instanceof Error && e.name === "AbortError"
        ? "Request timeout"
        : e instanceof Error
          ? e.message
        : "Network error";
    return {
      ok: false,
      statusCode: 0,
      error: msg,
      raw: { network: true, message: msg },
    };
  } finally {
    clearTimeout(t);
  }
  const http = res.status;
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { parseError: true, textSnippet: text.slice(0, 500) };
  }
  const sanitized = redactKieLogPayload(json);
  if (http < 200 || http >= 300) {
    return {
      ok: false,
      statusCode: http,
      error: `HTTP ${http}`,
      raw: sanitized,
    };
  }
  const balance = extractBalanceFromJson(json);
  return { ok: true, statusCode: http, balance, raw: sanitized };
}

export type KieMonitorStatusPayload = KieProviderConfigStatus & {
  lastCheck: LastCheckInfo;
  lastErrors: Awaited<ReturnType<typeof getLastKieErrorLogs>>;
  recentRequests: Awaited<ReturnType<typeof getRecentKieRequestLogs>>;
  stats: KieMonitorStats;
};

export async function getKieMonitorStatusPayload(): Promise<KieMonitorStatusPayload> {
  const [
    config,
    lastCheck,
    lastErrors,
    recentRequests,
    stats,
  ] = await Promise.all([
    Promise.resolve(getKieProviderConfigStatus()),
    getLastKieProviderCheckFromAudit(),
    getLastKieErrorLogs(10),
    getRecentKieRequestLogs(10),
    getKieApiLogMonitorStats(),
  ]);
  return {
    ...config,
    lastCheck,
    lastErrors,
    recentRequests,
    stats,
  };
}

export async function runKieProviderCheckWithAudit(
  adminUserId: string,
): Promise<{ checkedAt: string; result: CheckKieConnectionResult }> {
  const checkedAt = new Date().toISOString();
  const result = await checkKieConnection();
  const ok = result.ok;
  const statusCode = result.statusCode;
  const balance = result.ok ? result.balance : null;
  const metadata: Record<string, unknown> = {
    ok,
    statusCode,
    checkedAt,
  };
  if (result.ok) {
    metadata.balance = balance;
  } else {
    metadata.error = result.error;
  }
  void writeAdminAuditLog({
    adminUserId,
    action: "KIE_PROVIDER_CHECK_RUN",
    targetType: "Provider",
    targetId: "KIE_AI",
    metadata,
  });
  if (!ok) {
    void trySendAdminProviderErrorEmail({ errorMessage: result.error });
  }
  return { checkedAt, result };
}
