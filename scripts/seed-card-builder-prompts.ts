/**
 * Сброс AppSetting PRODUCT_CARD_CARD_BUILDER_PROMPTS на defaults из кода (v2.2).
 * Запуск: npm run seed:card-builder-prompts
 */
import { CARD_BUILDER_PROMPTS_DEFAULTS } from "@/config/card-builder-prompts-defaults";
import { prisma } from "@/lib/prisma";
import { PRODUCT_CARD_CARD_BUILDER_PROMPTS_KEY } from "@/server/services/cardBuilderPromptsSettings";
import { clearCardBuilderPromptsSettingsCache } from "@/server/services/cardBuilderPromptsSettings";

async function main() {
  const key = PRODUCT_CARD_CARD_BUILDER_PROMPTS_KEY;
  const value = CARD_BUILDER_PROMPTS_DEFAULTS;

  await prisma.appSetting.upsert({
    where: { key },
    create: {
      key,
      type: "json",
      value: value as object,
      description: "Промпты card_builder (defaults из кода)",
    },
    update: {
      type: "json",
      value: value as object,
    },
  });

  clearCardBuilderPromptsSettingsCache();
  console.log(
    `[seed-card-builder-prompts] OK — ${key} → version ${value.version}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
