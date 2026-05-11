/**
 * Проверка инвариантов GENERAL phase1 Kie и снимков payload.
 * npm run verify:kie-general-models
 *
 * Без БД локально или при DATABASE_URL на недоступный host: VERIFY_KIE_GENERAL_MODELS_SKIP_DB=1 (только снимки payload).
 */
import assert from "node:assert/strict";

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { KIE_GENERAL_MODEL_SLUG_WHITELIST } from "./lib/kie-general-model-whitelist";
import type { GeneralPhase1Slug } from "../src/server/kie/general-phase1-models";
import {
  GENERAL_PHASE1_MODELS,
  KIE_METADATA_SOURCE_LINE,
} from "../src/server/kie/general-phase1-models";
import {
  HAPPYHORSE_MODELS,
  type HappyHorseSlug,
} from "../src/server/kie/kie-happyhorse-models";
import {
  KIE_GENERAL_MODEL_DEFINITIONS,
  type KieModelDefinition,
} from "../src/server/kie/kie-general-model-definitions";
import { ADDITIONAL_KIE_GENERAL_SLUG_ORDER } from "../src/server/kie/kie-additional-general-models";
import {
  WAN_27_VIDEO_MODELS,
  type Wan27VideoSlug,
} from "../src/server/kie/kie-wan-27-video-models";
import {
  buildKieMarketPayloadFromMapping,
  type KiePayloadMapping,
} from "../src/server/services/kiePayloadMapping";
import { isAiModelVisibleInUserCatalog } from "../src/lib/ai-model-public-catalog";
import { validateStrictKieMarketPayload } from "../src/server/services/kieModelPayloadValidation";
import { PrismaClient } from "../src/generated/prisma/client";

const callBackUrl = "https://qazcard.example/api/webhooks/kie";
const promptFixture = "test prompt";

const REQUIRED_MODEL_SLUGS = [
  ...KIE_GENERAL_MODEL_DEFINITIONS.map((m) => m.slug),
] as const;

function assertRequiredRegistryCoverage(): void {
  const slugs = new Set(KIE_GENERAL_MODEL_DEFINITIONS.map((m) => m.slug));
  assert.ok(
    KIE_GENERAL_MODEL_DEFINITIONS.length >= 30,
    `Ожидалось много concrete Kie modes, получено ${KIE_GENERAL_MODEL_DEFINITIONS.length}`,
  );
  for (const slug of REQUIRED_MODEL_SLUGS) {
    assert.ok(slugs.has(slug), `Отсутствует обязательный AiModel slug: ${slug}`);
  }
  for (const slug of ADDITIONAL_KIE_GENERAL_SLUG_ORDER) {
    assert.ok(slugs.has(slug), `Отсутствует additional Kie slug: ${slug}`);
  }
  const families = new Set(KIE_GENERAL_MODEL_DEFINITIONS.map((m) => m.familySlug));
  for (const family of [
    "wan-2-7",
    "seedance-2",
    "seedance-2-fast",
    "nano-banana-2",
    "nano-banana-pro",
    "seedream-5-lite",
    "seedream-4-5",
    "flux-2",
    "grok-imagine",
    "qwen",
    "qwen2",
    "ideogram-v3",
  ]) {
    assert.ok(families.has(family), `Family не представлена в registry: ${family}`);
  }
  for (const def of KIE_GENERAL_MODEL_DEFINITIONS) {
    if (def.metadata.publicReady !== true) {
      assert.equal(
        isAiModelVisibleInUserCatalog({
          slug: def.slug,
          isActive: true,
          isPublic: def.isPublic,
          metadata: def.metadata,
        }),
        false,
        `${def.slug}: publicReady=false модель не должна быть видна в dashboard`,
      );
    }
  }
}

function assertAllRegistryPayloadsBuild(): void {
  for (const def of KIE_GENERAL_MODEL_DEFINITIONS) {
    const body = bodyFromDefinition(
      def.apiModelId,
      def.payloadMapping,
      settingsForSlug(def.slug, def),
      promptFixture,
    );
    assert.equal(body.model, def.apiModelId, `${def.slug}: model`);
    assert.equal(body.callBackUrl, callBackUrl, `${def.slug}: callBackUrl`);
    assert.ok(
      typeof (body.input as { prompt?: unknown }).prompt === "string",
      `${def.slug}: input.prompt`,
    );
  }
}

