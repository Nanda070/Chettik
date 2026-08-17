param(
  [string]$Database = "chettik.db",
  [string]$MediaRoot = "backend/media",
  [string]$Destination = "backups"
)

$ErrorActionPreference = "Stop"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$target = Join-Path $Destination "chettik-$stamp"
New-Item -ItemType Directory -Force $target | Out-Null

if (Test-Path $Database) {
  Copy-Item $Database (Join-Path $target "chettik.db")
  foreach ($suffix in @("-wal", "-shm")) {
    if (Test-Path "$Database$suffix") { Copy-Item "$Database$suffix" (Join-Path $target "chettik.db$suffix") }
  }
}
if (Test-Path $MediaRoot) { Copy-Item $MediaRoot (Join-Path $target "media") -Recurse -Force }

$manifest = @{ createdAt = (Get-Date).ToUniversalTime().ToString("o"); database = $Database; mediaRoot = $MediaRoot } | ConvertTo-Json
Set-Content -Path (Join-Path $target "manifest.json") -Value $manifest -Encoding utf8
Compress-Archive -Path "$target\*" -DestinationPath "$target.zip" -Force
Remove-Item $target -Recurse -Force
Write-Host "Local backup created: $target.zip"
