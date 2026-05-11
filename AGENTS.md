<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Git / сообщения коммитов

Темы и тело **git-коммитов** в этом проекте оформлять **на русском языке** (латиница — только для технических имён при необходимости). Подробнее см. правило Cursor: `.cursor/rules/commit-messages-russian.mdc`.

## Kie / модели генерации

Ниже — **каноничное правило QazCard AI** для любых работ с Kie.ai. Краткая машиночитаемая выжимка для Cursor также в `.cursor/rules/kie-ai-models-sources.mdc`.

### Правило: источники правды для Kie.ai моделей

Для каждой Kie.ai модели нельзя брать настройки «по аналогии», из старой БД, из старых seed-файлов или из текущего UI QazCard.

Каждая модель должна настраиваться только по официальным источникам Kie.ai.

#### Иерархия источников

1. **`docs.kie.ai/market/<model>`** — главный источник для **backend API**:
   - endpoint;
   - `apiModelId` / поле `model` в теле;
   - точные имена полей `input.*`;
   - request body;
   - ответ с идентификатором задачи (в документации Kie — обычно `data.taskId`);
   - статус / recordInfo / callback flow.

2. **`kie.ai/<model-page>` Playground / Run with API** — главный источник для **`settingsSchema`**:
   - полный список UI-полей;
   - select options;
   - upload limits;
   - ограничения между полями;
   - `helpText`;
   - ожидаемые поля;
   - особенности вроде правил resolution / quality / duration.

3. **`docs.kie.ai` Getting Started / Common API** — источник для **общей логики**:
   - async task model;
   - идентификатор задачи;
   - callback vs polling;
   - headers;
   - rate limits;
   - retention policy.

4. **`kie.ai/pricing`** — источник для:
   - `realCost`;
   - `pricingSchema`;
   - себестоимости модели.

#### Что запрещено

Запрещено брать настройки модели из:

- старой БД QazCard;
- старых `settingsSchema`;
- старых seed-файлов;
- скриншотов нашего кабинета;
- догадок ассистента;
- настроек другой версии модели;
- настроек Kling 3.x для Kling 2.6;
- настроек text-to-video для image-to-video, если это разные Kie modes.

#### Если sources отличаются

Если `docs.kie.ai` и `kie.ai` Playground отличаются:

- не угадывать;
- зафиксировать расхождение в комментарии или `metadata`;
- использовать `docs.kie.ai` для точного backend payload;
- использовать Playground для полного списка параметров, options и ограничений;
- добавить или обновить verify script, который проверяет итоговый Kie body.

#### Metadata для каждой AiModel

Для каждой Kie `AiModel` нужно сохранять `metadata` (минимум):

```json
{
  "docsUrl": "https://docs.kie.ai/market/...",
  "playgroundUrl": "https://kie.ai/...",
  "docsCheckedAt": "YYYY-MM-DD",
  "source": "docs.kie.ai + kie.ai playground"
}
```

#### Обязательное правило для AiModel

Каждая Kie.ai модель и режим = **отдельная** строка `AiModel`.

У каждой модели должны быть **индивидуальные**:

- `settingsSchema`;
- `payloadMapping`;
- `pricingSchema`;
- `apiModelId`;
- `endpoint`;
- `statusEndpoint`;
- `supportsImageInput`;
- `supportsVideoInput`;
- `supportsNegativePrompt`;
- `supportsSeed`;
- `maxDuration`, если применимо.

Нельзя делать **одну общую схему** для всех моделей.

#### GPT Image 2

Учитывать, что пример в API docs может быть **неполным**.

**Text-to-image:** в `input` — `prompt`, `aspect_ratio`, `resolution`.

**Image-to-image:** в `input` — `prompt`, `input_urls`, `aspect_ratio`, `resolution`.

**Ограничения** (валидировать на сервере **до** `reserveCredits`):

