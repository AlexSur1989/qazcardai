import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getUserProfile } from "@/lib/user-profile";
import { redirect } from "next/navigation";
import { AlertCircle, Settings2 } from "lucide-react";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";

export const metadata = {
  title: "Настройки — QazCard AI",
};

export default async function SettingsPage() {
  const current = await getFreshSessionUser();
  if (!current.ok) {
    redirect("/login?next=/dashboard/settings");
  }

  const profile = await getUserProfile(current.user.id);

  if (!profile.ok) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Настройки"
          breadcrumbs={[{ label: "Кабинет", href: "/dashboard" }, { label: "Настройки" }]}
        />
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Не удалось загрузить профиль</AlertTitle>
          <AlertDescription>
            {profile.error === "not_found"
              ? "Пользователь не найден. Войдите снова."
              : "Проверьте подключение к базе."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Настройки аккаунта"
        description="Данные из базы, доступны только вам. Расширенное редактирование — позже."
        breadcrumbs={[{ label: "Кабинет", href: "/dashboard" }, { label: "Настройки" }]}
      />
      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="size-5" aria-hidden />
            Профиль
          </CardTitle>
          <CardDescription>Идентификация и баланс</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">Email</span>
            <span className="text-foreground font-medium">{profile.email}</span>
          </div>
          <Separator />
          <div className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">Имя</span>
            <span className="text-foreground">
              {profile.name?.trim() || "—"}
            </span>
          </div>
          <Separator />
          <div className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">Роль</span>
            <span className="text-foreground font-mono text-xs">
              {profile.role}
            </span>
          </div>
          <Separator />
          <div className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">Кредитов</span>
            <span className="text-foreground tabular-nums">
              {profile.balanceCredits}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
