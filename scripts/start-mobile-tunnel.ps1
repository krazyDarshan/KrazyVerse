$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$mobile = Join-Path $root 'apps\mobile'
$envFile = Join-Path $root '.env'

function Get-LanIp {
  $profiles = Get-NetConnectionProfile |
    Where-Object { $_.IPv4Connectivity -eq 'Internet' } |
    Sort-Object { if ($_.NetworkCategory -eq 'Private') { 0 } else { 1 } }

  foreach ($profile in $profiles) {
    $ip = Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias $profile.InterfaceAlias -ErrorAction SilentlyContinue |
      Where-Object {
        $_.IPAddress -notlike '127.*' -and
        $_.IPAddress -notlike '169.254.*' -and
        $_.IPAddress -notlike '172.*'
      } |
      Select-Object -First 1 -ExpandProperty IPAddress
    if ($ip) { return $ip }
  }

  throw 'Could not find a LAN IPv4 address. Connect to Wi-Fi and try again.'
}

function Set-EnvValue([string]$Name, [string]$Value) {
  if (-not (Test-Path -LiteralPath $envFile)) {
    New-Item -Path $envFile -ItemType File | Out-Null
  }

  $lines = Get-Content -LiteralPath $envFile -ErrorAction SilentlyContinue
  $entry = "$Name=$Value"
  $found = $false
  $updated = foreach ($line in $lines) {
    if ($line -match "^$([regex]::Escape($Name))=") {
      $found = $true
      $entry
    } else {
      $line
    }
  }

  if (-not $found) {
    $updated = @($updated) + $entry
  }

  Set-Content -LiteralPath $envFile -Value $updated
}

$lanIp = Get-LanIp
$apiUrl = "http://${lanIp}:4000/api/v1"

Set-EnvValue 'EXPO_PUBLIC_API_URL' $apiUrl
$env:EXPO_PUBLIC_API_URL = $apiUrl

# Let Expo/ngrok choose the public tunnel host. Keeping this value set forces
# LAN URLs into the QR code even when --tunnel is requested.
Remove-Item Env:\REACT_NATIVE_PACKAGER_HOSTNAME -ErrorAction SilentlyContinue

Write-Host "KrazyVerse API URL for Expo: $apiUrl"
Write-Host "Starting Expo tunnel. This bypasses Wi-Fi/router blocking."
Set-Location -LiteralPath $mobile
& npx.cmd expo start --tunnel --clear
