@echo off
:: Update games right now in this window (for testing). Do not use while a client is playing.
title VADE Agent - update games now
net session >nul 2>&1
if errorlevel 1 (
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0vade-agent.ps1" -Update
pause
