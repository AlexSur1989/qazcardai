import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  firstSearchParam,
  pickLoginRedirectParam,
  postAuthLandingPath,
} from "@/lib/auth";
import {
  getTelegramBotUsernameForWidget,
  getTelegramWidgetAuthCallbackUrl,
  telegramAuthEnabledForUi,
} from "@/lib/telegram-auth-config";

import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/** Каноническая регистрация: /register */
export default async function RegisterPage({ searchParams }: Props) {
  const session = await auth();
  const sp = (await searchParams) ?? {};
  const redirectParam = pickLoginRedirectParam(
    firstSearchParam(sp, "next"),
    firstSearchParam(sp, "callbackUrl"),
  );

  if (session?.user) {
    redirect(postAuthLandingPath(redirectParam, session.user.role));
  }

  const showTelegram = telegramAuthEnabledForUi();
  const telegramBotUsername = showTelegram
    ? getTelegramBotUsernameForWidget() ?? undefined
    : undefined;
  const telegramAuthUrl = showTelegram
    ? getTelegramWidgetAuthCallbackUrl(
        postAuthLandingPath(redirectParam, undefined),
      )
    : undefined;

  return (
    <RegisterForm
      telegramAuthEnabled={showTelegram}
      telegramBotUsername={telegramBotUsername}
      telegramAuthUrl={telegramAuthUrl}
    />
  );
}
