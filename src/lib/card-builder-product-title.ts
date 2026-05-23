/**
 * Единый источник заголовка товара для preview, prompt и metadata card_builder.
 */
export type CardBuilderProductTitleInput = {
  settingsProductTitle?: string | null;
  productNameGuess?: string | null;
  projectTitle?: string | null;
};

export function computeCardBuilderProductTitle(input: CardBuilderProductTitleInput): string {
  const fromSettings = input.settingsProductTitle?.trim();
  if (fromSettings) return fromSettings;

  const fromGuess = input.productNameGuess?.trim();
  if (fromGuess) return fromGuess;

  const fromProject = input.projectTitle?.trim();
  if (fromProject) return fromProject;

  return "Товар";
}
