@echo off
:: Show what the agent sees right now and why the PC is free or busy.
title VADE Agent - status
net session >nul 2>&1
if errorlevel 1 (
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0vade-agent.ps1" -Status
pause
