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
- При **Kie/network error** после RESERVE обязателен **REFUND** (net balance без изменений).
- Failed Kie calls **не** создают `Generation` и **не** запускают marketplace worker.
- **Timeout / fetch failed** → REFUND; **automatic retry запрещён** (риск двойного Kie spend). Retry только controlled + operator confirmation.
- **Kie HTTP 200 + provider error body** (`code≥400`, `msg`/`error` без `choices`, maintenance text) → **upstream_maintenance** / **upstream_error**, не `parse_error`; RESERVE → **REFUND**; USER **не** видит raw provider body; ApiLog — `providerCode`, `providerMessage` (≤200 символов), без секретов.
- **Image URL precheck** (HTTPS HEAD/GET, ~8s) — **до RESERVE**; при fail Kie не вызывается, billing не трогается.
- После failed controlled test **gate выключать обратно** (restore backup `.env` → `docker compose up -d app`).
- Перед retry: preflight admin_only fix, timeout 120s, verify/smoke, gate disabled до явного подтверждения.

### Preflight: admin_only ≠ user traffic

- `readyForRealTest` — controlled admin/beta test: модель **generationReady**, gate on, `accessMode ≠ disabled`, env OK. **`admin_only` → true** при gate on.
- `readyForUserTraffic` — только **`all_users`** + gate + model Ready. **`admin_only` → false** (USER кнопку не видит).
- Slot check в preflight использует **`generationReady`**, не `autoClassifyReady`.

### Timeout setting

| Setting | Default | Clamp |
|---------|---------|-------|
| `PRODUCT_CLASSIFIER_TIMEOUT_MS` | 120000 | 30000–180000 |

Admin UI: `/admin/product-card` → Classifier access & pricing → Timeout (sec).

### Paid test attempts 2026-06-09

Controlled production test: `admin_only`, cost **1**.

1. **fetch failed** — RESERVE −1 → REFUND +1.
2. **Kie timeout (~60s)** — RESERVE −1 → REFUND +1.
3. **Kie HTTP 200 + maintenance body** — RESERVE −1 → REFUND +1; `upstream_maintenance`, не `parse_error`.

Balance net **0** все три раза. Success path (CAPTURE 0) — pending. Подробнее: `docs/KIE_PRODUCT_CLASSIFIER_REAL_TEST_RUNBOOK.md`.

## Метрики

- ApiLog: `provider=QAZCARD_CLASSIFIER` — attempts (blocked/failed/success).
- CreditTransaction: `metadata.kind=product_classifier`, без `generationId`.
- Redis keys: `classify_daily`, `classify_cooldown` per userId.

## Запрещено

- Держать gate enabled + `all_users` без проверенного billing и limits.
- Коммитить `PRODUCT_CLASSIFIER_ALLOW_REAL_KIE=true` в repo `.env`.
- Запускать mass USER traffic до `readyForUserTraffic=true` в preflight.

См. также: `docs/PRODUCT_CARD_CLASSIFIER_FLOW.md`
