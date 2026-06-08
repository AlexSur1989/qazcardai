# Первый real test: GPT Image 2 Marketplace Card

Безопасный чеклист перед **первым реальным** вызовом Kie.ai для сценария «Карточка товара».

> **Не запускайте real test автоматически.** Только вручную после preflight `Ready` и явного подтверждения.

---

## 1. Preconditions

| Проверка | Где смотреть |
|----------|-------------|
| `KIE_API_KEY` задан | env / preflight → `KIE_API_KEY: configured` |
| `MOCK_KIE=false` | preflight → `MOCK_KIE: false` |
| `KIE_BASE_URL` задан | preflight |
| `S3_PUBLIC_URL` задан (если `UPLOAD_STORAGE=s3`) | preflight |
| `REDIS_URL` + worker (`npm run worker`) | preflight, `docker compose ps` |
| `QUEUE_MODE=redis` (production) | preflight |
| Модель `gpt-image-2-product-marketplace-card` `isActive=true` | `/admin/product-card` → AI status |
| `PRODUCT_CARD_DEFAULT_MARKETPLACE_CARD_MODEL_SLUG` назначен | bindings / preflight |
| Баланс пользователя ≥ final estimate (сейчас **25** токенов при min=25) | `/dashboard/billing` |
| Тестовое фото товара загружено через `/api/uploads` | Product Card UI |

---

## 2. Перед тестом

1. Открыть **[/admin/product-card](/admin/product-card)**.
2. **Product Card AI status** → «Карточка товара» = **Ready**.
3. Блок **Marketplace card pricing**:
   - Model base credits: **12**
   - Minimum marketplace card tokens: **25** (`PRODUCT_CARD_MIN_MARKETPLACE_CARD_TOKENS`)
   - Final user price: **25**
4. Нажать **«Проверить готовность marketplace card»** (preflight) → `readyForRealTest: true`.
5. Открыть модель → **Проверить payload без запуска** (dry-run):
   - `input.input_urls` — **array**
   - `callBackUrl` присутствует
   - `model` = `gpt-image-2-image-to-image`
6. В user flow: **estimate** = **25** токенов.

---

## 3. Real test — вариант A (admin model test)

1. `/admin/models/{id}/edit` → вкладка «Тест модели».
2. **Real Kie test** — только вручную, с подтверждением modal.
3. Проверить:
   - `providerTaskId` / task id в ответе
   - запись в **ApiLog**
   - callback `/api/webhooks/kie` или polling `recordInfo`

---

## 4. Real test — вариант B (user Product Card flow)

1. `/dashboard/create/product-card`
2. Загрузить фото товара.
3. Выбрать **категорию вручную** (classifier пока Missing).
4. Заполнить **«Преимущества и характеристики»** (2–3 факта).
5. **«Проверить план карточки»** → «Карточка готова к созданию».
6. Дождаться **estimate** (25 токенов).
7. **«Создать карточку»** (не нажимать без достаточного баланса).
8. Следить за **Generation** status в истории.

---

## 5. После теста

| Результат | Ожидание |
|-----------|----------|
| **COMPLETED** | `outputFiles` с URL; `confirmCredits` (CAPTURE); файл в S3/local storage |
| **FAILED** | `refundCredits` → баланс восстановлен; RESERVE + REFUND в CreditTransaction |
| ApiLog | запрос createTask + статус |
| История | `/dashboard/history/{generationId}` |

Проверить CreditTransaction: **RESERVE** → **CAPTURE** (success) или **RESERVE** → **REFUND** (failure).

---

## 6. Stop conditions (остановить расследование)

- Kie auth error (`401` / invalid key)
- Неверный `endpoint` / `apiModelId`
- `input_urls` rejected (не array / URL недоступен Kie)
- S3 URL не публично достижим для Kie
- Callback не пришёл и polling `recordInfo` падает
- При FAILED нет **REFUND** (критичный баг)

---

## 7. Rollback / refund — код (проверено статически)

### reserveCredits не прошёл

`productCardQueueGenerations.queueProductCardImage`:

- Сначала создаётся `Generation`.
- `reserveCredits` в `try/catch`.
- При ошибке → **`generation.delete`** — запись не остаётся, баланс не менялся.

### Kie createTask / worker failure

`generationProcessor.markFailed`:

