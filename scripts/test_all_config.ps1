# Test the new clinic configuration endpoints
$ErrorActionPreference = "Continue"

Write-Host "=== 1. LOGIN ===" -ForegroundColor Cyan
$loginResp = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:5000/api/v1/auth/login" -ContentType "application/json" -Body '{"email":"admin@samstack.ai","password":"AdminPass123!"}'
$token = $loginResp.accessToken
$headers = @{ "Authorization" = "Bearer $token" }
Write-Host "Login OK"

Write-Host "`n=== 2. GET PROFILE (should show 14 working hours, 7 days, 2 shifts each) ===" -ForegroundColor Cyan
$profile = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:5000/api/v1/clinic/profile" -Headers $headers
Write-Host "Clinic: $($profile.name) | Timezone: $($profile.timezone) | Currency: $($profile.currency)"
Write-Host "Working hours count: $($profile.workingHours.Count)"
Write-Host "Days configured: $((($profile.workingHours | Group-Object day).Name | Sort-Object) -join ', ')"

Write-Host "`n=== 3. UPDATE HOURS (change Sunday to closed) ===" -ForegroundColor Cyan
$updateBody = @{
    workingHours = @(
        @{ day = "monday"; shiftIndex = 0; open = "09:00"; close = "18:00" }
        @{ day = "tuesday"; shiftIndex = 0; open = "09:00"; close = "18:00" }
        @{ day = "wednesday"; shiftIndex = 0; open = "09:00"; close = "18:00" }
        @{ day = "thursday"; shiftIndex = 0; open = "09:00"; close = "18:00" }
        @{ day = "friday"; shiftIndex = 0; open = "09:00"; close = "18:00" }
        # Saturday and Sunday are intentionally omitted (closed)
    )
} | ConvertTo-Json
try {
    $updateResult = Invoke-RestMethod -Method Put -Uri "http://127.0.0.1:5000/api/v1/clinic/hours" -Headers $headers -ContentType "application/json" -Body $updateBody
    Write-Host "Update hours result: $($updateResult.message)"
} catch {
    Write-Host "Update hours error: $($_.Exception.Message)"
}

Write-Host "`n=== 4. VERIFY UPDATE (should show only Mon-Fri) ===" -ForegroundColor Cyan
$profile2 = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:5000/api/v1/clinic/profile" -Headers $headers
Write-Host "Working hours count after update: $($profile2.workingHours.Count)"
Write-Host "Days: $((($profile2.workingHours | Group-Object day).Name | Sort-Object) -join ', ')"

Write-Host "`n=== 5. ADD HOLIDAY (single date) ===" -ForegroundColor Cyan
$holidayBody = @{
    name = "Independence Day Test"
    startDate = "2026-08-15"
    endDate = "2026-08-15"
    recurringAnnually = $true
    internalNote = "Test holiday"
} | ConvertTo-Json
try {
    $holiday = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:5000/api/v1/clinic/holidays" -Headers $headers -ContentType "application/json" -Body $holidayBody
    Write-Host "Holiday created: $($holiday | ConvertTo-Json -Compress)"
} catch {
    Write-Host "Holiday error: $($_.Exception.Message)"
}

Write-Host "`n=== 6. ADD DATE-RANGE HOLIDAY (multi-day closure) ===" -ForegroundColor Cyan
$rangeBody = @{
    name = "Annual Closure"
    startDate = "2026-12-25"
    endDate = "2026-12-27"
    recurringAnnually = $false
} | ConvertTo-Json
try {
    $range = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:5000/api/v1/clinic/holidays" -Headers $headers -ContentType "application/json" -Body $rangeBody
    Write-Host "Range holiday created: id=$($range.holidayId) name=$($range.name)"
} catch {
    Write-Host "Range holiday error: $($_.Exception.Message)"
}

Write-Host "`n=== 7. ADD SPECIAL HOUR (Sunday open 10-14) ===" -ForegroundColor Cyan
$specialBody = @{
    date = "2026-08-30"
    open = "10:00"
    close = "14:00"
    reason = "Special Sunday clinic"
} | ConvertTo-Json
try {
    $special = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:5000/api/v1/clinic/special-hours" -Headers $headers -ContentType "application/json" -Body $specialBody
    Write-Host "Special hour created: id=$($special.specialId) date=$($special.date)"
} catch {
    Write-Host "Special hour error: $($_.Exception.Message)"
}

Write-Host "`n=== 8. FINAL VERIFICATION (should show Mon-Fri hours, 2 holidays, 1 special hour) ===" -ForegroundColor Cyan
$final = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:5000/api/v1/clinic/profile" -Headers $headers
Write-Host "Working hours: $($final.workingHours.Count) entries | Days: $((($final.workingHours | Group-Object day).Name | Sort-Object) -join ', ')"
Write-Host "Holidays: $($final.holidays.Count) entries"
$final.holidays | ForEach-Object { Write-Host "  - $($_.name) ($($_.startDate) to $($_.endDate))" }
Write-Host "Special hours: $($final.specialHours.Count) entries"
$final.specialHours | ForEach-Object { Write-Host "  - $($_.date) $($_.open)-$($_.close) ($($_.reason))" }

Write-Host "`n=== 9. UPDATE PROFILE NAME (test PUT /profile) ===" -ForegroundColor Cyan
$nameBody = @{ name = "SAMSTACK AI Demo Clinic" } | ConvertTo-Json
try {
    $nameResult = Invoke-RestMethod -Method Put -Uri "http://127.0.0.1:5000/api/v1/clinic/profile" -Headers $headers -ContentType "application/json" -Body $nameBody
    Write-Host "Profile updated: $($nameResult | ConvertTo-Json -Compress)"
} catch {
    Write-Host "Profile update error: $($_.Exception.Message)"
}

Write-Host "`n=== ALL TESTS COMPLETED ===" -ForegroundColor Green
