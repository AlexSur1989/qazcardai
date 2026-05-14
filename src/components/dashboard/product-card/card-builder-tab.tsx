"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  CARD_BUILDER_AUDIENCES,
  CARD_BUILDER_BENEFIT_TAGS,
  CARD_BUILDER_GOALS,
  CARD_BUILDER_LANGUAGE_MODES,
  CARD_BUILDER_MARKETPLACES,
  CARD_BUILDER_MUST_SHOW,
  CARD_BUILDER_PRESERVE_ASPECTS,
  CARD_BUILDER_PRICE_SEGMENTS,
  CARD_BUILDER_SALES_STYLES,
  CARD_BUILDER_TEXT_DENSITY,
} from "@/config/card-builder-config";
import type { ProductCardMarketplaceProfile } from "@/config/product-card-marketplace-profiles";
import { cardBuilderGoalToSlideRole } from "@/server/services/productCardBuilderPlan";
import type { ProductCategoryId } from "@/config/product-card-categories";
import {
  listTemplatesForSlideRole,
  type CardBuilderTemplateSlideRole,
} from "@/config/card-builder-templates";
import { readJsonSafe } from "@/lib/fetch-json-safe";
import {
  IMAGE_GENERATION_POLL_INTERVAL_MS,
  IMAGE_GENERATION_POLL_MAX_ITERATIONS,
} from "@/lib/generation-client-polling";
import { getFirstOutputUrlFromJson } from "@/lib/product-card-output";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const nativeFieldClass =
  "h-10 w-full min-w-0 rounded-xl border border-input bg-card px-2.5 text-sm text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

function slideProgressLabel(statusRaw: string): string {
  const s = statusRaw.trim().toLowerCase();
  if (s === "queued") return "в очереди";
  if (s === "done" || s === "готово") return "готово";
  if (s === "error" || s === "ошибка") return "ошибка";
  if (s === "generating") return "генерация";
  if (!s || s === "не сгенерировано") return "не сгенерировано";
  return statusRaw;
}

type GallerySlide = {
  slideId: string;
  title: string;
  purpose?: string;
  imageRole: string;
  templateId?: string;
  templateLabel?: string;
  layoutPreset?: string;
  previewCaption?: string;
};

type CardBuilderGenHistoryRow = {
  generationId: string;
  slideId: string;
  imageRole?: string;
  createdAt?: string;
  status?: string;
  errorMessage?: string;
};

type CardBuilderBlockPayload = {
  galleryPlan?: GallerySlide[];
  generations?: unknown;
  settings?: Record<string, unknown>;
};

type Props = {
  hasImage: boolean;
  canUseBackend: boolean;
  projectId: string | null;
  selectedCategory: ProductCategoryId | null;
  balanceCredits: number;
  marketplaceProfiles: ProductCardMarketplaceProfile[];
};