- если `aspect_ratio = "auto"`, разрешён только `resolution = "1K"`;
- если `aspect_ratio` **отсутствует**, разрешён только `resolution = "1K"`;
- если `aspect_ratio = "1:1"`, нельзя `resolution = "4K"`.

#### Kling 2.6

**Text-to-video:** в `input` — `prompt`, `sound`, `aspect_ratio`, `duration`.

**Image-to-video:** в `input` — `prompt`, `image_urls`, `sound`, `duration`.

Запрещено добавлять поля **Kling 3.x**, в том числе: quality; std/pro; multiShots; first/last frame; duration **15**; любые поля, которых нет в Kie docs/Playground для **Kling 2.6**.

#### Upload logic

Если модель требует файл:

- пользователь загружает через **`POST /api/uploads`**;
- backend сохраняет файл в storage;
- Kie получает **публичный HTTPS URL**;
- пользователь **не** вставляет URL вручную.

Имя поля в **`settingsSchema`** — source of truth: `inputUrls` остаётся `inputUrls`, `imageUrls` — `imageUrls`; нельзя глобально переименовывать все upload-list в `imageUrls`.

#### Payload builder

`buildImageKieInput` и `buildVideoKieInput` должны собирать тело Kie через **`payloadMapping`**, без хаотичных веток по slug.

Целевая схема:

```ts
{
  model: model.apiModelId,
  callBackUrl,
  input: {
    prompt: generation.prompt,
    // только поля из payloadMapping (+ prompt централизованно, как принято в коде)
  }
}
```

В реальный Kie `input` не должны попадать поля вне **`payloadMapping`**.

#### Verify scripts

Для новых или изменённых Kie моделей обязательно добавлять или обновлять verify script. Проверки должны включать (по смыслу задачи):

- active **GENERAL** и корректный `scope`;
- изоляцию **PRODUCT_CARD** и **GENERAL**;
- соответствие `settingsSchema` и `payloadMapping` реестру;
- совпадение итогового Kie body с ожидаемым;
- отсутствие запрещённых полей в payload.

Для **GPT Image 2** verify должен включать случаи: есть `resolution` в T2I и I2I; сочетания `auto + 1K` (ОК); `auto + 2K` / `auto + 4K` отклоняются валидацией; `1:1 + 4K` отклоняется; `16:9 + 4K` допустимо.

Для **Kling 2.6:** T2V содержит `sound`, `aspect_ratio`, `duration`; I2V — `image_urls`, `sound`, `duration`; I2V **без** `aspect_ratio` и **без** `input_urls`; нет полей Kling 3.x.

#### Product-card isolation

`/dashboard/models` — только модели с `scope = GENERAL` и `isActive = true`.

Product-card flow — только модели с `scope = PRODUCT_CARD`.

Нельзя смешивать каталог AI моделей и карточку товара.

#### В конце каждой задачи (деплой)

После изменений кода, моделей Kie, seed, `payloadMapping`, `settingsSchema`, Prisma, Docker и т.д. — ориентироваться на раздел **«Деплой на сервере»** ниже: по умолчанию **не** выдавать длинный блок команд, пока пользователь явно не попросит финальные команды.

**Не предлагать** `docker compose down -v`. **Не удалять** production database. **Не удалять** физически старые `AiModel` при наличии связанных **`Generation`**; архивация через `isActive = false`.

## Деплой на сервере

### Правило: не заставлять деплоить после каждой маленькой задачи

Пользователь может делать **несколько задач подряд** и обновлять сервер **один раз в конце**.

Поэтому после **каждой отдельной** задачи **не** нужно каждый раз писать длинный блок команд для сервера, если пользователь **не** просит деплой прямо сейчас.

Вместо этого после обычной задачи пиши коротко:

```text
Сервер пока не обновляй. Эти изменения можно накопить и задеплоить одним разом после следующих задач.
```

Если изменение **критичное** и требует немедленного действия на production, явно напиши:

```text
ВНИМАНИЕ: это изменение нельзя безопасно откладывать, потому что …
```

