# QazCard AI — ключевые файлы
> Сгенерировано для передачи в новый чат. Реальный `.env` не включён; ниже только `.env.example` с placeholder-значениями.

## `package.json`
```json
{
  "name": "ai-media-saas",
  "version": "0.1.0",
  "private": true,
  "engines": {
    "node": "^20.19.0 || ^22.12.0 || >=24.0.0",
    "npm": ">=9.0.0"
  },
  "scripts": {
    "dev": "next dev",
    "dev:lan": "next dev --hostname 0.0.0.0",
    "build": "next build --webpack",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "postinstall": "node scripts/patch-prisma-dev-zeptomatch.cjs && prisma generate",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:push": "prisma db push",
    "db:studio": "prisma studio",
    "db:validate": "node scripts/patch-prisma-dev-zeptomatch.cjs && prisma validate",
    "db:seed:admin": "prisma generate && npx tsx scripts/seed-admin.ts",
    "seed:token-packages": "npx tsx scripts/seed-token-packages.ts",
    "seed:kling": "npx tsx scripts/seed-kling.ts",
    "seed:kling-motion-control": "npx tsx scripts/seed-kling-motion-control.ts",
    "seed:gpt-image-2-product-card": "npx tsx scripts/seed-gpt-image-2-product-card.ts",
    "seed:general-kie-image-models": "npx tsx scripts/seed-general-kie-image-models.ts",
    "seed:product-card-models": "npx tsx scripts/seed-product-card-models.ts",
    "seed:wan": "npx tsx scripts/seed-wan.ts",
    "seed:seedance": "npx tsx scripts/seed-seedance.ts",
    "seed:seedance-fast": "npx tsx scripts/seed-seedance-fast.ts",
    "seed:seedance-1-5-pro": "npx tsx scripts/seed-seedance-1-5-pro.ts",
    "seed:seedance-all":
      "npx tsx scripts/seed-seedance.ts && npx tsx scripts/seed-seedance-fast.ts && npx tsx scripts/seed-seedance-1-5-pro.ts",
    "seed:happyhorse": "prisma generate && npx tsx scripts/seed-happyhorse.ts",
    "seed:grok-imagine": "npx tsx scripts/seed-grok-imagine.ts",
    "seed:hailuo-2-3": "npx tsx scripts/seed-hailuo-2-3.ts",
    "seed:sora-2-pro-storyboard": "npx tsx scripts/seed-sora-2-pro-storyboard.ts",
    "seed:veo-3-1": "npx tsx scripts/seed-veo-31.ts",
    "db:models:wan-only": "npx tsx scripts/delete-models-except-wan.ts",
    "worker": "npx tsx scripts/worker.ts",
    "verify:product-card-overlay": "npx tsx scripts/verify-product-card-overlay-strict.ts"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.1045.0",
    "@aws-sdk/s3-request-presigner": "^3.1045.0",
    "@base-ui/react": "^1.4.1",
    "@prisma/adapter-pg": "^7.8.0",
    "@prisma/client": "^7.8.0",
    "@smithy/node-http-handler": "^4.6.1",
    "@types/nodemailer": "^7.0.11",
    "bcryptjs": "^3.0.3",
    "bullmq": "^5.76.6",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "dotenv": "^17.4.2",
    "ioredis": "^5.10.1",
    "lucide-react": "^1.14.0",
    "next": "16.2.6",
    "next-auth": "^5.0.0-beta.31",
    "nodemailer": "^7.0.13",
    "pg": "^8.20.0",
    "react": "19.2.6",
    "react-dom": "19.2.6",
    "server-only": "^0.0.1",
    "sharp": "^0.34.5",
    "sonner": "^2.0.7",
    "stripe": "^20.4.1",
    "tailwind-merge": "^3.5.0",
    "tsx": "^4.21.0",
    "tw-animate-css": "^1.4.0",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/bcryptjs": "^2.4.6",
    "@types/node": "^20",
    "@types/pg": "^8.20.0",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.6",
    "picomatch": "^4.0.4",
    "prisma": "^7.8.0",
    "shadcn": "^4.7.0",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}

```

## `prisma/schema.prisma`
```prisma
// Stage 1 — полная схема БД (см. PROJECT_SPEC.md, DEVELOPMENT_PLAN.md).
// Миграции: `npx prisma migrate dev --name stage1_init` (локально).

generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

// --- Enums ---

enum UserRole {
  USER
  MODERATOR
  ADMIN
  SUPER_ADMIN
}

enum UserStatus {
  ACTIVE
  INACTIVE
  BLOCKED
  PENDING_VERIFICATION
}

enum GenerationType {
  IMAGE
  VIDEO
}

enum GenerationStatus {
  CREATED
  QUEUED
  PROCESSING
  COMPLETED
  FAILED
  BLOCKED
  CANCELLED
  REFUNDED
}

enum PaymentStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  REFUNDED
  CANCELLED
}

enum CreditTransactionType {
  /// Покупка / зачисление кредитов (платёж)
  PURCHASE
  /// Резерв под генерацию
  RESERVE
  /// Списание после успешной генерации
  CAPTURE
  /// Возврат (ошибка провайдера и т.п.)
  REFUND
  /// Ручная корректировка админом
  ADMIN_ADJUSTMENT
  /// Промокод / бонус
  PROMO
}

enum AiModelProvider {
  KIE_AI
  OTHER
}

enum WebhookEventStatus {
  RECEIVED
  PROCESSING
  PROCESSED
  FAILED
}

/// Факт покупки пакета токенов (не подписка) — для истории и «последнего пакета».
enum UserTokenPackageStatus {
  ACTIVE
  COMPLETED
  CANCELLED
  REFUNDED
}

// --- Models ---

model User {
  id             String     @id @default(cuid())
  email          String     @unique
  passwordHash   String
  name           String?
  role           UserRole   @default(USER)
  status         UserStatus @default(ACTIVE)
  balanceCredits Int        @default(0)
  emailVerified  Boolean    @default(false)
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  generations        Generation[]
  payments           Payment[]
  creditTransactions CreditTransaction[]
  uploadedFiles      UploadedFile[]
  adminActions       AdminAuditLog[]     @relation("AdminAuditActor")
  appSettingsUpdated AppSetting[]        @relation("AppSettingUpdatedBy")
  userTokenPackages  UserTokenPackage[]
  productCardProjects ProductCardProject[]
  moderationLogs    ModerationLog[]
  legalPagesUpdated  LegalPage[]     @relation("LegalPageUpdatedBy")
  /// Throttle: не дублировать LOW_BALANCE слишком часто
  lastLowBalanceEmailAt DateTime?
  passwordResetTokens PasswordResetToken[]

  @@index([status])
  @@index([role])
  @@map("users")
}

/// Восстановление пароля: в БД только hash токена (SHA-256 hex).
model PasswordResetToken {
  id         String    @id @default(cuid())
  userId     String
  tokenHash  String    @unique
  expiresAt  DateTime
  usedAt     DateTime?
  createdAt  DateTime  @default(now())
  ipAddress  String?   @db.VarChar(128)
  userAgent  String?   @db.VarChar(512)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
  @@index([usedAt])
  @@map("password_reset_tokens")
}

model Plan {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  price     Decimal  @db.Decimal(12, 2)
  currency  String   @db.VarChar(8)
  credits   Int
  /// Лимиты тарифа (JSON): квоты, флаги и т.д.
  limits    Json?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("plans")
}

/// Пакеты внутренних токенов (оплата в ₸, начисление totalTokens).
model TokenPackage {
  id           String   @id @default(cuid())
  name         String
  slug         String   @unique
  priceKzt     Int
  baseTokens   Int
  bonusTokens  Int      @default(0)
  /// Дублирует baseTokens + bonusTokens; пересчитывается в приложении.
  totalTokens  Int
  description  String?
  isActive     Boolean  @default(true)
  sortOrder    Int      @default(0)
  metadata     Json?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  payments          Payment[]
  userTokenPackages UserTokenPackage[]

  @@index([isActive, sortOrder])
  @@map("token_packages")
}

model AiModel {
  id                     String            @id @default(cuid())
  name                   String
  slug                   String            @unique
  provider               AiModelProvider
  type                   GenerationType
  /// Область использования модели: GENERAL — обычные генерации, PRODUCT_CARD — только карточка товара.
  scope                  String            @default("GENERAL") @db.VarChar(32)
  /// Роль модели внутри Product Card flow: PRODUCT_CLASSIFIER / PRODUCT_CONCEPT_IMAGE / PRODUCT_MARKETPLACE_CARD / PRODUCT_VIDEO.
  productCardModelType   String?           @db.VarChar(64)
  apiModelId             String
  endpoint               String?
  costCredits            Int
  realCost               Decimal?          @db.Decimal(12, 4)
  isActive               Boolean           @default(true)
  /// JSON Schema или иной JSON с описанием полей модели для админки/UI
  settingsSchema         Json?
  /// Правила динамической цены (matrix и т.д.)
  pricingSchema          Json?
  /// Соответствие полей настроек телу запроса провайдера (например Kie Market createTask)
  payloadMapping         Json?
  /// Относительный путь или URL для polling статуса задачи (recordInfo)
  statusEndpoint         String?
  description            String?
  supportsImageInput     Boolean           @default(false)
  supportsVideoInput     Boolean           @default(false)
  supportsNegativePrompt Boolean           @default(false)
  supportsSeed           Boolean           @default(false)
  maxDuration            Int?
  availableAspectRatios  Json?
  availableResolutions   Json?
  createdAt              DateTime          @default(now())
  updatedAt              DateTime          @updatedAt

  generations   Generation[]
  moderationLogs ModerationLog[]

  @@index([provider, isActive])
  @@index([type, isActive])
  @@index([scope, type, isActive])
  @@index([scope, productCardModelType, isActive])
  @@map("ai_models")
}

model Generation {
  id              String            @id @default(cuid())
  userId          String
  modelId         String
  type            GenerationType
  status          GenerationStatus  @default(CREATED)
  prompt          String            @db.Text
  negativePrompt  String?           @db.Text
  /// Ссылки на входные файлы (JSON-массив и т.д.)
  inputFiles      Json?
  /// Результаты (URL, storage keys и т.д.) — медиа в S3-compatible storage
  outputFiles     Json?
  providerTaskId  String?
  costCredits     Int               @default(0)
  errorMessage    String?           @db.Text
  metadata        Json?
  createdAt       DateTime          @default(now())
  completedAt     DateTime?
  updatedAt       DateTime          @updatedAt

  user                User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  model               AiModel              @relation(fields: [modelId], references: [id], onDelete: Restrict)
  creditTransactions  CreditTransaction[]
  apiLogs             ApiLog[]
  uploadedFiles       UploadedFile[]
  moderationLogs     ModerationLog[]

  @@index([userId, createdAt])
  @@index([status, createdAt])
  @@index([modelId])
  @@map("generations")
}

model Payment {
  id                String        @id @default(cuid())
  userId            String
  /// Связь с каталогом пакетов токенов (если оплата — за пакет).
  tokenPackageId    String?
  provider          String        @db.VarChar(64)
  providerPaymentId String?       @db.VarChar(255)
  amount            Decimal       @db.Decimal(12, 2)
  currency          String        @db.VarChar(8)
  /// Начисляемые токены (в БД: credits).
  credits           Int
  status            PaymentStatus @default(PENDING)
  /// Время подтверждения оплаты (webhook / server-side confirm).
  paidAt            DateTime?
  metadata          Json?
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenPackage  TokenPackage? @relation(fields: [tokenPackageId], references: [id], onDelete: SetNull)
  creditTransactions CreditTransaction[]
  userTokenPackage   UserTokenPackage?

  @@index([userId, createdAt])
  @@index([status])
  @@index([tokenPackageId])
  @@unique([provider, providerPaymentId])
  @@map("payments")
}

model UserTokenPackage {
  id            String   @id @default(cuid())
  userId        String
  packageId     String
  /// Stripe/PDF — один раз на успешный платёж; у ручного гранта null.
  paymentId     String?  @unique
  /// Снимок на момент покупки
  packageName   String
  priceKzt      Int
  baseTokens    Int
  bonusTokens   Int
  totalTokens   Int
  status        UserTokenPackageStatus @default(COMPLETED)
  purchasedAt   DateTime               @default(now())
  createdAt     DateTime               @default(now())
  updatedAt     DateTime               @updatedAt

  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenPackage TokenPackage @relation(fields: [packageId], references: [id], onDelete: Restrict)
  payment      Payment?     @relation(fields: [paymentId], references: [id], onDelete: SetNull)

  @@index([userId, purchasedAt])
  @@index([packageId])
  @@index([status])
  @@map("user_token_packages")
}

model CreditTransaction {
  id            String                @id @default(cuid())
  userId        String
  generationId  String?
  paymentId     String?
  type          CreditTransactionType
  /// Изменение баланса в кредитах (+ начисление, − списание — по соглашению приложения)
  amount        Int
  reason        String?               @db.VarChar(512)
  metadata      Json?
  createdAt     DateTime              @default(now())

  user       User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  generation Generation? @relation(fields: [generationId], references: [id], onDelete: SetNull)
  payment    Payment?    @relation(fields: [paymentId], references: [id], onDelete: SetNull)

  @@index([userId, createdAt])
  @@index([generationId])
  @@index([paymentId])
  @@index([type])
  @@map("credit_transactions")
}

model ApiLog {
  id               String   @id @default(cuid())
  generationId     String?
  provider         String   @db.VarChar(64)
  endpoint         String   @db.VarChar(2048)
  /// Без секретов и ключей — фильтрация на уровне приложения
  requestPayload   Json?
  responsePayload  Json?
  statusCode       Int?
  errorMessage     String?  @db.Text
  createdAt        DateTime @default(now())

  generation Generation? @relation(fields: [generationId], references: [id], onDelete: SetNull)

  @@index([generationId, createdAt])
  @@index([provider, createdAt])
  @@map("api_logs")
}

model UploadedFile {
  id           String   @id @default(cuid())
  userId       String
  generationId String?
  fileName     String   @db.VarChar(512)
  fileType     String   @db.VarChar(64)
  mimeType     String   @db.VarChar(128)
  size         Int
  storageKey   String   @db.VarChar(1024)
  url          String?  @db.VarChar(2048)
  metadata     Json?
  createdAt    DateTime @default(now())

  user       User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  generation Generation? @relation(fields: [generationId], references: [id], onDelete: SetNull)
  productCardProjectsAsSource ProductCardProject[] @relation("ProductCardSourceImage")

  @@index([userId, createdAt])
  @@index([generationId])
  @@index([storageKey])
  @@map("uploaded_files")
}

model PromoCode {
  id         String    @id @default(cuid())
  code       String    @unique @db.VarChar(64)
  /// Например PERCENT, FIXED_CREDITS — расширяется приложением
  type       String    @db.VarChar(32)
  value      Decimal   @db.Decimal(12, 4)
  maxUses    Int?
  usedCount  Int       @default(0)
  expiresAt  DateTime?
  isActive   Boolean   @default(true)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  @@map("promo_codes")
}

model AdminAuditLog {
  id           String   @id @default(cuid())
  adminUserId  String
  action       String   @db.VarChar(128)
  targetType   String   @db.VarChar(64)
  targetId     String?  @db.VarChar(64)
  oldValue     Json?
  newValue     Json?
  metadata     Json?
  createdAt    DateTime @default(now())

  admin User @relation("AdminAuditActor", fields: [adminUserId], references: [id], onDelete: Restrict)

  @@index([adminUserId, createdAt])
  @@index([targetType, targetId])
  @@map("admin_audit_logs")
}

model AppSetting {
  id          String   @id @default(cuid())
  key         String   @unique @db.VarChar(128)
  value       Json
  type        String   @db.VarChar(64)
  description String?  @db.Text
  updatedBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  editor User? @relation("AppSettingUpdatedBy", fields: [updatedBy], references: [id], onDelete: SetNull)

  @@map("app_settings")
}

/// Проект «карточка товара» (маркетплейс-флоу): одно исходное фото, категория, три вкладки генерации.
model ProductCardProject {
  id                 String   @id @default(cuid())
  userId             String
  title              String?
  sourceImageFileId  String?
  sourceImageUrl     String?
  /// До 4 исходных фото товара: main/side/back/detail. Legacy-поля выше хранят main.
  sourceImages       Json?
  detectedCategory   String?  @db.VarChar(64)
  selectedCategory   String?  @db.VarChar(64)
  /// ai | manual | mock
  categorySource     String?  @db.VarChar(32)
  classificationConfidence Float?
  classificationReason     String?  @db.Text
  status             String   @default("DRAFT") @db.VarChar(32)
  /// conceptGenerationIds, lastGenerationId и т.д.
  metadata           Json?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  user            User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  sourceImageFile UploadedFile? @relation("ProductCardSourceImage", fields: [sourceImageFileId], references: [id], onDelete: SetNull)

  @@index([userId, createdAt])
  @@index([sourceImageFileId])
  @@map("product_card_projects")
}

/// Блокировки и события модерации (операционный лог, не путать с AdminAuditLog).
model ModerationLog {
  id            String   @id @default(cuid())
  userId        String?
  generationId  String?
  modelId       String?
  flow          String?  @db.VarChar(64)
  promptPreview String?  @db.VarChar(500)
  reason        String
  rule          String?  @db.VarChar(128)
  matchedText   String?  @db.VarChar(512)
  severity      String?  @db.VarChar(16)
  metadata      Json?
  createdAt     DateTime @default(now())

  user       User?       @relation(fields: [userId], references: [id], onDelete: SetNull)
  generation Generation? @relation(fields: [generationId], references: [id], onDelete: SetNull)
  model      AiModel?    @relation(fields: [modelId], references: [id], onDelete: SetNull)

  @@index([userId, createdAt])
  @@index([createdAt])
  @@index([generationId])
  @@index([modelId])
  @@map("moderation_logs")
}

/// Юридические страницы (CMS-лайт; публично только PUBLISHED).
model LegalPage {
  id          String   @id @default(cuid())
  slug        String   @unique @db.VarChar(64)
  title       String
  content     String   @db.Text
  status      String   @default("DRAFT") @db.VarChar(32)
  version     Int      @default(1)
  publishedAt DateTime?
  updatedBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  metadata    Json?

  updatedByUser User? @relation("LegalPageUpdatedBy", fields: [updatedBy], references: [id], onDelete: SetNull)

  @@index([slug])
  @@index([status])
  @@map("legal_pages")
}

/// Шаблоны email для уведомлений (секреты не храним — только в env)
model EmailTemplate {
  id         String   @id @default(cuid())
  key        String   @unique
  name       String
  subject    String
  bodyText   String?  @db.Text
  bodyHtml   String?  @db.Text
  isActive   Boolean  @default(true)
  variables  Json?
  version    Int      @default(1)
  updatedBy  String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([isActive, key])
  @@map("email_templates")
}

/// Throttle критичных писем админам (anti-spam)
model AdminEmailThrottle {
  id         String   @id
  lastSentAt DateTime

  @@map("admin_email_throttles")
}

model WebhookEvent {
  id           String              @id @default(cuid())
  provider     String              @db.VarChar(64)
  eventType    String              @db.VarChar(128)
  /// ID события у провайдера (например Stripe evt_...). Для idempotency повторов webhook.
  providerEventId String?          @db.VarChar(128)
  payload      Json
  status       WebhookEventStatus  @default(RECEIVED)
  processedAt  DateTime?
  errorMessage String?             @db.Text
  createdAt    DateTime            @default(now())

  @@index([provider, status, createdAt])
  @@index([eventType])
  @@unique([provider, providerEventId])
  @@map("webhook_events")
}

```

## `docker-compose.yml`
```yaml
name: ai-media-saas

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}
      POSTGRES_DB: ${POSTGRES_DB:-ai_media_app}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

  app:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "${APP_PUBLISH_PORT:-3000}:3000"
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "fetch('http://127.0.0.1:3000/api/health').then((r) => (r.status === 200 ? process.exit(0) : process.exit(1))).catch(() => process.exit(1))",
        ]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 50s
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    restart: unless-stopped
    env_file:
      - .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

volumes:
  postgres_data:
  redis_data:

```

## `.env.example`
```dotenv
# App
NODE_ENV=development
# Публичное имя продукта (по умолчанию: QazCard AI; для UI в клиенте при переопределении: NEXT_PUBLIC_APP_NAME)
APP_NAME="QazCard AI"
APP_URL=http://localhost:3000
# Техработы: редирект всего сайта на /maintenance, API (кроме webhooks/health/auth) → 503, регистрация закрыта.
# MAINTENANCE_MODE=1
# Опционально: для ADMIN/SUPER_ADMIN полный доступ (кабинет /dashboard + /admin + API), как без техработ; иначе у всех экран «ведутся технические работы»
# MAINTENANCE_ALLOW_ADMIN=1
# Дублировать флаг в Admin → App settings MAINTENANCE_MODE блокирует регистрацию и API без редиректа (для редиректа нужен env выше).
# Production: APP_URL, AUTH_URL и NEXTAUTH_URL — один публичный https://… иначе сессия/редиректы могут оставлять на /login.
# Очередь: redis (Bull/воркер) | inline (без Bull в API — только локальная разработка; при inline REDIS в env-валидации не обязателен)
QUEUE_MODE=inline
# Для redis-режима и документации; при QUEUE_MODE=inline можно оставить даже без запущенного Redis
REDIS_URL=redis://localhost:6379
# Stage 17: при старте проверяются обязательные переменные (src/lib/env.ts + instrumentation).
# Сборка образа `npm run build` в Dockerfile использует SKIP_ENV_VALIDATION=1; в рантайме не задавать.
# Локально: при неполном .env для `next build` можно разово: SKIP_ENV_VALIDATION=1
# Опционально для клиента (публичные значения только с префиксом NEXT_PUBLIC_)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# --- Docker Compose: Postgres (должны совпадать с DATABASE_URL ниже) ---
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=ai_media_app
# Порт приложения на хосте (docker compose)
APP_PUBLISH_PORT=3000

# Database (Docker Compose: хост postgres; локально без Docker: localhost)
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/ai_media_app
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ai_media_app

# Auth (NextAuth v5: AUTH_SECRET обязателен в production; NEXTAUTH_* — алиасы)
AUTH_SECRET=change_me_use_openssl_rand_base64_32
# Публичный URL приложения (схема + хост + порт). На production = https и тот же домен, что в Safari (www / без www).
# Иначе cookie сессии и вход с iPhone могут не совпадать с реальным сайтом.
# Без AUTH_* на Vercel подставляется https://$VERCEL_URL (см. src/lib/bootstrap-auth-public-url.ts); для кастомного домена укажите вручную.
# В `next dev` localhost в AUTH_* сбрасывается, чтобы вход по http://<LAN-IP>:3000 с телефона работал без правки .env. Вернуть: KEEP_DEV_LOCALHOST_AUTH_URL=1
AUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=change_me
NEXTAUTH_URL=http://localhost:3000
# Временная диагностика: GET /api/auth/debug-session без роли admin (только в production при явном флаге; без флага — только ADMIN/SUPER_ADMIN)
# AUTH_DEBUG_SESSION=1

# Initial admin
SUPER_ADMIN_EMAIL=admin@example.com
SUPER_ADMIN_PASSWORD=change_me_secure_password

# Kie.ai (баланс в кабинете Kie ≠ токены в приложении; «Credits insufficient» в ответе API — кредиты Kie)
KIE_API_KEY=your_kie_api_key
KIE_BASE_URL=https://api.kie.ai
# MOCK_KIE=true — не вызывать Kie.ai: эмуляция успеха, mock_task_<timestamp>, placeholder-результат. Кредиты: резерв → подтверждение как при успехе.
MOCK_KIE=false
# Опц.: свои URL для вывода (по умолчанию placehold + публичное тестовое видео MDN)
# MOCK_KIE_IMAGE_URL=https://placehold.co/1024x1024.png
# MOCK_KIE_VIDEO_URL=https://...
# 1 = добавить apiModelId в тело JSON (для унифицированных API); для gpt4o-image обычно не нужен
# KIE_SEND_MODEL_IN_BODY=0
# Webhook: POST /api/webhooks/kie (Bearer, X-Webhook-Token или X-Kie-Signature: sha256 HMAC)
KIE_WEBHOOK_SECRET=optional_webhook_secret
# Модерация промптов: таблица AppSetting, ключ moderation_settings (JSON), см. карточку в /admin/settings
# Polling: лимит wall-clock (с); 0 = только GENERATION_POLL_MAX_ATTEMPTS
# GENERATION_POLL_MAX_WALL_MS=0
# Опц.: макс. число референс-URL (по умолчанию 5)
# GENERATION_MAX_INPUT_IMAGE_COUNT=5

# Redis (BullMQ: см. REDIS_URL выше; в Docker: redis://redis:6379)
# REDIS_URL=redis://redis:6379
# GENERATION_QUEUE_NAME=ai-media-generation
# GENERATION_JOB_ATTEMPTS=3
# Пуллинг результата Kie (картинка/видео). По умолчанию на сервере 200 попыток × 2 с ≈ 6м40с; карточки товара при перегрузке — до 240–300.
# GENERATION_POLL_MAX_ATTEMPTS=200
# GENERATION_POLL_INTERVAL_MS=2000
# KIE_VIDEO_GENERATE_PATH=/api/v1/video/generate
# KIE_VIDEO_RECORD_INFO_PATH=/api/v1/video/record-info

# --- Загрузки / результаты ---
# В development по умолчанию: файлы в public/uploads, URL /uploads/... (S3 в .env не обязателен).
# Явно: UPLOAD_STORAGE=local — то же; UPLOAD_STORAGE=s3 — настоящий S3/MinIO (нужны все S3_*; при self-signed: S3_TLS_INSECURE=1).
# В production: только S3, UPLOAD_STORAGE=local запрещён.
# UPLOAD_STORAGE=s3
# S3-compatible storage (R2 / S3 / Yandex / Selectel). Если не задано полностью — output остаётся URL провайдера.
S3_ENDPOINT=https://example.r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY_ID=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET=your_bucket
# Публичный origin (CDN) для ссылок в UI/БД
S3_PUBLIC_URL=https://cdn.example.com
# Для не-AWS по умолчанию true; для нативного Amazon S3 можно S3_FORCE_PATH_STYLE=false
# S3_FORCE_PATH_STYLE=true
# Ошибка PutObject: проверьте, что бакет существует, ключи/политика дают s3:PutObject, S3_REGION для провайдера
# Ошибка TLS / handshake (ssl/tls alert 40) к MinIO/self-signed: S3_TLS_INSECURE=1 (только dev, отключает проверку сертификата)
# S3_TLS_INSECURE=1
# S3_TLS_MIN_VERSION=TLSv1.2
# Скачивание с URL провайдера (мс)
# STORAGE_FETCH_TIMEOUT_MS=300000
# HTTP-таймаут вызовов Kie.ai (генерация + polling), мс (мин. 5000)
# KIE_FETCH_TIMEOUT_MS=120000
# Верхняя граница wall-clock для QUEUE_MODE=inline, мс (0 = не задавать отдельный лимит)
# GENERATION_INLINE_MAX_MS=300000

# Upload limits
MAX_IMAGE_UPLOAD_MB=10
MAX_VIDEO_UPLOAD_MB=100
# GENERATION_MAX_VIDEO_INPUT_COUNT=3

# Kaspi Pay (архитектура + mock; реальные credentials подключаются отдельно; секреты только в env)
# Кредиты начисляются только после подтверждения на сервере (webhook или mock-confirm в dev).
KASPI_PAY_ENABLED=false
KASPI_PAY_MOCK=true
KASPI_PROVIDER=mock
KASPI_API_BASE_URL=
KASPI_API_KEY=
KASPI_MERCHANT_ID=
KASPI_WEBHOOK_SECRET=
KASPI_RETURN_URL=http://localhost:3000/dashboard/billing
KASPI_WEBHOOK_URL=http://localhost:3000/api/webhooks/kaspi

# Payments (Stripe Checkout + webhook; кредиты только после webhook)
# Secret key: Dashboard → Developers → API keys
STRIPE_SECRET_KEY=sk_test_xxx
# Webhook signing secret: stripe listen / Dashboard → Webhooks
STRIPE_WEBHOOK_SECRET=whsec_xxx
# Checkout: сумма и KZT берутся из таблицы token_packages (динамический price_data в Stripe).
# Каталог пакетов: npm run seed:token-packages и /admin/token-packages

# --- Email (секреты только здесь; AppSetting: /admin/notifications — флаги и шаблоны) ---
# SMTP (при EMAIL_PROVIDER=smtp в БД + EMAIL_ENABLED=true)
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=
# SMTP_PASSWORD=
# SMTP_FROM="QazCard AI <noreply@example.com>"
# Resend (EMAIL_PROVIDER=resend)
# RESEND_API_KEY=re_xxx
# SendGrid (EMAIL_PROVIDER=sendgrid)
# SENDGRID_API_KEY=SG.xxx

# Лимит размера JSON-тела для API (байты; по умолчанию 262144 = 256 KiB)
# API_MAX_JSON_BODY_BYTES=262144
# Лимит сырого тела входящих webhooks Stripe/Kie (байты; по умолчанию 1048576)
# API_MAX_WEBHOOK_BODY_BYTES=1048576

# Rate limits (backend; AppSetting `rate_upload_limits` JSON может переопределить, см. lib/rate-upload-settings)
RATE_LIMIT_LOGIN_PER_MINUTE=5
RATE_LIMIT_REGISTRATION_PER_MINUTE=5
RATE_LIMIT_GENERATION_PER_MINUTE=10
RATE_LIMIT_UPLOAD_PER_MINUTE=10
RATE_LIMIT_ADMIN_PER_MINUTE=30

# Карточка товара: классификация по фото (по умолчанию — Kie Gemini 2.5 Flash через каталог AiModel)
# Пусто или kie_gemini → Kie.ai chat (нужен KIE_API_KEY; модель — slug из PRODUCT_CARD_DEFAULT_CLASSIFIER_MODEL_SLUG)
# mock — только явный тест без Kie; openai / gemini — прямые API
PRODUCT_CLASSIFIER_PROVIDER=kie_gemini
# Для Kie: при желании переопределить apiModelId (иначе из карточки gemini-2-5-flash-classifier)
PRODUCT_CLASSIFIER_MODEL=gemini-2.5-flash
# PRODUCT_CLASSIFIER_PROVIDER=mock
# PRODUCT_CLASSIFIER_MODEL=mock
OPENAI_API_KEY=
GEMINI_API_KEY=
# «Фото с концепциями»: опционально AppSetting `defaultProductConceptImageModel` (string slug или { "slug": "…" }) — приоритет над:
DEFAULT_PRODUCT_CONCEPT_IMAGE_MODEL_SLUG=
# «Карточка товара»: AppSetting `defaultMarketplaceCardModel` → слаг ниже (достаточно одного из двух)
DEFAULT_MARKETPLACE_CARD_IMAGE_MODEL_SLUG=
DEFAULT_MARKETPLACE_CARD_MODEL_SLUG=gpt-image-2-image-to-image
DEFAULT_PRODUCT_VIDEO_MODEL_SLUG=seedance-2-0-fast

# Monitoring (опционально: npm i @sentry/nextjs и следуйте README_DEPLOY.md — инициализация вручную)
SENTRY_DSN=
# SENTRY_TRACES_SAMPLE_RATE=0.1
```

## `src/auth.ts`
```ts
import "@/lib/bootstrap-auth-public-url";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import type { UserRole } from "@/generated/prisma/enums";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const emailRaw = credentials?.email;
        const passwordRaw = credentials?.password;
        if (
          typeof emailRaw !== "string" ||
          typeof passwordRaw !== "string" ||
          !emailRaw.trim() ||
          !passwordRaw
        ) {
          return null;
        }

        const { prisma } = await import("@/lib/prisma");
        const { verifyPassword } = await import("@/lib/password");

        const email = emailRaw.toLowerCase().trim();
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;
        if (user.status !== "ACTIVE") return null;

        const valid = await verifyPassword(passwordRaw, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role as UserRole,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        if (token.role) {
          session.user.role = token.role;
        }
      }
      return session;
    },
  },
});

```

