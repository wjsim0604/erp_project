param(
  [Parameter(Mandatory = $true)][string]$BaseUrl,
  [int]$TimeoutSeconds = 10,
  [string]$AlertWebhook = $env:OPS_ALERT_WEBHOOK,
  [string]$AlertToken = $env:OPS_ALERT_TOKEN
)
$ErrorActionPreference = 'Stop'
$uri = ([uri]$BaseUrl).AbsoluteUri.TrimEnd('/') + '/api/health'
try {
  $result = Invoke-RestMethod -Uri $uri -Method Get -TimeoutSec $TimeoutSeconds
  if ($result.status -ne 'ok' -or $result.checks.database -ne 'ok') { throw "Health response reports an unhealthy service: $($result | ConvertTo-Json -Compress)" }
  Write-Output "Healthy: $uri"
} catch {
  $message = "Health check failed for ${uri}: $($_.Exception.Message)"
  Write-Error $message
  if ($AlertWebhook) {
    $headers = @{}
    if ($AlertToken) { $headers.Authorization = "Bearer $AlertToken" }
    try { Invoke-RestMethod -Uri $AlertWebhook -Method Post -Headers $headers -ContentType 'application/json' -Body (@{ text = $message; service = 'flow-erp'; checkedUrl = $uri; timestamp = [DateTime]::UtcNow.ToString('o') } | ConvertTo-Json) -TimeoutSec $TimeoutSeconds | Out-Null }
    catch { Write-Warning "Alert webhook failed: $($_.Exception.Message)" }
  }
  exit 1
}
