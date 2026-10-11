@echo off
:: Log in to SteamCMD with the club account again (when the log says LOGIN ERROR).
title VADE Agent - SteamCMD login
net session >nul 2>&1
if errorlevel 1 (
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0vade-agent.ps1" -SteamLogin
pause
