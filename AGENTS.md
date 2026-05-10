<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Git / сообщения коммитов

Темы и тело **git-коммитов** в этом проекте оформлять **на русском языке** (латиница — только для технических имён при необходимости). Подробнее см. правило Cursor: `.cursor/rules/commit-messages-russian.mdc`.

## Kie / модели генерации

В формах кабинета поля **`imageUrls`**, **`inputUrls`**, **`referenceImageUrls`** (списки URL для Kie `createTask`) **всегда** должны собираться **загрузкой файлов с компьютера** через `/api/uploads`, а не полем ручного ввода URL. Сервер по-прежнему получает публичные `https://…` после загрузки. Константа: `src/lib/kie-computer-upload-fields.ts`.