## `src/middleware.ts`
```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import type { UserRole } from "@/generated/prisma/enums";
import {
  canAccessAdminPanel,
  isModeratorAllowedAdminPath,
  isStaffMaintenanceRole,
} from "@/lib/permissions";
import {
  pickLoginRedirectParam,
  postAuthLandingPath,
  maybeRedirectImageVideoToModelsCatalog,
} from "@/lib/auth";
import {
  isMaintenanceAllowAdminEnv,
  isMaintenanceModeEnv,
} from "@/lib/maintenance-mode";

function getMiddlewareJwtSecret(): string | null {
  const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  return s?.trim() || null;
}

/**
 * Имя cookie сессии Auth.js зависит от secure-режима (defaultCookies в @auth/core).
 * Без secureCookie: true на HTTPS getToken ищет не тот cookie → token всегда null.
 */
function shouldUseSecureSessionCookie(req: NextRequest): boolean {
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedProto === "https") return true;
  if (req.nextUrl.protocol === "https:") return true;
  const authBase =
    process.env.AUTH_URL?.trim() || process.env.NEXTAUTH_URL?.trim();
  if (authBase?.startsWith("https:")) return true;
  return false;
}

function isAdminDashboardRole(role: unknown): role is UserRole {
  return canAccessAdminPanel(role as UserRole);
}

/**
 * MAINTENANCE_MODE=1 — для обычных пользователей редирект на /maintenance.
 * MAINTENANCE_ALLOW_ADMIN=1 — персонал (MODERATOR/ADMIN/SUPER_ADMIN) видит кабинет и админку как без техработ.
 * Регистрация по-прежнему закрыта у всех.
 */
async function applyMaintenanceGate(
  req: NextRequest,
): Promise<NextResponse | null> {
  if (!isMaintenanceModeEnv()) {
    return null;
  }

  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  if (
    pathname.startsWith("/_next") ||
    /\.(?:ico|png|jpg|jpeg|gif|webp|svg|txt|xml|woff2?)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }
  if (pathname === "/maintenance") {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/webhooks") || pathname === "/api/health") {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const secret = getMiddlewareJwtSecret();
  const secureCookie = shouldUseSecureSessionCookie(req);
  const allowAdmin = isMaintenanceAllowAdminEnv();

  let token: Awaited<ReturnType<typeof getToken>> = null;
  if (secret) {
    token = await getToken({
      req,
      secret,
      secureCookie,
    });
  }

  const isStaff = isStaffMaintenanceRole(token?.role);

  if (pathname === "/register" || pathname === "/auth/register") {
    return NextResponse.redirect(
      new URL("/maintenance?reason=registration", nextUrl.origin),
    );
  }

  if (allowAdmin && token?.sub && isStaff) {
    return null;
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Ведутся технические работы. Сервис временно недоступен." },
      { status: 503 },
    );
  }

  if (!allowAdmin) {
    if (pathname === "/login" || pathname === "/auth/login") {
      return NextResponse.redirect(new URL("/maintenance", nextUrl.origin));
    }
    if (token?.sub && !isStaff) {
      if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
        return NextResponse.redirect(new URL("/maintenance", nextUrl.origin));
      }
    }
    return NextResponse.redirect(new URL("/maintenance", nextUrl.origin));
  }

  if (pathname === "/login" || pathname === "/auth/login") {
    return null;
  }
  if (pathname.startsWith("/admin")) {
    return null;
  }
  if (token?.sub && !isStaff) {
    if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
      return NextResponse.redirect(new URL("/maintenance", nextUrl.origin));
    }
  }

  return NextResponse.redirect(new URL("/maintenance", nextUrl.origin));
}

export async function middleware(req: NextRequest) {
  const gated = await applyMaintenanceGate(req);
  if (gated !== null) {
    return gated;
  }

  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  const isAuthPage =
    pathname === "/login" ||
    pathname === "/auth/login" ||
    pathname === "/register" ||
    pathname === "/auth/register";

  const isDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");

  const secret = getMiddlewareJwtSecret();
  const secureCookie = shouldUseSecureSessionCookie(req);

  if (isAuthPage) {
    if (!secret) {
      return new NextResponse(
        "Server configuration error: set AUTH_SECRET or NEXTAUTH_SECRET in .env (see .env.example).",
        { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } },
      );
    }
    const token = await getToken({
      req,
      secret,
      secureCookie,
    });
    if (token?.sub) {
      const role = token.role as UserRole | undefined;
      const p = pickLoginRedirectParam(
        nextUrl.searchParams.get("next"),
        nextUrl.searchParams.get("callbackUrl"),
      );
      const target = postAuthLandingPath(p, role);
      return NextResponse.redirect(new URL(target, nextUrl.origin));
    }
    return NextResponse.next();
  }

  if (!isDashboard && !isAdminPath) {
    return NextResponse.next();
  }

  if (!secret) {
    return new NextResponse(
      "Server configuration error: set AUTH_SECRET or NEXTAUTH_SECRET in .env (see .env.example).",
      { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  const token = await getToken({
    req,
    secret,
    secureCookie,
  });

  if (!token?.sub) {
    const url = new URL("/login", nextUrl.origin);
    const dest = `${pathname}${nextUrl.search}`;
    url.searchParams.set("next", dest);
    return NextResponse.redirect(url);
  }

  if (isAdminPath && !isAdminDashboardRole(token.role)) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl.origin));
  }

  const role = token.role as UserRole | undefined;
  if (isAdminPath && role === "MODERATOR") {
    if (pathname === "/admin" || !isModeratorAllowedAdminPath(pathname)) {
      return NextResponse.redirect(new URL("/admin/moderation", nextUrl.origin));
    }
  }

  const toCatalog = maybeRedirectImageVideoToModelsCatalog(
    pathname,
    nextUrl.searchParams,
  );
  if (toCatalog != null) {
    const redirectRes = NextResponse.redirect(
      new URL(toCatalog, nextUrl.origin),
    );
    redirectRes.headers.set(
      "Cache-Control",
      "private, no-store, max-age=0, must-revalidate",
    );
    return redirectRes;
  }

  const response = NextResponse.next();
  if (isDashboard || isAdminPath) {
    response.headers.set(
      "Cache-Control",
      "private, no-store, max-age=0, must-revalidate",
    );
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

```

## `src/server/services/generationProcessor.ts`
```ts

import type { Job } from "bullmq";
import { Prisma } from "@/generated/prisma/client";
import type { AiModel, Generation } from "@/generated/prisma/client";
import {
  createMockProviderTaskId,
  getMockOutputUrls,
  isMockKie,
  isMockProviderTaskId,
} from "@/lib/kie-mock";
import {
  explainKieErrorForUser,
  isLikelyKieOverloadMessage,
} from "@/lib/kie-error-hints";
import {
  kieReachableImageUrlsFromInputFiles,
  KIE_REQUIRES_PUBLIC_IMAGE_URLS_RU,
  publicHttpUrlsOnly,
} from "@/lib/generation-input-limits";
import { prisma } from "@/lib/prisma";
import { createApiLog } from "@/server/services/api-log";
import { confirmCredits, refundCredits } from "@/server/services/credits";
import {
  trySendGenerationCompletedEmail,
  trySendGenerationFailedEmail,
} from "@/server/services/notificationsIntegration";
import { mergeHailuo23SettingsWithInputFiles } from "@/server/services/hailuo-settings";
import { mergeSoraStoryboardSettingsWithInputFiles } from "@/server/services/sora-storyboard-settings";
import {
  isVeo31FamilyApiModelId,
  mergeVeo31GenerateImageUrls,
} from "@/server/services/veo31-settings";
import { isWanMarketModel } from "@/server/services/wan-settings";
import {
  buildKieMarketCreateTaskPayload,
  buildKieRequestBodyForLog,
  buildKieVideoRequestBodyForLog,
  buildVeo31VideoMarketBody,
  assertKieModelIdSet,
  generateImage,
  generateVideo,
  getDefaultRecordInfoPath,
  getKieGenerateRequestUrl,
  getKieVideoGenerateRequestUrl,
  getTaskStatus,
  redactKieLogPayload,
  trimKieModelEndpoint,
  type KieImageGenerateInput,
  type KieVideoGenerateInput,
} from "@/server/services/provider/kie";
import {
  compositeProductCardMarketplaceOverlayOnImage,
  shouldApplyProductCardMarketplaceOverlay,
  type OverlayObjectLayoutMetaV1,
  type OverlayObjectLayoutMetaV2,
} from "@/server/services/marketplaceCardImageComposite";
import {
  StorageError,
  deleteFile,
  fetchUrlToBuffer,
  isStorageConfigured,
  uploadFile,
  uploadFromUrl,
} from "@/server/services/storage";

const INLINE_WALL_ERROR = "GENERATION_INLINE_WALL";

const TERMINAL = new Set<string>([
  "COMPLETED",
  "FAILED",
  "REFUNDED",
  "CANCELLED",
  "BLOCKED",
]);

function getPollConfig() {
  /** По умолчанию ~6м40с (199×2 c). Маркетплейс-карточки с референсами у Kie часто >4 мин — при таймауте задайте GENERATION_POLL_MAX_ATTEMPTS выше. */
  const max = Number.parseInt(process.env.GENERATION_POLL_MAX_ATTEMPTS ?? "200", 10) || 200;
  const intervalMs =
    Number.parseInt(process.env.GENERATION_POLL_INTERVAL_MS ?? "2000", 10) || 2000;
  const maxWallMs = Number.parseInt(
    process.env.GENERATION_POLL_MAX_WALL_MS ?? "0",
    10,
  );
  return {
    maxAttempts: max,
    intervalMs,
    maxWallMs: maxWallMs > 0 ? maxWallMs : 0,
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseInputFilesList(raw: Prisma.JsonValue | null | undefined): string[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

function asMeta(m: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  if (m && typeof m === "object" && !Array.isArray(m)) {
    return m as Record<string, unknown>;
  }
  return {};
}

function isSettingsRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function hasResultFiles(output: Prisma.JsonValue | null | undefined): boolean {
  if (output == null) return false;
  if (Array.isArray(output)) {
    return output.length > 0;
  }
  return false;
}

function urlsToOutputJson(
  urls: string[],
  type: "IMAGE" | "VIDEO",
): Prisma.InputJsonValue {
  const kind = type === "IMAGE" ? "image" : "video";
  return urls.map((url) => ({
    url,
    kind,
    storageKey: null,
    providerUrl: url,
  })) as Prisma.InputJsonValue;
}

function guessExtFromUrl(sourceUrl: string, mediaKind: "image" | "video"): string {
  try {
    const path = new URL(sourceUrl).pathname;
    const m = path.match(/\.([a-z0-9]+)$/i);
    if (m) return m[1].toLowerCase();
  } catch {
    // ignore
  }
  return mediaKind === "video" ? "mp4" : "png";
}

function outputObjectKey(
  userId: string,
  generationId: string,
  index: number,
  sourceUrl: string,
  mediaKind: "image" | "video",
): string {
  const ext = guessExtFromUrl(sourceUrl, mediaKind);
  return `generations/${userId}/${generationId}/out-${index}.${ext}`;
}

function shouldRetryProviderKie(
  result: { httpStatus: number; errorMessage?: string },
): boolean {
  const s = result.httpStatus;
  if (s === 0) return true;
  if (s === 502 || s === 503 || s === 429) return true;
  return false;
}

/** Для админ-теста и других сценариев с тем же телом, что у очереди. */
export function buildImageKieInput(
  gen: Generation,
  model: AiModel,
): KieImageGenerateInput {
  const modelId = assertKieModelIdSet(model.apiModelId);
  const ep = trimKieModelEndpoint(model.endpoint);
  const meta = asMeta(gen.metadata);
  const httpUrls = publicHttpUrlsOnly(parseInputFilesList(gen.inputFiles));
  const hasPayloadMapping =
    model.payloadMapping != null &&
    typeof model.payloadMapping === "object" &&
    !Array.isArray(model.payloadMapping);
  const useGrokImagineMarket = modelId.toLowerCase().startsWith("grok-imagine/");
  if (hasPayloadMapping || useGrokImagineMarket) {
    const settings = isSettingsRecord(meta.settings) ? meta.settings : {};
    const marketCreateBody = buildKieMarketCreateTaskPayload(
      gen.prompt,
      model,
      settings,
    );
    return {
      apiModelId: modelId,
      endpoint: ep,
      marketCreateBody,
      prompt: gen.prompt,
    };
  }
  return {
    apiModelId: modelId,
    endpoint: ep,
    prompt: gen.prompt,
    negativePrompt: model.supportsNegativePrompt ? gen.negativePrompt : null,
    aspectRatio: typeof meta.aspectRatio === "string" ? meta.aspectRatio : null,
    resolution: typeof meta.resolution === "string" ? meta.resolution : null,
    seed:
      model.supportsSeed && typeof meta.seed === "number"
        ? Math.floor(meta.seed)
        : null,
    inputFileUrls: model.supportsImageInput && httpUrls.length > 0 ? httpUrls : undefined,
  };
}

export function buildVideoKieInput(
  gen: Generation,
  model: AiModel,
): KieVideoGenerateInput {
  const modelId = assertKieModelIdSet(model.apiModelId);
  const ep = trimKieModelEndpoint(model.endpoint);
  const meta = asMeta(gen.metadata);
  const httpUrls = publicHttpUrlsOnly(parseInputFilesList(gen.inputFiles));
  const wantsFiles =
    (model.supportsImageInput || model.supportsVideoInput) && httpUrls.length > 0;

  const hasPayloadMapping =
    model.payloadMapping != null &&
    typeof model.payloadMapping === "object" &&
    !Array.isArray(model.payloadMapping);
  /** Kling 3.0 и Wan 2.7 — через POST .../jobs/createTask; иначе без payloadMapping ушли бы на legacy /video/generate. */
  const useMarketCreateTask =
    modelId === "kling-3.0/motion-control" ||
    modelId.toLowerCase() === "kling-3.0" ||
    modelId.toLowerCase() === "kling-3.0/video" ||
    modelId.toLowerCase().startsWith("kling-2.6/") ||
  /** Kie Market Wan 2.x (createTask). */
    isWanMarketModel(modelId) ||
    modelId.toLowerCase() === "bytedance/seedance-2" ||
    modelId.toLowerCase() === "bytedance/seedance-2-fast" ||
    modelId.toLowerCase() === "bytedance/seedance-1.5-pro" ||
    modelId.toLowerCase().startsWith("happyhorse/") ||
    modelId.toLowerCase().startsWith("grok-imagine/") ||
    modelId.toLowerCase().startsWith("hailuo/2-3-image-to-video-") ||
    modelId === "sora-2-pro-storyboard" ||
    isVeo31FamilyApiModelId(modelId) ||
    hasPayloadMapping;

  if (useMarketCreateTask) {
    const rawSettings = isSettingsRecord(meta.settings) ? meta.settings : {};
    const inputUrls = publicHttpUrlsOnly(parseInputFilesList(gen.inputFiles));
    let merged = mergeHailuo23SettingsWithInputFiles(
      modelId,
      rawSettings,
      inputUrls,
    );
    merged = mergeSoraStoryboardSettingsWithInputFiles(
      modelId,
      merged,
      inputUrls,
    );
    merged = mergeVeo31GenerateImageUrls(modelId, merged, inputUrls);

    if (isVeo31FamilyApiModelId(modelId)) {
      if (modelId === "veo/get-1080p-video") {
        const tid = String(merged.sourceTaskId ?? "").trim();
        return {
          apiModelId: modelId,
          endpoint: ep,
          veoGet1080pTaskId: tid,
          prompt: gen.prompt,
        };
      }
      const veoBody = buildVeo31VideoMarketBody(modelId, gen.prompt, merged);
      if (veoBody) {
        return {
          apiModelId: modelId,
          endpoint: ep,
          marketCreateBody: veoBody,
        };
      }
    }

    const marketCreateBody = buildKieMarketCreateTaskPayload(
      gen.prompt,
      model,
      merged,
    );
    return {
      apiModelId: modelId,
      endpoint: ep,
      marketCreateBody,
    };
  }

  return {
    apiModelId: modelId,
    endpoint: ep,
    prompt: gen.prompt,
    negativePrompt: model.supportsNegativePrompt ? gen.negativePrompt : null,
    aspectRatio: typeof meta.aspectRatio === "string" ? meta.aspectRatio : null,
    resolution: typeof meta.resolution === "string" ? meta.resolution : null,
    seed:
      model.supportsSeed && typeof meta.seed === "number"
        ? Math.floor(meta.seed)
        : null,
    durationSec:
      typeof meta.durationSec === "number" ? Math.floor(meta.durationSec) : null,
    inputFileUrls: wantsFiles ? httpUrls : undefined,
  };
}

export async function markFailed(
  genId: string,
  errorMessage: string,
): Promise<void> {
  const existing = await prisma.generation.findUnique({
    where: { id: genId },
    select: { status: true },
  });
  if (!existing || TERMINAL.has(existing.status)) {
    return;
  }
  try {
    await refundCredits(genId, "Возврат: ошибка провайдера (worker)");
  } catch {
    // ignore
  }
  await prisma.generation.update({
    where: { id: genId },
    data: {
      status: "FAILED",
      errorMessage: errorMessage.slice(0, 8000),
      completedAt: new Date(),
    },
  });
  void trySendGenerationFailedEmail(genId);
}

/** После исчерпания ретраев Bull — если генерация ещё не в финальном состоянии. */
export async function markGenerationExhausted(
  generationId: string,
  lastError: string,
): Promise<void> {
  const g = await prisma.generation.findUnique({ where: { id: generationId } });
  if (!g) return;
  if (TERMINAL.has(g.status)) return;
  await markFailed(
    generationId,
    `Job Bull исчерпан: ${lastError.slice(0, 4000)}`,
  );
}

function getInlineMaxWallMs(): number {
  const raw = process.env.GENERATION_INLINE_MAX_MS?.trim();
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Один проход обработки без очереди (QUEUE_MODE=inline). Та же бизнес-логика, что у воркера (`processGenerationJob`).
 * Публичное имя для API; реализация — `processVideoGenerationInline`.
 */
export async function processGeneration(generationId: string): Promise<void> {
  return processVideoGenerationInline(generationId);
}

/**
 * Локальная разработка (QUEUE_MODE=inline): полный цикл без Bull/Redis.
 * HTTP-таймауты к Kie — KIE_FETCH_TIMEOUT_MS; верхняя граница wall-clock — GENERATION_INLINE_MAX_MS (если > 0).
 */
export async function processVideoGenerationInline(generationId: string): Promise<void> {
  const maxMs = getInlineMaxWallMs();
  const run = () => processGenerationJob(generationId, null);
  try {
    if (maxMs > 0) {
      await Promise.race([
        run(),
        new Promise<never>((_, rej) => {
          setTimeout(
            () =>
              rej(
                new Error(INLINE_WALL_ERROR),
              ),
            maxMs,
          );
        }),
      ]);
    } else {
      await run();
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === INLINE_WALL_ERROR) {
      await markFailed(
        generationId,
        "Превышено время ожидания (GENERATION_INLINE_MAX_MS, inline-режим).",
      );
      return;
    }
    const g = await prisma.generation.findUnique({ where: { id: generationId } });
    if (g && !TERMINAL.has(g.status)) {
      await markFailed(
        generationId,
        msg.slice(0, 4_000) || "Ошибка обработки (inline)",
      );
    }
  }
}

/**
 * Один job = одна попытка цепочки. Ретраи — уровень Bull. Не дублируйте CAPTURE/REFUND.
 * `job` не используется; опционален для inline-режима без Bull.
 */
export async function processGenerationJob(
  generationId: string,
  _job?: Job<{
    generationId: string;
  }> | null,
): Promise<void> {
  void _job;
  const row = await prisma.generation.findUnique({
    where: { id: generationId },
    include: { model: true },
  });
  if (!row) {
    return;
  }
  if (TERMINAL.has(row.status)) {
    return;
  }

  const { model, ...gen } = row;

  const pollCfg = getPollConfig();
  const statusPath = getDefaultRecordInfoPath(model.type);

  if (gen.status === "PROCESSING" && gen.providerTaskId && !hasResultFiles(gen.outputFiles)) {
    if (isMockKie() && isMockProviderTaskId(gen.providerTaskId)) {
      await completeWithOutput(
        gen,
        model.type,
        getMockOutputUrls(model.type),
      );
      return;
    }
    await runPollToCompletion(
      gen,
      model,
      statusPath,
      pollCfg.maxAttempts,
      pollCfg.intervalMs,
      pollCfg.maxWallMs,
    );
    return;
  }

  if (gen.status !== "QUEUED" && gen.status !== "CREATED") {
    return;
  }

  if (!isMockKie()) {
    if (!process.env.KIE_BASE_URL?.trim() || !process.env.KIE_API_KEY?.trim()) {
      throw new Error("KIE not configured (retry when env ready)");
    }
  }

  if (isMockKie()) {
    const taskId = createMockProviderTaskId();
    await prisma.generation.update({
      where: { id: gen.id },
      data: { status: "PROCESSING", providerTaskId: taskId },
    });
    const mockNote = "MOCK_KIE: запрос к Kie.ai не отправлялся";
    if (model.type === "IMAGE") {
      const kieIn = buildImageKieInput(gen, model);
      const url = getKieGenerateRequestUrl(kieIn);
      await createApiLog({
        generationId: gen.id,
        provider: "KIE_AI",
        endpoint: url.slice(0, 2048),
        requestPayload: {
          mock: true,
          note: mockNote,
          requestUrl: url,
          body: redactKieLogPayload(buildKieRequestBodyForLog(kieIn)),
        },
        responsePayload: {
          mock: true,
          mockResponse: true,
          providerTaskId: taskId,
          message: "MOCK_KIE: эмуляция успешного создания задачи",
        },
        statusCode: 200,
        errorMessage: null,
      });
      await completeWithOutput(gen, "IMAGE", getMockOutputUrls("IMAGE"));
      return;
    }
    const kieIn = buildVideoKieInput(gen, model);
    const url = getKieVideoGenerateRequestUrl(kieIn);
    await createApiLog({
      generationId: gen.id,
      provider: "KIE_AI",
      endpoint: url.slice(0, 2048),
      requestPayload: {
        mock: true,
        note: mockNote,
        requestUrl: url,
        body: redactKieLogPayload(buildKieVideoRequestBodyForLog(kieIn)),
      },
      responsePayload: {
        mock: true,
        mockResponse: true,
        providerTaskId: taskId,
        message: "MOCK_KIE: эмуляция успешного создания задачи",
      },
      statusCode: 200,
      errorMessage: null,
    });
    await completeWithOutput(gen, "VIDEO", getMockOutputUrls("VIDEO"));
    return;
  }

  await prisma.generation.update({
    where: { id: gen.id },
    data: { status: "PROCESSING" },
  });

  if (model.type === "IMAGE") {
    if (!isMockKie() && model.provider === "KIE_AI" && model.supportsImageInput) {
      const srcUrls = parseInputFilesList(gen.inputFiles);
      if (srcUrls.length > 0 && kieReachableImageUrlsFromInputFiles(srcUrls).length === 0) {
        await markFailed(gen.id, KIE_REQUIRES_PUBLIC_IMAGE_URLS_RU);
        return;
      }
    }
    const kieIn = buildImageKieInput(gen, model);
    const url = getKieGenerateRequestUrl(kieIn);
    const reqLog = { requestUrl: url, body: redactKieLogPayload(buildKieRequestBodyForLog(kieIn)) };
    const result = await generateImage(kieIn);
    await createApiLog({
      generationId: gen.id,
      provider: "KIE_AI",
      endpoint: url.slice(0, 2048),
      requestPayload: reqLog,
      responsePayload: redactKieLogPayload(result.rawResponse),
      statusCode: result.httpStatus,
      errorMessage: result.success ? null : result.errorMessage ?? "Ошибка провайдера",
    });
    if (!result.success) {
      if (shouldRetryProviderKie(result)) {
        throw new Error(result.errorMessage ?? "Kie error, retry");
      }
      await markFailed(
        gen.id,
        explainKieErrorForUser(
          result.errorMessage,
          "Ошибка Kie (image)",
        ),
      );
      return;
    }
    const imageUrls = result.imageUrls ?? [];
    if (imageUrls.length > 0) {
      await completeWithOutput(gen, "IMAGE", imageUrls);
      return;
    }
    if (result.taskId) {
      await prisma.generation.update({
        where: { id: gen.id },
        data: { providerTaskId: result.taskId },
      });
      const updated = await prisma.generation.findUnique({ where: { id: gen.id } });
      if (updated) {
        await runPollToCompletion(
          updated,
          model,
          statusPath,
          pollCfg.maxAttempts,
          pollCfg.intervalMs,
          pollCfg.maxWallMs,
        );
      }
    } else {
      await markFailed(gen.id, "Kie: нет taskId и URL");
    }
    return;
  }

  if (model.type === "VIDEO") {
    if (!isMockKie() && model.provider === "KIE_AI") {
      const srcUrls = parseInputFilesList(gen.inputFiles);
      if (srcUrls.length > 0 && kieReachableImageUrlsFromInputFiles(srcUrls).length === 0) {
        await markFailed(gen.id, KIE_REQUIRES_PUBLIC_IMAGE_URLS_RU);
        return;
      }
    }
    const kieIn = buildVideoKieInput(gen, model);
    const url = getKieVideoGenerateRequestUrl(kieIn);
    const reqLog = {
      requestUrl: url,
      body: redactKieLogPayload(buildKieVideoRequestBodyForLog(kieIn)),
    };
    const result = await generateVideo(kieIn);
    await createApiLog({
      generationId: gen.id,
      provider: "KIE_AI",
      endpoint: url.slice(0, 2048),
      requestPayload: reqLog,
      responsePayload: redactKieLogPayload(result.rawResponse),
      statusCode: result.httpStatus,
      errorMessage: result.success ? null : result.errorMessage ?? "Ошибка провайдера",
    });
    if (!result.success) {
      if (shouldRetryProviderKie(result)) {
        throw new Error(result.errorMessage ?? "Kie error, retry");
      }
      await markFailed(
        gen.id,
        explainKieErrorForUser(
          result.errorMessage,
          "Ошибка Kie (video)",
        ),
      );
      return;
    }
    const videoUrls = result.videoUrls?.length
      ? result.videoUrls
      : result.imageUrls && /\.(mp4|webm|mov)/i.test(result.imageUrls[0] ?? "")
        ? result.imageUrls
        : [];
    if (videoUrls.length > 0) {
      await completeWithOutput(gen, "VIDEO", videoUrls);
      return;
    }
    if (result.imageUrls?.length) {
      await completeWithOutput(gen, "VIDEO", result.imageUrls);
      return;
    }
    if (result.taskId) {
      await prisma.generation.update({
        where: { id: gen.id },
        data: { providerTaskId: result.taskId },
      });
      const updated = await prisma.generation.findUnique({ where: { id: gen.id } });
      if (updated) {
        await runPollToCompletion(
          updated,
          model,
          statusPath,
          pollCfg.maxAttempts,
          pollCfg.intervalMs,
          pollCfg.maxWallMs,
        );
      }
    } else {
      await markFailed(gen.id, "Kie: нет taskId и URL видео");
    }
  }
}

function mergeGenerationMetadataOverlayLayout(
  current: Prisma.JsonValue | null | undefined,
  overlayLayout: OverlayObjectLayoutMetaV1 | OverlayObjectLayoutMetaV2,
): Prisma.InputJsonValue {
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? { ...(current as Record<string, unknown>) }
      : {};
  return { ...base, overlayObjectLayout: overlayLayout } as Prisma.InputJsonValue;
}

/**
 * Сохранение результата (S3 при наличии), COMPLETED, confirmCredits. Используется worker и webhook Kie.
 */
export async function completeWithOutput(
  gen: Generation,
  type: "IMAGE" | "VIDEO",
  providerUrls: string[],
): Promise<void> {
  const latest = await prisma.generation.findUnique({
    where: { id: gen.id },
    select: { status: true },
  });
  if (!latest || TERMINAL.has(latest.status)) {
    return;
  }
  const requireS3Mirror =
    process.env.NODE_ENV === "production" ||
    process.env.GENERATION_OUTPUT_S3_REQUIRED?.trim() === "1";
  if (requireS3Mirror && !isStorageConfigured()) {
    await markFailed(
      gen.id,
      "Результаты Kie должны сохраняться в S3: UPLOAD_STORAGE=s3 и переменные S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_PUBLIC_URL, ключи доступа. Пока хранилище не настроено, завершение без зеркала отключено.",
    );
    return;
  }
  const mediaKind = type === "IMAGE" ? "image" : "video";
  try {
    if (!isStorageConfigured()) {
      await prisma.generation.update({
        where: { id: gen.id },
        data: {
          status: "COMPLETED",
          outputFiles: urlsToOutputJson(providerUrls, type),
          completedAt: new Date(),
        },
      });
    } else {
      const keysRolled: string[] = [];
      type FileRow = {
        fileName: string;
        fileType: string;
        mimeType: string;
        size: number;
        storageKey: string;
        url: string;
        metadata: Prisma.InputJsonValue;
      };
      const outputItems: Record<string, unknown>[] = [];
      const fileRows: FileRow[] = [];
      let overlayObjectLayoutPatch: OverlayObjectLayoutMetaV1 | OverlayObjectLayoutMetaV2 | undefined;
      try {
        for (let i = 0; i < providerUrls.length; i++) {
          const src = providerUrls[i];
          let key = outputObjectKey(gen.userId, gen.id, i, src, mediaKind);
          const applyMarketplaceOverlay =
            mediaKind === "image" &&
            shouldApplyProductCardMarketplaceOverlay(gen, type, i);
          let up: Awaited<ReturnType<typeof uploadFromUrl>>;
          if (applyMarketplaceOverlay) {
            const downloaded = await fetchUrlToBuffer(src);
            const composed = await compositeProductCardMarketplaceOverlayOnImage(
              downloaded.buffer,
              gen,
            );
            if (composed.objectLayoutForMetadata != null) {
              overlayObjectLayoutPatch = composed.objectLayoutForMetadata;
            }
            if (composed.contentType?.trim().startsWith("image/jpeg")) {
              key = `generations/${gen.userId}/${gen.id}/out-${i}.jpg`;
            }
            const bytesToUpload =
              composed.buffer.length > 0 && composed.contentType?.trim()
                ? composed.buffer
                : downloaded.buffer;
            const uploadMime = composed.contentType?.trim() || downloaded.contentType;
            const fileUp = await uploadFile(bytesToUpload, key, uploadMime);
            up = {
              ...fileUp,
              contentType: uploadMime,
              sourceUrl: src,
            };
          } else {
            up = await uploadFromUrl(src, key);
          }
          keysRolled.push(up.key);
          outputItems.push({
            url: up.url,
            storageKey: up.key,
            kind: mediaKind,
            providerUrl: src,
            size: up.size,
            contentType: up.contentType,
          });
          const ext =
            applyMarketplaceOverlay && up.contentType.startsWith("image/jpeg")
              ? "jpg"
              : guessExtFromUrl(src, mediaKind);
          fileRows.push({
            fileName: `out-${i}.${ext}`.slice(0, 512),
            fileType: mediaKind.slice(0, 64),
            mimeType: up.contentType.slice(0, 128),
            size: up.size,
            storageKey: up.key.slice(0, 1024),
            url: up.url.slice(0, 2048),
            metadata: {
              providerUrl: src,
              source: "generation_output",
            } as Prisma.InputJsonValue,
          });
        }

        await prisma.$transaction(async (tx) => {
          for (const f of fileRows) {
            await tx.uploadedFile.create({
              data: {
                userId: gen.userId,
                generationId: gen.id,
                fileName: f.fileName,
                fileType: f.fileType,
                mimeType: f.mimeType,
                size: f.size,
                storageKey: f.storageKey,
                url: f.url,
                metadata: f.metadata,
              },
            });
          }
          await tx.generation.update({
            where: { id: gen.id },
            data: {
              status: "COMPLETED",
              outputFiles: outputItems as unknown as Prisma.InputJsonValue,
              completedAt: new Date(),
              ...(overlayObjectLayoutPatch != null
                ? {
                    metadata: mergeGenerationMetadataOverlayLayout(
                      gen.metadata,
                      overlayObjectLayoutPatch,
                    ),
                  }
                : {}),
            },
          });
        });
      } catch (e) {
        for (const k of keysRolled) {
          await deleteFile(k).catch(() => {});
        }
        throw e;
      }
    }

    try {
      await confirmCredits(gen.id);
    } catch {
      // идемпотентность
    }
    void trySendGenerationCompletedEmail(gen.id);
  } catch (e) {
    const msg =
      e instanceof StorageError
        ? `Хранилище: ${e.message}`
        : e instanceof Error
          ? e.message
          : "Ошибка сохранения результата";
    await markFailed(gen.id, msg.slice(0, 8000));
  }
}

function isTerminalPollFailure(poll: {
  success: boolean;
  httpStatus: number;
  errorMessage?: string;
}): boolean {
  if (poll.success) return false;
  if (poll.httpStatus === 0) return false;
  if (poll.httpStatus >= 400 && poll.httpStatus < 500) return true;
  if (poll.errorMessage) {
    if (poll.httpStatus >= 200 && poll.httpStatus < 300) {
      return true;
    }
  }
  return false;
}

async function runPollToCompletion(
  gen: Generation,
  model: AiModel,
  defaultRecordInfoPath: string,
  maxAttempts: number,
  intervalMs: number,
  maxWallMs: number,
): Promise<void> {
  const taskId = gen.providerTaskId;
  if (!taskId) {
    await markFailed(gen.id, "Нет taskId для polling");
    return;
  }
  const startWall = maxWallMs > 0 ? Date.now() : 0;
  let lastRaw: unknown;
  let lastHttp = 0;
  let lastErr: string | null = null;
  for (let i = 0; i < maxAttempts; i++) {
    if (maxWallMs > 0 && Date.now() - startWall > maxWallMs) {
      await createApiLog({
        generationId: gen.id,
        provider: "KIE_AI",
        endpoint: "poll/wall_timeout",
        requestPayload: { taskId, maxWallMs, attempts: i },
        responsePayload: { stopped: true },
        statusCode: null,
        errorMessage: "Превышен лимит времени polling (GENERATION_POLL_MAX_WALL_MS)",
      });
      await markFailed(
        gen.id,
        "Тайм-аут ожидания (макс. длительность polling)",
      );
      return;
    }
    if (i > 0) {
      await sleep(intervalMs);
    }
    const poll = await getTaskStatus(
      taskId,
      model.statusEndpoint ?? null,
      defaultRecordInfoPath,
    );
    lastRaw = poll.rawResponse;
    lastHttp = poll.httpStatus;
    lastErr = poll.errorMessage ?? null;
    if (!poll.success) {
      if (isTerminalPollFailure(poll)) {
        await createApiLog({
          generationId: gen.id,
          provider: "KIE_AI",
          endpoint: "poll/terminal_error",
          requestPayload: { taskId, attempt: i + 1 },
          responsePayload: redactKieLogPayload(poll.rawResponse),
          statusCode: poll.httpStatus,
          errorMessage: poll.errorMessage ?? "Ошибка провайдера (poll)",
        });
        await markFailed(
          gen.id,
          explainKieErrorForUser(
            poll.errorMessage,
            "Ошибка провайдера (poll)",
          ),
        );
        return;
      }
      continue;
    }
    const img = poll.imageUrls ?? [];
    const vid = poll.videoUrls ?? [];
    if (model.type === "IMAGE" && img.length > 0) {
      await createApiLog({
        generationId: gen.id,
        provider: "KIE_AI",
        endpoint: "poll/complete",
        requestPayload: { taskId, attempt: i + 1 },
        responsePayload: redactKieLogPayload(poll.rawResponse),
        statusCode: poll.httpStatus,
        errorMessage: null,
      });
      await completeWithOutput(gen, "IMAGE", img);
      return;
    }
    if (model.type === "VIDEO" && (vid.length > 0 || img.length > 0)) {
      const urls = vid.length > 0 ? vid : img;
      await createApiLog({
        generationId: gen.id,
        provider: "KIE_AI",
        endpoint: "poll/complete",
        requestPayload: { taskId, attempt: i + 1 },
        responsePayload: redactKieLogPayload(poll.rawResponse),
        statusCode: poll.httpStatus,
        errorMessage: null,
      });
      await completeWithOutput(gen, "VIDEO", urls);
      return;
    }
  }
  await createApiLog({
    generationId: gen.id,
    provider: "KIE_AI",
    endpoint: "poll/timeout",
    requestPayload: { taskId, maxAttempts },
    responsePayload: redactKieLogPayload(lastRaw),
    statusCode: lastHttp,
    errorMessage: lastErr ?? "Polling: результат не готов",
  });
  const overloadHttp = lastHttp === 502 || lastHttp === 503 || lastHttp === 429;
  await markFailed(
    gen.id,
    overloadHttp || (lastErr && isLikelyKieOverloadMessage(lastErr))
      ? explainKieErrorForUser(
          lastErr,
          "Результат не получен за время polling: провайдер долго отвечал ошибкой перегрузки или задача не успела завершиться. Повторите позже или увеличьте GENERATION_POLL_MAX_ATTEMPTS / интервал в .env.",
        )
      : "Тайм-аут ожидания готового файла (polling). Kie.ai иногда отдаёт картинку дольше нескольких минут. В `.env` увеличьте `GENERATION_POLL_MAX_ATTEMPTS` (например 280) и перезапустите воркер; при необходимости уменьшите `GENERATION_POLL_INTERVAL_MS` только если нет лимитов API. Убедитесь, что `GENERATION_POLL_MAX_WALL_MS` = 0 или достаточно велик.",
  );
}

```

