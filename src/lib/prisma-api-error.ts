import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";

const MIGRATION_PRODUCT_CARD =
  "Ошибка базы: примените миграции (npx prisma migrate deploy) для таблицы product_card_projects.";
const STALE_PRISMA_CLIENT =
  "Prisma Client устарел после изменения схемы. Перезапустите dev-сервер или выполните prisma generate.";

/**
 * Всегда возвращает JSON, чтобы клиент (readJsonSafe) не получал пустое тело при 500.
 */
export function prismaErrorToJsonResponse(
  e: unknown,
  fallbackMessage: string,
): NextResponse {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2021" || e.code === "P2022") {
      return NextResponse.json({ error: MIGRATION_PRODUCT_CARD }, { status: 503 });
    }
  }
  if (e instanceof Prisma.PrismaClientInitializationError) {
    return NextResponse.json(
      { error: "Нет соединения с базой. Проверьте DATABASE_URL." },
      { status: 503 },
    );
  }
  const msg = e instanceof Error ? e.message : "";
  if (/does not exist|Unknown table|relation.*does not exist/i.test(msg)) {
    return NextResponse.json({ error: MIGRATION_PRODUCT_CARD }, { status: 503 });
  }
  if (/Cannot read properties of undefined/i.test(msg)) {
    return NextResponse.json({ error: STALE_PRISMA_CLIENT }, { status: 503 });
  }
  console.error("[prisma route]", e);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
