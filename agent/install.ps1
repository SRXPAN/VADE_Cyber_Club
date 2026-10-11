# Встановлення VADE Agent на один ПК. Запускається з install.bat (з правами адміністратора).
param([string]$Source = $PSScriptRoot)

$ErrorActionPreference = 'Stop'
$Dest = 'C:\VadeAgent'
$TaskPath = '\VADE\'

function Step([string]$Text) { Write-Host ''; Write-Host $Text -ForegroundColor Cyan }
function Fail([string]$Text) { Write-Host $Text -ForegroundColor Red; Read-Host 'Enter — закрити'; exit 1 }

# Доступ: SYSTEM і адміністратори — повний, звичайні користувачі — лише читати й запускати.
# Інакше гравець міг би підмінити скрипт, який працює від SYSTEM.
function Lock-Folder([string]$Path) {
    & icacls.exe "$Path" /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-32-545:(OI)(CI)RX' /T /C /Q | Out-Null
}

Write-Host '=============================================' -ForegroundColor Cyan
Write-Host '   VADE Agent — встановлення на цей ПК' -ForegroundColor Cyan
Write-Host '=============================================' -ForegroundColor Cyan

$cfgFile = Join-Path $Source 'agent.config.psd1'
if (-not (Test-Path -LiteralPath $cfgFile)) { Fail "Немає $cfgFile" }
try { $cfg = Import-PowerShellDataFile -LiteralPath $cfgFile } catch { Fail "Помилка в agent.config.psd1: $_" }
if (-not $cfg.Token -or $cfg.Token -eq 'CHANGE_ME') {
    Write-Host 'Спершу впишіть Token (і перевірте SiteUrl) в agent.config.psd1 — файл зараз відкриється.' -ForegroundColor Yellow
    Start-Process notepad.exe -ArgumentList "`"$cfgFile`""
    Fail 'Збережіть файл і запустіть install.bat знову.'
}
$steam = if ($cfg.Steam) { $cfg.Steam } else { @{} }
$steamDir = if ($steam.SteamCmdDir) { [string]$steam.SteamCmdDir } else { 'C:\steamcmd' }
$steamUser = [string]$steam.User

# ---------------------------------------------------------------------
Step '[1/7] Зупиняю попередню версію (якщо є)'
foreach ($t in @('Agent', 'Probe', 'Update')) { try { Stop-ScheduledTask -TaskPath $TaskPath -TaskName $t -ErrorAction Stop } catch { } }
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -like '*vade-agent.ps1*' -and $_.ProcessId -ne $PID } |
    ForEach-Object { & taskkill.exe /PID $_.ProcessId /T /F 2>&1 | Out-Null }

# ---------------------------------------------------------------------
Step "[2/7] Копіюю файли в $Dest"
New-Item -ItemType Directory -Path $Dest, "$Dest\state", "$Dest\state\probe", "$Dest\logs" -Force | Out-Null
$files = @('vade-agent.ps1', 'agent.config.psd1', 'install.ps1', 'probe.vbs', 'README.md') + @(Get-ChildItem -LiteralPath $Source -Filter *.bat | ForEach-Object { $_.Name })
if ((Resolve-Path $Source).Path.TrimEnd('\') -ne $Dest) {
    foreach ($f in $files) {
        $src = Join-Path $Source $f
        if (Test-Path -LiteralPath $src) { Copy-Item -LiteralPath $src -Destination $Dest -Force }
    }
    # Ознаки Senet з іншого ПК (learn.bat) — можна покласти поруч з install.bat
    if (Test-Path -LiteralPath (Join-Path $Source 'senet-learned.psd1')) {
        Copy-Item -LiteralPath (Join-Path $Source 'senet-learned.psd1') -Destination "$Dest\state" -Force
        Write-Host '      Ознаки Senet скопійовано (senet-learned.psd1).'
    }
    # Збережені клубні входи лаунчерів (save-club-login.bat) — теж можна принести з іншого ПК
    if (Test-Path -LiteralPath (Join-Path $Source 'club-logins')) {
        Copy-Item -LiteralPath (Join-Path $Source 'club-logins') -Destination $Dest -Recurse -Force
        Write-Host '      Клубні входи лаунчерів скопійовано.'
    }
}
Lock-Folder $Dest
# Помічник у сесії гравця пише сюди час без миші/клавіатури
& icacls.exe "$Dest\state\probe" /grant '*S-1-5-32-545:(OI)(CI)M' /Q | Out-Null
if (Test-Path -LiteralPath "$Dest\club-logins") {
    & icacls.exe "$Dest\club-logins" /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' /T /Q | Out-Null
}

# ---------------------------------------------------------------------
Step "[3/7] SteamCMD ($steamDir)"
New-Item -ItemType Directory -Path $steamDir -Force | Out-Null
$steamcmd = Join-Path $steamDir 'steamcmd.exe'
if (-not (Test-Path -LiteralPath $steamcmd)) {
    Write-Host '      Завантажую SteamCMD…'
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    $zip = Join-Path $steamDir 'steamcmd.zip'
    Invoke-WebRequest 'https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip' -OutFile $zip -UseBasicParsing
    Expand-Archive -LiteralPath $zip -DestinationPath $steamDir -Force
    Remove-Item -LiteralPath $zip -Force
}
Lock-Folder $steamDir
$hasSteamUpdate = @($cfg.Launchers | Where-Object { $_.Enabled -and $_.Update -eq 'steamcmd' }).Count -gt 0
if ($hasSteamUpdate -and $steamUser) {
    $ans = Read-Host "      Увійти в SteamCMD акаунтом '$steamUser' зараз? Потрібно при першому встановленні. (Y/N)"
    if ($ans -match '^[YyТт]') {
        Write-Host '      Введіть пароль Steam, потім код Steam Guard. Пароль при введенні не видно — це нормально.'
        & $steamcmd +login $steamUser +quit
    }
}

# ---------------------------------------------------------------------
Step '[4/7] Дозволяю ПК прокидатися для завдань'
& powercfg /setacvalueindex SCHEME_CURRENT SUB_SLEEP RTCWAKE 1 2>&1 | Out-Null
& powercfg /setdcvalueindex SCHEME_CURRENT SUB_SLEEP RTCWAKE 1 2>&1 | Out-Null
& powercfg /setactive SCHEME_CURRENT 2>&1 | Out-Null

# ---------------------------------------------------------------------
Step '[5/7] Прибираю старе нічне завдання (club_night.bat) — агент робить його роботу'
foreach ($old in @('Club Night', 'Steam Night Update')) {
    if (Get-ScheduledTask -TaskName $old -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $old -Confirm:$false
        Write-Host "      Видалено завдання '$old'."
    }
}

# ---------------------------------------------------------------------
Step '[6/7] Створюю завдання Windows'
$ps = 'powershell.exe'
$script = "$Dest\vade-agent.ps1"
$forever = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew

# Агент: від SYSTEM, з увімкненням ПК, без обмеження часу, перезапуск при збої
$a = New-ScheduledTaskAction -Execute $ps -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`" -Service" -WorkingDirectory $Dest
$p = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskPath $TaskPath -TaskName 'Agent' -Action $a -Trigger (New-ScheduledTaskTrigger -AtStartup) -Principal $p -Settings $forever -Force | Out-Null
Write-Host '      \VADE\Agent — готово (SYSTEM, з увімкненням ПК)'

# Помічник: у сесії будь-якого користувача, що увійшов у Windows, без прав адміністратора
$usersGroup = (New-Object Security.Principal.SecurityIdentifier 'S-1-5-32-545').Translate([Security.Principal.NTAccount]).Value
$a = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "`"$Dest\probe.vbs`"" -WorkingDirectory $Dest
$p = New-ScheduledTaskPrincipal -GroupId $usersGroup -RunLevel Limited
Register-ScheduledTask -TaskPath $TaskPath -TaskName 'Probe' -Action $a -Trigger (New-ScheduledTaskTrigger -AtLogOn) -Principal $p -Settings $forever -Force | Out-Null
Write-Host '      \VADE\Probe — готово (при вході в Windows)'

# Оновлення: від цього облікового запису Windows — саме під ним SteamCMD пам'ятає вхід у Steam
$a = New-ScheduledTaskAction -Execute $ps -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`" -Update" -WorkingDirectory $Dest
$upd = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -WakeToRun -ExecutionTimeLimit (New-TimeSpan -Hours 8) -MultipleInstances IgnoreNew
$user = "$env:USERDOMAIN\$env:USERNAME"
$ok = $false
for ($i = 1; ($i -le 3) -and (-not $ok); $i++) {
    $cred = Get-Credential -UserName $user -Message "Пароль Windows для $user. Під ним працюватиме оновлення ігор (SteamCMD)."
    if (-not $cred) { break }
    try {
        Register-ScheduledTask -TaskPath $TaskPath -TaskName 'Update' -Action $a -Settings $upd -User $cred.UserName `
            -Password $cred.GetNetworkCredential().Password -RunLevel Highest -Force -ErrorAction Stop | Out-Null
        $ok = $true
        Write-Host "      \VADE\Update — готово (від $user)"
    } catch { Write-Host '      Неправильний пароль або в облікового запису немає пароля. Ще раз.' -ForegroundColor Yellow }
}
if (-not $ok) {
    $p = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
    Register-ScheduledTask -TaskPath $TaskPath -TaskName 'Update' -Action $a -Principal $p -Settings $upd -Force | Out-Null
    Write-Host '      \VADE\Update — від SYSTEM. Якщо в журналі буде «помилка входу SteamCMD» — задайте пароль цьому' -ForegroundColor Yellow
    Write-Host "      обліковому запису Windows і запустіть install.bat ще раз." -ForegroundColor Yellow
}

# ---------------------------------------------------------------------
Step '[7/7] Запуск і перевірка'
Start-ScheduledTask -TaskPath $TaskPath -TaskName 'Agent'
Start-Process wscript.exe -ArgumentList "`"$Dest\probe.vbs`""
Start-Sleep -Seconds 8
& $ps -NoProfile -ExecutionPolicy Bypass -File $script -TestReport
Write-Host ''
& $ps -NoProfile -ExecutionPolicy Bypass -File $script -Status

Write-Host ''
Write-Host 'ГОТОВО. Агент працює і стартує сам з увімкненням ПК.' -ForegroundColor Green
Write-Host "Журнали: $Dest\logs   |   Стан зараз: status.bat"
if (-not (Test-Path -LiteralPath "$Dest\state\senet-learned.psd1") -and -not @($cfg.Senet.BusyProcesses + $cfg.Senet.FreeProcesses + $cfg.Senet.BusyWindows + $cfg.Senet.FreeWindows).Where({ $_ }).Count) {
    Write-Host ''
    Write-Host 'Наступний крок: запустіть learn.bat — агент навчиться розпізнавати сесію Senet.' -ForegroundColor Yellow
    Write-Host 'До того він вважає ПК зайнятим, коли запущена гра або хтось рухав мишею останні 10 хвилин.' -ForegroundColor Yellow
}
Read-Host 'Enter — закрити'
