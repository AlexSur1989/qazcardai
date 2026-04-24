import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-4 py-16">
      <div className="space-y-4">
        <p className="text-sm font-medium text-muted-foreground">Этап 0</p>
        <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          AI Media — генерация изображений и видео через Kie.ai
        </h1>
        <p className="text-pretty text-muted-foreground md:text-lg">
          Каркас Next.js для SaaS: TypeScript, Tailwind, Shadcn UI, Prisma и
          PostgreSQL. Секреты и вызовы провайдера только на сервере; медиа —
          в S3-совместимом хранилище (позже).
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button nativeButton={false} render={<Link href="/dashboard" />}>
          Перейти в кабинет
        </Button>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/admin" />}
        >
          Заглушка админки
        </Button>
      </div>
    </main>
  );
}