function bodyFromDefinition(
  apiModelId: string,
  mapping: KiePayloadMapping,
  settings: Record<string, unknown>,
  prompt: string,
) {
  return buildKieMarketPayloadFromMapping(mapping, {
    model: { apiModelId },
    prompt,
    settings,
    inputFiles: [],
    callBackUrl,
  });
}

function assertPayloadSnapshots(): void {
  const gptT2i = GENERAL_PHASE1_MODELS.find(
    (m) => m.slug === "gpt-image-2-text-to-image",
  )!;
  const b1 = bodyFromDefinition(gptT2i.apiModelId, gptT2i.payloadMapping, {
    aspectRatio: "auto",
    resolution: "1K",
  }, promptFixture);
  assert.deepStrictEqual(b1.input, {
    prompt: promptFixture,
    aspect_ratio: "auto",
    resolution: "1K",
  });
  assert.ok(!("input_urls" in (b1.input as object)));
  assert.ok(!("image_urls" in (b1.input as object)));

  const gptI2i = GENERAL_PHASE1_MODELS.find(
    (m) => m.slug === "gpt-image-2-image-to-image",
  )!;
  const b2 = bodyFromDefinition(gptI2i.apiModelId, gptI2i.payloadMapping, {
    aspectRatio: "auto",
    resolution: "1K",
    inputUrls: ["https://example.com/a.png"],
  }, promptFixture);
  assert.deepStrictEqual(b2.input, {
    prompt: promptFixture,
    input_urls: ["https://example.com/a.png"],
    aspect_ratio: "auto",
    resolution: "1K",
  });
  assert.ok(!("image_urls" in (b2.input as object)));

  const k26T2v = GENERAL_PHASE1_MODELS.find(
    (m) => m.slug === "kling-2-6-text-to-video",
  )!;
  const kT2 = bodyFromDefinition(k26T2v.apiModelId, k26T2v.payloadMapping, {
    sound: false,
    aspectRatio: "1:1",
    duration: "5",
  }, promptFixture);
  assert.deepStrictEqual(kT2.input, {
    prompt: promptFixture,
    sound: false,
    aspect_ratio: "1:1",
    duration: "5",
  });

  const k26I2v = GENERAL_PHASE1_MODELS.find(
    (m) => m.slug === "kling-2-6-image-to-video",
  )!;
  const kI = bodyFromDefinition(k26I2v.apiModelId, k26I2v.payloadMapping, {
    sound: false,
    duration: "5",
    imageUrls: ["https://example.com/a.png"],
  }, promptFixture);
  assert.deepStrictEqual(kI.input, {
    prompt: promptFixture,
    image_urls: ["https://example.com/a.png"],
    sound: false,
    duration: "5",
  });

  const hhT2v = HAPPYHORSE_MODELS.find(
    (m) => m.slug === "happyhorse-1-0-text-to-video",
  )!;
  const h1 = bodyFromDefinition(
    hhT2v.apiModelId,
    hhT2v.payloadMapping,
    {
      resolution: "1080p",
      aspectRatio: "16:9",
      duration: 5,
      seed: 123,
    },
    promptFixture,
  );
  assert.deepStrictEqual(h1.input, {
    prompt: promptFixture,
    resolution: "1080p",
    aspect_ratio: "16:9",
    duration: 5,
    seed: 123,
  });
  assert.ok(!("image_urls" in (h1.input as object)));
  assert.ok(!("video_url" in (h1.input as object)));

  const hhI2v = HAPPYHORSE_MODELS.find(
    (m) => m.slug === "happyhorse-1-0-image-to-video",
  )!;
  const h2 = bodyFromDefinition(
    hhI2v.apiModelId,
    hhI2v.payloadMapping,
    {
      imageUrls: ["https://example.com/a.png"],
      resolution: "1080p",
      duration: 5,
      seed: 123,
    },
    promptFixture,
  );
  assert.deepStrictEqual(h2.input, {
    prompt: promptFixture,
    image_urls: ["https://example.com/a.png"],
    resolution: "1080p",
    duration: 5,
    seed: 123,
  });
  assert.ok(!("input_urls" in (h2.input as object)));
  assert.ok(!("aspect_ratio" in (h2.input as object)));
  assert.ok(!("video_url" in (h2.input as object)));

  const hhRtv = HAPPYHORSE_MODELS.find(
    (m) => m.slug === "happyhorse-1-0-reference-to-video",
  )!;
  const h3 = bodyFromDefinition(
    hhRtv.apiModelId,
    hhRtv.payloadMapping,
    {
      referenceImage: ["https://example.com/a.png"],
      resolution: "1080p",
      aspectRatio: "16:9",
      duration: 5,
      seed: 123,
    },
    promptFixture,
  );
  assert.deepStrictEqual(h3.input, {
    prompt: promptFixture,
    reference_image: ["https://example.com/a.png"],
    resolution: "1080p",
    aspect_ratio: "16:9",
    duration: 5,
    seed: 123,
  });
  assert.ok(!("image_urls" in (h3.input as object)));
  assert.ok(!("input_urls" in (h3.input as object)));

  const hhVe = HAPPYHORSE_MODELS.find(
    (m) => m.slug === "happyhorse-1-0-video-edit",
  )!;
  const h4 = bodyFromDefinition(
    hhVe.apiModelId,
    hhVe.payloadMapping,
    {
      videoUrl: ["https://example.com/a.mp4"],
      referenceImage: ["https://example.com/a.png"],
      resolution: "1080p",
      audioSetting: "auto",
      seed: 123,
    },
    promptFixture,
  );
  assert.deepStrictEqual(h4.input, {
    prompt: promptFixture,
    video_url: "https://example.com/a.mp4",
    reference_image: ["https://example.com/a.png"],
    resolution: "1080p",
    audio_setting: "auto",
    seed: 123,
  });
  assert.strictEqual(typeof (h4.input as { video_url: unknown }).video_url, "string");
  assert.ok(Array.isArray((h4.input as { reference_image: unknown }).reference_image));
  assert.ok(!("input_urls" in (h4.input as object)));
  assert.ok(!("image_urls" in (h4.input as object)));

  const wanT2v = WAN_27_VIDEO_MODELS.find(
    (m) => m.slug === "wan-2-7-text-to-video",
  )!;
  const w1 = bodyFromDefinition(
    wanT2v.apiModelId,
    wanT2v.payloadMapping,
    {
      negativePrompt: "blurry",
      audioUrl: ["https://example.com/a.mp3"],
      resolution: "1080p",
      ratio: "16:9",
      duration: 5,
      promptExtend: true,
      watermark: false,
      seed: 123,
      nsfwChecker: true,
    },
    promptFixture,
  );
  assert.deepStrictEqual(w1.input, {
    prompt: promptFixture,
    negative_prompt: "blurry",
    audio_url: "https://example.com/a.mp3",
    resolution: "1080p",
    ratio: "16:9",
    duration: 5,
    prompt_extend: true,
    watermark: false,
    seed: 123,
    nsfw_checker: true,
  });

  const wanI2v = WAN_27_VIDEO_MODELS.find(
    (m) => m.slug === "wan-2-7-image-to-video",
  )!;
  const w2 = bodyFromDefinition(
    wanI2v.apiModelId,
    wanI2v.payloadMapping,
    {
      negativePrompt: "blurry",
      firstFrameUrl: ["https://example.com/first.png"],
      lastFrameUrl: ["https://example.com/last.png"],
      drivingAudioUrl: ["https://example.com/drive.mp3"],
      resolution: "1080p",
      duration: 5,
      promptExtend: true,
      watermark: false,
      seed: 123,
      nsfwChecker: true,
    },
    promptFixture,
  );
  assert.deepStrictEqual(w2.input, {
    prompt: promptFixture,
    negative_prompt: "blurry",
    first_frame_url: "https://example.com/first.png",
    last_frame_url: "https://example.com/last.png",
    driving_audio_url: "https://example.com/drive.mp3",
    resolution: "1080p",
    duration: 5,
    prompt_extend: true,
    watermark: false,
    seed: 123,
    nsfw_checker: true,
  });
  assert.ok(!("input_urls" in (w2.input as object)));
  assert.ok(!("image_urls" in (w2.input as object)));

  const wanR2v = WAN_27_VIDEO_MODELS.find(
    (m) => m.slug === "wan-2-7-r2v",
  )!;
  const w3 = bodyFromDefinition(
    wanR2v.apiModelId,
    wanR2v.payloadMapping,
    {
      negativePrompt: "blurry",
      referenceImage: ["https://example.com/ref.png"],
      referenceVideo: ["https://example.com/ref.mp4"],
      firstFrame: ["https://example.com/first.png"],
      referenceVoice: ["https://example.com/voice.mp3"],
      resolution: "1080p",
      aspectRatio: "16:9",
      duration: 5,
      promptExtend: true,
      watermark: false,
      seed: 123,
      nsfwChecker: true,
    },
    promptFixture,
  );
  assert.deepStrictEqual(w3.input, {
    prompt: promptFixture,
    negative_prompt: "blurry",
    reference_image: ["https://example.com/ref.png"],
    reference_video: ["https://example.com/ref.mp4"],
    first_frame: "https://example.com/first.png",
    reference_voice: "https://example.com/voice.mp3",
    resolution: "1080p",
    aspect_ratio: "16:9",
    duration: 5,
    prompt_extend: true,
    watermark: false,
    seed: 123,
    nsfw_checker: true,
  });
  assert.ok(!("input_urls" in (w3.input as object)));
  assert.ok(!("image_urls" in (w3.input as object)));

  const wanEdit = WAN_27_VIDEO_MODELS.find(
    (m) => m.slug === "wan-2-7-videoedit",
  )!;
  const w4 = bodyFromDefinition(
    wanEdit.apiModelId,
    wanEdit.payloadMapping,
    {
      videoUrl: ["https://example.com/source.mp4"],
      referenceImage: ["https://example.com/ref.png"],
      negativePrompt: "blurry",
      resolution: "1080p",
      duration: 0,
      aspectRatio: "16:9",
      audioSetting: "auto",
      promptExtend: true,
      watermark: false,
      seed: 123,
      nsfwChecker: true,
    },
    promptFixture,
  );
  assert.deepStrictEqual(w4.input, {
    prompt: promptFixture,
    video_url: "https://example.com/source.mp4",
    reference_image: "https://example.com/ref.png",
    negative_prompt: "blurry",
    resolution: "1080p",
    duration: 0,
    aspect_ratio: "16:9",
    audio_setting: "auto",
    prompt_extend: true,
    watermark: false,
    seed: 123,
    nsfw_checker: true,
  });
  assert.strictEqual(typeof (w4.input as { video_url: unknown }).video_url, "string");
  assert.strictEqual(
    typeof (w4.input as { reference_image: unknown }).reference_image,
    "string",
  );
  assert.ok(!("input_urls" in (w4.input as object)));
  assert.ok(!("image_urls" in (w4.input as object)));

  const fluxT2i = KIE_GENERAL_MODEL_DEFINITIONS.find(
    (m) => m.slug === "flux-2-flex-text-to-image",
  )!;
  const f1 = bodyFromDefinition(
    fluxT2i.apiModelId,
    fluxT2i.payloadMapping,
    {
      aspectRatio: "16:9",
      resolution: "2K",
      nsfwChecker: true,
    },
    promptFixture,
  );
  assert.deepStrictEqual(f1.input, {
    prompt: promptFixture,
    aspect_ratio: "16:9",
    resolution: "2K",
    nsfw_checker: true,
  });
  assert.ok(!("input_urls" in (f1.input as object)));
  assert.ok(!("image_urls" in (f1.input as object)));

  const fluxI2i = KIE_GENERAL_MODEL_DEFINITIONS.find(
    (m) => m.slug === "flux-2-flex-image-to-image",
  )!;
  const f2 = bodyFromDefinition(
    fluxI2i.apiModelId,
    fluxI2i.payloadMapping,
    {
      inputUrls: ["https://example.com/a.png", "https://example.com/b.png"],
      aspectRatio: "auto",
      resolution: "1K",
      nsfwChecker: false,
    },
    promptFixture,
  );
  assert.deepStrictEqual(f2.input, {
    prompt: promptFixture,
    input_urls: ["https://example.com/a.png", "https://example.com/b.png"],
    aspect_ratio: "auto",
    resolution: "1K",
    nsfw_checker: false,
  });
  assert.ok(!("image_urls" in (f2.input as object)));
}

