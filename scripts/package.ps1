$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $projectRoot
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
$nodeExecutable = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $projectRoot '.cache/tools/node/node.exe' }
if (-not (Test-Path -LiteralPath $nodeExecutable)) { throw '维护者打包时需要 Node.js 24.15+。老师运行安装包不需要 Node。' }
$localNpm = Join-Path $projectRoot '.cache/tools/npm/package/bin/npm-cli.js'
$env:PATH = [System.IO.Path]::GetDirectoryName($nodeExecutable) + ';' + (Join-Path $projectRoot '.cache/tools/bin') + ';' + $env:PATH
if (-not (Test-Path -LiteralPath 'node_modules/electron-builder/package.json')) {
  throw '请先执行 npm ci --allow-git=all 安装构建依赖。'
}
if (Test-Path -LiteralPath $localNpm) { & $nodeExecutable $localNpm run dist } else { & npm.cmd run dist }
if ($LASTEXITCODE -ne 0) { throw '构建失败，请查看上面的错误。' }
Write-Host '已生成 dist\界络祈愿 Setup.exe 和 dist\界络祈愿 Portable.exe'
