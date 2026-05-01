import { redirect } from "next/navigation";

/**
 * Краткие пути для CTA с внешнего SEO-лендинга: /login → /auth/login
 */
export default function LoginAliasPage() {
  redirect("/auth/login");
}
