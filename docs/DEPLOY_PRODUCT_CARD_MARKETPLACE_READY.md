# Deploy: Product Card Marketplace Card Ready

Чеклист безопасного деплоя изменений **Product Card marketplace card** (preflight, pricing UX, runbook).

> **Real Kie test и user-генерацию не запускать** на этом этапе. Цель — убедиться, что окружение готово к ручному real test позже.

---

## 1. Перед деплоем

### Репозиторий

```bash
cd /opt/qazcard   # или ваш путь к проекту

git status        # working tree clean
git log -1 --oneline
# Ожидаемый commit: docs: add Product Card marketplace deploy checklist (или новее)
```

### Backup базы (обязательно перед seed)

```bash
mkdir -p backups

docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' \
  > backups/before-product-card-marketplace-$(date +%F-%H%M).sql
```

### Env (без вывода секретов)

Проверить **наличие** переменных, не печатая значения:

```bash
# Только configured / missing — значения не показываем
for key in MOCK_KIE KIE_API_KEY KIE_BASE_URL S3_PUBLIC_URL REDIS_URL DATABASE_URL; do
  if grep -q "^${key}=" .env 2>/dev/null; then
    echo "${key}=configured"
  else
    echo "${key}=missing"
  fi
done
```

| Переменная | Ожидание на production |
|------------|------------------------|
| `MOCK_KIE` | `false` (или отсутствует) |
| `KIE_API_KEY` | configured |
| `KIE_BASE_URL` | configured |
| `S3_PUBLIC_URL` | configured (если `UPLOAD_STORAGE=s3`) |
| `REDIS_URL` | configured (в Compose переопределяется на `redis://redis:6379`) |
| `DATABASE_URL` | host **`postgres`** (для контейнеров) |

### Prisma migration

**Prisma migration не требуется** для коммитов preflight/deploy checklist: `prisma/schema.prisma` и каталог `prisma/migrations/` в этих изменениях не менялись.

Команда `migrate deploy` **не запускаем**, если после `git pull` не появились новые файлы в `prisma/migrations/`.

---

## 2. Деплoy app + worker

```bash
cd /opt/qazcard

git pull

docker compose build app worker

docker compose up -d app worker

docker compose ps
docker compose logs --tail=100 app
docker compose logs --tail=100 worker
```

Ожидание: `app` и `worker` в статусе **Up**, `app` healthcheck **healthy**.

---

## 3. Seed (после деплоя, idempotent)

Скрипты существуют в `package.json`. Запускать **внутри Docker**, чтобы `DATABASE_URL` с хостом `postgres` резолвился.

```bash
docker compose run --rm app npm run seed:qazcard-product-card-models
docker compose run --rm app npm run seed:gpt-image-2-product-marketplace-card
```

| Script | Назначение |
|--------|------------|
| `seed:qazcard-product-card-models` | Inactive stubs (Classifier, Concept, Marketplace stub, Video). Без удалений. |
| `seed:gpt-image-2-product-marketplace-card` | Upsert `gpt-image-2-product-marketplace-card`, dry-run, activate, **AppSetting** `PRODUCT_CARD_DEFAULT_MARKETPLACE_CARD_MODEL_SLUG` |

Seed **не вызывает Kie.ai**. Повторный запуск безопасен (upsert).

После seed в `/admin/product-card` ожидается:

| Слот | Статус |
|------|--------|
| Marketplace card | **Ready** |
| Classifier | **Missing** |
| Concept | **Missing** |
| Video | **Missing** |

---

## 4. Verify (read-only, без Kie)

**Рекомендуемая команда (production Docker):**

```bash
docker compose run --rm app npm run verify:product-card-model-setup
```

Почему **`run --rm app`**, а не `exec`:

- одноразовый контейнер с тем же `env_file`, сетью Compose и `DATABASE_URL` (`postgres:5432`);
- не требует, чтобы `app` уже был healthy;
- скрипты и `tsx` уже в образе `app` (`Dockerfile` копирует `scripts/`, `src/`).

Альтернатива, если `app` уже запущен:

```bash
docker compose exec app npm run verify:product-card-model-setup
```

Verify **не** вызывает Kie.ai, **не** создаёт Generation/CreditTransaction, **не** меняет балансы.

Ожидание: `[verify:product-card-model-setup] OK`, marketplace slot **Ready**, `input_urls` array confirmed, final estimate **25** (при min=25, costCredits=12).

---

## 5. После деплоя — ручные проверки (без генерации)

### Health

```bash
curl -sf http://127.0.0.1:3000/api/health && echo OK
```

(Порт — ваш `APP_PUBLISH_PORT`, по умолчанию 3000.)

### Admin UI

1. **[/admin/product-card](/admin/product-card)**
   - Product Card AI status → Marketplace card = **Ready**
   - Marketplace card pricing: base **12**, min **25**, final **25**
   - **Preflight** → «Проверить готовность marketplace card» → `readyForRealTest: true` (если env production-ready)

### User UI (без нажатия «Создать карточку»)

2. **[/dashboard/create/product-card](/dashboard/create/product-card)**
   - Загрузить фото (можно)
   - Выбрать категорию, заполнить преимущества
   - Дождаться estimate **25 токенов**
   - Блок «Перед созданием карточки» — без slug модели / apiModelId / endpoint
   - **Не нажимать** «Создать карточку»

---

## 6. Stop conditions (остановить деплой / не переходить к real test)

- `app` unhealthy или не отвечает `/api/health`
- `worker` не в статусе Up / ошибки в логах
- `verify:product-card-model-setup` **FAIL**
- Preflight `readyForRealTest: false` (KIE keys, MOCK_KIE, S3, Redis)
- Marketplace card ≠ **Ready**
- Redis недоступен при `QUEUE_MODE=redis`
- `S3_PUBLIC_URL` missing при S3 storage
- `KIE_API_KEY` / `KIE_BASE_URL` missing

---

## 7. Rollback (без `docker compose down -v`)

```bash
cd /opt/qazcard

git checkout <previous-commit-hash>   # например commit до deploy checklist

docker compose build app worker
docker compose up -d app worker

docker compose ps
docker compose logs --tail=50 app
docker compose logs --tail=50 worker
```

- **Не** выполнять `docker compose down -v` — volume Postgres сохранить.
- При необходимости восстановить БД из `backups/before-product-card-marketplace-*.sql`.

---

## 8. Связанные документы

- [FIRST_REAL_KIE_MARKETPLACE_CARD_TEST.md](./FIRST_REAL_KIE_MARKETPLACE_CARD_TEST.md) — runbook первого real Kie test (только вручную)
- [README_DEPLOY.md](../README_DEPLOY.md) — общий деплой, backup, migrate

---

## 9. Краткая шпаргалка (копировать на сервер)

```bash
cd /opt/qazcard
mkdir -p backups
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' \
  > backups/before-product-card-marketplace-$(date +%F-%H%M).sql
git pull
docker compose build app worker
docker compose up -d app worker
docker compose run --rm app npm run seed:qazcard-product-card-models
docker compose run --rm app npm run seed:gpt-image-2-product-marketplace-card
docker compose run --rm app npm run verify:product-card-model-setup
curl -sf http://127.0.0.1:3000/api/health && echo OK
```

Prisma migration не требуется. Real Kie test не запускать.
