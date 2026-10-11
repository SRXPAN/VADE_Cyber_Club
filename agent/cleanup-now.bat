@echo off
:: Close games and launchers and remove player logins right now (for testing).
title VADE Agent - cleanup now
net session >nul 2>&1
if errorlevel 1 (
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0vade-agent.ps1" -Cleanup
pause
