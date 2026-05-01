import "server-only";

import IORedis from "ioredis";

import { getClientIpFromRequest } from "@/lib/client-ip";
import { getRateUploadSettings } from "@/lib/rate-upload-settings";

import { NextResponse } from "next/server";

export type RateLimitDenied = {
  allowed: false;
  message: string;
  retryAfterSec: number;
};

export type RateLimitResult = { allowed: true } | RateLimitDenied;

const RU_MSG = "Слишком много запросов. Подождите и повторите попытку.";

let memBuckets = new Map<string, { count: number; resetAt: number }>();
let memOps = 0;

function memPrune() {
  if (memOps++ % 2000 === 0 && memBuckets.size > 5000) {
    memBuckets = new Map();
  }
}

let redis: IORedis | null = null;
function getRateLimitRedis(): IORedis | null {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  if (!redis) {
    redis = new IORedis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
  }
  return redis;
}

function wallMinute(): number {
  return Math.floor(Date.now() / 60_000);
}

/**
 * Скользящее окно ~1 мин (по идентификатору) — Redis: фикс. минута; память: от первого запроса.
 */
export async function checkRateLimit(
  kind: "login" | "register" | "generation" | "upload" | "admin" | "classify" | "forgot_password" | "reset_password",
  id: string,
  limit: number,
  windowSec = 60,
): Promise<RateLimitResult> {
  const safe = id.slice(0, 256) || "unknown";
  const r = getRateLimitRedis();
  if (r) {
    try {
      const w = wallMinute();
      const key = `rl:v1:${kind}:${encodeURIComponent(safe)}:${w}`;
      const n = await r.incr(key);
      if (n === 1) {
        await r.expire(key, windowSec + 30);
      }
      if (n > limit) {
        return { allowed: false, message: RU_MSG, retryAfterSec: windowSec };
      }
      return { allowed: true };
    } catch {
      // Fall through to memory
    }
  }

  const windowMs = windowSec * 1000;
  const key = `mem:${kind}:${encodeURIComponent(safe)}`;
  memPrune();
  const now = Date.now();
  let b = memBuckets.get(key);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    memBuckets.set(key, b);
  }
  b.count += 1;
  if (b.count > limit) {
    const ra = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
    return { allowed: false, message: RU_MSG, retryAfterSec: ra };
  }
  return { allowed: true };
}

export function rateLimitToResponse(d: RateLimitDenied): NextResponse {
  return NextResponse.json(
    { error: d.message, code: "RATE_LIMIT" as const, retryAfter: d.retryAfterSec },
    {
      status: 429,
      headers: { "Retry-After": String(d.retryAfterSec) },
    },
  );
}

/**
 * Тело ответа для Auth.js /api/auth/callback/credentials: клиентский `signIn(..., { redirect: false })`
 * читает JSON с полем `url` (иначе падает `new URL(data.url)` в next-auth/react).
 */
export function loginRateLimitToNextAuthJsonResponse(
  req: Request,
  d: RateLimitDenied,
): NextResponse {
  const origin = new URL(req.url).origin;
  const url = `${origin}/api/auth/signin?error=RateLimit`;
  return NextResponse.json(
    {
      url,
      error: d.message,
      code: "RATE_LIMIT" as const,
      retryAfter: d.retryAfterSec,
    },
    {
      status: 429,
      headers: { "Retry-After": String(d.retryAfterSec) },
    },
  );
}

export async function enforceLoginRateLimit(req: Request): Promise<NextResponse | null> {
  const settings = await getRateUploadSettings();
  const ip = getClientIpFromRequest(req);
  const res = await checkRateLimit("login", ip, settings.loginPerMinute, 60);
  if (res.allowed) return null;
  return loginRateLimitToNextAuthJsonResponse(req, res);
}

export async function enforceRegistrationRateLimit(
  req: Request,
): Promise<NextResponse | null> {
  const settings = await getRateUploadSettings();
  const ip = getClientIpFromRequest(req);
  const res = await checkRateLimit("register", ip, settings.registrationPerMinute, 60);
  if (res.allowed) return null;
  return rateLimitToResponse(res);
}

/**
 * Сброс пароля: лимит по IP и по email (нормализованному), чтобы снизить злоупотребления.
 */
export async function enforceForgotPasswordRateLimit(
  req: Request,
  emailNormalized: string,
): Promise<NextResponse | null> {
  const settings = await getRateUploadSettings();
  const ip = getClientIpFromRequest(req);
  const ipLimit = Math.max(3, settings.registrationPerMinute);
  const r1 = await checkRateLimit("forgot_password", `ip:${ip}`, ipLimit, 60);
  if (!r1.allowed) return rateLimitToResponse(r1);
  const e = emailNormalized.slice(0, 256).toLowerCase();
  const r2 = await checkRateLimit("forgot_password", `e:${e}`, 5, 60);
  if (!r2.allowed) return rateLimitToResponse(r2);
  return null;
}

export async function enforceResetPasswordRateLimit(
  req: Request,
): Promise<NextResponse | null> {
  const ip = getClientIpFromRequest(req);
  const r = await checkRateLimit("reset_password", `ip:${ip}`, 20, 60);
  if (!r.allowed) return rateLimitToResponse(r);
  return null;
}

export async function enforceGenerationRateLimit(
  userId: string,
): Promise<NextResponse | null> {
  const settings = await getRateUploadSettings();
  const res = await checkRateLimit("generation", userId, settings.generationPerMinute, 60);
  if (res.allowed) return null;
  return rateLimitToResponse(res);
}

export async function enforceUploadRateLimit(
  userId: string,
): Promise<NextResponse | null> {
  const settings = await getRateUploadSettings();
  const res = await checkRateLimit("upload", userId, settings.uploadPerMinute, 60);
  if (res.allowed) return null;
  return rateLimitToResponse(res);
}

/** Классификация карточки товара: ~15/мин на пользователя (независимо от generation). */
export async function enforceProductClassifyRateLimit(
  userId: string,
): Promise<NextResponse | null> {
  const res = await checkRateLimit("classify", userId, 15, 60);
  if (res.allowed) return null;
  return rateLimitToResponse(res);
}

/**
 * Админские server actions: лимит на userId, чтобы снизить риск случайных массовых вызовов.
 */
export async function getAdminRateLimitError(adminUserId: string): Promise<string | null> {
  const settings = await getRateUploadSettings();
  const res = await checkRateLimit("admin", adminUserId, settings.adminPerMinute, 60);
  if (res.allowed) return null;
  return RU_MSG;
}
