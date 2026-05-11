# QazCard AI — полный контекст проекта

> Документ подготовлен для передачи в новый чат ChatGPT. Секреты из `.env` не включены. Описано фактическое устройство репозитория и текущее состояние на момент подготовки.

## 1. Общий обзор проекта

QazCard AI — веб-приложение для генерации коммерческого AI-контента: изображений, видео, карточек товара для маркетплейсов, рекламных баннеров и сопутствующих материалов. Основная аудитория: продавцы маркетплейсов, малый бизнес, SMM/контент-команды и студии, которым нужно быстро получать фото/видео и карточки товара без ручного дизайна.

Основная бизнес-логика:

- пользователь регистрируется, входит в кабинет и пополняет баланс внутренними токенами;
- выбирает AI-модель или поток «Карточка товара»;
- отправляет промпт и настройки модели;
- система оценивает стоимость в токенах, резервирует токены, создаёт `Generation`;
- задача уходит в Redis/BullMQ;
- worker вызывает Kie.ai, polling/webhook получает результат;
- результат сохраняется в S3-compatible storage, если storage настроен;
- при успехе резерв подтверждается (`CAPTURE`), при ошибке возвращается (`REFUND`);
- пользователь видит результат в текущей форме и в истории.

Главные функции:

- auth: регистрация, вход, восстановление пароля, роли;
- личный кабинет `/dashboard`;
- каталог AI-моделей `/dashboard/models`;
- хабы моделей `/dashboard/models/[slug]`: одна карточка семейства, внутри режимы и форма генерации;
- общие формы `/dashboard/create/image` и `/dashboard/create/video`;
- поток `/dashboard/create/product-card` для карточки товара;
- история генераций;
- биллинг/пакеты токенов;
- админка для моделей, цен, платежей, пользователей, настроек, legal pages, moderation, audit logs;
- worker генераций;
- upload/S3.

Текущая стадия: MVP/активная разработка. Много функций реализовано кодом, но production-надёжность зависит от корректной настройки Redis, S3, Kie.ai, платежей, email и сидов моделей. Есть незавершённые зоны: permissions, payment production, реальная сегментация товара, части pricing safety, cutout/preserve label.

Важное текущее состояние рабочей копии:

- есть коммит `4102a2d` для навигации «Открыть» на хабы GPT Image 2/Kling 2.6;
- после него внесены незакоммиченные изменения: универсальный хаб модели для всех семейств/одиночных Kie-моделей, группировка семейств в `src/config/generation-models.ts`, новый компонент `src/components/dashboard/model-family-generation-hub.tsx`, `hideModelSelect` в image/video формах;
- есть незатронутые этим заданием изменения в `qazcard-landing/**` (изображения/robots/sitemap/README). Их не коммитить без отдельной команды.

## 2. Технический стек

Источник: `package.json`, `docker-compose.yml`, `prisma/schema.prisma`.

- **Next.js 16.2.6**: App Router, server components, route handlers, production build `next build --webpack`.
- **React 19.2.6**.
- **TypeScript 5**.
- **Prisma 7.8**: generator `prisma-client`, output `src/generated/prisma`, PostgreSQL datasource.
- **PostgreSQL 16**: сервис `postgres` в `docker-compose.yml`.
- **Redis 7 + BullMQ 5.76**: очередь `ai-media-generation`, отдельный worker.
- **Docker / docker compose**: сервисы `postgres`, `redis`, `app`, `worker`.
- **Auth.js / NextAuth v5 beta**: credentials provider, JWT session.
- **bcryptjs**: password hashing.
- **Sharp**: image processing / composite for product-card overlays and files.
- **S3-compatible storage**: AWS SDK v3 (`@aws-sdk/client-s3`, presigner), local dev fallback under `public/uploads`.
- **Kie.ai**: main provider for image/video/chat-like generation, market `createTask`, Veo, GPT Image 2, Kling, Seedance, Wan, Grok, Hailuo, Sora, HappyHorse.
- **Stripe**: checkout/webhook for token packages.
- **Kaspi**: mock/architecture routes present, production credentials/config separate.
- **Nodemailer**: email notifications/templates.
- **Zod**: request validation.
- **Sonner**: frontend toasts.
- **Lucide React**: icons.
- **Tailwind CSS 4 / shadcn-related packages**: UI styling.

NPM scripts:

- `dev`, `dev:lan`, `build`, `start`, `lint`, `typecheck`;
- Prisma: `db:generate`, `db:migrate`, `db:push`, `db:studio`, `db:validate`;
- worker: `worker`;
- seeds: `db:seed:admin`, `seed:token-packages`, `seed:kling`, `seed:kling-motion-control`, `seed:gpt-image-2-product-card`, `seed:general-kie-image-models`, `seed:product-card-models`, `seed:wan`, `seed:seedance`, `seed:seedance-fast`, `seed:seedance-1-5-pro`, `seed:seedance-all`, `seed:happyhorse`, `seed:grok-imagine`, `seed:hailuo-2-3`, `seed:sora-2-pro-storyboard`, `seed:veo-3-1`.

## 3. Структура папок проекта

```text
src/app
src/components
src/server
src/lib
src/config
scripts
prisma
public
qazcard-landing
```

- `src/app`: Next.js App Router. Страницы (`page.tsx`), layouts, API route handlers. Важные области: `dashboard`, `admin`, `api`, auth pages, legal pages, maintenance.
- `src/components`: UI-компоненты. `dashboard` содержит формы генерации, product-card tabs, каталог моделей. `layout` содержит layout/header/sidebar. `ui` содержит базовые компоненты.
- `src/server`: backend-сервисы и очереди. `services` — бизнес-логика: генерации, Kie, кредиты, pricing, product-card, storage, payments, moderation. `queues` — BullMQ. `workers` — worker фабрика.
- `src/lib`: shared helpers: env validation, auth redirects, prisma client, validations, pricing shared, upload validation, dashboard nav, Kie mock/error helpers.
- `src/config`: статические конфиги UI/продукта: каталог генеративных моделей, product-card prompts/categories/styles/overlay presets, app settings registry.
- `scripts`: сиды, worker entrypoint, проверки, служебные scripts.
- `prisma`: `schema.prisma`, migrations (если есть).
- `public`: публичные ассеты и local uploads в development.
- `qazcard-landing`: отдельный landing/static package внутри репозитория. Сейчас имеет несвязанные незакоммиченные изменения, не трогать без команды.

## 4. Backend architecture

### 4.1 Auth

Файлы:

- `src/auth.ts`
- `src/middleware.ts`
- `src/lib/auth.ts`
- `src/lib/permissions.ts`
- `src/server/services/fresh-session-user.ts`
- `src/app/api/auth/**`
- `src/server/services/passwordReset.ts`

Реализация:

