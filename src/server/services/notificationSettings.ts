
import { getRegistryEntry } from "@/config/app-settings-registry";
import { validateAppSettingValueForType } from "@/lib/app-setting-value";
import { getAppSettingsByGroup, setAppSettingFromRegistry } from "@/server/services/appSettings";
import { getEmailProviderEnvStatus } from "@/server/services/emailService";

export const NOTIFICATION_APP_SETTING_KEYS = [
  "EMAIL_PROVIDER",
  "EMAIL_FROM",
  "EMAIL_ENABLED",
  "SEND_WELCOME_EMAIL",
  "SEND_PAYMENT_SUCCESS_EMAIL",
  "SEND_GENERATION_COMPLETED_EMAIL",
  "SEND_GENERATION_FAILED_EMAIL",
  "SEND_LOW_BALANCE_EMAIL",
  "ADMIN_ALERT_EMAIL",
  "SEND_ADMIN_PROVIDER_ERRORS",
  "SEND_ADMIN_WORKER_ERRORS",
] as const;

const PROVIDERS = new Set(["none", "smtp", "resend", "sendgrid"]);

export type NotificationAppSettingKey =
  (typeof NOTIFICATION_APP_SETTING_KEYS)[number];

function normalizeProvider(v: unknown): string {
  if (typeof v !== "string" || !v.trim()) return "none";
  const s = v.trim().toLowerCase();
  return PROVIDERS.has(s) ? s : "none";
}

/**
 * Снимок настроек уведомлений + env (без секретов) для admin API.
 */
export async function getNotificationAdminState() {
  const group = await getAppSettingsByGroup("notifications");
  const map: Record<string, unknown> = {};
  for (const s of group) {
    if (s.key === "EMAIL_PROVIDER") {
      map[s.key] = normalizeProvider(s.value);
    } else {
      map[s.key] = s.value;
    }
  }
  const status = await getEmailProviderEnvStatus();
  return { settings: map, provider: status };
}

export async function updateNotificationAppSettings(input: {
  values: Record<string, unknown>;
  adminUserId: string;
}): Promise<
  | { ok: true; state: Awaited<ReturnType<typeof getNotificationAdminState>> }
  | { ok: false; error: string; status?: number }
> {
  let any = false;
  for (const key of NOTIFICATION_APP_SETTING_KEYS) {
    if (!(key in input.values)) continue;
    any = true;
    const def = getRegistryEntry(key);
    if (!def) {
      return { ok: false, error: `unknown_${key}` };
    }
    let v = (input.values as Record<string, unknown>)[key];
    if (key === "EMAIL_PROVIDER") {
      v = normalizeProvider(v);
    }
    const valid = validateAppSettingValueForType(def.type, v);
    if (!valid.ok) {
      return { ok: false, error: valid.message, status: 400 };
    }
    const toWrite = key === "EMAIL_PROVIDER" ? normalizeProvider(v) : valid.value;
    const res = await setAppSettingFromRegistry({
      key,
      value: toWrite,
      adminUserId: input.adminUserId,
    });
    if (!res.ok) {
      return { ok: false, error: res.error, status: res.status };
    }
  }
  if (!any) {
    return { ok: false, error: "no_keys", status: 400 };
  }
  const state = await getNotificationAdminState();
  return { ok: true, state };
}
