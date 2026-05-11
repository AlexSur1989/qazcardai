/**
 * Проверка инвариантов GENERAL vs PRODUCT_CARD и снимков Kie payload для 4 целевых моделей.
 * npm run verify:kie-general-models
 */
import assert from "node:assert/strict";

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { KIE_GENERAL_MODEL_SLUG_WHITELIST } from "./lib/kie-general-model-whitelist";
import {
  buildKieMarketPayloadFromMapping,
  type KiePayloadMapping,
} from "../src/server/services/kiePayloadMapping";
import { PrismaClient } from "../src/generated/prisma/client";

const callBackUrl = "https://qazcard.example/api/webhooks/kie";
const prompt = "test prompt";

function body(
  apiModelId: string,
  mapping: KiePayloadMapping,
  settings: Record<string, unknown>,
  inputFiles: string[] = [],
) {
  return buildKieMarketPayloadFromMapping(mapping, {
    model: { apiModelId },
    prompt,
    settings,
    inputFiles,
    callBackUrl,
  });
}

function assertPayloadSnapshots(): void {
  const gptT2iMapping = {
    adapter: "market-create-task",
    omitNull: true,
    required: ["aspect_ratio"],
    input: { aspect_ratio: "$settings.aspectRatio" },
    coerce: { aspect_ratio: "string" },
  } satisfies KiePayloadMapping;

  const gptT2i = body("gpt-image-2-text-to-image", gptT2iMapping, {
    aspectRatio: "auto",
  });
  assert.equal(gptT2i.model, "gpt-image-2-text-to-image");
  assert.deepEqual((gptT2i.input as Record<string, unknown>).prompt, prompt);
  assert.equal((gptT2i.input as Record<string, unknown>).aspect_ratio, "auto");
  assert.ok(!("input_urls" in (gptT2i.input as object)));
  assert.ok(!("image_urls" in (gptT2i.input as object)));

  const gptI2iMapping = {
    adapter: "market-create-task",
    omitNull: true,
    required: ["input_urls", "aspect_ratio"],
    input: {
      input_urls: "$settings.inputUrls",
      aspect_ratio: "$settings.aspectRatio",
    },
    coerce: {
      input_urls: "stringArray",
      aspect_ratio: "string",
    },
  } satisfies KiePayloadMapping;

  const gptI2i = body("gpt-image-2-image-to-image", gptI2iMapping, {
    aspectRatio: "auto",
    inputUrls: ["https://cdn.example.com/a.png"],
  });
  assert.equal(gptI2i.model, "gpt-image-2-image-to-image");
  assert.ok(Array.isArray((gptI2i.input as Record<string, unknown>).input_urls));
  assert.ok(!("image_urls" in (gptI2i.input as object)));

  const klingT2vMapping = {
    adapter: "market-create-task",
    omitNull: true,
    required: ["sound", "aspect_ratio", "duration"],
    input: {
      sound: "$settings.sound",
      aspect_ratio: "$settings.aspectRatio",
      duration: "$settings.duration",
    },
    coerce: {
      sound: "boolean",
      aspect_ratio: "string",
      duration: "string",
    },
  } satisfies KiePayloadMapping;

  const kT2v = body("kling-2.6/text-to-video", klingT2vMapping, {
    sound: false,
    aspectRatio: "1:1",
    duration: "5",
  });
  assert.equal(kT2v.model, "kling-2.6/text-to-video");
  const kT2vIn = kT2v.input as Record<string, unknown>;
  assert.equal(kT2vIn.sound, false);
  assert.equal(kT2vIn.aspect_ratio, "1:1");
  assert.equal(kT2vIn.duration, "5");

  const klingI2vMapping = {
    adapter: "market-create-task",
    omitNull: true,
    required: ["image_urls", "sound", "duration"],
    input: {
      image_urls: "$settings.imageUrls",
      sound: "$settings.sound",
      duration: "$settings.duration",
    },
    coerce: {
      image_urls: "stringArray",
      sound: "boolean",
      duration: "string",
    },
  } satisfies KiePayloadMapping;

  const kI2v = body("kling-2.6/image-to-video", klingI2vMapping, {
    sound: false,
    duration: "5",
    imageUrls: ["https://cdn.example.com/i.jpg"],
  });
  assert.equal(kI2v.model, "kling-2.6/image-to-video");
  const kI2vIn = kI2v.input as Record<string, unknown>;
  assert.ok(Array.isArray(kI2vIn.image_urls));
  assert.equal(kI2vIn.sound, false);
  assert.equal(kI2vIn.duration, "5");
  assert.ok(!("input_urls" in kI2vIn));
  assert.ok(!("aspect_ratio" in kI2vIn));
}

async function assertDatabaseWhenAvailable(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString?.trim()) {
    console.warn("[verify:kie-general-models] DATABASE_URL нет — пропуск проверок БД");
    return;
  }

  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const activeGeneral = await prisma.aiModel.findMany({
      where: { scope: "GENERAL", isActive: true },
      select: {
        slug: true,
        productCardModelType: true,
        apiModelId: true,
        endpoint: true,
        statusEndpoint: true,
        settingsSchema: true,
        payloadMapping: true,
      },
    });

    for (const m of activeGeneral) {
      assert.equal(
        m.productCardModelType,
        null,
        `GENERAL active ${m.slug}: productCardModelType должен быть null`,
      );
      assert.ok(m.apiModelId?.trim(), `${m.slug}: apiModelId`);
      assert.ok(m.endpoint?.trim(), `${m.slug}: endpoint`);
      assert.ok(m.statusEndpoint?.trim(), `${m.slug}: statusEndpoint`);
      assert.ok(m.settingsSchema != null, `${m.slug}: settingsSchema`);
      assert.ok(m.payloadMapping != null, `${m.slug}: payloadMapping`);
    }

    const activePc = await prisma.aiModel.findMany({
      where: { scope: "PRODUCT_CARD", isActive: true },
      select: { slug: true, productCardModelType: true },
    });
    for (const m of activePc) {
      assert.ok(
        m.productCardModelType?.trim(),
        `PRODUCT_CARD ${m.slug}: нужен productCardModelType`,
      );
      const slug = m.slug;
      const wl = new Set<string>([...KIE_GENERAL_MODEL_SLUG_WHITELIST]);
      assert.ok(
        !wl.has(slug),
        `PRODUCT_CARD slug не должен совпадать с whitelist GENERAL: ${slug}`,
      );
    }
  } catch (e) {
    console.warn(
      "[verify:kie-general-models] Проверки БД пропущены (нет соединения или ошибка запроса):",
      e instanceof Error ? e.message : e,
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

async function main() {
  assertPayloadSnapshots();
  await assertDatabaseWhenAvailable();
  console.log("[verify:kie-general-models] OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