(и опиши риск: безопасность, потеря данных, поломка биллинга, несовместимость БД после миграции и т.п.)

---

### Когда выдавать полный блок **`## СДЕЛАЙ ЭТО НА СЕРВЕРЕ`**

Если пользователь пишет, например:

```text
Готово, дай финальные команды для сервера
```

или

```text
Дай команды для деплоя
```

(или очевидный эквивалент — «финальный деплой», «одним блоком команды для VPS» и т.п.) тогда нужно:

1. Посмотреть **все изменённые файлы** (за сессию / накопленный объём работ — по контексту диалога и `git` при необходимости).
2. Определить, что именно менялось:
   - frontend;
   - backend;
   - worker;
   - Prisma schema;
   - migrations;
   - seed scripts;
   - Kie.ai модели;
   - `settingsSchema`;
   - `payloadMapping`;
   - `pricingSchema`;
   - `Dockerfile` / `Dockerfile.worker`;
   - `package.json` / lockfile;
   - env.
3. Дать **один** финальный раздел заголовком **`## СДЕЛАЙ ЭТО НА СЕРВЕРЕ`** (без общих формулировок «если понадобится» — команды должны быть **конкретные и копируемые**, с явными строками вида «миграции не нужны», «seed не нужен», если так).
4. Приложить checklist: backup да/нет, migrate да/нет, seed да/нет, что пересобрать (**app** / **worker** / оба / `--no-cache`), что проверить в браузере (URL из затронутых экранов).

Подставляемый путь в примерах: `cd /path/to/qazcard-ai` (пользователь заменяет на реальный каталог, например `/opt/qazcard`).

**Только изменился `.env`** (без пересборки образа):

```bash
cd /path/to/qazcard-ai
docker compose up -d app worker
docker compose ps
docker compose logs --tail=100 app
docker compose logs --tail=100 worker
```

Если для `migrate deploy` / Prisma CLI в вашем образе недоступен `npx prisma` — использовать способ из **`README_DEPLOY.md`** (одноразовый контейнер Node смонтировать репозиторий).

---

### Как выбирать финальные команды

#### Если менялся только frontend

Например:

- страницы dashboard/admin;
- компоненты;
- стили;
- тексты;

и **не** трогались worker, очередь, Kie-backend, Prisma, сиды, storage — достаточно **app**:

```bash
cd /path/to/qazcard-ai

git pull

docker compose build app

docker compose up -d app

docker compose ps
docker compose logs --tail=100 app
```

#### Если менялся backend, генерации, Kie.ai, storage, upload, queue или worker

```bash
cd /path/to/qazcard-ai

git pull

docker compose build app worker

docker compose up -d app worker

docker compose ps
docker compose logs --tail=100 app
docker compose logs --tail=100 worker
```

#### Если менялись Kie.ai модели, settingsSchema, payloadMapping, pricingSchema или seed scripts

Обязательны **backup** базы и **seed** (и verify, если есть в `package.json`).

```bash
cd /path/to/qazcard-ai

mkdir -p backups

docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' \
  > backups/before-ai-models-$(date +%F-%H%M).sql

git pull

docker compose build app worker

docker compose run --rm app npm run seed:kie-general-models

docker compose run --rm app npm run verify:kie-general-models

docker compose up -d app worker

docker compose ps
docker compose logs --tail=100 app
docker compose logs --tail=100 worker
```

Если команды `seed:kie-general-models` или `verify:kie-general-models` нет в проекте — подставить **существующие** скрипты из `package.json`, например:

```bash
docker compose run --rm app npm run seed:general-kie-image-models

docker compose run --rm app npm run seed:kling
```

Если был добавлен отдельный seed (например HappyHorse):

```bash
docker compose run --rm app npm run seed:happyhorse
```

#### Если изменилась Prisma schema или появились migrations

Обязательны **backup** и **`migrate deploy`**.

