# Development Plan

Work stage by stage.

Do not implement future stages unless explicitly requested.

After every completed stage, the project should still run.

After every stable stage, create a Git commit.

## Stage 0 — Project setup

Goal:

Create the base Next.js project structure.

Tasks:

- create Next.js App Router project;
- configure TypeScript;
- configure Tailwind CSS;
- configure Shadcn UI;
- configure Prisma;
- prepare PostgreSQL connection;
- create base folder structure;
- create home page;
- create dashboard placeholder;
- create admin placeholder;
- create .env.example;
- create basic README.

Do not implement:

- auth;
- generation;
- payments;
- real admin logic;
- Kie.ai integration.

Expected structure:

src/
  app/
    page.tsx
    dashboard/
    admin/
    auth/
    api/
  components/
    ui/
    layout/
    forms/
  lib/
    auth.ts
    prisma.ts
    kie.ts
    credits.ts
    storage.ts
    env.ts
  server/
    services/
    queues/
  types/
prisma/
  schema.prisma

Suggested commit:

git add .
git commit -m "stage 0 project setup"

## Stage 0.5 — VPS and Docker preparation

Goal:

Prepare the project for VPS deployment through Docker.

Tasks:

- create Dockerfile;
- create docker-compose.yml;
- create .dockerignore;
- create README_DEPLOY.md;
- create nginx.conf example if useful;
- make sure environment variables are loaded from .env;
- include app service;
- include postgres service;
- include redis service;
- prepare worker service placeholder if queue is not implemented yet.

docker-compose should eventually include:

- app
- postgres
- redis
- worker

Rules:

- do not hardcode secrets;
- do not hardcode domain names;
- do not make deployment depend only on Vercel;
- PostgreSQL should use a volume;
- Redis should use a volume or standard service;
- app should depend on postgres and redis.

Do not implement:

- auth;
- generation;
- payments;
- Kie.ai API;
- queue.

Suggested commit:

git add .
git commit -m "stage 0.5 docker vps setup"

## Stage 1 — Database

Goal:

Create Prisma schema.

Entities:

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

Enums:

- UserRole
- UserStatus
- GenerationType
- GenerationStatus
- PaymentStatus
- CreditTransactionType
- AiModelProvider
- WebhookEventStatus

Do not implement UI.

Do not implement API endpoints.

Only database schema and migration instructions.

Suggested commit:

git add .
git commit -m "stage 1 database schema"

## Stage 2 — Auth and roles

Goal:

Implement authentication and authorization.

Tasks:

- registration;
- login;
- logout;
- password hashing;
- protected dashboard;
- protected admin;
- role-based access;
- middleware or server-side guards;
- redirect unauthenticated users to login.

Rules:

- /dashboard requires authenticated user;
- /admin requires ADMIN or SUPER_ADMIN;
- USER must not access /admin.

Do not implement:

- generation;
- payments;
- Kie.ai API.

Suggested commit:

git add .
git commit -m "stage 2 auth and roles"

## Stage 2.5 — Initial SUPER_ADMIN creation

Goal:

Create safe way to create the first SUPER_ADMIN user.

Tasks:

- use SUPER_ADMIN_EMAIL from .env;
- create seed script or admin creation command;
- do not create public admin creation endpoint;
- document command in README.

Suggested commit:

git add .
git commit -m "stage 2.5 initial super admin"

## Stage 3 — User dashboard

Goal:

Create user dashboard UI.

Pages:

- /dashboard
- /dashboard/create/image
- /dashboard/create/video
- /dashboard/history
- /dashboard/billing
- /dashboard/settings

Dashboard should show:

- balance credits;
- active plan;
- latest generations;
- active tasks;
- buttons for image and video generation.

Use real user data where already available.

Use empty states where data is missing.

Do not connect Kie.ai yet.

Suggested commit:

git add .
git commit -m "stage 3 user dashboard"

## Stage 4 — Admin panel

Goal:

Create protected admin panel.

Pages:

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

Admin panel should have:

- layout;
- sidebar;
- tables;
- empty states;
- role protection.

Do not implement full CRUD yet unless requested.

Do not connect Kie.ai.

Suggested commit:

git add .
git commit -m "stage 4 admin panel"

## Stage 5 — AI model management

Goal:

Implement CRUD for AiModel.

Tasks:

