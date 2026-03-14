$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Uvicorn = Join-Path $Root "backend\venv\Scripts\uvicorn.exe"

Write-Host "Starting backend (FastAPI)..." -ForegroundColor Cyan
$backend = Start-Process -PassThru -NoNewWindow -WorkingDirectory "$Root\backend" `
    -FilePath $Uvicorn -ArgumentList "main:app --reload --port 8000"

Write-Host "Starting frontend (Vite)..." -ForegroundColor Cyan
$frontend = Start-Process -PassThru -NoNewWindow -FilePath "cmd.exe" `
    -ArgumentList "/c cd /d `"$Root\frontend`" && npx vite"

Write-Host ""
Write-Host "Backend:  http://localhost:8000" -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop both." -ForegroundColor Yellow
Write-Host ""

try {
    while (-not $backend.HasExited -or -not $frontend.HasExited) {
        Start-Sleep -Milliseconds 500
    }
} finally {
    if ($backend -and -not $backend.HasExited) { Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue }
    if ($frontend -and -not $frontend.HasExited) { Stop-Process -Id $frontend.Id -Force -ErrorAction SilentlyContinue }
    Write-Host "Shutting down..." -ForegroundColor Red
}
