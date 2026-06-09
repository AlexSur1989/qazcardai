"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { getProductCategoryById, type ProductCategoryId } from "@/config/product-card-categories";
import { readJsonSafe } from "@/lib/fetch-json-safe";
import {
  benefitsToUserText,
  type ProductClassifierResult,
} from "@/lib/product-classifier-result";

import type { SourceImageValue } from "./source-image-upload";
import type {
  ProductSourceImageValue,
  SourceImageRole,
  SourceImagesValue,
} from "./source-images-upload";

const STORAGE_KEY = "productCardProjectId";

export type ProjectApiRow = {
  id: string;
  sourceImageUrl: string | null;
  sourceImageFileId: string | null;
  sourceImages?: Array<{
    fileId?: string | null;
    url?: string | null;
    role?: string | null;
    order?: number | null;
  }> | null;
  selectedCategory: string | null;
  detectedCategory: string | null;
  categorySource: string | null;
  classificationConfidence: number | null;
  classificationReason: string | null;
  status: string;
  title?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type CategorySourceUi = "ai" | "manual" | "mock" | null;

export type ClassifyInfo = {
  confidence: number;
  reason: string;
  provider: string;
  model?: string;
  label?: string;
  classifierFailed?: boolean;
} | null;

/** П.7: этап классификации (кроме `loading` дублирует факт из classifyInfo) */
export type ClassifyFlowState = "not_started" | "loading" | "success" | "error";

function mapSourceFromApi(p: ProjectApiRow, prevFileName?: string): SourceImageValue {
  const u = p.sourceImageUrl?.trim() ?? "";
  if (!u) return null;
  return {
    url: u,
    fileName: prevFileName ?? "Исходное фото",
    size: 0,
    fileId: p.sourceImageFileId ?? undefined,
    isLocalPreview: false,
  };
}

function isSourceImageRole(value: unknown): value is SourceImageRole {
  return value === "main" || value === "side" || value === "back" || value === "detail";
}

function mapSourceImagesFromApi(
  p: ProjectApiRow,
  prev: SourceImagesValue,
): SourceImagesValue {
  const mapped =
    Array.isArray(p.sourceImages)
      ? p.sourceImages
          .map((img): ProductSourceImageValue | null => {
            const url = typeof img.url === "string" ? img.url.trim() : "";
            if (!url || !isSourceImageRole(img.role) || typeof img.order !== "number") {
              return null;
            }
            const previous = prev.find(
              (x) => x.fileId === img.fileId || x.url === url || x.role === img.role,
            );
            return {
              url,
              fileName: previous?.fileName ?? (img.role === "main" ? "Главное фото" : "Фото товара"),
              size: previous?.size ?? 0,
              fileId: typeof img.fileId === "string" ? img.fileId : undefined,
              role: img.role,
              order: img.order,
              isLocalPreview: false,
            };
          })
          .filter((x): x is ProductSourceImageValue => x != null)
          .sort((a, b) => a.order - b.order)
      : [];
  if (mapped.length > 0 && mapped[0]?.role === "main") {
    return mapped;
  }

  const single = mapSourceFromApi(p, prev[0]?.fileName);
  return single
    ? [
        {
          ...single,
          role: "main",
          order: 0,
        },
      ]
    : [];
}

function categorySourceToUi(s: string | null | undefined): CategorySourceUi {
  if (s === "ai" || s === "manual" || s === "mock") return s;
  return null;
}

function categoryIdOrNull(s: string | null | undefined): ProductCategoryId | null {
  if (!s) return null;
  return s as ProductCategoryId;
}

function unwrapProject(
  d: { project?: ProjectApiRow; error?: string } | ProjectApiRow,
): ProjectApiRow | null {
  if (d && typeof d === "object" && "project" in d && d.project) {
    return d.project;
  }
  if (d && typeof d === "object" && "id" in d && typeof (d as ProjectApiRow).id === "string") {
    return d as ProjectApiRow;
  }
  return null;
}

export type ClassifierPrefillPayload = {
  productTitle: string;
  benefitsText: string;
};

export type ClassifierPrefill = ClassifierPrefillPayload & {
  appliedAt: number;
} | null;

export function useProductCardProject(options?: { classifierDevMock?: string | null }) {
  const classifierDevMock = options?.classifierDevMock?.trim() || null;
  const [projectId, setProjectId] = useState<string | null>(null);
  const [source, setSourceState] = useState<SourceImageValue>(null);
  const [sourceImages, setSourceImagesState] = useState<SourceImagesValue>([]);
  const [selectedCategory, setSelectedCategory] = useState<ProductCategoryId | null>(null);
  const [categorySource, setCategorySource] = useState<CategorySourceUi>(null);
  const [classifyInfo, setClassifyInfo] = useState<ClassifyInfo>(null);
  const [classifyFlow, setClassifyFlow] = useState<ClassifyFlowState>("not_started");
  const [classifyError, setClassifyError] = useState<string | null>(null);
  const [pendingClassifierResult, setPendingClassifierResult] =
    useState<ProductClassifierResult | null>(null);
  const [showClassifierResult, setShowClassifierResult] = useState(false);
  const simpleCardPrefillHandlerRef = useRef<
    ((payload: ClassifierPrefillPayload) => void) | null
  >(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [initDone, setInitDone] = useState(false);

  const clearSession = useCallback(() => {
    if (typeof window !== "undefined") sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const applyProjectRow = useCallback((p: ProjectApiRow) => {
    const nextSources = mapSourceImagesFromApi(p, []);
    setSourceImagesState(nextSources);
    setSourceState(nextSources[0] ?? null);
    setSelectedCategory(categoryIdOrNull(p.selectedCategory));
    setCategorySource(categorySourceToUi(p.categorySource));
    if (p.classificationConfidence != null && p.classificationReason != null) {
      const meta =
        p.metadata && typeof p.metadata === "object" && !Array.isArray(p.metadata)
          ? p.metadata
          : {};
      const storedProvider =
        typeof meta.classificationProvider === "string"
          ? meta.classificationProvider
          : null;
      const runFailed = meta.classificationRunFailed === true;
      const id = (p.detectedCategory ?? p.selectedCategory) as ProductCategoryId | null;
      setClassifyInfo({
        confidence: p.classificationConfidence,
        reason: p.classificationReason,
        provider:
          storedProvider ?? (p.categorySource === "ai" ? "ai" : "stored"),
        label: id ? getProductCategoryById(id)?.label : undefined,
        classifierFailed: runFailed,
      });
      setClassifyFlow("success");
      setClassifyError(null);
    } else {
      setClassifyInfo(null);
      setClassifyFlow("not_started");
    }
  }, []);

  const createEmptyProject = useCallback(async (): Promise<string | null> => {
    const res = await fetch("/api/product-card-projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const parsed = await readJsonSafe<{ project?: ProjectApiRow; error?: string }>(res);
    if (!parsed.ok) {
      setLoadError(parsed.message);
      return null;
    }
    if (!res.ok) {
      setLoadError(parsed.data.error ?? "Не удалось создать проект");
      return null;
    }
    const p = unwrapProject(parsed.data);
    if (!p?.id) {
      setLoadError("Сервер не вернул проект");
      return null;
    }
    sessionStorage.setItem(STORAGE_KEY, p.id);
    setProjectId(p.id);
    applyProjectRow(p);
    return p.id;
  }, [applyProjectRow]);

  const attachSourceImage = useCallback(
    async (pid: string, fileId: string, fileName: string) => {
      const res = await fetch(`/api/product-card-projects/${pid}/source-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      });
      const parsed = await readJsonSafe<{ project?: ProjectApiRow; error?: string }>(res);
      if (!parsed.ok) {
        toast.error(parsed.message);
        return;
      }
      if (!res.ok) {
        toast.error(parsed.data.error ?? "Не удалось привязать фото");
        return;
      }
      const p = unwrapProject(parsed.data);
      if (p) {
        const nextSources = mapSourceImagesFromApi(p, []);
        setSourceState({
          url: p.sourceImageUrl ?? "",
          fileName,
          size: 0,
          fileId: p.sourceImageFileId ?? fileId,
          isLocalPreview: false,
        });
        setSourceImagesState(nextSources);
        applyProjectRow(p);
      }
    },
    [applyProjectRow],
  );

  const persistSourceImages = useCallback(
    async (pid: string, images: SourceImagesValue) => {
      const payload = images.map((img) => ({
        fileId: img.fileId,
        role: img.role,
        order: img.order,
      }));
      const res = await fetch(`/api/product-card-projects/${pid}/source-images`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: payload }),
      });
      const parsed = await readJsonSafe<{ project?: ProjectApiRow; error?: string }>(res);
      if (!parsed.ok) {
        toast.error(parsed.message);
        return null;
      }
      if (!res.ok) {
        toast.error(parsed.data.error ?? "Не удалось сохранить фото товара");
        return null;
      }
      const p = unwrapProject(parsed.data);
      if (p) applyProjectRow(p);
      return p;
    },
    [applyProjectRow],
  );

  const loadProject = useCallback(
    async (id: string) => {
      setLoadError(null);
      let res: Response;
      try {
        res = await fetch(`/api/product-card-projects/${id}`);
      } catch {
        setLoadError("Нет сети. Повторите попытку.");
        return false;
      }
      const parsed = await readJsonSafe<{ project?: ProjectApiRow; error?: string }>(res);
      if (!parsed.ok) {
        setLoadError(parsed.message);
        return false;
      }
      if (res.status === 404) {
        clearSession();
        return false;
      }
      if (!res.ok) {
        setLoadError(parsed.data.error ?? "Не удалось загрузить проект");
        return false;
      }
      const p = unwrapProject(parsed.data);
      if (!p) {
        setLoadError("Некорректный ответ сервера");
        return false;
      }
      setProjectId(p.id);
      applyProjectRow(p);
      return true;
    },
    [applyProjectRow, clearSession],
  );

  const patchProject = useCallback(
    async (body: Record<string, unknown>) => {
      if (!projectId) return null;
      const res = await fetch(`/api/product-card-projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const parsed = await readJsonSafe<{ project?: ProjectApiRow; error?: string }>(res);
      if (!parsed.ok) {
        toast.error(parsed.message);
        return null;
      }
      if (!res.ok) {
        toast.error(parsed.data.error ?? "Ошибка сохранения");
        return null;
      }
      const p = unwrapProject(parsed.data);
      if (p) applyProjectRow(p);
      return p;
    },
    [applyProjectRow, projectId],
  );

  const onSourceChange = useCallback(
    async (v: SourceImageValue) => {
      if (!v) {
        setSourceState(null);
        setSourceImagesState([]);
        setProjectId(null);
        setSelectedCategory(null);
        setCategorySource(null);
        setClassifyInfo(null);
        setClassifyFlow("not_started");
        setClassifyError(null);
        clearSession();
        return;
      }
      setSourceState(v);
      setSourceImagesState([
        {
          ...v,
          role: "main",
          order: 0,
        },
      ]);
      if (v.isLocalPreview || !v.fileId) {
        if (projectId) {
          setProjectId(null);
          setSelectedCategory(null);
          setCategorySource(null);
          setClassifyInfo(null);
          setClassifyFlow("not_started");
          setClassifyError(null);
          clearSession();
        }
        return;
      }
      let pid = projectId;
      if (!pid) {
        const newId = await createEmptyProject();
        if (!newId) return;
        pid = newId;
      }
      await attachSourceImage(pid, v.fileId, v.fileName);
    },
    [attachSourceImage, clearSession, createEmptyProject, projectId],
  );

  const onSourceImagesChange = useCallback(
    async (nextImages: SourceImagesValue) => {
      const sorted = [...nextImages].sort((a, b) => a.order - b.order);
      const main = sorted[0] ?? null;
      setSourceImagesState(sorted);
      setSourceState(main);

      if (!main) {
        setProjectId(null);
        setSelectedCategory(null);
        setCategorySource(null);
        setClassifyInfo(null);
        setClassifyFlow("not_started");
        setClassifyError(null);
        clearSession();
        return;
      }
      if (sorted.some((img) => img.isLocalPreview || !img.fileId)) {
        return;
      }

      let pid = projectId;
      if (!pid) {
        const newId = await createEmptyProject();
        if (!newId) return;
        pid = newId;
      }
      await persistSourceImages(pid, sorted);
    },
    [clearSession, createEmptyProject, persistSourceImages, projectId],
  );

  const didHydrate = useRef(false);
  useEffect(() => {
    if (didHydrate.current) return;
    didHydrate.current = true;
    void (async () => {
      const id = sessionStorage.getItem(STORAGE_KEY);
      if (id) {
        const ok = await loadProject(id);
        if (!ok) {
          setProjectId(null);
          setSourceState(null);
          setSourceImagesState([]);
        }
      }
      setInitDone(true);
    })();
  }, [loadProject]);

  const runClassify = useCallback(async () => {
    if (!projectId) {
      toast.error("Нет проекта (загрузите фото на сервер)");
      return;
    }
    setClassifyFlow("loading");
    setClassifyError(null);
    setShowClassifierResult(false);
    try {
      const query = classifierDevMock ? `?classifierMock=${encodeURIComponent(classifierDevMock)}` : "";
      const res = await fetch(`/api/product-card-projects/${projectId}/classify${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(classifierDevMock ? { classifierMock: classifierDevMock } : {}),
      });
      const parsed = await readJsonSafe<{
        ok?: boolean;
        result?: ProductClassifierResult;
        error?: string;
        code?: string;
        billing?: { credits: number };
      }>(res);
      if (!parsed.ok) {
        setClassifyFlow("error");
        setClassifyError(parsed.message);
        toast.error(parsed.message);
        return;
      }
      const d = parsed.data;
      if (!res.ok || d.ok === false) {
        const msg = d.error ?? "Распознавание не удалось";
        setClassifyFlow("error");
        setClassifyError(msg);
        toast.error(msg);
        return;
      }
      if (!d.result) {
        setClassifyFlow("error");
        setClassifyError("Пустой ответ сервера");
        return;
      }
      setPendingClassifierResult(d.result);
      setShowClassifierResult(true);
      setClassifyFlow("success");
      setClassifyError(null);
      if (d.billing?.credits && d.billing.credits > 0) {
        toast.success(`Списано ${d.billing.credits} токен(ов) за распознавание`);
      }
    } catch {
      setClassifyFlow("error");
      setClassifyError("Сеть или сервер недоступен");
    }
  }, [classifierDevMock, projectId]);

  const applyClassifierResult = useCallback(async () => {
    if (!projectId || !pendingClassifierResult) return;
    const result = pendingClassifierResult;
    const benefitsText = benefitsToUserText(result.suggestedBenefits);
    await patchProject({
      title: result.productTitle.trim() || undefined,
      selectedCategory: result.category,
      categorySource: "ai",
      metadata: {
        classifierConfidence: result.confidence,
        classifierAppliedAt: new Date().toISOString(),
        classifierResult: result,
        marketplaceCard: {
          simpleCard: {
            settings: {
              productLabel: result.productTitle.trim(),
              userText: benefitsText,
            },
          },
        },
      },
    });
    setSelectedCategory(result.category);
    setCategorySource("ai");
    setClassifyInfo({
      confidence: result.confidence,
      reason: result.visibleProduct,
      provider: "ai",
      label: result.categoryLabel,
      classifierFailed: false,
    });
    simpleCardPrefillHandlerRef.current?.({
      productTitle: result.productTitle.trim(),
      benefitsText,
    });
    setShowClassifierResult(false);
    setPendingClassifierResult(null);
    toast.success("Данные применены");
  }, [patchProject, pendingClassifierResult, projectId]);

  const dismissClassifierResult = useCallback(() => {
    setShowClassifierResult(false);
    setPendingClassifierResult(null);
  }, []);

  const registerSimpleCardPrefillHandler = useCallback(
    (handler: ((payload: ClassifierPrefillPayload) => void) | null) => {
      simpleCardPrefillHandlerRef.current = handler;
    },
    [],
  );

  const setManualCategory = useCallback(
    (id: ProductCategoryId) => {
      setSelectedCategory(id);
      setCategorySource("manual");
      if (projectId) void patchProject({ selectedCategory: id, categorySource: "manual" });
    },
    [patchProject, projectId],
  );

  const reloadProject = useCallback(async () => {
    if (!projectId) return false;
    return loadProject(projectId);
  }, [loadProject, projectId]);

  const ensureProjectId = useCallback(async (): Promise<string | null> => {
    if (projectId) return projectId;
    return createEmptyProject();
  }, [projectId, createEmptyProject]);

  return {
    initDone,
    projectId,
    source,
    sourceImages,
    onSourceChange,
    onSourceImagesChange,
    loadError,
    setLoadError,
    selectedCategory,
    categorySource,
    classifyInfo,
    classifyFlow,
    classifyError,
    canUseBackend: Boolean(projectId && source && !source.isLocalPreview),
    ensureProjectId,
    classifyLoading: classifyFlow === "loading",
    runClassify,
    applyClassifierResult,
    dismissClassifierResult,
    pendingClassifierResult,
    showClassifierResult,
    registerSimpleCardPrefillHandler,
    classifierDevMockActive: Boolean(classifierDevMock),
    setManualCategory,
    reloadProject,
  };
}
