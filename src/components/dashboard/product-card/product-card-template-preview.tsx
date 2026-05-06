"use client";

import { Label } from "@/components/ui/label";

export type ProductCardTemplatePreviewProps = {
  svg: string | null;
  width: number;
  height: number;
  label: string;
};

export function ProductCardTemplatePreview({
  svg,
  width,
  height,
  label,
}: ProductCardTemplatePreviewProps) {
  if (!svg) return null;
  const isStory = height > width;
  const maxWidth = isStory ? 260 : 360;
  return (
    <div className="space-y-2">
      <Label className="text-[#0C2D38]">Превью шаблона</Label>
      <div
        className="relative overflow-hidden rounded-2xl border border-[#B8DCE6] bg-[radial-gradient(circle_at_72%_45%,rgba(0,175,202,0.18),transparent_28%),linear-gradient(135deg,#f8fdff_0%,#eaf8fb_48%,#dff2f6_100%)] shadow-sm"
        style={{ aspectRatio: `${width} / ${height}`, maxWidth }}
      >
        <div className="absolute inset-0 opacity-80">
          <div
            className="absolute rounded-[38%] bg-white/75 shadow-[0_24px_70px_rgba(12,45,56,0.16)] ring-1 ring-[#B8DCE6]/60"
            style={{
              width: isStory ? "46%" : "34%",
              height: isStory ? "34%" : "42%",
              left: isStory ? "48%" : "58%",
              top: isStory ? "34%" : "34%",
              transform: "translate(-50%, -50%) rotate(-7deg)",
            }}
          />
          <div
            className="absolute rounded-full bg-[#0C2D38]/10 blur-md"
            style={{
              width: isStory ? "42%" : "36%",
              height: "5%",
              left: isStory ? "48%" : "63%",
              top: isStory ? "70%" : "76%",
              transform: "translateX(-50%)",
            }}
          />
        </div>
        <div
          className="absolute inset-0 h-full w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
      <p className="text-xs text-[#4a6e7a]">
        {label}: примерное расположение товара, текста, преимуществ, бейджей и callout-зон.
      </p>
    </div>
  );
}
