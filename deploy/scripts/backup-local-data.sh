#!/bin/sh
set -eu

BACKUP_ROOT="${BACKUP_ROOT:-/home/flow/backups/flow-task}"
RETENTION_DAYS="${RETENTION_DAYS:-2}"
case "$BACKUP_ROOT" in /*) ;; *) echo "BACKUP_ROOT must be absolute." >&2; exit 1 ;; esac
case "$RETENTION_DAYS" in *[!0-9]*|"") echo "RETENTION_DAYS must be a positive integer." >&2; exit 1 ;; esac

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
temporary_directory="$(mktemp -d)"
trap 'rm -rf "$temporary_directory"' EXIT
mkdir -p "$BACKUP_ROOT"

docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' > "$temporary_directory/database.dump"
docker compose exec -T app tar -C /app/data -czf - uploads > "$temporary_directory/uploads.tar.gz"
chmod 600 "$temporary_directory/database.dump" "$temporary_directory/uploads.tar.gz"
mv "$temporary_directory/database.dump" "$BACKUP_ROOT/database-$timestamp.dump"
mv "$temporary_directory/uploads.tar.gz" "$BACKUP_ROOT/uploads-$timestamp.tar.gz"

find "$BACKUP_ROOT" -type f \( -name 'database-*.dump' -o -name 'uploads-*.tar.gz' \) -mtime "+$RETENTION_DAYS" -delete
echo "Flow Task backup completed: $timestamp"
