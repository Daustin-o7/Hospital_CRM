# =============================================================================
# dev-start.ps1 — Standardized Local Dev Bring-Up
# Hospital_CRM Automation
# =============================================================================

[CmdletBinding()]
param(
    [switch]$DockerDependenciesOnly
)

$RootDir = Split-Path -Parent $PSScriptRoot

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Starting Hospital_CRM Development Environment" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Clean any lingering processes first
& "$PSScriptRoot\dev-stop.ps1"

# 2. Check if Docker is available for local dependencies (Postgres, Azurite, Typesense)
$DockerRunning = $false
try {
    $null = docker info 2>&1
    if ($LASTEXITCODE -eq 0) { $DockerRunning = $true }
} catch {}

if ($DockerRunning) {
    Write-Host "Bringing up PostgreSQL, Azurite & Typesense via Docker Compose..." -ForegroundColor Green
    docker compose up -d postgres azurite typesense
} else {
    Write-Warning "Docker is not currently running. Ensure local PostgreSQL (port 5432) is active."
}

if ($DockerDependenciesOnly) {
    Write-Host "Dependencies started. Exiting as requested by -DockerDependenciesOnly." -ForegroundColor Green
    exit 0
}

# 3. Environment Variables for Backend API
$env:ASPNETCORE_ENVIRONMENT = "Development"
$env:Jwt__Issuer = "Hospital_CRM"
$env:Jwt__Audience = "Hospital_CRM"
$env:Jwt__KeySource = "PemFile"

Write-Host "Building Backend (.NET 10)..." -ForegroundColor Cyan
dotnet build "$RootDir\backend\Hospital_CRM.Api\Hospital_CRM.Api.csproj"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Backend build failed."
    exit 1
}

Write-Host "`nEnvironment Ready!" -ForegroundColor Green
Write-Host "To launch Backend API:  dotnet run --project backend/Hospital_CRM.Api" -ForegroundColor Yellow
Write-Host "To launch Frontend PWA: cd frontend && npm run dev" -ForegroundColor Yellow
Write-Host "To stop all processes:  .\scripts\dev-stop.ps1`n" -ForegroundColor Yellow
