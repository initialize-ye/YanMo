param(
  [switch]$NoBrowser,
  [switch]$NoPause
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
if (-not $root) { $root = $PSScriptRoot }
Set-Location -LiteralPath $root

function Write-Info([string]$Text, [string]$Color = "Gray") {
  Write-Host $Text -ForegroundColor $Color
}

function Wait-Exit([string]$Message = "按回车键关闭窗口") {
  if (-not $NoPause) {
    Read-Host $Message
  }
}

Write-Host ""
Write-Host "  研墨 AI · 考研英语写作批改" -ForegroundColor Cyan
Write-Host "  绿色便携版" -ForegroundColor DarkGray
Write-Host ""

$nodeExe = Join-Path $root "runtime\node.exe"
$serverFile = Join-Path $root "server.js"

if (-not (Test-Path -LiteralPath $nodeExe)) {
  Write-Info "缺少 runtime\node.exe，请重新解压完整压缩包。" "Red"
  Wait-Exit "按回车键退出"
  exit 1
}
if (-not (Test-Path -LiteralPath $serverFile)) {
  Write-Info "缺少 server.js，请重新解压完整压缩包。" "Red"
  Wait-Exit "按回车键退出"
  exit 1
}

# 可选：读取同目录下的 .env.local（服务端 AI 配置）
$envFile = Join-Path $root ".env.local"
$envValues = @{}
if (Test-Path -LiteralPath $envFile) {
  try {
    Get-Content -LiteralPath $envFile -Encoding UTF8 | ForEach-Object {
      if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
        $key = $Matches[1]
        $value = $Matches[2]
        if ($value -match '^"(.*)"$' -or $value -match "^'(.*)'$") {
          $value = $Matches[1]
        }
        $envValues[$key] = $value
      }
    }
  } catch {
    Write-Info "读取 .env.local 失败，将忽略该文件。" "Yellow"
  }
}

# 默认只监听本机；.env.local 中的 HOSTNAME/PORT 可以覆盖
$env:HOSTNAME = "127.0.0.1"
$env:PORT = "3000"
foreach ($key in $envValues.Keys) {
  [Environment]::SetEnvironmentVariable($key, $envValues[$key], "Process")
}

function Test-PortFree([int]$Port) {
  try {
    $existing = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($existing) { return $false }
  } catch {
    # 老系统没有 Get-NetTCPConnection 时，退回 TcpListener 检测
  }
  $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
  try {
    $listener.Start()
    $listener.Stop()
    return $true
  } catch {
    return $false
  }
}

$port = 3000
$requestedPort = 0
if ($env:PORT -and [int]::TryParse($env:PORT, [ref]$requestedPort)) {
  $port = $requestedPort
}
while ($port -lt 3100 -and -not (Test-PortFree $port)) {
  $port += 1
}
if ($port -ge 3100) {
  Write-Info "3000-3099 端口都被占用，请关闭占用端口的程序后重试。" "Red"
  Wait-Exit "按回车键退出"
  exit 1
}

$env:PORT = "$port"
$env:NODE_ENV = "production"
$url = "http://localhost:$port"

if (-not (Test-Path -LiteralPath $envFile)) {
  Write-Info "提示：还没有配置服务端 AI。启动后可在网页「设置」里填写 API Key。" "Yellow"
  Write-Info "      也可以在本目录新建 .env.local，参考 .env.example。" "DarkGray"
  Write-Host ""
}

Write-Info "  正在启动：$url" "Green"
Write-Info "  首次启动可能需要几秒；关闭本窗口即可停止服务。" "DarkGray"
Write-Host ""

# 等服务真正就绪后再打开浏览器，避免出现“无法访问”
if (-not $NoBrowser) {
  $openScript = @"
for (`$i = 0; `$i -lt 90; `$i++) {
  try {
    `$null = Invoke-WebRequest -UseBasicParsing -Uri '$url' -TimeoutSec 2
    Start-Process '$url'
    break
  } catch {
    Start-Sleep -Seconds 1
  }
}
"@
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($openScript))
  Start-Process -FilePath "powershell.exe" -WindowStyle Hidden -ArgumentList "-NoProfile -ExecutionPolicy Bypass -EncodedCommand $encoded" | Out-Null
}

& $nodeExe $serverFile
$exitCode = $LASTEXITCODE

Write-Host ""
if ($exitCode -ne 0) {
  Write-Info "服务异常退出（退出码 $exitCode）。" "Red"
  Write-Info "常见原因：端口被占用、缺少文件，或系统拦截了 runtime\node.exe。" "Yellow"
} else {
  Write-Info "服务已停止。" "DarkGray"
}
Wait-Exit "按回车键关闭窗口"
