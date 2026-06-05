import type { GoogleAuthUiState } from "@/lib/google-auth-config";

export type AuthOAuthProps = {
  googleAuthUiState: GoogleAuthUiState;
  googleAuthStartUrl?: string;
  telegramAuthEnabled: boolean;
  telegramBotUsername?: string;
  telegramAuthUrl?: string;
};

export { oauthErrorMessage } from "@/lib/google-auth-errors";
