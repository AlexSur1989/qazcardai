import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-6 px-4 py-20 text-center">
      <p className="text-muted-foreground text-sm font-medium">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Страница не найдена</h1>
      <p className="text-muted-foreground text-sm leading-relaxed">
        Адрес мог измениться или введён с опечаткой. Попробуйте с главной или из кабинета.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button nativeButton={false} render={<Link href="/" />}>
          На главную
        </Button>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/dashboard" />}
        >
          Кабинет
        </Button>
      </div>
    </main>
  );
}
