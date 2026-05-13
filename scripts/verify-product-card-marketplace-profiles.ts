/**
 * Проверка профилей маркетплейсов «Создать карточку».
 * Запуск: npm run verify:product-card-marketplace-profiles
 */
import { CARD_BUILDER_MARKETPLACES } from "@/config/card-builder-config";
import {
  PRODUCT_CARD_MARKETPLACE_PROFILES_DEFAULTS,
  type ProductCardMarketplaceProfile,
} from "@/config/product-card-marketplace-profiles";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const STRICT_NO_MAIN_TEXT = new Set([
  "kaspi",
  "halyk_market",
  "lamoda",
  "wildberries",
  "ozon",
  "yandex_market",
  "amazon",
]);

function checkProfile(p: ProductCardMarketplaceProfile, label: string) {
  assert(p.id.trim().length > 0, `${label}: id`);
  assert(p.label.trim().length > 0, `${label}: label`);
  assert(p.defaultAspectRatio.trim().length > 0, `${label}: defaultAspectRatio`);
  assert(p.defaultSize.trim().length > 0, `${label}: defaultSize`);
  assert(p.mainPhotoRules?.promptInstruction?.trim(), `${label}: mainPhotoRules.promptInstruction`);
  assert(p.infographicRules?.promptInstruction?.trim(), `${label}: infographicRules.promptInstruction`);
  assert(p.lifestyleRules?.promptInstruction?.trim(), `${label}: lifestyleRules.promptInstruction`);
  assert(p.promptInstruction?.trim(), `${label}: promptInstruction`);
  assert(p.userHint?.trim(), `${label}: userHint`);
  assert(typeof p.mainPhotoTextAllowed === "boolean", `${label}: mainPhotoTextAllowed`);
  assert(Number.isFinite(p.maxBenefitBadges) && p.maxBenefitBadges >= 0, `${label}: maxBenefitBadges`);
  assert(p.sourceLevel, `${label}: sourceLevel`);
  assert(Array.isArray(p.allowedSlideTypes) && p.allowedSlideTypes.length > 0, `${label}: allowedSlideTypes`);
  assert(Array.isArray(p.recommendedSlides) && p.recommendedSlides.length > 0, `${label}: recommendedSlides`);

  if (STRICT_NO_MAIN_TEXT.has(p.id)) {
    assert(
      p.mainPhotoTextAllowed === false,
      `${label}: маркетплейсы строго без текста на main — mainPhotoTextAllowed=false`,
    );
    assert(
      p.mainPhotoRules.textAllowed === false,
      `${label}: mainPhotoRules.textAllowed=false для строгого списка`,
    );
  }
}

const defaults = PRODUCT_CARD_MARKETPLACE_PROFILES_DEFAULTS;
assert(defaults.length === 13, `Ожидается 13 профилей, получено ${defaults.length}`);

const uiIds = new Set<string>(CARD_BUILDER_MARKETPLACES.map((m) => m.id));
const defaultIds = new Set<string>(defaults.map((p) => p.id));
for (const id of uiIds) {
  assert(defaultIds.has(id), `Нет профиля для маркетплейса из UI: ${id}`);
}
for (const id of defaultIds) {
  assert(uiIds.has(id), `Лишний id профиля вне UI CARD_BUILDER_MARKETPLACES: ${id}`);
}

for (const p of defaults) {
  checkProfile(p, p.id);
}

const socialText = defaults.filter((p) => p.id === "instagram_vk" || p.id === "own_site");
for (const p of socialText) {
  assert(p.mainPhotoTextAllowed === true, `${p.id}: social/свой сайт допускает текст на главном`);
}

console.log("[verify-product-card-marketplace-profiles] OK");
