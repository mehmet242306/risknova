$projectRoot = Split-Path -Parent $PSScriptRoot
$lockPath = Join-Path $projectRoot ".next\dev\lock"

Write-Host "RiskNova frontend dev reset basliyor..." -ForegroundColor Cyan

function Stop-NodeProcessesOnDevPorts {
  $candidatePorts = 3000..3005
  $portOwners = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $candidatePorts -contains $_.LocalPort } |
    Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($pid in $portOwners) {
    $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
    if ($proc -and $proc.ProcessName -eq "node") {
      Write-Host ("Port tabanli temizlik: PID {0} kapatiliyor" -f $pid) -ForegroundColor Yellow
      Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
  }
}

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
  Write-Host "Surec taramasi yapilamadi, port tabanli temizlik deneniyor." -ForegroundColor DarkYellow
  Stop-NodeProcessesOnDevPorts
}

Start-Sleep -Milliseconds 500

if (Test-Path $lockPath) {
  Remove-Item -LiteralPath $lockPath -Force -ErrorAction SilentlyContinue
  Write-Host "Stale lock temizlendi: .next\\dev\\lock" -ForegroundColor Green
}

Set-Location $projectRoot
& "C:\Program Files\nodejs\npm.cmd" run dev
