# Чеклист импорта Kie.ai модели (Product Card)

Пошаговая инструкция для владельца проекта QazCard AI.

## 1. Где взять данные в документации Kie.ai

Для каждой модели откройте:

- **docs.kie.ai/market/\<model\>** — backend API (главный источник)
- **kie.ai/\<model-page\>** — Playground (полный список UI-полей)

Нужно собрать:

| Поле | Где искать |
|------|------------|
| **Model ID** (`apiModelId`) | Поле `model` в теле createTask |
| **Endpoint createTask** | Обычно `POST /api/v1/jobs/createTask` |
| **Status / recordInfo** | Общая документация Kie + страница модели |
| **Пример JSON payload** | Run with API / пример в docs |
| **Поля `input.*`** | `prompt`, `image_url` / `image_urls` / `input_urls`, `aspect_ratio`, `resolution`, `size`, `duration`, `negative_prompt`, `seed` |
| **Image input** | Есть ли поле URL изображения в `input` |
| **callBackUrl** | В примере createTask (runtime, не в settingsSchema) |

Скопируйте **полное тело** createTask или только объект `input` — Import Wizard принимает оба формата.

---

## 2. Как добавить модель через Import Wizard

1. Откройте **[/admin/models/import-kie](/admin/models/import-kie)**
2. **Шаг 1 — Основное:**
   - `scope` = **PRODUCT_CARD**
   - `productCardModelType` = **PRODUCT_MARKETPLACE_CARD** (для карточки товара)
   - `type` = **IMAGE** (подставится автоматически для marketplace preset)
   - Заполните **Kie Model ID**, endpoint, statusEndpoint
3. **Шаг 2 — Payload:** вставьте JSON из docs.kie.ai
4. **Шаг 3 — Auto-detect:** проверьте `settingsSchema`, `payloadMapping`, `supportsImageInput`
   - Для карточки товара **обязательно** должно быть поле изображения
   - Если поля нет — wizard покажет предупреждение
5. **Шаг 4 — Pricing:** укажите fixed credits → `pricingSchema: { "type": "fixed", "credits": N }`
6. **Шаг 5 — Сохранение:** модель создаётся **inactive**, `isPublic=false`

---

## 3. Как проверить (без реального Kie)

1. Откройте **[/admin/models/{id}/edit](/admin/models)** → вкладка **Тест модели**
2. Нажмите **«Проверить payload без запуска»** (dry-run)
   - Использует test prompt + fake image URL
   - **Не вызывает Kie.ai**, не списывает credits
3. Проверьте warnings: PLACEHOLDER apiModelId, missing endpoint, no image mapping и т.д.
4. При необходимости — **Mock test** / **Предпросмотр payload**
5. **Real test** — только с вашего явного подтверждения (может списать баланс Kie.ai)

Проверьте вручную:

- `settingsSchema` — поля формы
- `payloadMapping` — соответствие полям Kie `input`
- `metadata.rawPayloadExample` — исходный JSON из docs

---

## 4. Как активировать модель

1. **[/admin/models/{id}/edit](/admin/models)** → вкладка основная форма
2. Заполните реальный **Kie Model ID** (не PLACEHOLDER)
3. Укажите **endpoint** и **costCredits** > 0
4. **isActive = true**
5. **isPublic = false** (каталог AI только для admin QA)
6. Сохранить

---

## 5. Как назначить модель Product Card

1. **[/admin/product-card](/admin/product-card)** → вкладка **Обзор**
2. Блок **«Product Card AI status»** — проверьте readiness = **Ready**
3. Блок **«Назначение моделей»** → строка **«Карточка товара»**
   - AppSetting: `PRODUCT_CARD_DEFAULT_MARKETPLACE_CARD_MODEL_SLUG`
4. Выберите **active** модель с `productCardModelType=PRODUCT_MARKETPLACE_CARD`
5. **Сохранить назначение**

---

## 6. Как проверить Product Card UI

1. Откройте **[/dashboard/create/product-card](/dashboard/create/product-card)** (как USER или admin)
2. Загрузите фото товара, выберите категорию
3. Вкладка **«Карточка товара»**:
   - **Ready** → вкладка активна, setup notice **не** показывается
   - **Не ready** → метка «· настройка», внутри — «Этот сценарий ещё настраивается»

---

## Seed заготовок (опционально)

```bash
npm run seed:qazcard-product-card-models
```

Создаёт 4 inactive stub-модели (в т.ч. `product-marketplace-card-kie`). Не удаляет существующие записи.

## Verify

```bash
npm run verify:product-card-model-setup
```

Проверяет stubs, Import Wizard helpers и dry-run без вызова Kie.ai.
