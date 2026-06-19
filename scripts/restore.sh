#!/usr/bin/env bash
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <backup_dir>"
  echo "Example: $0 ./backups/20240115_103000"
  exit 1
fi

BACKUP_DIR="$1"

if [ ! -d "$BACKUP_DIR" ]; then
  echo "Error: backup directory not found: $BACKUP_DIR"
  exit 1
fi

# Load env vars for DB credentials
if [ -f .env.production ]; then
  set -a; source .env.production; set +a
elif [ -f .env ]; then
  set -a; source .env; set +a
fi

PGUSER="${POSTGRES_USER:-postgres}"
PGDB="${POSTGRES_DB:-buildyourbody}"

if [ -f "$BACKUP_DIR/db.sql" ]; then
  echo "Restoring PostgreSQL ($PGDB)…"
  docker compose exec -T db psql -U "$PGUSER" "$PGDB" < "$BACKUP_DIR/db.sql"
  echo "✓ Database restored"
fi

if [ -f "$BACKUP_DIR/uploads.tar.gz" ]; then
  echo "Restoring uploads…"
  tar -xzf "$BACKUP_DIR/uploads.tar.gz" -C ./
  echo "✓ Uploads restored"
fi

echo "✓ Restore complete from $BACKUP_DIR"
