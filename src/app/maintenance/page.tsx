import Link from "next/link";
import { Construction } from "lucide-react";

import { getAppName } from "@/lib/app-name";
import { Button } from "@/components/ui/button";
import { getMaintenanceFlags } from "@/server/services/appSettings";

type Props = {
  searchParams?: Promise<{ reason?: string }>;
};

export default async function MaintenancePage(props: Props) {
  const sp = (await props.searchParams) ?? {};
  const flags = await getMaintenanceFlags();
  const registrationOnly = sp.reason === "registration";
  const showLogin = flags.allowAdmin;

  return (
    <div className="from-background via-muted/30 to-background flex min-h-[80vh] flex-1 items-center justify-center bg-gradient-to-b px-4 py-16">
      <div className="border-border/80 bg-card/90 max-w-lg rounded-2xl border p-8 shadow-lg backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="bg-primary/10 text-primary inline-flex size-14 items-center justify-center rounded-full">
            <Construction className="size-8" aria-hidden />
          </div>
          <p className="text-primary text-sm font-medium tracking-wide uppercase">
            {getAppName()}
          </p>
          <h1 className="text-balance text-2xl font-semibold tracking-tight md:text-3xl">
            Ведутся технические работы
          </h1>
          <p className="text-muted-foreground text-pretty text-sm leading-relaxed">
            {registrationOnly
              ? "Регистрация временно недоступна. Мы готовим сервис к открытию."
              : flags.message}
          </p>
          <p className="text-muted-foreground text-pretty text-sm leading-relaxed">
            Открытие планируется в ближайшее время. Спасибо за терпение.
          </p>
          {showLogin ? (
            <div className="pt-2">
              <Button nativeButton={false} render={<Link href="/login" />} variant="outline">
                Вход для команды
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