```bash
cd /path/to/qazcard-ai

mkdir -p backups

docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' \
  > backups/before-prisma-deploy-$(date +%F-%H%M).sql

git pull

docker compose build app worker

docker compose run --rm app npx prisma migrate deploy

docker compose up -d app worker

docker compose ps
docker compose logs --tail=100 app
docker compose logs --tail=100 worker
```

Если миграций в выкладке **нет** — в тексте блока явно указать:

```text
Prisma migrations не нужны, команду migrate deploy не запускаем.
```

#### Если менялись package.json, package-lock.json, Dockerfile или Dockerfile.worker

Полная пересборка **app** и **worker**:

```bash
cd /path/to/qazcard-ai

git pull

docker compose build --no-cache app worker

docker compose up -d app worker

docker compose ps
docker compose logs --tail=100 app
docker compose logs --tail=100 worker
```

#### Если менялось всё сразу

Например: backend + Kie + seed + Prisma + зависимости — выбрать **максимально безопасный** состав (backup + `--no-cache` + migrate при необходимости + нужные seed/verify):

```bash
cd /path/to/qazcard-ai

mkdir -p backups

docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' \
  > backups/before-full-deploy-$(date +%F-%H%M).sql

git pull

docker compose build --no-cache app worker

docker compose run --rm app npx prisma migrate deploy

docker compose run --rm app npm run seed:kie-general-models

docker compose run --rm app npm run verify:kie-general-models

docker compose up -d app worker

docker compose ps
docker compose logs --tail=100 app
docker compose logs --tail=100 worker
```

Если **`migrate deploy` не нужен** — добавить явную строку в блок:

```text
Prisma migrations не нужны, команду migrate deploy не запускаем.
```

Если **seed не нужен**:

```text
Seed не нужен.
```

**(и вычеркнуть/не включать соответствующие строки команд).**

---

### Запрещено

Не предлагать:

```bash
docker compose down -v
```

Не удалять production database.

Не удалять старые `AiModel` физически, если есть связанные **`Generation`**.

Не запускать destructive scripts без отдельного предупреждения.

---

### Шаблон структуры блока **`## СДЕЛАЙ ЭТО НА СЕРВЕРЕ`** (напоминание)

- Что изменилось (bullet list).
- Backup: да / нет и почему.
- Migrate: да / нет (или строка «не запускаем»).
- Seed: да / нет (или строка «не нужен») и точные имена npm-скриптов из `package.json`.
- Пересборка: `app` / `worker` / оба / `--no-cache`.
- Готовый `bash` без местоимений «если понадобится».
- Проверка: `docker compose ps`, хвосты логов, релевантные URL (`/dashboard/models`, `/admin/models`, `/dashboard/create/product-card` и т.д.).

---

### Особые случаи QazCard AI (кратко)

- Kie-модели / сиды → почти всегда **backup** + **seed** (+ **verify**, если есть).
- Prisma → **backup** + **`migrate deploy`** (когда есть миграции).
- Генерации / воркер / очередь / Kie backend / uploads / S3 → **app и worker**.
- Только UI без затронутого backend-контура → см. блок «только frontend» выше.

**Загрузки / S3 / `generationProcessor` / Kie / uploads** — в блоке проверки указать загрузку файлов, историю генераций, токены, при необходимости `/admin/storage`, `/admin/models`.

**При сомнении** выбрать безопасный вариант: backup + пересборка **app worker** + явно перечислить, какие строки удалить если migrate/seed не применимы.

---

### Главное

После **обычной** маленькой задачи заканчивать так:

```text
Сервер пока не обновляй. Эти изменения можно накопить и задеплоить одним разом после следующих задач.
```

Допустим короткий вариант того же смысла: «Сервер пока не обновляй. Накопим изменения и задеплоим одним разом.»

Полный блок **`## СДЕЛАЙ ЭТО НА СЕРВЕРЕ`** с командами — **только** когда пользователь **прямо** попросил, например: «Готово, дай финальные команды для сервера» или «Дай команды для деплоя».

Полная пошаговая документация деплоя: **`README_DEPLOY.md`**.