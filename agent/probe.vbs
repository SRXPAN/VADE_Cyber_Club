' VADE Agent: starts the user-session helper (idle time, window titles) without a console window.
' Started by the scheduled task \VADE\Probe at Windows logon. Exits with the helper's exit code,
' so the task restarts the helper if it is killed.
Set sh = CreateObject("WScript.Shell")
dir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
rc = sh.Run("powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & dir & "\vade-agent.ps1"" -Probe", 0, True)
WScript.Quit rc
