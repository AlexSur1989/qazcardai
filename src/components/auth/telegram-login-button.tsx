"use client";

import { useEffect, useRef } from "react";

type TelegramLoginButtonProps = {
  botUsername: string;
  authUrl: string;
};

/**
 * Официальный Telegram Login Widget (не OIDC / oauth.telegram.org).
 * @see https://core.telegram.org/widgets/login
 */
export function TelegramLoginButton({
  botUsername,
  authUrl,
}: TelegramLoginButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !botUsername || !authUrl) return;

    container.replaceChildren();

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername.replace(/^@/, ""));
    script.setAttribute("data-size", "large");
    script.setAttribute("data-auth-url", authUrl);
    script.setAttribute("data-userpic", "false");

    container.appendChild(script);

    return () => {
      container.replaceChildren();
    };
  }, [authUrl, botUsername]);

  if (!botUsername || !authUrl) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="flex min-h-10 w-full items-center justify-center"
      aria-label="Войти через Telegram"
    />
  );
}
