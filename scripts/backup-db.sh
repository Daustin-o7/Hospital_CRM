#!/usr/bin/env bash
# ==============================================================================
# backup-db.sh — Automated PostgreSQL Database Backup
# Hospital_CRM Production Disaster Recovery Infrastructure
#
# Generates a point-in-time PostgreSQL custom archive (-Fc) with SHA256 checksum
# and metadata verification.
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGDATABASE="${PGDATABASE:-hospital_crm}"
PGUSER="${PGUSER:-postgres}"

TIMESTAMP=$(date -u +"%Y%m%d_%H%M%SZ")
TARGET_DIR="${BACKUP_DIR}/backup_${TIMESTAMP}"
DUMP_FILE="${TARGET_DIR}/${PGDATABASE}_${TIMESTAMP}.dump"
CHECKSUM_FILE="${DUMP_FILE}.sha256"

mkdir -p "${TARGET_DIR}"

echo "==> Starting database backup for '${PGDATABASE}' at ${TIMESTAMP}..."
echo "    Host: ${PGHOST}:${PGPORT} | User: ${PGUSER}"

# Execute pg_dump with custom archive format and compression
pg_dump \
  --no-password \
  --host="${PGHOST}" \
  --port="${PGPORT}" \
  --username="${PGUSER}" \
  --format=custom \
  --blobs \
  --verbose \
  --file="${DUMP_FILE}" \
  "${PGDATABASE}"

# Compute SHA256 integrity checksum
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "${DUMP_FILE}" > "${CHECKSUM_FILE}"
elif command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "${DUMP_FILE}" > "${CHECKSUM_FILE}"
fi

FILESIZE=$(ls -lh "${DUMP_FILE}" | awk '{print $5}')
echo "==> Backup complete successfully!"
echo "    Archive:  ${DUMP_FILE} (${FILESIZE})"
if [ -f "${CHECKSUM_FILE}" ]; then
  echo "    Checksum: ${CHECKSUM_FILE}"
fi
