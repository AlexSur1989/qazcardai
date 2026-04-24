# AI Media SaaS

Веб-приложение для генерации изображений и видео через **Kie.ai API**. Цель деплоя — **VPS + Docker** (не только Vercel). Секреты и вызовы провайдера — только на сервере; медиа — в **S3-совместимом** хранилище.

Текущие этапы: **Stage 0** (каркас) и **Stage 0.5** (Docker для VPS). Подробнее — `DEVELOPMENT_PLAN.md`.

## Деплой на VPS

См. **`README_DEPLOY.md`** (`Dockerfile`, `docker-compose.yml`, пример `nginx.conf.example`).

## Стек

- Next.js (App Router), TypeScript
- Tailwind CSS v4, Shadcn UI (пример: `Button`)
- Prisma 7 + PostgreSQL (`@prisma/adapter-pg` + `pg`)

## Требования

- Node.js 20+
- PostgreSQL 15+ (локально или в Docker на этапе 0.5)

## Быстрый старт

1. Скопируйте переменные окружения:

   ```bash
   cp .env.example .env
   ```

   Укажите рабочий `DATABASE_URL`. Для локального Postgres без Docker используйте хост `localhost` (пример закомментирован в `.env.example`).

2. Установите зависимости и сгенерируйте Prisma Client (также выполняется на `postinstall`):

   ```bash
   npm install
   ```

3. Запуск в режиме разработки:

   ```bash
   npm run dev
   ```

   Откройте [http://localhost:3000](http://localhost:3000).

## Скрипты

| Команда            | Назначение                          |
| ------------------ | ----------------------------------- |
| `npm run dev`      | Разработка                          |
| `npm run build`    | Сборка (webpack; см. примечание ниже) |
| `npm run start`    | Запуск production-сборки            |
| `npm run lint`     | ESLint                              |
| `npm run db:generate` | `prisma generate`                |
| `npm run db:migrate`  | `prisma migrate dev`             |
| `npm run db:push`     | `prisma db push`                 |
| `npm run db:studio`   | Prisma Studio                    |

## Сборка на Windows и пути с не-ASCII символами

Если каталог проекта содержит кириллицу и `next build` с Turbopack падает, в проекте уже задано:

```json
"build": "next build --webpack"
```

## Структура

- `src/app` — маршруты App Router (`/`, `/dashboard`, `/admin`, `/auth`, заготовка `api/`)
- `src/components` — UI (`ui/`, `layout/`, `forms/`)
- `src/lib` — утилиты и будущие модули (`prisma.ts`, заглушки `kie.ts`, `storage.ts`, …)
- `src/server` — серверные сервисы и очереди (заготовки)
- `src/types` — общие типы
- `prisma` — схема и будущие миграции

Сгенерированный Prisma Client пишется в `src/generated/prisma` (каталог в `.gitignore`); после клонирования репозитория выполните `npm install` или `npm run db:generate`.

## Документация по этапам

- `PROJECT_SPEC.md` — требования к продукту
- `DEVELOPMENT_PLAN.md` — этапы разработки
- `CURSOR_RULES.md` — правила для агента в Cursor

## Первый коммит (после Stage 0)

```bash
git add .
git commit -m "stage 0 project setup"
```

Не коммитьте файл `.env` — в репозитории только `.env.example`.
