# Cursor Rules

You are building an AI media generation SaaS.

The project will be developed in Cursor and later deployed to a VPS using Docker.

## Work process

Work only on the current stage.

Do not implement future stages unless explicitly asked.

Do not rewrite unrelated files.

Do not change architecture without explaining why.

Do not add new dependencies without explaining why.

After each stage, the project should still run.

Prefer small, safe changes over large rewrites.

## Git workflow

After each stable stage, the user should be able to commit changes.

Do not create commits automatically unless asked.

When a stage is complete, mention suggested commit command, for example:

git add .
git commit -m "stage 0 project setup"

## Deployment

The app must be deployable to a VPS.

Do not make the project depend only on Vercel.

Use Docker and Compose for production deployment.

The project should include:

- Dockerfile
- docker-compose.yml
- .dockerignore
- .env.example
- README_DEPLOY.md

In production, VPS should run:

- app
- postgres
- redis
- worker

Nginx can be used as a reverse proxy.

Do not hardcode domain names.

Do not hardcode production secrets.

### Ответы пользователю после задач с кодом/деплоем (QazCard AI)

Полное правило: **`AGENTS.md`**, раздел **«Деплой на сервере»** — когда писать короткое «деплой сейчас не нужен», когда дать **`ВНИМАНИЕ`** о срочном выкате, по каким фразам выдавать единый блок **`## СДЕЛАЙ ЭТО НА СЕРВЕРЕ`**, и готовые `bash`-сценарии (frontend / backend+worker / Prisma / Kie seed / образы). Детальный runbook: **`README_DEPLOY.md`**.

### Kie.ai модели (источники правды, verify, изоляция GENERAL / PRODUCT_CARD)

Полная спецификация: **`AGENTS.md`**, раздел **«Kie / модели генерации»** (иерархия docs / Playground / Common API / pricing, запрет «по аналогии», metadata, GPT Image 2, Kling 2.6, uploads, `payloadMapping`, verify, product-card). Краткое правило для автоподхвата в Cursor: `.cursor/rules/kie-ai-models-sources.mdc`.

## Security

Never expose API keys to frontend.

Never store secrets in code.

Use environment variables.

Kie.ai API calls must only happen on backend or worker.

Do not log API keys.

Do not put .env into Git.

Validate required environment variables on startup.

## Provider

Kie.ai is the AI provider.

Provider-specific code should live in:

- lib/kie.ts

or:

- server/services/provider/

Do not spread provider logic across UI components.

Do not call Kie.ai API from client components.

For long-running tasks, support provider webhook if available and polling fallback if needed.

## Webhooks

Incoming webhooks should be stored in WebhookEvent.

Webhook endpoints:

- /api/webhooks/kie
- payment provider webhook endpoint

Webhook requests should be validated if provider supports signatures or tokens.

Do not trust unverified webhooks when verification is available.

## Business logic

All paid generations must check credits.

Credits must be reserved before provider call.

Credits must be confirmed after success.

Credits must be refunded after provider error.

All credit changes must create CreditTransaction records.

Do not allow negative user balance.

Admin manual balance changes must create AdminAuditLog records.

## Admin

Admin routes must be protected.

Only ADMIN and SUPER_ADMIN can access /admin.

USER must not access admin pages.

Model prices and availability must be controlled from admin panel.

Do not hardcode model prices in frontend.

Important admin actions should be logged in AdminAuditLog.

## Initial super admin

The first SUPER_ADMIN should be created through a safe seed script or admin creation command.

Use SUPER_ADMIN_EMAIL from environment variables.

Do not expose public admin creation endpoints.

## Frontend

Use clean UI with Tailwind CSS and Shadcn UI.

Show loading states.

Show error states.

Show empty states.

Do not call provider APIs directly from client components.

Generation forms should load available models from the database.

## Database

Use Prisma.

Use PostgreSQL.

Do not change schema without mentioning migration impact.

Use enums for:

- user roles;
- user status;
- generation types;
- generation statuses;
- payment statuses;
- credit transaction types;
- webhook event statuses.

Main entities:

- User
- Plan
- AiModel
- Generation
- Payment
- CreditTransaction
- ApiLog
- UploadedFile
- PromoCode
- AdminAuditLog
- AppSetting
- WebhookEvent

## Files and storage

Generated media should be saved to S3-compatible storage.

User uploads should be saved to S3-compatible storage.

Do not store generated videos permanently on VPS local disk.

Do not store user uploads permanently on VPS local disk.

Database should store:

- file URL;
- storage key;
- metadata.

Temporary local files must be cleaned up.

## Upload limits

Validate uploaded files.

Rules:

- allow only supported image/video formats;
- limit file size;
- validate MIME type;
- reject unsafe files;
- store accepted files in S3-compatible storage.

Upload limits should be configurable in AppSetting.

## Queue

Use Redis + BullMQ for long-running generation jobs.

Video generation must be asynchronous.

Worker should run as a separate process and Docker service.

The HTTP request must not wait until long video generation finishes.

## Payments

Do not implement payments until credit system is complete.

Payment success must be confirmed by backend webhook.

Do not trust frontend-only payment confirmation.

Payment provider should be abstracted.

Store incoming payment webhooks in WebhookEvent.

## Moderation

Blocked prompts must not be sent to Kie.ai.

Moderation result should be logged.

Admin should be able to review blocked generations later.

Moderation settings should be configurable.

## Rate limits

Add rate limits for:

- login attempts;
- registration;
- generation requests;
- file uploads;
- admin-sensitive actions.

Rate limits should prevent abuse and accidental API cost spikes.

## Healthcheck

Create endpoint:

- GET /api/health

It should check:

- app status;
- database status;
- Redis status if configured.

This endpoint is useful for Docker, VPS monitoring and debugging.

## Backups

README_DEPLOY.md should document:

- how to create PostgreSQL backup;
- how to restore PostgreSQL backup;
- recommended backup frequency;
- where backups should be stored.

Generated files should be stored in S3-compatible storage and should not depend on VPS local disk.

## Legal pages

The app should include static legal pages:

- Terms of Service;
- Privacy Policy;
- Refund Policy;
- AI Content Policy;
- Copyright Policy.

MVP can use placeholder legal text for later lawyer review.

## Code quality

Use TypeScript types.

Validate API request bodies.

Handle provider errors.

Avoid duplicated logic.

Keep services modular.

Do not put complex business logic directly inside React components.

Do not put complex business logic directly inside route handlers if it can be moved to services.

## When unsure

If the task is ambiguous, choose the safest minimal implementation for the current stage.

Do not invent large new features.

Do not implement unrelated improvements.

Do not implement the whole project at once.