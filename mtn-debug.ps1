# MTN MoMo Direct Diagnostic — runs the full flow locally
# Replace MTN_USER_ID and MTN_API_KEY with your current secrets

$subscriptionKey = "3a6ab43342654a078155c974ef8f24a1"
$baseUrl = "https://sandbox.momodeveloper.mtn.com"
$targetEnv = "sandbox"
$currency = "EUR"
$amount = "1"
$testPhone = "46733123450"

# ---- PASTE YOUR CURRENT SECRETS BELOW ----
$userId = "3d187ed0-c444-45ba-b064-869742612cb4"
$apiKey = "db8753e7d7a64ac6a99b35b15349f544"
# ------------------------------------------

Write-Host ""
Write-Host "=== Step 1: Verify API user ===" -ForegroundColor Cyan
$verifyRes = Invoke-WebRequest -Uri "$baseUrl/v1_0/apiuser/$userId" -Method GET -UseBasicParsing `
  -Headers @{ "Ocp-Apim-Subscription-Key" = $subscriptionKey }
Write-Host "API user status: $($verifyRes.StatusCode)"
Write-Host $verifyRes.Content

Write-Host ""
Write-Host "=== Step 2: Get access token ===" -ForegroundColor Cyan
$credentials = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${userId}:${apiKey}"))
$tokenRes = Invoke-WebRequest -Uri "$baseUrl/collection/token/" -Method POST -UseBasicParsing `
  -Headers @{ "Authorization" = "Basic $credentials"; "Ocp-Apim-Subscription-Key" = $subscriptionKey; "Content-Type" = "application/json" }
Write-Host "Token status: $($tokenRes.StatusCode)"
$tokenData = $tokenRes.Content | ConvertFrom-Json
$token = $tokenData.access_token
Write-Host "Token obtained: $($token.Substring(0,20))..."

Write-Host ""
Write-Host "=== Step 3: requestToPay ($amount $currency to $testPhone) ===" -ForegroundColor Cyan
$refId = [System.Guid]::NewGuid().ToString()
Write-Host "Reference ID: $refId"

$payBody = "{`"amount`":`"$amount`",`"currency`":`"$currency`",`"externalId`":`"123456`",`"payer`":{`"partyIdType`":`"MSISDN`",`"partyId`":`"$testPhone`"},`"payerMessage`":`"Test`",`"payeeNote`":`"Test`"}"

$payRes = Invoke-WebRequest -Uri "$baseUrl/collection/v1_0/requesttopay" -Method POST -UseBasicParsing `
  -Headers @{
  "Authorization"             = "Bearer $token"
  "X-Reference-Id"            = $refId
  "X-Target-Environment"      = $targetEnv
  "Ocp-Apim-Subscription-Key" = $subscriptionKey
  "Content-Type"              = "application/json"
} `
  -Body $payBody
Write-Host "requestToPay status: $($payRes.StatusCode)  (expect 202)"

Write-Host ""
Write-Host "=== Waiting 10 seconds for sandbox to process... ===" -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host ""
Write-Host "=== Step 4: Check payment status ===" -ForegroundColor Cyan
$statusRes = Invoke-WebRequest -Uri "$baseUrl/collection/v1_0/requesttopay/$refId" -Method GET -UseBasicParsing `
  -Headers @{
  "Authorization"             = "Bearer $token"
  "X-Target-Environment"      = $targetEnv
  "Ocp-Apim-Subscription-Key" = $subscriptionKey
}
Write-Host "Status response code: $($statusRes.StatusCode)"
Write-Host $statusRes.Content
