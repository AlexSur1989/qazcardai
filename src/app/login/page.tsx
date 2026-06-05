import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  firstSearchParam,
  pickLoginRedirectParam,
  postAuthLandingPath,
} from "@/lib/auth";
import {
  getGoogleAuthUiState,
  getGoogleOAuthStartUrl,
} from "@/lib/google-auth-config";
import {
  getTelegramBotUsernameForWidget,
  getTelegramWidgetAuthCallbackUrl,
  telegramAuthEnabledForUi,
} from "@/lib/telegram-auth-config";

import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/** Канонический вход: /login */
export default async function LoginPage({ searchParams }: Props) {
  const session = await auth();
  const sp = (await searchParams) ?? {};
  const redirectParam = pickLoginRedirectParam(
    firstSearchParam(sp, "next"),
    firstSearchParam(sp, "callbackUrl"),
  );
  const landingPath = postAuthLandingPath(redirectParam, undefined);

  if (session?.user) {
    redirect(postAuthLandingPath(redirectParam, session.user.role));
  }

  const showTelegram = telegramAuthEnabledForUi();
  const telegramBotUsername = showTelegram
    ? getTelegramBotUsernameForWidget() ?? undefined
    : undefined;
  const telegramAuthUrl = showTelegram
    ? getTelegramWidgetAuthCallbackUrl(landingPath)
    : undefined;

  return (
    <LoginForm
      googleAuthUiState={getGoogleAuthUiState()}
      googleAuthStartUrl={getGoogleOAuthStartUrl(landingPath)}
      telegramAuthEnabled={showTelegram}
      telegramBotUsername={telegramBotUsername}
      telegramAuthUrl={telegramAuthUrl}
    />
  );
}
