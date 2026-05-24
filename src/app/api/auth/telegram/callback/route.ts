import { NextResponse, type NextRequest } from "next/server";

import { buildPublicAppRedirect } from "@/lib/auth-public-url";
import { postAuthLandingPath } from "@/lib/auth";
import { setAuthJwtSession } from "@/lib/auth-jwt-session";
import {
  classifyTelegramCallbackFlow,
  logTelegramAuthFailure,
  logTelegramAuthSuccess,
  logTelegramBotConfigDebug,
  logTelegramCallbackReceived,
  logTelegramHashVerifyFieldKeys,
} from "@/lib/telegram-auth-debug";
import {
  getTelegramBotToken,
  getTelegramBotUsernameForWidget,
  isTelegramWidgetConfigured,
} from "@/lib/telegram-auth-config";
import type { TelegramLoginWidgetPayload } from "@/lib/telegram-profile";
import { telegramWidgetProfileFromPayload } from "@/lib/telegram-profile";
import { verifyTelegramLoginPayload } from "@/lib/telegram-login-verify";
import {
  completeTelegramWidgetSignIn,
} from "@/server/services/telegramWidgetSignIn";
import { mapTelegramSignInFailureToDebugReason } from "@/lib/telegram-auth-debug";

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
  logTelegramCallbackReceived(sp);

  const flowType = classifyTelegramCallbackFlow(sp);
  if (flowType !== "legacy_widget") {
    return fail(
      flowType === "oidc" ? "wrong_telegram_flow_payload" : "wrong_telegram_flow_payload",
    );
  }

  const botToken = getTelegramBotToken();
  const botUsername = getTelegramBotUsernameForWidget();
  logTelegramBotConfigDebug({
    hasBotToken: Boolean(botToken),
    hasBotUsername: Boolean(botUsername),
  });

  if (!isTelegramWidgetConfigured() || !botToken) {
    return fail("missing_bot_token");
  }

  const callbackPath = safeCallbackPath(sp.get("callbackUrl"));
  const payload = parseWidgetPayload(req);

  const verified = verifyTelegramLoginPayload(payload, botToken);
  if (!verified.ok) {
    if (verified.fieldKeys?.length) {
      logTelegramHashVerifyFieldKeys(verified.fieldKeys);
    }
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
    return fail(mapTelegramSignInFailureToDebugReason(signIn.failureReason));
  }

  try {
    await setAuthJwtSession(signIn.user);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("AUTH_SECRET")) {
      return fail("session_create_failed");
    }
    console.warn("[telegram] session_set_error: unknown");
    return fail("session_create_failed");
  }

  logTelegramAuthSuccess(callbackPath);
  return NextResponse.redirect(buildPublicAppRedirect(callbackPath));
}
