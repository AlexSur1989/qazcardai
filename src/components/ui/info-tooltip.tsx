"use client";

import * as React from "react";
import { Popover } from "@base-ui/react/popover";
import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

type Side = "top" | "bottom" | "left" | "right";
type Align = "start" | "center" | "end";

function popupClassName(body: React.ReactNode) {
  const text = typeof body === "string" ? body : "";
  const isLong = text.length > 42;

  return cn(
    "z-50 border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-900 shadow-md outline-none",
    "dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50",
    isLong
      ? "max-w-[320px] whitespace-normal rounded-xl text-xs leading-snug"
      : "whitespace-nowrap rounded-full",
  );
}

export type InfoTooltipProps = {
  content?: React.ReactNode;
  children?: React.ReactNode;
  side?: Side;
  align?: Align;
  className?: string;
  ariaLabel?: string;
};

/**
 * Компактная info-подсказка: hover/focus на desktop, tap на touch (Base UI Popover + Portal).
 */
export function InfoTooltip({
  content,
  children,
  side = "top",
  align = "center",
  className,
  ariaLabel,
}: InfoTooltipProps) {
  const body = content ?? children;
  const label =
    ariaLabel ?? (typeof body === "string" ? body : "Подробнее");

  return (
    <Popover.Root modal={false}>
      <Popover.Trigger
        openOnHover
        delay={150}
        closeDelay={80}
        type="button"
        aria-label={label}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full text-neutral-400 transition-colors",
          "hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          "dark:text-neutral-500 dark:hover:text-neutral-200",
          className,
        )}
      >
        <Info className="size-3.5" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
        >
          <Popover.Popup
            role="tooltip"
            initialFocus={false}
            finalFocus={false}
            className={popupClassName(body)}
          >
            <Popover.Description className="m-0 font-[inherit] text-[inherit]">
              {body}
            </Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function LabelWithInfoTooltip({
  label,
  tooltip,
  side,
  align,
}: {
  label: React.ReactNode;
  tooltip: React.ReactNode;
  side?: Side;
  align?: Align;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
      <InfoTooltip content={tooltip} side={side} align={align} />
    </span>
  );
}
