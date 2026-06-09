# Product Card Classifier Flow

## Что делает classifier

Распознавание товара по фото — **предложение ИИ**, не финальное решение:

- определяет **категорию** (`category`, `categoryLabel`);
- предлагает **название** (`productTitle`);
- описывает **что видно на фото** (`visibleProduct`);
- предлагает **преимущества** (`suggestedBenefits`);
- может вернуть **атрибуты** (`detectedAttributes`) и **предупреждения** (`warnings`);
- показывает **уверенность** простым текстом (не процентами в UI).

Стандартный тип ответа: `ProductClassifierResult` (`src/lib/product-classifier-result.ts`).

## Что classifier НЕ делает

- **Не блокирует** клиента — ручной выбор категории всегда доступен.
- **Не запрещает** генерацию marketplace-карточки.
- **Не гарантирует** 100% точность.
- **Не заменяет** решение клиента — все поля можно изменить.
- **Не создаёт** marketplace `Generation` и **не списывает** 25 токенов за карточку.
- **Не показывает** USER slug модели, provider, endpoint, `apiModelId`, `payloadMapping`.

## Fallback

| Состояние | Поведение |
|-----------|-----------|
| `PRODUCT_CLASSIFIER` Missing / Inactive / Misconfigured | Кнопка «Распознать товар» скрыта/disabled, текст про ручной выбор категории |
| Модель active, но `PRODUCT_CLASSIFIER_ALLOW_REAL_KIE !== "true"` | **ConfiguredDisabled** — для USER not ready; текст «скоро будет доступно»; preflight `readyForRealTest=false` |
| API `/classify` при not ready | `{ ok: false, code: "setup", error: "Автоматическое распознавание…" }`, HTTP 503 |
| Ошибка распознавания | Клиент выбирает категорию и заполняет поля вручную |
| Classifier Failed (real flow) | Категория «Прочее» или прежний выбор, без блокировки |

## Runtime gate

Модель classifier может быть **настроена и active** в admin (`/admin/models`, dry-run OK), но **real Kie вызовы запрещены**, пока в окружении app не установлено:

```env
PRODUCT_CLASSIFIER_ALLOW_REAL_KIE=true
```

Правила:

- **Admin** видит slug, `apiModelId`, endpoint, `costCredits` и статус runtime gate (`enabled` / `disabled`).
- **USER** не видит кнопку «Распознать товар по фото», пока gate выключен — только текст «Автоматическое распознавание товара скоро будет доступно…» и ручной выбор категории.
- **Preflight** (`/admin/product-card` → «Проверить готовность classifier»): `readyForRealTest=false`, пока gate выключен — даже если модель active.
- **POST /classify** возвращает setup error (503) без технических полей — защита от случайного Kie.ai расхода.
- Marketplace flow (25 tokens, «Проверить план карточки») **не блокируется**.

Readiness statuses для classifier:

| Status | Условие |
|--------|---------|
| Missing / Inactive | Модель не назначена, не найдена или `isActive=false` |
| ConfiguredDisabled | Модель active + конфиг OK, но runtime gate off |
| Ready | Модель active + конфиг OK + `PRODUCT_CLASSIFIER_ALLOW_REAL_KIE=true` |

## UI flow (`/dashboard/create/product-card`)

1. Клиент загружает фото.
2. Блок **«Распознавание товара»**:
   - Missing / Inactive / gate disabled → подсказка «скоро будет доступно», ручной `<select>` категории.
   - Ready (модель active **и** runtime gate enabled; или dev mock) → кнопка **«Распознать товар по фото»**.
3. Loading: «ИИ анализирует фото товара…»
4. Результат: **«ИИ предложил данные»** + кнопки **Применить** / **Изменить вручную** / **Распознать заново**.
5. **Применить** → `title`, `selectedCategory`, `categorySource=ai`, benefits в metadata/simpleCard, `classifierConfidence` в metadata.

## Commercial safety (AppSettings)

Помимо runtime gate в `.env`, доступ и биллинг управляются AppSettings (группа `classifier`, блок **Classifier access & pricing** в `/admin/product-card`):

| Key | Default | Назначение |
|-----|---------|------------|
| `PRODUCT_CLASSIFIER_ACCESS_MODE` | `disabled` | `disabled` · `admin_only` · `beta_users` (TODO) · `all_users` |
| `PRODUCT_CLASSIFIER_COST_CREDITS` | `1` | Списание внутренних токенов за успешное Kie-распознавание |
| `PRODUCT_CLASSIFIER_DAILY_LIMIT` | `10` | Лимит Kie-попыток на USER за 24ч (Redis) |
| `PRODUCT_CLASSIFIER_COOLDOWN_SECONDS` | `10` | Пауза между попытками |

**USER-ready** (кнопка «Распознать»):

```
model active (Ready)
× PRODUCT_CLASSIFIER_ALLOW_REAL_KIE=true
× PRODUCT_CLASSIFIER_ACCESS_MODE=all_users
× balance ≥ cost (если cost > 0)
× daily limit / cooldown (на запросе)
```

Даже при `all_users` и active model, без env gate classifier **не работает** для USER.

### Billing

- Цена classifier **отдельна** от marketplace card (25 tokens).
- Перед Kie: **RESERVE** → успех: **CAPTURE** → ошибка Kie/parse: **REFUND**.
- Без `Generation`: `CreditTransaction.metadata.operationRef` + `kind=product_classifier`.
- Setup/gate/access errors **не списывают** токены.

### Audit

