@echo off
:: Teach the agent what a Senet client session looks like on this PC.
title VADE Agent - learn Senet
net session >nul 2>&1
if errorlevel 1 (
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0vade-agent.ps1" -Learn
pause
