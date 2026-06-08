# Empacota a extensão Uniko Cat-Bot em public/uniko-catbot.zip
# Rode SEMPRE que alterar algo em extension/ :  npm run zip:ext
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$ext  = Join-Path $root 'extension'
$tmp  = Join-Path $env:TEMP 'uniko-catbot'
$dest = Join-Path $root 'public\uniko-catbot.zip'

if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
New-Item -ItemType Directory -Path $tmp | Out-Null
Copy-Item (Join-Path $ext '*') -Destination $tmp -Recurse

if (Test-Path $dest) { Remove-Item $dest -Force }
Compress-Archive -Path $tmp -DestinationPath $dest
Remove-Item $tmp -Recurse -Force

$ver = (Get-Content (Join-Path $ext 'manifest.json') -Raw | ConvertFrom-Json).version
Write-Output "OK -> public/uniko-catbot.zip (extensao v$ver)"
