import { redirect } from "next/navigation";

import { firstSearchParam, pickLoginRedirectParam } from "@/lib/auth";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/** Совместимость: /auth/register → /register?next=… */
export default async function LegacyAuthRegisterPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const p = pickLoginRedirectParam(
    firstSearchParam(sp, "next"),
    firstSearchParam(sp, "callbackUrl"),
  );
  const q = new URLSearchParams();
  if (
    typeof p === "string" &&
    p.startsWith("/") &&
    !p.startsWith("//")
  ) {
    q.set("next", p);
  }
  const qs = q.toString();
  redirect(qs ? `/register?${qs}` : "/register");
}
