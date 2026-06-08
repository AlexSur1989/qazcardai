/** Минимальная проверка: пользователь указал хотя бы 2–3 факта о товаре. */
export function hasEnoughProductBenefits(userText: string): boolean {
  const t = userText.trim();
  if (t.length < 8) return false;

  const segments = t
    .split(/[,;\n·•]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length >= 2) return true;

  const words = t.split(/\s+/).filter(Boolean);
  return words.length >= 4;
}

export const SIMPLE_CARD_BENEFITS_REQUIRED_MESSAGE =
  "Добавьте хотя бы 2–3 характеристики или преимущества товара.";
