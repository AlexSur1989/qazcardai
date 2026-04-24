# AI Media Generation SaaS

## Goal

Build a web application for generating AI images and videos through Kie.ai API.

The app must be suitable for deployment on a VPS using Docker.

Users can:

- register and login;
- buy or receive credits;
- generate images;
- generate videos;
- view generation history;
- download results;
- manage account settings.

Admins can:

- manage users;
- manage credits;
- manage AI models;
- manage generations;
- manage payments;
- manage promo codes;
- manage app settings;
- manage provider settings;
- view API logs;
- view webhook events;
- view admin audit logs.

## Main principle

Do not hardcode AI models and prices.

AI models, prices, limits and availability must be managed from the admin panel.

The system should work as a platform for different image and video generation models from Kie.ai.

The frontend should load available models and model settings from the database.

## Stack

Use:

- Next.js App Router
- TypeScript
- Tailwind CSS
- Shadcn UI
- Prisma
- PostgreSQL
- Redis
- BullMQ
- S3-compatible storage
- Kie.ai API
- Docker
- Docker Compose
- Nginx for VPS deployment

## Deployment target

The project must be prepared for deployment on a VPS.

Do not build the project only for Vercel.

The project should include:

- Dockerfile
- docker-compose.yml
- .dockerignore
- .env.example
- README_DEPLOY.md
- optional nginx.conf example

In production the VPS should run:

- Next.js app
- PostgreSQL
- Redis
- worker for generation jobs
- Nginx reverse proxy

Generated images and videos should not be stored permanently on the VPS local disk.

Use S3-compatible storage for generated files, for example:

- Cloudflare R2
- Amazon S3
- Yandex Object Storage
- Selectel
- Backblaze B2

## Roles

The app must support these roles:

- USER
- MODERATOR
- ADMIN
- SUPER_ADMIN

## Core entities

Main database entities:

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

## User

User should include:

- id
- email
- passwordHash
- name
- role
- status
- balanceCredits
- emailVerified
- createdAt
- updatedAt

## Plan

Plan should include:

- id
- name
- slug
- price
- currency
- credits
- limits
- isActive
- createdAt
- updatedAt

## AiModel

AiModel should include:

- id
- name
- slug
- provider
- type
- apiModelId
- endpoint
- costCredits
- realCost
- isActive
- settingsSchema
- description
- supportsImageInput
- supportsVideoInput
- supportsNegativePrompt
- supportsSeed
- maxDuration
- availableAspectRatios
- availableResolutions
- createdAt
- updatedAt

## Generation

Generation should include:

- id
- userId
- modelId
- type
- status
- prompt
- negativePrompt
- inputFiles
- outputFiles
- providerTaskId
- costCredits
- errorMessage
- metadata
- createdAt
- completedAt
- updatedAt

## Payment

Payment should include:

- id
- userId
- provider
- providerPaymentId
- amount
- currency
- credits
- status
- metadata
- createdAt
- updatedAt

## CreditTransaction

CreditTransaction should include:

- id
- userId
- generationId
- paymentId
- type
- amount
- reason
- metadata
- createdAt

## ApiLog

ApiLog should include:

- id
- generationId
- provider
- endpoint
- requestPayload
- responsePayload
- statusCode
- errorMessage
- createdAt

Do not log secret API keys.

## UploadedFile

UploadedFile should include:

- id
- userId
- generationId
- fileName
- fileType
- mimeType
- size
- storageKey
- url
- metadata
- createdAt

## PromoCode

PromoCode should include:

- id
- code
- type
- value
- maxUses
- usedCount
- expiresAt
- isActive
- createdAt
- updatedAt

## AdminAuditLog

Admin actions should be logged.

Examples:

- user balance changed;
- user blocked;
- model created;
- model price changed;
- generation refunded;
- payment manually adjusted;
- app settings changed.

AdminAuditLog should include:

- id
- adminUserId
- action
- targetType
- targetId
- oldValue
- newValue
- metadata
- createdAt

## AppSetting

Admin panel should support application settings.

Examples:

- free credits for new users;
- maintenance mode;
- default image model;
- default video model;
- max active generations per user;
- referral bonus;
- upload limits;
- moderation settings;
- rate limit settings.