## `src/server/services/productCardGeneration.ts`
```ts
import { randomUUID } from "crypto";
import type { AiModel } from "@/generated/prisma/client";
import {
  buildConceptPhotoPrompt,
  buildMarketplaceCardPrompt,
  buildProductVideoPrompt,
} from "@/config/product-card-prompts";
import {
  getProductCategoryById,
  MARKETPLACE_CARD_STYLES,
  PRODUCT_CATEGORY_IDS,
  PRODUCT_VIDEO_MOTION_STYLES,
  type MarketplaceCardStyle,
  type ProductCategoryId,
} from "@/config/product-card-categories";
import {
  getProductCardLayoutKey,
  getProductCardTemplatePreset,
  getProductCardTypographyPreset,
  variantTemplatePresetAt,
  variantTypographyPresetAt,
} from "@/config/product-card-overlay-presets";
import { getSchemaFields, defaultsFromSchema } from "@/lib/generation-form-settings-schema";
import {
  modelHasSettingsSchema,
  validateAndNormalizeModelSettings,
} from "@/server/services/model-settings";
import { assertUserOwnsFileUrl, getOwnedProjectOrNull } from "@/server/services/productCardProjectAccess";
import { normalizeProductSourceImages } from "@/server/services/productCardProjects";
import {
  resolveDefaultMarketplaceCardModel,
  resolveDefaultProductConceptImageModel,
  resolveDefaultProductVideoModel,
} from "@/server/services/productCardModelResolver";
import {
  resolveMarketplaceCardSource,
  type MarketplaceImageSource,
  type ProductVideoImageSourceType,
  resolveProductVideoImageSource,
} from "@/server/services/productCardResolveSource";
import {
  buildImageModelInput,
  type ProductCardGenMeta,
  queueProductCardImage,
  queueProductCardVideo,
} from "@/server/services/productCardQueueGenerations";
import {
  buildMarketplaceCardOverlaySpec,
  renderMarketplaceCardOverlaySvg,
} from "@/server/services/productCardOverlayRenderer";
import { generateProductSellingPoints } from "@/server/services/productCardSellingPoints";
import {
  appendConceptGenerationEntry,
  appendMarketplaceCardGeneration,
  appendVideoGenerationEntry,
} from "@/server/services/productCardUpdateMeta";
import {
  calculateProductCardConceptImageCredits,
  calculateProductCardMarketplaceCardCredits,
  calculateProductCardVideoCredits,
  resolveMarketplaceVariantBundleTotals,
} from "@/server/services/productCardPricing";
import {
  getProductCardSettings,
  PRODUCT_CARD_MODEL_NOT_CONFIGURED_MESSAGE,
} from "@/server/services/productCardSettings";
import {
  resolveMarketplaceCardSize,
  type MarketplaceCardResolvedSize,
} from "@/server/services/marketplaceCardSizing";
import { getFullModerationConfig } from "@/server/services/moderation";

function clampMarketplacePrompt(prompt: string, maxLen: number): string {
  if (prompt.length <= maxLen) return prompt;
  const cut = prompt.slice(0, Math.max(0, maxLen - 1)).trimEnd();
  return `${cut}…`;
}

export function isValidProductCategoryId(id: string): id is ProductCategoryId {
  return (PRODUCT_CATEGORY_IDS as readonly string[]).includes(id);
}

export function isConceptInCategory(
  categoryId: ProductCategoryId,
  conceptId: string,
): boolean {
  const c = getProductCategoryById(categoryId);
  return Boolean(c?.concepts.some((x) => x.id === conceptId));
}

export type GenerateConceptPhotoOk = {
  ok: true;
  generationId: string;
  status: string;
  costCredits: number;
};

export type GenerateConceptPhotoErr = {
  ok: false;
  error: string;
  status: number;
  reason?: string;
};

export type GenerateConceptPhotoResult = GenerateConceptPhotoOk | GenerateConceptPhotoErr;

/**
 * Генерация «Фото с концепциями» через общий pipeline (queue + processGeneration).
 */
export async function generateConceptPhotoForProductCard(
  userId: string,
  projectId: string,
  input: { categoryId: string; conceptId: string; userPrompt: string; size?: string },
): Promise<GenerateConceptPhotoResult> {
  const project = await getOwnedProjectOrNull(userId, projectId);
  if (!project) {
    return { ok: false, error: "Проект не найден", status: 404 };
  }

  const sourceImages = normalizeProductSourceImages(project);
  const sourceUrl = sourceImages[0]?.url ?? project.sourceImageUrl?.trim();
  if (!sourceUrl) {
    return { ok: false, error: "Загрузите исходное фото", status: 400 };
  }
  if (!(await assertUserOwnsFileUrl(userId, sourceUrl))) {
    return { ok: false, error: "Нет доступа к файлу", status: 403 };
  }
  for (const img of sourceImages.slice(1)) {
    if (!(await assertUserOwnsFileUrl(userId, img.url))) {
      return { ok: false, error: "Нет доступа к одному из исходных фото", status: 403 };
    }
  }
  const sourceImageUrls = sourceImages.map((img) => img.url);

  if (!isValidProductCategoryId(input.categoryId)) {
    return { ok: false, error: "Некорректная категория", status: 400 };
  }
  if (!isConceptInCategory(input.categoryId, input.conceptId)) {
    return {
      ok: false,
      error: "Концепция не относится к выбранной категории",
      status: 400,
    };
  }

  const model = await resolveDefaultProductConceptImageModel();
  if (!model) {
    return {
      ok: false,
      error: PRODUCT_CARD_MODEL_NOT_CONFIGURED_MESSAGE,
      status: 400,
    };
  }

  const finalPrompt = buildConceptPhotoPrompt({
    categoryId: input.categoryId,
    conceptId: input.conceptId,
    userPrompt: input.userPrompt,
  });

  const productMeta: ProductCardGenMeta = {
    flow: "product_card",
    productCard: {
      projectId: project.id,
      tab: "concept_photo",
      category: input.categoryId,
      conceptId: input.conceptId,
      sourceType: "original",
    },
  };

  const metadataRoot: Record<string, unknown> = {
    flow: "product_card",
    projectId: project.id,
    tab: "concept_photo",
    categoryId: input.categoryId,
    conceptId: input.conceptId,
    userPrompt: input.userPrompt,
    size: input.size ?? "1x1",
    sourceImageUrl: sourceUrl,
    sourceImages,
    sourceImagesCount: sourceImages.length,
    modelSlug: model.slug,
    pricingScope: "PRODUCT_CARD",
    productCardModelType: model.productCardModelType,
  };

  let conceptPricing;
  try {
    const built = buildImageModelInput(
      { settingsSchema: model.settingsSchema, supportsImageInput: model.supportsImageInput },
      sourceImageUrls.length > 0 ? sourceImageUrls : sourceUrl,
    );
    conceptPricing = await calculateProductCardConceptImageCredits(
      model,
      { ...built.normalizedSettings, size: input.size ?? "1x1" },
    );
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Некорректные настройки модели",
      status: 400,
    };
  }

  const result = await queueProductCardImage(
    userId,
    model,
    finalPrompt,
    sourceImageUrls.length > 0 ? sourceImageUrls : sourceUrl,
    productMeta,
    null,
    metadataRoot,
    null,
    conceptPricing,
  );

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      status: result.status,
      ...(result.reason ? { reason: result.reason } : {}),
    };
  }

  const costCredits = result.costCredits ?? 0;

  await appendConceptGenerationEntry(project.id, {
    generationId: result.generationId,
    categoryId: input.categoryId,
    conceptId: input.conceptId,
  });

  return {
    ok: true,
    generationId: result.generationId,
    status: result.status,
    costCredits,
  };
}

const MARKETPLACE_STYLE_IDS = new Set<string>(
  MARKETPLACE_CARD_STYLES.map((s) => s.id),
);

export function isValidMarketplaceCardStyle(id: string): boolean {
  return MARKETPLACE_STYLE_IDS.has(id);
}

function normalizeBenefits(
  b: string | string[] | undefined,
): string {
  if (b == null) return "";
  if (Array.isArray(b)) {
    return b.map((x) => x.trim()).filter(Boolean).join("\n");
  }
  return b.trim();
}

export type GenerateMarketplaceCardOk = {
  ok: true;
  generationId: string;
  status: string;
  costCredits: number;
};

export type GenerateMarketplaceCardVariantsOk = {
  ok: true;
  generationIds: string[];
  variants: Array<{
    generationId: string;
    status: string;
    costCredits: number;
    templatePreset: string;
    templateLayoutKey: string;
    typographyPreset: string;
    variantIndex: number;
    /** Слот без Generation (ошибка постановки в очередь и т.п.) */
    errorMessage?: string | null;
  }>;
  status: string;
  costCredits: number;
  variantGroupId: string;
  variantCount: number;
};

export type GenerateMarketplaceCardErr = {
  ok: false;
  error: string;
  status: number;
  code?: "PRICE_CHANGED";
  reason?: string;
};

export type GenerateMarketplaceCardResult = GenerateMarketplaceCardOk | GenerateMarketplaceCardErr;
export type GenerateMarketplaceCardVariantsResult = GenerateMarketplaceCardVariantsOk | GenerateMarketplaceCardErr;

export type EstimateMarketplaceCardOk = {
  ok: true;
  credits: number;
  perVariantCredits: number;
  variantCount: number;
  modelName: string;
  priceBreakdown: Awaited<ReturnType<typeof calculateProductCardMarketplaceCardCredits>>;
  /** Распределение списаний по вариантам (сумма = credits) */
  variantAllocations: number[];
};

export type EstimateMarketplaceCardErr = { ok: false; error: string; status: number };

export type EstimateMarketplaceCardResult = EstimateMarketplaceCardOk | EstimateMarketplaceCardErr;

/**
 * Оценка токенов: тот же Product Card pricing, что и при создании Generation.
 * Провайдер не вызывается.
 */
export async function estimateMarketplaceCardCredits(
  userId: string,
  projectId: string,
  input: {
    sourceType: MarketplaceImageSource;
    sourceGenerationId: string | null;
    style: string;
    cardSize?: string;
    overlayTemplate?: string;
    variantCount?: number;
  },
): Promise<EstimateMarketplaceCardResult> {
  const project = await getOwnedProjectOrNull(userId, projectId);
  if (!project) {
    return { ok: false, error: "Проект не найден", status: 404 };
  }
  if (!isValidMarketplaceCardStyle(input.style)) {
    return { ok: false, error: "Некорректный стиль карточки", status: 400 };
  }
  const style = input.style as MarketplaceCardStyle;
  const productCardSettings = await getProductCardSettings();
  const resolvedSize = resolveMarketplaceCardSize(
    productCardSettings.marketplaceCardSizes,
    input.cardSize,
  );
  if (!resolvedSize.ok) {
    return { ok: false, error: resolvedSize.error, status: 400 };
  }
  const src = await resolveMarketplaceCardSource(
    userId,
    project,
    input.sourceType,
    input.sourceGenerationId,
  );
  if (!src.ok) {
    return { ok: false, error: src.message, status: 400 };
  }
  const sourceImages =
    input.sourceType === "original" ? normalizeProductSourceImages(project) : [];
  const sourceImageUrls =
    sourceImages.length > 0 ? sourceImages.map((img) => img.url) : [src.url];
  const model = await resolveDefaultMarketplaceCardModel();
  if (!model) {
    return {
      ok: false,
      error: PRODUCT_CARD_MODEL_NOT_CONFIGURED_MESSAGE,
      status: 400,
    };
  }

  const merged = buildMarketplaceCardMergedModelSettings(
    model,
    sourceImageUrls,
    style,
    resolvedSize.size,
  );
  if (!merged.ok) {
    return { ok: false, error: merged.error, status: 400 };
  }
  const price = await calculateProductCardMarketplaceCardCredits(model, merged.merged);
  const rawVc = Math.round(input.variantCount ?? 1);
  /** Витрина: 4–6 отдельных Generation; одиночная карточка — множитель 1. */
  const variantCount =
    rawVc > 1 ? Math.min(6, Math.max(4, rawVc)) : Math.min(6, Math.max(1, rawVc));
  const bundle = resolveMarketplaceVariantBundleTotals(model, variantCount, price);
  return {
    ok: true,
    credits: bundle.totalCredits,
    perVariantCredits: price.credits,
    variantCount,
    modelName: model.name,
    priceBreakdown: bundle.priceBreakdown,
    variantAllocations: bundle.allocations,
  };
}

function buildMarketplaceCardMergedModelSettings(
  model: AiModel,
  sourceImageUrl: string | string[],
  style: MarketplaceCardStyle,
  cardSize: MarketplaceCardResolvedSize,
):
  | { ok: true; merged: Record<string, unknown> }
  | { ok: false; error: string } {
  try {
    const sourceImageUrls = (Array.isArray(sourceImageUrl) ? sourceImageUrl : [sourceImageUrl])
      .map((url) => url.trim())
      .filter(Boolean);
    const mainSourceImageUrl = sourceImageUrls[0] ?? "";
    const b = buildImageModelInput(
      { settingsSchema: model.settingsSchema, supportsImageInput: model.supportsImageInput },
      sourceImageUrl,
    );
    return {
      ok: true,
      merged: {
        ...b.normalizedSettings,
        sourceImageUrl: mainSourceImageUrl,
        sourceImageUrls,
        generationMode: "marketplace_card" as const,
        style,
        cardSize: cardSize.id,
        aspectRatio: cardSize.kieAspectRatio,
        resolution: cardSize.kieResolution,
        outputWidth: cardSize.width,
        outputHeight: cardSize.height,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Некорректные настройки модели",
    };
  }
}

/**
 * Маркетплейс-карточка: hidden prompt только на сервере; pipeline — общий product-card image.
 *
 * TODO: Marketplace card v1 uses image generation prompt. For production-quality text, later implement overlay rendering with HTML/SVG/canvas to avoid AI text mistakes.
 */
export async function generateMarketplaceCardForProductCard(
  p: {
    userId: string;
    projectId: string;
    sourceType: MarketplaceImageSource;
    sourceGenerationId: string | null;
    productTitle: string;
    benefits: string | string[];
    extraText: string;
    subtitle?: string;
    statsText?: string;
    sizeText?: string;
    style: string;
    cardSize?: string;
    overlayTemplate?: string;
    templatePreset?: string;
    typographyPreset?: string;
    generationMode?: "marketplace_card" | "marketplace_card_variants";
    variantGroupId?: string;
    variantIndex?: number;
    variantCount?: number;
    preserveProductLabel?: boolean;
    useIcons?: boolean;
    useArrows?: boolean;
    useShadows?: boolean;
    userInstructions: string;
    /** Не доверяйте цене с фронта: при расхождении с пересчётом — 409 PRICE_CHANGED */
    clientEstimateCredits?: number | null;
    /**
     * Доля списания при витрине вариантов (сумма allocations = суммарный estimate).
     */
    billingCreditsOverride?: number | null;
  },
): Promise<GenerateMarketplaceCardResult> {
  const { userId, projectId, clientEstimateCredits, billingCreditsOverride, ...input } = p;
  const project = await getOwnedProjectOrNull(userId, projectId);
  if (!project) {
    return { ok: false, error: "Проект не найден", status: 404 };
  }

  if (!isValidMarketplaceCardStyle(input.style)) {
    return { ok: false, error: "Некорректный стиль карточки", status: 400 };
  }
  const style = input.style as MarketplaceCardStyle;
  const productCardSettings = await getProductCardSettings();
  const resolvedSize = resolveMarketplaceCardSize(
    productCardSettings.marketplaceCardSizes,
    input.cardSize,
  );
  if (!resolvedSize.ok) {
    return { ok: false, error: resolvedSize.error, status: 400 };
  }

  const src = await resolveMarketplaceCardSource(
    userId,
    project,
    input.sourceType,
    input.sourceGenerationId,
  );
  if (!src.ok) {
    return { ok: false, error: src.message, status: 400 };
  }
  const sourceImages =
    input.sourceType === "original" ? normalizeProductSourceImages(project) : [];
  const sourceImageUrls =
    sourceImages.length > 0 ? sourceImages.map((img) => img.url) : [src.url];

  const model = await resolveDefaultMarketplaceCardModel();
  if (!model) {
    return {
      ok: false,
      error: PRODUCT_CARD_MODEL_NOT_CONFIGURED_MESSAGE,
      status: 400,
    };
  }

  const mergedPricing = buildMarketplaceCardMergedModelSettings(
    model,
    sourceImageUrls,
    style,
    resolvedSize.size,
  );
  if (!mergedPricing.ok) {
    return { ok: false, error: mergedPricing.error, status: 400 };
  }
  const marketplacePricing = await calculateProductCardMarketplaceCardCredits(
    model,
    mergedPricing.merged,
  );

  const billedCredits =
    billingCreditsOverride != null &&
    Number.isFinite(billingCreditsOverride) &&
    billingCreditsOverride >= 0
      ? Math.max(0, Math.round(billingCreditsOverride))
      : marketplacePricing.credits;

  const scale =
    marketplacePricing.credits > 0 ? billedCredits / marketplacePricing.credits : 1;
  const billingBreakdown =
    billedCredits === marketplacePricing.credits
      ? marketplacePricing
      : {
          ...marketplacePricing,
          credits: billedCredits,
          tokens: billedCredits,
          revenueKzt:
            Math.round(marketplacePricing.revenueKzt * scale * 100) / 100,
          providerCostUsd:
            Math.round(marketplacePricing.providerCostUsd * scale * 100_000) /
            100_000,
          providerCostKzt:
            Math.round(marketplacePricing.providerCostKzt * scale * 100) / 100,
          marginKzt:
            Math.round(
              (marketplacePricing.revenueKzt * scale -
                marketplacePricing.providerCostKzt * scale) *
                100,
            ) / 100,
          formula: `${marketplacePricing.formula}; job_allocation=${billedCredits}`,
        };

  const serverCredits = billingBreakdown.credits;
  if (
    clientEstimateCredits != null &&
    Number.isFinite(clientEstimateCredits) &&
    clientEstimateCredits !== serverCredits
  ) {
    return {
      ok: false,
      error: "Стоимость изменилась — обновите оценку и попробуйте снова",
      status: 409,
      code: "PRICE_CHANGED",
    };
  }

  const benefitsStr = normalizeBenefits(input.benefits);
  const benefitsList = benefitsStr
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  const overlayTemplate = input.overlayTemplate?.trim() || "bottom_panel";
  const cardSize = resolvedSize.size;
  const templatePreset = getProductCardTemplatePreset(input.templatePreset);
  const typographyPreset = getProductCardTypographyPreset(input.typographyPreset);
  const templateLayoutKey = getProductCardLayoutKey(templatePreset.id, cardSize.id);
  const normalizedText = generateProductSellingPoints({
    productTitle: input.productTitle,
    productCategory: project.selectedCategory,
    userBenefits: benefitsList,
    userExtraText: input.extraText,
    userSubtitle: input.subtitle,
    statsText: input.statsText,
    sizeText: input.sizeText,
    templatePreset: templatePreset.id,
  });
  const variantMode = input.generationMode ?? "marketplace_card";
  const variantIndex = typeof input.variantIndex === "number" ? input.variantIndex : 0;
  const variantCount = Math.min(6, Math.max(1, Math.round(input.variantCount ?? 1)));
  /** Keep short — moderation counts prompt length only; long RU/template copy was hitting MAX_PROMPT_LENGTH. */
  const userDirRaw = input.userInstructions.trim().slice(0, 380);
  const visualInstructions = [
    userDirRaw || undefined,
    `Visual direction: ${templatePreset.aiStyle}.`,
    `Product ~50–60% frame; visually plain margins for overlay only.`,
    input.preserveProductLabel
      ? "Keep original pack labels recognizable; never invent packaging text/logos."
      : "Do not invent logos or pack text.",
  ]
    .filter(Boolean)
    .join("\n");
  let finalPrompt = buildMarketplaceCardPrompt({
    style,
    userInstructions: visualInstructions,
    productTitle: normalizedText.title,
    benefits: normalizedText.benefits.join("\n"),
    extraText: normalizedText.extraText,
    overlayTemplate,
    cardAspectRatio: cardSize.aspectRatio,
    compositionInstruction: templatePreset.compositionInstruction,
  });
  const modCfg = await getFullModerationConfig();
  const promptCap = Math.max(256, Math.floor(modCfg.maxPromptLength) - 48);
  finalPrompt = clampMarketplacePrompt(finalPrompt, promptCap);

  const marketplaceOverlayInput = {
    template: overlayTemplate,
    cardSize: cardSize.id,
    outputWidth: cardSize.width,
    outputHeight: cardSize.height,
    aspectRatio: cardSize.aspectRatio,
    productTitle: normalizedText.title,
    subtitle: normalizedText.subtitle,
    benefits: normalizedText.benefits,
    extraText: normalizedText.extraText,
    statsText: normalizedText.statsText,
    sizeText: normalizedText.sizeText,
    style,
    templatePreset: templatePreset.id,
    typographyPreset: typographyPreset.id,
    overlayVersion: "v2" as const,
    useIcons: input.useIcons !== false,
    useArrows: input.useArrows !== false,
    useShadows: input.useShadows !== false,
    preserveProductLabel: input.preserveProductLabel === true,
  };
  const marketplaceOverlaySpec = buildMarketplaceCardOverlaySpec(marketplaceOverlayInput);
  type OverlaySpecWithLayout = { layoutAnalysis?: unknown };
  const layoutAnalysisPayload =
    "layoutAnalysis" in marketplaceOverlaySpec
      ? (marketplaceOverlaySpec as OverlaySpecWithLayout).layoutAnalysis
      : undefined;

  const productMeta: ProductCardGenMeta = {
    flow: "product_card",
    productCard: {
      projectId: project.id,
      tab: "marketplace_card",
      sourceType: input.sourceType,
    },
  };

  const metadataRoot: Record<string, unknown> = {
    flow: "product_card",
    projectId: project.id,
    tab: "marketplace_card",
    sourceType: input.sourceType,
    sourceGenerationId: input.sourceGenerationId?.trim() ?? null,
    sourceImageUrl: src.url,
    sourceImages,
    sourceImagesCount: sourceImages.length,
    modelSlug: model.slug,
    pricingScope: "PRODUCT_CARD",
    productCardModelType: model.productCardModelType,
    priceBreakdown: billingBreakdown,
    cardSize: cardSize.id,
    cardSizeLabel: cardSize.label,
    outputWidth: cardSize.width,
    outputHeight: cardSize.height,
    aspectRatio: cardSize.kieAspectRatio,
    requestedAspectRatio: cardSize.aspectRatio,
    resolution: cardSize.kieResolution,
    overlayTemplate,
    generationMode: variantMode,
    templatePreset: templatePreset.id,
    templatePresetLabel: templatePreset.label,
    templateLayoutKey,
    theme: templatePreset.theme,
    layout: templateLayoutKey,
    overlayVersion: "v2",
    typographyPreset: typographyPreset.id,
    typographyPresetLabel: typographyPreset.label,
    normalizedText,
    preserveProductLabel: input.preserveProductLabel === true,
    compositionMode: input.preserveProductLabel ? "preserve_product_label_requested" : "ai_base_with_overlay",
    useIcons: input.useIcons !== false,
    useArrows: input.useArrows !== false,
    useShadows: input.useShadows !== false,
    variantGroupId: input.variantGroupId ?? null,
    variantIndex,
    variantCount,
    layoutAnalysis: layoutAnalysisPayload,
    overlay: marketplaceOverlaySpec,
    overlayPreviewSvg: renderMarketplaceCardOverlaySvg(marketplaceOverlayInput),
    productTitle: normalizedText.title,
    subtitle: normalizedText.subtitle,
    style,
  };

  const marketplaceCardSettings = {
    sourceImageUrl: src.url,
    sourceImageUrls,
    generationMode: variantMode,
    templatePreset: templatePreset.id,
    templateLayoutKey,
    typographyPreset: typographyPreset.id,
    style: input.style,
    cardSize: cardSize.id,
    aspectRatio: cardSize.kieAspectRatio,
    resolution: cardSize.kieResolution,
    outputWidth: cardSize.width,
    outputHeight: cardSize.height,
  };

  const result = await queueProductCardImage(
    userId,
    model,
    finalPrompt,
    sourceImageUrls,
    productMeta,
    null,
    metadataRoot,
    marketplaceCardSettings,
    billingBreakdown,
  );

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      status: result.status,
      ...(result.reason ? { reason: result.reason } : {}),
    };
  }

  const costCredits = result.costCredits ?? 0;

  await appendMarketplaceCardGeneration(project.id, {
    generationId: result.generationId,
    sourceType: input.sourceType,
    sourceGenerationId: input.sourceGenerationId?.trim() ?? null,
    style: input.style,
    generationMode: variantMode,
    templatePreset: templatePreset.id,
    templateLayoutKey,
    typographyPreset: typographyPreset.id,
    cardSize: cardSize.id,
    variantGroupId: input.variantGroupId,
    variantIndex,
    variantCount,
  });

  return {
    ok: true,
    generationId: result.generationId,
    status: result.status,
    costCredits,
  };
}


export async function generateMarketplaceCardVariantsForProductCard(
  p: {
    userId: string;
    projectId: string;
    sourceType: MarketplaceImageSource;
    sourceGenerationId: string | null;
    productTitle: string;
    benefits: string | string[];
    extraText: string;
    subtitle?: string;
    statsText?: string;
    sizeText?: string;
    style: string;
    cardSize?: string;
    userInstructions: string;
    clientEstimateCredits?: number | null;
    variantCount?: number;
    typographyPreset?: string;
    preserveProductLabel?: boolean;
    useIcons?: boolean;
    useArrows?: boolean;
    useShadows?: boolean;
  },
): Promise<GenerateMarketplaceCardVariantsResult> {
  const variantCount = Math.min(6, Math.max(4, Math.round(p.variantCount ?? 6)));
  const estimate = await estimateMarketplaceCardCredits(p.userId, p.projectId, {
    sourceType: p.sourceType,
    sourceGenerationId: p.sourceGenerationId,
    style: p.style,
    cardSize: p.cardSize,
    variantCount,
  });
  if (!estimate.ok) return estimate;
  if (
    p.clientEstimateCredits != null &&
    Number.isFinite(p.clientEstimateCredits) &&
    p.clientEstimateCredits !== estimate.credits
  ) {
    return {
      ok: false,
      error: "Стоимость изменилась — обновите оценку и попробуйте снова",
      status: 409,
      code: "PRICE_CHANGED",
    };
  }

  const variantGroupId = randomUUID();
  const settled = await Promise.all(
    Array.from({ length: variantCount }, (_, i) =>
      generateMarketplaceCardForProductCard({
        ...p,
        templatePreset: variantTemplatePresetAt(i),
        typographyPreset: p.typographyPreset?.trim() || variantTypographyPresetAt(i),
        generationMode: "marketplace_card_variants",
        variantGroupId,
        variantIndex: i,
        variantCount,
        clientEstimateCredits: null,
        billingCreditsOverride:
          estimate.variantAllocations[i] ?? estimate.perVariantCredits,
      }).then((single) => ({ i, single })),
    ),
  );
  const variants: GenerateMarketplaceCardVariantsOk["variants"] = settled.map(({ i, single }) => {
    const templatePreset = variantTemplatePresetAt(i);
    const typographyPreset = p.typographyPreset?.trim() || variantTypographyPresetAt(i);
    const templateLayoutKey = getProductCardLayoutKey(templatePreset, p.cardSize);
    if (single.ok) {
      return {
        generationId: single.generationId,
        status: single.status,
        costCredits: single.costCredits,
        templatePreset,
        templateLayoutKey,
        typographyPreset,
        variantIndex: i,
        errorMessage: null as string | null,
      };
    }
    return {
      generationId: `failed-${variantGroupId}-${i}`,
      status: "FAILED",
      costCredits: 0,
      templatePreset,
      templateLayoutKey,
      typographyPreset,
      variantIndex: i,
      errorMessage: single.error,
    };
  });
  const generationIds = variants
    .map((v) => v.generationId)
    .filter((id) => !id.startsWith("failed-"));
  if (generationIds.length === 0) {
    return { ok: false, error: "Не удалось создать варианты карточки", status: 500 };
  }
  return {
    ok: true,
    generationIds,
    variants,
    status: "QUEUED",
    costCredits: variants.reduce((sum, v) => sum + v.costCredits, 0),
    variantGroupId,
    variantCount,
  };
}

const PRODUCT_VIDEO_MOTION_IDS = new Set<string>(
  PRODUCT_VIDEO_MOTION_STYLES.map((s) => s.id),
);

export function isValidProductVideoMotionStyle(id: string): boolean {
  return PRODUCT_VIDEO_MOTION_IDS.has(id);
}

function buildProductCardVideoModelSettings(
  model: AiModel,
  sourceImageUrl: string,
  duration: 5 | 10,
  referenceImageUrls: string[] = [sourceImageUrl],
  resolution = "720p",
  aspectRatio = "16:9",
):
  | { ok: true; settings: Record<string, unknown> }
  | { ok: false; error: string } {
  if (!modelHasSettingsSchema(model.settingsSchema)) {
    return { ok: false, error: "У видео-модели нет схемы настроек" };
  }
  const base = defaultsFromSchema(model.settingsSchema);
  const fieldNames = new Set(getSchemaFields(model.settingsSchema).map((f) => f.name));
  const draft: Record<string, unknown> = { ...base };

  if (fieldNames.has("scenario")) {
    draft.scenario = "first-frame";
  }
  if (fieldNames.has("firstFrameUrl")) {
    draft.firstFrameUrl = sourceImageUrl;
  } else if (fieldNames.has("imageUrl")) {
    draft.imageUrl = sourceImageUrl;
  } else if (fieldNames.has("inputUrls")) {
    draft.inputUrls = referenceImageUrls.length > 0 ? referenceImageUrls : [sourceImageUrl];
  } else if (fieldNames.has("imageUrls")) {
    draft.imageUrls = referenceImageUrls.length > 0 ? referenceImageUrls : [sourceImageUrl];
  }
  if (fieldNames.has("duration")) {
    draft.duration = duration;
  }
  if (fieldNames.has("resolution")) {
    draft.resolution = resolution;
  }
  if (fieldNames.has("aspectRatio")) {
    draft.aspectRatio = aspectRatio;
  }
  if (fieldNames.has("generateAudio")) {
    draft.generateAudio = false;
  }
  if (fieldNames.has("webSearch")) {
    draft.webSearch = false;
  }

  const norm = validateAndNormalizeModelSettings(model.settingsSchema, draft);
  if (!norm.ok) {
    return { ok: false, error: norm.message };
  }
  return { ok: true, settings: norm.settings };
}

export type EstimateProductVideoOk = {
  ok: true;
  credits: number;
  modelName: string;
  priceBreakdown: Awaited<ReturnType<typeof calculateProductCardVideoCredits>>;
};

export type EstimateProductVideoErr = { ok: false; error: string; status: number };

export type EstimateProductVideoResult = EstimateProductVideoOk | EstimateProductVideoErr;

export async function estimateProductVideoCredits(
  userId: string,
  projectId: string,
  input: {
    sourceType: ProductVideoImageSourceType;
    sourceGenerationId: string | null;
    duration: 5 | 10;
    motionStyle: string;
    resolution?: string;
    aspectRatio?: string;
  },
): Promise<EstimateProductVideoResult> {
  const project = await getOwnedProjectOrNull(userId, projectId);
  if (!project) {
    return { ok: false, error: "Проект не найден", status: 404 };
  }
  if (!isValidProductVideoMotionStyle(input.motionStyle)) {
    return { ok: false, error: "Некорректный стиль движения", status: 400 };
  }
  const src = await resolveProductVideoImageSource(
    userId,
    project,
    input.sourceType,
    input.sourceGenerationId,
  );
  if (!src.ok) {
    return { ok: false, error: src.message, status: 400 };
  }
  const model = await resolveDefaultProductVideoModel();
  if (!model) {
    return {
      ok: false,
      error: PRODUCT_CARD_MODEL_NOT_CONFIGURED_MESSAGE,
      status: 400,
    };
  }
  const sourceImages =
    input.sourceType === "original" ? normalizeProductSourceImages(project) : [];
  const sourceImageUrls =
    sourceImages.length > 0 ? sourceImages.map((img) => img.url) : [src.url];
  const built = buildProductCardVideoModelSettings(
    model,
    src.url,
    input.duration,
    sourceImageUrls,
    input.resolution ?? "720p",
    input.aspectRatio ?? "16:9",
  );
  if (!built.ok) {
    return { ok: false, error: built.error, status: 400 };
  }
  const price = await calculateProductCardVideoCredits(model, built.settings);
  return { ok: true, credits: price.credits, modelName: model.name, priceBreakdown: price };
}

export type GenerateProductVideoOk = {
  ok: true;
  generationId: string;
  status: string;
  costCredits: number;
};

export type GenerateProductVideoErr = {
  ok: false;
  error: string;
  status: number;
  code?: "PRICE_CHANGED";
  reason?: string;
};

export type GenerateProductVideoResult = GenerateProductVideoOk | GenerateProductVideoErr;

export async function generateProductVideoForProductCard(p: {
  userId: string;
  projectId: string;
  sourceType: ProductVideoImageSourceType;
  sourceGenerationId: string | null;
  duration: 5 | 10;
  motionStyle: string;
  resolution?: string;
  aspectRatio?: string;
  userPrompt: string;
  clientEstimateCredits?: number | null;
}): Promise<GenerateProductVideoResult> {
  const { userId, projectId, clientEstimateCredits, ...input } = p;
  const project = await getOwnedProjectOrNull(userId, projectId);
  if (!project) {
    return { ok: false, error: "Проект не найден", status: 404 };
  }
  if (!isValidProductVideoMotionStyle(input.motionStyle)) {
    return { ok: false, error: "Некорректный стиль движения", status: 400 };
  }

  const src = await resolveProductVideoImageSource(
    userId,
    project,
    input.sourceType,
    input.sourceGenerationId,
  );
  if (!src.ok) {
    return { ok: false, error: src.message, status: 400 };
  }

  const model = await resolveDefaultProductVideoModel();
  if (!model) {
    return {
      ok: false,
      error: PRODUCT_CARD_MODEL_NOT_CONFIGURED_MESSAGE,
      status: 400,
    };
  }

  const sourceImages =
    input.sourceType === "original" ? normalizeProductSourceImages(project) : [];
  const sourceImageUrls =
    sourceImages.length > 0 ? sourceImages.map((img) => img.url) : [src.url];
  const built = buildProductCardVideoModelSettings(
    model,
    src.url,
    input.duration,
    sourceImageUrls,
    input.resolution ?? "720p",
    input.aspectRatio ?? "16:9",
  );
  if (!built.ok) {
    return { ok: false, error: built.error, status: 400 };
  }
  const videoPricing = await calculateProductCardVideoCredits(model, built.settings);
  const serverCredits = videoPricing.credits;
  if (
    clientEstimateCredits != null &&
    Number.isFinite(clientEstimateCredits) &&
    clientEstimateCredits !== serverCredits
  ) {
    return {
      ok: false,
      error: "Стоимость изменилась — обновите оценку и попробуйте снова",
      status: 409,
      code: "PRICE_CHANGED",
    };
  }

  const finalPrompt = buildProductVideoPrompt({
    motionStyle: input.motionStyle,
    userPrompt: input.userPrompt,
  });

  const metadataRoot: Record<string, unknown> = {
    flow: "product_card",
    projectId: project.id,
    tab: "video",
    sourceType: input.sourceType,
    sourceGenerationId: input.sourceGenerationId?.trim() ?? null,
    sourceImageUrl: src.url,
    sourceImages,
    sourceImagesCount: sourceImages.length,
    duration: input.duration,
    resolution: input.resolution ?? "720p",
    aspectRatio: input.aspectRatio ?? "16:9",
    motionStyle: input.motionStyle,
    userPrompt: input.userPrompt,
    modelSlug: model.slug,
    pricingScope: "PRODUCT_CARD",
    productCardModelType: model.productCardModelType,
    priceBreakdown: videoPricing,
  };

  const productMeta: ProductCardGenMeta = {
    flow: "product_card",
    productCard: {
      projectId: project.id,
      tab: "video",
      sourceType: input.sourceType,
    },
  };

  const result = await queueProductCardVideo(
    userId,
    model,
    finalPrompt,
    built.settings,
    productMeta,
    [],
    null,
    metadataRoot,
    videoPricing,
  );

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      status: result.status,
      ...(result.reason ? { reason: result.reason } : {}),
    };
  }

  const costCredits = result.costCredits ?? 0;

  await appendVideoGenerationEntry(project.id, {
    generationId: result.generationId,
    sourceType: input.sourceType,
    sourceGenerationId: input.sourceGenerationId?.trim() ?? null,
    duration: input.duration,
    motionStyle: input.motionStyle,
  });

  return {
    ok: true,
    generationId: result.generationId,
    status: result.status,
    costCredits,
  };
}

```

