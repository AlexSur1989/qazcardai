/**
 * Диагностика product/reference URL и (опционально) Kie File Upload без Generation и без credits.
 *
 *   PRODUCT_URL=https://... REFERENCE_URL=https://... npm run verify:reference-image-preflight
 *   TRY_KIE_UPLOAD=1 — попробовать Kie upload (нужны KIE_API_KEY, KIE_BASE_URL)
 *
 * Production (Docker):
 *   docker compose run --rm app npm run verify:reference-image-preflight
 */
import "dotenv/config";

import {
  isDirectUrlTrustedForKieExternalFetch,
  preflightImageUrl,
} from "../src/lib/image-url-preflight";
import {
  uploadImageBufferToKie,
  uploadImageUrlToKie,
} from "../src/server/services/provider/kieFileUpload";
import { downloadImageUrlBytes } from "../src/lib/image-url-preflight";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function ok(msg: string) {
  console.log(`OK: ${msg}`);
}

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

async function diagnoseUrl(label: string, url: string) {
  section(label);
  console.log("url:", url);
  const preflight = await preflightImageUrl(url);
  console.log(JSON.stringify(preflight, null, 2));
  if (!preflight.ok) {
    fail(`${label}: preflight failed`);
  }
  ok(`${label}: preflight passed`);

  const trusted = isDirectUrlTrustedForKieExternalFetch(url, preflight);
  console.log("directUrlTrustedForKie:", trusted);

  if (process.env.TRY_KIE_UPLOAD !== "1") {
    console.log("TRY_KIE_UPLOAD!=1 — Kie upload skipped");
    return { preflight, trusted, kieUpload: null as null };
  }

  if (!process.env.KIE_API_KEY?.trim() || !process.env.KIE_BASE_URL?.trim()) {
    fail("TRY_KIE_UPLOAD=1 but KIE_API_KEY or KIE_BASE_URL missing");
  }

  section(`${label}: Kie upload`);
  let kieUpload;
  if (trusted) {
    kieUpload = await uploadImageUrlToKie({ fileUrl: url });
  } else {
    const dl = await downloadImageUrlBytes(url);
    kieUpload = await uploadImageBufferToKie({
      buffer: dl.buffer,
      contentType: dl.contentType,
      fileName: `${label.replace(/\s+/g, "-").toLowerCase()}.jpg`,
    });
  }
  console.log(JSON.stringify(kieUpload, null, 2));
  if (!kieUpload.ok) {
    fail(`${label}: Kie upload failed`);
  }
  ok(`${label}: Kie upload → ${kieUpload.downloadUrl}`);
  return { preflight, trusted, kieUpload };
}

async function main() {
  const productUrl = process.env.PRODUCT_URL?.trim();
  const referenceUrl = process.env.REFERENCE_URL?.trim();

  if (!productUrl) {
    fail("Set PRODUCT_URL env var");
  }

  console.log("verify:reference-image-preflight (no Generation, no credits)");
  await diagnoseUrl("Product image", productUrl);
  if (referenceUrl) {
    await diagnoseUrl("Reference image", referenceUrl);
  } else {
    console.log("\nREFERENCE_URL not set — reference check skipped");
  }

  ok("all checks passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
