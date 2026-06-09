# Product Classifier — Commercial Safety

## Зачем это нужно

Classifier вызывает **платный Kie.ai** (Gemini chat/completions). Без коммерческой защиты включение `PRODUCT_CLASSIFIER_ALLOW_REAL_KIE=true` для всех USER означает:

- неограниченный расход Kie.ai за счёт проекта;
- отсутствие связи с внутренними токенами QazCard;
- риск spam-кликов и double-submit.

Первый controlled real test (2026-06) прошёл успешно **без** списания QazCard credits — billing добавлен отдельно.

## Два уровня выключателя

1. **Runtime gate (`.env`)** — главный kill switch  
   `PRODUCT_CLASSIFIER_ALLOW_REAL_KIE=true`  
   Без него Kie **никогда** не вызывается, даже если AppSettings разрешают `all_users`.

2. **AppSettings** — доступ и экономика  
   `/admin/product-card` → **Classifier access & pricing**

| Setting | Default | Смысл |
|---------|---------|--------|
| `PRODUCT_CLASSIFIER_ACCESS_MODE` | `disabled` | Кто видит кнопку classifier |
| `PRODUCT_CLASSIFIER_COST_CREDITS` | `1` | Цена успешного распознавания (QazCard tokens) |
| `PRODUCT_CLASSIFIER_DAILY_LIMIT` | `10` | Kie-попыток / USER / 24h |
| `PRODUCT_CLASSIFIER_COOLDOWN_SECONDS` | `10` | Anti double-click |

## Безопасное включение для USER

1. Убедиться: модель classifier **Ready**, dry-run OK.
2. Настроить commercial settings (cost, limit, cooldown).
3. Controlled real test с gate **временно** on (см. `KIE_PRODUCT_CLASSIFIER_REAL_TEST_RUNBOOK.md`).
4. Проверить списание **1** токена (не 25), audit в ApiLog.
5. Установить `accessMode=all_users`.
6. Включить `PRODUCT_CLASSIFIER_ALLOW_REAL_KIE=true` в `.env`, перезапустить app.
7. Preflight: `readyForUserTraffic=true`.
8. Мониторить `/admin/logs` (provider `QAZCARD_CLASSIFIER`) и балансы USER.

## Безопасное отключение

1. **Сначала** убрать gate: `PRODUCT_CLASSIFIER_ALLOW_REAL_KIE` unset/false → `docker compose up -d app`.
2. При необходимости: `accessMode=disabled`.
3. Verify/smoke: `ConfiguredDisabled`, USER видит manual fallback.

Backup `.env` перед любым включением gate:

```bash
cp .env backups/env_before_classifier_$(date +%F_%H-%M).env
```

## Billing

- **Не** использует marketplace price 25.
- **Не** создаёт `Generation`.
- RESERVE → CAPTURE (success) / REFUND (Kie or parse error).
- Setup, gate, access denied, limits — **без списания**.

## Метрики

- ApiLog: `provider=QAZCARD_CLASSIFIER` — attempts (blocked/failed/success).
- CreditTransaction: `metadata.kind=product_classifier`, без `generationId`.
- Redis keys: `classify_daily`, `classify_cooldown` per userId.

## Запрещено

- Держать gate enabled + `all_users` без проверенного billing и limits.
- Коммитить `PRODUCT_CLASSIFIER_ALLOW_REAL_KIE=true` в repo `.env`.
- Запускать mass USER traffic до `readyForUserTraffic=true` в preflight.

См. также: `docs/PRODUCT_CARD_CLASSIFIER_FLOW.md`
