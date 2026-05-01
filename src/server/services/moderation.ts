/**
 * Сервис модерации prompt до вызова Kie.ai.
 * Реализация в `moderation-internal/`, здесь публичный реэкспорт (файл по спецификации).
 */
export {
  moderateGenerationInput,
  type ModerationInput,
} from "./moderation-internal/moderate";
export {
  getModerationConfig,
  getFullModerationConfig,
  clearModerationConfigCache,
} from "./moderation-internal/config";
export type {
  LoadedModerationConfig,
  FullModerationConfig,
} from "./moderation-internal/config";
export { MODERATION_USER_MESSAGE } from "./moderation-internal/user-message";
export type { ModerationResult, ModerationRule } from "./moderation-internal/types";
