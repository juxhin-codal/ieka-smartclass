#!/usr/bin/env bash
set -euo pipefail

: "${MSSQL_SA_PASSWORD:?MSSQL_SA_PASSWORD is required}"
DB_NAME="${DB_NAME:-IekaSmartClassDb}"
BACKUP_INTERVAL_SECONDS="${BACKUP_INTERVAL_SECONDS:-86400}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

mkdir -p /backups

SQLCMD_BIN="/opt/mssql-tools18/bin/sqlcmd"

echo "[backup] Waiting for SQL Server..."
until "$SQLCMD_BIN" -C -S db -U sa -P "$MSSQL_SA_PASSWORD" -Q "SELECT 1" >/dev/null 2>&1; do
  sleep 5
done

echo "[backup] SQL Server reachable. Starting backup loop."

while true; do
  ts="$(date -u +%Y%m%d-%H%M%S)"
  db_backup_file="/backups/${DB_NAME}-${ts}.bak"
  files_backup_file="/backups/storage-${ts}.tar.gz"

  echo "[backup] Running SQL backup -> ${db_backup_file}"
  "$SQLCMD_BIN" -C -S db -U sa -P "$MSSQL_SA_PASSWORD" -Q "BACKUP DATABASE [${DB_NAME}] TO DISK='${db_backup_file}' WITH INIT, COMPRESSION"

  echo "[backup] Archiving uploaded files -> ${files_backup_file}"
  if [ -d "/storage" ]; then
    tar -czf "$files_backup_file" -C /storage .
  else
    echo "[backup] /storage volume missing; skipping file archive"
  fi

  echo "[backup] Cleaning old backups (> ${BACKUP_RETENTION_DAYS} days)"
  find /backups -maxdepth 1 -type f -name '*.bak' -mtime +"${BACKUP_RETENTION_DAYS}" -delete || true
  find /backups -maxdepth 1 -type f -name 'storage-*.tar.gz' -mtime +"${BACKUP_RETENTION_DAYS}" -delete || true

  echo "[backup] Sleeping for ${BACKUP_INTERVAL_SECONDS}s"
  sleep "$BACKUP_INTERVAL_SECONDS"
done
