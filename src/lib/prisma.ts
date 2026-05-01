import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and configure PostgreSQL.",
    );
  }

  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({ adapter });
}

/**
 * После `prisma generate` с новыми моделями dev-сервер может оставить в global
 * старый PrismaClient без новых delegate — тогда сыпется
 * "Cannot read properties of undefined (reading 'findFirst' / 'findMany')".
 * Сбрасываем синглтон (см. также tokenPackage, userTokenPackage, productCardProject).
 */
const REQUIRED_PRISMA_DELEGATES = [
  "tokenPackage",
  "userTokenPackage",
  "productCardProject",
  "legalPage",
  "emailTemplate",
  "adminEmailThrottle",
  "passwordResetToken",
] as const;

if (process.env.NODE_ENV === "development" && globalForPrisma.prisma) {
  const c = globalForPrisma.prisma as unknown as Record<string, unknown>;
  const stale = REQUIRED_PRISMA_DELEGATES.some((k) => typeof c[k] === "undefined");
  if (stale) {
    void globalForPrisma.prisma.$disconnect().catch(() => undefined);
    globalForPrisma.prisma = undefined;
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
