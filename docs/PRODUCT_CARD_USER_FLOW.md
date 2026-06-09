# Product Card — пользовательский flow

Документ описывает сценарий **«Карточка товара»** (PRODUCT_MARKETPLACE_CARD) для обычного пользователя (USER).

---

## 1. User flow

| Шаг | Действие | URL / API |
|-----|----------|-----------|
| 1 | Загрузить фото товара | `/dashboard/create/product-card` → блок фото |
| 2 | Выбрать категорию (вручную, classifier опционален) | селектор категории на странице |
| 3 | Вкладка **«Карточка товара»** | tab `marketplace_card` |
| 4 | Выбрать фото, название, преимущества | форма Simple Product Card |
| 5 | **«Проверить план карточки»** (опционально) | `POST .../preview/simple-card-plan` |
| 6 | Дождаться **estimate** (сейчас **25** токенов) | `POST .../estimate/simple-card` |
| 7 | **«Создать карточку»** | `POST .../generate/simple-card` |
| 8 | Статус: очередь → обработка | polling `GET /api/generations/{id}` |
| 9 | **COMPLETED** — превью, скачать, история | UI + `/api/generations/{id}/download` |
| 10 | Биллинг / история | `/dashboard/billing`, `/dashboard/history` |

---

## 2. Статусы генерации (для пользователя)

| Backend | Заголовок в UI | Смысл |
|---------|----------------|-------|
| `QUEUED`, `CREATED` | Карточка поставлена в очередь | Задача принята, ждём worker |
| `PROCESSING` | ИИ создаёт карточку | Kie.ai / worker в процессе |
| `COMPLETED` | Карточка готова | Файл в S3, можно скачать |
| `FAILED`, `BLOCKED`, `CANCELLED` | Не удалось создать карточку | Понятная ошибка, возврат токенов |
| `REFUNDED` | Токены возвращены | После неудачной генерации |

Polling: каждые **4 с** пока `QUEUED` или `PROCESSING`; останавливается на terminal status.

---

## 3. Billing

| Тип | Что видит USER | Backend |
|-----|----------------|---------|
| **RESERVE** −N | «Создание карточки товара» −25 | Резерв при постановке в очередь |
| **CAPTURE** 0 | *не показывается* | Подтверждение успеха (баланс уже уменьшен) |
| **REFUND** +N | «Возврат за неудачную генерацию» | При FAILED после RESERVE |

Фактическое списание — **один раз** (−25) через RESERVE.

---

## 4. Фото и текст

**Важное правило:** фото и текст клиента **не обязаны** совпадать.

- Клиент сам отвечает за введённое описание.
- Система **не блокирует** генерацию из-за несоответствия фото / названия / категории.
- Нет обязательного checkbox, AI mismatch detector или запрета по категории.
- В UI — мягкий совет: «Для лучшего результата используйте описание, которое относится к загруженному фото.»

Приоритет идентичности товара — **main product image** (prompt builder), а не только текст пользователя.

---

## 4.1. По фото-референсу (MVP)

На вкладке **«Карточка товара»** (Simple Product Card) можно загрузить **фото-референс дизайна** — пример карточки, баннера, фона или визуального стиля.

| Шаг | Действие |
|-----|----------|
| 1 | Загрузить **основное фото товара** (как обычно) |
| 2 | Выбрать стиль **«По фото-референсу»** или в «Классическом» включить опцию референса |
| 3 | **«Загрузить референс»** — PNG/JPG/WebP до 10 МБ |
| 4 | AI берёт **товар из первого фото**, **стиль/фон/композицию — из второго** |
| 5 | **«Создать карточку»** — billing как раньше (**25** токенов в MVP) |

**Без референса** генерация работает как раньше (одно фото в `input_urls`).

**С референсом** в Kie уходит два URL: `[product, reference]` — порядок фиксирован; USER не видит технические поля.

Подсказка в UI: *«Референс используется только для стиля. Товар берётся с основного фото.»*

---

## 5. Что USER не видит

- `modelSlug`, `apiModelId`, `endpoint`, `payloadMapping`
- `providerTaskId`, raw Kie payload/response
- Технические ошибки worker / queue

Admin debug — только при `showAdminHints` (ADMIN / SUPER_ADMIN).

---

## 6. Dev UI mock (без Kie)

Только `NODE_ENV !== production`:

```
/dashboard/create/product-card?pcGenMock=queued
?pcGenMock=processing
?pcGenMock=completed
?pcGenMock=failed
```

Не создаёт Generation, не вызывает Kie.ai.

---

## 7. Проверки без Kie

```bash
npm run verify:product-card-model-setup
npm run smoke:product-card-marketplace
```

---

## Связанные документы

- [FIRST_REAL_KIE_MARKETPLACE_CARD_TEST.md](./FIRST_REAL_KIE_MARKETPLACE_CARD_TEST.md)
- [POST_REAL_KIE_TEST_CHECKLIST.md](./POST_REAL_KIE_TEST_CHECKLIST.md)
