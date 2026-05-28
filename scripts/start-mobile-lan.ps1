$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$mobile = Join-Path $root 'apps\mobile'
$envFile = Join-Path $root '.env'
$port = 8081

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

  $fallback = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
      $_.IPAddress -notlike '127.*' -and
      $_.IPAddress -notlike '169.254.*' -and
      $_.InterfaceAlias -notlike 'vEthernet*'
    } |
    Select-Object -First 1 -ExpandProperty IPAddress

  if (-not $fallback) {
    throw 'Could not find a LAN IPv4 address. Connect to Wi-Fi and try again.'
  }
  return $fallback
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

function Stop-PortListener([int]$Port) {
  $processIds = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($processId in $processIds) {
    if ($processId -and $processId -ne $PID) {
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
  }
}

function Ensure-FirewallRule([string]$Name, [int]$Port) {
  try {
    $existing = Get-NetFirewallRule -DisplayName $Name -ErrorAction SilentlyContinue
    if (-not $existing) {
      New-NetFirewallRule `
        -DisplayName $Name `
        -Direction Inbound `
        -Action Allow `
        -Protocol TCP `
        -LocalPort $Port `
        -Profile Any | Out-Null
    }
  } catch {
    Write-Warning "Could not create firewall rule for port ${Port}. If the phone cannot load, allow Node.js/port ${Port} in Windows Firewall."
  }
}

$lanIp = Get-LanIp
$apiUrl = "http://${lanIp}:4000/api/v1"

Set-EnvValue 'REACT_NATIVE_PACKAGER_HOSTNAME' $lanIp
Set-EnvValue 'EXPO_PUBLIC_API_URL' $apiUrl

$env:REACT_NATIVE_PACKAGER_HOSTNAME = $lanIp
$env:EXPO_PUBLIC_API_URL = $apiUrl

Write-Host "KrazyVerse mobile LAN IP: $lanIp"
Write-Host "KrazyVerse API URL for Expo: $apiUrl"
Ensure-FirewallRule 'KrazyVerse Expo Metro 8081' 8081
Ensure-FirewallRule 'KrazyVerse API 4000' 4000
Write-Host "Clearing stale Metro listener on port $port..."
Stop-PortListener $port

Set-Location -LiteralPath $mobile
Write-Host "Starting Expo. Keep this terminal open and scan the QR that appears below."
& npx.cmd expo start --lan --clear --port $port
