/**
 * verify:kie-payloads — реестр пуст, проверки пропущены.
 */
import { KIE_GENERAL_MODEL_DEFINITIONS } from "@/server/kie/kie-general-model-definitions";

async function main() {
  if (KIE_GENERAL_MODEL_DEFINITIONS.length === 0) {
    console.log(
      "[verify:kie-payloads] SKIP — каталог Kie-моделей пуст (режим пересборки).",
    );
    return;
  }
  throw new Error(
    "verify:kie-payloads: добавьте проверки при восстановлении каталога.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
