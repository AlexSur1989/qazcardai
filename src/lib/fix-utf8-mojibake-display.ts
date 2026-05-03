import "server-only";

/**
 * Восстанавливает типичный mojibake: байты UTF-8 были прочитаны как Latin-1
 * (в UI ошибок — «РЎР°Р№С‚» вместо «Сайт»).
 */
export function fixUtf8MojibakeDisplay(text: string | null | undefined): string | null {
  if (text == null || text.length === 0) return text;

  let recovered: string;
  try {
    recovered = Buffer.from(text, "latin1").toString("utf8");
  } catch {
    return text;
  }

  if (recovered === text) return text;

  const hasMojibakeLatinCyrillicMix =
    /РЎР°Р№|РїРѕРґ|РЅР°РіСЂ|РїРѕРїСЂРѕР±|РўР°Р№Рј|РѕС€РёР±Рє/i.test(text);

  const recoveredOk =
    /[А-Яа-яЁё]{3,}/u.test(recovered) && !/\uFFFD/u.test(recovered);

  if (hasMojibakeLatinCyrillicMix && recoveredOk) {
    return recovered;
  }

  return text;
}
