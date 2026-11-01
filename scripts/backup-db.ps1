# ==============================================================================
# backup-db.ps1 — Automated PostgreSQL Database Backup (PowerShell / Windows)
# Hospital_CRM Production Disaster Recovery Infrastructure
# ==============================================================================

[CmdletBinding()]
param(
    [string]$BackupDir = "backups",
    [string]$PgHost = "localhost",
    [int]$PgPort = 5432,
    [string]$Database = "hospital_crm",
    [string]$User = "postgres"
)

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
$ResolvedBackupDir = Join-Path $RootDir $BackupDir
$Timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd_HHmmssZ")
$TargetDir = Join-Path $ResolvedBackupDir "backup_$Timestamp"

if (-not (Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}

$DumpFile = Join-Path $TargetDir "$($Database)_$Timestamp.dump"
$ChecksumFile = "$DumpFile.sha256"

Write-Host "==> Starting database backup for '$Database' at $Timestamp..." -ForegroundColor Cyan
Write-Host "    Host: ${PgHost}:${PgPort} | User: $User"

$env:PGCONNECT_TIMEOUT = "3"
$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDump) {
    Write-Error "pg_dump was not found on PATH. Install the PostgreSQL client tools and retry."
    exit 1
}

& $pgDump.Source --no-password --host=$PgHost --port=$PgPort --username=$User --format=custom --blobs --file=$DumpFile $Database
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $DumpFile)) {
    Write-Error "Backup failed: pg_dump exited with code $LASTEXITCODE and no archive was written."
    exit 1
}

$hash = (Get-FileHash -Path $DumpFile -Algorithm SHA256).Hash
"$hash  $((Get-Item $DumpFile).Name)" | Out-File -FilePath $ChecksumFile -Encoding utf8
Write-Host "==> Backup complete successfully!" -ForegroundColor Green
Write-Host "    Archive:  $DumpFile"
Write-Host "    Checksum: $ChecksumFile"