## `src/server/services/productCardOverlayRenderer.ts`
```ts
import {
  getProductCardTemplatePreset,
  getProductCardTypographyPreset,
  getProductCardLayoutKey,
  resolveProductCardCanvas,
} from "@/config/product-card-overlay-presets";
import type { ProductCardTemplatePresetId, ProductCardTypographyPresetId } from "@/config/product-card-overlay-presets";
import { estimateTextWidth, fitTextToBox } from "@/lib/fit-text-to-box";
import { buildObjectAwarePayload, type BoundingBox, type ObjectAwareLayoutPayload } from "@/server/services/productCardObjectAwareLayout";

export type MarketplaceOverlayRenderOverrides = {
  hideFooter?: boolean;
  hideBadges?: boolean;
  hideArrows?: boolean;
  maxBenefitSlots?: number;
};

export type ProductCardOverlayInput = {
  template: string;
  cardSize: string;
  outputWidth?: number;
  outputHeight?: number;
  aspectRatio?: string;
  productTitle: string;
  subtitle?: string;
  benefits: string[];
  extraText: string;
  statsText?: string;
  sizeText?: string;
  style: string;
  templatePreset?: ProductCardTemplatePresetId | string;
  typographyPreset?: ProductCardTypographyPresetId | string;
  overlayVersion?: "v1" | "v2";
  useIcons?: boolean;
  useArrows?: boolean;
  useShadows?: boolean;
  preserveProductLabel?: boolean;
  /**
   * Bbox товара с финального JPEG (до SVG). Только координаты; текст по-прежнему рендерит SVG.
   */
  subjectBoxFromImage?: BoundingBox | null;
  /**
   * Если задан — рендер V2 берёт уже рассчитанный layout (строгий финальный режим после Kie).
   */
  objectAwareLayoutPayload?: ObjectAwareLayoutPayload | null;
  /** Серверное урезание футера/бейджей/стрелок и лимита benefits (строгая раскладка). */
  marketplaceOverlayRenderOverrides?: MarketplaceOverlayRenderOverrides | null;
  /** preview = схема зон; production = только итоговый оверлей */
  overlayRenderMode?: "production" | "preview";
  /** Только для админов: запретная зона и safe zones */
  layoutDebug?: boolean;
};

type OverlayTemplate = "bottom_panel" | "left_panel" | "badges_callouts";

type TextRole = "title" | "body" | "extra";

type TypographyProfile = {
  id: string;
  titleFont: string;
  bodyFont: string;
  extraFont: string;
  titleWeight: number;
  bodyWeight: number;
  extraWeight: number;
  titleColor: string;
  bodyColor: string;
  extraColor: string;
  panelFill: string;
  panelStroke: string;
  accentFill: string;
  accentColor: string;
  chipFill: string;
  chipStroke: string;
  markerFill: string;
  titleTracking: string;
  bodyTracking: string;
  titleShadow: string;
};

type TextBlock = {
  x: number;
  y: number;
  width: number;
  fontSize: number;
  lineHeight: number;
  maxLines: number;
  /** Ограничить общую высоту блока (плашка / подзаголовок). */
  maxBoxHeight?: number;
  anchor?: "start" | "middle";
  role: TextRole;
  letterSpacing?: string;
  shadow?: boolean;
};

const DEFAULT_OUTPUT_WIDTH = 1000;
const DEFAULT_OUTPUT_HEIGHT = 1000;

/** Docker installs Noto + DejaVu; Noto gives better Cyrillic display styles for SVG overlays. */
const BASE_SANS = "Noto Sans, DejaVu Sans, Liberation Sans, Arial, sans-serif";
const DISPLAY_SANS = "Noto Sans Display, Noto Sans, DejaVu Sans, Arial, sans-serif";
const BASE_SERIF = "Noto Serif Display, Noto Serif, DejaVu Serif, Georgia, serif";
const BASE_CONDENSED = "Noto Sans Condensed, Noto Sans, DejaVu Sans Condensed, Arial, sans-serif";

const TYPOGRAPHY: Record<string, TypographyProfile> = {
  clean_marketplace: {
    id: "clean_marketplace",
    titleFont: DISPLAY_SANS,
    bodyFont: BASE_SANS,
    extraFont: BASE_SANS,
    titleWeight: 800,
    bodyWeight: 650,
    extraWeight: 700,
    titleColor: "#0b2530",
    bodyColor: "#12323a",
    extraColor: "#007c93",
    panelFill: "rgba(255,255,255,0.9)",
    panelStroke: "rgba(0,175,202,0.42)",
    accentFill: "#e8f8fb",
    accentColor: "#008ca6",
    chipFill: "rgba(255,255,255,0.82)",
    chipStroke: "rgba(0,175,202,0.24)",
    markerFill: "#00afca",
    titleTracking: "-1.2px",
    bodyTracking: "-0.15px",
    titleShadow: "rgba(255,255,255,0.72)",
  },
  premium: {
    id: "premium",
    titleFont: BASE_SERIF,
    bodyFont: BASE_SANS,
    extraFont: BASE_SANS,
    titleWeight: 800,
    bodyWeight: 550,
    extraWeight: 700,
    titleColor: "#1f1a12",
    bodyColor: "#3a2f1e",
    extraColor: "#8a641b",
    panelFill: "rgba(255,250,240,0.9)",
    panelStroke: "rgba(190,142,46,0.44)",
    accentFill: "#fff0c2",
    accentColor: "#9a6a09",
    chipFill: "rgba(255,255,255,0.76)",
    chipStroke: "rgba(190,142,46,0.24)",
    markerFill: "#c9952f",
    titleTracking: "-0.8px",
    bodyTracking: "0px",
    titleShadow: "rgba(255,255,255,0.66)",
  },
  bright_advertising: {
    id: "bright_advertising",
    titleFont: BASE_CONDENSED,
    bodyFont: BASE_SANS,
    extraFont: BASE_CONDENSED,
    titleWeight: 900,
    bodyWeight: 800,
    extraWeight: 900,
    titleColor: "#072a36",
    bodyColor: "#083947",
    extraColor: "#062632",
    panelFill: "rgba(255,255,255,0.92)",
    panelStroke: "rgba(255,196,0,0.68)",
    accentFill: "#ffe04b",
    accentColor: "#072a36",
    chipFill: "rgba(255,255,255,0.86)",
    chipStroke: "rgba(255,196,0,0.46)",
    markerFill: "#ffcc00",
    titleTracking: "-1px",
    bodyTracking: "-0.2px",
    titleShadow: "rgba(255,231,73,0.82)",
  },
  minimalist: {
    id: "minimalist",
    titleFont: BASE_SANS,
    bodyFont: BASE_SANS,
    extraFont: BASE_SANS,
    titleWeight: 600,
    bodyWeight: 400,
    extraWeight: 600,
    titleColor: "#111827",
    bodyColor: "#374151",
    extraColor: "#6b7280",
    panelFill: "rgba(255,255,255,0.86)",
    panelStroke: "rgba(17,24,39,0.14)",
    accentFill: "#f3f4f6",
    accentColor: "#111827",
    chipFill: "rgba(255,255,255,0.72)",
    chipStroke: "rgba(17,24,39,0.11)",
    markerFill: "#111827",
    titleTracking: "-0.9px",
    bodyTracking: "0px",
    titleShadow: "rgba(255,255,255,0.64)",
  },
  infographic: {
    id: "infographic",
    titleFont: BASE_CONDENSED,
    bodyFont: BASE_SANS,
    extraFont: BASE_SANS,
    titleWeight: 900,
    bodyWeight: 700,
    extraWeight: 800,
    titleColor: "#082f49",
    bodyColor: "#0c4a6e",
    extraColor: "#0369a1",
    panelFill: "rgba(240,249,255,0.92)",
    panelStroke: "rgba(3,105,161,0.34)",
    accentFill: "#e0f2fe",
    accentColor: "#075985",
    chipFill: "rgba(255,255,255,0.82)",
    chipStroke: "rgba(3,105,161,0.24)",
    markerFill: "#0284c7",
    titleTracking: "-1.1px",
    bodyTracking: "-0.1px",
    titleShadow: "rgba(224,242,254,0.82)",
  },
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizedTemplate(template: string): OverlayTemplate {
  if (template === "left_panel" || template === "badges_callouts") return template;
  return "bottom_panel";
}

function outputSize(input: ProductCardOverlayInput): { width: number; height: number } {
  const width = Math.round(Number(input.outputWidth));
  const height = Math.round(Number(input.outputHeight));
  return {
    width: Number.isFinite(width) && width > 0 ? width : DEFAULT_OUTPUT_WIDTH,
    height: Number.isFinite(height) && height > 0 ? height : DEFAULT_OUTPUT_HEIGHT,
  };
}

function typographyFor(style: string): TypographyProfile {
  return TYPOGRAPHY[style] ?? TYPOGRAPHY.clean_marketplace;
}

function layoutAnalysisForMetadata(
  templatePresetId: string,
  cardSizeId: string,
  width: number,
  height: number,
): Pick<ObjectAwareLayoutPayload, "productBox" | "forbiddenZone" | "safeZones" | "layoutDecision"> {
  const p = buildObjectAwarePayload(templatePresetId, cardSizeId, width, height);
  return {
    productBox: p.productBox,
    forbiddenZone: p.forbiddenZone,
    safeZones: p.safeZones,
    layoutDecision: p.layoutDecision,
  };
}

export function buildMarketplaceCardOverlaySpec(input: ProductCardOverlayInput) {
  const benefits = input.benefits.map((item) => item.trim()).filter(Boolean).slice(0, 6);
  const size = outputSize(input);
  const useV2 = input.overlayVersion === "v2" || Boolean(input.templatePreset);
  if (useV2) {
    const canvas = resolveProductCardCanvas(input.cardSize || "square");
    const width = input.outputWidth ?? canvas.width;
    const height = input.outputHeight ?? canvas.height;
    const templatePreset = getProductCardTemplatePreset(input.templatePreset);
    const typography = getProductCardTypographyPreset(input.typographyPreset);
    return {
      renderer: "server_svg_overlay_v2",
      overlayVersion: "v2",
      template: normalizedTemplate(input.template || "bottom_panel"),
      templatePreset: templatePreset.id,
      templateLayoutKey: getProductCardLayoutKey(templatePreset.id, canvas.id),
      cardSize: canvas.id,
      outputWidth: width,
      outputHeight: height,
      aspectRatio: input.aspectRatio?.trim() || canvas.aspectRatio,
      style: input.style,
      typographyPreset: typography.id,
      typographyProfileId: typography.id,
      theme: templatePreset.theme,
      useIcons: input.useIcons !== false,
      useArrows: input.useArrows !== false,
      useShadows: input.useShadows !== false,
      preserveProductLabel: input.preserveProductLabel === true,
      layoutAnalysis: layoutAnalysisForMetadata(templatePreset.id, canvas.id, width, height),
      text: {
        title: input.productTitle.trim(),
        subtitle: input.subtitle?.trim() ?? "",
        benefits,
        extraText: input.extraText.trim(),
        statsText: input.statsText?.trim() ?? "",
        sizeText: input.sizeText?.trim() ?? "",
      },
    };
  }
  const typography = typographyFor(input.style);
  return {
    renderer: "server_svg_overlay_v1",
    template: normalizedTemplate(input.template || "bottom_panel"),
    cardSize: input.cardSize || "square",
    outputWidth: size.width,
    outputHeight: size.height,
    aspectRatio: input.aspectRatio?.trim() || `${size.width}:${size.height}`,
    style: input.style,
    typographyProfileId: typography.id,
    text: {
      title: input.productTitle.trim(),
      benefits,
      extraText: input.extraText.trim(),
    },
  };
}

function svgWrap(width: number, height: number, inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <filter id="panelShadow" x="-12%" y="-12%" width="124%" height="134%">
      <feDropShadow dx="0" dy="${Math.max(8, Math.round(height * 0.012))}" stdDeviation="${Math.max(8, Math.round(Math.min(width, height) * 0.014))}" flood-color="#022631" flood-opacity="0.16"/>
    </filter>
    <filter id="softTextShadow" x="-8%" y="-8%" width="116%" height="124%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#ffffff" flood-opacity="0.75"/>
    </filter>
  </defs>
  <rect x="0" y="0" width="${width}" height="${height}" fill="none"/>
${inner}
</svg>`;
}

function fontFamily(profile: TypographyProfile, role: TextRole): string {
  if (role === "title") return profile.titleFont;
  if (role === "extra") return profile.extraFont;
  return profile.bodyFont;
}

function fontWeight(profile: TypographyProfile, role: TextRole): number {
  if (role === "title") return profile.titleWeight;
  if (role === "extra") return profile.extraWeight;
  return profile.bodyWeight;
}

function colorFor(profile: TypographyProfile, role: TextRole): string {
  if (role === "title") return profile.titleColor;
  if (role === "extra") return profile.extraColor;
  return profile.bodyColor;
}

function textEl(value: string, block: TextBlock, profile: TypographyProfile): string {
  if (!value.trim()) return "";
  const lineHeightFactor = block.fontSize > 0 ? block.lineHeight / block.fontSize : 1.12;
  const approxHeight = block.maxBoxHeight ?? block.lineHeight * block.maxLines * 1.08;
  const fit = fitTextToBox(value, { width: block.width, height: approxHeight }, {
    maxWidth: block.width,
    maxLines: block.maxLines,
    maxFontSize: block.fontSize,
    minFontSize: Math.max(8, Math.round(block.fontSize * 0.38)),
    lineHeightFactor,
  });
  const lines = fit.lines;
  if (lines.length === 0) return "";
  const fontSize = fit.fontSize;
  const lineHeight = fit.lineHeight;
  const anchor = block.anchor ?? "start";
  const textX = anchor === "middle" ? block.x + block.width / 2 : block.x;
  const makeTspans = (dyOffset = 0) => lines
    .map(
      (line, idx) =>
        `<tspan x="${textX}" dy="${idx === 0 ? dyOffset : lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join("");
  const tracking =
    block.letterSpacing ?? (block.role === "title" ? profile.titleTracking : profile.bodyTracking);
  const attrs = `x="${textX}" y="${block.y}" text-anchor="${anchor}" font-size="${fontSize}" font-weight="${fontWeight(profile, block.role)}" font-family="${fontFamily(profile, block.role)}" letter-spacing="${tracking}"`;
  const shadow =
    block.shadow || block.role === "title"
      ? `<text ${attrs} fill="${profile.titleShadow}" filter="url(#softTextShadow)">${makeTspans()}</text>`
      : "";
  return `${shadow}<text ${attrs} fill="${colorFor(profile, block.role)}">${makeTspans()}</text>`;
}

function roundRect(
  x: number,
  y: number,
  width: number,
  height: number,
  rx: number,
  fill: string,
  stroke: string,
  attrs = "",
): string {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${Math.max(1, Math.round(Math.min(width, height) * 0.006))}" ${attrs}/>`;
}

function pct(value: number, total: number): number {
  return Math.round(value * total);
}

function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: string,
  width: number,
): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round"/>`;
}

function circle(cx: number, cy: number, r: number, fill: string, stroke = "none"): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}"/>`;
}

function accentPill(
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  profile: TypographyProfile,
  fontSize: number,
  anchor: "start" | "middle" = "middle",
): string {
  if (!text.trim()) return "";
  return [
    roundRect(x, y, width, height, Math.round(height / 2), profile.accentFill, profile.panelStroke),
    textEl(text.trim().toUpperCase(), {
      x: x + width * 0.12,
      y: y + height * 0.62,
      width: width * 0.76,
      fontSize,
      lineHeight: fontSize,
      maxLines: 1,
      maxBoxHeight: Math.round(height * 0.78),
      anchor,
      role: "extra",
      letterSpacing: "1.2px",
    }, profile),
  ].join("\n  ");
}

function chip(
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
  profile: TypographyProfile,
  fontSize: number,
  marker: "dot" | "number",
  index: number,
): string {
  const markerSize = Math.round(height * 0.34);
  const markerX = x + Math.round(height * 0.44);
  const markerY = y + Math.round(height * 0.5);
  const markerEl =
    marker === "number"
      ? [
          circle(markerX, markerY, markerSize / 2, profile.accentFill, profile.panelStroke),
          textEl(String(index + 1), {
            x: markerX - markerSize * 0.24,
            y: markerY + markerSize * 0.22,
            width: markerSize * 0.5,
            fontSize: Math.round(markerSize * 0.62),
            lineHeight: markerSize,
            maxLines: 1,
            role: "extra",
            anchor: "middle",
          }, profile),
        ].join("\n  ")
      : circle(markerX, markerY, markerSize / 2, profile.markerFill);
  return [
    roundRect(x, y, width, height, Math.round(height * 0.38), profile.chipFill, profile.chipStroke),
    markerEl,
    textEl(label, {
      x: x + Math.round(height * 0.82),
      y: y + Math.round(height * 0.58),
      width: width - Math.round(height * 1.08),
      fontSize,
      lineHeight: Math.round(fontSize * 1.12),
      maxLines: 2,
      maxBoxHeight: Math.round(height * 0.62),
      role: "body",
    }, profile),
  ].join("\n  ");
}

function renderBottomPanel(
  width: number,
  height: number,
  title: string,
  benefits: string[],
  extra: string,
  profile: TypographyProfile,
): string {
  const pad = pct(0.055, width);
  const panelX = pct(0.055, width);
  const panelY = pct(height > width ? 0.61 : 0.59, height);
  const panelW = pct(0.89, width);
  const panelH = Math.min(pct(0.34, height), height - panelY - pct(0.045, height));
  const titleSize = Math.round(Math.min(width, height) * (height > width ? 0.044 : 0.052));
  const bodySize = Math.round(Math.min(width, height) * (height > width ? 0.023 : 0.029));
  const extraSize = Math.round(Math.min(width, height) * 0.0185);
  const contentX = panelX + pad * 0.55;
  const contentW = panelW - pad * 1.1;
  const chipGap = Math.round(Math.min(width, height) * 0.014);
  const chipTop = panelY + Math.round(panelH * 0.47);
  const useTwoCols = width >= 900;
  const chipW = useTwoCols ? Math.round((contentW - chipGap) / 2) : contentW;
  const chipH = Math.round(Math.min(width, height) * (height > width ? 0.054 : 0.062));

  const benefitEls = benefits.slice(0, 4).map((benefit, idx) => {
    const col = useTwoCols ? idx % 2 : 0;
    const row = useTwoCols ? Math.floor(idx / 2) : idx;
    return chip(
      benefit,
      contentX + col * (chipW + chipGap),
      chipTop + row * (chipH + chipGap),
      chipW,
      chipH,
      profile,
      bodySize,
      "dot",
      idx,
    );
  });
  const pillW = Math.min(contentW * 0.54, Math.max(contentW * 0.34, estimateTextWidth(extra, extraSize) + pad));
  const pillH = Math.round(extraSize * 2.3);

  return [
    roundRect(panelX, panelY, panelW, panelH, Math.round(Math.min(width, height) * 0.038), profile.panelFill, profile.panelStroke, 'filter="url(#panelShadow)"'),
    line(contentX, panelY + Math.round(panelH * 0.11), contentX + Math.round(contentW * 0.18), panelY + Math.round(panelH * 0.11), profile.markerFill, Math.max(3, Math.round(Math.min(width, height) * 0.006))),
    textEl(title, {
      x: contentX,
      y: panelY + Math.round(panelH * 0.22),
      width: contentW,
      fontSize: titleSize,
      lineHeight: Math.round(titleSize * 1.18),
      maxLines: 2,
      role: "title",
      shadow: true,
    }, profile),
    ...benefitEls,
    accentPill(extra, contentX, panelY + panelH - pillH - Math.round(panelH * 0.07), pillW, pillH, profile, extraSize),
  ].filter(Boolean).join("\n  ");
}

function renderLeftPanel(
  width: number,
  height: number,
  title: string,
  benefits: string[],
  extra: string,
  profile: TypographyProfile,
): string {
  const panelX = pct(0.055, width);
  const panelY = pct(0.07, height);
  const panelW = pct(width > height ? 0.36 : 0.43, width);
  const panelH = pct(0.86, height);
  const pad = pct(0.035, width);
  const titleSize = Math.round(Math.min(width, height) * 0.04);
  const bodySize = Math.round(Math.min(width, height) * 0.0225);
  const extraSize = Math.round(Math.min(width, height) * 0.02);
  const contentX = panelX + pad;
  const contentW = panelW - pad * 2;
  const chipH = Math.round(Math.min(width, height) * 0.064);
  const chipGap = Math.round(Math.min(width, height) * 0.016);
  const chipTop = panelY + Math.round(panelH * 0.31);

  const benefitEls = benefits.slice(0, 5).map((benefit, idx) =>
    chip(
      benefit,
      contentX,
      chipTop + idx * (chipH + chipGap),
      contentW,
      chipH,
      profile,
      bodySize,
      "number",
      idx,
    ),
  );
  const pillH = Math.round(extraSize * 2.4);

  return [
    roundRect(panelX, panelY, panelW, panelH, Math.round(Math.min(width, height) * 0.032), profile.panelFill, profile.panelStroke, 'filter="url(#panelShadow)"'),
    line(contentX, panelY + Math.round(panelH * 0.055), contentX + Math.round(contentW * 0.24), panelY + Math.round(panelH * 0.055), profile.markerFill, Math.max(3, Math.round(Math.min(width, height) * 0.006))),
    textEl(title, {
      x: contentX,
      y: panelY + pct(0.12, panelH),
      width: contentW,
      fontSize: titleSize,
      lineHeight: Math.round(titleSize * 1.18),
      maxLines: 3,
      role: "title",
      shadow: true,
    }, profile),
    ...benefitEls,
    accentPill(extra, contentX, panelY + panelH - pillH - Math.round(panelH * 0.045), contentW, pillH, profile, extraSize),
  ].filter(Boolean).join("\n  ");
}

