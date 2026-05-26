/** Параметры сжатия исходника карточки товара перед upload. */
export const PRODUCT_CARD_IMAGE_MAX_EDGE_PX = 2048;
export const PRODUCT_CARD_IMAGE_SKIP_BELOW_BYTES = 500 * 1024;
export const PRODUCT_CARD_IMAGE_TARGET_MAX_BYTES = 1.5 * 1024 * 1024;
export const PRODUCT_CARD_IMAGE_JPEG_QUALITY = 0.85;

export type CompressProductCardImageResult = {
  file: File;
  originalSize: number;
  compressedSize: number;
  wasCompressed: boolean;
};

function replaceExtension(name: string, ext: string): string {
  const base = name.replace(/\.[^.]+$/, "") || "photo";
  return `${base}.${ext}`;
}

function loadBitmap(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

function scaledSize(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

async function encodeCanvas(
  canvas: HTMLCanvasElement,
  baseName: string,
): Promise<File | null> {
  const attempts: Array<{ type: string; ext: string; quality?: number }> = [
    { type: "image/webp", ext: "webp", quality: PRODUCT_CARD_IMAGE_JPEG_QUALITY },
    { type: "image/jpeg", ext: "jpg", quality: PRODUCT_CARD_IMAGE_JPEG_QUALITY },
  ];

  for (const attempt of attempts) {
    let quality = attempt.quality ?? PRODUCT_CARD_IMAGE_JPEG_QUALITY;
    for (let step = 0; step < 4; step += 1) {
      const blob = await canvasToBlob(canvas, attempt.type, quality);
      if (!blob) continue;
      if (blob.size <= PRODUCT_CARD_IMAGE_TARGET_MAX_BYTES || step === 3) {
        return new File([blob], replaceExtension(baseName, attempt.ext), {
          type: attempt.type,
          lastModified: Date.now(),
        });
      }
      quality = Math.max(0.55, quality - 0.1);
    }
  }
  return null;
}

/**
 * Уменьшает фото перед POST /api/uploads: max 2048px, WebP/JPEG ~85%.
 * Маленькие файлы (< 500 KB и уже в пределах max edge) не трогаем.
 */
export async function compressProductCardImage(
  file: File,
): Promise<CompressProductCardImageResult> {
  const originalSize = file.size;

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await loadBitmap(file);
  } catch {
    return { file, originalSize, compressedSize: originalSize, wasCompressed: false };
  }

  try {
    const { width, height } = scaledSize(
      bitmap.width,
      bitmap.height,
      PRODUCT_CARD_IMAGE_MAX_EDGE_PX,
    );
    const withinLimits =
      originalSize <= PRODUCT_CARD_IMAGE_SKIP_BELOW_BYTES &&
      bitmap.width <= PRODUCT_CARD_IMAGE_MAX_EDGE_PX &&
      bitmap.height <= PRODUCT_CARD_IMAGE_MAX_EDGE_PX;

    if (withinLimits) {
      return { file, originalSize, compressedSize: originalSize, wasCompressed: false };
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return { file, originalSize, compressedSize: originalSize, wasCompressed: false };
    }
    ctx.drawImage(bitmap, 0, 0, width, height);

    const encoded = await encodeCanvas(canvas, file.name);
    if (!encoded) {
      return { file, originalSize, compressedSize: originalSize, wasCompressed: false };
    }

    if (encoded.size >= originalSize) {
      return { file, originalSize, compressedSize: originalSize, wasCompressed: false };
    }

    return {
      file: encoded,
      originalSize,
      compressedSize: encoded.size,
      wasCompressed: true,
    };
  } finally {
    bitmap.close();
  }
}
