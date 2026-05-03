import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  firstSearchParam,
  pickLoginRedirectParam,
  postAuthLandingPath,
} from "@/lib/auth";

import { LoginForm } from "./login-form";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: Props) {
  const session = await auth();
  if (session?.user) {
    const sp = (await searchParams) ?? {};
    const p = pickLoginRedirectParam(
      firstSearchParam(sp, "callbackUrl"),
      firstSearchParam(sp, "next"),
    );
    redirect(postAuthLandingPath(p, session.user.role));
  }

  return <LoginForm />;
}
