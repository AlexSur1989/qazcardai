export type GoogleOAuthErrorParam =
  | "google_oauth_failed"
  | "google_email_not_verified"
  | "google_oauth_maintenance";

export type GoogleSignInFailureReason =
  | "EMAIL_NOT_VERIFIED"
  | "BLOCKED"
  | "INACTIVE"
  | "MAINTENANCE"
  | "ERROR";

export function mapGoogleSignInFailureToErrorParam(
  reason: GoogleSignInFailureReason,
): GoogleOAuthErrorParam {
  if (reason === "EMAIL_NOT_VERIFIED") return "google_email_not_verified";
  if (reason === "MAINTENANCE") return "google_oauth_maintenance";
  return "google_oauth_failed";
}

export function oauthErrorMessage(error: string | null): string | null {
  if (!error) return null;
  switch (error) {
    case "google_email_not_verified":
      return "Google аккаунт должен иметь подтверждённый email.";
    case "google_oauth_maintenance":
      return "Регистрация через Google временно недоступна: ведутся технические работы.";
    case "google_oauth_failed":
      return "Не удалось войти через Google. Попробуйте ещё раз.";
    case "telegram_auth_failed":
      return "Не удалось войти через Telegram. Попробуйте ещё раз.";
    default:
      return null;
  }
}
