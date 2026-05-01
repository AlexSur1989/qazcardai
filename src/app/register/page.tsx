import { redirect } from "next/navigation";

/**
 * Краткие пути для CTA с внешнего SEO-лендинга: /register → /auth/register
 */
export default function RegisterAliasPage() {
  redirect("/auth/register");
}
