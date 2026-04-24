import { Video } from "lucide-react";

import { DashboardSectionEmpty } from "@/components/dashboard/dashboard-section-empty";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "Создать видео — AI Media",
};

export default function CreateVideoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Создать видео
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Асинхронная генерация видео и очередь появятся на отдельных этапах.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="size-5" aria-hidden />
            Форма генерации
          </CardTitle>
          <CardDescription>
            Длительные задачи не блокируют страницу — это настроим вместе с очередью.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DashboardSectionEmpty
            title="Пока недоступно"
            description="Интеграция с Kie.ai и воркер не подключены на этом этапе."
          />
        </CardContent>
      </Card>
    </div>
  );
}
