param([ValidateSet('install', 'upgrade', 'uninstall')][string]$Action = 'install')
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$testRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '.tmp'))
$installDirectory = [IO.Path]::GetFullPath((Join-Path $testRoot '独立安装测试\中文安装目录\界络祈愿'))
if (-not $installDirectory.StartsWith($testRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw '测试安装路径越界。' }
$exe = Join-Path $installDirectory '界络祈愿.exe'
$data = Join-Path $testRoot '安装版中文老师\AppData\Roaming\界络祈愿'
$env:WISH_TEST_USER_DATA = $data
$reportFile = Join-Path $PSScriptRoot 'artifacts\installer-report.json'
function Assert-Test($condition, [string]$message) { if (-not $condition) { throw $message }; Write-Host "PASS $message" }
function Get-ProductRegistration {
  @(Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall' | ForEach-Object { Get-ItemProperty -LiteralPath $_.PSPath } | Where-Object { $_.DisplayName -eq '界络祈愿' })
}
$registration = @(Get-ProductRegistration)
foreach ($entry in $registration) {
  $registeredDirectory = $entry.InstallLocation
  if (-not $registeredDirectory -and $entry.UninstallString -match '^"([^"]+)"') { $registeredDirectory = [IO.Path]::GetDirectoryName($Matches[1]) }
  if (-not $registeredDirectory -or [IO.Path]::GetFullPath($registeredDirectory).TrimEnd('\') -ne $installDirectory) { throw '发现老师已有的正式安装，停止测试以保护原安装。' }
}
$desktopLink = Join-Path ([Environment]::GetFolderPath('Desktop')) '界络祈愿.lnk'
$startLink = Join-Path ([Environment]::GetFolderPath('Programs')) '界络祈愿.lnk'
if ($Action -eq 'install') {
  Assert-Test ($registration.Count -eq 0) '本机尚无同名正式安装'
  Assert-Test ((-not (Test-Path -LiteralPath $desktopLink)) -and (-not (Test-Path -LiteralPath $startLink))) '没有覆盖原有同名快捷方式'
}
$before = if (Test-Path -LiteralPath (Join-Path $data 'records.json')) { (Get-FileHash -LiteralPath (Join-Path $data 'records.json')).Hash } else { $null }
if ($Action -eq 'uninstall') {
  $uninstaller = Join-Path $installDirectory 'Uninstall 界络祈愿.exe'
  Assert-Test (Test-Path -LiteralPath $uninstaller) '存在可执行卸载程序'
  $process = Start-Process -FilePath $uninstaller -ArgumentList '/S' -WindowStyle Hidden -PassThru -Wait
  Assert-Test ($process.ExitCode -eq 0) '卸载程序成功退出'
  for ($i = 0; $i -lt 30 -and (Test-Path -LiteralPath $exe); $i++) { Start-Sleep -Milliseconds 500 }
  Assert-Test (-not (Test-Path -LiteralPath $exe)) '卸载移除程序文件'
  Assert-Test ((Get-ProductRegistration).Count -eq 0) '卸载移除当前用户注册项'
  Assert-Test ((-not (Test-Path -LiteralPath $desktopLink)) -and (-not (Test-Path -LiteralPath $startLink))) '卸载移除桌面和开始菜单快捷方式'
} else {
  $setup = Join-Path $projectRoot 'dist\界络祈愿 Setup.exe'
  # NSIS requires /D to be last; it consumes the entire remainder, including spaces.
  $process = Start-Process -FilePath $setup -ArgumentList "/S /D=$installDirectory" -WindowStyle Hidden -PassThru -Wait
  Assert-Test ($process.ExitCode -eq 0) '安装程序成功退出'
  Assert-Test (Test-Path -LiteralPath $exe) '成功安装到选择的独立中文目录'
  $version = (Get-Item -LiteralPath $exe).VersionInfo
  Assert-Test ($version.ProductName -eq '界络祈愿') '可执行文件正式显示界络祈愿名称'
  $entry = @(Get-ProductRegistration)
  Assert-Test ($entry.Count -eq 1) 'Windows 当前用户应用列表出现界络祈愿'
  $shell = New-Object -ComObject WScript.Shell
  foreach ($link in @($desktopLink, $startLink)) {
    Assert-Test (Test-Path -LiteralPath $link) '创建快捷方式'
    Assert-Test ($shell.CreateShortcut($link).TargetPath -eq $exe) '快捷方式指向实际安装程序'
  }
}
if ($before) { Assert-Test ((Get-FileHash -LiteralPath (Join-Path $data 'records.json')).Hash -eq $before) '升级或卸载后全部个人存档保持原样' }
$report = if (Test-Path -LiteralPath $reportFile) { Get-Content -LiteralPath $reportFile -Raw -Encoding UTF8 | ConvertFrom-Json } else { [pscustomobject]@{ installDirectory = $installDirectory; dataDirectory = $data; actions = @() } }
$report.actions = @($report.actions) + @([pscustomobject]@{ action = $Action; success = $true; time = (Get-Date).ToString('s'); recordsSha256 = $before })
$report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $reportFile -Encoding UTF8