- Auth.js / NextAuth v5 используется в `src/auth.ts`.
- Provider: `Credentials`.
- `authorize` ищет `User` по `email`, требует `status === ACTIVE`, проверяет пароль через `verifyPassword`.
- Session strategy: JWT, `maxAge` 30 дней.
- JWT callback кладёт `token.sub` и `token.role`.
- Session callback пробрасывает `session.user.id` и `session.user.role`.
- Страницы входа: `/login`, исторически также `/auth/login`.
- Регистрация: route `src/app/api/auth/register/route.ts`, страницы `/register`, `/auth/register`.
- Forgot/reset password: `src/app/api/auth/forgot-password/route.ts`, `src/app/api/auth/reset-password/route.ts`, сервис `passwordReset.ts`, таблица `PasswordResetToken` хранит только hash токена.
- `middleware.ts` защищает `/dashboard/**` и `/admin/**`, редиректит на `/login?next=...` если нет JWT.
- Админка: `canAccessAdminPanel`, `isModeratorAllowedAdminPath` из `src/lib/permissions.ts`. MODERATOR ограничен moderation routes.
- Maintenance mode: `MAINTENANCE_MODE`, `MAINTENANCE_ALLOW_ADMIN`; обычных пользователей редиректит на `/maintenance`, API отдаёт 503 кроме health/webhooks/auth.
- `fresh-session-user.ts` используется серверными page/API для актуальной проверки пользователя в БД, а не только JWT.

Роли Prisma: `USER`, `MODERATOR`, `ADMIN`, `SUPER_ADMIN`. Роли есть в БД и middleware, но полноценная granular permissions logic в админке частично готова, требует ревизии.

### 4.2 Prisma / Database

Файл: `prisma/schema.prisma`.

Enums:

- `UserRole`: USER / MODERATOR / ADMIN / SUPER_ADMIN.
- `UserStatus`: ACTIVE / INACTIVE / BLOCKED / PENDING_VERIFICATION.
- `GenerationType`: IMAGE / VIDEO.
- `GenerationStatus`: CREATED / QUEUED / PROCESSING / COMPLETED / FAILED / BLOCKED / CANCELLED / REFUNDED.
- `PaymentStatus`, `CreditTransactionType`, `AiModelProvider`, `WebhookEventStatus`, `UserTokenPackageStatus`.

Основные модели:

- `User`: email/passwordHash/name/role/status/balanceCredits/emailVerified, связи с generations/payments/creditTransactions/uploadedFiles/productCardProjects/moderationLogs/passwordResetTokens. `balanceCredits` — денормализованный текущий баланс.
- `PasswordResetToken`: userId, tokenHash, expiresAt, usedAt, ip/userAgent.
- `Plan`: legacy/subscription-like plan model, сейчас основной биллинг через token packages.
- `TokenPackage`: пакеты внутренних токенов: priceKzt/baseTokens/bonusTokens/totalTokens/metadata/sortOrder.
- `AiModel`: ключевая таблица моделей. Поля: `slug`, `provider`, `type`, `scope` (`GENERAL` / `PRODUCT_CARD`), `productCardModelType`, `apiModelId`, `endpoint`, `statusEndpoint`, `costCredits`, `realCost`, `settingsSchema`, `pricingSchema`, `payloadMapping`, supports flags, maxDuration, availableAspectRatios/Resolutions. Цены и Kie-поля хранятся здесь.
- `Generation`: userId/modelId/type/status/prompt/negativePrompt/inputFiles/outputFiles/providerTaskId/costCredits/errorMessage/metadata/completedAt. `metadata.settings` хранит normalized settings; `metadata.priceBreakdown` — price snapshot; product-card metadata также здесь.
- `Payment`: платежи Stripe/Kaspi/mock, userId/tokenPackageId/provider/status/amount/currency/providerPaymentId/checkoutUrl/metadata.
- `UserTokenPackage`: факт покупки пакета токенов пользователем.
- `CreditTransaction`: ledger токенов: PURCHASE, RESERVE, CAPTURE, REFUND, ADMIN_ADJUSTMENT, PROMO; связывается с user/payment/generation.
- `ApiLog`: лог provider calls.
- `UploadedFile`: файлы пользователя, storageKey/url/fileType/metadata/generationId.
- `PromoCode`: промокоды.
- `AdminAuditLog`: аудит админ-действий.
- `AppSetting`: key/value JSON для runtime настроек админки.
- `ProductCardProject`: проект карточки товара, source image(s), metadata.
- `ModerationLog`: логи модерации промптов.
- `LegalPage`: legal docs.
- `EmailTemplate`, `AdminEmailThrottle`, `WebhookEvent`.

Связи:

- `User` 1:N `Generation`, `Payment`, `CreditTransaction`, `UploadedFile`, `ProductCardProject`, `ModerationLog`.
- `AiModel` 1:N `Generation`, `ModerationLog`.
- `Generation` 1:N `CreditTransaction`, `ApiLog`, `UploadedFile`, `ModerationLog`.
- `Payment` связывается с `User`, `TokenPackage`, `CreditTransaction`.
- `ProductCardProject` принадлежит `User`, использует `metadata` для generated entries.

Metadata:

- `Generation.metadata`: settings, product-card flow info, pricing snapshot, overlay metadata.
- `ProductCardProject.metadata`: source images, concept generations, marketplace generations, video generations, UI state/history.
- `AiModel.settingsSchema`: frontend dynamic fields.
- `AiModel.payloadMapping`: mapping normalized settings → Kie `input.*` body.
- `AiModel.pricingSchema`: matrix/per-second/product-card pricing.

### 4.3 Генерации image/video

Основной flow:

1. Пользователь в UI отправляет форму (`CreateImageForm`, `CreateVideoForm`, `ModelFamilyGenerationHub` или product-card tabs).
2. API route (`/api/generations/image` или `/api/generations/video`) проверяет session через `getFreshSessionUser`, rate limit, JSON body size, zod validation.
3. API ищет активную `AiModel` по `modelId`, `type`, `scope: GENERAL`.
4. Если есть `settingsSchema`, вызывает `validateAndNormalizeModelSettings`.
5. Дополнительно валидирует модельные сценарии: Grok, Seedance, Kling, Wan, HappyHorse, Hailuo, Sora, Veo, Kling Motion.
6. Собирает inputFiles/settings/metadata. Для upload-list полей `imageUrls`, `inputUrls`, `referenceImageUrls` фронт должен загружать файлы через `/api/uploads`, а сервер уже получает публичные URL.
7. Модерация через `moderateGenerationInput`; если banned — 400 + moderation details.
8. Pricing: `calculateGenerationCreditsWithBreakdown(model, normalizedSettings)`.
9. Если клиент прислал `clientEstimateCredits` и цена изменилась — 409 `PRICE_CHANGED`.
10. Проверяется баланс, создаётся `Generation`, резервируются токены `reserveCredits`.
11. Очередь:
    - image route требует Redis/Kie ready;
    - video route поддерживает `QUEUE_MODE=inline` для локальной разработки, иначе Redis.
