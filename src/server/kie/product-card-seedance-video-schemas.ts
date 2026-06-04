/**
 * Seedance I2V для Product Card «Видео товара» (first-frame из карточки/фото).
 * Kie: docs.kie.ai/market/bytedance/seedance-2, seedance-2-fast
 */

import type { KiePayloadMapping } from "@/server/services/kiePayloadMapping";

import { buildProductCardVideoMatrixKey } from "@/lib/product-card-matrix-keys";

const RATIO_VIDEO = ["1:1", "4:3", "3:4", "16:9", "9:16", "21:9", "adaptive"] as const;

function selectField(
  name: string,
  label: string,
  options: readonly string[],
  defaultValue: string,
) {
  return {
    name,
    label,
    type: "select",
    required: true,
    defaultValue,
    options: options.map((value) => ({ label: value, value })),
  };
}

/** Сценарий first-frame: анимация одного кадра (карточка / фото). */
export function productCardSeedanceVideoSettings(fast: boolean): Record<string, unknown> {
  return {
    version: 1,
    fields: [
      {
        name: "scenario",
        type: "hidden",
        defaultValue: "first-frame",
      },
      {
        name: "firstFrameUrl",
        label: "Первый кадр",
        type: "image-upload-list",
        required: true,
        maxItems: 1,
        accept: "image/*",
        purpose: "generation_input",
      },
      selectField(
        "resolution",
        "Разрешение",
        fast ? (["480p", "720p"] as const) : (["480p", "720p", "1080p"] as const),
        "720p",
      ),
      selectField("aspectRatio", "Формат", RATIO_VIDEO, "16:9"),
      {
        name: "duration",
        label: "Длительность",
        type: "number",
        required: true,
        defaultValue: 5,
        min: 4,
        max: 15,
        step: 1,
      },
      {
        name: "generateAudio",
        label: "Generate audio",
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      {
        name: "webSearch",
        label: "Web search",
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      {
        name: "nsfwChecker",
        label: "NSFW checker",
        type: "boolean",
        required: false,
        defaultValue: false,
      },
    ],
  };
}

export const PRODUCT_CARD_SEEDANCE_VIDEO_PAYLOAD: KiePayloadMapping = {
  adapter: "market-create-task",
  omitNull: true,
  required: ["first_frame_url", "resolution", "aspect_ratio", "duration"],
  input: {
    first_frame_url: "$settings.firstFrameUrl.0",
    resolution: "$settings.resolution",
    aspect_ratio: "$settings.aspectRatio",
    duration: "$settings.duration",
    generate_audio: "$settings.generateAudio",
    web_search: "$settings.webSearch",
    nsfw_checker: "$settings.nsfwChecker",
  },
  coerce: {
    first_frame_url: "string",
    resolution: "string",
    aspect_ratio: "string",
    duration: "number",
    generate_audio: "boolean",
    web_search: "boolean",
    nsfw_checker: "boolean",
  },
};

export function productCardSeedanceVideoPricing(
  baseTokens: number,
  providerCostUsd: number,
  fast: boolean,
): Record<string, unknown> {
  const matrix: Record<string, { tokens: number }> = {};
  const durations = [5, 10] as const;
  const resolutions = fast ? (["720p"] as const) : (["720p", "1080p"] as const);
  for (const d of durations) {
    for (const r of resolutions) {
      let tokens = baseTokens;
      if (d === 10) tokens = Math.round(tokens * 1.75);
      if (r === "1080p") tokens = Math.round(tokens * 1.5);
      matrix[buildProductCardVideoMatrixKey(d, r)] = { tokens };
    }
  }
  return {
    pricingScope: "PRODUCT_CARD",
    type: "product_card_matrix",
    baseTokens,
    providerCostUsd,
    manualOverrides: {},
    matrix,
  };
}
