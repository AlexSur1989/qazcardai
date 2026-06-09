# Kie Product Classifier — Real Test Runbook

Real classifier test **запрещён** без явного подтверждения. Этот документ — чеклист для controlled test на production/staging.

## 1. Preconditions

- [ ] Marketplace card flow работает (`PRODUCT_MARKETPLACE_CARD` Ready)
- [ ] `KIE_API_KEY`, `KIE_BASE_URL`, `S3_PUBLIC_URL` настроены
- [ ] `MOCK_KIE=false` на production
- [ ] Backup БД перед активацией модели
- [ ] Тестовый USER с балансом (classifier пока **не** списывает marketplace 25 tokens, но может списать classifier credits позже)
- [ ] **`PRODUCT_CLASSIFIER_ALLOW_REAL_KIE=true`** в окружении app перед real test (без gate USER не видит кнопку classifier)

## 2. Seed

```bash
docker compose run --rm app npm run seed:gemini-3-flash-product-classifier
```

Ожидается:

- slug: `gemini-3-flash-product-classifier`
- `isActive=false` после seed
- `PRODUCT_CARD_DEFAULT_CLASSIFIER_MODEL_SLUG=gemini-3-flash-product-classifier`
- dry-run payload OK, **без** Kie call

## 3. Activate model

Только после preflight OK:

1. `/admin/models` → **Gemini 3 Flash — Product Classifier** → Edit
2. Проверить: `apiModelId=gemini-3-flash`, `endpoint=/gemini-3-flash/v1/chat/completions`, `supportsImageInput=true`
3. **Тест модели** → «Проверить classifier payload без запуска»
4. Активировать модель (`isActive=true`) — **только** если dry-run без critical warnings

## 4. Preflight & commercial settings

Перед включением для USER проверить `/admin/product-card` → **Classifier access & pricing**:

- [ ] `PRODUCT_CLASSIFIER_ACCESS_MODE=disabled` (до осознанного go-live)
- [ ] `PRODUCT_CLASSIFIER_COST_CREDITS=1` (или согласованная цена)
- [ ] `PRODUCT_CLASSIFIER_DAILY_LIMIT=10`
- [ ] `PRODUCT_CLASSIFIER_COOLDOWN_SECONDS=10`

```bash
docker compose run --rm app npm run smoke:product-card-classifier
```

Или в UI: `/admin/product-card` → **Проверить готовность classifier**

`readyForRealTest=true` — controlled admin real test (gate + model + env keys).

`readyForUserTraffic=true` — только если gate **enabled** и `accessMode=all_users`.

Пока gate выключен: admin status **ConfiguredDisabled**, USER — manual fallback, preflight **false**.

## 5. Test user / project

- USER: тестовый аккаунт (не production admin-only)
- Создать project с **реальным** фото товара на S3 (HTTPS URL доступен Kie)
- **Не** запускать marketplace generation в том же тесте без необходимости

## 6. Real classifier test (manual only)

1. Временно установить `PRODUCT_CLASSIFIER_ALLOW_REAL_KIE=true` в окружении app (**не** коммитить в `.env` repo)
2. Перезапустить **только** `app` (worker не нужен)
3. `/dashboard/create/product-card` → загрузить фото → **Распознать товар по фото**
4. Проверить `ProductClassifierResult` в UI
5. **Применить** → title, category, benefits заполняются
6. Проверить в БД: **нет** новой `Generation`, **нет** marketplace `CreditTransaction` на 25 tokens
7. Если `PRODUCT_CLASSIFIER_COST_CREDITS>0` и access mode разрешает USER — проверить списание **1** токена (RESERVE→CAPTURE), не 25

## 7. UI checks

- [ ] USER не видит slug, apiModelId, endpoint, provider
- [ ] При ошибке Kie — дружелюбное сообщение, ручной выбор категории доступен
- [ ] «Создать карточку» marketplace можно протестировать отдельно (optional)

## 8. Stop conditions — немедленно остановиться если

- Kie списывает неожиданные credits
- Classifier billing не работает (RESERVE без CAPTURE/REFUND) → **gate off**
- Создаётся `Generation` / worker job для classifier
- Marketplace flow ломается
- JSON consistently invalid → рассмотреть **Gemini 3 Pro** как fallback

## 9. Rollback / deactivate

1. **`PRODUCT_CLASSIFIER_ALLOW_REAL_KIE=false`** или удалить переменную — немедленно отключает real Kie для USER и preflight
2. Деактивировать модель (`isActive=false`) в `/admin/models` при необходимости
3. `docker compose up -d app`
4. Verify: classifier slot → ConfiguredDisabled или Inactive, marketplace остаётся Ready

```bash
docker compose run --rm app npm run verify:product-card-model-setup
docker compose run --rm app npm run smoke:product-card-marketplace
```

## Paid classifier test attempt: fetch failed / refund verified

**Дата:** 2026-06-09 (production, controlled test после commercial safety `5bfcc87`).

| Параметр | Значение |
|----------|----------|
| accessMode | `admin_only` |
| cost | 1 QazCard token |
| gate | временно `PRODUCT_CLASSIFIER_ALLOW_REAL_KIE=true`, затем restore backup → **disabled** |
| test account | SUPER_ADMIN (admin panel), project с фото автохимии (MITSUJI Oil Film Cleaner) |

### Результат

- Real Kie HTTP attempt: **1** (endpoint `gemini-3-flash/v1/chat/completions`)
- Ответ Kie: **`fetch failed`** (transient network при старте/rebuild app; позже из контейнера endpoint отвечал HTTP 200)
- Classifier API: **502** `code=kie`
- Success path (**CAPTURE 0**, apply, `categorySource=ai`) — **не достигнут**, pending retry

### Billing (verified on failure)

- **RESERVE −1** → Kie error → **REFUND +1**
- Net QazCard balance change: **0**
- **Generation не создана**
- Marketplace generation **не запускалась**
- «Создать карточку» **не нажималась**

### Bugfix перед retry

До успешного real test был найден баг: `isProductClassifierReady()` ошибочно требовал `autoClassifyReady` (`all_users`), из‑за чего `admin_only` получал **503 setup** без вызова Kie. Исправлено на `generationReady` + отдельная проверка access mode (commit после этого runbook).

### Before retry checklist

- [ ] Readiness fix закоммичен
- [ ] `npm run verify:product-card-model-setup` + `smoke:product-card-classifier` OK
- [ ] Gate **disabled** до явного подтверждения
- [ ] Backup `.env` перед включением gate
- [ ] Один controlled POST `/classify`, затем gate off

## Связанные файлы

- `src/server/services/productClassifierKieChat.ts`
- `src/server/services/productClassifierFlow.ts`
- `scripts/seed-gemini-3-flash-product-classifier.ts`
- `docs/PRODUCT_CARD_CLASSIFIER_FLOW.md`
- `docs/PRODUCT_CLASSIFIER_COMMERCIAL_SAFETY.md`
