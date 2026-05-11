"use client";

import { useMemo, useState } from "react";

import {
  CreateImageForm,
  type CreateImageFormModel,
} from "@/components/dashboard/create-image-form";
import {
  CreateVideoForm,
  type CreateVideoFormModel,
} from "@/components/dashboard/create-video-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FamilyImageMode = CreateImageFormModel & {
  kind: "IMAGE";
  modeLabel: string;
};

export type FamilyVideoMode = CreateVideoFormModel & {
  kind: "VIDEO";
  modeLabel: string;
};

type FamilyMode = FamilyImageMode | FamilyVideoMode;

type Props = {
  title: string;
  description: string;
  modes: FamilyMode[];
  balanceCredits: number;
  initialSlug?: string;
};

export function ModelFamilyGenerationHub({
  title,
  description,
  modes,
  balanceCredits,
  initialSlug,
}: Props) {
  const [activeSlug, setActiveSlug] = useState(() => {
    if (initialSlug && modes.some((m) => m.slug === initialSlug)) {
      return initialSlug;
    }
    return modes[0]?.slug ?? "";
  });

  const active = useMemo(
    () => modes.find((m) => m.slug === activeSlug) ?? modes[0],
    [activeSlug, modes],
  );

  if (!active) {
    return null;
  }

  return (
    <section
      id="model-family-playground"
      className="border-border rounded-2xl border bg-muted/25 p-5 shadow-inner md:p-6"
    >
      <div className="mb-6 space-y-1">
        <h2 className="text-lg font-semibold">Генерация {title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>

      <div className="mb-6 space-y-2">
        <p className="text-sm font-medium">Режим</p>
        <div className="flex flex-wrap gap-2">
          {modes.map((mode) => {
            const isOn = mode.slug === active.slug;
            return (
              <Button
                key={mode.slug}
                type="button"
                variant={isOn ? "default" : "outline"}
                className={cn("rounded-full", isOn && "shadow-sm")}
                onClick={() => setActiveSlug(mode.slug)}
              >
                {mode.modeLabel}
              </Button>
            );
          })}
        </div>
        {active.description ? (
          <p className="text-muted-foreground text-xs">{active.description}</p>
        ) : null}
      </div>

      {active.kind === "IMAGE" ? (
        <CreateImageForm
          key={active.id}
          soloModels={[active]}
          modelGroups={[]}
          balanceCredits={balanceCredits}
          hideModelSelect
        />
      ) : (
        <CreateVideoForm
          key={active.id}
          models={[active]}
          balanceCredits={balanceCredits}
          hideModelSelect
        />
      )}
    </section>
  );
}
