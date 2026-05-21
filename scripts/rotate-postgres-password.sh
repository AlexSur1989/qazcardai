#!/usr/bin/env bash
# Смена пароля PostgreSQL после обновления POSTGRES_PASSWORD в .env.
# Запуск на VPS: bash scripts/rotate-postgres-password.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Нет файла .env" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

: "${POSTGRES_USER:?POSTGRES_USER не задан}"
: "${POSTGRES_DB:?POSTGRES_DB не задан}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD не задан}"

echo "Меняем пароль роли ${POSTGRES_USER} в контейнере postgres…"
docker compose exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -v ON_ERROR_STOP=1 \
  -c "ALTER USER \"${POSTGRES_USER}\" WITH PASSWORD '${POSTGRES_PASSWORD}';"

echo "Перезапуск app и worker…"
docker compose up -d app worker
echo "Готово. Проверьте: docker compose logs --tail=30 app"
