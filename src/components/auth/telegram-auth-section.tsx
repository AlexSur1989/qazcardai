import { TelegramLoginButton } from "@/components/auth/telegram-login-button";
import { cn } from "@/lib/utils";

type Props = {
  mode: "login" | "register";
  botUsername: string;
  authUrl: string;
  className?: string;
};

export function TelegramAuthSection({
  mode,
  botUsername,
  authUrl,
  className,
}: Props) {
  const label =
    mode === "login"
      ? "Продолжить с Telegram"
      : "Зарегистрироваться через Telegram";

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-muted-foreground text-center text-xs">{label}</p>
      <div className="flex min-h-11 items-center justify-center rounded-xl border border-[#b8dce6] bg-white px-2 py-1.5 shadow-sm">
        <TelegramLoginButton botUsername={botUsername} authUrl={authUrl} />
      </div>
    </div>
  );
}
