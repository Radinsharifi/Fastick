#!/usr/bin/env sh
set -eu
mkdir -p backups
STAMP=$(date +%Y%m%d-%H%M%S)
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-attendance}" "${POSTGRES_DB:-attendance}" | gzip > "backups/attendance-${STAMP}.sql.gz"
echo "Created backups/attendance-${STAMP}.sql.gz"