function phase1ModelForValidation(slug: GeneralPhase1Slug) {
  const d = GENERAL_PHASE1_MODELS.find((m) => m.slug === slug)!;
  return { apiModelId: d.apiModelId, payloadMapping: d.payloadMapping };
}

/** Правила GPT Image 2 + resolution до reserveCredits (AGENTS.md). */
function assertGptResolutionValidationMatrix(): void {
  const t2i = phase1ModelForValidation("gpt-image-2-text-to-image");
  const i2iBase = {
    inputUrls: ["https://example.com/a.png"],
  } as const;

  assert.equal(
    validateStrictKieMarketPayload(t2i, promptFixture, {
      aspectRatio: "auto",
      resolution: "1K",
    }).ok,
    true,
  );
  assert.equal(
    validateStrictKieMarketPayload(t2i, promptFixture, {
      aspectRatio: "auto",
      resolution: "2K",
    }).ok,
    false,
  );
  assert.equal(
    validateStrictKieMarketPayload(t2i, promptFixture, {
      aspectRatio: "auto",
      resolution: "4K",
    }).ok,
    false,
  );
  assert.equal(
    validateStrictKieMarketPayload(t2i, promptFixture, {
      aspectRatio: "1:1",
      resolution: "4K",
    }).ok,
    false,
  );
  assert.equal(
    validateStrictKieMarketPayload(t2i, promptFixture, {
      aspectRatio: "16:9",
      resolution: "4K",
    }).ok,
    true,
  );
  assert.equal(
    validateStrictKieMarketPayload(t2i, promptFixture, {
      resolution: "1K",
    }).ok,
    true,
    "без aspect_ratio только 1K",
  );
  assert.equal(
    validateStrictKieMarketPayload(t2i, promptFixture, {
      resolution: "2K",
    }).ok,
    false,
  );

  const i2i = phase1ModelForValidation("gpt-image-2-image-to-image");
  assert.equal(
    validateStrictKieMarketPayload(i2i, promptFixture, {
      ...i2iBase,
      aspectRatio: "auto",
      resolution: "1K",
    }).ok,
    true,
  );
  assert.equal(
    validateStrictKieMarketPayload(i2i, promptFixture, {
      ...i2iBase,
      aspectRatio: "auto",
      resolution: "2K",
    }).ok,
    false,
  );
}