export function CardBuilderTab({
  hasImage,
  canUseBackend,
  projectId,
  selectedCategory,
  balanceCredits,
  marketplaceProfiles,
}: Props) {
  const [marketplace, setMarketplace] = useState("ozon");
  const [goal, setGoal] = useState("full_gallery_6");
  const [preserveProduct, setPreserveProduct] = useState(true);
  const [preserveAspects, setPreserveAspects] = useState<string[]>([
    "shape",
    "color",
    "logo",
    "proportions",
  ]);
  const [creativeStyle, setCreativeStyle] = useState(false);
  const [benefitsSel, setBenefitsSel] = useState<string[]>([]);
  const [benefitsExtra, setBenefitsExtra] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [dimensionsUser, setDimensionsUser] = useState("");
  const [languageMode, setLanguageMode] = useState("auto");
  const [mustSel, setMustSel] = useState<string[]>(["texture", "details"]);
  const [audience, setAudience] = useState("mass_market");
  const [priceSegment, setPriceSegment] = useState("middle");
  const [salesStyle, setSalesStyle] = useState("light_marketplace");
  type DensityStash = { key: string; value: string };
  const [densityStash, setDensityStash] = useState<DensityStash>({ key: "", value: "medium" });

  const [slides, setSlides] = useState<GallerySlide[]>([]);
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(false);

  const [estimateSingle, setEstimateSingle] = useState<number | null>(null);
  const [estimateGallery, setEstimateGallery] = useState<number | null>(null);
  const cbPricingSnapRef = useRef<{
    lastPlanHash: string | null;
    singleCredits: number | null;
    galleryCredits: number | null;
  }>({
    lastPlanHash: null,
    singleCredits: null,
    galleryCredits: null,
  });
  const [estimating, setEstimating] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);

  const [slideGen, setSlideGen] = useState<Record<string, { status: string; url: string | null }>>(
    {},
  );
  const [genHistory, setGenHistory] = useState<CardBuilderGenHistoryRow[]>([]);
  const [tplBusySlideId, setTplBusySlideId] = useState<string | null>(null);

  /** После успешной гидратации для `projectId` не подставляем saved.* повторно при refresh. */
  const hydratedProjectIdRef = useRef<string | null>(null);
  /** Пользователь успел изменить форму до завершения первого fetch — не перезатирать локальный ввод. */
  const userEditedFormRef = useRef(false);

  const markUserEditedForm = useCallback(() => {
    userEditedFormRef.current = true;
  }, []);

  const enabledMpIndex = useMemo(() => {
    const m = new Map<string, ProductCardMarketplaceProfile>();
    for (const p of marketplaceProfiles) m.set(p.id, p);
    return m;
  }, [marketplaceProfiles]);

  const coercedMarketplace = useMemo(() => {
    const p = enabledMpIndex.get(marketplace);
    if (p && p.enabled !== false) return marketplace;
    return (
      CARD_BUILDER_MARKETPLACES.find((x) => enabledMpIndex.get(x.id)?.enabled !== false)?.id ?? "ozon"
    );
  }, [marketplace, enabledMpIndex]);

  const goalChoices = useMemo(() => {
    const profile = enabledMpIndex.get(coercedMarketplace);
    if (!profile) return [...CARD_BUILDER_GOALS];
    return CARD_BUILDER_GOALS.filter((g) => {
      const role = cardBuilderGoalToSlideRole(g.id);
      if (!role) return true;
      return (profile.allowedSlideTypes as string[]).includes(role as string);
    });
  }, [enabledMpIndex, coercedMarketplace]);

  const effectiveGoal = useMemo(() => {
    if (goalChoices.some((g) => g.id === goal)) return goal;
    return goalChoices[0]?.id ?? "full_gallery_6";
  }, [goal, goalChoices]);

  const densityChoices = useMemo(() => {
    const profile = enabledMpIndex.get(coercedMarketplace);
    if (!profile || effectiveGoal !== "main_photo" || profile.mainPhotoTextAllowed) {
      return [...CARD_BUILDER_TEXT_DENSITY];
    }
    return CARD_BUILDER_TEXT_DENSITY.filter((t) => t.id === "none" || t.id === "minimal");
  }, [enabledMpIndex, effectiveGoal, coercedMarketplace]);

  const benefitLimit = enabledMpIndex.get(coercedMarketplace)?.maxBenefitBadges ?? 11;

  const profileForDensity = enabledMpIndex.get(coercedMarketplace);
  const recommendedTextDensity =
    profileForDensity?.mainPhotoRules.recommendedTextDensity ?? "medium";
  const densityRecoKey = `${coercedMarketplace}|${recommendedTextDensity}`;

  const effectiveTextDensity = useMemo(() => {
    const rawPick = densityStash.key === densityRecoKey ? densityStash.value : recommendedTextDensity;
    let out = rawPick;
    if (effectiveGoal === "main_photo" && profileForDensity && !profileForDensity.mainPhotoTextAllowed) {
      if (out !== "none" && out !== "minimal") out = "none";
    }
    if (!densityChoices.some((c) => c.id === out)) {
      out = densityChoices[0]?.id ?? recommendedTextDensity;
    }
    return out;
  }, [
    densityStash,
    densityRecoKey,
    recommendedTextDensity,
    effectiveGoal,
    profileForDensity,
    densityChoices,
  ]);

  const canWork = Boolean(hasImage && canUseBackend && projectId && selectedCategory);

  const planPayload = useMemo(
    () => ({
      selectedCategory: selectedCategory ?? "other",
      marketplace: coercedMarketplace,
      goal: effectiveGoal,
      preserveProduct,
      preserveAspects,
      allowCreativeStylization: creativeStyle,
      benefits: benefitsSel,
      benefitsExtra: benefitsExtra.trim() || undefined,
      subtitle: subtitle.trim() || undefined,
      dimensions: dimensionsUser.trim() || undefined,
      languageMode,
      mustShow: mustSel,
      audience,
      priceSegment,
      salesStyle,
      textDensity: effectiveTextDensity,
    }),
    [
      selectedCategory,
      coercedMarketplace,
      effectiveGoal,
      preserveProduct,
      preserveAspects,
      creativeStyle,
      benefitsSel,
      benefitsExtra,
      subtitle,
      dimensionsUser,
      languageMode,
      mustSel,
      audience,
      priceSegment,
      salesStyle,
      effectiveTextDensity,
    ],
  );

  const fetchCardBuilderBlockForProject = useCallback(
    async (pid: string): Promise<CardBuilderBlockPayload | null> => {
      if (!canUseBackend) return null;
      const res = await fetch(`/api/product-card-projects/${pid}`);
      const parsed = await readJsonSafe<{ project?: { metadata?: { cardBuilder?: CardBuilderBlockPayload } } }>(
        res,
      );
      if (!parsed.ok || !res.ok) return null;
      return parsed.data.project?.metadata?.cardBuilder ?? null;
    },
    [canUseBackend],
  );

  const applySlidesAndHistoryFromBlock = useCallback((blk: CardBuilderBlockPayload | null) => {
    const list = blk?.galleryPlan;
    if (Array.isArray(list) && list.length) {
      setSlides(list as GallerySlide[]);
      setActiveSlideId((prev) => {
        if (prev && list.some((s: GallerySlide) => s.slideId === prev)) return prev;
        return (list[0] as GallerySlide).slideId;
      });
    }
    const rawGens = blk?.generations;
    if (Array.isArray(rawGens)) {
      const rows: CardBuilderGenHistoryRow[] = [];
      for (const x of rawGens) {
        if (!x || typeof x !== "object") continue;
        const r = x as Record<string, unknown>;
        const id = typeof r.generationId === "string" ? r.generationId.trim() : "";
        const slideId = typeof r.slideId === "string" ? r.slideId.trim() : "";
        if (!id || !slideId) continue;
        const row: CardBuilderGenHistoryRow = {
          generationId: id,
          slideId,
        };
        if (typeof r.imageRole === "string") row.imageRole = r.imageRole;
        if (typeof r.createdAt === "string") row.createdAt = r.createdAt;
        if (typeof r.status === "string") row.status = r.status;
        if (typeof r.errorMessage === "string" && r.errorMessage.trim()) {
          row.errorMessage = r.errorMessage.trim().slice(0, 320);
        }
        rows.push(row);
      }
      setGenHistory(rows);
    } else {
      setGenHistory([]);
    }
  }, []);

  const applyHydratedSettingsFromSaved = useCallback(
    (saved: Record<string, unknown>, mpIndex: Map<string, ProductCardMarketplaceProfile>) => {
      if (typeof saved.languageMode === "string" && saved.languageMode.trim()) {
        setLanguageMode(saved.languageMode.trim());
      }
      if (typeof saved.subtitle === "string") setSubtitle(saved.subtitle);
      if (typeof saved.dimensions === "string") setDimensionsUser(saved.dimensions);

      if (typeof saved.marketplace === "string" && saved.marketplace.trim()) {
        setMarketplace(saved.marketplace.trim());
      }
      if (typeof saved.goal === "string" && saved.goal.trim()) setGoal(saved.goal.trim());

      if (typeof saved.preserveProduct === "boolean") setPreserveProduct(saved.preserveProduct);
      if (Array.isArray(saved.preserveAspects)) {
        setPreserveAspects(saved.preserveAspects.filter((x): x is string => typeof x === "string"));
      }
      if (typeof saved.allowCreativeStylization === "boolean") {
        setCreativeStyle(saved.allowCreativeStylization);
      }

      if (Array.isArray(saved.benefits)) {
        setBenefitsSel(saved.benefits.filter((x): x is string => typeof x === "string"));
      } else if (Array.isArray(saved.semanticBenefits)) {
        setBenefitsSel(saved.semanticBenefits.filter((x): x is string => typeof x === "string"));
      }

      const extra =
        typeof saved.benefitsExtra === "string"
          ? saved.benefitsExtra
          : typeof saved.additionalBenefits === "string"
            ? saved.additionalBenefits
            : "";
      if (extra.trim()) setBenefitsExtra(extra);

      if (Array.isArray(saved.mustShow)) {
        setMustSel(saved.mustShow.filter((x): x is string => typeof x === "string"));
      }
      if (typeof saved.audience === "string" && saved.audience.trim()) {
        setAudience(saved.audience.trim());
      }
      if (typeof saved.priceSegment === "string" && saved.priceSegment.trim()) {
        setPriceSegment(saved.priceSegment.trim());
      }
      if (typeof saved.salesStyle === "string" && saved.salesStyle.trim()) {
        setSalesStyle(saved.salesStyle.trim());
      }

      if (typeof saved.textDensity === "string" && saved.textDensity.trim()) {
        const mpKey =
          typeof saved.marketplace === "string" && saved.marketplace.trim()
            ? saved.marketplace.trim()
            : "ozon";
        const prof = mpIndex.get(mpKey);
        const reco = prof?.mainPhotoRules.recommendedTextDensity ?? "medium";
        setDensityStash({
          key: `${mpKey}|${reco}`,
          value: saved.textDensity.trim(),
        });
      }
    },
    [],
  );

  /** Гидратация полей формы только при первом заходе на проект или после смены projectId. */
  const hydrateFormFromServer = useCallback(async () => {
    const pid = projectId;
    if (!pid || !canUseBackend) return;
    const blk = await fetchCardBuilderBlockForProject(pid);
    if (pid !== projectId) return;
    const saved = blk?.settings;
    const needsFormHydrate = hydratedProjectIdRef.current !== pid;
    if (needsFormHydrate && saved && typeof saved === "object" && !userEditedFormRef.current) {
      applyHydratedSettingsFromSaved(saved, enabledMpIndex);
    }
    if (needsFormHydrate) {
      hydratedProjectIdRef.current = pid;
    }
    applySlidesAndHistoryFromBlock(blk);
  }, [
    projectId,
    canUseBackend,
    fetchCardBuilderBlockForProject,
    enabledMpIndex,
    applyHydratedSettingsFromSaved,
    applySlidesAndHistoryFromBlock,
  ]);

  /** Обновление плана галереи и истории генераций без перезаписи полей формы. */
  const refreshHistoryAndPlanStatus = useCallback(async () => {
    const pid = projectId;
    if (!pid || !canUseBackend) return;
    const blk = await fetchCardBuilderBlockForProject(pid);
    if (pid !== projectId) return;
    applySlidesAndHistoryFromBlock(blk);
  }, [projectId, canUseBackend, fetchCardBuilderBlockForProject, applySlidesAndHistoryFromBlock]);

  const runPlan = useCallback(async () => {
    if (!projectId || !selectedCategory) return;
    setPlanLoading(true);
    setPlanError(null);
    try {
      const res = await fetch(`/api/product-card-projects/${projectId}/card-builder/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planPayload),
      });
      const parsed = await readJsonSafe<{ slides?: GallerySlide[]; error?: string }>(res);
      if (!parsed.ok) {
        setPlanError(parsed.message);
        return;
      }
      if (!res.ok) {
        setPlanError(parsed.data.error ?? "Не удалось сохранить структуру");
        return;
      }
      const list = parsed.data.slides ?? [];
      setSlides(list);
      setActiveSlideId(list[0]?.slideId ?? null);
      cbPricingSnapRef.current.lastPlanHash = null;
      userEditedFormRef.current = false;
      await refreshHistoryAndPlanStatus();
    } finally {
      setPlanLoading(false);
    }
  }, [projectId, selectedCategory, planPayload, refreshHistoryAndPlanStatus]);

  const runEstimate = useCallback(
    async (mode: "single_slide" | "full_gallery") => {
      if (!projectId) return;
      setEstimating(true);
      try {
        const res = await fetch(`/api/product-card-projects/${projectId}/estimate/card-builder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: slides.length ? "saved" : "payload",
            payload: slides.length ? undefined : planPayload,
            mode,
            activeSlideId:
              activeSlideId && slides.some((s) => s.slideId === activeSlideId)
                ? activeSlideId
                : undefined,
          }),
        });
        const parsed = await readJsonSafe<{
          credits?: number;
          planHash?: string;
          error?: string;
          code?: string;
        }>(res);
        if (!parsed.ok) {
          setPlanError(parsed.message);
          return;
        }
        if (!res.ok) {
          setPlanError(parsed.data.error ?? "Оценка недоступна");
          return;
        }
        const c = parsed.data.credits ?? null;
        const ph = typeof parsed.data.planHash === "string" ? parsed.data.planHash : null;
        if (ph) {
          cbPricingSnapRef.current.lastPlanHash = ph;
        }
        if (mode === "single_slide") {
          setEstimateSingle(c);
          if (typeof c === "number" && Number.isFinite(c)) {
            cbPricingSnapRef.current.singleCredits = c;
          }
        } else {
          setEstimateGallery(c);
          if (typeof c === "number" && Number.isFinite(c)) {
            cbPricingSnapRef.current.galleryCredits = c;
          }
        }
      } finally {
        setEstimating(false);
      }
    },
    [projectId, planPayload, slides, activeSlideId],
  );

  const pollGen = useCallback(async (generationId: string) => {
    const done = new Set(["COMPLETED"]);
    const terminalBad = new Set(["FAILED", "CANCELLED", "REFUNDED", "BLOCKED"]);
    for (let i = 0; i < IMAGE_GENERATION_POLL_MAX_ITERATIONS; i++) {
      const res = await fetch(`/api/generations/${generationId}`);
      const parsed = await readJsonSafe<{ status: string; outputFiles?: unknown }>(res);
      if (!parsed.ok || !res.ok) break;
      const st = parsed.data.status;
      if (done.has(st)) {
        return getFirstOutputUrlFromJson(parsed.data.outputFiles) ?? null;
      }
      if (terminalBad.has(st)) break;
      await new Promise((r) => setTimeout(r, IMAGE_GENERATION_POLL_INTERVAL_MS));
    }
    return null;
  }, []);

  const changeSlideTemplate = useCallback(
    async (slideId: string, templateId: string) => {
      if (!projectId) return;
      setTplBusySlideId(slideId);
      setPlanError(null);
      try {
        const res = await fetch(
          `/api/product-card-projects/${projectId}/card-builder/slide-template`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slideId, templateId }),
          },
        );
        const parsed = await readJsonSafe<{
          galleryPlan?: GallerySlide[];
          error?: string;
          code?: string;
        }>(res);
        if (!parsed.ok) {
          setPlanError(parsed.message);
          return;
        }
        if (!res.ok) {
          setPlanError(parsed.data.error ?? "Не удалось сменить шаблон");
          return;
        }
        const list = parsed.data.galleryPlan;
        if (Array.isArray(list) && list.length) {
          setSlides(list);
          cbPricingSnapRef.current.lastPlanHash = null;
        }
      } finally {
        setTplBusySlideId(null);
      }
    },
    [projectId],
  );

  const generateOne = useCallback(
    async (slideId: string) => {
      if (!projectId) return;
      setGenBusy(true);
      try {
        const hash = cbPricingSnapRef.current.lastPlanHash;
        const cred = cbPricingSnapRef.current.singleCredits;
        if (!hash || cred == null) {
          toast.error("Сначала нажмите «Оценить один слайд».");
          return;
        }
        const res = await fetch(
          `/api/product-card-projects/${projectId}/generate/card-builder-slide`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              slideId,
              clientEstimateCredits: cred,
              clientPlanHash: hash,
              useSavedPlan: true,
            }),
          },
        );
        const parsed = await readJsonSafe<{
          generationId?: string;
          error?: string;
          code?: string;
          marketplaceNotice?: string;
        }>(res);
        if (!parsed.ok) {
          setPlanError(parsed.message);
          return;
        }
        if (!res.ok) {
          const msg = parsed.data.error ?? "Не удалось запустить генерацию";
          setPlanError(msg);
          if (parsed.data.code === "PLAN_CHANGED" || parsed.data.code === "PRICE_CHANGED") {
            toast.error(msg);
          }
          return;
        }
        const notice = parsed.data.marketplaceNotice?.trim();
        if (notice) {
          toast.message(notice);
        }
        const gid = parsed.data.generationId;
        if (!gid) return;
        setSlideGen((prev) => ({
          ...prev,
          [slideId]: { status: "generating", url: prev[slideId]?.url ?? null },
        }));
        const url = await pollGen(gid);
        setSlideGen((prev) => ({
          ...prev,
          [slideId]: { status: url ? "done" : "error", url },
        }));
        await refreshHistoryAndPlanStatus();
      } finally {
        setGenBusy(false);
      }
    },
    [projectId, pollGen, refreshHistoryAndPlanStatus],
  );

  const generateAll = useCallback(async () => {
    if (!projectId) return;
    setBatchBusy(true);
    await runEstimate("full_gallery");
    const gh = cbPricingSnapRef.current.lastPlanHash;
    const ggc = cbPricingSnapRef.current.galleryCredits;
    if (!gh || ggc == null) {
      toast.error("Сначала дождитесь оценки всей галереи.");
      setBatchBusy(false);
      return;
    }
    try {
      const res = await fetch(`/api/product-card-projects/${projectId}/generate/card-builder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientEstimateCredits: ggc,
          clientPlanHash: gh,
        }),
      });
      const parsed = await readJsonSafe<{
        totalCredits?: number;
        results?: { slideId?: string; generationId?: string; error?: string }[];
        error?: string;
        code?: string;
      }>(res);
      if (!parsed.ok) {
        setPlanError(parsed.message);
        return;
      }
      if (!res.ok) {
        const msg = parsed.data.error ?? "Пакетная генерация недоступна";
        setPlanError(msg);
        if (parsed.data.code === "PLAN_CHANGED" || parsed.data.code === "PRICE_CHANGED") {
          toast.error(msg);
        }
        return;
      }
      const rows = parsed.data.results ?? [];
      for (const row of rows) {
        if (!row.slideId) continue;
        if (row.generationId) {
          setSlideGen((p) => ({
            ...p,
            [row.slideId!]: { status: "generating", url: p[row.slideId!]?.url ?? null },
          }));
          const url = await pollGen(row.generationId);
          setSlideGen((p) => ({
            ...p,
            [row.slideId!]: { status: url ? "done" : "error", url },
          }));
        } else {
          setSlideGen((p) => ({
            ...p,
            [row.slideId!]: { status: "error", url: p[row.slideId!]?.url ?? null },
          }));
        }
      }
    } finally {
      setBatchBusy(false);
      await refreshHistoryAndPlanStatus();
    }
  }, [projectId, pollGen, runEstimate, refreshHistoryAndPlanStatus]);

  useEffect(() => {
    hydratedProjectIdRef.current = null;
    userEditedFormRef.current = false;
    void Promise.resolve().then(() => {
      setMarketplace("ozon");
      setGoal("full_gallery_6");
      setPreserveProduct(true);
      setPreserveAspects(["shape", "color", "logo", "proportions"]);
      setCreativeStyle(false);
      setBenefitsSel([]);
      setBenefitsExtra("");
      setSubtitle("");
      setDimensionsUser("");
      setLanguageMode("auto");
      setMustSel(["texture", "details"]);
      setAudience("mass_market");
      setPriceSegment("middle");
      setSalesStyle("light_marketplace");
      setDensityStash({ key: "", value: "medium" });
      setSlides([]);
      setActiveSlideId(null);
      setPlanError(null);
      setEstimateSingle(null);
      setEstimateGallery(null);
      setSlideGen({});
      setGenHistory([]);
      cbPricingSnapRef.current = { lastPlanHash: null, singleCredits: null, galleryCredits: null };
    });
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !canUseBackend) return;
    void Promise.resolve().then(() => void hydrateFormFromServer());
  }, [projectId, canUseBackend, enabledMpIndex, hydrateFormFromServer]);

  if (!hasImage) return null;

  const selProfile = enabledMpIndex.get(coercedMarketplace);

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <div className="space-y-4">
        {!selectedCategory && (
          <Alert>
            <AlertTitle>Категория</AlertTitle>
            <AlertDescription>Сначала определите категорию товара выше.</AlertDescription>
          </Alert>
        )}

        {planError && (
          <Alert variant="destructive">
            <AlertTitle>Ошибка</AlertTitle>
            <AlertDescription>{planError}</AlertDescription>
          </Alert>
        )}

        <Alert>
          <AlertTitle>Текст на изображении</AlertTitle>
          <AlertDescription>
            Лимиты для одного слайда: одна строка — не длиннее 120 символов; всего не больше 7 фраз (название,
            подзаголовок, теги, строки из поля дополнительного текста, размеры).
          </AlertDescription>
        </Alert>

        <Card className="rounded-2xl border-border">
          <CardHeader>
            <CardTitle className="text-base">Маркетплейс и задача</CardTitle>
            <CardDescription>Канал размещения и что нужно получить</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pc-marketplace">Маркетплейс / канал</Label>
              <select
                id="pc-marketplace"
                className={nativeFieldClass}
                value={coercedMarketplace}
                onChange={(e) => {
                  markUserEditedForm();
                  setMarketplace(e.target.value);
                }}
              >
                {CARD_BUILDER_MARKETPLACES.filter((m) => enabledMpIndex.get(m.id)?.enabled !== false).map(
                  (m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pc-goal">Что создать</Label>
              <select
                id="pc-goal"
                className={nativeFieldClass}
                value={effectiveGoal}
                onChange={(e) => {
                  markUserEditedForm();
                  setGoal(e.target.value);
                }}
              >
                {goalChoices.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
            {selProfile ? (
              <div className="sm:col-span-2 space-y-3">
                <Alert>
                  <AlertTitle>Для выбранной площадки рекомендуем</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>{selProfile.userHint}</p>
                    <ul className="text-muted-foreground list-inside list-disc text-sm">
                      {selProfile.complianceHints.slice(0, 5).map((h) => (
                        <li key={h}>{h}</li>
                      ))}
                    </ul>
                    {selProfile.needsVerification ? (
                      <p className="text-xs">
                        Для этой площадки профиль требует дополнительной проверки перед публикацией.
                      </p>
                    ) : null}
                    <p className="text-muted-foreground text-xs">
                      Целевой формат: {selProfile.defaultSize} · {selProfile.defaultAspectRatio}.
                    </p>
                  </AlertDescription>
                </Alert>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border">
          <CardHeader>
            <CardTitle className="text-base">Товар 1:1</CardTitle>
            <CardDescription>Сохранять исходный товар без искажений</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                id="pc-preserve"
                type="checkbox"
                checked={preserveProduct}
                onChange={(e) => {
                  markUserEditedForm();
                  setPreserveProduct(e.target.checked);
                }}
                className="border-input accent-primary size-4 shrink-0 rounded border"
              />
              <Label htmlFor="pc-preserve">Сохранять товар без изменений</Label>
            </div>
            <div className="flex flex-wrap gap-2">
              {CARD_BUILDER_PRESERVE_ASPECTS.map((a) => (
                <label
                  key={a.id}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={preserveAspects.includes(a.id)}
                    onChange={(e) => {
                      markUserEditedForm();
                      const on = e.target.checked;
                      setPreserveAspects((prev) =>
                        on ? [...prev, a.id] : prev.filter((x) => x !== a.id),
                      );
                    }}
                    className="border-input accent-primary size-4 shrink-0 rounded border"
                  />
                  {a.label}
                </label>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                id="pc-creative"
                type="checkbox"
                checked={creativeStyle}
                onChange={(e) => {
                  markUserEditedForm();
                  setCreativeStyle(e.target.checked);
                }}
                className="border-input accent-primary size-4 shrink-0 rounded border"
              />
              <Label htmlFor="pc-creative">Разрешить креативную стилизацию</Label>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border">
          <CardHeader>
            <CardTitle className="text-base">Преимущества и акценты</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {benefitsSel.length > benefitLimit ? (
              <Alert variant="destructive">
                <AlertTitle>Слишком много акцентов</AlertTitle>
                <AlertDescription>
                  Для этой площадки можно перенести в текст слайда преимуществ не больше {benefitLimit}{" "}
                  акцентов. При генерации будут использованы первые {benefitLimit} — добавьте самые важные
                  в начало списка.
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {CARD_BUILDER_BENEFIT_TAGS.map((b) => (
                <label
                  key={b.id}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={benefitsSel.includes(b.id)}
                    onChange={(e) => {
                      markUserEditedForm();
                      const on = e.target.checked;
                      setBenefitsSel((prev) =>
                        on ? [...prev, b.id] : prev.filter((x) => x !== b.id),
                      );
                    }}
                    className="border-input accent-primary size-4 shrink-0 rounded border"
                  />
                  {b.label}
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Дополнительные преимущества</Label>
              <Textarea
                value={benefitsExtra}
                onChange={(e) => {
                  markUserEditedForm();
                  setBenefitsExtra(e.target.value);
                }}
                rows={2}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pc-subtitle">Подзаголовок на карточке (необязательно)</Label>
              <Input
                id="pc-subtitle"
                value={subtitle}
                onChange={(e) => {
                  markUserEditedForm();
                  setSubtitle(e.target.value);
                }}
                maxLength={300}
                className="rounded-xl"
                placeholder="Короткая подпись"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pc-dimensions">Размеры / характеристики для слайда (необязательно)</Label>
              <Textarea
                id="pc-dimensions"
                value={dimensionsUser}
                onChange={(e) => {
                  markUserEditedForm();
                  setDimensionsUser(e.target.value);
                }}
                rows={2}
                maxLength={500}
                className="rounded-xl"
                placeholder="Только то, что можно показать; не выдумывайте цифры"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pc-lang">Язык текста для подсказок модели</Label>
              <select
                id="pc-lang"
                className={nativeFieldClass}
                value={languageMode}
                onChange={(e) => {
                  markUserEditedForm();
                  setLanguageMode(e.target.value);
                }}
              >
                {CARD_BUILDER_LANGUAGE_MODES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
              <p className="text-muted-foreground text-xs leading-relaxed">
                AI может менять дизайн, плашки, иконки и стиль карточки, но мы просим сохранить ваш
                русский/казахский текст точно. После генерации обязательно проверьте текст перед публикацией.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Что обязательно показать</Label>
              <div className="flex flex-wrap gap-2">
                {CARD_BUILDER_MUST_SHOW.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={mustSel.includes(m.id)}
                      onChange={(e) => {
                        markUserEditedForm();
                        const on = e.target.checked;
                        setMustSel((prev) =>
                          on ? [...prev, m.id] : prev.filter((x) => x !== m.id),
                        );
                      }}
                      className="border-input accent-primary size-4 shrink-0 rounded border"
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border">
          <CardHeader>
            <CardTitle className="text-base">Аудитория и стиль</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pc-audience">Для кого товар</Label>
              <select
                id="pc-audience"
                className={nativeFieldClass}
                value={audience}
                onChange={(e) => {
                  markUserEditedForm();
                  setAudience(e.target.value);
                }}
              >
                {CARD_BUILDER_AUDIENCES.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pc-price-segment">Ценовой сегмент</Label>
              <select
                id="pc-price-segment"
                className={nativeFieldClass}
                value={priceSegment}
                onChange={(e) => {
                  markUserEditedForm();
                  setPriceSegment(e.target.value);
                }}
              >
                {CARD_BUILDER_PRICE_SEGMENTS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pc-sales-style">Стиль продаж</Label>
              <select
                id="pc-sales-style"
                className={nativeFieldClass}
                value={salesStyle}
                onChange={(e) => {
                  markUserEditedForm();
                  setSalesStyle(e.target.value);
                }}
              >
                {CARD_BUILDER_SALES_STYLES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pc-text-density">Текст на изображении</Label>
              <select
                id="pc-text-density"
                className={nativeFieldClass}
                value={effectiveTextDensity}
                onChange={(e) => {
                  markUserEditedForm();
                  setDensityStash({ key: densityRecoKey, value: e.target.value });
                }}
              >
                {densityChoices.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            {effectiveGoal === "main_photo" && selProfile && !selProfile.mainPhotoTextAllowed ? (
              <div className="sm:col-span-2">
                <Alert>
                  <AlertTitle>Главное фото без текста</AlertTitle>
                  <AlertDescription>
                    Для главного фото этой площадки лучше не использовать текст на кадре. Подпись и акценты
                    удобнее вынести на слайд «Преимущества».
                  </AlertDescription>
                </Alert>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="rounded-xl"
            disabled={!canWork || planLoading}
            onClick={() => void runPlan()}
          >
            {planLoading ? "Сохранение…" : "Сгенерировать структуру"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={!canWork || estimating}
            onClick={() => void runEstimate("single_slide")}
          >
            Оценить один слайд
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={!canWork || estimating || slides.length === 0}
            onClick={() => void runEstimate("full_gallery")}
          >
            Оценить всю галерею
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          {estimateSingle != null && (
            <span className="tabular-nums">Один слайд ≈ {estimateSingle} ток.</span>
          )}
          {estimateGallery != null && slides.length > 1 && (
            <span className="tabular-nums">Вся галерея ≈ {estimateGallery} ток.</span>
          )}
          <span className="tabular-nums text-foreground">
            Баланс: {balanceCredits}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="rounded-xl"
            disabled={!canWork || !activeSlideId || batchBusy || genBusy}
            onClick={() => activeSlideId && void generateOne(activeSlideId)}
          >
            {genBusy ? "Запуск…" : "Сгенерировать выбранный слайд"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="rounded-xl"
            disabled={!canWork || slides.length === 0 || batchBusy || genBusy}
            onClick={() => void generateAll()}
          >
            {batchBusy ? "Генерация галереи…" : "Сгенерировать все слайды"}
          </Button>
        </div>

        {genHistory.length ? (
          <Card className="rounded-2xl border-border">
            <CardHeader>
              <CardTitle className="text-base">Создать карточку — ранее в проекте</CardTitle>
              <CardDescription>Отдельно от карточки маркетплейса и других сценариев</CardDescription>
            </CardHeader>
            <CardContent className="max-h-64 space-y-2 overflow-y-auto text-sm">
              {[...genHistory].reverse().map((g) => {
                const title =
                  slides.find((s) => s.slideId === g.slideId)?.title ?? g.slideId.replace(/_/g, " ");
                return (
                  <div
                    key={`${g.generationId}-${g.createdAt ?? ""}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                  >
                    <div>
                      <div className="font-medium">{title}</div>
                      <div className="text-muted-foreground text-xs">
                        {g.createdAt
                          ? new Date(g.createdAt).toLocaleString("ru-RU", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "—"}
                        {g.status ? (
                          <>
                            {" "}
                            · {slideProgressLabel(g.status)}
                          </>
                        ) : null}
                      </div>
                      {g.errorMessage ? (
                        <p className="text-destructive mt-1 max-w-[min(28rem,88vw)] text-[11px] leading-snug">
                          {g.errorMessage}
                        </p>
                      ) : null}
                    </div>
                    <Link
                      href={`/dashboard/history/${g.generationId}`}
                      className="text-primary text-xs font-medium underline"
                    >
                      Открыть
                    </Link>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="lg:sticky lg:top-24 space-y-3">
        <Card className="rounded-2xl border-primary/30 bg-gradient-to-b from-[#e8f8fb] to-white">
          <CardHeader>
            <CardTitle className="text-base">Предпросмотр галереи</CardTitle>
            <CardDescription>Порядок и статус слайдов</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {slides.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                После нажатия «Сгенерировать структуру» здесь появится план из 6–8 кадров.
              </p>
            ) : (
              slides.map((s) => {
                const st = slideGen[s.slideId]?.status ?? "не сгенерировано";
                const url = slideGen[s.slideId]?.url;
                const active = activeSlideId === s.slideId;
                const tplOptions = listTemplatesForSlideRole(s.imageRole as CardBuilderTemplateSlideRole);
                const tplBusy = tplBusySlideId === s.slideId;
                return (
                  <div
                    key={s.slideId}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveSlideId(s.slideId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setActiveSlideId(s.slideId);
                    }}
                    className={cn(
                      "cursor-pointer rounded-xl border p-3 transition-colors",
                      active ? "border-primary bg-primary/5" : "border-border bg-white",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm">{s.title}</div>
                        {s.previewCaption ? (
                          <div className="text-muted-foreground mt-0.5 text-xs leading-snug">
                            {s.previewCaption}
                          </div>
                        ) : null}
                        <div className="text-muted-foreground mt-1 text-[11px]">
                          Статус: {slideProgressLabel(st)}
                        </div>
                        <div className="mt-2 space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Изменить шаблон</Label>
                          <select
                            className={`${nativeFieldClass} h-9 max-w-full text-xs`}
                            value={s.templateId ?? tplOptions[0]?.templateId ?? ""}
                            disabled={!canWork || tplBusy || tplOptions.length < 2}
                            aria-busy={tplBusy}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (!v || v === s.templateId) return;
                              void changeSlideTemplate(s.slideId, v);
                            }}
                          >
                            {tplOptions.map((t) => (
                              <option key={t.templateId} value={t.templateId}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-lg shrink-0 text-xs"
                        disabled={!canWork || genBusy || batchBusy}
                        onClick={(e) => {
                          e.stopPropagation();
                          void generateOne(s.slideId);
                        }}
                      >
                        Сгенерировать
                      </Button>
                    </div>
                    {url ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="max-h-40 rounded-lg border object-contain" />
                        <a href={url} download className="text-primary text-xs underline">
                          Скачать
                        </a>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
