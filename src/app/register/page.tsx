import { redirect } from "next/navigation";

/**
 * Краткие пути для CTA с внешнего SEO-лендинга: /register → /auth/register
 */
type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function buildQueryString(
  sp: Record<string, string | string[] | undefined>
): string {
  const u = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) u.append(key, v);
    } else {
      u.set(key, value);
    }
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

export default async function RegisterAliasPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  redirect(`/auth/register${buildQueryString(sp)}`);
}
