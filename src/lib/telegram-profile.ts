/** Данные профиля после проверки Telegram Login Widget. */
export type TelegramWidgetProfile = {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
};

/** Сырой payload из query string callback виджета. */
export type TelegramLoginWidgetPayload = {
  id?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date?: string;
  hash?: string;
};

export type TelegramWidgetVerifiedInput = {
  id: string;
  auth_date: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

export function telegramWidgetProfileFromPayload(
  payload: TelegramWidgetVerifiedInput,
): TelegramWidgetProfile {
  return {
    id: payload.id,
    auth_date: payload.auth_date,
    first_name: payload.first_name?.trim() || undefined,
    last_name: payload.last_name?.trim() || undefined,
    username: payload.username?.trim() || undefined,
    photo_url: payload.photo_url?.trim() || undefined,
  };
}

export function telegramDisplayName(profile: TelegramWidgetProfile): string {
  const parts = [profile.first_name, profile.last_name].filter(Boolean);
  if (parts.length > 0) return parts.join(" ").slice(0, 120);
  if (profile.username) return profile.username.slice(0, 120);
  return `Telegram user ${profile.id}`;
}