const SETTINGS_FOR_DB_BUILD: Record<
  string,
  Record<string, unknown>
> = {
  "gpt-image-2-text-to-image": { aspectRatio: "auto", resolution: "1K" },
  "gpt-image-2-image-to-image": {
    aspectRatio: "auto",
    resolution: "1K",
    inputUrls: ["https://example.com/a.png"],
  },
  "kling-2-6-text-to-video": {
    sound: false,
    aspectRatio: "1:1",
    duration: "5",
  },
  "kling-2-6-image-to-video": {
    sound: false,
    duration: "5",
    imageUrls: ["https://example.com/a.png"],
  },
  "happyhorse-1-0-text-to-video": {
    resolution: "1080p",
    aspectRatio: "16:9",
    duration: 5,
    seed: 123,
  },
  "happyhorse-1-0-image-to-video": {
    imageUrls: ["https://example.com/a.png"],
    resolution: "1080p",
    duration: 5,
    seed: 123,
  },
  "happyhorse-1-0-reference-to-video": {
    referenceImage: ["https://example.com/a.png"],
    resolution: "1080p",
    aspectRatio: "16:9",
    duration: 5,
    seed: 123,
  },
  "happyhorse-1-0-video-edit": {
    videoUrl: ["https://example.com/a.mp4"],
    referenceImage: ["https://example.com/a.png"],
    resolution: "1080p",
    audioSetting: "auto",
    seed: 123,
  },
  "wan-2-7-text-to-video": {
    negativePrompt: "blurry",
    audioUrl: ["https://example.com/a.mp3"],
    resolution: "1080p",
    ratio: "16:9",
    duration: 5,
    promptExtend: true,
    watermark: false,
    seed: 123,
    nsfwChecker: true,
  },
  "wan-2-7-image-to-video": {
    negativePrompt: "blurry",
    firstFrameUrl: ["https://example.com/first.png"],
    lastFrameUrl: ["https://example.com/last.png"],
    drivingAudioUrl: ["https://example.com/drive.mp3"],
    resolution: "1080p",
    duration: 5,
    promptExtend: true,
    watermark: false,
    seed: 123,
    nsfwChecker: true,
  },
  "wan-2-7-r2v": {
    negativePrompt: "blurry",
    referenceImage: ["https://example.com/ref.png"],
    referenceVideo: ["https://example.com/ref.mp4"],
    firstFrame: ["https://example.com/first.png"],
    referenceVoice: ["https://example.com/voice.mp3"],
    resolution: "1080p",
    aspectRatio: "16:9",
    duration: 5,
    promptExtend: true,
    watermark: false,
    seed: 123,
    nsfwChecker: true,
  },
  "wan-2-7-videoedit": {
    videoUrl: ["https://example.com/source.mp4"],
    referenceImage: ["https://example.com/ref.png"],
    negativePrompt: "blurry",
    resolution: "1080p",
    duration: 0,
    aspectRatio: "16:9",
    audioSetting: "auto",
    promptExtend: true,
    watermark: false,
    seed: 123,
    nsfwChecker: true,
  },
};

