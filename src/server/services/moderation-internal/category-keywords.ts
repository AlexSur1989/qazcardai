/**
 * Базовые списки для MVP. Проверка: подстрока в lowercased text (как запрещённые слова).
 * Расширяйте через AppSetting, не копируя весь зоопарк внешних API.
 */
export const NSFW_KEYWORD_FRAGMENTS: string[] = [
  "nsfw",
  "nude",
  "naked",
  "porn",
  "porno",
  "hentai",
  "xxx",
  "blow job",
  "blowjob",
  "fellatio",
  "cunnilingus",
  "порно",
  "порнография",
  "эрот",
  "сексуальн",
  "sexual intercourse",
];

export const DEEPFAKE_KEYWORD_FRAGMENTS: string[] = [
  "deepfake",
  "deep fake",
  "faceswap",
  "face swap",
  "impersonate",
  "imitate real person",
  "fake celebrity",
  "imitate a real",
  "дипфейк",
  "заменить лицо",
  "заменой лица",
];

export const MINORS_UNSAFE_KEYWORD_FRAGMENTS: string[] = [
  "child porn",
  "cp photo",
  "loli hent",
  "shota",
  "underage nude",
  "minor porn",
  "kid porn",
  "порно с несоверш",
  "порнография с несоверш",
  "sexual with minor",
];

export const ILLEGAL_KEYWORD_FRAGMENTS: string[] = [
  "bomb how to",
  "how to make a bomb",
  "terrorist att",
  "kill the president",
  "murder for hire",
  "hitman for hire",
  "human trafficking",
  "money laundering",
  "counterfeit mone", // short prefix
  "synthetic drugs",
  "cooking meth",
];
