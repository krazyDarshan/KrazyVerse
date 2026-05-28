$ErrorActionPreference = 'Stop'

$envFile = Join-Path (Split-Path -Parent $PSScriptRoot) '.env'
$packagerHost = $null

if (Test-Path -LiteralPath $envFile) {
  $packagerHost = Get-Content -LiteralPath $envFile |
    Where-Object { $_ -match '^REACT_NATIVE_PACKAGER_HOSTNAME=' } |
    Select-Object -Last 1

  if ($packagerHost) {
    $packagerHost = $packagerHost -replace '^REACT_NATIVE_PACKAGER_HOSTNAME=', ''
  }
}

if (-not $packagerHost) {
  $packagerHost = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
      $_.IPAddress -notlike '127.*' -and
      $_.IPAddress -notlike '169.254.*' -and
      $_.IPAddress -notlike '172.*' -and
      $_.InterfaceAlias -notlike 'vEthernet*'
    } |
    Select-Object -First 1 -ExpandProperty IPAddress
}

if (-not $packagerHost) {
  throw 'Could not find your LAN IP.'
}

$statusUrl = "http://${packagerHost}:8081/status"
$apiUrl = "http://${packagerHost}:4000/health"

Write-Host "Open this on your PHONE browser while Expo is running:"
Write-Host $statusUrl
Write-Host ''
Write-Host 'Expected text: packager-status:running'
Write-Host ''
Write-Host 'PC checks:'
try {
  $status = Invoke-WebRequest -Uri $statusUrl -UseBasicParsing -TimeoutSec 5
  Write-Host "Metro from PC: OK ($([System.Text.Encoding]::UTF8.GetString($status.Content)))"
} catch {
  Write-Host "Metro from PC: FAIL ($($_.Exception.Message))"
}

try {
  $api = Invoke-WebRequest -Uri $apiUrl -UseBasicParsing -TimeoutSec 5
  Write-Host "API from PC: OK ($($api.StatusCode))"
} catch {
  Write-Host "API from PC: FAIL ($($_.Exception.Message))"
}
