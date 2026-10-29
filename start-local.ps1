# Запуск PetShop MVP на локальній машині (Windows PowerShell 5.1+ або PowerShell 7).
# Потрібен Node.js 20.9+ (рекомендовано 22 LTS): https://nodejs.org
# Використання:
#   powershell -ExecutionPolicy Bypass -File .\start-local.ps1
#   powershell -ExecutionPolicy Bypass -File .\start-local.ps1 -WebPort 3107 -ApiPort 4000 -Reset
# Повний журнал запуску: start-local.log (надішліть його, якщо щось не працює).
param([int]$WebPort = 3107, [int]$ApiPort = 4000, [switch]$Reset)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$log = Join-Path $root "start-local.log"
Start-Transcript -Path $log -Force | Out-Null

function Fail($msg) { Write-Host ""; Write-Host "ПОМИЛКА: $msg" -ForegroundColor Red; Write-Host "Журнал: $log"; Stop-Transcript | Out-Null; Read-Host "Натисніть Enter, щоб закрити"; exit 1 }
function Step($msg) { Write-Host ""; Write-Host "==> $msg" -ForegroundColor Cyan }
function Run($what) { & $what; if ($LASTEXITCODE -ne 0) { Fail "крок завершився з кодом $LASTEXITCODE" } }
function PortBusy($p) { try { $c = New-Object Net.Sockets.TcpClient; $c.Connect("127.0.0.1", $p); $c.Close(); return $true } catch { return $false } }

try {
  $api = Join-Path $root "apps\api"; $web = Join-Path $root "apps\web"

  Step "Перевірка Node.js"
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) { Fail "Node.js не знайдено в PATH. Встановіть Node.js 22 LTS з https://nodejs.org і відкрийте НОВЕ вікно PowerShell." }
  $ver = (& node --version).TrimStart("v"); $major, $minor = $ver.Split(".")[0..1] | ForEach-Object { [int]$_ }
  Write-Host "Node $ver ($($node.Source))"
  if ($major -lt 20 -or ($major -eq 20 -and $minor -lt 9)) { Fail "потрібен Node.js 20.9+, встановлено $ver" }
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { Fail "npm не знайдено (переінсталюйте Node.js)" }

  foreach ($p in @($ApiPort, $WebPort)) { if (PortBusy $p) { Fail "порт $p уже зайнятий. Закрийте попередній запуск або вкажіть інший: -WebPort 3200 -ApiPort 4200" } }

  Step "API: встановлення залежностей і збірка"
  Push-Location $api
  if (-not (Test-Path node_modules)) { Run { npm ci --no-audit --no-fund } }
  Run { npm run build }
  if ($Reset -and (Test-Path .data)) { Remove-Item -Recurse -Force .data }
  Step "API: база даних (міграції + демо-дані)"
  Run { npm run db:reset }
  Pop-Location

  Step "Вітрина: встановлення залежностей і збірка"
  Push-Location $web
  if (-not (Test-Path node_modules)) { Run { npm ci --no-audit --no-fund } }
  $env:API_URL = "http://127.0.0.1:$ApiPort/api/v1"; $env:SITE_URL = "http://127.0.0.1:$WebPort"; $env:NEXT_TELEMETRY_DISABLED = "1"
  Run { npm run build }
  Pop-Location

  Step "Запуск серверів (окремі вікна; закрийте їх, щоб зупинити)"
  $apiCmd = Join-Path $root "run-api.ps1"; $webCmd = Join-Path $root "run-web.ps1"
  Set-Content -Encoding UTF8 $apiCmd "`$host.UI.RawUI.WindowTitle='PetShop API :$ApiPort'; Set-Location '$api'; `$env:PORT='$ApiPort'; `$env:HOST='127.0.0.1'; `$env:WEB_ORIGIN='http://127.0.0.1:$WebPort,http://localhost:$WebPort'; node dist/main.js"
  Set-Content -Encoding UTF8 $webCmd "`$host.UI.RawUI.WindowTitle='PetShop Web :$WebPort'; Set-Location '$web'; `$env:API_URL='http://127.0.0.1:$ApiPort/api/v1'; `$env:SITE_URL='http://127.0.0.1:$WebPort'; node node_modules/next/dist/bin/next start -p $WebPort -H 127.0.0.1"
  Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "`"$apiCmd`""
  $ok = $false; for ($i = 0; $i -lt 30; $i++) { Start-Sleep 1; try { if ((Invoke-WebRequest "http://127.0.0.1:$ApiPort/api/v1/health" -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) { $ok = $true; break } } catch {} }
  if (-not $ok) { Fail "API не відповідає на http://127.0.0.1:$ApiPort/api/v1/health — подивіться вікно 'PetShop API'" }
  Write-Host "API працює: http://127.0.0.1:$ApiPort/api/v1" -ForegroundColor Green
  Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "`"$webCmd`""
  $ok = $false; for ($i = 0; $i -lt 30; $i++) { Start-Sleep 1; try { if ((Invoke-WebRequest "http://127.0.0.1:$WebPort/" -UseBasicParsing -TimeoutSec 10).StatusCode -eq 200) { $ok = $true; break } } catch {} }
  if (-not $ok) { Fail "вітрина не відповідає на http://127.0.0.1:$WebPort — подивіться вікно 'PetShop Web'" }

  Write-Host ""; Write-Host "Готово. Вітрина: http://127.0.0.1:$WebPort   API: http://127.0.0.1:$ApiPort/api/v1" -ForegroundColor Green
  Write-Host "Демо-вхід: телефон +380500000001 (код показується на екрані в демо-режимі)"
  Start-Process "http://127.0.0.1:$WebPort"
  Stop-Transcript | Out-Null
} catch { Fail $_.Exception.Message }