- `refundCredits(genId)` (если был RESERVE)
- `Generation.status = FAILED`

Вызывается из worker при ошибках провайдера и при исчерпании retries (`markGenerationExhausted`).

### Success

`completeWithOutput` / success path:

- `confirmCredits` → CAPTURE (баланс уже уменьшен на RESERVE)
- `outputFiles` сохраняются (S3 mirror при настроенном storage)

### Webhook Kie

Обрабатывается в webhook route — при failure должен приводить к `markFailed` / refund (проверить логи при первом real test).

### Известные TODO / слабые места

- **Generation создаётся до reserveCredits** — при редком сбое между create и reserve возможна orphan Generation без RESERVE (маловероятно; delete на fail).
- **Production без S3**: `generationProcessor` может блокировать COMPLETED без mirror — проверить env перед real test.
- **MOCK_KIE=true**: real Kie не вызывается — preflight блокирует `readyForRealTest`.

---

## 8. Связанные команды

```bash
# Preflight (без Kie) — через UI или API:
POST /api/admin/product-card/preflight/marketplace-card

# Verify (CI/local, без Kie):
npm run verify:product-card-model-setup

# Verify на production Docker:
docker compose run --rm app npm run verify:product-card-model-setup
```

Сервер **не обновлять** без отдельного деплоя.

---

## 9. Перед нажатием Real test вручную

> **Нельзя нажимать Real test, если preflight не Ready** (`readyForRealTest: false`).

Checklist (записать значения «до теста»):

- [ ] `docker compose run --rm app npm run verify:product-card-model-setup` → **OK**
- [ ] `/admin/product-card` → Product Card AI status: **Marketplace card = Ready**
- [ ] Preflight → **readyForRealTest = true**
- [ ] Тестовый USER-аккаунт: баланс ≥ **25** токенов (записать баланс до теста)
- [ ] Тестовое фото загружено через Product Card flow
- [ ] S3 URL фото открывается **публично** (Kie должен достучаться)
- [ ] `docker compose logs --tail=100 worker` — без ошибок
- [ ] `docker compose logs --tail=100 app` — без ошибок
- [ ] `MOCK_KIE=false`
- [ ] `KIE_API_KEY` = configured (значение не логировать)
- [ ] Redis OK (preflight `redisReachable: ok`)
- [ ] Записать **Generation count** до теста (admin / SQL)
- [ ] Явное подтверждение оператора на списание Kie credits

Только после всех пунктов — Real test (вариант A или B ниже).

---

## 10. First successful production test

**Дата:** 2026-06-08 (production VPS)

| Поле | Значение |
|------|----------|
| Scenario | `PRODUCT_MARKETPLACE_CARD` |
| Model slug | `gpt-image-2-product-marketplace-card` |
| apiModelId | `gpt-image-2-image-to-image` |
| endpoint | `/api/v1/jobs/createTask` |
| statusEndpoint | `/api/v1/jobs/recordInfo` |
| Payload shape | `input.input_urls[]`, `aspect_ratio`, `resolution`, `prompt` |
| Result | **COMPLETED** |
| Billing | RESERVE −25 → CAPTURE 0 |
| Final price | **25 tokens** |
| S3 upload | OK |
| Worker | OK |
| Webhook / polling | OK (`poll/complete`) |

**Audit trail (user flow):**

- generationId: `cmq5mlard00000us8n11rj8o2`
- providerTaskId: `c36ded7b886bdc5343ca2ad68472a8a7`
- user: `utpk-metal@…` (test account)
- balance: 385 → 360

**Admin direct Kie test** (отдельно от user flow): Kie `success`, без Generation / списания в нашей системе.

**Quality note:** pipeline и billing прошли успешно; визуально карточка сохранила товар с исходного фото (автохимия), а пользовательский текст описывал кружку — несоответствие «фото ↔ текст». Для следующих тестов использовать согласованные фото и описание; при необходимости усилить prompt про product identity.

После каждого real test см. [POST_REAL_KIE_TEST_CHECKLIST.md](./POST_REAL_KIE_TEST_CHECKLIST.md).

---

## 11. Deploy checklist

См. [DEPLOY_PRODUCT_CARD_MARKETPLACE_READY.md](./DEPLOY_PRODUCT_CARD_MARKETPLACE_READY.md).
