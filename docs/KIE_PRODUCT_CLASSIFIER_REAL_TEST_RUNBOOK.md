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

## 4. Preflight

```bash
docker compose run --rm app npm run smoke:product-card-classifier
```

Или в UI: `/admin/product-card` → **Проверить готовность classifier**

`readyForRealTest=true` только если:

- модель active
- apiModelId не PLACEHOLDER
- endpoint + supportsImageInput
- dry-run chat payload shape OK
- env keys configured
- **`PRODUCT_CLASSIFIER_ALLOW_REAL_KIE=true`** (runtime gate enabled)

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

## 7. UI checks

- [ ] USER не видит slug, apiModelId, endpoint, provider
- [ ] При ошибке Kie — дружелюбное сообщение, ручной выбор категории доступен
- [ ] «Создать карточку» marketplace можно протестировать отдельно (optional)

## 8. Stop conditions — немедленно остановиться если

- Kie списывает неожиданные credits
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

## Связанные файлы

- `src/server/services/productClassifierKieChat.ts`
- `src/server/services/productClassifierFlow.ts`
- `scripts/seed-gemini-3-flash-product-classifier.ts`
- `docs/PRODUCT_CARD_CLASSIFIER_FLOW.md`
