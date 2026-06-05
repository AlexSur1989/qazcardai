export type GoogleOAuthProfile = {
  /** Google sub / user id */
  id: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

export type GoogleUserInfoResponse = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

/** Профиль только из ответа Google userinfo — не доверять клиенту. */
export function googleProfileFromUserInfo(
  data: GoogleUserInfoResponse,
): GoogleOAuthProfile | null {
  const id = typeof data.sub === "string" ? data.sub.trim() : "";
  const email =
    typeof data.email === "string" ? data.email.toLowerCase().trim() : "";
  if (!id || !email) return null;

  const name =
    typeof data.name === "string" && data.name.trim()
      ? data.name.trim().slice(0, 120)
      : null;
  const picture =
    typeof data.picture === "string" && data.picture.startsWith("http")
      ? data.picture.slice(0, 2048)
      : null;

  return {
    id,
    email,
    emailVerified: data.email_verified === true,
    name,
    picture,
  };
}
