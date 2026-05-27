import { NextResponse } from "next/server";

import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { normalizeProductFactsList } from "@/lib/card-builder-product-facts";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import {
  mergeCardBuilderBlock,
  readCardBuilderBlock,
  type CardBuilderStoredSettings,
} from "@/server/services/productCardCardBuilderMeta";
import { getOwnedProjectOrNull } from "@/server/services/productCardProjectAccess";
import {
  resolveCardBuilderSourceImage,
  resolveProjectSourceImageByFileId,
} from "@/server/services/cardBuilderSourceImage";
import { visionAnalysisToSimpleCardSuggestions } from "@/lib/simple-product-card-vision-text";
import { mergeSimpleCardBlock, readSimpleCardBlock } from "@/server/services/simpleProductCardMeta";
import { enforceProductClassifyRateLimit } from "@/server/services/rateLimitService";
import {
  analyzeProductImageForCardBuilder,
  toPublicVisionAnalysisPayload,
  visionAnalysisToProductFacts,
} from "@/server/services/productCardVisionAnalysis";

export type ProductCardVisionAnalysisOptions = {
  productPhotoId?: string;
  /** Сохранить результат в marketplaceCard.simpleCard (простая карточка). */
  saveToSimpleCard?: boolean;
};

export async function handleProductCardVisionAnalysis(
  projectId: string,
  userId: string,
  options?: ProductCardVisionAnalysisOptions,
): Promise<NextResponse> {
  const rate = await enforceProductClassifyRateLimit(userId);
  if (rate) return rate;

  const project = await getOwnedProjectOrNull(userId, projectId);
  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  const src = options?.productPhotoId?.trim()
    ? await resolveProjectSourceImageByFileId(userId, projectId, options.productPhotoId.trim())
    : await resolveCardBuilderSourceImage(userId, projectId);
  if (!src.ok) {
    return NextResponse.json({ error: src.error, code: "NO_SOURCE" }, { status: src.status });
  }

  const analysis = await analyzeProductImageForCardBuilder({
    imageUrl: src.url,
    projectId,
    userId,
  });

  const publicPayload = toPublicVisionAnalysisPayload(analysis);
  const productFacts = visionAnalysisToProductFacts(analysis);
  const simpleSuggestions = visionAnalysisToSimpleCardSuggestions(analysis);

  if (!analysis.analysisFailed) {
    const prev = await readCardBuilderBlock(projectId);
    const prevSettings =
      prev?.settings && typeof prev.settings === "object" ? { ...prev.settings } : {};

    await mergeCardBuilderBlock(projectId, {
      settings: {
        ...prevSettings,
        visionAnalysis: {
          ...publicPayload,
          analyzedAt: new Date().toISOString(),
        },
        productFacts,
        cardBuilderCategoryKey: analysis.categoryKey,
        productType: analysis.productType,
        productNameGuess: analysis.productNameGuess,
        targetPlatform: "universal",
        updatedAt: new Date().toISOString(),
      } as unknown as CardBuilderStoredSettings,
    });
  }

  if (options?.saveToSimpleCard) {
    const simpleBlk = (await readSimpleCardBlock(projectId)) ?? {};
    const prevSettings = simpleBlk.settings;
    await mergeSimpleCardBlock(projectId, {
      vision: {
        ...publicPayload,
        productPhotoId: options.productPhotoId?.trim() || src.fileId,
        analyzedAt: new Date().toISOString(),
        analysisFailed: analysis.analysisFailed === true,
      },
      settings: prevSettings
        ? {
            ...prevSettings,
            productLabel: simpleSuggestions.productLabel || prevSettings.productLabel,
            updatedAt: new Date().toISOString(),
          }
        : undefined,
    });
  }

  return NextResponse.json({
    ...publicPayload,
    productFacts,
    productLabel: simpleSuggestions.productLabel,
    suggestedUserText: simpleSuggestions.suggestedUserText,
    visionOnly: true,
    message:
      "Распознано только видимое на фото. Для характеристик из интернета используйте «Найти характеристики в интернете».",
  });
}

