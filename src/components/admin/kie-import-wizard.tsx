"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";

import {
  createKieImportModelAction,
  type KieImportActionState,
} from "@/server/actions/kie-import-model";
import {
  detectFieldsFromKieInput,
  parseKiePayloadJson,
} from "@/lib/kie-import-wizard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const initial: KieImportActionState = null;

const STEPS = [
  "Основное",
  "Payload из docs",
  "Auto-detect",
  "Pricing",
  "Сохранение",
] as const;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Сохранение…" : "Создать модель (inactive)"}
    </Button>
  );
}

export function KieImportWizard() {
  const [step, setStep] = useState(0);
  const [state, formAction] = useActionState(createKieImportModelAction, initial);

  const [basics, setBasics] = useState({
    name: "",
    slug: "",
    scope: "PRODUCT_CARD",
    type: "IMAGE",
    productCardModelType: "PRODUCT_MARKETPLACE_CARD",
    apiModelId: "",
    endpoint: "/api/v1/jobs/createTask",
    statusEndpoint: "",
    docsUrl: "",
  });
  const [payloadJson, setPayloadJson] = useState("");
  const [payloadError, setPayloadError] = useState<string | null>(null);
  const [fixedCredits, setFixedCredits] = useState(10);

  const parsedPayload = useMemo(() => {
    if (!payloadJson.trim()) return null;
    return parseKiePayloadJson(payloadJson);
  }, [payloadJson]);

  const detected = useMemo(() => {
    if (!parsedPayload?.ok) return null;
    return detectFieldsFromKieInput(parsedPayload.input);
  }, [parsedPayload]);

  function validateStep(current: number): boolean {
    if (current === 0) {
      return Boolean(
        basics.name.trim() &&
          basics.slug.trim() &&
          basics.apiModelId.trim() &&
          (basics.scope !== "PRODUCT_CARD" || basics.productCardModelType),
      );
    }
    if (current === 1) {
      const r = parseKiePayloadJson(payloadJson);
      if (!r.ok) {
        setPayloadError(r.error);
        return false;
      }
      setPayloadError(null);
      return true;
    }
    return true;
  }

  function nextStep() {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  return (
    <form action={formAction} className="max-w-3xl space-y-6">
      <input type="hidden" name="name" value={basics.name} />
      <input type="hidden" name="slug" value={basics.slug} />
      <input type="hidden" name="scope" value={basics.scope} />
      <input type="hidden" name="type" value={basics.type} />
      <input type="hidden" name="productCardModelType" value={basics.productCardModelType} />
      <input type="hidden" name="apiModelId" value={basics.apiModelId} />
      <input type="hidden" name="endpoint" value={basics.endpoint} />
      <input type="hidden" name="statusEndpoint" value={basics.statusEndpoint} />
      <input type="hidden" name="docsUrl" value={basics.docsUrl} />
      <input type="hidden" name="payloadJson" value={payloadJson} />
      <input type="hidden" name="fixedCredits" value={String(fixedCredits)} />

      {state?.error ? (
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <ol className="flex flex-wrap gap-2 text-xs">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={cn(
              "rounded-full border px-2.5 py-1",
              i === step ? "border-primary bg-primary/10 font-medium" : "text-muted-foreground",
            )}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="wiz-name">Название *</Label>
              <Input
                id="wiz-name"
                value={basics.name}
                onChange={(e) => setBasics((b) => ({ ...b, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wiz-slug">Slug *</Label>
              <Input
                id="wiz-slug"
                className="font-mono"
                value={basics.slug}
                onChange={(e) => setBasics((b) => ({ ...b, slug: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="wiz-scope">Scope</Label>
              <select
                id="wiz-scope"
                className="border-border bg-background h-8 w-full rounded-lg border px-2.5 text-sm"
                value={basics.scope}
                onChange={(e) => setBasics((b) => ({ ...b, scope: e.target.value }))}
              >
                <option value="PRODUCT_CARD">PRODUCT_CARD</option>
                <option value="GENERAL">GENERAL</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wiz-type">Type</Label>
              <select
                id="wiz-type"
                className="border-border bg-background h-8 w-full rounded-lg border px-2.5 text-sm"
                value={basics.type}
                onChange={(e) => setBasics((b) => ({ ...b, type: e.target.value }))}
              >
                <option value="IMAGE">IMAGE</option>
                <option value="VIDEO">VIDEO</option>
              </select>
            </div>
          </div>
          {basics.scope === "PRODUCT_CARD" && (
            <div className="space-y-1.5">
              <Label htmlFor="wiz-pc-type">Product Card роль *</Label>
              <select
                id="wiz-pc-type"
                className="border-border bg-background h-8 w-full rounded-lg border px-2.5 text-sm"
                value={basics.productCardModelType}
                onChange={(e) =>
                  setBasics((b) => ({ ...b, productCardModelType: e.target.value }))
                }
              >
                <option value="PRODUCT_CLASSIFIER">PRODUCT_CLASSIFIER</option>
                <option value="PRODUCT_CONCEPT_IMAGE">PRODUCT_CONCEPT_IMAGE</option>
                <option value="PRODUCT_MARKETPLACE_CARD">PRODUCT_MARKETPLACE_CARD</option>
                <option value="PRODUCT_VIDEO">PRODUCT_VIDEO</option>
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="wiz-api">Kie Model ID *</Label>
            <Input
              id="wiz-api"
              className="font-mono"
              value={basics.apiModelId}
              onChange={(e) => setBasics((b) => ({ ...b, apiModelId: e.target.value }))}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="wiz-endpoint">Endpoint</Label>
              <Input
                id="wiz-endpoint"
                className="font-mono text-sm"
                value={basics.endpoint}
                onChange={(e) => setBasics((b) => ({ ...b, endpoint: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wiz-status">statusEndpoint</Label>
              <Input
                id="wiz-status"
                className="font-mono text-sm"
                value={basics.statusEndpoint}
                onChange={(e) =>
                  setBasics((b) => ({ ...b, statusEndpoint: e.target.value }))
                }
              />
            </div>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="space-y-3">
          <Label htmlFor="wiz-payload">JSON payload из docs.kie.ai *</Label>
          <Textarea
            id="wiz-payload"
            rows={16}
            className="font-mono text-xs"
            value={payloadJson}
            onChange={(e) => {
              setPayloadJson(e.target.value);
              setPayloadError(null);
            }}
            placeholder='{"model":"...","input":{"prompt":"..."}}'
          />
          {payloadError ? (
            <p className="text-destructive text-sm">{payloadError}</p>
          ) : null}
        </section>
      )}

      {step === 2 && detected && (
        <section className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Обнаружено полей в input: {detected.detectedFields.join(", ") || "—"}
          </p>
          <pre className="max-h-64 overflow-auto rounded-md border p-3 font-mono text-xs">
            {JSON.stringify(detected.settingsSchema, null, 2)}
          </pre>
          <pre className="max-h-64 overflow-auto rounded-md border p-3 font-mono text-xs">
            {JSON.stringify(detected.payloadMapping, null, 2)}
          </pre>
          <p className="text-xs">
            supportsImageInput: {String(detected.supportsImageInput)} · supportsSeed:{" "}
            {String(detected.supportsSeed)}
          </p>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="wiz-credits">Fixed credits (токены)</Label>
            <Input
              id="wiz-credits"
              type="number"
              min={0}
              value={fixedCredits}
              onChange={(e) => setFixedCredits(Number(e.target.value) || 0)}
            />
          </div>
          <pre className="rounded-md border p-3 font-mono text-xs">
            {JSON.stringify({ type: "fixed", credits: fixedCredits }, null, 2)}
          </pre>
        </section>
      )}

      {step === 4 && (
        <section className="space-y-2 text-sm">
          <p>
            Будет создана модель <strong>{basics.name || "—"}</strong> ({basics.slug || "—"}),
            inactive, isPublic=false.
          </p>
          <p className="text-muted-foreground text-xs">
            После создания: проверьте в edit → Тест модели → активируйте → назначьте в
            Product Card admin.
          </p>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={nextStep}>
            Далее
          </Button>
        ) : (
          <SubmitButton />
        )}
        {step > 0 ? (
          <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
            Назад
          </Button>
        ) : null}
        <Link href="/admin/models" className={cn(buttonVariants({ variant: "ghost" }))}>
          Отмена
        </Link>
      </div>
    </form>
  );
}
