import { AuthHeader } from "@/components/auth/auth-header";
import { AuthHero } from "@/components/auth/auth-hero";

type AuthMode = "login" | "register";

type Props = {
  mode: AuthMode;
  children: React.ReactNode;
};

export function AuthLayout({ mode, children }: Props) {
  return (
    <div className="auth-page-bg flex min-h-dvh min-w-0 flex-col">
      <div
        className="auth-page-glow bg-[#7dcee0] -left-24 top-0 size-72"
        aria-hidden
      />
      <div
        className="auth-page-glow bg-[#fff6d9] right-0 bottom-0 size-80 animation-delay-500"
        aria-hidden
      />
      <AuthHeader mode={mode} />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col lg:flex-row">
        <AuthHero />
        <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 lg:py-10">
          <div className="auth-card w-full max-w-md p-6 sm:p-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

function AuthDivider() {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-[#b8dce6]" />
      </div>
      <div className="relative flex justify-center text-xs">
        <span className="bg-white/90 px-3 text-muted-foreground">или через email</span>
      </div>
    </div>
  );
}

export { AuthDivider };