12. `enqueueGenerationJob(generationId)` добавляет BullMQ job `gen-${generationId}`.
13. Worker `processGenerationJob` вызывает `processGeneration(generationId)`.
14. `generationProcessor.ts` строит Kie input: `buildImageKieInput` / `buildVideoKieInput`.
15. Provider service `src/server/services/provider/kie.ts` вызывает Kie API: legacy endpoints, Market `jobs/createTask`, Veo routes, recordInfo.
16. Polling ждёт статус; при `COMPLETED` получает output URLs.
17. `completeWithOutput` пытается скачать/загрузить output в S3 (`uploadFromUrl`, `uploadFile`), если storage configured; иначе может оставить provider URL.
18. При product-card marketplace overlay накладывает SVG/Sharp overlay поверх изображения.
19. DB обновляет `Generation.outputFiles`, `status`, `completedAt`.
20. `confirmCredits` пишет CAPTURE (balance уже уменьшен RESERVE). При ошибке `refundCredits` возвращает токены.
21. UI polling `/api/generations/[id]` показывает статус/результат.

Файлы:

- `src/app/api/generations/image/route.ts`
- `src/app/api/generations/video/route.ts`
- `src/app/api/generations/estimate/route.ts`
- `src/app/api/generations/[id]/route.ts`
- `src/app/api/generations/[id]/download/route.ts`
- `src/server/services/generationProcessor.ts`
- `src/server/services/provider/kie.ts`
- `src/server/services/credits.ts`
- `src/server/queues/generationQueue.ts`
- `src/server/workers/generationWorker.ts`

### 4.4 Worker / Queue

Файлы:

- `scripts/worker.ts`
- `src/server/workers/generationWorker.ts`
- `src/server/queues/generationQueue.ts`
- `src/server/queues/redisConnection.ts`
- `src/server/queue-mode.ts`

BullMQ:

- Queue name: env `GENERATION_QUEUE_NAME`, default `ai-media-generation`.
- Job data: `{ generationId }`.
- Job id: `gen-${generationId}` for idempotency.
- Attempts: `GENERATION_JOB_ATTEMPTS` default 3.
- Backoff: exponential, `GENERATION_BACKOFF_MS` default 2000.
- `removeOnComplete: 1000`, `removeOnFail: false`.

Worker:

- Entry: `npm run worker` → `scripts/worker.ts`.
- `createGenerationWorker` opens Redis connection (`REDIS_URL`).
- Concurrency: `GENERATION_WORKER_CONCURRENCY` default 2.
- Lock duration: `GENERATION_LOCK_MS` default 300000.
- Stalled interval: `GENERATION_STALLED_MS` default 60000.
- On failed: logs, if attempts exhausted calls `markGenerationExhausted(id, msg)` and admin notification email.
- Graceful shutdown on SIGINT/SIGTERM.

Retry/refund:

- Provider transient Kie statuses 502/503/429/0 are considered retryable in generation processor.
- Exhausted generation becomes FAILED/REFUNDED path and credits refunded.
- `markGenerationExhausted` protects terminal states.

### 4.5 Pricing / tokens

Files:

- `src/server/services/modelPricingCalculator.ts`
- `src/server/services/pricing.ts`
- `src/server/services/unifiedModelPricing.ts`
- `src/server/services/productCardPricing.ts`
- `scripts/lib/omit-seed-pricing.ts`
- `src/app/api/admin/models/[id]/pricing/**`
- `src/components/admin/model-pricing-studio.tsx`

Current system:

- `AiModel.costCredits`: legacy/default fallback.
- `AiModel.pricingSchema`: source of truth for dynamic pricing when present.
- `calculateGenerationCreditsWithBreakdown` uses `buildGeneralPriceBreakdownV2` and returns `{ credits, priceBreakdown }`.
- `getCreditsUiFloor` calculates catalog/select “от N токенов” from matrix/per_second preview.
- `modelPricingCalculator.ts` supports matrix pricing and per-second motion control preview. It normalizes legacy flat `providerCost` into `providerCost.noVideo` via `normalizeMatrixProviderCostBranches`.
- Supports numeric strings and comma decimals in pricing schemas.
- `manualOverrides` can pin final client tokens.
- `adminPricingPinned` is a flag in pricingSchema; seed scripts should avoid overwriting pricing when pinned using `omitSeedPricingWhenPinned`.
- Product Card pricing has separate `pricingScope: PRODUCT_CARD`, scenario min tokens, multipliers, card size/template multipliers, variants bundle tokens, variant allocations.

Hardcoded/fallback places:

- `AiModel.costCredits` still fallback.
- Product Card settings have default min tokens in AppSettings/service fallback.
- Some seeds contain matrix/default credits and provider cost constants.
- `DEFAULT_*_MODEL_SLUG` env/app settings determine Product Card model choices.

Already ready:

- General generation estimate endpoint and PRICE_CHANGED protection.
- Pricing Studio/admin preview/live-preview routes exist.
- Price breakdown is stored in generation metadata.
- Seed pricing safety via `omitSeedPricingWhenPinned` exists for updated seeds.

Needs work:

- Audit all seeds for pricing overwrite safety.
- Remove/centralize remaining hardcoded product-card token defaults.
- Validate real provider costs vs Kie docs/account.
- Ensure video per-second and special APIs match billing expectations.

### 4.6 Product Card backend

Core files:

- `src/server/services/productCardGeneration.ts`
- `src/server/services/productCardQueueGenerations.ts`
- `src/server/services/productCardOverlayRenderer.ts`
- `src/server/services/marketplaceCardImageComposite.ts`
- `src/server/services/productCardObjectAwareLayout.ts`
- `src/server/services/productCardRasterLayout.ts`
- `src/server/services/productCardSellingPoints.ts`
- `src/server/services/productCardPricing.ts`
- `src/server/services/productCardResolveSource.ts`
- `src/server/services/productCardProjects.ts`
- `src/server/services/productClassifier.ts`
- `src/config/product-card-prompts.ts`
- `src/config/product-card-categories.ts`
- `src/config/product-card-overlay-presets.ts`
- `src/config/product-card-styles.ts`

Data model:

- `ProductCardProject`: user project with source image(s), sourceImageUrl, category/concept-like metadata, marketplace generations, concept generations, video generations.
- Source images are uploaded through `/api/uploads` with purpose `product_card_source`/`product_card_source_image`, stored in `UploadedFile` and project metadata.

Flow:

1. User creates/loads project in `/dashboard/create/product-card`.
2. Upload source product image(s).
3. Optional classification: `productClassifier.ts` uses Kie Gemini by default (`PRODUCT_CLASSIFIER_PROVIDER=kie_gemini`), or mock/openai/gemini direct providers.
4. Concept photo: `generateConceptPhotoForProductCard` validates category/concept, builds prompt via `product-card-prompts.ts`, resolves default concept model, queues image generation, appends concept metadata.
5. Marketplace card: `estimateMarketplaceCardCredits`, `generateMarketplaceCardForProductCard`, or `generateMarketplaceCardVariantsForProductCard`. Builds merged model settings, prompt, overlay spec, queues Kie image generation.
6. Video: `generateProductVideoForProductCard` resolves source (original/concept/card), builds product video prompt and settings, queues video generation.
7. Queue services share general generation pipeline and credit system.
8. Overlay: after Kie marketplace image output, `marketplaceCardImageComposite.ts` can composite SVG overlay rendered by `productCardOverlayRenderer.ts` using Sharp.

