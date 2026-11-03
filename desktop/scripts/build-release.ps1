param(
  [string]$PrivateKeyPath = (Join-Path $HOME ".tauri\scanbridge.key"),
  [string]$Password = $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $PrivateKeyPath)) {
  Write-Error "Private key tidak ditemukan: $PrivateKeyPath"
  Write-Error "Generate dulu: npx tauri signer generate -w $PrivateKeyPath"
  exit 1
}

$env:TAURI_SIGNING_PRIVATE_KEY = (Get-Content $PrivateKeyPath -Raw).Trim()
$env:TAURI_SIGNING_PRIVATE_KEY_PATH = $PrivateKeyPath
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $Password

Write-Host "Menandatangani update updater dengan kunci: $PrivateKeyPath"
Push-Location (Join-Path $PSScriptRoot "..")
try {
  npm run build
  if ($LASTEXITCODE -ne 0) {
    throw "Build gagal (exit $LASTEXITCODE)"
  }
} finally {
  Pop-Location
}

$bundleDir = Join-Path $PSScriptRoot "..\src-tauri\target\release\bundle\nsis"
Write-Host ""
Write-Host "Selesai. Hasil di: $bundleDir"
Get-ChildItem $bundleDir -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name
