import assert from "node:assert/strict";

import {
  buildKieMarketPayloadFromMapping,
  type KiePayloadMapping,
} from "../src/server/services/kiePayloadMapping";

const callBackUrl = "https://qazcard.example/api/webhooks/kie";
const prompt = "test prompt";

function body(
  apiModelId: string,
  mapping: KiePayloadMapping,
  settings: Record<string, unknown>,
) {
  return buildKieMarketPayloadFromMapping(mapping, {
    model: { apiModelId },
    prompt,
    settings,
    inputFiles: [],
    callBackUrl,
  });
}

const gptT2iMapping = {
  adapter: "market-create-task",
  omitNull: true,
  required: ["aspect_ratio", "resolution"],
  input: {
    aspect_ratio: "$settings.aspectRatio",
    resolution: "$settings.resolution",
  },
  coerce: {
    aspect_ratio: "string",
    resolution: "string",
  },
} satisfies KiePayloadMapping;

const gptI2iMapping = {
  adapter: "market-create-task",
  omitNull: true,
  required: ["input_urls", "aspect_ratio", "resolution"],
  input: {
    input_urls: "$settings.inputUrls",
    aspect_ratio: "$settings.aspectRatio",
    resolution: "$settings.resolution",
  },
  coerce: {
    input_urls: "stringArray",
    aspect_ratio: "string",
    resolution: "string",
  },
} satisfies KiePayloadMapping;

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

const gptT2i = body("gpt-image-2-text-to-image", gptT2iMapping, {
  aspectRatio: "auto",
  resolution: "1K",
});
assert.deepEqual(gptT2i, {
  model: "gpt-image-2-text-to-image",
  callBackUrl,
  input: {
    prompt,
    aspect_ratio: "auto",
    resolution: "1K",
  },
});

const gptI2i = body("gpt-image-2-image-to-image", gptI2iMapping, {
  inputUrls: ["https://example.com/a.png"],
  aspectRatio: "auto",
  resolution: "1K",
});
assert.deepEqual(gptI2i, {
  model: "gpt-image-2-image-to-image",
  callBackUrl,
  input: {
    prompt,
    input_urls: ["https://example.com/a.png"],
    aspect_ratio: "auto",
    resolution: "1K",
  },
});
assert.ok(!("image_urls" in (gptI2i.input as Record<string, unknown>)));

const klingT2v = body("kling-2.6/text-to-video", klingT2vMapping, {
  duration: "5",
  aspectRatio: "1:1",
  sound: false,
});
assert.deepEqual(klingT2v, {
  model: "kling-2.6/text-to-video",
  callBackUrl,
  input: {
    prompt,
    sound: false,
    aspect_ratio: "1:1",
    duration: "5",
  },
});
assert.ok("aspect_ratio" in (klingT2v.input as Record<string, unknown>));

const klingI2v = body("kling-2.6/image-to-video", klingI2vMapping, {
  imageUrls: ["https://example.com/a.png"],
  duration: "5",
  sound: false,
});
assert.deepEqual(klingI2v, {
  model: "kling-2.6/image-to-video",
  callBackUrl,
  input: {
    prompt,
    image_urls: ["https://example.com/a.png"],
    sound: false,
    duration: "5",
  },
});
assert.ok(!("input_urls" in (klingI2v.input as Record<string, unknown>)));
assert.ok(!("aspect_ratio" in (klingI2v.input as Record<string, unknown>)));

console.log("[verify:kie-payloads] OK");