- list models;
- create model;
- edit model;
- activate/deactivate model;
- delete model only if safe;
- validate model fields.

AiModel fields:

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

Rules:

- model prices must be editable from admin panel;
- frontend generation forms should later use model data from database;
- do not hardcode models in UI.

Do not connect real provider API yet.

Suggested commit:

git add .
git commit -m "stage 5 ai model management"

## Stage 6 — Credits

Goal:

Implement credit system.

Tasks:

Create credit service with functions:

- getBalance(userId)
- addCredits(userId, amount, reason)
- reserveCredits(userId, amount, generationId)
- confirmCredits(generationId)
- refundCredits(generationId)
- listTransactions(userId)

Rules:

- no negative balance;
- every change creates CreditTransaction;
- admin can manually add credits;
- admin manual changes should create AdminAuditLog;
- reserved credits must be traceable;
- provider error should trigger refund.

Do not implement payments yet.

Suggested commit:

git add .
git commit -m "stage 6 credits"

## Stage 7 — Image generation backend

Goal:

Implement backend image generation flow.

Endpoint:

- POST /api/generations/image

Flow:

1. Check auth.
2. Validate input.
3. Validate upload limits if files are included.
4. Load AiModel.
5. Confirm model is active.
6. Confirm model type is IMAGE.
7. Check user credits.
8. Create Generation.
9. Reserve credits.
10. Call Kie.ai through backend service or queue.
11. Save provider response.
12. Save generated result.
13. Confirm credits on success.
14. Refund credits on provider error.
15. Write ApiLog.

Rules:

- never call Kie.ai from frontend;
- Kie.ai API key must come from environment variables;
- provider logic should be isolated in lib/kie.ts or server/services/provider;
- do not store final files permanently on VPS disk.

Suggested commit:

git add .
git commit -m "stage 7 image generation backend"

## Stage 8 — Video generation backend

Goal:

Implement asynchronous video generation creation.

Endpoints:

- POST /api/generations/video
- GET /api/generations/:id

Flow:

1. Check auth.
2. Validate input.
3. Validate upload limits if files are included.
4. Load AiModel.
5. Confirm model is active.
6. Confirm model type is VIDEO.
7. Check user credits.
8. Create Generation with QUEUED status.
9. Reserve credits.
10. Add job to queue or pending task.
11. Return generationId.

Rules:

- do not block HTTP request until video is completed;
- frontend should check status using generationId.

Suggested commit:

git add .
git commit -m "stage 8 video generation backend"

## Stage 9 — Queue and worker

Goal:

Add Redis + BullMQ.

Tasks:

- create generationQueue;
- create worker process;
- create worker service entrypoint;
- update docker-compose with worker service;
- process image/video jobs if needed;
- support retries;
- write ApiLog;
- confirm/refund credits.

Worker flow:

1. receive generationId;
2. load generation;
3. call Kie.ai;
4. save providerTaskId;
5. poll provider status if needed;
6. save generated files;
7. update status;
8. confirm or refund credits.

Suggested commit:

git add .
git commit -m "stage 9 queue and worker"

## Stage 10 — S3-compatible storage

Goal:

Add storage service.

Create:

- lib/storage.ts

Functions:

- uploadFile(buffer, key, contentType)
- uploadFromUrl(url, key)
- getSignedUrl(key)
- deleteFile(key)

Environment variables:

- S3_ENDPOINT
- S3_ACCESS_KEY_ID
- S3_SECRET_ACCESS_KEY
- S3_BUCKET
- S3_PUBLIC_URL
- S3_REGION

Rules:

- generated media should be saved to S3-compatible storage;
- user uploads should be saved to S3-compatible storage;
- do not permanently store generated images/videos on VPS disk;
- database should store storage keys and URLs.

Suggested commit:

git add .
git commit -m "stage 10 s3 storage"

## Stage 11 — Generation history

Goal:

Show user generation history.

Page:

- /dashboard/history

Features:

- list user generations;
- filter by IMAGE / VIDEO;
- filter by status;
- show preview;
- show date;
- show model;
- show cost;
- download button;
- repeat generation button;
- generation detail page.

Rules:

- users must only see their own generations;
- admins can see all generations in admin panel.

Suggested commit:

git add .
git commit -m "stage 11 generation history"

## Stage 12 — Payments

Goal:

Implement credit purchases.

Tasks:

