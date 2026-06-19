#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Load env vars for DB credentials
if [ -f .env.production ]; then
  set -a; source .env.production; set +a
elif [ -f .env ]; then
  set -a; source .env; set +a
fi

PGUSER="${POSTGRES_USER:-postgres}"
PGDB="${POSTGRES_DB:-buildyourbody}"

echo "Backing up PostgreSQL ($PGDB)…"
docker compose exec -T db pg_dump -U "$PGUSER" "$PGDB" > "$BACKUP_DIR/db.sql"

echo "Backing up uploads…"
tar -czf "$BACKUP_DIR/uploads.tar.gz" ./uploads/ 2>/dev/null || true

echo "✓ Backup saved to $BACKUP_DIR"
ls -lh "$BACKUP_DIR"
