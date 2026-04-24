# Деплой на VPS (Docker)

Краткая инструкция для **Stage 0.5**: поднять приложение, PostgreSQL и Redis через Docker Compose на своём сервере. Домен и секреты не зашиты в репозитории — всё задаётся через **`.env`**.

Подробные требования к продукту: `PROJECT_SPEC.md`. Этапы: `DEVELOPMENT_PLAN.md`.

## Что входит в Compose

| Сервис     | Назначение                                      |
| ---------- | ----------------------------------------------- |
| `app`      | Next.js (production, `output: "standalone"`)  |
| `postgres` | БД, данные в volume `postgres_data`           |
| `redis`    | Кэш/очередь (сейчас без worker), volume `redis_data` |

Сервис **`worker`** (BullMQ) будет добавлен позже — в `docker-compose.yml` оставлен закомментированный заготовочный блок.

## Подготовка на VPS

1. Установите [Docker](https://docs.docker.com/engine/install/) и [Docker Compose v2](https://docs.docker.com/compose/install/).

2. Склонируйте репозиторий и перейдите в каталог проекта.

3. Создайте файл **`.env`** из примера и **заполните секреты**:

   ```bash
   cp .env.example .env
   ```

4. Согласуйте переменные для Postgres и строку подключения приложения:

   - В **`.env`** задайте `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (используются сервисом `postgres`).
   - **`DATABASE_URL`** в том же файле должен указывать на хост **`postgres`**, порт **`5432`**, ту же БД, логин и пароль, что и у контейнера Postgres. Пример см. в `.env.example`.

5. **`REDIS_URL`** для Compose: `redis://redis:6379` (хост — имя сервиса `redis`).

6. Порт публикации приложения на хост (по умолчанию 3000):

   ```env
   APP_PUBLISH_PORT=3000
   ```

7. Публичный URL приложения (без привязки к конкретному домену в коде):

   ```env
   APP_URL=https://ВАШ_ДОМЕН
   NEXT_PUBLIC_APP_URL=https://ВАШ_ДОМЕН
   ```

## Сборка и запуск

Сборка образа и запуск стека:

```bash
docker compose build
docker compose up -d
```

Просмотр логов приложения:

```bash
docker compose logs -f app
```

Остановка:

```bash
docker compose down
```

Данные Postgres и Redis сохраняются в именованных volumes (`postgres_data`, `redis_data`) и не пропадают при `docker compose down`. Удалить их явно: `docker volume rm ...` (осторожно: потеря данных).

## Миграции Prisma

Production-образ приложения (**`Dockerfile`**, stage `runner`) содержит только **standalone** Next.js и **не включает** Prisma CLI. После появления миграций в репозитории (этап 1 и далее) применяйте их одним из способов:

- с CI/CD или с админ-машины: `DATABASE_URL` как у продакшена, затем `npx prisma migrate deploy` в каталоге проекта;
- или добавьте в Compose отдельный одноразовый сервис/образ с Node.js и dev-зависимостями только под миграции (можно оформить на этапе настройки БД).

На **Stage 0–0.5** схема БД может быть без миграций — этот шаг станет обязательным после Stage 1.

## Nginx и TLS

Пример конфигурации reverse proxy без захардкоженного домена (замените `YOUR_HOSTNAME_HERE` и пути к сертификатам): файл **`nginx.conf.example`**.

Типичный сценарий: Nginx на хосте проксирует на `127.0.0.1:3000`, куда проброшен порт сервиса `app` из Compose.

## Бэкапы PostgreSQL (кратко)

Регулярно выгружайте БД, например:

```bash
docker compose exec postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup.sql
```

Детальная политика бэкапов — в поздних этапах (`README_DEPLOY.md` / `DEVELOPMENT_PLAN.md`, Stage 18).

## Безопасность

- Не коммитьте **`.env`**.
- Не храните продакшен-секреты в образе: только переменные окружения при запуске контейнера.
- Kie.ai и другие ключи API — только на сервере/worker, не во фронтенде (см. `PROJECT_SPEC.md`).

## Коммит после Stage 0.5

```bash
git add .
git commit -m "stage 0.5 docker vps setup"
```