function fixtureValueForField(field: Record<string, unknown>): unknown {
  const name = String(field.name ?? "");
  const type = String(field.type ?? "");
  if (field.defaultValue !== undefined) return field.defaultValue;
  if (field.default !== undefined) return field.default;
  if (type.includes("upload-list")) {
    if (type.includes("video")) return ["https://example.com/input.mp4"];
    if (type.includes("audio")) return ["https://example.com/input.mp3"];
    return ["https://example.com/input.png"];
  }
  if (type === "boolean") return false;
  if (type === "number") return name === "duration" ? 5 : 1;
  if (Array.isArray(field.options) && field.options.length > 0) {
    const first = field.options[0] as unknown;
    if (typeof first === "object" && first !== null && "value" in first) {
      return (first as { value: unknown }).value;
    }
    return first;
  }
  if (name.toLowerCase().includes("prompt")) return "negative";
  return "fixture";
}

function settingsForSlug(slug: string, def: KieModelDefinition): Record<string, unknown> {
  const explicit = SETTINGS_FOR_DB_BUILD[slug];
  if (explicit) return explicit;
  const fields = (def.settingsSchema as { fields?: unknown[] }).fields ?? [];
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (typeof field === "object" && field !== null && "name" in field) {
      const f = field as Record<string, unknown>;
      out[String(f.name)] = fixtureValueForField(f);
    }
  }
  return out;
}

