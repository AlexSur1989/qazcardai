# Шаблон: Kie.ai модель для PRODUCT_MARKETPLACE_CARD

Заполните поля перед импортом через **[/admin/models/import-kie](/admin/models/import-kie)**.

## Метаданные модели

| Поле | Значение |
|------|----------|
| **Model name** | _(например: GPT Image 2 Product Card)_ |
| **Slug** | _(например: gpt-image-2-product-marketplace-card)_ |
| **Kie model id** | `PASTE_KIE_MODEL_ID` |
| **Create task endpoint** | `/api/v1/jobs/createTask` |
| **Status endpoint** | _(recordInfo path из docs)_ |
| **Type** | IMAGE |
| **Scope** | PRODUCT_CARD |
| **ProductCardModelType** | PRODUCT_MARKETPLACE_CARD |
| **Supports image input** | true |
| **Fixed credits** | _(например: 15)_ |

## Example payload

Скопируйте из **docs.kie.ai** и подставьте свои значения:

```json
{
  "model": "PASTE_KIE_MODEL_ID",
  "input": {
    "prompt": "PASTE_PROMPT_FIELD",
    "image_url": "PASTE_IMAGE_FIELD",
    "aspect_ratio": "1:1"
  }
}
```

> **Важно:** реальные имена полей берите только из документации Kie для вашей модели (`image_url`, `image_urls`, `input_urls` и т.д.).

---

## Порядок подключения

1. **Import Wizard** — вставьте payload из docs.kie.ai
2. Сохраните модель **inactive** (`isActive=false`, `isPublic=false`)
3. **Dry-run** — «Проверить payload без запуска» в edit → Тест модели
4. **Mock / preview** — убедитесь, что payload и pricing корректны
5. **Активация** — `isActive=true`, реальный apiModelId, endpoint, costCredits > 0
6. **Назначение** — `/admin/product-card` → «Карточка товара» → slug модели
7. **Product Card UI** — `/dashboard/create/product-card` → вкладка «Карточка товара»

## Real test

Запускайте **Real Kie test** только вручную с подтверждением — может списать баланс Kie.ai.

Подробнее: [KIE_MODEL_IMPORT_CHECKLIST.md](./KIE_MODEL_IMPORT_CHECKLIST.md)
