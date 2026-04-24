import { NextResponse } from "next/server";
import IORedis from "ioredis";

import { appPackageName, appPackageVersion } from "@/lib/app-meta";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DbStatus = "ok" | "error";
type RedisStatus = "ok" | "error" | "not_configured";
type AppStatus = "ok" | "degraded" | "error";

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
  const c = new IORedis(url, {
    connectTimeout: 2_000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  try {
    const pong = await c.ping();
    return pong === "PONG" ? "ok" : "error";
  } catch {
    return "error";
  } finally {
    c.disconnect();
  }
}

/**
 * Liveness/Readiness: без утечки секретов, только агрегированные состояния.
 */
export async function GET() {
  const timestamp = new Date().toISOString();

  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);

  let status: AppStatus;
  if (database === "error") {
    status = "error";
  } else if (redis === "error") {
    status = "degraded";
  } else {
    status = "ok";
  }

  const body = {
    status,
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