function renderBadges(
  width: number,
  height: number,
  title: string,
  benefits: string[],
  extra: string,
  profile: TypographyProfile,
): string {
  const titleW = pct(width > height ? 0.56 : 0.78, width);
  const titleX = (width - titleW) / 2;
  const titleY = pct(0.05, height);
  const titleH = pct(0.15, height);
  const titleSize = Math.round(Math.min(width, height) * 0.037);
  const bodySize = Math.round(Math.min(width, height) * 0.0225);
  const extraSize = Math.round(Math.min(width, height) * 0.02);

  const badgeW = pct(width > height ? 0.28 : 0.37, width);
  const badgeH = Math.max(pct(0.078, height), bodySize * 2.45);
  const positions = [
    { x: pct(0.06, width), y: pct(0.28, height) },
    { x: width - pct(0.06, width) - badgeW, y: pct(0.34, height) },
    { x: pct(0.06, width), y: pct(0.52, height) },
    { x: width - pct(0.06, width) - badgeW, y: pct(0.6, height) },
    { x: pct(0.11, width), y: pct(0.75, height) },
    { x: width - pct(0.11, width) - badgeW, y: pct(0.78, height) },
  ];

  const badges = benefits.slice(0, 6).flatMap((benefit, idx) => {
    const p = positions[idx] ?? positions[0];
    const x = p.x;
    const y = p.y;
    return [
      chip(benefit, x, y, badgeW, badgeH, profile, bodySize, "dot", idx),
    ];
  });

  const extraW = pct(0.72, width);
  const extraH = Math.round(extraSize * 2.35);
  return [
    roundRect(titleX, titleY, titleW, titleH, Math.round(Math.min(width, height) * 0.032), profile.panelFill, profile.panelStroke, 'filter="url(#panelShadow)"'),
    line(titleX + titleW * 0.32, titleY + titleH * 0.22, titleX + titleW * 0.68, titleY + titleH * 0.22, profile.markerFill, Math.max(3, Math.round(Math.min(width, height) * 0.005))),
    textEl(title, {
      x: titleX + pct(0.035, width),
      y: titleY + Math.round(titleH * 0.57),
      width: titleW - pct(0.05, width),
      fontSize: titleSize,
      lineHeight: Math.round(titleSize * 1.15),
      maxLines: 2,
      anchor: "middle",
      role: "title",
      shadow: true,
    }, profile),
    ...badges,
    accentPill(extra, (width - extraW) / 2, pct(0.925, height), extraW, extraH, profile, extraSize),
  ].filter(Boolean).join("\n  ");
}


function v2TypographyProfile(input: ProductCardOverlayInput): TypographyProfile {
  const template = getProductCardTemplatePreset(input.templatePreset);
  const typography = getProductCardTypographyPreset(input.typographyPreset);
  return {
    id: typography.id,
    titleFont: typography.titleFont,
    bodyFont: typography.bodyFont,
    extraFont: typography.bodyFont,
    titleWeight: typography.titleWeight,
    bodyWeight: typography.bodyWeight,
    extraWeight: Math.max(500, typography.bodyWeight),
    titleColor: template.textColor,
    bodyColor: template.textColor,
    extraColor: template.mutedTextColor,
    panelFill: template.panelFill,
    panelStroke: template.panelStroke,
    accentFill: template.accentColor,
    accentColor: template.accentColor,
    chipFill: template.panelFill,
    chipStroke: template.panelStroke,
    markerFill: template.accentColor,
    titleTracking: "-0.8px",
    bodyTracking: "0px",
    titleShadow: template.theme === "dark" ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.75)",
  };
}

function iconIdForBenefit(value: string): string {
  const s = value.toLowerCase();
  if (/зим|холод|қар|суық|тепл|warm/.test(s)) return "snowflake";
  if (/солн|күн|uv|spf/.test(s)) return "sun";
  if (/вода|ылғал|капл|moist|hydr/.test(s)) return "droplet";
  if (/защит|қорға|safe|shield/.test(s)) return "shield";
  if (/эко|натур|leaf|табиғи/.test(s)) return "leaf";
  if (/белок|protein|протеин/.test(s)) return "protein";
  if (/вес|weight|жеңіл|легк/.test(s)) return "weight";
  if (/размер|size|өлшем/.test(s)) return "size";
  if (/ткан|fabric|материал/.test(s)) return "fabric";
  if (/кожа|skin|тері/.test(s)) return "skin";
  if (/глаз|көз|очки|eye/.test(s)) return "eye";
  if (/энерг|қуат|power/.test(s)) return "lightning";
  if (/преми|сапа|quality|premium/.test(s)) return "star";
  return "check";
}

function iconPath(id: string): string {
  const paths: Record<string, string> = {
    check: '<path d="M7 13l3 3 7-8"/>',
    star: '<path d="M12 4l2.1 4.3 4.8.7-3.5 3.4.8 4.8-4.2-2.2-4.2 2.2.8-4.8L5.1 9l4.8-.7L12 4z"/>',
    shield: '<path d="M12 4l6 2.6v4.6c0 3.8-2.4 7.1-6 8.5-3.6-1.4-6-4.7-6-8.5V6.6L12 4z"/>',
    leaf: '<path d="M6 18c7 0 11-5 12-12-7 0-12 4-12 10v2z"/><path d="M6 18c3-4 6-7 10-9"/>',
    droplet: '<path d="M12 4s5 6 5 9.5a5 5 0 0 1-10 0C7 10 12 4 12 4z"/>',
    snowflake: '<path d="M12 4v16M5 8l14 8M19 8L5 16"/>',
    sun: '<circle cx="12" cy="12" r="3.5"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/>',
    protein: '<path d="M7 6h10l2 4-7 9-7-9 2-4z"/><path d="M8 10h8"/>',
    weight: '<path d="M7 10h10l1.5 9h-13L7 10z"/><path d="M9 10a3 3 0 0 1 6 0"/>',
    size: '<path d="M5 8V5h3M19 8V5h-3M5 16v3h3M19 16v3h-3M8 5l8 14"/>',
    fabric: '<path d="M5 7c4-2 10-2 14 0v10c-4-2-10-2-14 0V7z"/><path d="M9 6v12M15 6v12"/>',
    skin: '<path d="M7.5 17c0-3.5 2-6 4.5-6s4.5 2.5 4.5 6"/><circle cx="12" cy="7" r="3"/>',
    eye: '<path d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5z"/><circle cx="12" cy="12" r="2.5"/>',
    lightning: '<path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z"/>',
  };
  return paths[id] ?? paths.check!;
}

function iconCircle(
  icon: string,
  cx: number,
  cy: number,
  r: number,
  profile: TypographyProfile,
  invert = false,
): string {
  const fill = invert ? profile.markerFill : profile.accentFill;
  const stroke = invert ? "#ffffff" : profile.markerFill;
  return `<g>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" opacity="0.94"/>
    <g transform="translate(${cx - r * 0.58} ${cy - r * 0.58}) scale(${(r * 1.16) / 24})" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconPath(icon)}</g>
  </g>`;
}

function panelAttrs(useShadows: boolean): string {
  return useShadows ? 'filter="url(#panelShadow)"' : "";
}

function renderV2BenefitCard(
  label: string,
  zone: { x: number; y: number; width: number; height: number },
  profile: TypographyProfile,
  fontSize: number,
  index: number,
  useIcons: boolean,
  useShadows: boolean,
  templateId: string,
): string {
  // Увеличиваем скругление и размер иконки для большей схожести с референсом
  const r = Math.max(24, Math.round(Math.min(zone.width, zone.height) * 0.28));
  const iconR = Math.max(20, Math.round(zone.height * 0.28));
  
  const isCleanTpl = templateId === "light_marketplace" || templateId === "dark_infographic";
  const iconX = isCleanTpl ? zone.x + Math.round(zone.height * 0.25) : zone.x + Math.round(zone.height * 0.45);
  const iconY = zone.y + Math.round(zone.height / 2);
  const textX = useIcons ? iconX + iconR + Math.round(zone.height * 0.25) : zone.x + Math.round(zone.width * 0.08);
  const textW = zone.x + zone.width - textX - Math.round(zone.width * 0.06);
  
  // Увеличиваем размер шрифта для плашек преимуществ
  const adjustedFontSize = Math.round(fontSize * 1.15);

  const bg = isCleanTpl ? "" : roundRect(zone.x, zone.y, zone.width, zone.height, r, profile.chipFill, profile.chipStroke, panelAttrs(useShadows));

  return [
    bg,
    useIcons ? iconCircle(iconIdForBenefit(label), iconX, iconY, iconR, profile) : circle(iconX, iconY, Math.max(5, iconR * 0.25), profile.markerFill),
    textEl(label, {
      x: textX,
      y: zone.y + Math.round(zone.height * 0.55),
      width: textW,
      fontSize: adjustedFontSize,
      lineHeight: Math.round(adjustedFontSize * 1.18),
      maxLines: 2,
      maxBoxHeight: Math.round(zone.height * 0.62),
      role: "body",
      shadow: isCleanTpl, // добавляем тень тексту, если нет плашки
    }, profile),
  ].filter(Boolean).join("\n  ");
}

function arrowPath(from: { x: number; y: number }, to: { x: number; y: number }, color: string): string {
  const midX = Math.round((from.x + to.x) / 2);
  const d = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" opacity="0.68"/><circle cx="${to.x}" cy="${to.y}" r="5" fill="${color}" opacity="0.78"/>`;
}

type ProductCardLayoutRect = import("@/config/product-card-overlay-presets").RectZone;

function dashedZoneRect(
  z: ProductCardLayoutRect,
  stroke: string,
  opacity: number,
  dash = "9 11",
): string {
  return `<rect x="${z.x}" y="${z.y}" width="${z.width}" height="${z.height}" rx="${Math.round(Math.min(z.width, z.height) * 0.04)}" fill="none" stroke="${stroke}" stroke-dasharray="${dash}" stroke-width="2" opacity="${opacity}"/>`;
}

function overlaySchematicLayer(
  layout: import("@/config/product-card-overlay-presets").ProductCardLayoutPreset,
  awareness: ObjectAwareLayoutPayload,
  profile: TypographyProfile,
  renderMode: "production" | "preview" | undefined,
  layoutDebug: boolean | undefined,
  minSide: number,
): string {
  if (renderMode !== "preview" && !layoutDebug) return "";
  const layers: string[] = [];
  const muted = profile.bodyColor;
  if (renderMode === "preview") {
    layers.push(dashedZoneRect(awareness.productBox, profile.markerFill, 0.42));
    layers.push(dashedZoneRect(layout.title, muted, 0.32));
    layers.push(dashedZoneRect(layout.subtitle, muted, 0.28));
    for (const b of layout.benefits) {
      layers.push(dashedZoneRect(b, profile.accentColor, 0.26));
    }
    for (const b of layout.badges) {
      layers.push(dashedZoneRect(b, profile.accentColor, 0.24, "6 8"));
    }
    layers.push(dashedZoneRect(layout.footer, muted, 0.22, "4 7"));
    const tag = Math.max(12, Math.round(minSide * 0.018));
    layers.push(
      `<text x="${awareness.productBox.x + 8}" y="${awareness.productBox.y + tag + 4}" font-size="${tag}" fill="${muted}" opacity="0.5" font-family="${profile.bodyFont}">Товар</text>`,
    );
    layers.push(
      `<text x="${layout.title.x + 8}" y="${layout.title.y + tag + 4}" font-size="${tag}" fill="${muted}" opacity="0.5" font-family="${profile.bodyFont}">Заголовок</text>`,
    );
    layers.push(
      `<text x="${layout.subtitle.x + 8}" y="${layout.subtitle.y + tag + 3}" font-size="${Math.max(11, tag - 2)}" fill="${muted}" opacity="0.45" font-family="${profile.bodyFont}">Подзаголовок</text>`,
    );
  }
  if (layoutDebug) {
    const f = awareness.forbiddenZone;
    layers.push(
      `<rect x="${f.x}" y="${f.y}" width="${f.width}" height="${f.height}" fill="rgba(239,68,68,0.12)" stroke="rgba(220,38,38,0.55)" stroke-width="2" stroke-dasharray="4 6" opacity="0.95"/>`,
    );
    for (const s of awareness.safeZones) {
      layers.push(
        `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" fill="rgba(16,185,129,0.06)" stroke="rgba(5,150,105,0.45)" stroke-width="1.5" stroke-dasharray="6 8" opacity="0.9"/>`,
      );
    }
  }
  return layers.join("\n  ");
}

function renderMarketplaceCardOverlaySvgV2(input: ProductCardOverlayInput): string {
  const spec = buildMarketplaceCardOverlaySpec({ ...input, overlayVersion: "v2" });
  const templatePreset = getProductCardTemplatePreset(String(spec.templatePreset));
  const profile = v2TypographyProfile(input);
  const width = Number(spec.outputWidth) || resolveProductCardCanvas(String(spec.cardSize)).width;
  const height = Number(spec.outputHeight) || resolveProductCardCanvas(String(spec.cardSize)).height;
  const ro = input.marketplaceOverlayRenderOverrides ?? undefined;
  const awareness =
    input.objectAwareLayoutPayload ??
    buildObjectAwarePayload(
      String(spec.templatePreset),
      String(spec.cardSize),
      width,
      height,
      { subjectBoxOverride: input.subjectBoxFromImage ?? null },
    );
  const layout = awareness.adjustedLayout;
  const text = spec.text as {
    title: string;
    subtitle?: string;
    benefits: string[];
    extraText: string;
    statsText?: string;
    sizeText?: string;
  };
  const useIcons = spec.useIcons !== false;
  const useShadows = spec.useShadows !== false;
  const slotCap =
    typeof ro?.maxBenefitSlots === "number" ? ro.maxBenefitSlots : awareness.layoutDecision.benefitSlots;
  const benefitSlots = Math.max(
    1,
    Math.min(slotCap, awareness.layoutDecision.benefitSlots, layout.benefits.length),
  );
  const useArrows = !ro?.hideArrows && spec.useArrows !== false;
  const renderMode = input.overlayRenderMode ?? "production";
  const minSide = Math.min(width, height);
  const titleSize = Math.max(34, Math.round(minSide * layout.titleScale));
  const subtitleSize = Math.max(20, Math.round(minSide * layout.bodyScale * 0.95));
  const bodySize = Math.max(20, Math.round(minSide * layout.bodyScale));
  const smallSize = Math.max(16, Math.round(minSide * layout.smallScale));
  const omitTitleHeroPanel =
    templatePreset.id === "clean_catalog" ||
    templatePreset.id === "lifestyle_model" ||
    templatePreset.id === "light_marketplace" ||
    templatePreset.id === "dark_infographic" ||
    templatePreset.id === "minimal_top_bottom" ||
    templatePreset.id === "minimal_promo" ||
    templatePreset.id === "bottom_chips" ||
    templatePreset.id.endsWith("_compact");
  const titlePanel =
    omitTitleHeroPanel
      ? ""
      : roundRect(
          layout.title.x - 18,
          layout.title.y - 42,
          layout.title.width + 36,
          layout.title.height + 38,
          32,
          profile.panelFill,
          profile.panelStroke,
          panelAttrs(useShadows),
        );
  const benefitEls = layout.benefits
    .slice(0, benefitSlots)
    .map((zone, idx) => {
      const label = text.benefits[idx];
      if (!label) return "";
      return renderV2BenefitCard(
        label,
        zone,
        profile,
        bodySize,
        idx,
        useIcons &&
          templatePreset.id !== "clean_catalog" &&
          templatePreset.id !== "clean_catalog_compact",
        useShadows,
        templatePreset.id,
      );
    });
  const badgeTexts = [text.extraText, text.statsText, text.sizeText].map((x) => (x ?? "").trim()).filter(Boolean);
  const badgeEls = ro?.hideBadges
    ? []
    : layout.badges.map((zone, idx) => {
        const value = badgeTexts[idx];
        if (!value) return "";
        return accentPill(value, zone.x, zone.y, zone.width, zone.height, profile, smallSize, "middle");
      });
  const arrowEls = useArrows ? layout.arrows.map((a) => arrowPath(a.from, a.to, profile.markerFill)) : [];
  const schematic = overlaySchematicLayer(layout, awareness, profile, renderMode, input.layoutDebug, minSide);
  const footerText = [text.extraText, text.statsText, text.sizeText].filter(Boolean).join(" · ");
  const footerRendered =
    ro?.hideFooter || !footerText
      ? ""
      : textEl(footerText, {
          x: layout.footer.x,
          y: layout.footer.y + Math.round(layout.footer.height * 0.58),
          width: layout.footer.width,
          fontSize: smallSize,
          lineHeight: Math.round(smallSize * 1.2),
          maxLines: 2,
          maxBoxHeight: Math.round(layout.footer.height * 0.82),
          anchor: "middle",
          role: "extra",
        }, profile);
  const inner = [
    schematic,
    titlePanel,
    textEl(text.title, {
      x: layout.title.x,
      y: layout.title.y + Math.round(titleSize * 0.78),
      width: layout.title.width,
      fontSize: titleSize,
      lineHeight: Math.round(titleSize * 1.08),
      maxLines: 2,
      maxBoxHeight: Math.round(layout.title.height * 0.92),
      role: "title",
      shadow: useShadows,
    }, profile),
    textEl(text.subtitle ?? "", {
      x: layout.subtitle.x,
      y: layout.subtitle.y + Math.round(subtitleSize * 0.9),
      width: layout.subtitle.width,
      fontSize: subtitleSize,
      lineHeight: Math.round(subtitleSize * 1.28),
      maxLines: 2,
      maxBoxHeight: Math.round(layout.subtitle.height * 0.9),
      role: "extra",
    }, profile),
    ...arrowEls,
    ...benefitEls,
    ...badgeEls,
    footerRendered,
  ].filter(Boolean).join("\n  ");
  return svgWrap(width, height, inner);
}

export function renderMarketplaceCardOverlaySvg(input: ProductCardOverlayInput): string {
  const spec = buildMarketplaceCardOverlaySpec(input);
  if (spec.renderer === "server_svg_overlay_v2") {
    return renderMarketplaceCardOverlaySvgV2(input);
  }
  const title = spec.text.title.trim();
  const extraText = spec.text.extraText.trim();
  const benefits = spec.text.benefits;
  const tpl = spec.template;
  const width = spec.outputWidth;
  const height = spec.outputHeight;
  const profile = typographyFor(spec.style);
  const inner =
    tpl === "left_panel"
      ? renderLeftPanel(width, height, title, benefits, extraText, profile)
      : tpl === "badges_callouts"
        ? renderBadges(width, height, title, benefits, extraText, profile)
        : renderBottomPanel(width, height, title, benefits, extraText, profile);

  return svgWrap(width, height, inner);
}

```

## `src/server/services/productCardObjectAwareLayout.ts`
```ts
import type { ProductCardCanvasId, ProductCardLayoutPreset, RectZone } from "@/config/product-card-overlay-presets";
import { getProductCardLayoutPreset } from "@/config/product-card-overlay-presets";

export type BoundingBox = RectZone & {
  confidence?: number;
  source?: "cutout" | "vision" | "estimated" | "raster_estimate";
};

export type SafeZone = { key: string; x: number; y: number; width: number; height: number };

export type ProductAnchor =
  | "product_left"
  | "product_right"
  | "product_center"
  | "product_large_center";

export type LayoutDecision = {
  selectedLayoutKey: string;
  productAnchor: ProductAnchor;
  /** Сколько слотов benefit-зон в preset (после compact / anchor). */
  benefitSlots: number;
  compact: boolean;
  mirroredHorizontally: boolean;
  reason: string;
  avoidedProductOverlap: boolean;
};

export type ObjectAwareLayoutPayload = {
  productBox: BoundingBox;
  forbiddenZone: RectZone;
  safeZones: SafeZone[];
  layoutDecision: LayoutDecision;
  /** Overlay geometry after repell + optional compact — use for SVG rendering. */
  adjustedLayout: ProductCardLayoutPreset;
};

export function intersects(a: RectZone, b: RectZone): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function intersectionArea(a: RectZone, b: RectZone): number {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.width, b.x + b.width);
  const y1 = Math.min(a.y + a.height, b.y + b.height);
  const w = Math.max(0, x1 - x0);
  const h = Math.max(0, y1 - y0);
  return w * h;
}

function expandRect(r: RectZone, pad: number): RectZone {
  return {
    x: Math.max(0, r.x - pad),
    y: Math.max(0, r.y - pad),
    width: r.width + pad * 2,
    height: r.height + pad * 2,
  };
}

export function clampRectToCanvas(r: RectZone, canvasW: number, canvasH: number): RectZone {
  const x = Math.max(0, Math.min(r.x, canvasW));
  const y = Math.max(0, Math.min(r.y, canvasH));
  const width = Math.min(r.width, Math.max(0, canvasW - x));
  const height = Math.min(r.height, Math.max(0, canvasH - y));
  return { x, y, width, height };
}

/** For Level B: use template product safe area as heuristic product footprint. */
export function detectProductBox(
  templatePreset: string | undefined,
  cardSize: string | undefined,
  canvasW: number,
  canvasH: number,
): BoundingBox {
  const layout = getProductCardLayoutPreset(templatePreset, cardSize);
  const b = layout.productSafeArea;
  return {
    ...clampRectToCanvas(b, canvasW, canvasH),
    confidence: 0.55,
    source: "estimated",
  };
}

export function inferProductAnchor(
  box: RectZone,
  canvasW: number,
  canvasH: number,
): ProductAnchor {
  const area = Math.max(1, box.width * box.height);
  const canvasA = Math.max(1, canvasW * canvasH);
  const areaRatio = area / canvasA;
  if (areaRatio >= 0.36) return "product_large_center";

  const cx = (box.x + box.width / 2) / canvasW;
  const cy = (box.y + box.height / 2) / canvasH;

  if (
    areaRatio <= 0.32 &&
    cx > 0.36 &&
    cx < 0.64 &&
    cy > 0.3 &&
    cy < 0.72
  ) {
    return "product_center";
  }
  if (cx < 0.42) return "product_left";
  if (cx > 0.58) return "product_right";
  return "product_center";
}

function areaRect(r: RectZone): number {
  return Math.max(0, r.width) * Math.max(0, r.height);
}

function iou(a: RectZone, b: RectZone): number {
  const inter = intersectionArea(a, b);
  const u = areaRect(a) + areaRect(b) - inter;
  return u <= 0 ? 0 : inter / u;
}

/**
 * Слияние эвристики шаблона и bbox с растра: при сомнении оставляем более консервативный (шаблон).
 */
export function pickSubjectProductBox(
  heuristic: BoundingBox,
  raster: BoundingBox | null | undefined,
  canvasW: number,
  canvasH: number,
): BoundingBox {
  const h = { ...heuristic, ...clampRectToCanvas(heuristic, canvasW, canvasH) };
  if (!raster || (raster.confidence ?? 0) < 0.39) {
    return h;
  }
  const r = { ...raster, ...clampRectToCanvas(raster, canvasW, canvasH) };
  const canvasA = Math.max(1, canvasW * canvasH);
  if (areaRect(r) / canvasA < 0.014) return h;

  const overlap = iou(r, h);
  if ((r.confidence ?? 0) >= 0.55 && overlap >= 0.05) return r;
  if ((r.confidence ?? 0) >= 0.48 && overlap >= 0.02) return r;
  if (areaRect(r) > areaRect(h) * 1.45 && (r.confidence ?? 0) >= 0.44) return r;
  return h;
}

/** Padding around product for “no overlay” zone — spec ranges (mid values). */
export function buildForbiddenZone(productBox: RectZone, cardSize: string | undefined, canvasW: number, canvasH: number): RectZone {
  const id = cardSize as ProductCardCanvasId;
  const pad =
    id === "square" || id === "vertical"
      ? 55
      : id === "story"
        ? 80
        : id === "banner"
          ? 40
          : 55;
  return clampRectToCanvas(expandRect(productBox, pad), canvasW, canvasH);
}

/**
 * Расширение запретной зоны для длинных по горизонтали или вертикали товаров (strict overlay).
 */
export function expandForbiddenZoneForAspectRatio(
  forbidden: RectZone,
  subject: RectZone,
  canvasW: number,
  canvasH: number,
): RectZone {
  const sw = Math.max(subject.width, 4);
  const sh = Math.max(subject.height, 4);
  let r = clampRectToCanvas({ ...forbidden }, canvasW, canvasH);
  if (sw / sh >= 1.8) {
    const cx = r.x + r.width / 2;
    const nw = r.width * 1.1;
    const nx = Math.round(cx - nw / 2);
    r = clampRectToCanvas({ x: nx, y: r.y, width: Math.round(nw), height: r.height }, canvasW, canvasH);
  }
  if (sh / sw >= 1.8) {
    const cy = r.y + r.height / 2;
    const nh = r.height * 1.1;
    const ny = Math.round(cy - nh / 2);
    r = clampRectToCanvas({ x: r.x, y: ny, width: r.width, height: Math.round(nh) }, canvasW, canvasH);
  }
  return r;
}

export function computeSafeZones(canvasW: number, canvasH: number, forbidden: RectZone): SafeZone[] {
  const f = clampRectToCanvas(forbidden, canvasW, canvasH);
  const zones: SafeZone[] = [];

  const topH = Math.max(0, f.y);
  if (topH > 4) zones.push({ key: "top", x: 0, y: 0, width: canvasW, height: topH });

  const bottomY = f.y + f.height;
  const bottomH = Math.max(0, canvasH - bottomY);
  if (bottomH > 4) zones.push({ key: "bottom", x: 0, y: bottomY, width: canvasW, height: bottomH });

  const leftW = Math.max(0, f.x);
  if (leftW > 4) {
    zones.push({ key: "left", x: 0, y: f.y, width: leftW, height: f.height });
  }

  const rightX = f.x + f.width;
  const rightW = Math.max(0, canvasW - rightX);
  if (rightW > 4) {
    zones.push({ key: "right", x: rightX, y: f.y, width: rightW, height: f.height });
  }

  zones.push({
    key: "top_left",
    x: 0,
    y: 0,
    width: Math.min(leftW || canvasW * 0.4, canvasW * 0.45),
    height: Math.min(topH || canvasH * 0.28, canvasH * 0.35),
  });
  zones.push({
    key: "footer_strip",
    x: 0,
    y: Math.max(0, canvasH - Math.round(canvasH * 0.12)),
    width: canvasW,
    height: Math.round(canvasH * 0.12),
  });

  return zones.filter((z) => z.width > 8 && z.height > 8);
}

/**
 * Translate rect minimally so it sits outside forbidden; step search along axes.
 */
export function pushRectOutOfZone(rect: RectZone, forbidden: RectZone, canvasW: number, canvasH: number): RectZone {
  let r = clampRectToCanvas(rect, canvasW, canvasH);
  if (!intersects(r, forbidden)) return r;

  const step = 6;
  const maxSteps = Math.ceil(Math.max(canvasW, canvasH) / step);

  /** Try cardinal directions away from forbidden center */
  const fc = forbidden.x + forbidden.width / 2;
  const fy = forbidden.y + forbidden.height / 2;
  const rc = r.x + r.width / 2;
  const ry = r.y + r.height / 2;
  const dirX = rc >= fc ? 1 : -1;
  const dirY = ry >= fy ? 1 : -1;

  const candidates = [
    { dx: dirX * step, dy: 0 },
    { dx: 0, dy: dirY * step },
    { dx: -dirX * step, dy: 0 },
    { dx: 0, dy: -dirY * step },
    { dx: dirX * step, dy: dirY * step },
  ];

  for (let s = 0; s < maxSteps; s++) {
    let improved = false;
    for (const { dx, dy } of candidates) {
      const n = clampRectToCanvas({ ...r, x: r.x + dx, y: r.y + dy }, canvasW, canvasH);
      if (!intersects(n, forbidden)) return n;
      const a0 = intersectionArea(r, forbidden);
      const a1 = intersectionArea(n, forbidden);
      if (a1 < a0) {
        r = n;
        improved = true;
      }
    }
    if (!improved) r = clampRectToCanvas({ ...r, x: r.x + dirX * step, y: r.y + dirY * step }, canvasW, canvasH);
  }
  return r;
}

export function cloneLayoutPreset(base: ProductCardLayoutPreset): ProductCardLayoutPreset {
  return {
    ...base,
    title: { ...base.title },
    subtitle: { ...base.subtitle },
    productSafeArea: { ...base.productSafeArea },
    benefits: base.benefits.map((b) => ({ ...b })),
    badges: base.badges.map((b) => ({ ...b })),
    callouts: base.callouts.map((b) => ({ ...b })),
    arrows: base.arrows.map((a) => ({ from: { ...a.from }, to: { ...a.to } })),
    footer: { ...base.footer },
  };
}

export function mirrorLayoutHorizontally(
  layout: ProductCardLayoutPreset,
  canvasW: number,
): ProductCardLayoutPreset {
  const flip = (r: RectZone): RectZone => ({
    ...r,
    x: canvasW - r.x - r.width,
  });
  const flipPt = (p: import("@/config/product-card-overlay-presets").PointZone) => ({
    x: canvasW - p.x,
    y: p.y,
  });
  const out = cloneLayoutPreset(layout);
  out.title = flip(out.title);
  out.subtitle = flip(out.subtitle);
  out.productSafeArea = flip(out.productSafeArea);
  out.benefits = out.benefits.map(flip);
  out.badges = out.badges.map(flip);
  out.callouts = out.callouts.map(flip);
  out.footer = flip(out.footer);
  out.arrows = out.arrows.map((a) => ({
    from: flipPt(a.from),
    to: flipPt(a.to),
  }));
  return out;
}

function anchorNudgeTowardFreeSide(
  layout: ProductCardLayoutPreset,
  anchor: ProductAnchor,
  forbidden: RectZone,
  canvasW: number,
  canvasH: number,
): void {
  if (canvasW <= 8) return;
  const fcx = forbidden.x + forbidden.width / 2;
  const steer =
    anchor === "product_large_center"
      ? 60
      : anchor === "product_center"
        ? 42
        : 26;
  const edgeLeft = forbidden.x;
  const edgeRight = canvasW - (forbidden.x + forbidden.width);
  const preferLeft = edgeLeft >= edgeRight * 0.92;
  const preferRight = edgeRight >= edgeLeft * 0.92;
  let dx = 0;
  if (anchor === "product_right" || (fcx > canvasW * 0.52 && !preferLeft)) {
    dx = -steer;
  } else if (anchor === "product_left" || (fcx < canvasW * 0.48 && !preferRight)) {
    dx = steer;
  } else if (anchor === "product_center" || anchor === "product_large_center") {
    dx = fcx < canvasW * 0.5 ? steer * 0.35 : -steer * 0.35;
  }
  if (Math.abs(dx) < 1) return;
  const shift = (r: RectZone) => {
    r.x = Math.max(0, Math.min(canvasW - r.width, r.x + dx));
  };
  shift(layout.title);
  shift(layout.subtitle);
  for (const b of layout.benefits) shift(b);
  for (const b of layout.badges) shift(b);
  shift(layout.footer);
  const dy = anchor === "product_large_center" ? -Math.round(canvasH * 0.02) : 0;
  if (dy !== 0) {
    const vshift = (r: RectZone) => {
      r.y = Math.max(0, Math.min(canvasH - r.height, r.y + dy));
    };
    vshift(layout.title);
    vshift(layout.subtitle);
    for (const b of layout.benefits) vshift(b);
    vshift(layout.footer);
  }
}

export function chooseAdaptiveLayout(
  templatePreset: string | undefined,
  cardSize: string | undefined,
  productBox: RectZone,
  canvasW: number,
  canvasH: number,
  safeZones: SafeZone[],
  forbidden: RectZone,
): { layout: ProductCardLayoutPreset; decision: LayoutDecision } {
  const base = getProductCardLayoutPreset(templatePreset, cardSize);
  let layout = cloneLayoutPreset(base);
  const anchor = inferProductAnchor(productBox, canvasW, canvasH);
  let mirrored = false;

  if (anchor === "product_left") {
    layout = mirrorLayoutHorizontally(layout, canvasW);
    mirrored = true;
  }

  const cx = productBox.x + productBox.width / 2;
  const pxNorm = canvasW > 0 ? cx / canvasW : 0.5;
  let reasonParts: string[] = [`Anchor: ${anchor}`];
  const shiftX = pxNorm > 0.54 ? -28 : pxNorm < 0.46 ? 28 : 0;
  if (shiftX !== 0) {
    reasonParts.push(
      pxNorm > 0.54
        ? "центр товара правее — сдвиг текста влево"
        : "центр товара левее — сдвиг текста вправо",
    );
    layout.title.x += shiftX;
    layout.subtitle.x += shiftX;
    for (const b of layout.benefits) b.x += shiftX;
    for (const b of layout.badges) b.x += shiftX;
    layout.footer.x += shiftX;
  }

  anchorNudgeTowardFreeSide(layout, anchor, forbidden, canvasW, canvasH);

  if (anchor === "product_large_center") {
    while (layout.benefits.length > 3) layout.benefits.pop();
    while (layout.badges.length > 1) layout.badges.pop();
    layout.arrows = [];
    reasonParts.push("крупный центр — компактные benefits");
  } else if (anchor === "product_center") {
    while (layout.benefits.length > 4) layout.benefits.pop();
    reasonParts.push("центр — ограничение benefits");
  }

  const topZ = safeZones.find((z) => z.key === "top");
  const topArea = topZ ? topZ.width * topZ.height : 0;
  const bottomZ = safeZones.find((z) => z.key === "bottom");
  const bottomArea = bottomZ ? bottomZ.width * bottomZ.height : 0;
  if (topArea + bottomArea < canvasW * canvasH * 0.14) {
    reasonParts.push("мало вертикального safe space");
  }

  return {
    layout,
    decision: {
      selectedLayoutKey: layout.key,
      productAnchor: anchor,
      benefitSlots: layout.benefits.length,
      compact: anchor === "product_large_center",
      mirroredHorizontally: mirrored,
      reason: reasonParts.join("; "),
      avoidedProductOverlap: true,
    },
  };
}

