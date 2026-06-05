import {
  getGoogleClientId,
  getGoogleClientSecret,
  getGoogleOAuthCallbackUrl,
} from "@/lib/google-auth-config";
import {
  googleProfileFromUserInfo,
  type GoogleOAuthProfile,
  type GoogleUserInfoResponse,
} from "@/lib/google-profile";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

const SCOPES = ["openid", "email", "profile"].join(" ");

export function buildGoogleAuthorizationUrl(state: string): string {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID не задан");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getGoogleOAuthCallbackUrl(),
    response_type: "code",
    scope: SCOPES,
    state,
    access_type: "online",
    prompt: "select_account",
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

type TokenResponse = {
  access_token?: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

/** Обмен authorization code на access token (server-side, с client_secret). */
export async function exchangeGoogleAuthCode(
  code: string,
): Promise<{ ok: true; accessToken: string } | { ok: false; reason: string }> {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  if (!clientId || !clientSecret) {
    return { ok: false, reason: "missing_config" };
  }

  let res: Response;
  try {
    res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: getGoogleOAuthCallbackUrl(),
        grant_type: "authorization_code",
      }),
    });
  } catch {
    return { ok: false, reason: "token_fetch_failed" };
  }

  let data: TokenResponse;
  try {
    data = (await res.json()) as TokenResponse;
  } catch {
    return { ok: false, reason: "token_parse_failed" };
  }

  if (!res.ok || !data.access_token) {
    console.warn(
      `[google] token_exchange_failed: ${data.error ?? "unknown"} (${res.status})`,
    );
    return { ok: false, reason: data.error ?? "token_exchange_failed" };
  }

  return { ok: true, accessToken: data.access_token };
}

/** Профиль пользователя из Google userinfo endpoint. */
export async function fetchGoogleUserProfile(
  accessToken: string,
): Promise<GoogleOAuthProfile | null> {
  let res: Response;
  try {
    res = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    return null;
  }

  if (!res.ok) {
    console.warn(`[google] userinfo_failed: ${res.status}`);
    return null;
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return null;
  }

  if (!data || typeof data !== "object") return null;
  return googleProfileFromUserInfo(data as GoogleUserInfoResponse);
}