AppSetting should include:

- id
- key
- value
- type
- description
- updatedBy
- createdAt
- updatedAt

## WebhookEvent

Incoming webhooks should be stored.

WebhookEvent should include:

- id
- provider
- eventType
- payload
- status
- processedAt
- errorMessage
- createdAt

This helps debug payment and provider callbacks.

## Generation types

Supported generation types:

- IMAGE
- VIDEO

Later the system can be extended with:

- AUDIO
- MUSIC
- AVATAR

Do not implement future types unless explicitly requested.

## Generation statuses

Use these statuses:

- CREATED
- QUEUED
- PROCESSING
- COMPLETED
- FAILED
- BLOCKED
- CANCELLED
- REFUNDED

## Credit logic

All paid generations must use the credit system.

Before generation:

- check user balance;
- create Generation record;
- reserve credits;
- create CreditTransaction record.

After success:

- save output files;
- mark Generation as COMPLETED;
- confirm credit spending.

After provider error:

- mark Generation as FAILED;
- refund reserved credits;
- create refund CreditTransaction.

Do not allow negative user balance.

All credit changes must be logged.

## Provider rule

Kie.ai is the AI provider.

Frontend must never call Kie.ai API directly.

Only backend or worker can call Kie.ai API.

Kie.ai API key must be stored only in environment variables.

Provider-specific code should be isolated in:

- lib/kie.ts

or:

- server/services/provider/

Do not spread provider logic across React components.

## Provider status updates

For long-running generation tasks, the system should support:

- provider webhook callback if Kie.ai supports it;
- polling fallback if webhook is not available.

The app should include a backend endpoint for provider callbacks:

- POST /api/webhooks/kie

Webhook requests must be validated if provider supports signatures or tokens.

All incoming webhooks should be stored in WebhookEvent.

## Storage rule

Generated media files must be saved to S3-compatible storage.

The database should store:

- file URL;
- storage key;
- file type;
- file size if available;
- metadata.

The app can temporarily use external provider URLs during development, but production logic should save files to our storage.

Do not permanently store generated images or videos on the VPS local disk.

## File upload limits

The app should validate uploaded files.

Rules:

- allow only supported image/video formats;
- limit file size;
- validate MIME type;
- reject unsafe files;
- store uploaded files in S3-compatible storage;
- do not permanently store user uploads on VPS local disk.

Upload limits should be configurable in AppSetting.

## User pages

User area should include:

- /dashboard
- /dashboard/create/image
- /dashboard/create/video
- /dashboard/history
- /dashboard/billing
- /dashboard/settings

Dashboard should show:

- current credit balance;
- active plan;
- recent generations;
- active generation tasks;
- quick buttons for image and video generation.

## Admin panel

Admin area should include:

- /admin
- /admin/users
- /admin/models
- /admin/generations
- /admin/payments
- /admin/promo-codes
- /admin/settings
- /admin/logs
- /admin/webhooks
- /admin/audit-logs

Admin panel must be protected.

Only ADMIN and SUPER_ADMIN can access /admin.

## AI model management

Admins must be able to manage AI models.

AiModel should include:

- name
- slug
- provider
- type: IMAGE or VIDEO
- apiModelId
- endpoint
- costCredits
- realCost
- isActive
- settingsSchema
- description
- supportsImageInput
- supportsVideoInput
- supportsNegativePrompt
- supportsSeed
- maxDuration
- availableAspectRatios
- availableResolutions

The UI should use AiModel settings to show available options to users.

Do not hardcode model options in frontend.

## Image generation

Image generation should support:

- prompt
- negative prompt if model supports it
- model selection
- aspect ratio
- resolution
- seed if model supports it
- uploaded reference image if model supports it

Endpoint:

- POST /api/generations/image

Flow:

1. Check authentication.
2. Validate input.
3. Load selected AiModel.
4. Check model is active.
5. Check model type is IMAGE.
6. Check user balance.
7. Create Generation.
8. Reserve credits.
9. Send provider request through backend or queue.
10. Save provider response.
11. Save generated file to storage.
12. Update Generation status.
13. Confirm or refund credits.
14. Return generation result or generationId.

## Video generation

Video generation should be asynchronous.

