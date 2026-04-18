$projectRoot = Split-Path -Parent $PSScriptRoot
$lockPath = Join-Path $projectRoot ".next\dev\lock"

Write-Host "RiskNova frontend dev reset basliyor..." -ForegroundColor Cyan

try {
  $escapedRoot = [Regex]::Escape($projectRoot)
  $nextProcesses = Get-CimInstance Win32_Process -ErrorAction Stop |
    Where-Object {
      $_.Name -eq "node.exe" -and
      $_.CommandLine -match $escapedRoot -and
      $_.CommandLine -match "next"
    }

  foreach ($process in $nextProcesses) {
    Write-Host ("Eski Next sureci kapatiliyor: PID {0}" -f $process.ProcessId) -ForegroundColor Yellow
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
  }
} catch {
  Write-Host "Surec taramasi yapilamadi, lock temizligi ile devam ediliyor." -ForegroundColor DarkYellow
}

Start-Sleep -Milliseconds 500

if (Test-Path $lockPath) {
  Remove-Item -LiteralPath $lockPath -Force -ErrorAction SilentlyContinue
  Write-Host "Stale lock temizlendi: .next\\dev\\lock" -ForegroundColor Green
}

Set-Location $projectRoot
& "C:\Program Files\nodejs\npm.cmd" run dev
