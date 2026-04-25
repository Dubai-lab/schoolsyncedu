$subscriptionKey = "3a6ab43342654a078155c974ef8f24a1"
$baseUrl = "https://sandbox.momodeveloper.mtn.com"
$callbackHost = "zjwgqosyffyisatfgmff.supabase.co"

$userId = [System.Guid]::NewGuid().ToString()

Write-Host "Creating MTN API user: $userId"

$body1 = "{`"providerCallbackHost`":`"$callbackHost`"}"

$r1 = Invoke-WebRequest -Uri "$baseUrl/v1_0/apiuser" -Method POST -UseBasicParsing `
  -Headers @{ "X-Reference-Id" = $userId; "Ocp-Apim-Subscription-Key" = $subscriptionKey; "Content-Type" = "application/json" } `
  -Body $body1

if ($r1.StatusCode -ne 201) {
  Write-Host "FAILED to create API user. Status: $($r1.StatusCode)"
  Write-Host $r1.Content
  exit 1
}

Write-Host "API user created OK"

$r2 = Invoke-WebRequest -Uri "$baseUrl/v1_0/apiuser/$userId/apikey" -Method POST -UseBasicParsing `
  -Headers @{ "Ocp-Apim-Subscription-Key" = $subscriptionKey; "Content-Type" = "application/json" }

if ($r2.StatusCode -ne 201) {
  Write-Host "FAILED to create API key. Status: $($r2.StatusCode)"
  Write-Host $r2.Content
  exit 1
}

$apiKey = ($r2.Content | ConvertFrom-Json).apiKey

Write-Host ""
Write-Host "SUCCESS - Add these to Supabase Edge Function Secrets:"
Write-Host ""
Write-Host "MTN_USER_ID = $userId"
Write-Host "MTN_API_KEY = $apiKey"
Write-Host ""
