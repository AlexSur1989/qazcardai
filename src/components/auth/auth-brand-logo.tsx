import Image from "next/image";
import Link from "next/link";

import { getAppName } from "@/lib/app-name";
import { getLandingUrl } from "@/lib/app-name";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  linkToLanding?: boolean;
};

export function AuthBrandLogo({ className, linkToLanding = true }: Props) {
  const inner = (
    <>
      <Image
        src="/brand/qazcard-logo.svg"
        alt=""
        width={36}
        height={36}
        className="size-9 shrink-0"
        priority
      />
      <span className="text-foreground text-base font-semibold tracking-tight">
        {getAppName()}
      </span>
    </>
  );

  const cls = cn("inline-flex items-center gap-2.5", className);

  if (linkToLanding) {
    return (
      <Link href={getLandingUrl()} className={cn(cls, "hover:opacity-90")}>
        {inner}
      </Link>
    );
  }

  return <div className={cls}>{inner}</div>;
}
