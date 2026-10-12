$ErrorActionPreference = 'Stop'
$testRoot = Join-Path $PSScriptRoot '.tmp'
$exe = Join-Path $testRoot '独立安装测试\中文安装目录\界络祈愿\界络祈愿.exe'
$env:WISH_TEST_USER_DATA = Join-Path $testRoot '安装版中文老师\AppData\Roaming\界络祈愿'
$env:TEMP = Join-Path $testRoot '中文临时目录'
$env:TMP = $env:TEMP
$env:PATH = "$env:SystemRoot\System32"
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
$process = Start-Process -FilePath $exe -WindowStyle Hidden -PassThru
try {
  for ($i = 0; $i -lt 100; $i++) { $process.Refresh(); if ($process.MainWindowHandle -ne 0 -and $process.MainWindowTitle -eq '界络祈愿') { break }; Start-Sleep -Milliseconds 200 }
  if ($process.MainWindowHandle -eq 0 -or $process.MainWindowTitle -ne '界络祈愿') { throw "普通启动窗口异常：handle=$($process.MainWindowHandle)，title=$($process.MainWindowTitle)" }
  $ids = @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq $exe } | ForEach-Object { $_.ProcessId })
  $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -in $ids })
  if ($listeners.Count -ne 0) { throw '普通运行出现意外监听端口。' }
  $second = Start-Process -FilePath $exe -WindowStyle Hidden -PassThru -Wait
  if ($second.ExitCode -ne 0) { throw '重复启动未正常切回已有实例。' }
  $portable = Join-Path (Split-Path $PSScriptRoot -Parent) 'dist\界络祈愿 Portable.exe'
  $portableInstance = Start-Process -FilePath $portable -WindowStyle Hidden -PassThru -Wait
  if ($portableInstance.ExitCode -ne 0) { throw '免安装版未切回已有安装版实例。' }
  $windows = @(Get-Process | Where-Object { $_.Path -eq $exe -and $_.MainWindowHandle -ne 0 })
  if ($windows.Count -ne 1) { throw '重复启动产生了额外窗口。' }
  if (-not $process.CloseMainWindow()) { throw '普通窗口关闭失败。' }
  if (-not $process.WaitForExit(15000)) { throw '普通窗口关闭后进程没有退出。' }
  Start-Sleep -Milliseconds 1500
  if (@(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq $exe }).Count -ne 0) { throw '关闭后遗留应用子进程。' }
  [pscustomobject]@{ success = $true; normalLaunch = $true; noNodePath = $true; listeningPorts = 0; singleWindow = $true; portableSharesInstance = $true; noRemainingProcesses = $true } | ConvertTo-Json | Set-Content (Join-Path $PSScriptRoot 'artifacts\normal-launch-report.json') -Encoding UTF8
  Write-Host 'PASS 普通启动、正式标题、无服务器端口、单实例和原生窗口关闭后无残留进程'
} finally { $process.Refresh(); if (-not $process.HasExited) { [void]$process.CloseMainWindow(); if (-not $process.WaitForExit(3000)) { $process.Kill() } } }