export function resolveOverlayAgainstForbidden(
  layout: ProductCardLayoutPreset,
  forbidden: RectZone,
  canvasW: number,
  canvasH: number,
): ProductCardLayoutPreset {
  const out = cloneLayoutPreset(layout);
  out.title = pushRectOutOfZone(out.title, forbidden, canvasW, canvasH);
  out.subtitle = pushRectOutOfZone(out.subtitle, forbidden, canvasW, canvasH);
  out.footer = pushRectOutOfZone(out.footer, forbidden, canvasW, canvasH);
  for (let i = 0; i < out.benefits.length; i++) {
    out.benefits[i] = pushRectOutOfZone(out.benefits[i]!, forbidden, canvasW, canvasH);
  }
  for (let i = 0; i < out.badges.length; i++) {
    out.badges[i] = pushRectOutOfZone(out.badges[i]!, forbidden, canvasW, canvasH);
  }
  for (let i = 0; i < out.callouts.length; i++) {
    out.callouts[i] = pushRectOutOfZone(out.callouts[i]!, forbidden, canvasW, canvasH);
  }

  const bx = forbidden.x + forbidden.width / 2;
  const by = forbidden.y + forbidden.height / 2;
  for (const a of out.arrows) {
    const hit = intersects({ x: a.to.x - 10, y: a.to.y - 10, width: 20, height: 20 }, forbidden);
    if (!hit) continue;
    const vx = bx - a.from.x;
    const vy = by - a.from.y;
    const len = Math.hypot(vx, vy) || 1;
    const ux = vx / len;
    const uy = vy / len;
    const inset = Math.min(forbidden.width, forbidden.height) * 0.28 + 10;
    a.to.x = bx - ux * inset;
    a.to.y = by - uy * inset;
    a.to.x = Math.max(forbidden.x - 4, Math.min(forbidden.x + forbidden.width + 4, a.to.x));
    a.to.y = Math.max(forbidden.y - 4, Math.min(forbidden.y + forbidden.height + 4, a.to.y));
  }

  return out;
}

export function measureForbiddenOverlap(layout: ProductCardLayoutPreset, forbidden: RectZone): number {
  let area = 0;
  const boxes: RectZone[] = [layout.title, layout.subtitle, layout.footer, ...layout.benefits, ...layout.badges];
  for (const b of boxes) {
    area += intersectionArea(b, forbidden);
  }
  return area;
}

/** When space tight: trim benefits count, optionally drop arrows badges (caller applies). */
export function compactLayoutForTightSafeZones(layout: ProductCardLayoutPreset): ProductCardLayoutPreset {
  const out = cloneLayoutPreset(layout);
  while (out.benefits.length > 3) out.benefits.pop();
  while (out.badges.length > 1) out.badges.pop();
  out.arrows = [];
  return out;
}

export type BuildObjectAwareOptions = {
  subjectBoxOverride?: BoundingBox | null;
  /** Расширить forbidden после построения (частный случай финального marketplace-композита). */
  strictMarketplace?: boolean;
};

export function buildObjectAwarePayload(
  templatePreset: string | undefined,
  cardSize: string | undefined,
  canvasW: number,
  canvasH: number,
  options?: BuildObjectAwareOptions,
): ObjectAwareLayoutPayload {
  const heuristic = detectProductBox(templatePreset, cardSize, canvasW, canvasH);
  const productBox = pickSubjectProductBox(
    heuristic,
    options?.subjectBoxOverride,
    canvasW,
    canvasH,
  );
  let forbiddenZone = buildForbiddenZone(productBox, cardSize, canvasW, canvasH);
  if (options?.strictMarketplace) {
    forbiddenZone = expandForbiddenZoneForAspectRatio(
      forbiddenZone,
      productBox,
      canvasW,
      canvasH,
    );
  }
  const safeZones = computeSafeZones(canvasW, canvasH, forbiddenZone);

  let { layout, decision } = chooseAdaptiveLayout(
    templatePreset,
    cardSize,
    productBox,
    canvasW,
    canvasH,
    safeZones,
    forbiddenZone,
  );
  layout = resolveOverlayAgainstForbidden(layout, forbiddenZone, canvasW, canvasH);

  let overlap = measureForbiddenOverlap(layout, forbiddenZone);
  if (overlap > 3200) {
    layout = resolveOverlayAgainstForbidden(compactLayoutForTightSafeZones(layout), forbiddenZone, canvasW, canvasH);
    overlap = measureForbiddenOverlap(layout, forbiddenZone);
    decision = {
      ...decision,
      compact: true,
      benefitSlots: layout.benefits.length,
      reason: `${decision.reason}; compact overlay (меньше плашек, без стрелок)`,
    };
  }

  if (overlap > 0) {
    decision = {
      ...decision,
      reason: `${decision.reason}; остаточное пересечение ~${Math.round(overlap)}px²`,
      avoidedProductOverlap: false,
    };
  }

  return {
    productBox,
    forbiddenZone,
    safeZones,
    layoutDecision: decision,
    adjustedLayout: layout,
  };
}

```

## `src/server/services/productCardPricing.ts`
```ts

import type { AiModel } from "@/generated/prisma/client";
import { isAdminPricingPinned } from "@/lib/admin-pricing-pinned";
import {
  getProductCardSettings,
  type ProductCardSettings,
} from "@/server/services/productCardSettings";

export type ProductCardPricingScenario =
  | "concept_image"
  | "marketplace_card"
  | "video";

export type ProductCardPriceBreakdown = {
  v?: 2;
  pricingScope: "PRODUCT_CARD";
  scenario: ProductCardPricingScenario;
  productCardModelType: string | null;
  modelId: string;
  modelSlug: string;
  modelName: string;
  credits: number;
  tokens: number;
  providerCostUsd: number;
  providerCostKzt: number;
  revenueKzt: number;
  marginKzt: number;
  marginPercent: number | null;
  priceSource:
    | "manual_override"
    | "matrix"
    | "base"
    | "legacy_model_cost";
  formula: string;
  warnings: string[];
  manualOverrideKey?: string | null;
  adminPricingPinned?: boolean;
  appliedMultipliers?: Array<{ key: string; value: number }>;
  /** Одна генерация маркетплейса (до бандла) */
  singleVariantCredits?: number;
  /** Число вариантов витрины (≥1) */
  variantCount?: number | null;
  /** Фиксированная цена пакета variantsBundleTokens / variantsBundleByCount или null */
  bundleCredits?: number | null;
  /** Итоговые списания (= credits при estimate бандла) */
  totalCredits?: number;
  variantAllocations?: number[] | null;
};

type PricingSchema = {
  pricingScope?: unknown;
  type?: unknown;
  baseTokens?: unknown;
  fallbackTokens?: unknown;
  minTokens?: unknown;
  /** Дополнительный глобальный множитель в схеме */
  priceMultiplier?: unknown;
  minConceptImageTokens?: unknown;
  minMarketplaceCardTokens?: unknown;
  minVideoTokens?: unknown;
  providerCostUsd?: unknown;
  providerCost?: unknown;
  markupPercent?: unknown;
  manualOverrides?: unknown;
  matrix?: unknown;
  multipliers?: unknown;
  cardSizeMultipliers?: unknown;
  templateMultipliers?: unknown;
  variantsBundleTokens?: unknown;
  variantsBundleByCount?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function schemaOf(model: AiModel): PricingSchema | null {
  return asRecord(model.pricingSchema) as PricingSchema | null;
}

function scenarioMinTokens(
  scenario: ProductCardPricingScenario,
  settings: ProductCardSettings,
  schema: PricingSchema | null,
): number {
  if (scenario === "concept_image") {
    return Math.round(asNumber(schema?.minConceptImageTokens, settings.minConceptImageTokens));
  }
  if (scenario === "marketplace_card") {
    return Math.round(
      asNumber(schema?.minMarketplaceCardTokens, settings.minMarketplaceCardTokens),
    );
  }
  return Math.round(asNumber(schema?.minVideoTokens, settings.minVideoTokens));
}

function pickKeys(settings: Record<string, unknown>): string[] {
  const keys: string[] = [];
  for (const name of [
    "size",
    "cardSize",
    "preset",
    "templatePreset",
    "resolution",
    "quality",
    "aspectRatio",
    "duration",
    "style",
  ]) {
    const value = settings[name];
    if (typeof value === "string" || typeof value === "number") {
      keys.push(`${name}:${String(value)}`);
      keys.push(String(value));
    }
  }
  return keys;
}

function entryForKeys(source: unknown, keys: string[]): Record<string, unknown> | null {
  const obj = asRecord(source);
  if (!obj) return null;
  for (const key of keys) {
    const entry = asRecord(obj[key]);
    if (entry) return entry;
    const direct = obj[key];
    if (typeof direct === "number") return { tokens: direct };
  }
  return null;
}

function multiplierForSettings(source: unknown, settings: Record<string, unknown>): number {
  const multipliers = asRecord(source);
  if (!multipliers) return 1;
  let multiplier = 1;
  for (const key of pickKeys(settings)) {
    const value = multipliers[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      multiplier *= value;
    }
  }
  return multiplier;
}

function multiplierFromNestedMap(
  source: unknown,
  keyRaw: unknown,
): { value: number; hit: boolean } {
  const key =
    typeof keyRaw === "string"
      ? keyRaw.trim()
      : keyRaw != null && String(keyRaw).trim() !== ""
        ? String(keyRaw).trim()
        : "";
  const map = asRecord(source);
  if (!map || !key) {
    return { value: 1, hit: false };
  }
  const v = map[key];
  if (typeof v === "number" && Number.isFinite(v) && v > 0) {
    return { value: v, hit: true };
  }
  return { value: 1, hit: false };
}

function resolveBundleCreditsFromSchema(
  schema: PricingSchema | null,
  variantCount: number,
): number | null {
  if (!schema || variantCount <= 1) return null;
  const byRaw = schema.variantsBundleByCount as unknown;
  const byMap = asRecord(byRaw);
  const k = String(Math.round(variantCount));
  if (byMap && typeof byMap[k] === "number" && Number.isFinite(byMap[k])) {
    const n = Math.max(0, Math.ceil(byMap[k] as number));
    return n >= 0 ? n : null;
  }
  if (
    typeof schema.variantsBundleTokens === "number" &&
    Number.isFinite(schema.variantsBundleTokens)
  ) {
    return Math.max(0, Math.ceil(schema.variantsBundleTokens));
  }
  return null;
}

/**
 * Целые списания по вариантам, сумма = totalCredits.
 */
export function allocateCreditsAcrossVariants(totalCredits: number, variantCount: number): number[] {
  const n = Math.min(12, Math.max(1, Math.round(variantCount)));
  const t = Math.max(0, Math.round(totalCredits));
  if (n <= 1) return [t];
  const base = Math.floor(t / n);
  const rem = t - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

/** Итого за витрину + распределение списания по задачам. */
export function resolveMarketplaceVariantBundleTotals(
  model: AiModel,
  variantCount: number,
  perVariant: ProductCardPriceBreakdown,
): {
  totalCredits: number;
  allocations: number[];
  bundleCredits: number | null;
  singleVariantCredits: number;
  formulaAddon: string;
  priceBreakdown: ProductCardPriceBreakdown;
} {
  const schema = schemaOf(model);
  const vc = Math.min(12, Math.max(1, Math.round(variantCount)));
  const single = Math.max(0, Math.round(perVariant.credits));

  let bundleCredits: number | null = resolveBundleCreditsFromSchema(schema, vc);
  if (vc <= 1) {
    bundleCredits = null;
  }

  const totalCredits =
    bundleCredits != null ? bundleCredits : single * vc;
  const formulaAddon =
    bundleCredits != null
      ? `variants bundle (n=${vc}): total=${bundleCredits}`
      : `variants linear: ${single} * ${vc} = ${totalCredits}`;

  const allocations = allocateCreditsAcrossVariants(totalCredits, vc);

  const perCredRev =
    perVariant.credits > 0 ? perVariant.revenueKzt / perVariant.credits : 0;
  const perCredUsd =
    perVariant.credits > 0 ? perVariant.providerCostUsd / perVariant.credits : 0;
  const kUsd =
    perVariant.providerCostUsd > 0 ? perVariant.providerCostKzt / perVariant.providerCostUsd : 0;

  const revenueKzt =
    Math.round(perCredRev * totalCredits * 100) / 100;
  const providerCostUsd =
    Math.round(perCredUsd * totalCredits * 100_000) / 100_000;
  const providerCostKzt =
    Math.round(providerCostUsd * kUsd * 100) / 100;
  const marginKzt = Math.round((revenueKzt - providerCostKzt) * 100) / 100;
  const marginPercent =
    revenueKzt > 0
      ? Math.round(((marginKzt / revenueKzt) * 100) * 100) / 100
      : null;

  const priceBreakdown: ProductCardPriceBreakdown = {
    ...perVariant,
    v: 2,
    credits: totalCredits,
    tokens: totalCredits,
    variantCount: vc,
    singleVariantCredits: single,
    bundleCredits,
    totalCredits,
    variantAllocations: allocations,
    formula: `${perVariant.formula}; ${formulaAddon}`,
    revenueKzt,
    providerCostUsd,
    providerCostKzt,
    marginKzt,
    marginPercent,
  };

  return {
    totalCredits,
    allocations,
    bundleCredits,
    singleVariantCredits: single,
    formulaAddon,
    priceBreakdown,
  };
}

export async function calculateProductCardModelPrice(input: {
  model: AiModel;
  scenario: ProductCardPricingScenario;
  settings?: Record<string, unknown>;
}): Promise<ProductCardPriceBreakdown> {
  const settings = await getProductCardSettings();
  const modelSettings = input.settings ?? {};
  const schema = schemaOf(input.model);
  const warnings: string[] = [];
  const productCardSchema =
    schema?.pricingScope === "PRODUCT_CARD" && schema.type === "product_card_matrix";

  if (!productCardSchema) {
    warnings.push("Model pricingSchema is not PRODUCT_CARD/product_card_matrix.");
  }

  const keys = pickKeys(modelSettings);
  const manualEntry = productCardSchema ? entryForKeys(schema.manualOverrides, keys) : null;
  const matrixEntry = productCardSchema ? entryForKeys(schema.matrix, keys) : null;
  const entry = manualEntry ?? matrixEntry;

  let manualOverrideKey: string | null = null;
  if (manualEntry) {
    const mo = asRecord(schema?.manualOverrides);
    if (mo) {
      for (const k of keys) {
        if (asRecord(mo[k]) || typeof mo[k] === "number") {
          manualOverrideKey = k;
          break;
        }
      }
    }
  }

  const priceSource = manualEntry
    ? "manual_override"
    : matrixEntry
      ? "matrix"
      : productCardSchema
        ? "base"
        : "legacy_model_cost";

  const pinned = schema != null && isAdminPricingPinned(schema);

  const minTokens = scenarioMinTokens(input.scenario, settings, schema);
  const baseTokens = productCardSchema
    ? asNumber(schema.baseTokens ?? schema.fallbackTokens, input.model.costCredits)
    : input.model.costCredits;
  const entryTokens = entry ? asNumber(entry.tokens ?? entry.credits, baseTokens) : baseTokens;
  let multiplierMult = productCardSchema
    ? multiplierForSettings(schema.multipliers, modelSettings)
    : 1;

  const appliedStructured: Array<{ key: string; value: number }> = [];

  const cardSizeMul = multiplierFromNestedMap(schema?.cardSizeMultipliers, modelSettings.cardSize);
  if (cardSizeMul.hit) {
    multiplierMult *= cardSizeMul.value;
    appliedStructured.push({ key: `cardSize:${String(modelSettings.cardSize)}`, value: cardSizeMul.value });
  }
  const templateMul = multiplierFromNestedMap(
    schema?.templateMultipliers,
    modelSettings.templatePreset,
  );
  if (templateMul.hit) {
    multiplierMult *= templateMul.value;
    appliedStructured.push({
      key: `template:${String(modelSettings.templatePreset)}`,
      value: templateMul.value,
    });
  }

  const globalMul =
    typeof schema?.priceMultiplier === "number" && Number.isFinite(schema.priceMultiplier)
      ? Math.max(0.001, schema.priceMultiplier)
      : typeof schema?.priceMultiplier === "string" && Number(schema.priceMultiplier) > 0
        ? Number(schema.priceMultiplier)
        : 1;
  if (globalMul !== 1) appliedStructured.push({ key: "priceMultiplier", value: globalMul });

  const tokens = Math.max(
    minTokens,
    Math.ceil(entryTokens * multiplierMult * globalMul),
  );

  const providerCostUsd = entry
    ? asNumber(entry.providerCostUsd ?? entry.providerCost, asNumber(schema?.providerCostUsd ?? schema?.providerCost, 0))
    : asNumber(schema?.providerCostUsd ?? schema?.providerCost, 0);
  const providerCostKzt = providerCostUsd * settings.usdToKzt;

  const formulaBase = `${priceSource}: max(${minTokens}, ceil(${entryTokens} * mult${globalMul !== 1 ? ` * pm=${globalMul}` : ""}))`;
  const revenueKzt = tokens * settings.tokenValueKzt;
  const marginKzt = revenueKzt - providerCostKzt;
  const marginPercent = revenueKzt > 0 ? (marginKzt / revenueKzt) * 100 : null;

  if (!settings.allowNegativeMargin && marginKzt < 0) {
    warnings.push("Negative margin is not allowed for Product Card pricing.");
  } else if (
    marginPercent != null &&
    marginPercent < settings.lowMarginWarningPercent
  ) {
    warnings.push("Product Card margin is below warning threshold.");
  }

  return {
    v: 2,
    pricingScope: "PRODUCT_CARD",
    scenario: input.scenario,
    productCardModelType: input.model.productCardModelType,
    modelId: input.model.id,
    modelSlug: input.model.slug,
    modelName: input.model.name,
    credits: tokens,
    tokens,
    providerCostUsd,
    providerCostKzt,
    revenueKzt,
    marginKzt,
    marginPercent,
    priceSource,
    formula: `${formulaBase} where mult=${multiplierMult}`,
    warnings,
    manualOverrideKey,
    adminPricingPinned: pinned,
    appliedMultipliers:
      appliedStructured.length > 0 ? appliedStructured : undefined,
    variantCount: 1,
    singleVariantCredits: tokens,
    bundleCredits: null,
    totalCredits: tokens,
    variantAllocations: [tokens],
  };
}

export function assertProductCardPriceAllowed(price: ProductCardPriceBreakdown): void {
  if (price.warnings.includes("Negative margin is not allowed for Product Card pricing.")) {
    throw new Error("Цена Product Card ниже себестоимости. Измените pricing или разрешите отрицательную маржу.");
  }
}

export function calculateProductCardConceptImageCredits(
  model: AiModel,
  settings?: Record<string, unknown>,
): Promise<ProductCardPriceBreakdown> {
  return calculateProductCardModelPrice({
    model,
    scenario: "concept_image",
    settings,
  });
}

export function calculateProductCardMarketplaceCardCredits(
  model: AiModel,
  settings?: Record<string, unknown>,
): Promise<ProductCardPriceBreakdown> {
  return calculateProductCardModelPrice({
    model,
    scenario: "marketplace_card",
    settings,
  });
}

export function calculateProductCardVideoCredits(
  model: AiModel,
  settings?: Record<string, unknown>,
): Promise<ProductCardPriceBreakdown> {
  return calculateProductCardModelPrice({
    model,
    scenario: "video",
    settings,
  });
}

```

## `src/config/generation-models.ts`
```ts
/**
 * Каталог моделей генерации (метаданные UI + задачи).
 * Данные о цене и активности дополняются из БД (AiModel), см. mergeGenerationCatalog.
 */

export type GenerationTaskId =
  | "text_to_image"
  | "image_to_image"
  | "image_editing"
  | "product_card"
  | "text_to_video"
  | "image_to_video"
  | "video_to_video"
  | "video_editing"
  | "lip_sync"
  | "chat"
  | "product_analysis"
  | "prompt_helper";

/** Группа в левой панели фильтров */
export type GenerationTaskFilterGroupId =
  | "image"
  | "video"
  | "chat";

export type GenerationModelCategory =
  | "image"
  | "video"
  | "product_card"
  | "chat";

export type GenerationModelOpenBehavior =
  | { kind: "image"; querySlug: string }
  | { kind: "video"; querySlug: string }
  | { kind: "product_card" }
  | { kind: "detail_only" }; /// страница /dashboard/models/[catalogSlug]

export const TASK_LABELS_RU: Record<GenerationTaskId, string> = {
  text_to_image: "Текст → изображение",
  image_to_image: "Изображение → изображение",
  image_editing: "Редактирование изображения",
  product_card: "Карточка товара",
  text_to_video: "Текст → видео",
  image_to_video: "Изображение → видео",
  video_to_video: "Видео → видео",
  video_editing: "Редактирование видео",
  lip_sync: "Lip Sync",
  chat: "Чат",
  product_analysis: "Анализ товара",
  prompt_helper: "Помощник промптов",
};

/** Секции фильтров (как Kie.ai): id задачи → label */
export const TASK_FILTER_GROUPS: {
  title: string;
  groupId: GenerationTaskFilterGroupId;
  items: { id: GenerationTaskId; label: string }[];
}[] = [
  {
    title: "Изображения",
    groupId: "image",
    items: [
      { id: "text_to_image", label: TASK_LABELS_RU.text_to_image },
      { id: "image_to_image", label: TASK_LABELS_RU.image_to_image },
      { id: "image_editing", label: TASK_LABELS_RU.image_editing },
      { id: "product_card", label: TASK_LABELS_RU.product_card },
    ],
  },
  {
    title: "Видео",
    groupId: "video",
    items: [
      { id: "text_to_video", label: TASK_LABELS_RU.text_to_video },
      { id: "image_to_video", label: TASK_LABELS_RU.image_to_video },
      { id: "video_to_video", label: TASK_LABELS_RU.video_to_video },
      { id: "video_editing", label: TASK_LABELS_RU.video_editing },
      { id: "lip_sync", label: TASK_LABELS_RU.lip_sync },
    ],
  },
  {
    title: "Чат / промпты",
    groupId: "chat",
    items: [
      { id: "chat", label: TASK_LABELS_RU.chat },
      { id: "product_analysis", label: TASK_LABELS_RU.product_analysis },
      { id: "prompt_helper", label: TASK_LABELS_RU.prompt_helper },
    ],
  },
];

/** Статический каталог «витрины» — приоритетные карточки + структура для merge с БД */
export type CatalogModelDefinition = {
  /** URL /dashboard/models/[catalogSlug], поиск по витрине */
  catalogSlug: string;
  /** Имя без БД — подставится из записи AiModel если найден primaryDbSlug */
  displayName: string;
  /** Бренд в UI — если из БД, можно переопределить providerLabel в merge */
  providerLabel: string;
  descriptionFallback: string;
  tasks: GenerationTaskId[];
  category: GenerationModelCategory;
  openBehavior: GenerationModelOpenBehavior;
  /** Сопоставление с AiModel.slug (первая найденная в БД запись побеждает) */
  dbSlugCandidates: string[];
  /**
   * Все slug одной «семьи»: при merge считаются одной витринной карточкой и не дают второй строки хвоста.
   */
  familyDbSlugCandidates?: string[];
  /**
   * Slug для ?model= при открытии create flow — обычно короткий (как в ТЗ).
   * Должен мапиться на первую активную модель с одним из dbSlugCandidates через alias map.
   */
  urlSlugForGenerator?: string;
  /** CSS gradient для карточки без превью */
  gradientClass: string;
  /**
   * Каталог: кнопка «Открыть» ведёт на /dashboard/models/[slug] (хаб с режимами),
   * а не сразу на общую форму create/image|video.
   */
  catalogOpenIsModelHub?: boolean;
  /**
   * Не показывать карточку на /dashboard/models (общий каталог).
   * Сценарии карточки товара остаются в /dashboard/create/product-card.
   */
  hideFromModelsCatalog?: boolean;
};

const GPT_IMAGE_2_FAMILY_VARIANTS: readonly {
  slug: string;
  optionLabel: string;
}[] = [
  {
    slug: "gpt-image-2-text-to-image-general",
    optionLabel: "Текст → изображение",
  },
  {
    slug: "gpt-image-2-image-to-image",
    optionLabel: "Изображение → изображение",
  },
];

const GPT_IMAGE_2_FAMILY_SLUGS = GPT_IMAGE_2_FAMILY_VARIANTS.map((v) => v.slug);

/** Группы в селекторе «Создать фото» (одна папка — несколько AiModel). */
export type ImageCreateModelGroupSpec = {
  label: string;
  variants: readonly { slug: string; optionLabel: string }[];
};

export const IMAGE_CREATE_MODEL_GROUPS: ImageCreateModelGroupSpec[] = [
  { label: "GPT Image 2", variants: GPT_IMAGE_2_FAMILY_VARIANTS },
];

export const GENERATION_MODEL_CATALOG: CatalogModelDefinition[] = [
  {
    catalogSlug: "gpt-image-2",
    displayName: "GPT Image 2",
    providerLabel: "OpenAI",
    descriptionFallback:
      "Генерация и редактирование изображений для товаров, рекламы и карточек.",
    tasks: ["text_to_image", "image_to_image", "image_editing"],
    category: "image",
    dbSlugCandidates: [...GPT_IMAGE_2_FAMILY_SLUGS],
    familyDbSlugCandidates: [...GPT_IMAGE_2_FAMILY_SLUGS],
    urlSlugForGenerator: "gpt-image-2",
    openBehavior: { kind: "image", querySlug: "gpt-image-2" },
    catalogOpenIsModelHub: true,
    gradientClass:
      "from-sky-500/90 via-blue-600/85 to-indigo-700/90",
  },
  {
    catalogSlug: "product-card-suite",
    displayName: "Product Card Image",
    providerLabel: "OpenAI · QazCard AI",
    descriptionFallback:
      "Поток карточки товара: классификация, концепты, маркетплейс и видео.",
    tasks: ["product_card", "image_to_image"],
    category: "product_card",
    dbSlugCandidates: [],
    openBehavior: { kind: "product_card" },
    hideFromModelsCatalog: true,
    gradientClass:
      "from-cyan-500/85 via-sky-500/80 to-blue-600/90",
  },
  {
    catalogSlug: "seedance-2",
    displayName: "Seedance 2.0",
    providerLabel: "ByteDance",
    descriptionFallback:
      "Видео по тексту, first/last frame, референсы изображений/видео/аудио (Kie: bytedance/seedance-2).",
    tasks: ["text_to_video", "image_to_video", "lip_sync"],
    category: "video",
    dbSlugCandidates: ["seedance-2-0"],
    urlSlugForGenerator: "seedance-2",
    openBehavior: { kind: "video", querySlug: "seedance-2" },
    gradientClass:
      "from-violet-500/88 via-purple-600/85 to-fuchsia-700/88",
  },
  {
    catalogSlug: "seedance-2-fast",
    displayName: "Seedance 2.0 Fast",
    providerLabel: "ByteDance",
    descriptionFallback:
      "Более быстрый режим той же линейки API (Kie: bytedance/seedance-2-fast).",
    tasks: ["text_to_video", "image_to_video", "lip_sync"],
    category: "video",
    dbSlugCandidates: ["seedance-2-0-fast"],
    urlSlugForGenerator: "seedance-2-fast",
    openBehavior: { kind: "video", querySlug: "seedance-2-fast" },
    gradientClass:
      "from-violet-500/82 via-purple-500/78 to-pink-600/82",
  },
  {
    catalogSlug: "seedance-1-5-pro",
    displayName: "Seedance 1.5 Pro",
    providerLabel: "ByteDance",
    descriptionFallback:
      "Видео Kie Market: bytedance/seedance-1.5-pro (сценарии и поля как у Seedance 2.0).",
    tasks: ["text_to_video", "image_to_video", "lip_sync"],
    category: "video",
    dbSlugCandidates: ["seedance-1-5-pro"],
    urlSlugForGenerator: "seedance-1-5-pro",
    openBehavior: { kind: "video", querySlug: "seedance-1-5-pro" },
    gradientClass:
      "from-fuchsia-500/85 via-violet-600/82 to-indigo-700/88",
  },
  {
    catalogSlug: "kling-3",
    displayName: "Kling 3.0",
    providerLabel: "Kuaishou",
    descriptionFallback:
      "Качественное видео из изображения и текста; режимы Kling 3.0, Kling 3.0 Video и Motion Control.",
    tasks: ["image_to_video", "text_to_video", "video_to_video"],
    category: "video",
    dbSlugCandidates: [
      "kling-3-0",
      "kling-3-0-video",
      "kling-3-0-motion-control",
    ],
    familyDbSlugCandidates: [
      "kling-3-0",
      "kling-3-0-video",
      "kling-3-0-motion-control",
    ],
    urlSlugForGenerator: "kling",
    openBehavior: { kind: "video", querySlug: "kling" },
    catalogOpenIsModelHub: true,
    gradientClass:
      "from-orange-500/87 via-rose-500/82 to-red-700/85",
  },
  {
    catalogSlug: "kling-2-6",
    displayName: "Kling 2.6",
    providerLabel: "Kuaishou",
    descriptionFallback:
      "Видео по тексту и из изображения (Kie: kling-2.6/text-to-video и kling-2.6/image-to-video). Поля как у Kling 3.0.",
    tasks: ["text_to_video", "image_to_video"],
    category: "video",
    dbSlugCandidates: [
      "kling-2-6-text-to-video",
      "kling-2-6-image-to-video",
    ],
    familyDbSlugCandidates: [
      "kling-2-6-text-to-video",
      "kling-2-6-image-to-video",
    ],
    urlSlugForGenerator: "kling-2-6",
    openBehavior: { kind: "video", querySlug: "kling-2-6" },
    catalogOpenIsModelHub: true,
    gradientClass:
      "from-amber-500/86 via-orange-600/83 to-rose-700/86",
  },
  {
    catalogSlug: "wan-2-7",
    displayName: "Wan 2.7",
    providerLabel: "Alibaba",
    descriptionFallback:
      "Wan 2.7: текст → видео, изображение → видео, reference → video и редактирование видео по Kie.",
    tasks: ["text_to_video", "image_to_video", "video_to_video", "video_editing"],
    category: "video",
    dbSlugCandidates: [
      "wan-2-7-text-to-video",
      "wan-2-7-image-to-video",
      "wan-2-7-r2v",
      "wan-2-7-videoedit",
    ],
    familyDbSlugCandidates: [
      "wan-2-7-text-to-video",
      "wan-2-7-image-to-video",
      "wan-2-7-r2v",
      "wan-2-7-videoedit",
    ],
    urlSlugForGenerator: "wan-2-7",
    openBehavior: { kind: "video", querySlug: "wan-2-7" },
    catalogOpenIsModelHub: true,
    gradientClass:
      "from-emerald-500/86 via-teal-600/84 to-cyan-700/87",
  },
  {
    catalogSlug: "wan-2-6",
    displayName: "Wan 2.6",
    providerLabel: "Alibaba",
    descriptionFallback:
      "Wan 2.6: текст → видео, изображение → видео и видео → видео по Kie.",
    tasks: ["text_to_video", "image_to_video", "video_to_video", "video_editing"],
    category: "video",
    dbSlugCandidates: [
      "wan-2-6-text-to-video",
      "wan-2-6-image-to-video",
      "wan-2-6-video-to-video",
    ],
    familyDbSlugCandidates: [
      "wan-2-6-text-to-video",
      "wan-2-6-image-to-video",
      "wan-2-6-video-to-video",
    ],
    urlSlugForGenerator: "wan-2-6",
    openBehavior: { kind: "video", querySlug: "wan-2-6" },
    catalogOpenIsModelHub: true,
    gradientClass:
      "from-teal-500/85 via-cyan-600/82 to-emerald-800/85",
  },
  {
    catalogSlug: "grok-imagine",
    displayName: "Grok Imagine",
    providerLabel: "xAI",
    descriptionFallback:
      "Grok Imagine: генерация и редактирование изображений, текст → видео и изображение → видео через Kie.",
    tasks: ["text_to_image", "image_to_image", "image_editing", "text_to_video", "image_to_video"],
    category: "image",
    dbSlugCandidates: [
      "grok-imagine-text-to-image",
      "grok-imagine-image-to-image",
      "grok-imagine-text-to-video",
      "grok-imagine-image-to-video",
    ],
    familyDbSlugCandidates: [
      "grok-imagine-text-to-image",
      "grok-imagine-image-to-image",
      "grok-imagine-text-to-video",
      "grok-imagine-image-to-video",
    ],
    urlSlugForGenerator: "grok-imagine",
    openBehavior: { kind: "image", querySlug: "grok-imagine" },
    catalogOpenIsModelHub: true,
    gradientClass:
      "from-slate-600/85 via-zinc-700/82 to-neutral-900/88",
  },
  {
    catalogSlug: "hailuo-2-3",
    displayName: "Hailuo 2.3",
    providerLabel: "MiniMax",
    descriptionFallback:
      "Hailuo 2.3 Image→Video: Standard и Pro режимы Kie для анимации изображения.",
    tasks: ["image_to_video"],
    category: "video",
    dbSlugCandidates: [
      "hailuo-2-3-image-to-video-standard",
      "hailuo-2-3-image-to-video-pro",
    ],
    familyDbSlugCandidates: [
      "hailuo-2-3-image-to-video-standard",
      "hailuo-2-3-image-to-video-pro",
    ],
    urlSlugForGenerator: "hailuo-2-3",
    openBehavior: { kind: "video", querySlug: "hailuo-2-3" },
    catalogOpenIsModelHub: true,
    gradientClass:
      "from-indigo-600/87 via-violet-600/85 to-purple-900/88",
  },
  {
    catalogSlug: "sora-2-pro-storyboard",
    displayName: "Sora 2 Pro · Storyboard",
    providerLabel: "OpenAI (Kie)",
    descriptionFallback:
      "Видео по сценарию из кадров с длительностями (Kie: sora-2-pro-storyboard): shots, n_frames 10/15/25 с.",
    tasks: ["text_to_video", "image_to_video"],
    category: "video",
    dbSlugCandidates: ["sora-2-pro-storyboard"],
    urlSlugForGenerator: "sora-2-storyboard",
    openBehavior: { kind: "video", querySlug: "sora-2-storyboard" },
    gradientClass:
      "from-violet-500/88 via-fuchsia-600/85 to-pink-700/90",
  },
  {
    catalogSlug: "veo-3-1",
    displayName: "Google Veo 3.1",
    providerLabel: "Google (Kie)",
    descriptionFallback:
      "Google Veo 3.1: генерация видео, extend и получение 4K/1080p результата через Kie.",
    tasks: ["text_to_video", "image_to_video", "video_to_video", "video_editing"],
    category: "video",
    dbSlugCandidates: [
      "veo-3-1",
      "veo-extend",
      "veo-get-4k-video",
      "veo-get-1080p-video",
    ],
    familyDbSlugCandidates: [
      "veo-3-1",
      "veo-extend",
      "veo-get-4k-video",
      "veo-get-1080p-video",
    ],
    urlSlugForGenerator: "veo-3-1",
    openBehavior: { kind: "video", querySlug: "veo-3-1" },
    catalogOpenIsModelHub: true,
    gradientClass:
      "from-emerald-500/86 via-teal-600/84 to-cyan-800/88",
  },
  {
    catalogSlug: "happyhorse-1-0",
    displayName: "Happy Horse 1.0",
    providerLabel: "Alibaba ATH",
    descriptionFallback:
      "Текст → видео, изображение → видео, по референсам и редактирование готового ролика (загрузки с компьютера).",
    tasks: ["text_to_video", "image_to_video", "video_editing"],
    category: "video",
    dbSlugCandidates: ["happyhorse-1-0"],
    urlSlugForGenerator: "happyhorse",
    openBehavior: { kind: "video", querySlug: "happyhorse" },
    gradientClass:
      "from-amber-500/88 via-orange-600/85 to-rose-700/88",
  },
  {
    catalogSlug: "gemini-product-helper",
    displayName: "Gemini / Vision Helper",
    providerLabel: "Google",
    descriptionFallback:
      "Анализ товара по фото и подсказки для промптов в потоке карточки товара.",
    tasks: ["product_analysis", "prompt_helper", "chat"],
    category: "chat",
    dbSlugCandidates: ["gemini-2-5-flash-classifier"],
    openBehavior: { kind: "detail_only" },
    hideFromModelsCatalog: true,
    gradientClass:
      "from-blue-500/85 via-sky-400/78 to-indigo-600/88",
  },
];

/** Карта короткий slug (?model=) → канонический slug в БД (первая из dbSlugCandidates) */
export function buildModelSlugAliasMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const def of GENERATION_MODEL_CATALOG) {
    if (def.urlSlugForGenerator && def.dbSlugCandidates[0]) {
      map[def.urlSlugForGenerator] = def.dbSlugCandidates[0];
    }
  }
  // Явные алиасы без отдельного catalog entry (например motion control)
  map["kling-motion"] = "kling-3-0-motion-control";
  map["kling-3-video"] = "kling-3-0-video";
  map["kling-2.6"] = "kling-2-6-text-to-video";
  map["kling-2-6-t2v"] = "kling-2-6-text-to-video";
  map["kling-2-6-i2v"] = "kling-2-6-image-to-video";
  map.seedance = "seedance-2-0";
  map["seedance-fast"] = "seedance-2-0-fast";
  map["seedance-1.5"] = "seedance-1-5-pro";
  map.wan = "wan-2-7-text-to-video";
  map["wan-2-7-i2v"] = "wan-2-7-image-to-video";
  map["wan-2-7-r2v"] = "wan-2-7-r2v";
  map["wan-2-7-edit"] = "wan-2-7-videoedit";
  map["wan-2-6"] = "wan-2-6-text-to-video";
  map["wan-2-6-i2v"] = "wan-2-6-image-to-video";
  map["wan-2-6-v2v"] = "wan-2-6-video-to-video";
  map["happyhorse-1"] = "happyhorse-1-0";
  map["grok-imagine"] = "grok-imagine-text-to-image";
  map["grok-imagine-t2i"] = "grok-imagine-text-to-image";
  map["grok-imagine-i2i"] = "grok-imagine-image-to-image";
  map["grok-imagine-t2v"] = "grok-imagine-text-to-video";
  map["grok-imagine-i2v"] = "grok-imagine-image-to-video";
  map["hailuo-2-3"] = "hailuo-2-3-image-to-video-standard";
  map["hailuo-2-3-standard"] = "hailuo-2-3-image-to-video-standard";
  map["hailuo-2-3-pro"] = "hailuo-2-3-image-to-video-pro";
  map["sora-storyboard"] = "sora-2-pro-storyboard";
  map.veo = "veo-3-1";
  map["veo-extend"] = "veo-extend";
  map["veo-get-4k"] = "veo-get-4k-video";
  map["veo-get-1080p"] = "veo-get-1080p-video";
  map["gpt-image-2-text-to-image"] = "gpt-image-2-text-to-image-general";
  return map;
}

