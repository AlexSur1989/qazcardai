import { redirect } from "next/navigation";

import {
  firstSearchParam,
  normalizeNextPath,
  pickLoginRedirectParam,
} from "@/lib/auth";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/** Совместимость: /auth/login → /login?next=… */
export default async function LegacyAuthLoginPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const p = pickLoginRedirectParam(
    firstSearchParam(sp, "next"),
    firstSearchParam(sp, "callbackUrl"),
  );
  const target = normalizeNextPath(p);
  const q = new URLSearchParams();
  q.set("next", target);
  if (firstSearchParam(sp, "registered") === "1") {
    q.set("registered", "1");
  }
  redirect(`/login?${q.toString()}`);
}
