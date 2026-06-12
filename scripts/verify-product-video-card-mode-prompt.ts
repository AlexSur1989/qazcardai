/**
 * Локальная проверка prompt builder для режима карточки товара (без Kie).
 * Запуск: npx tsx scripts/verify-product-video-card-mode-prompt.ts
 */
import { createRequire } from "node:module";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exit(1);
  }
  console.log("OK:", message);
}

async function main() {
  const require = createRequire(import.meta.url);
  const serverOnlyPath = require.resolve("server-only");
  require.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
    children: [],
    paths: [],
  } as unknown as NodeModule;

  const { buildProductVideoPrompt, PRODUCT_VIDEO_CARD_MODE_HINT } = await import(
    "../src/config/product-card-prompts"
  );

  const offPrompt = buildProductVideoPrompt({
    motionStyle: "orbit",
    userPrompt: "test",
    loopVideo: false,
    productCardMode: false,
  });

  assert(
    !offPrompt.includes("finished marketplace product card"),
    "productCardMode=false — нет card mode hint",
  );
  assert(
    offPrompt.includes("orbital arc"),
    "productCardMode=false — обычный orbit motion",
  );

  const onPrompt = buildProductVideoPrompt({
    motionStyle: "orbit",
    userPrompt: "test",
    loopVideo: true,
    productCardMode: true,
  });

  assert(onPrompt.includes(PRODUCT_VIDEO_CARD_MODE_HINT), "productCardMode=true — card mode hint");
  assert(onPrompt.includes("Preserve the existing text"), "содержит Preserve the existing text");
  assert(onPrompt.includes("Do not rewrite"), "содержит Do not rewrite");
  assert(onPrompt.includes("Do not change the position"), "содержит Do not change the position");
  assert(onPrompt.includes("minimal camera movement"), "содержит minimal camera movement");
  assert(
    onPrompt.includes("subtle soft parallax only"),
    "orbit смягчён в card mode",
  );
  assert(onPrompt.includes("loop seamlessly"), "loop hint сохранён при card mode");

  const cardBeforeLoop = onPrompt.indexOf("Product card mode:");
  const loopIdx = onPrompt.indexOf("loop seamlessly");
  assert(cardBeforeLoop >= 0 && loopIdx > cardBeforeLoop, "card mode hint до loop hint");

  console.log("\nВсе проверки prompt builder пройдены.");
}

void main();