export const MODEL_SLUG_ALIASES: Record<string, string> =
  buildModelSlugAliasMap();

```

## `src/config/product-card-overlay-presets.ts`
```ts
export type ProductCardCanvasId = "square" | "story" | "vertical" | "banner";

export type ProductCardTemplatePresetId =
  | "dark_infographic"
  | "light_marketplace"
  | "promo_poster"
  | "lifestyle_model"
  | "clean_catalog"
  | "feature_grid"
  /** Внутренние fallback-раскладки (не в пикере UI) */
  | "feature_grid_compact"
  | "clean_catalog_compact"
  | "minimal_top_bottom"
  | "minimal_promo"
  | "bottom_chips";

export type ProductCardTypographyPresetId =
  | "classic"
  | "premium"
  | "marketplace"
  | "minimalism"
  | "fashion";

export type ProductCardCanvas = {
  id: ProductCardCanvasId;
  label: string;
  width: number;
  height: number;
  aspectRatio: string;
  overlayPresetSuffix: "square" | "story" | "vertical" | "banner";
  supportedTemplates: ProductCardTemplatePresetId[];
};

export type ProductCardTemplatePreset = {
  id: ProductCardTemplatePresetId;
  label: string;
  description: string;
  aiStyle: string;
  backgroundStyle: string;
  compositionInstruction: string;
  theme: "dark" | "light" | "promo" | "minimal" | "lifestyle" | "grid";
  accentColor: string;
  panelFill: string;
  panelStroke: string;
  textColor: string;
  mutedTextColor: string;
  bestFor: string[];
  /** Если false — пресет только для серверных fallback-макетов, не показываем в форме пользователя */
  publicInPicker?: boolean;
};

export type ProductCardTypographyPreset = {
  id: ProductCardTypographyPresetId;
  label: string;
  titleFont: string;
  bodyFont: string;
  titleWeight: number;
  bodyWeight: number;
};

export type RectZone = { x: number; y: number; width: number; height: number };
export type PointZone = { x: number; y: number };

export type ProductCardLayoutPreset = {
  key: string;
  templatePreset: ProductCardTemplatePresetId;
  cardSize: ProductCardCanvasId;
  title: RectZone;
  subtitle: RectZone;
  productSafeArea: RectZone;
  benefits: RectZone[];
  badges: RectZone[];
  callouts: RectZone[];
  arrows: { from: PointZone; to: PointZone }[];
  footer: RectZone;
  padding: number;
  titleScale: number;
  bodyScale: number;
  smallScale: number;
};

export const PRODUCT_CARD_TEMPLATE_PRESETS: readonly ProductCardTemplatePreset[] = [
  {
    id: "dark_infographic",
    label: "Темная инфографика",
    description: "Темный фон, крупный заголовок, преимущества в контрастных плашках.",
    aiStyle: "dark premium infographic product scene, high contrast, dramatic studio light",
    backgroundStyle: "deep dark matte background with subtle gradients and premium contrast",
    compositionInstruction: "Keep product on the right or centered with clean left-side negative space for benefit cards.",
    theme: "dark",
    accentColor: "#38bdf8",
    panelFill: "rgba(3, 12, 24, 0.78)",
    panelStroke: "rgba(56, 189, 248, 0.46)",
    textColor: "#f8fafc",
    mutedTextColor: "#cbd5e1",
    bestFor: ["одежда", "аксессуары", "спорттовары", "техника", "зимние товары"],
  },
  {
    id: "light_marketplace",
    label: "Светлый маркетплейс",
    description: "Светлый фон, товар справа, чистые callout-блоки и тонкие линии.",
    aiStyle: "clean bright marketplace product card base, soft shadows, commercial clarity",
    backgroundStyle: "light white or pastel marketplace background with plenty of negative space",
    compositionInstruction: "Place product right side or center-right; leave top and side zones clean for callouts.",
    theme: "light",
    accentColor: "#00afca",
    panelFill: "rgba(255, 255, 255, 0.88)",
    panelStroke: "rgba(0, 175, 202, 0.32)",
    textColor: "#0c2d38",
    mutedTextColor: "#345b66",
    bestFor: ["косметика", "еда", "товары для дома", "аптечные товары", "упаковки"],
  },
  {
    id: "promo_poster",
    label: "Промо-постер",
    description: "Эмоциональный рекламный постер с акцентным цветом и нижней плашкой.",
    aiStyle: "bold promotional poster product scene, energetic accent color, advertising composition",
    backgroundStyle: "dynamic bright advertising background with color blocks and clean text-safe areas",
    compositionInstruction: "Make product large and emotional; leave bottom strip and title area clean for overlay.",
    theme: "promo",
    accentColor: "#facc15",
    panelFill: "rgba(255, 255, 255, 0.9)",
    panelStroke: "rgba(250, 204, 21, 0.6)",
    textColor: "#082f49",
    mutedTextColor: "#164e63",
    bestFor: ["Instagram", "Stories", "акции", "новинки", "fashion"],
  },
  {
    id: "lifestyle_model",
    label: "Lifestyle / на модели",
    description: "Lifestyle-сцена, минимум плашек, короткий список преимуществ.",
    aiStyle: "lifestyle advertising product scene, natural use case, premium social media look",
    backgroundStyle: "realistic lifestyle background with clean editorial negative space",
    compositionInstruction: "Use a model or lifestyle scene when appropriate; keep overlay areas minimal and clean.",
    theme: "lifestyle",
    accentColor: "#fb7185",
    panelFill: "rgba(255, 255, 255, 0.76)",
    panelStroke: "rgba(251, 113, 133, 0.36)",
    textColor: "#1f2937",
    mutedTextColor: "#4b5563",
    bestFor: ["одежда", "обувь", "аксессуары", "спорт", "fashion"],
  },
  {
    id: "clean_catalog",
    label: "Чистый каталог",
    description: "Белый/серый фон, товар по центру, минимум текста и аккуратные преимущества.",
    aiStyle: "minimal clean catalog product photography base, white or light gray background",
    backgroundStyle: "simple white or light gray catalog background with soft shadow",
    compositionInstruction: "Keep product centered and dominant; reserve bottom area for compact benefits.",
    theme: "minimal",
    accentColor: "#111827",
    panelFill: "rgba(255, 255, 255, 0.82)",
    panelStroke: "rgba(17, 24, 39, 0.16)",
    textColor: "#111827",
    mutedTextColor: "#4b5563",
    bestFor: ["маркетплейсы", "каталоги", "Kaspi", "Ozon", "WB"],
  },
  {
    id: "feature_grid",
    label: "Сетка преимуществ",
    description: "Товар в центре, 4 карточки преимуществ вокруг, понятная инфографика.",
    aiStyle: "structured product infographic base, centered product, clean feature grid zones",
    backgroundStyle: "clean technical infographic background with symmetrical negative spaces",
    compositionInstruction: "Place product in the center; keep four corner zones clean for feature cards.",
    theme: "grid",
    accentColor: "#7c3aed",
    panelFill: "rgba(255, 255, 255, 0.86)",
    panelStroke: "rgba(124, 58, 237, 0.34)",
    textColor: "#1e1b4b",
    mutedTextColor: "#4c1d95",
    bestFor: ["техника", "косметика", "БАДы", "характеристики", "функциональные товары"],
  },
  {
    id: "feature_grid_compact",
    label: "Сетка преимуществ (compact)",
    description: "Серверный fallback: узкая сетка без крупных полей.",
    aiStyle: "structured product infographic base, centered product, clean feature grid zones",
    backgroundStyle: "clean technical infographic background with symmetrical negative spaces",
    compositionInstruction: "Centered product; peripheral feature bands only, no heavy text regions on product.",
    theme: "grid",
    accentColor: "#7c3aed",
    panelFill: "rgba(255, 255, 255, 0.86)",
    panelStroke: "rgba(124, 58, 237, 0.34)",
    textColor: "#1e1b4b",
    mutedTextColor: "#4c1d95",
    bestFor: ["_strict_fallback"],
    publicInPicker: false,
  },
  {
    id: "clean_catalog_compact",
    label: "Чистый каталог (compact)",
    description: "Серверный fallback: компактные чипы преимуществ.",
    aiStyle: "minimal clean catalog product photography base, white or light gray background",
    backgroundStyle: "simple white or light gray catalog background with soft shadow",
    compositionInstruction: "Centered dominant product; only narrow bottom chip rows for overlays.",
    theme: "minimal",
    accentColor: "#111827",
    panelFill: "rgba(255, 255, 255, 0.82)",
    panelStroke: "rgba(17, 24, 39, 0.16)",
    textColor: "#111827",
    mutedTextColor: "#4b5563",
    bestFor: ["_strict_fallback"],
    publicInPicker: false,
  },
  {
    id: "minimal_top_bottom",
    label: "Minimal top/bottom",
    description: "Серверный fallback: заголовок сверху, чипы снизу, без стрелок.",
    aiStyle: "minimal clean marketplace product hero, generous negative margins top and bottom",
    backgroundStyle: "flat neutral backdrop with unobstructed hero product center",
    compositionInstruction:
      "Reserve top band for headline and subtitle only; reserve bottom gutter for compact chips — no overlays on hero product silhouette.",
    theme: "minimal",
    accentColor: "#0c4a6e",
    panelFill: "rgba(255, 255, 255, 0.82)",
    panelStroke: "rgba(15, 23, 42, 0.12)",
    textColor: "#0f172a",
    mutedTextColor: "#475569",
    bestFor: ["_strict_fallback"],
    publicInPicker: false,
  },
  {
    id: "minimal_promo",
    label: "Промо (minimal)",
    description: "Серверный fallback: промо-блоки упрощённые.",
    aiStyle: "bold promotional poster product scene without bitmap text banners",
    backgroundStyle: "dynamic advertising background",
    compositionInstruction: "Dominant hero; minimal peripheral zones for typography overlay only.",
    theme: "promo",
    accentColor: "#facc15",
    panelFill: "rgba(255, 255, 255, 0.9)",
    panelStroke: "rgba(250, 204, 21, 0.6)",
    textColor: "#082f49",
    mutedTextColor: "#164e63",
    bestFor: ["_strict_fallback"],
    publicInPicker: false,
  },
  {
    id: "bottom_chips",
    label: "Bottom chips",
    description: "Серверный fallback: преимущества одной строкой снизу.",
    aiStyle: "clean commercial product framing with unobstructed hero",
    backgroundStyle: "minimal catalog background",
    compositionInstruction:
      "Product dominant in upper two thirds; reserve only bottom stripe for slim benefit chips.",
    theme: "grid",
    accentColor: "#4338ca",
    panelFill: "rgba(255, 255, 255, 0.84)",
    panelStroke: "rgba(79, 70, 229, 0.32)",
    textColor: "#1e1b4b",
    mutedTextColor: "#312e81",
    bestFor: ["_strict_fallback"],
    publicInPicker: false,
  },
] as const;

export const PRODUCT_CARD_TYPOGRAPHY_PRESETS: readonly ProductCardTypographyPreset[] = [
  { id: "classic", label: "Классический", titleFont: "Noto Sans, DejaVu Sans, Arial, sans-serif", bodyFont: "Noto Sans, DejaVu Sans, Arial, sans-serif", titleWeight: 800, bodyWeight: 600 },
  { id: "premium", label: "Премиальный", titleFont: "Manrope, Noto Sans, DejaVu Sans, Arial, sans-serif", bodyFont: "Noto Sans, DejaVu Sans, Arial, sans-serif", titleWeight: 800, bodyWeight: 550 },
  { id: "marketplace", label: "Маркетплейс", titleFont: "Montserrat, Noto Sans, DejaVu Sans, Arial, sans-serif", bodyFont: "Noto Sans, DejaVu Sans, Arial, sans-serif", titleWeight: 800, bodyWeight: 600 },
  { id: "minimalism", label: "Минимализм", titleFont: "Noto Sans, DejaVu Sans, Arial, sans-serif", bodyFont: "Noto Sans, DejaVu Sans, Arial, sans-serif", titleWeight: 700, bodyWeight: 500 },
  { id: "fashion", label: "Fashion", titleFont: "Manrope, Noto Sans, DejaVu Sans, Arial, sans-serif", bodyFont: "Manrope, Noto Sans, DejaVu Sans, Arial, sans-serif", titleWeight: 800, bodyWeight: 600 },
] as const;

const SUPPORTED: ProductCardTemplatePresetId[] = [
  "dark_infographic",
  "light_marketplace",
  "promo_poster",
  "lifestyle_model",
  "clean_catalog",
  "feature_grid",
];

export const PRODUCT_CARD_CANVASES: readonly ProductCardCanvas[] = [
  { id: "square", label: "Квадрат 1000x1000", width: 1000, height: 1000, aspectRatio: "1:1", overlayPresetSuffix: "square", supportedTemplates: SUPPORTED },
  { id: "story", label: "Story 1080x1920", width: 1080, height: 1920, aspectRatio: "9:16", overlayPresetSuffix: "story", supportedTemplates: SUPPORTED },
  { id: "vertical", label: "Вертикальная 1200x1600", width: 1200, height: 1600, aspectRatio: "3:4", overlayPresetSuffix: "vertical", supportedTemplates: SUPPORTED },
  { id: "banner", label: "Баннер 1200x628", width: 1200, height: 628, aspectRatio: "16:9", overlayPresetSuffix: "banner", supportedTemplates: SUPPORTED },
] as const;

const TEMPLATE_BY_ID = new Map(PRODUCT_CARD_TEMPLATE_PRESETS.map((p) => [p.id, p]));
const TYPOGRAPHY_BY_ID = new Map(PRODUCT_CARD_TYPOGRAPHY_PRESETS.map((p) => [p.id, p]));
const CANVAS_BY_ID = new Map(PRODUCT_CARD_CANVASES.map((p) => [p.id, p]));

export function isProductCardTemplatePresetId(value: string): value is ProductCardTemplatePresetId {
  return TEMPLATE_BY_ID.has(value as ProductCardTemplatePresetId);
}

export function isProductCardTypographyPresetId(value: string): value is ProductCardTypographyPresetId {
  return TYPOGRAPHY_BY_ID.has(value as ProductCardTypographyPresetId);
}

export function getProductCardTemplatePreset(id: string | null | undefined): ProductCardTemplatePreset {
  return TEMPLATE_BY_ID.get((id ?? "") as ProductCardTemplatePresetId) ?? PRODUCT_CARD_TEMPLATE_PRESETS[0]!;
}

export function getProductCardTypographyPreset(id: string | null | undefined): ProductCardTypographyPreset {
  return TYPOGRAPHY_BY_ID.get((id ?? "") as ProductCardTypographyPresetId) ?? PRODUCT_CARD_TYPOGRAPHY_PRESETS[0]!;
}

export function resolveProductCardCanvas(cardSize: string | null | undefined): ProductCardCanvas {
  return CANVAS_BY_ID.get((cardSize ?? "") as ProductCardCanvasId) ?? PRODUCT_CARD_CANVASES[0]!;
}

export function getProductCardLayoutKey(
  templatePreset: string | null | undefined,
  cardSize: string | null | undefined,
): string {
  const template = getProductCardTemplatePreset(templatePreset);
  const canvas = resolveProductCardCanvas(cardSize);
  return `${template.id}_${canvas.overlayPresetSuffix}`;
}

function rect(x: number, y: number, width: number, height: number): RectZone {
  return { x, y, width, height };
}

function pt(x: number, y: number): PointZone {
  return { x, y };
}

export function getProductCardLayoutPreset(
  templatePreset: string | null | undefined,
  cardSize: string | null | undefined,
): ProductCardLayoutPreset {
  const template = getProductCardTemplatePreset(templatePreset);
  const canvas = resolveProductCardCanvas(cardSize);
  const story = canvas.id === "story";
  const key = getProductCardLayoutKey(template.id, canvas.id);
  const base = {
    key,
    templatePreset: template.id,
    cardSize: canvas.id,
    padding: story ? 70 : 48,
    titleScale: story ? 0.052 : 0.056,
    bodyScale: story ? 0.024 : 0.028,
    smallScale: story ? 0.019 : 0.021,
  } satisfies Omit<ProductCardLayoutPreset, "title" | "subtitle" | "productSafeArea" | "benefits" | "badges" | "callouts" | "arrows" | "footer">;

  if (template.id === "dark_infographic" || template.id === "light_marketplace") {
    return {
      ...base,
      // Заголовок: даем больше ширины и сдвигаем чуть ниже
      title: story ? rect(70, 120, 760, 220) : rect(58, 75, 580, 150),
      // Подзаголовок: сразу под заголовком
      subtitle: story ? rect(70, 350, 680, 92) : rect(58, 235, 500, 70),
      // Товар: сдвигаем правее, чтобы освободить левую часть
      productSafeArea: story ? rect(410, 500, 590, 930) : rect(490, 230, 450, 555),
      // Преимущества: делаем плашки шире и выше, как на референсе
      benefits: story 
        ? [rect(70, 520, 480, 130), rect(70, 670, 480, 130), rect(70, 820, 480, 130), rect(70, 970, 480, 130)] 
        : [rect(58, 352, 410, 96), rect(58, 468, 410, 96), rect(58, 584, 410, 96), rect(58, 700, 410, 96)],
      // Бейджи внизу
      badges: story ? [rect(70, 1548, 420, 76), rect(520, 1548, 420, 76)] : [rect(58, 858, 260, 58), rect(340, 858, 260, 58)],
      callouts: [],
      arrows: story ? [{ from: pt(560, 600), to: pt(700, 700) }, { from: pt(560, 880), to: pt(730, 930) }] : [{ from: pt(480, 400), to: pt(610, 395) }, { from: pt(480, 630), to: pt(620, 580) }],
      footer: story ? rect(70, 1660, 940, 130) : rect(58, 928, 884, 42),
    };
  }

  if (template.id === "feature_grid") {
    return {
      ...base,
      title: story ? rect(80, 100, 920, 200) : rect(80, 60, 840, 120),
      subtitle: story ? rect(120, 320, 840, 80) : rect(150, 190, 700, 50),
      productSafeArea: story ? rect(240, 550, 600, 700) : rect(360, 280, 280, 400),
      benefits: story 
        ? [rect(60, 450, 400, 140), rect(620, 450, 400, 140), rect(60, 1300, 400, 140), rect(620, 1300, 400, 140)] 
        : [rect(50, 300, 280, 120), rect(670, 300, 280, 120), rect(50, 500, 280, 120), rect(670, 500, 280, 120)],
      badges: story ? [rect(200, 1500, 680, 80)] : [rect(300, 750, 400, 60)],
      callouts: [],
      arrows: [],
      footer: story ? rect(80, 1700, 920, 100) : rect(80, 880, 840, 60),
    };
  }

  if (template.id === "clean_catalog") {
    return {
      ...base,
      title: story ? rect(80, 100, 920, 200) : rect(80, 60, 840, 120),
      subtitle: story ? rect(100, 320, 880, 80) : rect(100, 190, 800, 50),
      productSafeArea: story ? rect(140, 440, 800, 860) : rect(200, 260, 600, 440),
      benefits: story 
        ? [rect(80, 1360, 440, 100), rect(560, 1360, 440, 100), rect(80, 1480, 440, 100), rect(560, 1480, 440, 100)] 
        : [rect(80, 730, 400, 80), rect(520, 730, 400, 80), rect(80, 830, 400, 80), rect(520, 830, 400, 80)],
      badges: story ? [rect(240, 1620, 600, 80)] : [rect(300, 930, 400, 40)],
      callouts: [],
      arrows: [],
      footer: story ? rect(80, 1760, 920, 80) : rect(80, 970, 840, 30),
    };
  }

  if (template.id === "promo_poster") {
    return {
      ...base,
      title: story ? rect(70, 100, 940, 260) : rect(60, 60, 880, 160),
      subtitle: story ? rect(70, 380, 940, 80) : rect(60, 230, 880, 60),
      productSafeArea: story ? rect(150, 480, 860, 900) : rect(300, 310, 640, 460),
      benefits: story 
        ? [rect(70, 1420, 450, 100), rect(560, 1420, 450, 100), rect(70, 1540, 450, 100), rect(560, 1540, 450, 100)] 
        : [rect(60, 790, 280, 80), rect(360, 790, 280, 80), rect(660, 790, 280, 80)],
      badges: story ? [rect(70, 1680, 450, 80), rect(560, 1680, 450, 80)] : [rect(60, 890, 280, 50), rect(360, 890, 280, 50), rect(660, 890, 280, 50)],
      callouts: [],
      arrows: [],
      footer: story ? rect(70, 1800, 940, 80) : rect(60, 950, 880, 40),
    };
  }

  if (template.id === "lifestyle_model") {
    return {
      ...base,
      title: story ? rect(70, 100, 800, 200) : rect(60, 60, 640, 140),
      subtitle: story ? rect(70, 320, 700, 80) : rect(60, 210, 540, 60),
      productSafeArea: story ? rect(200, 420, 810, 980) : rect(300, 280, 640, 480),
      benefits: story 
        ? [rect(70, 1440, 450, 90), rect(560, 1440, 450, 90), rect(70, 1550, 450, 90)] 
        : [rect(60, 780, 280, 70), rect(360, 780, 280, 70), rect(660, 780, 280, 70)],
      badges: story ? [rect(70, 1680, 600, 80)] : [rect(60, 870, 400, 50)],
      callouts: [],
      arrows: [],
      footer: story ? rect(70, 1800, 940, 80) : rect(60, 940, 880, 40),
    };
  }

  if (template.id === "feature_grid_compact") {
    return {
      ...base,
      title: story ? rect(72, 90, 936, 160) : rect(72, 52, 856, 100),
      subtitle: story ? rect(90, 270, 900, 64) : rect(120, 162, 760, 44),
      productSafeArea: story ? rect(260, 480, 560, 720) : rect(380, 260, 240, 360),
      benefits: story
        ? [
            rect(44, 420, 360, 110),
            rect(676, 420, 360, 110),
            rect(44, 1320, 360, 110),
            rect(676, 1320, 360, 110),
          ]
        : [rect(42, 280, 250, 90), rect(708, 280, 250, 90), rect(42, 460, 250, 90), rect(708, 460, 250, 90)],
      badges: story ? [rect(220, 1500, 640, 64)] : [rect(340, 720, 320, 48)],
      callouts: [],
      arrows: [],
      footer: story ? rect(72, 1720, 936, 72) : rect(72, 860, 856, 48),
    };
  }

  if (template.id === "clean_catalog_compact") {
    return {
      ...base,
      title: story ? rect(80, 90, 920, 150) : rect(82, 52, 836, 95),
      subtitle: story ? rect(100, 260, 880, 64) : rect(100, 158, 800, 44),
      productSafeArea: story ? rect(150, 420, 780, 900) : rect(220, 250, 560, 420),
      benefits: story
        ? [
            rect(80, 1320, 430, 80),
            rect(570, 1320, 430, 80),
            rect(80, 1420, 430, 80),
            rect(570, 1420, 430, 80),
          ]
        : [rect(80, 698, 380, 64), rect(540, 698, 380, 64), rect(80, 778, 380, 64), rect(540, 778, 380, 64)],
      badges: story ? [rect(260, 1588, 560, 56)] : [rect(320, 858, 360, 36)],
      callouts: [],
      arrows: [],
      footer: story ? rect(84, 1700, 912, 48) : rect(82, 940, 836, 28),
    };
  }

  if (template.id === "minimal_top_bottom") {
    return {
      ...base,
      title: story ? rect(54, 96, 972, 150) : rect(52, 48, 896, 100),
      subtitle: story ? rect(54, 268, 972, 64) : rect(52, 158, 896, 56),
      productSafeArea: story ? rect(180, 400, 720, 1040) : rect(260, 240, 480, 520),
      benefits: story
        ? [
            rect(54, 1620, 498, 88),
            rect(570, 1620, 498, 88),
            rect(54, 1726, 498, 88),
          ]
        : [rect(52, 828, 448, 78), rect(520, 828, 428, 78)],
      badges: [],
      callouts: [],
      arrows: [],
      footer: story ? rect(54, 1840, 972, 48) : rect(52, 916, 896, 36),
    };
  }

  if (template.id === "minimal_promo") {
    return {
      ...base,
      title: story ? rect(70, 96, 940, 200) : rect(60, 52, 880, 120),
      subtitle: story ? rect(70, 310, 940, 64) : rect(60, 182, 880, 48),
      productSafeArea: story ? rect(160, 460, 840, 880) : rect(300, 280, 600, 420),
      benefits: story
        ? [rect(70, 1440, 460, 86), rect(550, 1440, 460, 86)]
        : [rect(60, 730, 420, 68), rect(520, 730, 420, 68)],
      badges: story ? [rect(300, 1560, 480, 56)] : [rect(360, 820, 280, 44)],
      callouts: [],
      arrows: [],
      footer: story ? rect(70, 1680, 940, 56) : rect(60, 896, 880, 36),
    };
  }

  if (template.id === "bottom_chips") {
    return {
      ...base,
      title: story ? rect(70, 96, 940, 160) : rect(70, 52, 860, 100),
      subtitle: story ? rect(70, 276, 940, 60) : rect(90, 164, 820, 44),
      productSafeArea: story ? rect(140, 420, 800, 1080) : rect(200, 240, 600, 480),
      benefits: story
        ? [rect(54, 1660, 328, 72), rect(402, 1660, 328, 72), rect(750, 1660, 276, 72)]
        : [rect(52, 780, 292, 64), rect(356, 780, 292, 64), rect(660, 780, 288, 64)],
      badges: [],
      callouts: [],
      arrows: [],
      footer: story ? rect(70, 1760, 940, 48) : rect(70, 858, 860, 40),
    };
  }

  return {
    ...base,
    title: story ? rect(70, 100, 940, 200) : rect(60, 60, 880, 140),
    subtitle: story ? rect(70, 320, 700, 80) : rect(60, 210, 500, 60),
    productSafeArea: story ? rect(400, 420, 610, 980) : rect(460, 280, 480, 500),
    benefits: story 
      ? [rect(70, 450, 310, 120), rect(70, 590, 310, 120), rect(70, 730, 310, 120), rect(70, 870, 310, 120)] 
      : [rect(60, 300, 380, 90), rect(60, 410, 380, 90), rect(60, 520, 380, 90), rect(60, 630, 380, 90)],
    badges: story ? [rect(70, 1500, 450, 80), rect(540, 1500, 450, 80)] : [rect(60, 800, 300, 60), rect(380, 800, 300, 60)],
    callouts: [],
    arrows: story ? [{ from: pt(400, 510), to: pt(600, 600) }, { from: pt(400, 790), to: pt(630, 840) }] : [{ from: pt(460, 345), to: pt(610, 370) }, { from: pt(460, 565), to: pt(620, 530) }],
    footer: story ? rect(70, 1650, 940, 100) : rect(60, 900, 880, 60),
  };
}

