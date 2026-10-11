@echo off
:: Remove VADE Agent tasks from this PC.
title VADE Agent - uninstall
net session >nul 2>&1
if errorlevel 1 (
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)
cd /d "%~dp0"
powershell -NoProfile -Command "foreach($t in 'Agent','Probe','Update','Warmup','WipeCredentials'){ Unregister-ScheduledTask -TaskPath '\VADE\' -TaskName $t -Confirm:$false -ErrorAction SilentlyContinue }; Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.CommandLine -like '*vade-agent.ps1*' -and $_.ProcessId -ne $PID } | ForEach-Object { taskkill /PID $_.ProcessId /T /F | Out-Null }"
echo Scheduled tasks removed. You can now delete the folder C:\VadeAgent.
pause
