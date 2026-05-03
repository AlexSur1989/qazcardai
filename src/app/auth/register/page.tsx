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

export default async function RegisterPage({ searchParams }: Props) {
  const session = await auth();
  if (session?.user) {
    const sp = (await searchParams) ?? {};
    const p = pickLoginRedirectParam(
      firstSearchParam(sp, "callbackUrl"),
      firstSearchParam(sp, "next"),
    );
    redirect(postAuthLandingPath(p, session.user.role));
  }

  return <RegisterForm />;
}
