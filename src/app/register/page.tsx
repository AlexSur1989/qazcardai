import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  buildPathQueryString,
  firstSearchParam,
  pickLoginRedirectParam,
  postAuthLandingPath,
} from "@/lib/auth";

/**
 * Краткие пути для CTA с внешнего SEO-лендинга: /register → /auth/register
 */
type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RegisterAliasPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const session = await auth();
  if (session?.user) {
    const p = pickLoginRedirectParam(
      firstSearchParam(sp, "callbackUrl"),
      firstSearchParam(sp, "next"),
    );
    redirect(postAuthLandingPath(p, session.user.role));
  }
  redirect(`/auth/register${buildPathQueryString(sp)}`);
}
