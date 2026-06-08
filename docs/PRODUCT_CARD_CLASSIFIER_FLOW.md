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
| API `/classify` при Missing | `{ ok: false, error: "Автоматическое распознавание…" }`, HTTP 503 |
| Ошибка распознавания | Клиент выбирает категорию и заполняет поля вручную |
| Classifier Failed (будущий real flow) | Категория «Прочее» или прежний выбор, без блокировки |

## UI flow (`/dashboard/create/product-card`)

1. Клиент загружает фото.
2. Блок **«Распознавание товара»**:
   - Missing → подсказка «скоро будет доступно», ручной `<select>` категории.
   - Ready (или dev mock) → кнопка **«Распознать товар по фото»**.
3. Loading: «ИИ анализирует фото товара…»
4. Результат: **«ИИ предложил данные»** + кнопки **Применить** / **Изменить вручную** / **Распознать заново**.
5. **Применить** → `title`, `selectedCategory`, `categorySource=ai`, benefits в metadata/simpleCard, `classifierConfidence` в metadata.

## API

`POST /api/product-card-projects/[id]/classify`

- Auth + owner project.
- Требует загруженное фото.
- Проверяет readiness `PRODUCT_CLASSIFIER` (через `productCardModelSetup`).
- **Не вызывает Kie.ai** без `PRODUCT_CLASSIFIER_ALLOW_REAL_KIE=true`.

Успех:

```json
{
  "ok": true,
  "result": { "...ProductClassifierResult" }
}
```

Missing model:

```json
{
  "ok": false,
  "error": "Автоматическое распознавание товара пока настраивается. Выберите категорию вручную."
}
```

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

Stub `product-classifier-kie` остаётся inactive / PLACEHOLDER до подключения Kie.

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
```

Проверяют:

- classifier Missing не ломает marketplace Ready;
- setup error без Kie / Generation / CreditTransaction;
- dev mock `home_goods` в development;
- ключ `PRODUCT_CARD_DEFAULT_CLASSIFIER_MODEL_SLUG` поддерживается resolver.
