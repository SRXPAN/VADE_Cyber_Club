@echo off
:: Install or update VADE Agent on this PC. Edit agent.config.psd1 first (Token, SiteUrl).
title VADE Agent - install
net session >nul 2>&1
if errorlevel 1 (
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
