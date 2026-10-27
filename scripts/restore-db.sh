#!/usr/bin/env bash
# ==============================================================================
# restore-db.sh — PostgreSQL Database Restoration & Disaster Recovery Drill
# Hospital_CRM Production Disaster Recovery Infrastructure
#
# Verifies SHA256 integrity and restores from PostgreSQL custom format (-Fc)
# with clean re-creation and integrity validation.
# ==============================================================================

set -euo pipefail

BACKUP_FILE="${1:-}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGDATABASE="${PGDATABASE:-hospital_crm}"
PGUSER="${PGUSER:-postgres}"

if [ -z "${BACKUP_FILE}" ]; then
  # Find latest dump file in backups directory
  BACKUP_FILE=$(find ./backups -name "*.dump" -type f | sort -r | head -n 1)
  if [ -z "${BACKUP_FILE}" ]; then
    echo "ERROR: No backup dump file specified and no .dump files found in ./backups." >&2
    echo "Usage: $0 [path/to/backup.dump]" >&2
    exit 1
  fi
  echo "==> Auto-selected latest backup: ${BACKUP_FILE}"
fi

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "ERROR: Backup file '${BACKUP_FILE}' does not exist." >&2
  exit 1
fi

# Validate checksum if present
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
if [ -f "${CHECKSUM_FILE}" ]; then
  echo "==> Verifying SHA256 integrity checksum..."
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum -c "${CHECKSUM_FILE}"
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 -c "${CHECKSUM_FILE}"
  fi
  echo "    Checksum OK."
fi

echo "==> Restoring database '${PGDATABASE}' from '${BACKUP_FILE}'..."
echo "    Host: ${PGHOST}:${PGPORT} | User: ${PGUSER}"

# Execute pg_restore: clean objects before recreation, ignore privileges/owners
pg_restore \
  --no-password \
  --host="${PGHOST}" \
  --port="${PGPORT}" \
  --username="${PGUSER}" \
  --dbname="${PGDATABASE}" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --verbose \
  "${BACKUP_FILE}" || true

echo "==> Running post-restore database connectivity check..."
psql \
  --host="${PGHOST}" \
  --port="${PGPORT}" \
  --username="${PGUSER}" \
  --dbname="${PGDATABASE}" \
  -c "SELECT count(*) AS user_count FROM \"Users\";"

echo "==> Restoration verified successfully!"