export function variantTemplatePresetAt(index: number): ProductCardTemplatePresetId {
  return SUPPORTED[((index % SUPPORTED.length) + SUPPORTED.length) % SUPPORTED.length]!;
}

export function variantTypographyPresetAt(index: number): ProductCardTypographyPresetId {
  const ids = PRODUCT_CARD_TYPOGRAPHY_PRESETS.map((p) => p.id);
  return ids[((index % ids.length) + ids.length) % ids.length]!;
}

export function getPublicProductCardTemplatePresets() {
  return PRODUCT_CARD_TEMPLATE_PRESETS.filter((p) => p.publicInPicker !== false).map(
    ({ id, label, description, bestFor }) => ({ id, label, description, bestFor }),
  );
}

export function getPublicProductCardTypographyPresets() {
  return PRODUCT_CARD_TYPOGRAPHY_PRESETS.map(({ id, label }) => ({ id, label }));
}

export const PRODUCT_CARD_TYPOGRAPHY_TEST_STRINGS = {
  ru: ["Стильные солнцезащитные очки", "Классический черный цвет", "Удобная посадка", "Премиум качество"],
  kk: ["Күннен қорғайтын көзілдірік", "Жеңіл жақтау", "Ыңғайлы отырады", "Премиум сапа", "Ә Ғ Қ Ң Ө Ұ Ү Һ І"],
} as const;

```

## `src/app/dashboard/models/page.tsx`
```tsx
import { redirect } from "next/navigation";

import { ModelsCatalogExplore } from "@/components/dashboard/models-catalog-explore";
import { PageHeader } from "@/components/layout/page-header";
import { prismaWhereForDashboardModelsCatalog } from "@/lib/ai-models-catalog-db";
import {
  mergeGenerationCatalog,
  visibleInModelsCatalog,
} from "@/lib/generation-models-catalog";
import { prisma } from "@/lib/prisma";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { getCreditsUiFloor } from "@/server/services/pricing";
import type { GenerationTaskId } from "@/config/generation-models";
import { TASK_FILTER_GROUPS } from "@/config/generation-models";

export const metadata = {
  title: "AI-модели — QazCard AI",
};

const TASK_IDS = new Set(
  TASK_FILTER_GROUPS.flatMap((g) => g.items.map((i) => i.id)),
);

function parseTaskParam(raw: string | string[] | undefined): GenerationTaskId[] {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (!s?.trim()) return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter((x): x is GenerationTaskId => TASK_IDS.has(x as GenerationTaskId));
}

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardModelsPage({ searchParams }: Props) {
  const current = await getFreshSessionUser();
  if (!current.ok) {
    redirect("/login?next=/dashboard/models");
  }

  const sp = (await searchParams) ?? {};
  const qRaw = sp.q ?? sp.search;
  const initialSearch =
    typeof qRaw === "string" ? qRaw : Array.isArray(qRaw) ? (qRaw[0] ?? "") : "";
  const initialTaskFilters = parseTaskParam(sp.task);

  const [dbRows, productMinRow] = await Promise.all([
    prisma.aiModel.findMany({
      where: prismaWhereForDashboardModelsCatalog(),
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        provider: true,
        type: true,
        scope: true,
        productCardModelType: true,
        costCredits: true,
        pricingSchema: true,
        description: true,
        isActive: true,
        supportsImageInput: true,
        supportsVideoInput: true,
      },
    }),
    prisma.aiModel.aggregate({
      where: { scope: "PRODUCT_CARD", isActive: true },
      _min: { costCredits: true },
    }),
  ]);

  const dbModels = dbRows.map((m) => {
    const { pricingSchema: _p, ...rest } = m;
    return {
      ...rest,
      creditsUiMin: getCreditsUiFloor(m),
    };
  });

  const productFlowMinCredits = productMinRow._min.costCredits ?? null;

  const models = visibleInModelsCatalog(
    mergeGenerationCatalog({
      dbModels,
      productFlowMinCredits,
    }),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        variant="qaz"
        title="AI-модели"
        description="Выберите модель для генерации изображений, видео или редактирования контента."
        breadcrumbs={[
          { label: "Кабинет", href: "/dashboard" },
          { label: "AI-модели" },
        ]}
      />
      <ModelsCatalogExplore
        key={[initialSearch, ...initialTaskFilters].join("|")}
        models={models}
        suppressTitleBlock
        initialSearch={initialSearch}
        initialTaskFilters={initialTaskFilters}
      />
    </div>
  );
}

```

## `src/components/dashboard/product-card/marketplace-card-tab.tsx`
```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LayoutList, Loader2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  IMAGE_GENERATION_POLL_INTERVAL_MS,
  IMAGE_GENERATION_POLL_MAX_ITERATIONS,
} from "@/lib/generation-client-polling";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PRODUCT_CARD_CANVASES,
  getPublicProductCardTemplatePresets,
  getPublicProductCardTypographyPresets,
  type ProductCardTemplatePresetId,
  type ProductCardTypographyPresetId,
} from "@/config/product-card-overlay-presets";
import { readJsonSafe } from "@/lib/fetch-json-safe";
import { getFirstOutputUrlFromJson } from "@/lib/product-card-output";
import { cn } from "@/lib/utils";

import { ProductCardTemplatePreview } from "./product-card-template-preview";
import {
  ProductCardVariantGallery,
  type ProductCardVariantGalleryItem,
} from "./product-card-variant-gallery";

const templates = getPublicProductCardTemplatePresets();
const typographyPresets = getPublicProductCardTypographyPresets();
const fallbackSizes = PRODUCT_CARD_CANVASES.filter((item) => item.id === "square" || item.id === "story");

function coerceEstimateCredits(value: unknown): number | null {
  const n =
    typeof value === "bigint"
      ? Number(value)
      : typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value.trim())
          : NaN;
  return Number.isFinite(n) ? Math.round(n) : null;
}

function coerceBalanceCredits(value: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function graphemeLen(s: string): number {
  return [...s.trim()].length;
}

type ConceptGenMeta = {
  generationId: string;
};

type GenPreview = {
  id: string;
  status: string;
  outputUrl: string | null;
};

type Props = {
  hasImage: boolean;
  canUseBackend: boolean;
  projectId: string | null;
  balanceCredits: number;
  cardSizePresets: { id: string; label: string; aspectRatio: string }[];
  canLayoutDebug?: boolean;
};

type GenerationMode = "marketplace_card" | "marketplace_card_variants";

function styleForTemplate(template: string): string {
  if (template === "dark_infographic" || template === "feature_grid") return "infographic";
  if (template === "promo_poster") return "bright_advertising";
  if (template === "lifestyle_model") return "premium";
  if (template === "clean_catalog") return "minimalist";
  return "clean_marketplace";
}

function terminal(status: string): boolean {
  return ["COMPLETED", "FAILED", "REFUNDED", "CANCELLED", "BLOCKED"].includes(status);
}

export function MarketplaceCardTab({
  hasImage,
  canUseBackend,
  projectId,
  balanceCredits,
  cardSizePresets,
  canLayoutDebug = false,
}: Props) {
  const balanceNum = coerceBalanceCredits(balanceCredits);
  const [sourceType, setSourceType] = useState<"original" | "concept_generation">("original");
  const [sourceGenerationId, setSourceGenerationId] = useState<string | null>(null);
  const [conceptRows, setConceptRows] = useState<ConceptGenMeta[]>([]);
  const [genPreviews, setGenPreviews] = useState<Record<string, GenPreview | undefined>>({});

  const [generationMode, setGenerationMode] = useState<GenerationMode>("marketplace_card");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [benefits, setBenefits] = useState("");
  const [extraText, setExtraText] = useState("");
  const [statsText, setStatsText] = useState("");
  const [sizeText, setSizeText] = useState("");
  const [userInstructions, setUserInstructions] = useState("");
  const [templatePreset, setTemplatePreset] = useState<ProductCardTemplatePresetId>("light_marketplace");
  const [typographyPreset, setTypographyPreset] = useState<ProductCardTypographyPresetId>("classic");
  const [cardSize, setCardSize] = useState(cardSizePresets[0]?.id ?? "square");
  const [useIcons, setUseIcons] = useState(true);
  const [useArrows, setUseArrows] = useState(true);
  const [useShadows, setUseShadows] = useState(true);
  const [previewLayoutDebug, setPreviewLayoutDebug] = useState(false);

  const [estimating, setEstimating] = useState(false);
  const [estimateCredits, setEstimateCredits] = useState<number | null>(null);
  const [perVariantCredits, setPerVariantCredits] = useState<number | null>(null);
  const [estimatedVariantCount, setEstimatedVariantCount] = useState(1);
  const [estErr, setEstErr] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [results, setResults] = useState<ProductCardVariantGalleryItem[]>([]);
  const [overlayPreview, setOverlayPreview] = useState<{
    svg: string;
    width: number;
    height: number;
    label: string;
  } | null>(null);

  const sizeOptions = useMemo(() => {
    const map = new Map<string, { id: string; label: string; aspectRatio: string }>();
    for (const preset of cardSizePresets) map.set(preset.id, preset);
    for (const preset of fallbackSizes) {
      if (!map.has(preset.id)) map.set(preset.id, { id: preset.id, label: preset.label, aspectRatio: preset.aspectRatio });
    }
    return [...map.values()];
  }, [cardSizePresets]);

  const [variantPackCount, setVariantPackCount] = useState<4 | 5 | 6>(6);
  const variantCount = generationMode === "marketplace_card_variants" ? variantPackCount : 1;
  const currentStyle = styleForTemplate(templatePreset);

  const canEstimate = useMemo(
    () =>
      Boolean(
        projectId &&
          canUseBackend &&
          (sourceType === "original" || (sourceType === "concept_generation" && sourceGenerationId)),
      ),
    [projectId, canUseBackend, sourceType, sourceGenerationId],
  );

  const loadProjectMeta = useCallback(async () => {
    if (!projectId) {
      setConceptRows([]);
      return;
    }
    const res = await fetch(`/api/product-card-projects/${projectId}`);
    const parsed = await readJsonSafe<{ project?: { metadata?: { conceptGenerations?: unknown } } }>(res);
    if (!parsed.ok || !res.ok) return;
    const list = parsed.data.project?.metadata?.conceptGenerations;
    const rows: ConceptGenMeta[] = Array.isArray(list)
      ? list
          .map((x) => {
            if (x && typeof x === "object" && "generationId" in x) {
              const g = (x as { generationId: unknown }).generationId;
              if (typeof g === "string" && g.trim()) return { generationId: g.trim() };
            }
            return null;
          })
          .filter((x): x is ConceptGenMeta => x != null)
      : [];
    setConceptRows(rows);
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !canUseBackend) return;
    void (async () => {
      await Promise.resolve();
      await loadProjectMeta();
    })();
  }, [projectId, canUseBackend, loadProjectMeta]);

  useEffect(() => {
    if (conceptRows.length === 0) {
      if (sourceType === "concept_generation") {
        void (async () => {
          await Promise.resolve();
          setSourceType("original");
          setSourceGenerationId(null);
        })();
      }
      return;
    }
    void (async () => {
      const next: Record<string, GenPreview> = {};
      for (const row of conceptRows) {
        const res = await fetch(`/api/generations/${row.generationId}`);
        const parsed = await readJsonSafe<{ status: string; outputFiles: unknown }>(res);
        if (parsed.ok && res.ok) {
          next[row.generationId] = {
            id: row.generationId,
            status: parsed.data.status,
            outputUrl: getFirstOutputUrlFromJson(parsed.data.outputFiles),
          };
        }
      }
      setGenPreviews((prev) => ({ ...prev, ...next }));
    })();
  }, [conceptRows, sourceType]);

  useEffect(() => {
    if (sourceType !== "concept_generation" || !conceptRows.length) return;
    const firstId = conceptRows[0]?.generationId;
    if (!firstId) return;
    if (!sourceGenerationId || !conceptRows.some((r) => r.generationId === sourceGenerationId)) {
      void (async () => {
        await Promise.resolve();
        setSourceGenerationId(firstId);
      })();
    }
  }, [sourceType, conceptRows, sourceGenerationId]);

  useEffect(() => {
    if (!canEstimate) return;
    let cancelled = false;
    void (async () => {
      setEstimating(true);
      setEstErr(null);
      const res = await fetch(`/api/product-card-projects/${projectId}/estimate/marketplace-card`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType,
          sourceGenerationId: sourceType === "original" ? null : sourceGenerationId,
          style: currentStyle,
          cardSize,
          generationMode,
          variantCount,
        }),
      });
      const parsed = await readJsonSafe<{
        credits?: number;
        perVariantCredits?: number;
        variantCount?: number;
        error?: string;
      }>(res);
      if (cancelled) return;
      if (!parsed.ok || !res.ok) {
        setEstErr(parsed.ok ? parsed.data.error ?? "Оценка недоступна" : parsed.message);
        setEstimateCredits(null);
        setPerVariantCredits(null);
        setEstimating(false);
        return;
      }
      setEstimateCredits(coerceEstimateCredits(parsed.data.credits));
      setPerVariantCredits(coerceEstimateCredits(parsed.data.perVariantCredits));
      setEstimatedVariantCount(typeof parsed.data.variantCount === "number" ? parsed.data.variantCount : variantCount);
      setEstimating(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [canEstimate, projectId, sourceType, sourceGenerationId, currentStyle, cardSize, generationMode, variantCount]);

  useEffect(() => {
    if (!projectId || !canUseBackend) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const res = await fetch(`/api/product-card-projects/${projectId}/preview/marketplace-card`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productTitle: title,
            subtitle,
            benefits,
            extraText,
            statsText,
            sizeText,
            style: currentStyle,
            cardSize,
            templatePreset,
            typographyPreset,
            useIcons,
            useArrows,
            useShadows,
            preserveProductLabel: false,
            layoutDebug: canLayoutDebug && previewLayoutDebug,
          }),
        });
        const parsed = await readJsonSafe<{ svg?: string; size?: { width?: number; height?: number; label?: string } }>(res);
        if (cancelled) return;
        if (!parsed.ok || !res.ok || typeof parsed.data.svg !== "string") {
          setOverlayPreview(null);
          return;
        }
        setOverlayPreview({
          svg: parsed.data.svg,
          width: typeof parsed.data.size?.width === "number" ? parsed.data.size.width : 1000,
          height: typeof parsed.data.size?.height === "number" ? parsed.data.size.height : 1000,
          label: parsed.data.size?.label ?? "Preview",
        });
      })();
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [projectId, canUseBackend, title, subtitle, benefits, extraText, statsText, sizeText, currentStyle, cardSize, templatePreset, typographyPreset, useIcons, useArrows, useShadows, canLayoutDebug, previewLayoutDebug]);

  const showEstimate = canEstimate;
  const creditsInt = showEstimate ? coerceEstimateCredits(estimateCredits) : null;
  const notEnough = creditsInt != null && balanceNum < creditsInt;
  const balanceAfter =
    creditsInt != null ? Math.max(0, balanceNum - creditsInt) : null;
  const canSubmit =
    showEstimate && !estimating && creditsInt != null && !estErr && !notEnough;

  async function pollGeneration(item: ProductCardVariantGalleryItem): Promise<ProductCardVariantGalleryItem> {
    let status = item.status || "QUEUED";
    let outputUrl = item.outputUrl;
    let errorMessage = item.errorMessage ?? null;
    for (let i = 0; i < IMAGE_GENERATION_POLL_MAX_ITERATIONS; i++) {
      const res = await fetch(`/api/generations/${item.generationId}`);
      const parsed = await readJsonSafe<{ status: string; outputFiles: unknown; errorMessage?: string | null }>(res);
      if (parsed.ok && res.ok) {
        status = parsed.data.status;
        outputUrl = getFirstOutputUrlFromJson(parsed.data.outputFiles) ?? outputUrl;
        errorMessage = parsed.data.errorMessage ?? errorMessage;
      }
      if (terminal(status) && (status !== "COMPLETED" || outputUrl)) break;
      if (i < IMAGE_GENERATION_POLL_MAX_ITERATIONS - 1) {
        await new Promise((r) => setTimeout(r, IMAGE_GENERATION_POLL_INTERVAL_MS));
      }
    }
    return { ...item, status, outputUrl, errorMessage };
  }

  const onSubmit = async () => {
    if (!projectId || !canUseBackend) return;
    setGenError(null);
    setResults([]);
    setGenerating(true);
    const benefitsList = benefits.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    try {
      const body = {
        sourceType,
        sourceGenerationId: sourceType === "original" ? null : sourceGenerationId,
        generationMode,
        variantCount,
        productTitle: title.trim(),
        subtitle: subtitle.trim(),
        benefits: benefitsList.length > 0 ? benefitsList : benefits.trim() || "",
        extraText: extraText.trim(),
        statsText: statsText.trim(),
        sizeText: sizeText.trim(),
        style: currentStyle,
        cardSize,
        templatePreset,
        typographyPreset,
        preserveProductLabel: false,
        useIcons,
        useArrows,
        useShadows,
        userInstructions: userInstructions.trim(),
        clientEstimateCredits: typeof estimateCredits === "number" ? estimateCredits : null,
      };
      const res = await fetch(`/api/product-card-projects/${projectId}/generate/marketplace-card`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const parsed = await readJsonSafe<{
        generationId?: string;
        generationIds?: string[];
        variants?: ProductCardVariantGalleryItem[];
        status?: string;
        costCredits?: number;
        error?: string;
        code?: string;
        reason?: string;
      }>(res);
      if (!parsed.ok) {
        setGenError(parsed.message);
        return;
      }
      if (!res.ok) {
        const detail = typeof parsed.data.reason === "string" && parsed.data.reason.trim() ? ` — ${parsed.data.reason}` : "";
        setGenError((parsed.data.error ?? "Ошибка") + detail);
        if (res.status === 409 && parsed.data.code === "PRICE_CHANGED") setEstimateCredits(null);
        return;
      }
      const initialItems: ProductCardVariantGalleryItem[] = Array.isArray(parsed.data.variants)
        ? parsed.data.variants.map((v) => ({ ...v, outputUrl: null }))
        : parsed.data.generationId
          ? [{
              generationId: parsed.data.generationId,
              status: parsed.data.status ?? "QUEUED",
              costCredits: parsed.data.costCredits ?? 0,
              outputUrl: null,
              templatePreset,
              typographyPreset,
              variantIndex: 0,
            }]
          : [];
      if (initialItems.length === 0) {
        setGenError("Нет generationId");
        return;
      }
      setResults(initialItems);
      const polled = await Promise.all(initialItems.filter((item) => !item.generationId.startsWith("failed-")).map(pollGeneration));
      const byId = new Map(polled.map((item) => [item.generationId, item]));
      setResults(initialItems.map((item) => byId.get(item.generationId) ?? item));
      void loadProjectMeta();
    } catch {
      setGenError("Сеть или сервер недоступен");
    } finally {
      setGenerating(false);
    }
  };

  if (!hasImage) {
    return (
      <Alert>
        <AlertTitle>Нет исходного фото</AlertTitle>
        <AlertDescription>Загрузите фото товара выше, чтобы открыть этот сценарий.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="border-primary/15">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <LayoutList className="size-5" />
          Карточка товара
        </CardTitle>
        <CardDescription>
          AI создаёт визуальную основу без текста, а QazCard AI накладывает финальные подписи, плашки, иконки и стрелки отдельно.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {canUseBackend && (
          <div className="space-y-3">
            <Label className="text-[#0C2D38]">Источник изображения</Label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant={sourceType === "original" ? "default" : "outline"} className="rounded-xl" onClick={() => { setSourceType("original"); setSourceGenerationId(null); }}>
                Исходные фото
              </Button>
              {conceptRows.length > 0 && (
                <Button type="button" size="sm" variant={sourceType === "concept_generation" ? "default" : "outline"} className="rounded-xl" onClick={() => setSourceType("concept_generation")}>
                  Сгенерированное фото
                </Button>
              )}
            </div>
            {conceptRows.length === 0 && <p className="text-xs text-[#4a6e7a]">Сначала создайте AI-фото во вкладке «Фото с концепциями».</p>}
            {sourceType === "concept_generation" && conceptRows.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {conceptRows.map((row) => {
                  const preview = genPreviews[row.generationId];
                  return (
                    <button key={row.generationId} type="button" onClick={() => setSourceGenerationId(row.generationId)} className={cn("rounded-2xl border-2 p-2 text-left text-xs transition-colors", sourceGenerationId === row.generationId ? "border-[#00AFCA] bg-[#F4FBFD]" : "border-[#B8DCE6] bg-white hover:border-[#00AFCA]/45")}>
                      <p className="break-all font-mono text-[#4a6e7a]">{row.generationId.slice(0, 12)}…</p>
                      {preview && <p className="mt-1 text-[#4a6e7a]">{preview.status}{preview.outputUrl ? "" : " · нет preview"}</p>}
                      {preview?.outputUrl && (
                        <div className="mt-2 max-h-24 overflow-hidden rounded-xl border border-[#B8DCE6] bg-white">
                          {/* eslint-disable-next-line @next/next/no-img-element -- remote URL */}
                          <img src={preview.outputUrl} alt="" className="max-h-24 w-full object-contain" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-[#0C2D38]">Тип генерации</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={generationMode === "marketplace_card" ? "default" : "outline"} className="rounded-xl" onClick={() => setGenerationMode("marketplace_card")}>Один вариант</Button>
            <Button type="button" size="sm" variant={generationMode === "marketplace_card_variants" ? "default" : "outline"} className="rounded-xl" onClick={() => setGenerationMode("marketplace_card_variants")}>Витрина (4–6 вариантов)</Button>
          </div>
        </div>

        {generationMode === "marketplace_card_variants" && (
          <div className="space-y-2">
            <Label className="text-[#0C2D38]">Сколько вариантов</Label>
            <div className="flex flex-wrap gap-2">
              {([4, 5, 6] as const).map((n) => (
                <Button
                  key={n}
                  type="button"
                  size="sm"
                  variant={variantPackCount === n ? "default" : "outline"}
                  className="rounded-xl"
                  onClick={() => setVariantPackCount(n)}
                >
                  {n}
                </Button>
              ))}
            </div>
            <p className="text-xs text-[#4a6e7a]">У каждого варианта — своя генерация и общий ID группы; ошибка одного не отменяет остальные.</p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="m-title" className="text-[#0C2D38]">Название товара</Label>
            <Input id="m-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Стильные солнцезащитные очки" className="rounded-xl border-[#B8DCE6]" />
            {graphemeLen(title) > 44 && (
              <p className="text-xs text-amber-800/90" role="status">
                Заголовок длинный — на карточке мы уменьшим кегль или перенесём текст максимум на две строки.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-subtitle" className="text-[#0C2D38]">Подзаголовок</Label>
            <Input id="m-subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} maxLength={160} placeholder="Классический черный цвет" className="rounded-xl border-[#B8DCE6]" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="m-benefits" className="text-[#0C2D38]">Преимущества</Label>
          <Textarea id="m-benefits" value={benefits} onChange={(e) => setBenefits(e.target.value)} rows={4} placeholder={"Удобная посадка\nПремиум качество\nКүннен қорғайды\nЖеңіл жақтау"} className="rounded-xl border-[#B8DCE6]" />
          <p className="text-xs text-[#4a6e7a]">Каждая строка — отдельный пункт. Лучше 3–5 коротких преимуществ.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="m-extra" className="text-[#0C2D38]">Дополнительный текст</Label>
            <Input id="m-extra" value={extraText} onChange={(e) => setExtraText(e.target.value)} maxLength={200} placeholder="Хит продаж" className="rounded-xl border-[#B8DCE6]" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-stats" className="text-[#0C2D38]">Статистика / цифры</Label>
            <Input id="m-stats" value={statsText} onChange={(e) => setStatsText(e.target.value)} maxLength={120} placeholder="UV400" className="rounded-xl border-[#B8DCE6]" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-size" className="text-[#0C2D38]">Объём / вес / размер</Label>
            <Input id="m-size" value={sizeText} onChange={(e) => setSizeText(e.target.value)} maxLength={120} placeholder="Универсальный размер" className="rounded-xl border-[#B8DCE6]" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="m-what" className="text-[#0C2D38]">Пожелания к визуалу</Label>
          <Textarea id="m-what" value={userInstructions} onChange={(e) => setUserInstructions(e.target.value)} maxLength={1000} rows={3} placeholder="Фон, атмосфера, композиция, свет…" className="rounded-xl border-[#B8DCE6]" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-[#0C2D38]">Стиль карточки / композиция</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {templates.map((template) => (
                <button key={template.id} type="button" onClick={() => setTemplatePreset(template.id)} className={cn("rounded-2xl border p-3 text-left transition", templatePreset === template.id ? "border-[#00AFCA] bg-[#e8f8fb]" : "border-[#B8DCE6] bg-white hover:border-[#00AFCA]/45")}>
                  <p className="text-sm font-medium text-[#0C2D38]">{template.label}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-[#4a6e7a]">{template.description}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#0C2D38]">Типографика</Label>
              <div className="flex flex-wrap gap-2">
                {typographyPresets.map((preset) => (
                  <button key={preset.id} type="button" onClick={() => setTypographyPreset(preset.id)} className={cn("rounded-full border px-3 py-1.5 text-xs transition", typographyPreset === preset.id ? "border-[#00AFCA] bg-[#e8f8fb] text-[#006b82]" : "border-border bg-background text-foreground")}>
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[#0C2D38]">Размер карточки</Label>
              <div className="flex flex-wrap gap-2">
                {sizeOptions.map((preset) => (
                  <button key={preset.id} type="button" onClick={() => setCardSize(preset.id)} className={cn("rounded-full border px-3 py-1.5 text-xs transition", cardSize === preset.id ? "border-[#00AFCA] bg-[#e8f8fb] text-[#006b82]" : "border-border bg-background text-foreground")}>
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-2 text-sm text-[#0C2D38]">
              {[{ label: "Добавлять иконки", value: useIcons, set: setUseIcons }, { label: "Добавлять стрелки", value: useArrows, set: setUseArrows }, { label: "Добавлять тени", value: useShadows, set: setUseShadows }].map((row) => (
                <label key={row.label} className="flex items-start gap-2 rounded-xl border border-[#B8DCE6] bg-white p-2">
                  <input type="checkbox" checked={row.value} onChange={(e) => row.set(e.target.checked)} className="mt-1" />
                  <span>{row.label}</span>
                </label>
              ))}
              <div className="flex items-start gap-2 rounded-xl border border-dashed border-[#c9dbe1] bg-[#f9fcfd] p-2 opacity-90">
                <input type="checkbox" disabled checked={false} readOnly className="mt-1" aria-hidden />
                <span className="text-[#345b66]">
                  <span className="font-medium text-[#0C2D38]">
                    Сохранить надписи и упаковку без изменений{" "}
                    <span className="rounded bg-[#eef6f9] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#006b82]">Скоро</span>
                  </span>
                  <span className="mt-1 block text-xs leading-snug">
                    Скоро: оставим оригинальный слой товара с этикеткой поверх нового фона через cutout. Сейчас опция недоступна.
                  </span>
                </span>
              </div>
              {canLayoutDebug && (
                <label className="flex items-start gap-2 rounded-xl border border-amber-200/80 bg-amber-50/40 p-2">
                  <input type="checkbox" checked={previewLayoutDebug} onChange={(e) => setPreviewLayoutDebug(e.target.checked)} className="mt-1" />
                  <span>
                    <span className="font-medium">Отладка оверлея (админ)</span>
                    <span className="mt-1 block text-xs text-[#6b5720]">Показать запретную зону и safe-zone в SVG-превью.</span>
                  </span>
                </label>
              )}
            </div>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-[#4a6e7a]">
          Превью показывает примерную схему зон. Финальная карточка после генерации подстраивается под силуэт товара на базовом изображении и может использовать другую раскладку, если места для текста мало.
        </p>
        <ProductCardTemplatePreview svg={overlayPreview?.svg ?? null} width={overlayPreview?.width ?? 1000} height={overlayPreview?.height ?? 1000} label={overlayPreview?.label ?? "Preview"} />

        {canUseBackend && (
          <div className="space-y-1 text-sm text-[#4a6e7a]">
            {showEstimate && estimating && <p>Рассчитываем стоимость…</p>}
            {estErr && <p className="text-destructive" role="alert">{estErr}</p>}
            {showEstimate && !estimating && creditsInt != null && !estErr && (
              <p>
                Один вариант:{" "}
                <span className="font-medium tabular-nums text-[#0C2D38]">
                  {coerceEstimateCredits(perVariantCredits ?? undefined) ?? creditsInt}
                </span>{" "}
                ток. · Количество: <span className="font-medium tabular-nums text-[#0C2D38]">{estimatedVariantCount}</span> ·
                Итого: <span className="font-medium tabular-nums text-[#0C2D38]">{creditsInt}</span> ток. · Баланс:{" "}
                <span className="font-medium tabular-nums text-[#0C2D38]">{balanceNum}</span> · После:{" "}
                <span className="font-medium tabular-nums text-[#0C2D38]">{balanceAfter ?? 0}</span>
              </p>
            )}
            {notEnough && (
              <p>
                Недостаточно токенов. <Link href="/dashboard/billing" className="font-medium text-[#00AFCA] underline">Пополнить баланс</Link>
              </p>
            )}
          </div>
        )}

        <Button type="button" onClick={() => void onSubmit()} disabled={!canSubmit || generating}>
          {generating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {generationMode === "marketplace_card_variants" ? `Создаём ${variantCount} вариантов…` : "Создаём карточку…"}
            </>
          ) : generationMode === "marketplace_card_variants" ? `Создать ${variantCount} вариантов` : "Создать карточку"}
        </Button>
        {!canUseBackend && <p className="text-xs text-[#4a6e7a]">Сначала привяжите фото к проекту.</p>}

        {genError && (
          <Alert variant="destructive" className="rounded-2xl">
            <AlertTitle>Генерация</AlertTitle>
            <AlertDescription>{genError}</AlertDescription>
          </Alert>
        )}

        <ProductCardVariantGallery
          items={results}
          onEditText={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onCreateSimilar={(item) => {
            if (item.templatePreset) setTemplatePreset(item.templatePreset as ProductCardTemplatePresetId);
            if (item.typographyPreset) setTypographyPreset(item.typographyPreset as ProductCardTypographyPresetId);
            setGenerationMode("marketplace_card");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      </CardContent>
    </Card>
  );
}

```