Overlay / object-aware:

- `productCardOverlayRenderer.ts` builds SVG overlay with template, card size, typography preset, benefits, extra text, stats, size text, icons/arrows/shadows.
- `productCardObjectAwareLayout.ts` computes `productBox`, `forbiddenZone`, `safeZones`, and adjusted layout to avoid overlay over product. It is heuristic/raster/object-aware, not true segmentation.
- `productCardRasterLayout.ts` estimates subject/product box from raster.
- `marketplaceCardImageComposite.ts` decides when to apply overlay, downloads provider image, composites SVG with Sharp, uploads final output.
- `preserveProductLabel` flag exists in UI/metadata and renderer input, but full cutout/segmentation pipeline to preserve labels is not complete.
- strict no-overlap: implemented heuristically with forbidden zones and safe zones; still risk on complex images.
- variants mode: marketplace card can generate multiple variants, allocate bundle credits, show gallery.

Known limitations:

- No true product segmentation/cutout pipeline.
- Object-aware layout can still fail for unusual product shapes or generated layouts.
- preserveProductLabel is not a real “do not edit label” pipeline unless provider obeys prompt/overlay avoids region.
- overlay text fitting works but needs visual QA across sizes/languages.
- variants UX and pricing need more production tests.

### 4.7 Storage / S3

Files:

- `src/app/api/uploads/route.ts`
- `src/server/services/storage.ts`
- `src/lib/upload-storage-mode.ts`
- `src/lib/upload-file-validation.ts`

Upload flow:

- Auth required (`getFreshSessionUser`).
- Rate limit via `enforceUploadRateLimit`.
- Multipart `file` plus optional `purpose`.
- Purposes: `generation_input`, `product_card_source`, `product_card_source_image`, `kling_motion_reference_image`, `kling_motion_video`, `seedance_reference_image`, `seedance_reference_video`, `seedance_reference_audio`.
- File validation differs by purpose/kind; image/video/audio sizes from env/settings.
- Storage key format under `uploads/{userId}/...`.
- Creates `UploadedFile` row with metadata.
- Returns public URL.

Storage service:

- Dev default: local `public/uploads`, URL `/uploads/...`.
- Production: local forbidden; needs S3.
- S3 env: `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_PUBLIC_URL`.
- Supports path-style, TLS options for MinIO/self-signed dev.
- Generated outputs stored under `generations/{userId}/{generationId}/out-{index}.ext` when mirrored.

### 4.8 Payments / Billing

Files:

- `src/app/dashboard/billing/**`
- `src/app/api/payments/checkout/route.ts`
- `src/app/api/billing/payments/kaspi/create/route.ts`
- `src/app/api/billing/payments/[id]/route.ts`
- `src/app/api/webhooks/stripe/route.ts`
- `src/app/api/webhooks/kaspi/route.ts`
- `src/server/services/payments/**`
- `src/server/services/tokenPackages.ts`
- `scripts/seed-token-packages.ts`

Model:

- `TokenPackage`: catalog of KZT → tokens.
- `Payment`: provider checkout/order state.
- `CreditTransaction`: tokens ledger.
- `UserTokenPackage`: purchased package facts.

Stripe:

