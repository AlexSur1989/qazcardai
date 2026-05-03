import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  firstSearchParam,
  pickLoginRedirectParam,
  postAuthLandingPath,
} from "@/lib/auth";

import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/** Канонический вход: /login */
export default async function LoginPage({ searchParams }: Props) {
  const session = await auth();
  const sp = (await searchParams) ?? {};
  if (session?.user) {
    const p = pickLoginRedirectParam(
      firstSearchParam(sp, "next"),
      firstSearchParam(sp, "callbackUrl"),
    );
    redirect(postAuthLandingPath(p, session.user.role));
  }

  return <LoginForm />;
}
