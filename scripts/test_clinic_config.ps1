# Test script for clinic configuration API
$ErrorActionPreference = "Stop"

try {
    Write-Host "Logging in..."
    $loginResp = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:5000/api/v1/auth/login" -ContentType "application/json" -Body '{"email":"admin@samstack.ai","password":"AdminPass123!"}'
    $token = $loginResp.accessToken
    Write-Host "Token obtained (length: $($token.Length))"

    $headers = @{ "Authorization" = "Bearer $token" }

    Write-Host "`n=== Test 1: GET /api/v1/clinic/profile ==="
    $profile = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:5000/api/v1/clinic/profile" -Headers $headers
    Write-Host "Clinic: $($profile.name)"
    Write-Host "Timezone: $($profile.timezone)"
    Write-Host "Currency: $($profile.currency)"
    Write-Host "PrimaryColor: $($profile.primaryColor)"
    Write-Host "DefaultAppointmentDuration: $($profile.defaultAppointmentDurationMinutes)"
    Write-Host "WalkInsAllowed: $($profile.walkInsAllowed)"
    Write-Host "Working Hours Count: $($profile.workingHours.Count)"
    Write-Host "`nAll Working Hours (should have 14 = 7 days x 2 shifts):"
    $profile.workingHours | Select-Object day, open, close, shiftIndex | Format-Table | Out-String | Write-Host
} catch {
    Write-Host "ERROR: $_"
}