- Checkout creates dynamic `price_data` from token package.
- Webhook confirms payment and applies credits only server-side.
- Requires `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.

Kaspi:

- Architecture/mock provider present.
- Env: `KASPI_PAY_ENABLED`, `KASPI_PAY_MOCK`, `KASPI_PROVIDER`, `KASPI_API_BASE_URL`, `KASPI_API_KEY`, `KASPI_MERCHANT_ID`, `KASPI_WEBHOOK_SECRET`, URLs.
- Mock confirm route exists for dev/admin.

Refunds:

- Generation refunds are via `CreditTransaction` REFUND.
- Payment refunds fields/status exist, but production refund processes need provider-specific validation.

## 5. Frontend architecture

### 5.1 Dashboard

Files:

- `src/app/dashboard/layout.tsx`
- `src/app/dashboard/page.tsx`
- `src/components/dashboard/dashboard-sidebar.tsx`
- `src/components/dashboard/dashboard-sidebar-nav.tsx`
- `src/lib/dashboard-nav.ts`

Behavior:

- `/dashboard` protected by middleware and server session.
- Layout includes sidebar/mobile nav and main content.
- Navigation includes overview, AI models, create product card, history, billing, settings.
- User balance displayed in dashboard/billing flows and generation cost cards.

### 5.2 AI Models page

Files:

- `src/app/dashboard/models/page.tsx`
- `src/app/dashboard/models/[slug]/page.tsx`
- `src/components/dashboard/models-catalog-explore.tsx`
- `src/components/dashboard/model-family-generation-hub.tsx`
- `src/config/generation-models.ts`
- `src/lib/generation-models-catalog.ts`

`/dashboard/models`:

- Server loads active DB models using `prismaWhereForDashboardModelsCatalog()` and product-card min cost.
- `mergeGenerationCatalog` merges static catalog definitions with DB rows.
- `visibleInModelsCatalog` filters hidden product-card-only entries.
- Client component `ModelsCatalogExplore` supports search and task filters.
- Cards have status active/disabled/coming soon, provider label, tasks, price floor.
- Current behavior: card “Открыть” uses `catalogListOpenHref` and goes to `/dashboard/models/[slug]` for image/video catalog entries; second action may show “Общая форма”.

`/dashboard/models/[slug]`:

- Server detail page validates session, loads merged catalog card and balance.
- Shows hero, tasks, cost, status sidebar.
- Specific components still exist for GPT Image 2 and Kling 2.6, but a new generic hub now handles all other image/video catalog definitions.
- `ModelFamilyGenerationHub` renders mode buttons and either `CreateImageForm` or `CreateVideoForm` with one active model and `hideModelSelect`.
- Fields come from `AiModel.settingsSchema`; estimate/generate/polling reused from existing forms.
- Families currently grouped in `generation-models.ts`: GPT Image 2, Kling 3.0, Kling 2.6, Wan 2.7, Wan 2.6, Grok Imagine, Hailuo 2.3, Veo 3.1. Single catalog entries (Seedance, Sora, HappyHorse etc.) still open as one-mode hubs.

### 5.3 Image generation UI

Files:

- `src/app/dashboard/create/image/page.tsx`
- `src/components/dashboard/create-image-form.tsx`
- `src/components/dashboard/dynamic-model-settings-fields.tsx`
- `src/components/dashboard/generation-cost-card.tsx`
- `src/components/dashboard/generation-result-aside.tsx`

Behavior:

- Loads active `AiModel` rows where `type=IMAGE`, `scope=GENERAL`.
- Groups GPT Image 2 variants in selector via `IMAGE_CREATE_MODEL_GROUPS` for old/general form.
- Supports prompt, dynamic settings from `settingsSchema`, fallback legacy fields (negative prompt/aspect/resolution/seed/input URLs) if no schema.
- Estimates via `/api/generations/estimate` with debounce.
- Submit to `/api/generations/image`, sends `clientEstimateCredits` for PRICE_CHANGED protection.
- Polls `/api/generations/[id]` every 3s.
- Shows result aside and cost card.
- New prop `hideModelSelect` lets model hubs hide the selector because the mode button already selected a concrete model.

### 5.4 Video generation UI

Files:

- `src/app/dashboard/create/video/page.tsx`
- `src/components/dashboard/create-video-form.tsx`
- `src/components/dashboard/kling-motion-control-uploads.tsx`
- `src/components/dashboard/dynamic-model-settings-fields.tsx`
- `src/components/dashboard/generation-cost-card.tsx`
- `src/components/dashboard/generation-result-aside.tsx`

Behavior:

- Loads active `AiModel` rows where `type=VIDEO`, `scope=GENERAL`.
- Supports prompt, dynamic schema fields, duration/resolution/seed legacy fields if no schema.
- Handles special Kling Motion Control uploads and duration estimate.
- Blocks unsupported `multiShots` for Kling 3.0/2.6 styles.
- Estimate via `/api/generations/estimate`; submit via `/api/generations/video`.
- Supports inline processing in video route if `QUEUE_MODE=inline`.
- New props: `familyHub` (old Kling 2.6 internal button mode) and `hideModelSelect` for generic model hubs.

### 5.5 Product Card UI

Files:

- `src/app/dashboard/create/product-card/page.tsx`
- `src/components/dashboard/product-card/product-card-page.tsx`
- `source-images-upload.tsx` / `source-image-upload.tsx`
- `category-selector.tsx`
- `concept-photo-tab.tsx`
- `marketplace-card-tab.tsx`
- `product-video-tab.tsx`
- `product-card-template-preview.tsx`
- `product-card-variant-gallery.tsx`
- `use-product-card-project.ts`

UI flow:

- User opens `/dashboard/create/product-card`.
- Uploads source product image(s).
- Category/classifier selects or suggests category.
- Concept photo tab: choose category/concept/user prompt, generate concept image.
- Marketplace card tab: choose source (original or concept generation), title/subtitle/benefits/extra/stats/size text, template preset, typography preset, card size, toggles `useIcons`, `useArrows`, `useShadows`, optional layout debug, generation mode single/variants.
- Preview overlay uses SVG preview, safe zones/debug where allowed.
- Generate marketplace card or variants; gallery shows multiple outputs.
- Product video tab: choose source and motion style, generate video.

Current UI problems/limitations:

- Layout/overlay preview can diverge from final Kie image content.
- `preserveProductLabel` exists in renderer pipeline concepts but UI/full real cutout is incomplete.
- Variants UX works but needs usability polish and production testing.
- Typography presets are numerous; final visual quality needs QA on Cyrillic and card sizes.
- Object-aware overlay is heuristic; no true segmentation.

### 5.6 History / Billing / Settings

- `/dashboard/history`: list generations, filters/search from query; detail `/dashboard/history/[id]`.
- `/dashboard/billing`: token packages and payment history; mock Kaspi page exists for dev.
- `/dashboard/settings`: user settings/account basics.

Relevant files:

- `src/app/dashboard/history/page.tsx`
- `src/app/dashboard/history/[id]/page.tsx`
- `src/app/dashboard/billing/page.tsx`
- `src/app/dashboard/settings/page.tsx`

### 5.7 Admin frontend

Files under `src/app/admin/**`.

Admin routes include:

- `/admin`: dashboard.
- `/admin/users`, `/admin/users/[id]`: users, credits/finance.
- `/admin/models`, `/admin/models/new`, `/admin/models/[id]/edit`: AiModel management.
- `/admin/pricing`: pricing studio/formula editor.
- `/admin/payments`, `/admin/payments/[id]`: payments.
- `/admin/token-packages`: token package management.
- `/admin/settings`: AppSetting management.
- `/admin/legal`, `/admin/legal/[slug]/edit`: legal pages.
- `/admin/moderation`, `/admin/moderation/logs`: moderation settings/logs.
- `/admin/audit-logs`: admin audit.
- `/admin/launch-checklist`: prod readiness checklist.
- `/admin/providers`, `/admin/storage`, `/admin/notifications`, `/admin/seo`, `/admin/webhooks`, `/admin/logs`, `/admin/product-card`, `/admin/finance`, `/admin/credit-transactions`, `/admin/promo-codes`.

Permissions:

- Middleware allows ADMIN/SUPER_ADMIN broadly.
- MODERATOR is restricted to allowed moderation paths.
- Fine-grained per-action role checks exist in some services/routes but need audit.

## 6. API routes

Auth:

- `POST /api/auth/register`: creates user; rate-limited; uses password hashing.
- `GET/POST /api/auth/[...nextauth]`: Auth.js handlers.
- `POST /api/auth/forgot-password`: creates reset token/email flow.
- `POST /api/auth/reset-password`: validates token, updates password.
- `GET /api/auth/debug-session`: diagnostics, restricted by env/admin.

Generations:

- `POST /api/generations/image`: auth USER+, active IMAGE GENERAL model; validate settings; reserve credits; enqueue.
- `POST /api/generations/video`: auth USER+, active VIDEO GENERAL model; validate settings/special scenarios; reserve credits; enqueue or inline.
- `POST /api/generations/estimate`: auth USER+, active IMAGE/VIDEO GENERAL model; returns credits/priceBreakdown.
- `GET /api/generations/[id]`: owner/admin access; returns generation status/result.
- `GET /api/generations/[id]/download`: downloads/proxies generated output where supported.

Product card:

- `GET/POST /api/product-card-projects`: list/create projects.
- `GET/PATCH/DELETE /api/product-card-projects/[id]`: project CRUD.
- `POST /api/product-card-projects/[id]/source-images`: add source images.
- `POST /api/product-card-projects/[id]/source-image`: legacy/single source image.
- `POST /api/product-card-projects/[id]/classify`: classify source product.
- `POST /api/product-card-projects/[id]/estimate`: generic estimate.
- `POST /api/product-card-projects/[id]/estimate/concept-photo`: concept estimate.
- `POST /api/product-card-projects/[id]/estimate/marketplace-card`: marketplace estimate.
- `POST /api/product-card-projects/[id]/estimate/video`: video estimate.
- `POST /api/product-card-projects/[id]/preview/marketplace-card`: overlay preview SVG/layout.
- `POST /api/product-card-projects/[id]/generate/concept-photo`: queue concept image.
- `POST /api/product-card-projects/[id]/generate/marketplace-card`: queue marketplace image(s).
- `POST /api/product-card-projects/[id]/generate/video`: queue product video.

Uploads:

- `POST /api/uploads`: auth required; multipart file; purpose validation; upload to local/S3; creates `UploadedFile`.

Payments:

- `POST /api/payments/checkout`: Stripe checkout for token package.
- `POST /api/billing/payments/kaspi/create`: Kaspi/mock payment creation.
- `GET /api/billing/payments/[id]`: payment status/details.
- `POST /api/webhooks/stripe`: Stripe webhook, raw body/signature.
- `POST /api/webhooks/kaspi`: Kaspi webhook/mock confirmation.

Kie:

- `POST /api/webhooks/kie`: Kie webhook with shared secret/bearer/HMAC support; records webhook events and updates generation when possible.

Admin:

- `/api/admin/**`: admin-only or moderator-limited. Includes models pricing, model tests, users credits, finance summary, payments mock confirm, token packages, settings, legal, notifications, moderation, storage/provider checks, launch checklist, SEO, audit-like data.

Health:

- `GET /api/health`: DB/Redis/app status; used by Docker healthcheck.


Дополнительная карта route → сервисы:

| Route | Method | Права | Основные сервисы/файлы |
| --- | --- | --- | --- |
| `/api/auth/register` | POST | public + rate limit | `prisma.user`, `hashPassword`, registration validation |
| `/api/auth/[...nextauth]` | GET/POST | public/session | `src/auth.ts`, Auth.js handlers |
| `/api/auth/forgot-password` | POST | public + rate limit | `passwordReset.ts`, `emailService.ts`/notifications |
| `/api/auth/reset-password` | POST | public token | `passwordReset.ts`, password hash update |
| `/api/generations/image` | POST | logged-in ACTIVE user | `fresh-session-user`, `model-settings`, `moderation`, `pricing`, `credits`, `generationQueue` |
| `/api/generations/video` | POST | logged-in ACTIVE user | `fresh-session-user`, model-specific settings services, `pricing`, `credits`, `generationQueue` or `processGeneration` inline |
| `/api/generations/estimate` | POST | logged-in ACTIVE user | `model-settings`, model-specific validators, `calculateGenerationCreditsWithBreakdown` |
| `/api/generations/[id]` | GET | owner/admin | Prisma `Generation`, output/status serialization |
| `/api/generations/[id]/download` | GET | owner/admin | generation output lookup, URL/proxy/download helpers |
| `/api/uploads` | POST | logged-in ACTIVE user | `upload-file-validation`, `rateLimitService`, `storage.uploadFile`, `UploadedFile` |
| `/api/product-card-projects` | GET/POST | logged-in user | `productCardProjects`, Prisma `ProductCardProject` |
| `/api/product-card-projects/[id]` | GET/PATCH/DELETE | project owner | `productCardProjectAccess`, `productCardProjects` |
| `/api/product-card-projects/[id]/source-images` | POST | project owner | `productCardProjects`, source image metadata normalization |
| `/api/product-card-projects/[id]/classify` | POST | project owner | `productClassifier`, `product-card-categories` |
| `/api/product-card-projects/[id]/estimate/marketplace-card` | POST | project owner | `estimateMarketplaceCardCredits`, `productCardPricing` |
| `/api/product-card-projects/[id]/preview/marketplace-card` | POST | project owner | `buildMarketplaceCardOverlaySpec`, `renderMarketplaceCardOverlaySvg`, object-aware layout |
| `/api/product-card-projects/[id]/generate/marketplace-card` | POST | project owner | `generateMarketplaceCardForProductCard`, `generateMarketplaceCardVariantsForProductCard`, queue services |
| `/api/product-card-projects/[id]/generate/concept-photo` | POST | project owner | `generateConceptPhotoForProductCard`, prompt config, queue services |
| `/api/product-card-projects/[id]/generate/video` | POST | project owner | `generateProductVideoForProductCard`, `productCardResolveSource`, queue services |
| `/api/payments/checkout` | POST | logged-in user | Stripe checkout service, `TokenPackage`, `Payment` |
| `/api/billing/payments/kaspi/create` | POST | logged-in user | Kaspi provider registry/mock, `Payment` |
| `/api/billing/payments/[id]` | GET | payment owner/admin | payment status lookup |
| `/api/webhooks/stripe` | POST | Stripe signature | `process-stripe-webhook`, `applyPurchaseInTransaction` |
| `/api/webhooks/kaspi` | POST | Kaspi secret/provider validation | Kaspi payment confirmation services |
| `/api/webhooks/kie` | POST | Kie secret/bearer/HMAC | `kie-webhook`, `WebhookEvent`, generation status update |
| `/api/health` | GET | public | DB/Redis/env health checks |
| `/api/admin/models/[id]/pricing` | GET/PUT | ADMIN/SUPER_ADMIN | pricing schema read/update, audit log, `adminPricingPinned` |
| `/api/admin/models/[id]/pricing/preview` | POST | ADMIN/SUPER_ADMIN | `modelPricingCalculator.buildPricingPreview` |
| `/api/admin/models/[id]/pricing/live-preview` | POST | ADMIN/SUPER_ADMIN | pricing preview against model/settings |
| `/api/admin/users/[id]/credits/adjust` | POST | ADMIN/SUPER_ADMIN | `credits` admin adjustment + `AdminAuditLog` |
| `/api/admin/providers/kie/check` | POST/GET | ADMIN/SUPER_ADMIN | Kie provider status/check helpers |
| `/api/admin/storage/check` | POST/GET | ADMIN/SUPER_ADMIN | `storageMonitor`, S3/local storage checks |
| `/api/admin/launch-checklist` | GET | ADMIN/SUPER_ADMIN | `launchChecklist` service |

## 7. Env variables

No real values here. See `.env.example` for placeholders.

Core/app:

- `NODE_ENV`: required by runtime conventions; production/development behavior.
- `APP_NAME`: optional UI product name.
- `APP_URL`: required in prod for public origin links.
- `NEXT_PUBLIC_APP_URL`: public browser origin.
- `APP_PUBLISH_PORT`: Docker host port.
- `MAINTENANCE_MODE`, `MAINTENANCE_ALLOW_ADMIN`: optional maintenance gates.

Database/Redis:

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`: Docker postgres.
- `DATABASE_URL`: required; Prisma.
- `QUEUE_MODE`: `redis` for prod, `inline` local dev.
- `REDIS_URL`: required unless `QUEUE_MODE=inline`; BullMQ/health.
- `GENERATION_QUEUE_NAME`, `GENERATION_JOB_ATTEMPTS`, `GENERATION_BACKOFF_MS`, `GENERATION_WORKER_CONCURRENCY`, `GENERATION_LOCK_MS`, `GENERATION_STALLED_MS`: optional queue tuning.

Auth:

- `AUTH_SECRET` or `NEXTAUTH_SECRET`: required.
- `AUTH_URL`, `NEXTAUTH_URL`: prod public URL/cookie correctness.
- `AUTH_DEBUG_SESSION`: optional diagnostics.
- `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`: seed admin only.

Kie:

- `KIE_API_KEY`: required for real generation.
- `KIE_BASE_URL`: required; usually `https://api.kie.ai`.
- `KIE_WEBHOOK_SECRET`: optional/needed for webhook verification.
- `MOCK_KIE`: optional dev mock.
- `MOCK_KIE_IMAGE_URL`, `MOCK_KIE_VIDEO_URL`: optional mock outputs.
- `KIE_SEND_MODEL_IN_BODY`, `KIE_VIDEO_GENERATE_PATH`, `KIE_VIDEO_RECORD_INFO_PATH`, `KIE_FETCH_TIMEOUT_MS`: optional provider tuning.
- `GENERATION_POLL_MAX_ATTEMPTS`, `GENERATION_POLL_INTERVAL_MS`, `GENERATION_POLL_MAX_WALL_MS`, `GENERATION_INLINE_MAX_MS`: polling/timeouts.
- `GENERATION_MAX_INPUT_IMAGE_COUNT`, `GENERATION_MAX_VIDEO_INPUT_COUNT`: input limits.

Storage/upload:

- `UPLOAD_STORAGE`: `local` dev or `s3`.
- `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_PUBLIC_URL`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`: required in production.
- `S3_FORCE_PATH_STYLE`, `S3_TLS_INSECURE`, `S3_TLS_MIN_VERSION`: optional S3 compatibility.
- `GENERATION_OUTPUT_S3_REQUIRED`: if used, should force output mirroring expectations.
- `MAX_IMAGE_UPLOAD_MB`, `MAX_VIDEO_UPLOAD_MB`: upload limits.
- `STORAGE_FETCH_TIMEOUT_MS`: provider URL download timeout.

Payments:

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`: Stripe.
- `KASPI_PAY_ENABLED`, `KASPI_PAY_MOCK`, `KASPI_PROVIDER`, `KASPI_API_BASE_URL`, `KASPI_API_KEY`, `KASPI_MERCHANT_ID`, `KASPI_WEBHOOK_SECRET`, `KASPI_RETURN_URL`, `KASPI_WEBHOOK_URL`: Kaspi.

Email:

- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`.
- Other providers: `RESEND_API_KEY`, `SENDGRID_API_KEY`.
- Runtime email enable/provider flags are mainly AppSetting/admin notification settings.

Product classifier:

- `PRODUCT_CLASSIFIER_PROVIDER`: default `kie_gemini`, alternatives `mock`, `openai`, `gemini`.
- `PRODUCT_CLASSIFIER_MODEL`: model ID override.
- `OPENAI_API_KEY`, `GEMINI_API_KEY`: only if direct providers used.
- `DEFAULT_PRODUCT_CONCEPT_IMAGE_MODEL_SLUG`, `DEFAULT_MARKETPLACE_CARD_IMAGE_MODEL_SLUG`, `DEFAULT_MARKETPLACE_CARD_MODEL_SLUG`, `DEFAULT_PRODUCT_VIDEO_MODEL_SLUG`: default model fallbacks, overridden by AppSetting.

Monitoring:

- `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE`: optional, package not necessarily fully configured.

Rate limits/API:

- `RATE_LIMIT_LOGIN_PER_MINUTE`, `RATE_LIMIT_REGISTRATION_PER_MINUTE`, `RATE_LIMIT_GENERATION_PER_MINUTE`, `RATE_LIMIT_UPLOAD_PER_MINUTE`, `RATE_LIMIT_ADMIN_PER_MINUTE`.
- `API_MAX_JSON_BODY_BYTES`, `API_MAX_WEBHOOK_BODY_BYTES`.

## 8. Seed scripts

All seeds should be treated as idempotent upserts unless noted. Many model seeds use `omitSeedPricingWhenPinned` to avoid overwriting admin-pinned pricing; verify per script before running in prod.

- `db:seed:admin` → `scripts/seed-admin.ts`: creates/updates SUPER_ADMIN user from env. Safe to rerun; changes admin password if env changes.
- `seed:token-packages` → `scripts/seed-token-packages.ts`: token packages. Safe-ish; may update package catalog.
- `seed:kling` → `scripts/seed-kling.ts`: Kling 3.0 and Kling 2.6 video models, settingsSchema/payloadMapping/pricing.
- `seed:kling-motion-control` → `scripts/seed-kling-motion-control.ts`: Kling motion control model and per-second pricing.
- `seed:gpt-image-2-product-card` → `scripts/seed-gpt-image-2-product-card.ts`: product-card GPT Image 2 model.
- `seed:general-kie-image-models` → `scripts/seed-general-kie-image-models.ts`: GENERAL GPT Image 2 T2I/I2I and Seedream. GPT I2I uses `inputUrls` upload list max 16.
- `seed:product-card-models` → `scripts/seed-product-card-models.ts`: product-card scoped classifier/concept/marketplace/video models and defaults.
- `seed:wan` → `scripts/seed-wan.ts`: Wan 2.7/2.6 text/image/reference/video edit models.
- `seed:seedance` → `scripts/seed-seedance.ts`: Seedance 2.0.
- `seed:seedance-fast` → `scripts/seed-seedance-fast.ts`: Seedance 2.0 Fast.
- `seed:seedance-1-5-pro` → `scripts/seed-seedance-1-5-pro.ts`: Seedance 1.5 Pro.
- `seed:seedance-all`: runs all Seedance seeds.
- `seed:happyhorse` → `scripts/seed-happyhorse.ts`: HappyHorse 1.0 models/settings.
- `seed:grok-imagine` → `scripts/seed-grok-imagine.ts`: Grok Imagine image/video variants.
- `seed:hailuo-2-3` → `scripts/seed-hailuo-2-3.ts`: Hailuo 2.3 Standard/Pro image-to-video.
- `seed:sora-2-pro-storyboard` → `scripts/seed-sora-2-pro-storyboard.ts`: Sora storyboard model.
- `seed:veo-3-1` → `scripts/seed-veo-31.ts`: Veo generate/extend/get-4K/get-1080p models.

Tables touched: mainly `AiModel`, sometimes `AppSetting`, `TokenPackage`, `User`. Price overwrite risk depends on script and `adminPricingPinned` guard. Do not run destructive script `db:models:wan-only` in normal prod.

## 9. Production / Deploy

Typical Docker flow from `README_DEPLOY.md`:

```bash
git pull
docker compose up -d --build
docker compose ps
curl -sS http://127.0.0.1:3000/api/health
```

Migrations (only when new Prisma migrations exist):

```bash
docker compose run --rm --env-file .env -v "$(pwd)":/work -w /work node:20-alpine sh -c \
  "apk add --no-cache libc6-compat openssl && npm ci && npx prisma migrate deploy"
```

Logs:

```bash
docker compose logs --tail=100 app
docker compose logs --tail=100 worker
docker compose logs --tail=100 postgres
docker compose logs --tail=100 redis
```

Worker:

- In Compose, `worker` service builds from `Dockerfile.worker` and reads same `.env`.
- Must run for redis queue production.

Redis/Postgres:

- Compose healthchecks are configured.
- Postgres volume `postgres_data`, Redis volume `redis_data`.

Nginx:

- External reverse proxy usually listens 80/443 and proxies to `127.0.0.1:${APP_PUBLISH_PORT}`.
- Must forward `Host`, `X-Forwarded-Proto`, `X-Forwarded-For` for auth/cookies/rate-limit correctness.

Landing:

- `qazcard-landing` is separate; current uncommitted binary/image changes exist. Do not include in app deploy unless intended.

## 10. Что уже готово

Confirmed by code:

- Credentials auth with roles/status and JWT sessions.
- Registration, login, forgot/reset password routes.
- Middleware protection for dashboard/admin and maintenance mode.
- Prisma schema for users, models, generations, payments, credits, uploads, product cards, settings, legal, email, webhooks.
- General image/video generation APIs.
- Estimate endpoint and PRICE_CHANGED protection.
- Credit reserve/capture/refund ledger.
- BullMQ queue and worker.
- Kie provider integration for multiple families: GPT Image 2, Kling, Seedance, Wan, Grok, Hailuo, Sora, Veo, HappyHorse.
- Upload route with local dev/S3 production architecture.
- Model catalog + search/filter.
- Model detail hubs with modes/forms from `settingsSchema`.
- Product-card project UI and backend: source upload, classification, concept, marketplace card, video, variants, overlay.
- Admin routes for models/pricing/payments/users/settings/legal/moderation/storage/providers/notifications/etc.
- Token packages and Stripe checkout/webhook architecture.
- Kaspi mock/architecture.
- Health endpoint and Docker Compose app/worker/postgres/redis.

## 11. Что частично готово

- Universal model hubs: implemented generically, but every Kie settingsSchema still needs QA against official docs and UI usability.
- Product-card overlay: object-aware and strict-ish no-overlap heuristics exist, but no true segmentation.
- `preserveProductLabel`: flag/metadata concept exists, not full cutout pipeline.
- Role/permissions: roles and middleware exist; per-action permissions need audit.
- Pricing: strong base exists; all seeds/admin formulas need final production review.
- Payments: Stripe/Kaspi routes exist; production credentials/webhook validation must be tested live.
- Email: templates/settings/services exist; provider config and deliverability need setup.
- Sentry/monitoring: env placeholder, not fully integrated.
- Google OAuth: not implemented; only credentials auth.
- Some provider outputs may stay provider URLs if S3 fetch/upload fails unless production config enforces stricter behavior.

## 12. Что не готово / риски

- Production worker/Redis not verified end-to-end on target VPS.
- S3 production permissions/CDN/CORS/TLS may fail without careful setup.
- Real Kie generation can fail due to Kie account credits, API changes, overload, model-specific payload mismatches.
- Settings schemas may lag Kie docs; every model family needs real API smoke tests.
- Pricing can be wrong if seed provider costs/manual overrides are stale.
- Seeds can overwrite prices unless guarded by `adminPricingPinned` in that script.
- Product-card overlay can overlap product on hard images; no true segmentation.
- preserve label/cutout is not production-grade.
- Google OAuth absent.
- Roles/permissions incomplete for complex admin workflows.
- Email provider not fully configured by default.
- Payment production credentials and webhooks need live verification.
- `.env` URL mismatch (`APP_URL`/`AUTH_URL`/`NEXTAUTH_URL`) can break login/cookies.
- Docker build uses `SKIP_ENV_VALIDATION=1`; runtime env must be complete.

## 13. Следующие задачи по приоритетам

P0 — критично для production:

- End-to-end smoke on VPS: auth, upload, estimate, image generation, video generation, worker, history.
- Verify Redis worker logs and retry/refund behavior.
- Verify S3 upload and generated output mirroring.
- Verify Kie API key/base URL and real model calls for main models.
- Verify `/api/health` through Nginx and localhost.
- Ensure `APP_URL`, `AUTH_URL`, `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL` all match production domain.
- Run Prisma migrations if new migrations exist.
- Backup Postgres before deploys.
- Audit seed price overwrite safety before running seeds on prod.

P1 — важно для запуска:

- Real smoke for each model hub mode against Kie docs.
- Admin pricing formulas and live preview final QA.
- Video per-second pricing / duration pricing validation.
- Roles/permissions audit for ADMIN/MODERATOR.
- Product-card strict no-overlap QA and fallback rules.
- Payment webhook live test Stripe/Kaspi/mock separation.
- Email provider setup and password reset email test.

P2 — UX improvements:

- Better mode cards in model hubs (docs hints, examples, recommended settings).
- Variants UX improvements and better progress states.
- Typography/overlay preview refinements.
- Better error messages for Kie provider-specific failures.
- Better admin model/schema editor UX.

P3 — later:

- Google OAuth.
- Sentry/metrics/analytics.
- Real segmentation/cutout pipeline for product labels.
- Advanced templates marketplace.
- Automated model docs import from Kie docs.

## 14. Список самых важных файлов

Лучше всего отправить ChatGPT в новый чат:

- `package.json`
- `prisma/schema.prisma`
- `docker-compose.yml`
- `Dockerfile`
- `Dockerfile.worker`
- `.env.example`
- `README_DEPLOY.md`
- `src/auth.ts`
- `src/middleware.ts`
- `src/lib/auth.ts`
- `src/lib/env.ts`
- `src/lib/dashboard-nav.ts`
- `scripts/worker.ts`
- `src/server/workers/generationWorker.ts`
- `src/server/queues/generationQueue.ts`
- `src/server/queues/redisConnection.ts`
- `src/server/services/generationProcessor.ts`
- `src/server/services/provider/kie.ts`
- `src/server/services/credits.ts`
- `src/server/services/modelPricingCalculator.ts`
- `src/server/services/pricing.ts`
- `src/server/services/productCardGeneration.ts`
- `src/server/services/productCardQueueGenerations.ts`
- `src/server/services/productCardOverlayRenderer.ts`
- `src/server/services/marketplaceCardImageComposite.ts`
- `src/server/services/productCardObjectAwareLayout.ts`
- `src/server/services/productCardRasterLayout.ts`
- `src/server/services/productCardPricing.ts`
- `src/config/generation-models.ts`
- `src/config/product-card-prompts.ts`
- `src/config/product-card-overlay-presets.ts`
- `src/lib/generation-models-catalog.ts`
- `src/app/api/generations/image/route.ts`
- `src/app/api/generations/video/route.ts`
- `src/app/dashboard/models/page.tsx`
- `src/app/dashboard/create/product-card/page.tsx`
- `src/components/dashboard/product-card/**`
- `scripts/seed-*.ts`

## 15. PROJECT_FILE_TREE.txt

Создан отдельный файл `PROJECT_FILE_TREE.txt` со списком файлов репозитория, исключая `node_modules`, `.next`, `dist`, `build`, `.git`, `coverage`.

## 16. PROJECT_KEY_FILES.md

Создан отдельный файл `PROJECT_KEY_FILES.md` с содержимым ключевых файлов:

- `package.json`
- `prisma/schema.prisma`
- `docker-compose.yml`
- `.env.example`
- `src/auth.ts`
- `src/middleware.ts`
- `src/server/services/generationProcessor.ts`
- `src/server/services/productCardGeneration.ts`
- `src/server/services/productCardOverlayRenderer.ts`
- `src/server/services/productCardObjectAwareLayout.ts`
- `src/server/services/productCardPricing.ts`
- `src/config/generation-models.ts`
- `src/config/product-card-overlay-presets.ts`
- `src/app/dashboard/models/page.tsx`
- `src/components/dashboard/product-card/marketplace-card-tab.tsx`

Не включены `.env`, реальные секреты, `node_modules`, `.next`, бинарные файлы, изображения, логи, database dumps.
