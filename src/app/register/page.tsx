import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  firstSearchParam,
  pickLoginRedirectParam,
  postAuthLandingPath,
} from "@/lib/auth";

import { RegisterForm } from "./register-form";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/** Каноническая регистрация: /register */
export default async function RegisterPage({ searchParams }: Props) {
  const session = await auth();
  const sp = (await searchParams) ?? {};
  if (session?.user) {
    const p = pickLoginRedirectParam(
      firstSearchParam(sp, "next"),
      firstSearchParam(sp, "callbackUrl"),
    );
    redirect(postAuthLandingPath(p, session.user.role));
  }

  return <RegisterForm />;
}