- billing page;
- credit packages;
- create payment;
- payment webhook;
- store WebhookEvent;
- Payment records;
- CreditTransaction after successful payment.

Recommended first provider:

- Stripe

But make payment provider abstract, so we can later add:

- YooKassa
- CloudPayments
- Kaspi Pay

Rules:

- credits are added only after confirmed webhook;
- do not trust frontend payment success alone.

Suggested commit:

git add .
git commit -m "stage 12 payments"

## Stage 13 — Provider webhooks and polling

Goal:

Support provider callbacks and polling fallback.

Tasks:

- create POST /api/webhooks/kie;
- store incoming events in WebhookEvent;
- validate webhook if provider supports signature/token;
- update Generation status based on provider event;
- support polling fallback in worker if webhook is not available;
- log errors.

Rules:

- do not expose secrets;
- do not trust unverified webhooks if signature validation is available.

Suggested commit:

git add .
git commit -m "stage 13 provider webhooks"

## Stage 14 — Moderation

Goal:

Add prompt moderation.

Tasks:

- banned words list;
- moderation service;
- block forbidden prompts;
- create BLOCKED generation status;
- admin page for blocked generations;
- log block reason.

Rules:

- do not send blocked prompts to Kie.ai;
- blocked prompt behavior should be clear to the user;
- moderation settings should be configurable.

Suggested commit:

git add .
git commit -m "stage 14 moderation"

## Stage 15 — Legal pages and static content

Goal:

Add required legal pages.

Pages:

- /terms
- /privacy
- /refund-policy
- /ai-content-policy
- /copyright-policy

Rules:

- MVP pages can be static;
- do not invent final legal advice;
- use placeholder text that can be reviewed by a lawyer later.

Suggested commit:

git add .
git commit -m "stage 15 legal pages"

## Stage 16 — Rate limits and upload limits

Goal:

Protect the app from abuse and cost spikes.

Tasks:

- rate limit login attempts;
- rate limit registration;
- rate limit generation requests;
- rate limit file uploads;
- rate limit admin-sensitive actions;
- validate file size;
- validate MIME type;
- reject unsupported files.

Rules:

- upload limits should be configurable in AppSetting;
- do not permanently store uploads on VPS disk.

Suggested commit:

git add .
git commit -m "stage 16 rate limits and upload limits"

## Stage 17 — Healthcheck and environment validation

Goal:

Improve production reliability.

Tasks:

- create GET /api/health;
- check app status;
- check database connection;
- check Redis connection if configured;
- create env validation helper;
- fail clearly when required env variables are missing.

Suggested commit:

git add .
git commit -m "stage 17 healthcheck and env validation"

## Stage 18 — Backups and production deploy docs

Goal:

Prepare real VPS production operations.

Tasks:

- update README_DEPLOY.md;
- document Docker deployment;
- document Nginx setup;
- document SSL setup;
- document PostgreSQL backup;
- document PostgreSQL restore;
- document recommended backup frequency;
- document where generated files are stored.

Suggested commit:

git add .
git commit -m "stage 18 backups and deploy docs"

## Stage 19 — Admin audit log and app settings

Goal:

Improve admin safety and configurability.

Tasks:

- implement AppSetting CRUD;
- implement AdminAuditLog;
- log admin balance changes;
- log user blocking;
- log model changes;
- log price changes;
- log manual refunds;
- log settings changes.

Suggested commit:

git add .
git commit -m "stage 19 audit log and app settings"

## Stage 20 — UI polish

Goal:

Improve user experience.

Tasks:

- improve landing page;
- improve dashboard;
- improve generation forms;
- improve admin tables;
- add loading states;
- add error states;
- add empty states;
- add responsive mobile layout.

Rules:

- do not change business logic without reason;
- do not change database schema unless necessary.

Suggested commit:

git add .
git commit -m "stage 20 ui polish"

## Stage 21 — Production hardening

Goal:

Prepare for real production.

Tasks:

- improve logging;
- add Sentry or similar error tracking if needed;
- add security headers;
- improve validation;
- improve Docker production config;
- review secrets handling;
- review admin permissions;
- review file storage;
- review provider error handling.

Rules:

- no secrets in repository;
- production should use HTTPS through Nginx;
- database backups should be documented;
- Kie.ai API must never be called from frontend.

Suggested commit:

git add .
git commit -m "stage 21 production hardening"