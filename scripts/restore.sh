#!/usr/bin/env sh
set -eu
if [ "$#" -ne 1 ]; then echo "Usage: $0 backups/file.sql.gz"; exit 1; fi
gunzip -c "$1" | docker compose exec -T db psql -U "${POSTGRES_USER:-attendance}" "${POSTGRES_DB:-attendance}"