Endpoint:

- POST /api/generations/video

Flow:

1. Check authentication.
2. Validate input.
3. Load selected AiModel.
4. Check model is active.
5. Check model type is VIDEO.
6. Check user balance.
7. Create Generation with QUEUED status.
8. Reserve credits.
9. Add job to generation queue.
10. Return generationId.

Also provide:

- GET /api/generations/:id

The frontend should poll status or use another status update mechanism.

Do not block the HTTP request until the video is finished.

## Queue

Use Redis + BullMQ for generation jobs.

There should be a worker process.

Worker responsibilities:

- receive generationId;
- load Generation from database;
- call Kie.ai API;
- save providerTaskId;
- check provider status if async;
- save result files to storage;
- update Generation status;
- confirm credits on success;
- refund credits on provider error;
- write ApiLog records.

The worker should be deployable as a separate Docker service.

## Payments

Payments can be added after credits and generation are working.

The app should support credit packages.

Payment provider should be abstracted so we can later use:

- Stripe
- YooKassa
- CloudPayments
- Kaspi Pay
- other providers

Payment flow:

1. User selects credit package.
2. Backend creates payment.
3. Payment provider redirects or confirms payment.
4. Webhook receives success event.
5. System stores WebhookEvent.
6. System creates Payment record.
7. System adds credits to user.
8. System creates CreditTransaction.

Do not trust frontend payment success alone.

Credits are added only after confirmed backend webhook.

## Moderation

Before sending prompts to Kie.ai, the system should support moderation.

Basic moderation:

- banned words list;
- blocked prompts;
- BLOCKED generation status;
- admin logs.

Do not send blocked prompts to Kie.ai.

Moderation settings should be configurable in AppSetting.

## Rate limits

The app should include rate limits for:

- login attempts;
- registration;
- generation requests;
- file uploads;
- admin-sensitive actions.

Rate limits should protect the app from abuse and accidental API cost spikes.

## Healthcheck

The app should include a healthcheck endpoint:

- GET /api/health

It should return:

- app status;
- database connection status;
- redis connection status if available.

This endpoint is useful for VPS deployment, Docker healthchecks and monitoring.

## Environment validation

The app should validate required environment variables on startup.

Required variables may include:

- DATABASE_URL
- AUTH_SECRET
- KIE_API_KEY
- KIE_BASE_URL
- REDIS_URL
- S3_ENDPOINT
- S3_ACCESS_KEY_ID
- S3_SECRET_ACCESS_KEY
- S3_BUCKET

If required variables are missing, the app should fail clearly with a helpful error.

## Backups

Production deployment should include database backup instructions.

README_DEPLOY.md should explain:

- how to create a PostgreSQL backup;
- how to restore a PostgreSQL backup;
- where backups should be stored;
- recommended backup frequency.

Generated files are stored in S3-compatible storage and should not depend on VPS local disk.

## Legal pages

The public website should include:

- Terms of Service;
- Privacy Policy;
- Refund Policy;
- AI Content Policy;
- Copyright Policy.

These pages can be static in MVP.

## Initial super admin

The system should support creating the first SUPER_ADMIN user.

Use environment variable:

- SUPER_ADMIN_EMAIL

There should be a safe seed script or admin creation command.

Do not expose public admin creation endpoints.

## API logs

Every provider request should be logged.

ApiLog should store:

- generationId;
- provider;
- endpoint;
- request payload;
- response payload;
- status code;
- error message;
- createdAt.

Do not log secret API keys.

## MVP

MVP includes:

- project setup;
- Docker setup for VPS;
- auth;
- roles;
- initial SUPER_ADMIN creation;
- user dashboard;
- admin panel;
- model management;
- credits;
- image generation;
- video generation as async task;
- generation history;
- S3-compatible storage;
- basic payments later;
- API logs;
- webhook logs;
- healthcheck;
- legal static pages;
- basic rate limits;
- basic upload limits.

## Important restrictions

Do not expose secrets.

Do not call Kie.ai from frontend.

Do not store generated videos permanently on VPS disk.

Do not implement all stages at once.

Do not rewrite unrelated files.

Do not add unnecessary dependencies.

Keep the code modular and production-oriented.