# Шаблон: Kie.ai модель для PRODUCT_CLASSIFIER

Заполните поля перед импортом через **[/admin/models/import-kie](/admin/models/import-kie)**.

## Метаданные модели

| Поле | Значение |
|------|----------|
| **Model name** | _(например: Product Category Classifier)_ |
| **Slug** | _(например: product-classifier-gpt-vision)_ |
| **Kie model id** | `PASTE_KIE_MODEL_ID` |
| **Create task endpoint** | `/api/v1/jobs/createTask` _(или sync endpoint из docs)_ |
| **Status endpoint** | _(recordInfo path из docs, если async)_ |
| **Type** | IMAGE |
| **Scope** | PRODUCT_CARD |
| **ProductCardModelType** | PRODUCT_CLASSIFIER |
| **Supports image input** | true |
| **Fixed credits** | _(например: 1–3 для MVP)_ |

## Example payload

Скопируйте из **docs.kie.ai** и подставьте свои значения:

```json
{
  "model": "PASTE_KIE_MODEL_ID",
  "callBackUrl": "https://app.qazcardai.kz/api/webhooks/kie",
  "input": {
    "prompt": "Classify this product photo into one marketplace category. Return JSON only.",
    "input_urls": ["https://example.com/product-photo.jpg"]
  }
}
```

> **Важно:** реальные имена полей берите только из документации Kie для вашей модели (`image_url`, `image_urls`, `input_urls` и т.д.).

---

## Image input field

- Поле загрузки: обычно `input_urls` (array) или `image_url` (string) — **только из docs Kie**.
- Uploaded product photo URL подставляется системой из `POST /api/uploads`, пользователь URL не вводит.
- Для Product Card: фото товара → `input.input_urls[0]` (если array).

---

## Expected output format

Классификатор должен возвращать структурированный результат, который backend может распарсить:

```json
{
  "categoryId": "electronics",
  "confidence": 0.87,
  "reason": "Visible smartphone with screen and camera module"
}
```

### category mapping

Slug категории должен совпадать с `ProductCategoryId` / ручным списком:

- `electronics` — Электроника
- `home_appliances` — Бытовая техника
- `apparel` — Одежда
- `footwear` — Обувь
- `beauty_and_care` — Косметика
- `home_goods` — Товары для дома
- `kids` — Детские товары
- `accessories` — Аксессуары
- `furniture` — Мебель
- `auto` — Авто
- `universal` — Универсальная категория

Legacy-категории (`gadgets_and_tech`, `home_and_furniture`, `other`, …) допустимы для обратной совместимости.

### confidence

- Число `0..1`.
- При `confidence` ниже порога (настраивается в admin) — считать результат ненадёжным.

### fallback to manual category

**Обязательное правило QazCard AI:**

Если classifier **недоступен**, **не назначен**, **inactive**, **вернул ошибку** или **confidence слишком низкий** — Product Card **не блокируется**.

Пользователь видит блок **«Выберите категорию вручную»** и может продолжить сценарий «Карточка товара» без AI-классификатора.

Сохранение в `ProductCardProject`:

- `selectedCategory` — slug категории
- `categorySource = "manual"` — при ручном выборе
- `categorySource = "ai"` — при успешной классификации

---

## AppSetting после подключения

```
PRODUCT_CARD_DEFAULT_CLASSIFIER_MODEL_SLUG = <slug активной модели>
```

Проверка: `/admin/product-card` → слот «Классификация товара» = **Ready**.

---

## Порядок подключения

1. **Import Wizard** — payload из docs.kie.ai
2. Сохранить модель **inactive**
3. **Dry-run** — «Проверить payload без запуска»
4. Настроить парсинг ответа и mapping категорий в backend
5. **Активация** — `isActive=true`
6. **Назначение** — AppSetting classifier slug
7. Проверить auto-classify на `/dashboard/create/product-card`
8. Убедиться, что при ошибке classifier ручной выбор всё ещё работает

## Real test

**Real Kie test** — только вручную с подтверждением (может списать баланс Kie.ai).

См. также: [KIE_MODEL_IMPORT_CHECKLIST.md](./KIE_MODEL_IMPORT_CHECKLIST.md)
