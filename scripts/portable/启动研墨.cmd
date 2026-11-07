@echo off
chcp 65001 >nul
setlocal

rem 研墨 AI 绿色便携版启动器
rem 实际启动逻辑在「启动研墨.ps1」中，双击本文件即可。

cd /d "%~dp0"

if not exist "runtime\node.exe" (
  echo.
  echo  缺少 runtime\node.exe。
  echo  请重新解压完整的绿色包，不要只拷贝部分文件。
  echo.
  pause
  exit /b 1
)

where powershell >nul 2>nul
if not %errorlevel%==0 (
  echo.
  echo  没有找到 Windows PowerShell。
  echo  请使用 Windows 10 / 11 运行本程序。
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0启动研墨.ps1" %*
if errorlevel 1 pause
endlocal
