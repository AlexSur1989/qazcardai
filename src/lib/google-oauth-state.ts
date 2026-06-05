import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import { authUsesSecureCookies } from "@/lib/auth-public-url";

const STATE_COOKIE = "google_oauth_state";
const CALLBACK_COOKIE = "google_oauth_callback";
const STATE_MAX_AGE = 10 * 60;

function hashState(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

function safeCallbackPath(raw: string | null | undefined): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) {
    return raw.slice(0, 512);
  }
  return "/dashboard";
}

export type GoogleOAuthStateBundle = {
  state: string;
  callbackPath: string;
};

/** Генерирует state и сохраняет в httpOnly cookie (CSRF). */
export async function issueGoogleOAuthState(
  callbackPath?: string | null,
): Promise<GoogleOAuthStateBundle> {
  const state = randomBytes(32).toString("hex");
  const path = safeCallbackPath(callbackPath);
  const secure = authUsesSecureCookies();

  const jar = await cookies();
  jar.set(STATE_COOKIE, hashState(state), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    maxAge: STATE_MAX_AGE,
  });
  jar.set(CALLBACK_COOKIE, path, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    maxAge: STATE_MAX_AGE,
  });

  return { state, callbackPath: path };
}

export type GoogleOAuthStateValidation =
  | { ok: true; callbackPath: string }
  | { ok: false; reason: string };

/** Проверяет state из callback и удаляет одноразовые cookies. */
export async function consumeGoogleOAuthState(
  stateFromQuery: string | null,
): Promise<GoogleOAuthStateValidation> {
  if (!stateFromQuery?.trim()) {
    return { ok: false, reason: "missing_state" };
  }

  const jar = await cookies();
  const storedHash = jar.get(STATE_COOKIE)?.value;
  const callbackPath = jar.get(CALLBACK_COOKIE)?.value ?? "/dashboard";

  jar.delete(STATE_COOKIE);
  jar.delete(CALLBACK_COOKIE);

  if (!storedHash) {
    return { ok: false, reason: "missing_state_cookie" };
  }

  const incomingHash = hashState(stateFromQuery.trim());
  const a = Buffer.from(storedHash, "utf8");
  const b = Buffer.from(incomingHash, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "state_mismatch" };
  }

  return { ok: true, callbackPath: safeCallbackPath(callbackPath) };
}
