import { NextResponse } from "next/server";

import { appPackageName, appPackageVersion } from "@/lib/app-meta";
import { prisma } from "@/lib/prisma";
import { getQueueMode } from "@/server/queue-mode";
import { pingRedisUrl } from "@/server/queues/redisConnection";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DbStatus = "ok" | "error";
type RedisStatus = "ok" | "error" | "not_configured" | "skipped";
type AppStatus = "ok" | "degraded" | "error";
type QueueModeHealth = "redis" | "inline";

async function checkDatabase(): Promise<DbStatus> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "ok";
  } catch {
    return "error";
  }
}

async function checkRedis(): Promise<RedisStatus> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    return "not_configured";
  }
  const ok = await pingRedisUrl(url);
  return ok ? "ok" : "error";
}

/**
 * Liveness/Readiness: без утечки секретов, только агрегированные состояния.
 */
export async function GET() {
  const timestamp = new Date().toISOString();
  const queueMode: QueueModeHealth = getQueueMode();

  const database = await checkDatabase();
  const redis: RedisStatus =
    queueMode === "inline" ? "skipped" : await checkRedis();

  let status: AppStatus;
  if (database === "error") {
    status = "error";
  } else if (queueMode === "inline") {
    status = "ok";
  } else if (redis === "ok") {
    status = "ok";
  } else {
    status = "degraded";
  }

  const body = {
    status,
    queueMode,
    database,
    redis,
    timestamp,
    app: {
      name: appPackageName,
      version: appPackageVersion,
      node: process.version,
    },
    build: {
      id:
        process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
        process.env.BUILD_ID?.slice(0, 7) ??
        null,
    },
  } as const;

  const code = status === "ok" ? 200 : 503;
  return NextResponse.json(body, { status: code });
}
