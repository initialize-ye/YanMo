@echo off
chcp 65001 >nul
setlocal

rem 双击启动研墨 AI。本文件只负责打开 PowerShell 窗口，
rem 实际逻辑在 启动项目.ps1 中（UTF-8 with BOM）。
rem 可选参数：-Port 3001 指定端口，-NoBrowser 不自动开浏览器，-Clean 强制清理缓存。
cd /d "%~dp0"

where pwsh >nul 2>nul
if %errorlevel%==0 (
  pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0启动项目.ps1" %*
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0启动项目.ps1" %*
)

if errorlevel 1 (
  echo.
  echo 启动失败。请查看上方红字提示；可尝试加 -Clean 参数清理缓存后重试，或手动运行：npm run dev
  pause
)
endlocal
