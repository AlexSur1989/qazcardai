import type { ModerationRule } from "./types";

/**
 * Проверка по подстрокам (набор очищается: trim, lower, пустые убираются).
 */
export function createBannedSubstringsRule(
  substrings: string[],
): ModerationRule {
  const list = substrings
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
  return {
    id: "banned_substrings",
    check(text: string) {
      for (const frag of list) {
        if (text.includes(frag)) {
          return frag;
        }
      }
      return null;
    },
  };
}
