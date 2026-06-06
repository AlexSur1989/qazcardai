/**
 * Полный упорядоченный whitelist активных GENERAL Kie-моделей (phase1 + HappyHorse).
 * verify и archive опираются на этот порядок.
 */

import { KIE_GENERAL_MODEL_DEFINITION_SLUG_ORDER } from "@/server/kie/kie-general-model-definitions";

export const KIE_GENERAL_ACTIVE_SLUG_ORDER = [
  ...KIE_GENERAL_MODEL_DEFINITION_SLUG_ORDER,
] as const;

export type KieGeneralActiveSlug = string;
