# Post real Kie test checklist

После **каждого** реального вызова Kie.ai для Product Card marketplace card — пройти этот список.

> Не запускайте новый real test во время проверки предыдущего.

---

## 1. Generation (БД)

- [ ] `status = COMPLETED` (или `FAILED` с понятной причиной)
- [ ] `providerTaskId` заполнен (для COMPLETED / PROCESSING)
- [ ] `outputFiles` содержит S3 URL (`url`, `storageKey`, `contentType`)
- [ ] `costCredits` совпадает с estimate (сейчас **25** для marketplace card)
- [ ] `completedAt` заполнен при COMPLETED
- [ ] `metadata.productCard.tab = marketplace_card` (user flow)

---

## 2. Billing (CreditTransaction)

- [ ] **RESERVE** −N (N = final price)
- [ ] **CAPTURE** 0 при успехе (баланс уже уменьшен на RESERVE)
- [ ] **REFUND** при FAILED (если был RESERVE)
- [ ] Нет двойного RESERVE на одну Generation
- [ ] `users.balanceCredits` = ожидаемый после теста

---

## 3. S3 / output

- [ ] S3 URL из `outputFiles` открывается по HTTPS (200)
- [ ] Размер файла > 0
- [ ] Файл сохранён под `generations/{userId}/{generationId}/`

---

## 4. ApiLog

- [ ] Запись `createTask` (status 200)
- [ ] Запись `poll/complete` или webhook (при success)
- [ ] В `requestPayload` / `responsePayload` **нет** API keys, Bearer tokens, секретов

---

## 5. Worker / App logs

```bash
docker compose logs --tail=100 worker
docker compose logs --tail=100 app
```

- [ ] Нет необработанных ошибок после COMPLETED
- [ ] Webhook `/api/webhooks/kie` без 5xx (если использовался callback)

---

## 6. UI — History

Пользователь → `/dashboard/history`

- [ ] Генерация видна в списке
- [ ] Статус «Готово» (COMPLETED)
- [ ] Превью результата отображается
- [ ] Кнопка/ссылка скачать работает (`/api/generations/{id}/download`)
- [ ] Нет технических полей (apiModelId, providerTaskId, endpoint)

---

## 7. UI — Billing

`/dashboard/billing`

- [ ] Баланс соответствует ожиданию
- [ ] RESERVE −N виден в истории транзакций
- [ ] CAPTURE 0 (или понятная пара RESERVE + REFUND при ошибке)
- [ ] Нет двойного списания

---

## 8. UI — Product Card

`/dashboard/create/product-card` → «Карточка товара»

- [ ] Результат отображается (если UI хранит last generation)
- [ ] Вкладка работает без зависаний
- [ ] USER не видит технические данные модели

---

## 9. Качество результата (ручная оценка)

- [ ] Товар на карточке **узнаваем** и совпадает с фото
- [ ] Нет сильных искажений формы / упаковки / логотипа
- [ ] Нет лишних объектов
- [ ] Текст читаемый (если есть инфографика)
- [ ] Фон и композиция пригодны для маркетплейса
- [ ] Нет явных артефактов

Если текст пользователя не совпадает с фото (например «кружка» при фото автохимии) — это **ошибка сценария**, не pipeline. Улучшать prompt / добавить валидацию «фото ↔ текст».

---

## 10. Безопасность после теста

- [ ] Не коммитить production-only скрипты с hardcoded userId / email / taskId
- [ ] Real test scripts удалены или переведены в read-only smoke
- [ ] Документация обновлена (audit trail без секретов)

---

## 11. Verify (без Kie)

```bash
docker compose run --rm app npm run verify:product-card-model-setup
npm run smoke:product-card-marketplace
```

Ожидание: OK, новые Generation / CreditTransaction **не** создаются.

---

## Связанные документы

- [FIRST_REAL_KIE_MARKETPLACE_CARD_TEST.md](./FIRST_REAL_KIE_MARKETPLACE_CARD_TEST.md)
- [DEPLOY_PRODUCT_CARD_MARKETPLACE_READY.md](./DEPLOY_PRODUCT_CARD_MARKETPLACE_READY.md)
