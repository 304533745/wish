$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$testRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '.tmp'))
$installDirectory = [IO.Path]::GetFullPath((Join-Path $testRoot '独立安装测试\中文安装目录\界络祈愿'))
if (-not $installDirectory.StartsWith($testRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw '测试安装路径越界。' }
$nodeExecutable = Join-Path $projectRoot '.cache\tools\node\node.exe'
$links = @(
  (Join-Path ([Environment]::GetFolderPath('Desktop')) '界络祈愿.lnk'),
  (Join-Path ([Environment]::GetFolderPath('Programs')) '界络祈愿.lnk')
)
$shell = New-Object -ComObject WScript.Shell
$savedLinks = @{}
$shortcutBackup = Join-Path $testRoot ('原快捷方式备份-' + (Get-Date).ToString('yyyyMMdd-HHmmss'))
[IO.Directory]::CreateDirectory($shortcutBackup) | Out-Null
foreach ($link in $links) {
  if ([IO.File]::Exists($link)) {
    $savedLinks[$link] = [IO.File]::ReadAllBytes($link)
    $name = if ($link -eq $links[0]) { '桌面.lnk' } else { '开始菜单.lnk' }
    [IO.File]::WriteAllBytes((Join-Path $shortcutBackup $name), $savedLinks[$link])
  }
}
function Invoke-Checked([string]$file, [string[]]$arguments) {
  & $file @arguments
  if ($LASTEXITCODE -ne 0) { throw "测试失败：$file，退出码 $LASTEXITCODE" }
}
$installed = $false
try {
  # The lifecycle script refuses to replace any existing registration outside
  # this isolated directory. Existing shortcuts are restored byte-for-byte.
  Invoke-Checked 'powershell.exe' @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'install-lifecycle.ps1'),'-Action','upgrade')
  $installed = $true
  $env:WISH_TEST_EXE = Join-Path $installDirectory '界络祈愿.exe'
  $env:WISH_TEST_USER_DATA = Join-Path $testRoot '安装版中文老师\AppData\Roaming\界络祈愿'
  $env:WISH_TEST_REPORT = 'installed-1.5.1-report.json'
  Invoke-Checked $nodeExecutable @((Join-Path $PSScriptRoot 'desktop.test.cjs'))
  Invoke-Checked 'powershell.exe' @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'normal-launch.ps1'))
  Invoke-Checked $nodeExecutable @((Join-Path $PSScriptRoot 'portable.test.cjs'))
  Invoke-Checked 'powershell.exe' @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'install-lifecycle.ps1'),'-Action','upgrade')
} finally {
  try {
    if ($installed) {
      Invoke-Checked 'powershell.exe' @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'install-lifecycle.ps1'),'-Action','uninstall')
    }
  } finally {
    foreach ($link in $links) {
      if ($savedLinks.ContainsKey($link)) {
        [IO.File]::WriteAllBytes($link, $savedLinks[$link])
        $current = [Convert]::ToBase64String([IO.File]::ReadAllBytes($link))
        if ($current -ne [Convert]::ToBase64String($savedLinks[$link])) { throw '原快捷方式还原校验失败。' }
      } elseif ([IO.File]::Exists($link)) {
        # Remove only a newly created link pointing at the verified test target.
        if ($shell.CreateShortcut($link).TargetPath -eq (Join-Path $installDirectory '界络祈愿.exe')) { Remove-Item -LiteralPath $link }
      }
    }
    Remove-Item Env:WISH_TEST_EXE,Env:WISH_TEST_USER_DATA,Env:WISH_TEST_REPORT -ErrorAction SilentlyContinue
    Write-Host '已还原原有桌面和开始菜单快捷方式。'
  }
}
Write-Host 'PASS 最新安装包在独立中文目录运行、重启、升级、免安装和卸载检查全部通过'