Попытки пишутся в `ApiLog` (`provider=QAZCARD_CLASSIFIER`) без секретов и полных URL.

## API

`POST /api/product-card-projects/[id]/classify`

- Auth + owner project.
- Требует загруженное фото.
- Проверяет readiness, runtime gate, access mode, limits, balance.
- **Не вызывает Kie.ai** без `PRODUCT_CLASSIFIER_ALLOW_REAL_KIE=true`.

Успех:

```json
{
  "ok": true,
  "result": { "...ProductClassifierResult" },
  "billing": { "credits": 1 }
}
```

Missing model / gate disabled / access disabled:

```json
{
  "ok": false,
  "code": "setup",
  "error": "Автоматическое распознавание товара пока настраивается. Выберите категорию вручную."
}
```

Недостаточно токенов: HTTP **402**, `code: "insufficient_credits"`.

Daily limit / cooldown: HTTP **429**, `code: "daily_limit"` / `"cooldown"`.

## Dev mock (только development)

URL: `/dashboard/create/product-card?classifierMock=home_goods`

- Включает UI classifier и mock-ответ без Kie.ai.
- На **production** query игнорируется (`NODE_ENV !== development`).

Preset mock: `home_goods`, `apparel`, `electronics` — см. `productClassifierFlow.ts`.

## Model resolver

`resolveDefaultProductClassifierModel()` — slug из `PRODUCT_CARD_DEFAULT_CLASSIFIER_MODEL_SLUG`.

Требования Ready:

- `scope = PRODUCT_CARD`
- `productCardModelType = PRODUCT_CLASSIFIER`
- `isActive = true`
- валидный `apiModelId`, `endpoint`, `payloadMapping`, `pricingSchema`

Stub `product-classifier-kie` остаётся inactive / PLACEHOLDER (legacy). Кандидат для real test: **`gemini-3-flash-product-classifier`**.

## Gemini 3 Flash classifier candidate

**Kie endpoint:** `POST /gemini-3-flash/v1/chat/completions`  
**apiModelId:** `gemini-3-flash`  
**Adapter:** chat/completions (синхронный ответ, без worker / polling / Generation)

### Payload structure

```json
{
  "model": "gemini-3-flash",
  "stream": false,
  "response_format": { "type": "json_object" },
  "messages": [
    { "role": "system", "content": "..." },
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "..." },
        { "type": "image_url", "image_url": { "url": "https://..." } }
      ]
    }
  ]
}
```

- **image_url input:** публичный HTTPS URL фото товара (или data URL с сервера, если локальный storage).
- **Ответ:** `choices[0].message.content` — JSON (может быть в ```json fences).

### Expected JSON → ProductClassifierResult

См. `normalizeProductClassifierResult()` в `productClassifierKieChat.ts`.

### Normalization rules

- `category` — один из `MANUAL_PRODUCT_CATEGORY_OPTIONS`; неизвестная → **`universal`**
- `confidence` — clamp 0..1
- `suggestedBenefits` — max **7**
- `detectedAttributes` — max **10**
- пустые строки удаляются
- USER не видит технические ошибки Kie/parse

### Error fallback

| Ошибка | USER message |
|--------|----------------|
| Kie HTTP / network | «Не удалось распознать товар. Выберите категорию вручную или попробуйте позже.» |
| JSON parse fail | «Не удалось разобрать результат распознавания. Выберите данные вручную.» |
| Missing / inactive | «Автоматическое распознавание товара пока настраивается…» |

### Real test

**Запрещён** без отдельного подтверждения. См. `docs/KIE_PRODUCT_CLASSIFIER_REAL_TEST_RUNBOOK.md`.

Сервисный слой: `src/server/services/productClassifierKieChat.ts` (отдельно от `generationProcessor`).

Seed: `npm run seed:gemini-3-flash-product-classifier`  
Preflight: `/admin/product-card` → «Проверить готовность classifier»

## Admin status (`/admin/product-card`)

| Readiness | Текст |
|-----------|-------|
| Missing / Inactive / Misconfigured | **Распознавание товара — не подключено** |
| Ready | **Распознавание товара — готово** |

Admin hints (только админка): slug, apiModelId, costCredits, dry-run link.

## Будущее подключение Kie model

Перед real test вручную:

1. Документация Kie: `docs.kie.ai/market/<model>` + Playground.
2. Заполнить `apiModelId`, `endpoint`, `statusEndpoint`, `payloadMapping`, `settingsSchema`, `pricingSchema`.
3. Активировать модель, назначить slug в `PRODUCT_CARD_DEFAULT_CLASSIFIER_MODEL_SLUG`.
4. Verify: `npm run verify:product-card-model-setup`
5. Dry-run в `/admin/models/[id]/edit?tab=dry-run`
6. Preflight / response mapping для `ProductClassifierResult`
7. Установить `PRODUCT_CLASSIFIER_ALLOW_REAL_KIE=true` **только** для controlled real test
8. Real test — **только вручную** через UI/admin, не через CI scripts

## Verify / smoke

```bash
npm run verify:product-card-model-setup
npm run smoke:product-card-marketplace
npm run smoke:product-card-classifier
```

Проверяют:

- classifier Missing не ломает marketplace Ready;
- setup error без Kie / Generation / CreditTransaction;
- dev mock `home_goods` в development;
- chat/completions dry-run payload (если модель seeded);
- ключ `PRODUCT_CARD_DEFAULT_CLASSIFIER_MODEL_SLUG` поддерживается resolver.
