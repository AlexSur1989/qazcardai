import { getPublicAppUrl } from "@/lib/auth-public-url";

/** Google OAuth — только server-side секреты; client_id используется в redirect на Google. */

export function getGoogleClientId(): string | null {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  return id || null;
}

/** Только server-side — никогда не импортировать в client components. */
export function getGoogleClientSecret(): string | null {
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return secret || null;
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(getGoogleClientId() && getGoogleClientSecret());
}

export type GoogleAuthUiState = "enabled" | "hidden" | "disabled";

/** Состояние кнопки Google на login/register. */
export function getGoogleAuthUiState(): GoogleAuthUiState {
  if (isGoogleOAuthConfigured()) return "enabled";
  if (process.env.NODE_ENV === "production") return "hidden";
  return "disabled";
}

/** Redirect URI для Google Cloud Console: {NEXT_PUBLIC_APP_URL}/api/auth/google/callback */
export function getGoogleOAuthCallbackUrl(): string {
  const base = getPublicAppUrl();
  return `${base}/api/auth/google/callback`;
}

/** URL старта OAuth (server redirect). */
export function getGoogleOAuthStartUrl(callbackPath = "/dashboard"): string {
  const base = getPublicAppUrl();
  const safeCallback =
    callbackPath.startsWith("/") && !callbackPath.startsWith("//")
      ? callbackPath
      : "/dashboard";
  return `${base}/api/auth/google?callbackUrl=${encodeURIComponent(safeCallback)}`;
}

export type GoogleOAuthEnvStatus = {
  configured: boolean;
  clientIdPresent: boolean;
  clientSecretPresent: boolean;
  callbackUrl: string;
};

/** Диагностика для /admin/settings Advanced — без секретов. */
export function getGoogleOAuthEnvStatus(): GoogleOAuthEnvStatus {
  let callbackUrl = "";
  try {
    callbackUrl = getGoogleOAuthCallbackUrl();
  } catch {
    callbackUrl = "(NEXT_PUBLIC_APP_URL не задан)";
  }
  const clientIdPresent = Boolean(getGoogleClientId());
  const clientSecretPresent = Boolean(getGoogleClientSecret());
  return {
    configured: clientIdPresent && clientSecretPresent,
    clientIdPresent,
    clientSecretPresent,
    callbackUrl,
  };
}
