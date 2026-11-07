param(
  [string]$NodeVersion = "20.18.1",
  [string]$ProjectRoot = "",
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

if (-not $ProjectRoot) {
  $ProjectRoot = Split-Path -Parent $PSScriptRoot
}
$root = (Resolve-Path -LiteralPath $ProjectRoot).Path
Set-Location -LiteralPath $root

$packageName = "yanmo-portable-win64"
$outDir = Join-Path $root "dist"
$staging = Join-Path $outDir $packageName
$zipPath = Join-Path $outDir "$packageName.zip"
$templateDir = Join-Path $PSScriptRoot "portable"

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Fail([string]$Message) {
  Write-Host ""
  Write-Host "[构建失败] $Message" -ForegroundColor Red
  exit 1
}

$npm = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
if (-not $npm) {
  Fail "没有找到 npm.cmd。请先安装 Node.js 18.17+，再运行 npm run build:portable。"
}

if (-not $SkipBuild) {
  if (-not (Test-Path -LiteralPath "node_modules")) {
    Write-Step "安装项目依赖"
    & $npm.Source install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Fail "依赖安装失败，请检查网络后重试。" }
  }

  Write-Step "构建 Next.js（standalone）"
  & $npm.Source run build
  if ($LASTEXITCODE -ne 0) { Fail "Next.js 构建失败，请查看上方日志。" }
}

