$ErrorActionPreference = "Stop"
Write-Host "=== Hozurino local launcher ===" -ForegroundColor Cyan
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw "Python is not installed or not in PATH." }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "Node.js/npm is not installed or not in PATH." }

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

Set-Location $backend
if (-not (Test-Path ".venv")) { python -m venv .venv }
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt
$backendCmd = "Set-Location '$backend'; `$env:DATABASE_URL='sqlite:///./attendance.db'; `$env:SECRET_KEY='local-dev-secret'; & '.\.venv\Scripts\python.exe' -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd

Set-Location $frontend
if (-not (Test-Path "node_modules")) { npm install }
$frontendCmd = "Set-Location '$frontend'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd

Start-Sleep -Seconds 5
Start-Process "http://localhost:5173"
Write-Host "Frontend: http://localhost:5173"
Write-Host "API docs: http://localhost:8000/docs"
