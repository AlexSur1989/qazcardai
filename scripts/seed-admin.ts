/**
 * Создаёт/обновляет супер-админа. Только для локальной разработки.
 *
 * Учётка по умолчанию (если в .env не задано):
 *   email:    admin@local.test
 *   password: admin1234
 *
 * Задать свои: в .env → SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD
 *
 * Запуск: npm run db:seed:admin
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { PrismaClient } from "../src/generated/prisma/client";

const ROUNDS = 12;

const EMAIL =
  process.env.SUPER_ADMIN_EMAIL?.trim() || "admin@local.test";
const PASSWORD =
  process.env.SUPER_ADMIN_PASSWORD || "admin1234";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("В .env нужен DATABASE_URL");
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  if (PASSWORD.length < 8) {
    console.warn(
      "[seed-admin] Пароль короче 8 символов — для dev ок; в проде не используйте.",
    );
  }
  const passwordHash = await bcrypt.hash(PASSWORD, ROUNDS);
  const user = await prisma.user.upsert({
    where: { email: EMAIL.toLowerCase() },
    create: {
      email: EMAIL.toLowerCase(),
      passwordHash,
      name: "Админ",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      balanceCredits: 0,
      emailVerified: true,
    },
    update: {
      passwordHash,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
  });
  console.log("Готово. Войдите в кабинет с этими данными:\n");
  console.log("  URL:      /auth/login");
  console.log("  Email:   ", user.email);
  console.log("  Пароль:  ", PASSWORD);
  console.log("  Роль:    ", user.role);
  console.log("\nДальше: /admin (или ссылка «Админ» в шапке).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
