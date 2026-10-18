# =============================================================================
# dev-stop.ps1 — Graceful Stop & Orphaned Process Cleaner
# Hospital_CRM Local Development Tooling
# =============================================================================

[CmdletBinding()]
param()

$Ports = @(5000, 7001, 5173)
$TargetProcessNames = @('node', 'dotnet', 'Hospital_CRM.Api')

Write-Host "--- Scanning for lingering Hospital_CRM processes on ports: $($Ports -join ', ') ---" -ForegroundColor Cyan

$KilledCount = 0

foreach ($Port in $Ports) {
    try {
        $Connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        if ($Connections) {
            foreach ($Conn in $Connections) {
                $PidToKill = $Conn.OwningProcess
                if ($PidToKill -gt 0) {
                    $Proc = Get-Process -Id $PidToKill -ErrorAction SilentlyContinue
                    if ($Proc -and ($Proc.ProcessName -in $TargetProcessNames)) {
                        Write-Host "Terminating process: $($Proc.ProcessName) (PID: $PidToKill) on port $Port" -ForegroundColor Yellow
                        Stop-Process -Id $PidToKill -Force -ErrorAction SilentlyContinue
                        $KilledCount++
                    }
                }
            }
        }
    } catch {
        Write-Warning "Could not query port $Port : $_"
    }
}

if ($KilledCount -eq 0) {
    Write-Host "No orphaned development processes found on ports $($Ports -join ', ')." -ForegroundColor Green
} else {
    Write-Host "Successfully terminated $KilledCount orphaned process(es)." -ForegroundColor Green
}
