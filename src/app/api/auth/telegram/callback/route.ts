import { NextResponse, type NextRequest } from "next/server";

import { buildPublicAppRedirect } from "@/lib/auth-public-url";
import { postAuthLandingPath } from "@/lib/auth";
import { setAuthJwtSession } from "@/lib/auth-jwt-session";
import {
  detectWrongTelegramOidcPayload,
  logTelegramAuthFailure,
} from "@/lib/telegram-auth-debug";
import {
  getTelegramBotToken,
  isTelegramWidgetConfigured,
} from "@/lib/telegram-auth-config";
import type { TelegramLoginWidgetPayload } from "@/lib/telegram-profile";
import { telegramWidgetProfileFromPayload } from "@/lib/telegram-profile";
import { verifyTelegramLoginPayload } from "@/lib/telegram-login-verify";
import { completeTelegramWidgetSignIn } from "@/server/services/telegramWidgetSignIn";

export const dynamic = "force-dynamic";

function fail(reason: string): NextResponse {
  logTelegramAuthFailure(reason);
  return NextResponse.redirect(
    buildPublicAppRedirect("/login?error=telegram_auth_failed"),
  );
}

function safeCallbackPath(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) {
    return postAuthLandingPath(raw, undefined);
  }
  return postAuthLandingPath(null, undefined);
}

function parseWidgetPayload(req: NextRequest): TelegramLoginWidgetPayload {
  const sp = req.nextUrl.searchParams;
  return {
    id: sp.get("id") ?? undefined,
    first_name: sp.get("first_name") ?? undefined,
    last_name: sp.get("last_name") ?? undefined,
    username: sp.get("username") ?? undefined,
    photo_url: sp.get("photo_url") ?? undefined,
    auth_date: sp.get("auth_date") ?? undefined,
    hash: sp.get("hash") ?? undefined,
  };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  if (detectWrongTelegramOidcPayload(sp)) {
    return fail("wrong_telegram_flow_oidc_payload");
  }

  if (!isTelegramWidgetConfigured()) {
    return fail("missing_bot_token");
  }

  const botToken = getTelegramBotToken();
  if (!botToken) {
    return fail("missing_bot_token");
  }

  const callbackPath = safeCallbackPath(sp.get("callbackUrl"));
  const payload = parseWidgetPayload(req);

  const verified = verifyTelegramLoginPayload(payload, botToken);
  if (!verified.ok) {
    return fail(verified.reason);
  }

  const authDate = Number.parseInt(verified.payload.auth_date, 10);
  const profile = telegramWidgetProfileFromPayload({
    id: verified.payload.id,
    first_name: verified.payload.first_name,
    last_name: verified.payload.last_name,
    username: verified.payload.username,
    photo_url: verified.payload.photo_url,
    auth_date: authDate,
  });

  const signIn = await completeTelegramWidgetSignIn(profile);
  if (!signIn.ok) {
    const reason =
      signIn.failureReason === "BLOCKED" || signIn.failureReason === "INACTIVE"
        ? "db_error"
        : "db_error";
    return fail(reason);
  }

  try {
    await setAuthJwtSession(signIn.user);
  } catch {
    return fail("session_error");
  }

  return NextResponse.redirect(buildPublicAppRedirect(callbackPath));
}
