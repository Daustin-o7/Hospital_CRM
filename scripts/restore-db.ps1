# ==============================================================================
# restore-db.ps1 — PostgreSQL Database Restore & Verification (PowerShell / Windows)
# Hospital_CRM Production Disaster Recovery Infrastructure
# ==============================================================================

[CmdletBinding()]
param(
    [string]$BackupFile = "",
    [string]$PgHost = "localhost",
    [int]$PgPort = 5432,
    [string]$Database = "hospital_crm",
    [string]$User = "postgres"
)

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot

if (-not $BackupFile) {
    $BackupsDir = Join-Path $RootDir "backups"
    if (Test-Path $BackupsDir) {
        $latest = Get-ChildItem -Path $BackupsDir -Filter "*.dump" -Recurse | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($latest) {
            $BackupFile = $latest.FullName
            Write-Host "==> Auto-selected latest backup: $BackupFile" -ForegroundColor Cyan
        }
    }
}

if (-not $BackupFile -or -not (Test-Path $BackupFile)) {
    Write-Error "ERROR: Backup dump file not specified or file does not exist: '$BackupFile'."
    exit 1
}

$ChecksumFile = "$BackupFile.sha256"
if (Test-Path $ChecksumFile) {
    Write-Host "==> Verifying SHA256 integrity checksum..." -ForegroundColor Cyan
    $expectedHash = (Get-Content $ChecksumFile).Split(" ")[0].Trim()
    $actualHash = (Get-FileHash -Path $BackupFile -Algorithm SHA256).Hash
    if ($expectedHash -ieq $actualHash) {
        Write-Host "    Checksum OK ($actualHash)" -ForegroundColor Green
    } else {
        Write-Error "CHECKSUM MISMATCH! Expected: $expectedHash, Actual: $actualHash"
        exit 1
    }
}

Write-Host "==> Restoring database '$Database' from '$BackupFile'..." -ForegroundColor Cyan
$env:PGCONNECT_TIMEOUT = "3"
$pgRestore = Get-Command pg_restore -ErrorAction SilentlyContinue
if (-not $pgRestore) {
    Write-Error "pg_restore was not found on PATH. Install the PostgreSQL client tools and retry."
    exit 1
}

& $pgRestore.Source --no-password --host=$PgHost --port=$PgPort --username=$User --dbname=$Database --clean --if-exists --no-owner --no-privileges $BackupFile
if ($LASTEXITCODE -ne 0) {
    Write-Error "Restore failed: pg_restore exited with code $LASTEXITCODE."
    exit 1
}

$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
    Write-Error "psql was not found on PATH; cannot verify the restored database."
    exit 1
}

$userCount = & $psql.Source --no-password --host=$PgHost --port=$PgPort --username=$User --dbname=$Database -v ON_ERROR_STOP=1 -t -c 'SELECT count(*) FROM "Users";'
if ($LASTEXITCODE -ne 0) {
    Write-Error "Restore verification failed: the restored database did not answer the Users query."
    exit 1
}

Write-Host "==> Restoration verified successfully! Users restored: $($userCount.Trim())" -ForegroundColor Green