const ALL_STRICT_GENERAL_MODELS_FOR_DB_VERIFY = [
  ...KIE_GENERAL_MODEL_DEFINITIONS,
] satisfies readonly KieModelDefinition[];

function assertHappyHorseVideoEditDbGate(
  meta: Record<string, unknown>,
  dbBuiltInput: Record<string, unknown>,
): void {
  assert.strictEqual(typeof dbBuiltInput.video_url, "string");
  assert.ok(Array.isArray(dbBuiltInput.reference_image));
  assert.ok(!("input_urls" in dbBuiltInput));
  assert.ok(!("image_urls" in dbBuiltInput));

  if (meta.publicReady === true) {
    return;
  }

  assert.strictEqual(
    meta.publicReady,
    false,
    "happyhorse-1-0-video-edit: до ручной проверки Kie publicReady должен быть false",
  );
  assert.strictEqual(
    meta.requiresManualKieTest,
    true,
    "happyhorse-1-0-video-edit: пока нужен флаг requiresManualKieTest",
  );
  assert.ok(
    typeof meta.reason === "string" && meta.reason.trim().length > 0,
    "happyhorse-1-0-video-edit: reason для операторов",
  );
}

function assertWan27DbGate(
  meta: Record<string, unknown>,
  pricingSchema: Record<string, unknown>,
): void {
  assert.strictEqual(
    meta.publicReady,
    false,
    "Wan 2.7 Video: до admin preview + ручного Kie теста publicReady должен быть false",
  );
  assert.strictEqual(
    meta.requiresManualKieTest,
    true,
    "Wan 2.7 Video: нужен флаг requiresManualKieTest",
  );
  assert.strictEqual(
    meta.pricingNeedsReview,
    true,
    "Wan 2.7 Video: pricingNeedsReview должен оставаться true до сверки kie.ai/pricing",
  );
  assert.strictEqual(
    pricingSchema.pricingNeedsReview,
    true,
    "Wan 2.7 Video: pricingSchema должен явно требовать пересверки pricing",
  );
  assert.ok(
    typeof meta.reason === "string" && meta.reason.trim().length > 0,
    "Wan 2.7 Video: reason для операторов",
  );
}

