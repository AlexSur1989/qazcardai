"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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
  const isBanner = width > height * 1.2;
  const containerMax = isStory ? 200 : isBanner ? 420 : 320;
  return (
    <div className="space-y-2">
      <Label className="text-[#0C2D38]">Превью шаблона</Label>
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-2xl border border-[#B8DCE6]",
          "bg-[radial-gradient(circle_at_72%_45%,rgba(0,175,202,0.18),transparent_28%),linear-gradient(135deg,#f8fdff_0%,#eaf8fb_48%,#dff2f6_100%)] shadow-sm",
        )}
        style={{
          aspectRatio: `${width} / ${height}`,
          maxWidth: containerMax,
        }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-80">
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
        <div className="absolute inset-0 flex items-center justify-center p-1">
          <div
            className={cn(
              "h-full w-full [&>svg]:block [&>svg]:max-h-full [&>svg]:max-w-full [&>svg]:object-contain",
            )}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      </div>
      <p className="text-xs text-[#4a6e7a]">
        {label}: схема зон товара, заголовка, подзаголовка, преимуществ и нижних бейджей (в готовой карточе пунктирные
        направляющие скрыты).
      </p>
    </div>
  );
}
