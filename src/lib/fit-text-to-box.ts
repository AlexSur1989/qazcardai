/**
 * Heuristic text fitting for SVG overlays (no DOM). Safe on server and client.
 * Supports RU/KZ extended Cyrillic (Ә Ғ Қ Ң Ө Ұ Ү Һ І …).
 */

export type TextBoxFitOptions = {
  maxWidth: number;
  /** Hard cap on wrapped lines */
  maxLines: number;
  /** Starting font size (px-ish); reduced until text fits */
  maxFontSize: number;
  minFontSize?: number;
  /** Line-height multiplier vs fontSize */
  lineHeightFactor?: number;
};

export type TextBoxFitResult = {
  fontSize: number;
  lines: string[];
  lineHeight: number;
  truncated: boolean;
};

/** Approximate character width multiplier at given fontSize. */
export function estimateCharWidth(ch: string, fontSize: number): number {
  if (!ch || !/\S/.test(ch)) return fontSize * 0.32;
  const c = [...ch][0] ?? "";
  if (/\s/.test(c)) return fontSize * 0.32;
  // Latin caps / digits slightly wider than lowercase
  if (/[A-Z0-9]/.test(c)) return fontSize * 0.62;
  // Cyrillic uppercase / Kazakh extended — treat wide
  if (/[А-ЯЁA-ZӘҒҚҢӨҰҮҺІ]/u.test(c)) return fontSize * 0.64;
  // General Cyrillic / Latin lower
  if (/[\u0400-\u04FF]/.test(c)) return fontSize * 0.58;
  return fontSize * 0.54;
}

export function estimateTextWidth(text: string, fontSize: number): number {
  return [...text].reduce((sum, ch) => sum + estimateCharWidth(ch, fontSize), 0);
}

/** Greedy wrap by approximate width */
export function wrapTextToLines(
  text: string,
  fontSize: number,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (estimateTextWidth(candidate, fontSize) <= maxWidth || !current) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);

  const truncated = lines.length >= maxLines && words.join(" ") !== lines.join(" ");
  if (lines.length === maxLines && truncated) {
    const lastIdx = lines.length - 1;
    const last = lines[lastIdx] ?? "";
    lines[lastIdx] = `${last.replace(/[.,;:!?\-–—]+$/, "")}…`;
  }
  return lines;
}

function verticalOverflow(lines: number, fontSize: number, lineHeight: number): number {
  return lines <= 0 ? 0 : fontSize + (lines - 1) * lineHeight;
}

/**
 * Pick the largest font size such that wrapped text stays within horizontal box
 * and approximate vertical envelope (derived from lines × line-height).
 */
export function fitTextToBox(
  text: string,
  box: { width: number; height?: number },
  options: TextBoxFitOptions,
): TextBoxFitResult {
  const minFs = Math.max(8, Math.floor(options.minFontSize ?? Math.max(10, options.maxFontSize * 0.42)));
  const lineHeightFactor = options.lineHeightFactor ?? 1.12;
  const raw = text.trim();
  if (!raw) {
    return {
      fontSize: options.maxFontSize,
      lines: [],
      lineHeight: Math.round(options.maxFontSize * lineHeightFactor),
      truncated: false,
    };
  }

  let fontSize = options.maxFontSize;
  while (fontSize >= minFs) {
    const lineHeight = Math.round(fontSize * lineHeightFactor);
    const lines = wrapTextToLines(raw, fontSize, options.maxWidth, options.maxLines);

    const fitsHorizontal = lines.every((line) => estimateTextWidth(line, fontSize) <= options.maxWidth);
    const approximateHeight =
      verticalOverflow(lines.length, fontSize, lineHeight) -
      Math.round(fontSize * (lineHeightFactor - 1) * 0.35);

    let fitsVertical = true;
    if (typeof box.height === "number" && box.height > 0 && lines.length >= options.maxLines) {
      fitsVertical = approximateHeight <= box.height || fontSize <= minFs;
    }

    if (fitsHorizontal && fitsVertical && lines.length > 0) {
      const truncated =
        raw.split(/\s+/).join(" ") !== lines.join(" ").replace(/…$/u, "").trim();
      return { fontSize, lines, lineHeight, truncated };
    }
    fontSize -= 1;
  }

  const lineHeight = Math.round(minFs * lineHeightFactor);
  const lines = wrapTextToLines(raw, minFs, options.maxWidth, options.maxLines);
  return { fontSize: minFs, lines, lineHeight, truncated: true };
}
