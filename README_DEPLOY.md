# Деплой на VPS (Docker) — production

Пошаговая инструкция для **первого** развёртывания на выделенном сервере. Реальные домены, IP и секреты **не** привязаны к репозиторию: используйте свои плейсхолдеры вроде `YOUR_DOMAIN` и `YOUR_EMAIL`.

Контекст продукта: `PROJECT_SPEC.md`, этапы: `DEVELOPMENT_PLAN.md`, правила: `CURSOR_RULES.md`.

## Требования к VPS

- **ОС**: типично Linux (Ubuntu/Debian и т.п.) с root или sudo.
- **Ресурсы** (стартовая оценка, под нагрузку увеличьте):
  - **CPU**: 2+ vCPU.
  - **RAM**: 4+ ГиБ (у приложения, PostgreSQL, Redis, при необходимости ещё Nginx; worker для очереди генераций тоже потребляет память).
  - **Диск**: 20+ ГиБ ССД под ОС, Docker, образы и **том** PostgreSQL; сами **сгенерированные** медиа-файлы **не** храним на диске VPS (см. раздел [Где лежат generated files](#где-лежат-generated-файлы-и-зачем-s3) — только S3-совместимое хранилище).
- **Сеть**: исходящий HTTPS (образы Docker, пакеты, вызовы к Kie.ai, вебхуки, S3).
- **Порты**: внешне обычно **80/443** (Nginx), приложение в Compose слушает **3000** внутри/на localhost.

## Установка Docker и Docker Compose

1. Следуйте официальным инструкциям:
   - [Docker Engine](https://docs.docker.com/engine/install/)
   - [Docker Compose v2](https://docs.docker.com/compose/install/) (часто входит в пакет `docker.io` / Docker Desktop; проверка: `docker compose version`).

2. Включите автозапуск демона Docker и (по необходимости) добавьте пользователя в группу `docker`, чтобы не вызывать `sudo` для каждой команды (после этого перелогиньтесь).

## Клонирование и настройка `.env`

1. Склонируйте репозиторий и перейдите в каталог проекта (путь условно `YOUR_APP_DIR`).

2. Скопируйте пример окружения и отредактируйте **все** секреты и URL:

   ```bash
   cp .env.example .env
   ```

3. **Согласованность с Docker Compose**:
   - `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` — как у сервиса `postgres` в `docker-compose.yml`.
   - **`DATABASE_URL`**: внутри сети Compose хост БД — имя сервиса **`postgres`**, порт **5432** (см. пример в `.env.example`).
   - **`REDIS_URL`**: внутри Compose — `redis://redis:6379` (сервис `redis`).
   - **Публичные URL** (без фиксированного домена в коде):
     - `APP_URL=https://YOUR_DOMAIN`
     - `AUTH_URL` / `NEXTAUTH_URL` — тот же базовый URL, что и у пользователей.
     - `NEXT_PUBLIC_APP_URL` — публичный origin для фронтенда (только то, что безопасно отдавать в браузер).
   - **Порт публикации приложения** на хост: `APP_PUBLISH_PORT=3000` (или другой свободный; Nginx будет проксировать на `127.0.0.1:этот_порт`).

4. **Обязательные для старта приложения переменные** (проверяются при запуске, см. `src/lib/env.ts` и `instrumentation.ts`):

   - `DATABASE_URL`, `AUTH_SECRET` (или `NEXTAUTH_SECRET`), `KIE_API_KEY`, `KIE_BASE_URL`, `REDIS_URL`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET` — и остальные из `.env.example`, нужные S3/платежам, если вы их включаете.

5. **Не кладите** реальные секреты в репозиторий — см. [Что нельзя хранить в Git](#что-нельзя-хранить-в-git).

6. **Сборка в Docker-образе** использует `SKIP_ENV_VALIDATION=1` только на стадии `docker build` (см. `Dockerfile`); **в рантайме** контейнера `SKIP_ENV_VALIDATION` **не** задавайте, чтобы валидация сработала.

## Сборка и запуск (docker compose)

Сборка образов, запуск в фоне, пересборка при изменении кода:

```bash
docker compose up -d --build
```

- Сервисы: **`app`** (Next.js), **`postgres`**, **`redis`**, **`worker`** (очередь генераций). Данные БД — в volume `postgres_data`, Redis AOF — в `redis_data`.
- У `app` настроен **healthcheck** на `GET /api/health` (ожидается HTTP 200, когда `status: "ok"` в теле — см. ниже).

Остановка контейнеров (тома по умолчанию **сохраняются**):

```bash
docker compose down
```

## Миграции Prisma

Production-образ **`app`** (stage `runner` в `Dockerfile`) — **standalone** Next.js, в образ **не** входит Prisma CLI. Миграции применяют **с хоста** или **одноразовым контейнером Node** в той же сети, что и `docker compose`, чтобы `DATABASE_URL` с хостом `postgres` оставался корректным.

**Практичный вариант** (каталог с полным `package.json` и `prisma/`, смонтированный в контейнер):

```bash
docker compose run --rm --env-file .env -v "$(pwd)":/work -w /work node:20-alpine sh -c \
  "apk add --no-cache libc6-compat openssl && npm ci && npx prisma migrate deploy"
```

(На Windows в PowerShell путь вместо `$(pwd)` задайте явно, например `C:/path/to/app`.)

**Альтернатива**: установить **Node 20+** на VPS, в корне репозитория после `npm ci` выполнить `npx prisma migrate deploy` с тем же `DATABASE_URL`, что и в `.env` для Docker (с хоста для доступа к `postgres` может понадобиться **проброс порта 5432** на `127.0.0.1` в отдельном `docker-compose.override.yml` — только для администрирования, не публикуйте БД в интернет).

## Создание SUPER_ADMIN

Скрипт: `scripts/seed-admin.ts`, npm-скрипт: `db:seed:admin`. Создаёт/обновляет пользователя с ролью `SUPER_ADMIN` по переменным **`SUPER_ADMIN_EMAIL`** и **`SUPER_ADMIN_PASSWORD`** из `.env` (см. комментарии в скрипте; в production задайте **длинный** пароль и не оставляйте дефолты).

Через одноразовый Node-контейнер (сеть Compose, `DATABASE_URL` с `postgres`):

```bash
docker compose run --rm --env-file .env -v "$(pwd)":/work -w /work node:20-alpine sh -c \
  "apk add --no-cache libc6-compat openssl && npm ci && npx tsx scripts/seed-admin.ts"
```

После этого вход: `https://YOUR_DOMAIN/auth/login`, панель админа: путь `/admin` (роли см. `PROJECT_SPEC.md`).

## Настройка Nginx

- Пример **без** захардкоженного домена: `nginx.conf.example` — подставьте `YOUR_HOSTNAME_HERE` (ваш `YOUR_DOMAIN` или поддомен) и пути к сертификатам.
- Типичная схема: Nginx **на хосте** слушает 80/443, `proxy_pass` на **`http://127.0.0.1:3000`**, куда смотрит `APP_PUBLISH_PORT` из `docker-compose.yml`.
- Прокидывайте заголовки: `X-Forwarded-For`, `X-Forwarded-Proto`, `Host` (как в примере) — для корректных ссылок, rate limit по IP и cookies.

## Настройка SSL (HTTPS)

1. **Рекомендуемый** путь: [Let’s Encrypt](https://letsencrypt.org/) (Certbot) или аналог. Получите сертификат для `YOUR_DOMAIN`, укажите `ssl_certificate` / `ssl_certificate_key` в конфиге Nginx (см. комментарии в `nginx.conf.example`).

2. **HTTP-01**: каталог `/.well-known/acme-challenge/` в примере ведёт на `root /var/www/certbot` — настройте пути и права по документации Certbot.

3. Обычно настраивают редирект **HTTP → HTTPS** (в примере в `nginx.conf.example`).

4. **Не** публикуйте приватные ключи и полные цепочки в Git — только пути к файлам на сервере.

## Проверка `/api/health`

- Маршрут: **`GET /api/health`** (без чувствительных данных, только агрегаты: `status`, `database`, `redis`, `timestamp`, имя/версия приложения, версия Node, опциональный короткий build id).
- **HTTP 200** — когда приложение и БД (и при настроенном Redis — и он) в порядке; **503** — деградация или ошибка (см. тело JSON).

С хоста (после Nginx — подставьте свой URL):

```bash
curl -sS "https://YOUR_DOMAIN/api/health"
# или с локалхоста, если Nginx на том же хосте:
curl -sS "http://127.0.0.1:3000/api/health"
```

## Просмотр логов

Приложение (Next.js, stdout/stderr):

```bash
docker compose logs -f app
```

Воркер очереди:

```bash
docker compose logs -f worker
```

Контейнер PostgreSQL (при необходимости отладки):

```bash
docker compose logs -f postgres
```

`Ctrl+C` останавливает «хвост» логов, контейнеры продолжают работать.

## Перезапуск сервисов

- После смены **`.env`** (не секреты в репо): пересоздать и перезапустить:

  ```bash
  docker compose up -d --build
  ```

- Только **перезапуск** без пересборки:

  ```bash
  docker compose restart app
  docker compose restart worker
  ```

## Обновление приложения

1. Забрать новый код: `git pull` (или ваш CI/CD) в `YOUR_APP_DIR`.
2. Пересобрать и поднять: `docker compose up -d --build`.
3. При **новых миграциях** Prisma — выполнить `npx prisma migrate deploy` тем же способом, что в [Миграции Prisma](#миграции-prisma).
4. **Перед обновлением** желательен **бэкап БД** (см. ниже).

## Резервное копирование PostgreSQL (pg_dump)

Регулярно сохраняйте дамп на **отдельный** носитель (другой сервер, object storage, зашифрованный архив), не только на тот же диск.

**Дамп в файл на хост** (замените `backup_$(date +%F).sql` на свой путь; пароль **не** передавайте в URL — используются переменные из контейнера `postgres`):

```bash
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' > backup_$(date +%F).sql
```

**Сжатый** вариант:

```bash
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' | gzip > "backup_$(date +%F).sql.gz"
```

**Рекомендуемая периодичность** (ориентир):

- **Ежедневно** — для production с пользователями и платежами.
- **Перед каждым** деплоем/миграцией/крупным изменением.
- **Помимо** снимков в одном датацентре храните копии **вне** сервера (3-2-1: три копии, два носителя, одна off-site) — в упрощённом виде: копия на другом хранилище или у другого провайдера.

Политика retention (сколько дней хранить дампы) — на ваш риск и объём диска.

## Восстановление PostgreSQL (psql + дамп)

1. Остановить записывающие сервисы (как минимум **`app`** и **`worker`**, чтобы не писать в БД во время заливки), либо работать в окне обслуживания:

   ```bash
   docker compose stop app worker
   ```

2. Подтянуть SQL в контейнер `postgres` (для **plain** SQL):

   ```bash
   docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < backup_YYYY-MM-DD.sql
   ```

3. Для **`.sql.gz`**: `gunzip -c backup_YYYY-MM-DD.sql.gz | docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'`

4. Запустить сервисы снова:

   ```bash
   docker compose start app worker
   ```

5. Проверить **`/api/health`** и критичные сценарии (вход, админ, одна тестовая операция).

**Важно:** восстановление **поверх** существующей БД затирает/конфликтует с текущими данными — в production заранее планируйте, нужен ли **новый** пустой инстанс или `DROP`/пересоздание схемы по инструкции DBA. Этот README не подменяет runbook DBA.

## Где лежат «generated files» и зачем S3

- **Сгенерированные** изображения и видео (результаты Kie.ai), а также загруженные пользователем файлы для пайплайна, по замыслу продукта **не** хранятся постоянно на локальном диске VPS: они попадают в **S3-совместимое** хранилище (R2, S3, Yandex Object Storage и т.д.), см. `S3_*` в `.env` и `PROJECT_SPEC.md`.
- **Почему не диск сервера**: диск VPS ограничен, дорог в масштабировании, хуже вписывается в бэкапы и в отказоустойчивость; объектное хранилище даёт **отдельный** слой для медиа, CDN и политик жизни объектов, без переполнения root volume.

## Что нельзя хранить в Git

- **`.env`**, `*.env.local` и любые файлы с реальными **секретами** (пароли БД, `AUTH_SECRET`, ключи Stripe/Kie, ключи S3, токены вебхуков).
- **Секреты внутри** образа docker: только **переменные окружения** при `docker compose up` (или secret management у оркестратора).
- **Сырой дамп** production-БД, **логи** с PII, **приватные ключи** SSL.
- Каталоги артефактов сборки: **`node_modules`**, **`.next`**, сгенерированный **Prisma Client** (подтягивается `npm ci` / `prisma generate` на сборке), пользовательские загрузки и медиа-результаты.
- **Исключение**: `schema.prisma` и **миграции** в `prisma/migrations` — **должны** быть в репозитории.

---

## Сводка полезных команд

| Действие | Команда |
| -------- | ------- |
| Сборка и запуск | `docker compose up -d --build` |
| Логи приложения | `docker compose logs -f app` |
| Логи воркера | `docker compose logs -f worker` |
| Дамп БД | `docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' > backup_$(date +%F).sql` |
| Восстановление из SQL-файла | `docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < backup_YYYY-MM-DD.sql` |
| Health | `curl -sS "https://YOUR_DOMAIN/api/health"` (или `http://127.0.0.1:3000/api/health`) |

*Имена `YOUR_DOMAIN`, `YOUR_APP_DIR`, `backup_YYYY-MM-DD.sql` заменяйте на свои. Команды с `sh -c` и `$(date +%F)` ориентированы на Linux/macOS; в PowerShell пути и даты адаптируйте вручную.*
