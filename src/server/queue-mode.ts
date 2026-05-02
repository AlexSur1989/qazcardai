
export type QueueMode = "redis" | "inline";

/** QUEUE_MODE=inline вЂ” Р±РµР· Bull/Redis (С‚РѕР»СЊРєРѕ Р»РѕРєР°Р»СЊРЅР°СЏ СЂР°Р·СЂР°Р±РѕС‚РєР°). РРЅР°С‡Рµ redis (РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ). */
export function getQueueMode(): QueueMode {
  const m = process.env.QUEUE_MODE?.trim().toLowerCase();
  if (m === "inline") return "inline";
  return "redis";
}
