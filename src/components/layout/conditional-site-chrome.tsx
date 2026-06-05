"use client";

import { usePathname } from "next/navigation";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

const AUTH_PATHS = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
]);

type Props = {
  children: React.ReactNode;
};

export function ConditionalSiteChrome({ children }: Props) {
  const pathname = usePathname();
  const isAuth = AUTH_PATHS.has(pathname);

  if (isAuth) {
    return <>{children}</>;
  }

  return (
    <>
      <SiteHeader />
      <div className="min-w-0 flex-1">{children}</div>
      <SiteFooter />
    </>
  );
}
