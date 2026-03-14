$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot "backend"
$frontendDir = Join-Path $repoRoot "frontend"
$backendPython = Join-Path $backendDir ".venv\Scripts\python.exe"

$backendCommand = @"
Set-Location '$backendDir'
& '$backendPython' -m uvicorn main:app --host 127.0.0.1 --port 8000
"@

$frontendCommand = @"
Set-Location '$frontendDir'
npm.cmd run dev
"@

Start-Process powershell -ArgumentList "-ExecutionPolicy", "Bypass", "-NoExit", "-Command", $backendCommand
Start-Process powershell -ArgumentList "-ExecutionPolicy", "Bypass", "-NoExit", "-Command", $frontendCommand