async function assertDatabase(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  /** Пропуск БД даже при установленном DATABASE_URL (напр. host postgres вне compose). */
  const skipDb = process.env.VERIFY_KIE_GENERAL_MODELS_SKIP_DB === "1";
  if (skipDb) {
    console.warn(
      "[verify:kie-general-models] VERIFY_KIE_GENERAL_MODELS_SKIP_DB=1 — только снимки payload, без БД",
    );
    return;
  }
  if (!connectionString?.trim()) {
    throw new Error("Для проверок БД нужен DATABASE_URL или установите VERIFY_KIE_GENERAL_MODELS_SKIP_DB=1");
  }

  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const activeGeneral = await prisma.aiModel.findMany({
      where: { scope: "GENERAL", isActive: true },
      select: {
        slug: true,
        isPublic: true,
        productCardModelType: true,
        apiModelId: true,
        endpoint: true,
        statusEndpoint: true,
        settingsSchema: true,
        payloadMapping: true,
        metadata: true,
        scope: true,
        isActive: true,
      },
    });

    assert.deepStrictEqual(
      [...activeGeneral.map((m) => m.slug)].sort(),
      [...KIE_GENERAL_MODEL_SLUG_WHITELIST].sort(),
      "Должны быть активными ровно строки GENERAL из whitelist (phase1 + HappyHorse-1.0)",
    );

    for (const m of activeGeneral) {
      assert.equal(
        m.productCardModelType,
        null,
        `GENERAL active ${m.slug}: productCardModelType должен быть null`,
      );
      assert.ok(m.apiModelId?.trim(), `${m.slug}: apiModelId`);
      assert.equal(m.endpoint, "/api/v1/jobs/createTask", m.slug);
      assert.equal(m.statusEndpoint, "/api/v1/jobs/recordInfo", m.slug);
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
      const wl = new Set<string>([...KIE_GENERAL_MODEL_SLUG_WHITELIST]);
      assert.ok(
        !wl.has(m.slug),
        `PRODUCT_CARD slug не должен совпадать с whitelist GENERAL: ${m.slug}`,
      );
    }

    for (const def of ALL_STRICT_GENERAL_MODELS_FOR_DB_VERIFY) {
      const slug = def.slug as GeneralPhase1Slug | HappyHorseSlug | Wan27VideoSlug;
      const row = await prisma.aiModel.findUnique({ where: { slug } });

      assert.ok(row?.isActive, `${slug}: ожидалась активная строка AiModel`);
      assert.equal(row?.scope, "GENERAL");
      assert.equal(row?.productCardModelType, null);
      assert.equal(row?.isPublic, def.isPublic, `${slug}: isPublic`);

      assert.equal(row!.apiModelId, def.apiModelId);

      const meta = row!.metadata as Record<string, unknown> | null;
      assert.ok(meta && typeof meta === "object", `${slug}: metadata`);
      assert.equal(typeof meta.docsUrl, "string", slug);
      assert.equal(typeof meta.playgroundUrl, "string", slug);
      assert.ok(
        String(meta.playgroundUrl).startsWith("https://"),
        `${slug}: playgroundUrl`,
      );
      assert.equal(typeof meta.docsCheckedAt, "string", slug);
      assert.equal(meta.source, KIE_METADATA_SOURCE_LINE, slug);
      assert.equal(meta.publicReady, row!.isPublic, `${slug}: metadata.publicReady синхронизирован с isPublic`);
      assert.equal(typeof meta.kieModelFamily, "string", slug);
      assert.equal(typeof meta.kieMode, "string", slug);

      assert.deepStrictEqual(
        row!.settingsSchema,
        def.settingsSchema as unknown,
        `${slug}: settingsSchema отличается от реестра`,
      );

      assert.deepStrictEqual(
        row!.payloadMapping,
        def.payloadMapping as unknown,
        `${slug}: payloadMapping отличается от реестра`,
      );

      const builtFromRegistry = bodyFromDefinition(
        def.apiModelId,
        def.payloadMapping,
        settingsForSlug(slug, def),
        promptFixture,
      );

      const dbBuilt = buildKieMarketPayloadFromMapping(
        row!.payloadMapping as KiePayloadMapping,
        {
          model: { apiModelId: row!.apiModelId },
          prompt: promptFixture,
          settings: settingsForSlug(slug, def),
          inputFiles: [],
          callBackUrl,
        },
      );

      assert.deepStrictEqual(dbBuilt.input, builtFromRegistry.input);

      if (slug === "happyhorse-1-0-video-edit") {
        assertHappyHorseVideoEditDbGate(
          meta,
          dbBuilt.input as Record<string, unknown>,
        );
      }
      if (slug.startsWith("wan-2-7-")) {
        assertWan27DbGate(meta, row!.pricingSchema as Record<string, unknown>);
      }
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

async function main() {
  assertRequiredRegistryCoverage();
  assertPayloadSnapshots();
  assertAllRegistryPayloadsBuild();
  assertGptResolutionValidationMatrix();
  const hhSmoke = HAPPYHORSE_MODELS.find(
    (m) => m.slug === "happyhorse-1-0-image-to-video",
  )!;
  const hhForVal = {
    apiModelId: hhSmoke.apiModelId,
    payloadMapping: hhSmoke.payloadMapping,
  };
  assert.equal(
    validateStrictKieMarketPayload(
      hhForVal,
      "",
      SETTINGS_FOR_DB_BUILD["happyhorse-1-0-image-to-video"],
    ).ok,
    false,
    "HappyHorse: пустой prompt до билда",
  );
  assert.equal(
    validateStrictKieMarketPayload(
      hhForVal,
      promptFixture,
      SETTINGS_FOR_DB_BUILD["happyhorse-1-0-image-to-video"],
    ).ok,
    true,
  );
  const wanT2v = WAN_27_VIDEO_MODELS.find(
    (m) => m.slug === "wan-2-7-text-to-video",
  )!;
  assert.equal(
    validateStrictKieMarketPayload(
      {
        apiModelId: wanT2v.apiModelId,
        payloadMapping: wanT2v.payloadMapping,
      },
      promptFixture,
      {
        ...SETTINGS_FOR_DB_BUILD["wan-2-7-text-to-video"],
        duration: 1,
      },
    ).ok,
    false,
    "Wan 2.7 T2V: duration < 2 отклоняется до reserveCredits",
  );
  assert.equal(
    validateStrictKieMarketPayload(
      {
        apiModelId: wanT2v.apiModelId,
        payloadMapping: wanT2v.payloadMapping,
      },
      promptFixture,
      SETTINGS_FOR_DB_BUILD["wan-2-7-text-to-video"],
    ).ok,
    true,
  );
  const wanR2v = WAN_27_VIDEO_MODELS.find((m) => m.slug === "wan-2-7-r2v")!;
  assert.equal(
    validateStrictKieMarketPayload(
      {
        apiModelId: wanR2v.apiModelId,
        payloadMapping: wanR2v.payloadMapping,
      },
      promptFixture,
      {
        ...SETTINGS_FOR_DB_BUILD["wan-2-7-r2v"],
        referenceImage: [],
        referenceVideo: [],
      },
    ).ok,
    false,
    "Wan 2.7 R2V: нужен хотя бы один image/video reference",
  );
  const wanEdit = WAN_27_VIDEO_MODELS.find(
    (m) => m.slug === "wan-2-7-videoedit",
  )!;
  assert.equal(
    validateStrictKieMarketPayload(
      {
        apiModelId: wanEdit.apiModelId,
        payloadMapping: wanEdit.payloadMapping,
      },
      promptFixture,
      {
        ...SETTINGS_FOR_DB_BUILD["wan-2-7-videoedit"],
        duration: 1,
      },
    ).ok,
    false,
    "Wan 2.7 Video Edit: duration 1 отклоняется",
  );
  await assertDatabase();
  console.log("[verify:kie-general-models] OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
