# Debug script
$ErrorActionPreference = "Stop"

$loginResp = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:5000/api/v1/auth/login" -ContentType "application/json" -Body '{"email":"admin@samstack.ai","password":"AdminPass123!"}'
$token = $loginResp.accessToken

# Test with explicit verbose
$headers = @{ "Authorization" = "Bearer $token" }
try {
    $response = Invoke-WebRequest -Method Get -Uri "http://127.0.0.1:5000/api/v1/clinic/profile" -Headers $headers -UseBasicParsing
    Write-Host "Status: $($response.StatusCode)"
    Write-Host "Body: $($response.Content)"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        Write-Host "Response body: $($reader.ReadToEnd())"
    }
}

# Also try patients/search which worked before
try {
    $patients = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:5000/api/v1/patients/search?q=test" -Headers $headers
    Write-Host "Patients search: OK, $($patients.Count) results"
} catch {
    Write-Host "Patients error: $($_.Exception.Message)"
}
