# =============================================================================
# check-process-leaks.ps1 — CI Process-Leak Assertion
# Hospital_CRM Automation
# =============================================================================

[CmdletBinding()]
param(
    [int[]]$Ports = @(5000, 7001, 5173)
)

Write-Host "Verifying no leaked listening sockets on ports: $($Ports -join ', ')..." -ForegroundColor Cyan

$LeakedPorts = @()

foreach ($Port in $Ports) {
    $Connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($Connections) {
        foreach ($Conn in $Connections) {
            $Proc = Get-Process -Id $Conn.OwningProcess -ErrorAction SilentlyContinue
            if ($Proc -and ($Proc.ProcessName -in @('node', 'dotnet', 'Hospital_CRM.Api'))) {
                $LeakedPorts += [PSCustomObject]@{
                    Port = $Port
                    PID = $Conn.OwningProcess
                    Process = $Proc.ProcessName
                    State = $Conn.State
                }
            }
        }
    }
}

if ($LeakedPorts.Count -gt 0) {
    Write-Error "PROCESS LEAK DETECTED! Found active dev listeners after test teardown:"
    $LeakedPorts | Format-Table -AutoSize | Out-String | Write-Host -ForegroundColor Red
    exit 1
}

Write-Host "Success: Zero process leaks detected. All development ports closed." -ForegroundColor Green
exit 0
