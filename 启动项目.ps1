$ErrorActionPreference = "Stop"

# 双击运行时，控制台会在脚本结束（或出错）后立刻关闭。
# 因此在最外层捕获所有异常，并在结束时等待按键，保证能看到提示信息。

$SkipWait = $false
foreach ($arg in $args) {
  if ($arg -in @("-NoWait", "--no-wait")) { $SkipWait = $true }
}

try {
  $root = Split-Path -Parent $MyInvocation.MyCommand.Definition
  if (-not $root) { $root = $PSScriptRoot }
  if ($root) { Set-Location -LiteralPath $root }

  $Port = 3000
  $NoBrowser = $false

  foreach ($arg in $args) {
    if ($arg -match "^-?(p|port)=?(\d+)$") { $Port = [int]$Matches[2] }
    elseif ($arg -in @("-NoBrowser", "--no-browser")) { $NoBrowser = $true }
  }

  function Write-Title {
    param([string]$Text, [string]$Color = "White")
    Write-Host $Text -ForegroundColor $Color
  }

  Write-Title ""
  Write-Title "  研墨 AI · 考研英语写作批改" "Cyan"
  Write-Title "  ------------------------------------" "DarkGray"
  Write-Title ""

  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) {
    Write-Title "没有找到 Node.js。" "Red"
    Write-Title "请先安装 Node.js 18.17 或更高版本（推荐 20 LTS）：https://nodejs.org/" "Yellow"
    Write-Title "安装完成后关闭本窗口，重新双击启动即可。" "Yellow"
    exit 1
  }
  $nodeVersion = (& node --version) 2>$null
  Write-Title "  Node.js $nodeVersion  ·  $($node.Source)" "DarkGray"

  # 优先使用 cmd 版 npm：npm.ps1 在部分系统上会被执行策略拦截，导致脚本静默失败。
  $npmCmd = $null
  $npmCmdCommand = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
  if ($npmCmdCommand) { $npmCmd = $npmCmdCommand.Source }
  if (-not $npmCmd) {
    $candidate = Join-Path (Split-Path -Parent $node.Source) "npm.cmd"
    if (Test-Path -LiteralPath $candidate) { $npmCmd = $candidate }
  }
  if (-not $npmCmd) {
    Write-Title "没有找到 npm.cmd，请重新安装 Node.js。" "Red"
    exit 1
  }

  if (-not (Test-Path -LiteralPath "node_modules")) {
    Write-Title "首次运行，正在安装依赖，请稍候……" "Cyan"
    & $npmCmd install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) {
      Write-Title "依赖安装失败。请检查网络，或手动执行：npm install" "Red"
      exit 1
    }
  }

  if (-not (Test-Path -LiteralPath ".env.local") -and -not (Test-Path -LiteralPath ".env")) {
    Write-Title "提示：尚未配置服务端 AI。" "Yellow"
    Write-Title "      可以在网页「设置」页填写 Key，或复制 .env.example 为 .env.local。" "DarkGray"
    Write-Title ""
  }

  $url = "http://localhost:$Port"
  $listening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if ($listening) {
    Write-Title "端口 $Port 已被占用，可能已经有一个研墨实例在运行。" "Yellow"
    Write-Title "直接打开：$url" "Green"
    if (-not $NoBrowser) { Start-Process $url }
    Write-Title ""
    Write-Title "如果打开后不是最新版本，请先关闭之前的窗口，或换个端口启动：启动项目.ps1 -Port 3001" "DarkGray"
    exit 0
  }

  if (-not $NoBrowser) {
    Start-Job -ScriptBlock {
      param($target)
      for ($i = 0; $i -lt 60; $i++) {
        try {
          $response = Invoke-WebRequest -UseBasicParsing -Uri $target -TimeoutSec 2
          if ($response.StatusCode -ge 200) {
            Start-Process $target
            break
          }
        } catch {
          Start-Sleep -Seconds 1
        }
      }
    } -ArgumentList $url | Out-Null
  }

  Write-Title "  →  $url" "Green"
  Write-Title ""
  Write-Title "  服务启动后浏览器会自动打开（首次编译约需 10—30 秒）。" "DarkGray"
  Write-Title "  按 Ctrl+C 停止服务；关闭本窗口也会停止服务。" "DarkGray"
  Write-Title ""

  & $npmCmd run dev -- -p $Port

  $exitCode = $LASTEXITCODE
  Write-Title ""
  if ($exitCode -ne 0) {
    Write-Title "服务已退出，退出码：$exitCode" "Red"
    Write-Title "常见原因：端口被占用、依赖损坏（删除 node_modules 后重试）、或 Node.js 版本过低。" "Yellow"
  } else {
    Write-Title "服务已停止。" "DarkGray"
  }
}
catch {
  Write-Host ""
  Write-Host "启动失败：$($_.Exception.Message)" -ForegroundColor Red
  Write-Host "请把本窗口的提示信息截图反馈，或手动执行 npm run dev 查看详细错误。" -ForegroundColor Yellow
}
finally {
  if (-not $SkipWait) {
    Write-Host ""
    Write-Host "按回车键关闭窗口……" -ForegroundColor DarkGray
    try { [void](Read-Host) } catch { Start-Sleep -Seconds 10 }
  }
}