export async function handleProductCardWebResearch(
  projectId: string,
  userId: string,
): Promise<NextResponse> {
  const rate = await enforceProductClassifyRateLimit(userId);
  if (rate) return rate;

  const project = await getOwnedProjectOrNull(userId, projectId);
  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  const block = await readCardBuilderBlock(projectId);
  const settings = block?.settings;
  const visionRaw = settings?.visionAnalysis;
  if (!visionRaw || typeof visionRaw !== "object" || Array.isArray(visionRaw)) {
    return NextResponse.json(
      { error: "Сначала выполните анализ фото." },
      { status: 400 },
    );
  }

  const { runProductCardWebResearch } = await import(
    "@/server/services/productCardWebResearch"
  );

  const vision =
    visionRaw as import("@/server/services/productCardVisionAnalysis").ProductCardVisionAnalysisResult;

  const result = await runProductCardWebResearch({
    vision,
    productType: settings?.productType,
  });

  if (!result.ok && result.suggestedFacts.length === 0) {
    return NextResponse.json(
      {
        error: result.error ?? "Web Research не дал результатов",
        meta: result.meta,
        query: result.query,
      },
      { status: 422 },
    );
  }

  const prevFacts = normalizeProductFactsList(settings?.productFacts ?? []);
  const merged = normalizeProductFactsList([...prevFacts, ...result.suggestedFacts]);

  const prevSettings =
    settings && typeof settings === "object" ? { ...settings } : {};

  await mergeCardBuilderBlock(projectId, {
    settings: {
      ...prevSettings,
      productFacts: merged,
      webResearch: result.meta,
      updatedAt: new Date().toISOString(),
    } as unknown as CardBuilderStoredSettings,
  });

  return NextResponse.json({
    ok: true,
    suggestedFacts: result.suggestedFacts,
    productFacts: merged,
    meta: result.meta,
    query: result.query,
    uncertainMatch: result.meta.uncertainMatch,
    message: result.meta.uncertainMatch
      ? "Мы нашли похожие товары. Проверьте характеристики перед генерацией."
      : "Проверьте предложенные характеристики и подтвердите нужные.",
  });
}

type ConfirmBody = {
  facts?: unknown;
  confirmIds?: string[];
  deleteIds?: string[];
};

export async function handleProductCardFactsConfirm(
  projectId: string,
  userId: string,
  req: Request,
): Promise<NextResponse> {
  const tooLarge = rejectOversizedBody(req, getMaxJsonBodyBytes());
  if (tooLarge) return tooLarge;

  const project = await getOwnedProjectOrNull(userId, projectId);
  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  let body: ConfirmBody = {};
  try {
    body = (await req.json()) as ConfirmBody;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const block = await readCardBuilderBlock(projectId);
  const settings = block?.settings;
  let facts = normalizeProductFactsList(body.facts ?? settings?.productFacts ?? []);

  const confirmIds = new Set(
    (body.confirmIds ?? []).filter((id): id is string => typeof id === "string"),
  );
  const deleteIds = new Set(
    (body.deleteIds ?? []).filter((id): id is string => typeof id === "string"),
  );

  facts = facts
    .filter((f) => !deleteIds.has(f.id))
    .map((f) => {
      if (!confirmIds.has(f.id)) return f;
      if (f.source !== "web_suggested") return f;
      return {
        ...f,
        verifiedByUser: true,
        needsReview: false,
        visibleOnCard: f.visibleOnCard !== false,
        lockedText: true,
      };
    });

  facts = normalizeProductFactsList(facts);

  const prevSettings =
    settings && typeof settings === "object" ? { ...settings } : {};

  await mergeCardBuilderBlock(projectId, {
    settings: {
      ...prevSettings,
      productFacts: facts,
      updatedAt: new Date().toISOString(),
    } as unknown as CardBuilderStoredSettings,
  });

  return NextResponse.json({ ok: true, productFacts: facts });
}

export async function guardProductCardAnalysisUser(req: Request): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const current = await getFreshSessionUser();
  if (!current.ok) {
    if (current.reason === "inactive") {
      return {
        ok: false,
        response: NextResponse.json({ error: "Аккаунт недоступен" }, { status: 403 }),
      };
    }
    return {
      ok: false,
      response: NextResponse.json({ error: "Требуется вход" }, { status: 401 }),
    };
  }
  const tooLarge = rejectOversizedBody(req, getMaxJsonBodyBytes());
  if (tooLarge) return { ok: false, response: tooLarge };
  return { ok: true, userId: current.user.id };
}
