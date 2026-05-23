import type { CardBuilderUniversalCategoryId } from "@/config/card-builder-universal";
import { parseUniversalCategoryId } from "@/config/card-builder-universal";

/** Категорийные negative rules для card_builder prompt. */
export function categoryNegativeRulesBlock(categoryKey: string | undefined): string {
  const parsed = parseUniversalCategoryId(categoryKey ?? "other");
  const key = (parsed === "auto" ? "other" : parsed) as Exclude<
    CardBuilderUniversalCategoryId,
    "auto"
  >;

  const blocks: Partial<Record<Exclude<CardBuilderUniversalCategoryId, "auto">, string>> = {
    beauty_care: [
      "Категория beauty_care:",
      "НЕ пиши medical claims: «лечит», «устраняет», «дерматологически доказано», «клинически подтверждено» — если пользователь не указал это в locked phrases.",
      "НЕ обещай лечебный или терапевтический эффект без текста пользователя.",
    ].join("\n"),
    food_drinks: [
      "Категория food_drinks:",
      "НЕ пиши health claims: «полезно», «органик», «без сахара», «низкокалорийный» — если пользователь не указал.",
      "Для БАДов и добавок НЕ обещай лечебный эффект без текста пользователя.",
    ].join("\n"),
    gadgets_tech: [
      "Категория gadgets_tech:",
      "НЕ выдумывай мощность, память, ёмкость батареи, гарантию, совместимость и технические характеристики.",
    ].join("\n"),
    kids_products: [
      "Категория kids_products:",
      "НЕ выдумывай возрастные ограничения, сертификаты безопасности, гипоаллергенность без текста пользователя.",
    ].join("\n"),
    auto_products: [
      "Категория auto_products:",
      "НЕ выдумывай совместимость с марками авто, гарантию, теххарактеристики без текста пользователя.",
    ].join("\n"),
    jewelry_accessories: [
      "Категория jewelry_accessories:",
      "НЕ выдумывай золото, серебро, бриллианты, натуральную кожу и драгоценные материалы без текста пользователя.",
    ].join("\n"),
  };

  const body = blocks[key];
  if (!body) return "";
  return ["=== CATEGORY_NEGATIVE_RULES ===", body].join("\n\n");
}
