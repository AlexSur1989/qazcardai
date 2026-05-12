import { prisma } from "@/lib/prisma";

export type AuthEventInput = {
  action: string;
  provider: string;
  userId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/**
 * Журнал событий входа (без токенов и секретов в metadata).
 */
export async function logAuthEventSafe(input: AuthEventInput): Promise<void> {
  try {
    await prisma.authEventLog.create({
      data: {
        userId: input.userId ?? undefined,
        action: input.action.slice(0, 128),
        provider: input.provider.slice(0, 32),
        ipAddress: input.ipAddress?.slice(0, 128),
        userAgent: input.userAgent?.slice(0, 512),
        metadata:
          input.metadata === undefined
            ? undefined
            : (sanitizeAuthMetadata(input.metadata) as object),
      },
    });
  } catch {
    /* best-effort */
  }
}

function sanitizeAuthMetadata(m: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(m)) {
    if (/token|secret|password|authorization|bearer/i.test(k)) continue;
    if (typeof v === "string") out[k] = v.slice(0, 500);
    else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (v === null) out[k] = null;
  }
  return out;
}
