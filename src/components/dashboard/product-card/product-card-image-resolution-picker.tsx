"use client";

import { Label } from "@/components/ui/label";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import {
  isProductCardImageResolutionAllowed,
  PRODUCT_CARD_IMAGE_RESOLUTIONS,
  type ProductCardImageResolution,
} from "@/config/product-card-image-resolution";
import { cn } from "@/lib/utils";

type Props = {
  value: ProductCardImageResolution;
  onChange: (value: ProductCardImageResolution) => void;
  aspectRatio?: string;
  disabled?: boolean;
  id?: string;
};

export function ProductCardImageResolutionPicker({
  value,
  onChange,
  aspectRatio = "1:1",
  disabled = false,
  id,
}: Props) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="inline-flex items-center gap-1 text-[#0C2D38]">
        Разрешение изображения
        <InfoTooltip content="Выбирайте стандартное качество для тестов и высокое качество для финальных материалов. Чем выше качество, тем выше стоимость." />
      </Label>
      <div className="flex flex-wrap gap-2" id={id}>
        {PRODUCT_CARD_IMAGE_RESOLUTIONS.map((res) => {
          const blocked = !isProductCardImageResolutionAllowed(res, aspectRatio);
          return (
            <button
              key={res}
              type="button"
              disabled={disabled || blocked}
              title={blocked ? "Для формата 1:1 недоступно 4K" : undefined}
              onClick={() => onChange(res)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition",
                value === res
                  ? "border-[#00AFCA] bg-[#e8f8fb] text-[#006b82]"
                  : "border-[#B8DCE6] bg-white text-[#0C2D38]",
                (disabled || blocked) && "cursor-not-allowed opacity-50",
              )}
            >
              {res}
            </button>
          );
        })}
      </div>
    </div>
  );
}
