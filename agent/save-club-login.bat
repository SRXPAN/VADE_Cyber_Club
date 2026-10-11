@echo off
:: Save the club account login of a launcher, used to update its games. Usage: save-club-login.bat Riot
title VADE Agent - save club login
net session >nul 2>&1
if errorlevel 1 (
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)
cd /d "%~dp0"
set "L=%~1"
if "%L%"=="" set /p "L=Launcher name (Epic, Riot, Battle.net): "
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0vade-agent.ps1" -SaveClubLogin "%L%"
pause