$standalone = Join-Path $root ".next\standalone"
if (-not (Test-Path -LiteralPath (Join-Path $standalone "server.js"))) {
  Fail "没有找到 .next\standalone\server.js。请确认 next.config.mjs 中已启用 output: `"standalone`"。"
}

if (-not (Test-Path -LiteralPath $templateDir)) {
  Fail "缺少便携版启动模板：$templateDir"
}

Write-Step "准备便携包目录"
if (Test-Path -LiteralPath $staging) {
  Remove-Item -LiteralPath $staging -Recurse -Force
}
New-Item -ItemType Directory -Path $staging -Force | Out-Null

# 1. standalone 服务端与精简依赖
Copy-Item -Path (Join-Path $standalone "*") -Destination $staging -Recurse -Force

# 2. 前端静态资源必须放在 standalone 的 .next/static 下
$staticSource = Join-Path $root ".next\static"
$staticTarget = Join-Path $staging ".next\static"
New-Item -ItemType Directory -Path $staticTarget -Force | Out-Null
Copy-Item -Path (Join-Path $staticSource "*") -Destination $staticTarget -Recurse -Force

# 3. public（如果项目以后加入静态文件）
$publicSource = Join-Path $root "public"
if (Test-Path -LiteralPath $publicSource) {
  $publicTarget = Join-Path $staging "public"
  New-Item -ItemType Directory -Path $publicTarget -Force | Out-Null
  Copy-Item -Path (Join-Path $publicSource "*") -Destination $publicTarget -Recurse -Force
}

# 4. 便携 Node 运行时：用户无需安装 Node.js
Write-Step "准备 Node.js v$NodeVersion 运行时"
$runtimeDir = Join-Path $staging "runtime"
New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
$nodeExe = Join-Path $runtimeDir "node.exe"
$nodeLabel = "Node.js v$NodeVersion (win-x64)"

if (-not (Test-Path -LiteralPath $nodeExe)) {
  $downloadDir = Join-Path $outDir ".node-download"
  if (Test-Path -LiteralPath $downloadDir) {
    Remove-Item -LiteralPath $downloadDir -Recurse -Force
  }
  New-Item -ItemType Directory -Path $downloadDir -Force | Out-Null

  $archiveName = "node-v$NodeVersion-win-x64.zip"
  $archivePath = Join-Path $downloadDir $archiveName
  $urls = @(
    "https://nodejs.org/dist/v$NodeVersion/$archiveName",
    "https://npmmirror.com/mirrors/node/v$NodeVersion/$archiveName",
    "https://cdn.npmmirror.com/binaries/node/v$NodeVersion/$archiveName"
  )

  $downloaded = $false
  foreach ($url in $urls) {
    try {
      Write-Host "下载 $url"
      Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $archivePath -TimeoutSec 600
      $downloaded = $true
      break
    } catch {
      Write-Host "该地址下载失败，尝试下一个镜像……" -ForegroundColor Yellow
    }
  }

  if ($downloaded) {
    Expand-Archive -LiteralPath $archivePath -DestinationPath $downloadDir -Force
    $extracted = Join-Path $downloadDir "node-v$NodeVersion-win-x64"
    if (-not (Test-Path -LiteralPath (Join-Path $extracted "node.exe"))) {
      Fail "Node.js 压缩包内容不完整。"
    }
    Copy-Item -LiteralPath (Join-Path $extracted "node.exe") -Destination $nodeExe -Force
    $license = Join-Path $extracted "LICENSE"
    if (Test-Path -LiteralPath $license) {
      Copy-Item -LiteralPath $license -Destination (Join-Path $runtimeDir "NODE-LICENSE.txt") -Force
    }
  } else {
    # 没有外网时退回本机 Node.js，保证仍然能生成可用的绿色包
    $localNode = Get-Command "node.exe" -ErrorAction SilentlyContinue
    if (-not $localNode) { $localNode = Get-Command "node" -ErrorAction SilentlyContinue }
    if (-not $localNode -or -not $localNode.Source) {
      Fail "无法下载 Node.js，也没有找到本机 Node.js。请联网后重试，或先安装 Node.js。"
    }
    Write-Host "无法下载指定版本，改用本机 Node.js：$($localNode.Source)" -ForegroundColor Yellow
    Copy-Item -LiteralPath $localNode.Source -Destination $nodeExe -Force
    $nodeLabel = "本机 Node.js"
  }

  Remove-Item -LiteralPath $downloadDir -Recurse -Force -ErrorAction SilentlyContinue
}

try {
  $actualVersion = (& $nodeExe --version) 2>$null
  if ($actualVersion) { $nodeLabel = "$nodeLabel $actualVersion" }
} catch {}

# 5. 启动脚本与说明
Copy-Item -Path (Join-Path $templateDir "*") -Destination $staging -Recurse -Force

$envExample = Join-Path $root ".env.example"
if (Test-Path -LiteralPath $envExample) {
  Copy-Item -LiteralPath $envExample -Destination (Join-Path $staging ".env.example") -Force
}

$version = "0.1.0"
try {
  $pkg = Get-Content -LiteralPath (Join-Path $root "package.json") -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($pkg.version) { $version = [string]$pkg.version }
} catch {}
$stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
@"
研墨 AI 绿色便携版
版本：$version
构建时间：$stamp
包含：Next.js standalone + $nodeLabel
"@ | Set-Content -LiteralPath (Join-Path $staging "版本信息.txt") -Encoding UTF8

# 6. 统一 Windows 文本换行，避免旧版记事本/命令提示符显示异常
Get-ChildItem -LiteralPath $staging -File | Where-Object { $_.Extension -in @(".cmd", ".txt") } | ForEach-Object {
  $text = [IO.File]::ReadAllText($_.FullName)
  $text = $text -replace "`r?`n", "`r`n"
  [IO.File]::WriteAllText($_.FullName, $text, (New-Object System.Text.UTF8Encoding($false)))
}

# 7. 压缩为可直接分享的 zip（包含顶层文件夹，解压后不会散落）
Write-Step "压缩便携包（可能需要 1-2 分钟）"
if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}
Compress-Archive -Path $staging -DestinationPath $zipPath -CompressionLevel Optimal

$sizeMb = [math]::Round((Get-Item -LiteralPath $zipPath).Length / 1MB, 1)
Write-Host ""
Write-Host "构建完成" -ForegroundColor Green
Write-Host "  目录：$staging"
Write-Host "  压缩包：$zipPath ($sizeMb MB)"
Write-Host ""
Write-Host "把 zip 发给别人，对方解压后双击 启动研墨.cmd 即可使用。" -ForegroundColor Cyan
