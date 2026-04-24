import Link from "next/link";

export default function AuthPlaceholderPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Вход и регистрация</h1>
      <p className="mt-3 text-muted-foreground">
        Реализация — этап 2. Пока это заглушка для структуры маршрутов.
      </p>
      <p className="mt-6 text-sm">
        <Link href="/" className="text-primary underline-offset-4 hover:underline">
          На главную
        </Link>
      </p>
    </main>
  );
}
