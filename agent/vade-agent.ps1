<#
  VADE Agent — програма на кожному ПК клубу.
  Замінює club_night.bat і робить більше:
    • щокілька секунд визначає, чи ПК зайнятий клієнтом, і повідомляє сайт (/api/report);
    • коли клієнт виходить із Senet — закриває ігри й лаунчери і стирає його логіни (Steam, Epic, Riot, Battle.net…);
    • коли ПК вільний — оновлює ігри (Steam через SteamCMD, інші лаунчери — запуском з клубним входом);
    • раз на добу — глибоке чищення кешу Steam і TEMP.

  Режими (запускаються .bat-файлами з цієї папки, вручну зазвичай не потрібні):
    -Service          головний цикл; працює від SYSTEM із завдання «VADE Agent» (install.bat)
    -Probe            помічник у сесії користувача Windows: час без миші/клавіатури, заголовки вікон
    -Update           один прохід оновлення ігор (його запускає -Service)
    -Cleanup [-Deep]  очищення вручну
    -Status           що агент бачить зараз і чому вважає ПК вільним/зайнятим
    -Learn            навчання: як виглядає сесія Senet на цьому ПК (learn.bat)
    -SaveClubLogin X  зберегти клубний вхід лаунчера X для оновлень (save-club-login.bat)
    -TestReport       надіслати тестовий звіт на сайт
    -SteamLogin       увійти в SteamCMD клубним акаунтом (steam-login.bat)
  Потрібно: Windows 10/11, Windows PowerShell 5.1 (вбудований).
#>
[CmdletBinding()]
param(
    [switch]$Service,
    [switch]$Probe,
    [switch]$Update,
    [switch]$Cleanup,
    [switch]$Deep,
    [switch]$Status,
    [switch]$Learn,
    [string]$SaveClubLogin,
    [switch]$TestReport,
    [switch]$SteamLogin,
    [string]$ConfigPath
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$Root      = $PSScriptRoot
$StateDir  = Join-Path $Root 'state'
$ProbeDir  = Join-Path $StateDir 'probe'
$LogDir    = Join-Path $Root 'logs'
$ClubDir   = Join-Path $Root 'club-logins'
if (-not $ConfigPath) { $ConfigPath = Join-Path $Root 'agent.config.psd1' }
foreach ($d in @($StateDir, $LogDir)) { if (-not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null } }

$script:LogName = 'agent'
$script:Cfg = $null

# =====================================================================
#   Загальне: журнал, налаштування, шляхи
# =====================================================================

function Write-Log([string]$Message, [string]$Level = 'INFO') {
    $file = Join-Path $LogDir ($script:LogName + '.log')
    try {
        if ((Test-Path -LiteralPath $file) -and (Get-Item -LiteralPath $file).Length -gt 2MB) {
            Move-Item -LiteralPath $file -Destination ($file + '.old') -Force
        }
        $line = '{0} [{1}] {2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Level, $Message
        Add-Content -LiteralPath $file -Value $line -Encoding UTF8
        if (-not $Service -and -not $Probe) { Write-Host $line }
    } catch { }
}

function Get-Cfg([string]$Name, $Default = $null) {
    if ($script:Cfg -and $script:Cfg.ContainsKey($Name) -and $null -ne $script:Cfg[$Name]) { return $script:Cfg[$Name] }
    return $Default
}

function Import-AgentConfig {
    if (-not (Test-Path -LiteralPath $ConfigPath)) { throw "Немає файлу налаштувань: $ConfigPath" }
    $cfg = Import-PowerShellDataFile -LiteralPath $ConfigPath
    # Ознаки Senet з learn.bat — якщо в налаштуваннях їх не заповнено руками
    $learned = Join-Path $StateDir 'senet-learned.psd1'
    $senet = if ($cfg.ContainsKey('Senet') -and $cfg.Senet) { $cfg.Senet } else { @{} }
    $manual = @('BusyProcesses', 'FreeProcesses', 'BusyWindows', 'FreeWindows') | Where-Object { @($senet[$_]).Where({ $_ }).Count -gt 0 }
    if (-not $manual -and (Test-Path -LiteralPath $learned)) {
        try { $senet = Import-PowerShellDataFile -LiteralPath $learned } catch { Write-Log "Не вдалося прочитати $learned : $_" 'WARN' }
    }
    $cfg.Senet = $senet
    $script:Cfg = $cfg
    return $cfg
}

function Get-PcId {
    $id = [string](Get-Cfg 'PcId' '')
    if (-not $id) { $id = $env:COMPUTERNAME }
    $id = ($id -replace '[^A-Za-z0-9_-]', '-')
    if ($id.Length -gt 32) { $id = $id.Substring(0, 32) }
    return $id
}

function Get-PcName {
    $name = [string](Get-Cfg 'PcName' '')
    if ($name) { return $name }
    if ($env:COMPUTERNAME -match '(\d+)\D*$') { return 'PC ' + [int]$Matches[1] }
    return $env:COMPUTERNAME
}

function Get-PcZone {
    $map = Get-Cfg 'ZoneByPc' @{}
    foreach ($key in $map.Keys) { if ($env:COMPUTERNAME -like $key) { return [string]$map[$key] } }
    return [string](Get-Cfg 'Zone' '')
}

function Get-SteamPath {
    $s = Get-Cfg 'Steam' @{}
    if ($s.Path) { return [string]$s.Path }
    return 'C:\Program Files (x86)\Steam'
}

# Профілі Windows (C:\Users\...) з SID — для {USER} і реєстру
function Get-UserProfiles {
    try {
        Get-CimInstance Win32_UserProfile -ErrorAction Stop |
            Where-Object { -not $_.Special -and $_.LocalPath -and (Test-Path -LiteralPath $_.LocalPath) -and $_.SID -like 'S-1-5-21-*' } |
            ForEach-Object { [pscustomobject]@{ Path = $_.LocalPath; Sid = $_.SID; Loaded = [bool]$_.Loaded } }
    } catch {
        Get-ChildItem 'C:\Users' -Directory -ErrorAction SilentlyContinue |
            Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'NTUSER.DAT') } |
            ForEach-Object { [pscustomobject]@{ Path = $_.FullName; Sid = ''; Loaded = $false } }
    }
}

# {USER}, {STEAM}, {PF}, {PF86}, {PD}, {AGENT} → реальні шляхи. З {USER} повертає шлях для кожного профілю.
function Expand-AgentPath([string]$Path, [string]$UserRoot) {
    $p = $Path.Replace('{STEAM}', (Get-SteamPath)).Replace('{PF86}', ${env:ProgramFiles(x86)}).Replace('{PF}', $env:ProgramFiles)
    $p = $p.Replace('{PD}', $env:ProgramData).Replace('{AGENT}', $Root)
    if ($p -like '*{USER}*') {
        if ($UserRoot) { return , $p.Replace('{USER}', $UserRoot) }
        return @(Get-UserProfiles | ForEach-Object { $p.Replace('{USER}', $_.Path) })
    }
    return , $p
}

function Test-NameLike([string]$Name, $Patterns) {
    if (-not $Name) { return $false }
    $n = $Name -replace '\.exe$', ''
    foreach ($pat in @($Patterns)) {
        if (-not $pat) { continue }
        if ($n -like ($pat -replace '\.exe$', '')) { return $true }
    }
    return $false
}

function Get-ConsoleUser {
    try { return [string](Get-CimInstance Win32_ComputerSystem -ErrorAction Stop).UserName } catch { return '' }
}

function Get-ConsoleUserProfile {
    $user = Get-ConsoleUser
    if (-not $user) { return $null }
    try {
        $sid = (New-Object Security.Principal.NTAccount($user)).Translate([Security.Principal.SecurityIdentifier]).Value
        $prof = Get-CimInstance Win32_UserProfile -Filter "SID='$sid'" -ErrorAction Stop
        if ($prof) { return [pscustomobject]@{ User = $user; Sid = $sid; Path = $prof.LocalPath } }
    } catch { }
    return $null
}

function Read-StateFile([string]$Name) {
    $f = Join-Path $StateDir $Name
    if (Test-Path -LiteralPath $f) { try { return (Get-Content -LiteralPath $f -Raw -ErrorAction Stop).Trim() } catch { } }
    return ''
}
function Write-StateFile([string]$Name, [string]$Value) {
    try { Set-Content -LiteralPath (Join-Path $StateDir $Name) -Value $Value -Encoding UTF8 -ErrorAction Stop } catch { }
}

# =====================================================================
#   Звіт на сайт
# =====================================================================

function Send-Report([string]$State, [string]$Detail) {
    $url = ([string](Get-Cfg 'SiteUrl' '')).TrimEnd('/')
    $token = [string](Get-Cfg 'Token' '')
    if (-not $url -or -not $token -or $token -eq 'CHANGE_ME') { return $false }
    $body = @{
        id     = Get-PcId
        name   = Get-PcName
        zone   = Get-PcZone
        pos    = [int](Get-Cfg 'Position' 0)
        state  = $State
        detail = $Detail
    } | ConvertTo-Json -Compress
    try {
        Invoke-RestMethod -Uri "$url/api/report" -Method Post -Body ([Text.Encoding]::UTF8.GetBytes($body)) `
            -ContentType 'application/json; charset=utf-8' -Headers @{ Authorization = "Bearer $token" } -TimeoutSec 10 -UseBasicParsing | Out-Null
        return $true
    } catch {
        $msg = $_.Exception.Message
        if ($_.Exception.Response) { try { $msg = "HTTP $([int]$_.Exception.Response.StatusCode) $msg" } catch { } }
        Write-Log "Сайт не прийняв звіт: $msg" 'WARN'
        return $false
    }
}

# =====================================================================
#   Що зараз відбувається на ПК
# =====================================================================

$script:GameRoots = @()
$script:GameRootsAt = [datetime]::MinValue

function Get-SteamLibraries {
    $steam = Get-SteamPath
    $libs = New-Object System.Collections.Generic.List[string]
    foreach ($f in @("$steam\steamapps\libraryfolders.vdf", "$steam\config\libraryfolders.vdf")) {
        if (-not (Test-Path -LiteralPath $f)) { continue }
        foreach ($line in Get-Content -LiteralPath $f -ErrorAction SilentlyContinue) {
            if ($line -match '^\s*"path"\s*"(.+)"\s*$') {
                $p = $Matches[1] -replace '\\\\', '\'
                if (-not $libs.Contains($p)) { $libs.Add($p) }
            }
        }
        break
    }
    if ($libs.Count -eq 0 -and (Test-Path -LiteralPath "$steam\steamapps")) { $libs.Add($steam) }
    return $libs
}

# Папки, процес з яких = «гра запущена». Оновлюється раз на 10 хвилин.
function Get-GameRoots {
    if (((Get-Date) - $script:GameRootsAt).TotalMinutes -lt 10 -and $script:GameRoots.Count) { return $script:GameRoots }
    $roots = New-Object System.Collections.Generic.List[string]
    foreach ($lib in Get-SteamLibraries) { $roots.Add((Join-Path $lib 'steamapps\common')) }
    $epic = Join-Path $env:ProgramData 'Epic\EpicGamesLauncher\Data\Manifests'
    Get-ChildItem -LiteralPath $epic -Filter *.item -ErrorAction SilentlyContinue | ForEach-Object {
        try { $m = Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json; if ($m.InstallLocation) { $roots.Add([string]$m.InstallLocation) } } catch { }
    }
    foreach ($g in @(Get-Cfg 'GameFolders' @())) { if ($g) { $roots.Add([string]$g) } }
    $script:GameRoots = @($roots | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | ForEach-Object { ($_.TrimEnd('\') + '\').ToLowerInvariant() } | Select-Object -Unique)
    $script:GameRootsAt = Get-Date
    return $script:GameRoots
}

function Get-Processes {
    try {
        return @(Get-CimInstance Win32_Process -ErrorAction Stop |
            Select-Object ProcessId, ParentProcessId, Name, ExecutablePath, SessionId, WriteTransferCount)
    } catch {
        return @(Get-Process | ForEach-Object { [pscustomobject]@{ ProcessId = $_.Id; ParentProcessId = 0; Name = $_.ProcessName + '.exe'; ExecutablePath = $_.Path; SessionId = $_.SessionId; WriteTransferCount = 0 } })
    }
}

function Find-GameProcess($Procs) {
    $roots = Get-GameRoots
    $ignore = Get-Cfg 'IgnoreProcesses' @()
    $named = Get-Cfg 'GameProcesses' @()
    foreach ($p in $Procs) {
        if ($p.SessionId -eq 0) { continue }   # служби (античити тощо) — не гра
        if (Test-NameLike $p.Name $ignore) { continue }
        if (Test-NameLike $p.Name $named) { return $p }
        $path = [string]$p.ExecutablePath
        if (-not $path) { continue }
        $lp = $path.ToLowerInvariant()
        foreach ($r in $roots) { if ($lp.StartsWith($r)) { return $p } }
    }
    return $null
}

# Дані помічника з сесії користувача (час без вводу, вікна). Порожньо, якщо помічник не працює.
function Get-ProbeInfo {
    if (-not (Test-Path -LiteralPath $ProbeDir)) { return $null }
    $best = $null
    foreach ($f in Get-ChildItem -LiteralPath $ProbeDir -Filter 'probe-*.json' -ErrorAction SilentlyContinue) {
        try { $j = Get-Content -LiteralPath $f.FullName -Raw -ErrorAction Stop | ConvertFrom-Json } catch { continue }
        if (-not $best -or $j.time -gt $best.time) { $best = $j }
    }
    if (-not $best) { return $null }
    $age = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() - [int64]$best.time
    if ($age -gt 20) { return $null }
    return $best
}

function Get-SenetSignal($Procs, $ProbeInfo) {
    $s = Get-Cfg 'Senet' @{}
    $names = @($Procs | ForEach-Object { $_.Name })
    foreach ($n in $names) { if (Test-NameLike $n $s.BusyProcesses) { return @{ State = 'busy'; Why = "senet: процес $n" } } }
    $titles = @()
    if ($ProbeInfo -and $ProbeInfo.windows) { $titles = @($ProbeInfo.windows | ForEach-Object { [string]$_.title }) }
    foreach ($t in $titles) { foreach ($pat in @($s.BusyWindows)) { if ($pat -and $t -like $pat) { return @{ State = 'busy'; Why = "senet: вікно '$t'" } } } }
    $hasFreeSignals = @($s.FreeProcesses).Where({ $_ }).Count + @($s.FreeWindows).Where({ $_ }).Count
    foreach ($n in $names) { if (Test-NameLike $n $s.FreeProcesses) { return @{ State = 'free'; Why = "senet: процес $n" } } }
    foreach ($t in $titles) { foreach ($pat in @($s.FreeWindows)) { if ($pat -and $t -like $pat) { return @{ State = 'free'; Why = "senet: вікно '$t'" } } } }
    # Задано ознаки лише одного виду і жодна не спрацювала — значить протилежний стан.
    # Вікна видно лише через помічника, тож без нього по одних вікнах не вирішуємо.
    $hasBusySignals = @($s.BusyProcesses).Where({ $_ }).Count + @($s.BusyWindows).Where({ $_ }).Count
    if ($hasBusySignals -and -not $hasFreeSignals -and (@($s.BusyProcesses).Where({ $_ }).Count -or $ProbeInfo)) {
        return @{ State = 'free'; Why = 'senet: ознак сесії немає' }
    }
    if ($hasFreeSignals -and -not $hasBusySignals -and (@($s.FreeProcesses).Where({ $_ }).Count -or $ProbeInfo)) {
        return @{ State = 'busy'; Why = 'senet: екрана входу немає' }
    }
    return $null
}

function Get-PcSignals {
    $procs = Get-Processes
    $probe = Get-ProbeInfo
    $game = Find-GameProcess $procs
    $senet = Get-SenetSignal $procs $probe
    [pscustomobject]@{
        Procs   = $procs
        Probe   = $probe
        Game    = $game
        Senet   = $senet
        IdleSec = if ($probe) { [int]$probe.idleSec } else { -1 }
        Locked  = if ($probe) { [bool]$probe.locked } else { $false }
        User    = Get-ConsoleUser
    }
}

function Resolve-PcState($Sig) {
    if ($Sig.Game) { return @{ State = 'busy'; Why = 'гра: ' + $Sig.Game.Name } }
    if ($Sig.Senet) { return $Sig.Senet }
    if (-not $Sig.User) { return @{ State = 'free'; Why = 'ніхто не увійшов у Windows' } }
    if ($Sig.Probe) {
        if ($Sig.Locked) { return @{ State = 'free'; Why = 'Windows заблоковано' } }
        $limit = [int](Get-Cfg 'IdleFreeMinutes' 10) * 60
        if ($Sig.IdleSec -lt $limit) { return @{ State = 'busy'; Why = 'активність ' + [int]($Sig.IdleSec / 60) + ' хв тому' } }
        return @{ State = 'free'; Why = 'без активності ' + [int]($Sig.IdleSec / 60) + ' хв' }
    }
    return @{ State = 'free'; Why = 'немає гри й ознак Senet (помічник не працює)' }
}

# =====================================================================
#   Очищення: закрити ігри й лаунчери, стерти логіни гравця
# =====================================================================

function Stop-ProcessTree([int]$ProcessId) {
    if ($ProcessId -le 0) { return }
    & taskkill.exe /PID $ProcessId /T /F 2>&1 | Out-Null
}

function Stop-ByName($Patterns) {
    $killed = @()
    foreach ($p in Get-Processes) {
        if ((Test-NameLike $p.Name $Patterns) -and $p.ProcessId -ne $PID) {
            try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop; $killed += $p.Name } catch { }
        }
    }
    return $killed
}

function Remove-PathSafe([string]$Pattern, [switch]$Directory) {
    $parent = Split-Path -Path $Pattern -Parent
    if (-not $parent -or -not (Test-Path -LiteralPath $parent)) { return 0 }
    $n = 0
    # Get-Item (а не Get-ChildItem): шаблон розгортається в самі файли/папки, а не в їхній вміст
    foreach ($item in Get-Item -Path $Pattern -Force -ErrorAction SilentlyContinue) {
        if ($Directory -ne $item.PSIsContainer) { continue }
        # точку з'єднання (junction) не відкриваємо — видаляємо лише саме посилання
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { & cmd.exe /c rmdir "$($item.FullName)" 2>&1 | Out-Null; $n++; continue }
        try { Remove-Item -LiteralPath $item.FullName -Recurse -Force -ErrorAction Stop; $n++ } catch { }
    }
    return $n
}

function Remove-IniSections([string]$File, $Sections) {
    if (-not (Test-Path -LiteralPath $File)) { return }
    $lines = Get-Content -LiteralPath $File -ErrorAction SilentlyContinue
    $out = New-Object System.Collections.Generic.List[string]
    $skip = $false
    foreach ($line in $lines) {
        if ($line -match '^\s*\[(.+)\]\s*$') { $skip = @($Sections) -contains $Matches[1] }
        if (-not $skip) { $out.Add($line) }
    }
    if ($out.Count -ne @($lines).Count) { [IO.File]::WriteAllLines($File, $out, (New-Object Text.UTF8Encoding($false))) }
}

# Стерти блок "Name" { ... } з vdf-файлу Steam (напр. ConnectCache — збережені токени входу)
function Remove-VdfBlocks([string]$File, $Blocks) {
    if (-not (Test-Path -LiteralPath $File)) { return }
    $text = Get-Content -LiteralPath $File -Raw -ErrorAction SilentlyContinue
    if (-not $text) { return }
    $changed = $false
    foreach ($b in @($Blocks)) {
        $m = [regex]::Match($text, '(?mi)^[ \t]*"' + [regex]::Escape($b) + '"\s*\{')
        if (-not $m.Success) { continue }
        $i = $m.Index + $m.Length
        $depth = 1
        $inStr = $false
        while ($i -lt $text.Length -and $depth -gt 0) {
            $c = $text[$i]
            if ($c -eq '\' -and $inStr) { $i += 2; continue }
            if ($c -eq '"') { $inStr = -not $inStr }
            elseif (-not $inStr) { if ($c -eq '{') { $depth++ } elseif ($c -eq '}') { $depth-- } }
            $i++
        }
        if ($depth -eq 0) {
            while ($i -lt $text.Length -and ($text[$i] -eq "`r" -or $text[$i] -eq "`n")) { $i++ }
            $text = $text.Remove($m.Index, $i - $m.Index)
            $changed = $true
        }
    }
    if ($changed) { [IO.File]::WriteAllText($File, $text, (New-Object Text.UTF8Encoding($false))) }
}

# Реєстр кожного користувача: завантажені профілі — HKU\<SID>, решта — тимчасово підвантажуємо NTUSER.DAT
function Invoke-UserRegistry($Ops) {
    if (-not @($Ops).Count) { return }
    $apply = {
        param([string]$Hive)
        foreach ($op in $Ops) {
            $key = "$Hive\$($op.Key)"
            & reg.exe query "$key" 2>&1 | Out-Null
            if ($LASTEXITCODE -ne 0) { continue }
            if ($op.Delete) { & reg.exe delete "$key" /v $op.Value /f 2>&1 | Out-Null }
            else { & reg.exe add "$key" /v $op.Value /t $(if ($op.Type) { $op.Type } else { 'REG_SZ' }) /d ([string]$op.Data) /f 2>&1 | Out-Null }
        }
    }
    foreach ($prof in Get-UserProfiles) {
        if ($prof.Sid -and (Test-Path -LiteralPath "Registry::HKEY_USERS\$($prof.Sid)")) { & $apply "HKU\$($prof.Sid)"; continue }
        $dat = Join-Path $prof.Path 'NTUSER.DAT'
        if (-not (Test-Path -LiteralPath $dat)) { continue }
        & reg.exe load 'HKU\VadeTmp' "$dat" 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            & $apply 'HKU\VadeTmp'
            [gc]::Collect()
            & reg.exe unload 'HKU\VadeTmp' 2>&1 | Out-Null
        }
    }
}

# Запуск програми в сесії користувача, який зараз за ПК (від SYSTEM інакше вікна не з'являться)
function Start-AsConsoleUser([string]$Exe, [string]$Arguments, [string]$TaskName = 'Run') {
    $user = Get-ConsoleUser
    if (-not $user) { return $false }
    try {
        $action = if ($Arguments) { New-ScheduledTaskAction -Execute $Exe -Argument $Arguments } else { New-ScheduledTaskAction -Execute $Exe }
        $principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero)
        Register-ScheduledTask -TaskPath '\VADE\' -TaskName $TaskName -Action $action -Principal $principal -Settings $settings -Force -ErrorAction Stop | Out-Null
        Start-ScheduledTask -TaskPath '\VADE\' -TaskName $TaskName -ErrorAction Stop
        return $true
    } catch {
        Write-Log "Не вдалося запустити '$Exe' від імені $user : $_" 'WARN'
        return $false
    }
}

# Записи Диспетчера облікових даних живуть у користувача — стираємо коротким скриптом у його сесії
function Clear-UserCredentials($Patterns) {
    $pats = @($Patterns | Where-Object { $_ })
    if (-not $pats.Count) { return }
    $list = ($pats | ForEach-Object { "'" + ($_ -replace "'", "''") + "'" }) -join ','
    $script = @"
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public static class VadeCred {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] struct CREDENTIAL { public int Flags; public int Type; public string TargetName; public string Comment; public long LastWritten; public int CredentialBlobSize; public IntPtr CredentialBlob; public int Persist; public int AttributeCount; public IntPtr Attributes; public string TargetAlias; public string UserName; }
  [DllImport("advapi32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool CredEnumerate(string filter, int flags, out int count, out IntPtr creds);
  [DllImport("advapi32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool CredDelete(string target, int type, int flags);
  [DllImport("advapi32.dll")] static extern void CredFree(IntPtr buffer);
  public static int Wipe(string filter) { int n; IntPtr p; if (!CredEnumerate(filter, 0, out n, out p)) return 0; int del = 0;
    try { for (int i = 0; i < n; i++) { IntPtr c = Marshal.ReadIntPtr(p, i * IntPtr.Size); CREDENTIAL cr = (CREDENTIAL)Marshal.PtrToStructure(c, typeof(CREDENTIAL)); if (CredDelete(cr.TargetName, cr.Type, 0)) del++; } }
    finally { CredFree(p); } return del; }
}
'@
foreach (`$f in @($list)) { [void][VadeCred]::Wipe(`$f) }
"@
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($script))
    [void](Start-AsConsoleUser 'powershell.exe' "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -EncodedCommand $encoded" 'WipeCredentials')
}

function Clear-LauncherLogin($L) {
    foreach ($f in @($L.DeleteFiles)) { if ($f) { foreach ($p in Expand-AgentPath $f) { [void](Remove-PathSafe $p) } } }
    foreach ($d in @($L.DeleteDirs)) { if ($d) { foreach ($p in Expand-AgentPath $d) { [void](Remove-PathSafe $p -Directory) } } }
    foreach ($ini in @($L.IniSections)) { if ($ini) { foreach ($p in Expand-AgentPath $ini.File) { Remove-IniSections $p $ini.Sections } } }
    foreach ($v in @($L.VdfBlocks)) { if ($v) { foreach ($p in Expand-AgentPath $v.File) { Remove-VdfBlocks $p $v.Blocks } } }
    foreach ($r in @($L.TextReplace)) {
        if (-not $r) { continue }
        foreach ($p in Expand-AgentPath $r.File) {
            if (-not (Test-Path -LiteralPath $p)) { continue }
            $text = Get-Content -LiteralPath $p -Raw -ErrorAction SilentlyContinue
            if ($text) {
                $new = [regex]::Replace($text, $r.Pattern, $r.Replace)
                if ($new -ne $text) { [IO.File]::WriteAllText($p, $new, (New-Object Text.UTF8Encoding($false))) }
            }
        }
    }
    if (@($L.Registry).Count) { Invoke-UserRegistry $L.Registry }
    if (@($L.Credentials).Count) { Clear-UserCredentials $L.Credentials }
}

function Get-EnabledLaunchers { @(Get-Cfg 'Launchers' @()) | Where-Object { $_ -and $_.Enabled } }

function Clear-Temp {
    foreach ($prof in Get-UserProfiles) {
        $t = Join-Path $prof.Path 'AppData\Local\Temp'
        if (Test-Path -LiteralPath $t) { Get-ChildItem -LiteralPath $t -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue }
    }
    $sys = Join-Path $env:SystemRoot 'Temp'
    Get-ChildItem -LiteralPath $sys -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}

# Глибоке чищення кешу Steam — як крок [4/5] у club_night.bat. Раз на добу.
function Clear-SteamCache {
    $steam = Get-SteamPath
    foreach ($f in @('htmlcache', 'appcache', 'logs', 'dumps', 'depotcache')) {
        $p = Join-Path $steam $f
        if (Test-Path -LiteralPath $p) { Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction SilentlyContinue }
    }
    $s = Get-Cfg 'Steam' @{}
    if ($s.CleanUserdata -and (Test-Path -LiteralPath "$steam\userdata")) { Remove-Item -LiteralPath "$steam\userdata" -Recurse -Force -ErrorAction SilentlyContinue }
}

function Invoke-LogoutCleanup([string]$Reason, [switch]$DeepClean) {
    if (Test-Path -LiteralPath (Join-Path $Root 'pause')) { Write-Log "Очищення пропущено: є файл pause"; return }
    Write-Log "Очищення після виходу клієнта ($Reason)"
    $killed = @()
    if (Get-Cfg 'KillGames' $true) {
        $procs = Get-Processes
        while ($true) {
            $g = Find-GameProcess $procs
            if (-not $g) { break }
            Stop-ProcessTree $g.ProcessId
            $killed += $g.Name
            $procs = @($procs | Where-Object { $_.ProcessId -ne $g.ProcessId })
        }
    }
    foreach ($l in Get-EnabledLaunchers) { $killed += Stop-ByName $l.Processes }
    if ($killed.Count) { Write-Log ("  закрито: " + (($killed | Select-Object -Unique) -join ', ')); Start-Sleep -Seconds 4 }
    foreach ($l in Get-EnabledLaunchers) {
        try { Clear-LauncherLogin $l } catch { Write-Log "  $($l.Name): помилка очищення: $_" 'WARN' }
    }
    Write-Log ("  логіни стерто: " + ((Get-EnabledLaunchers | ForEach-Object { $_.Name }) -join ', '))
    if (Get-Cfg 'CleanTemp' $true) { Clear-Temp }
    if ($DeepClean) { Clear-SteamCache; Write-Log '  кеш Steam очищено' }
}

# =====================================================================
#   Оновлення ігор
# =====================================================================

function Set-Progress([string]$Text) { Write-StateFile 'update-progress.txt' $Text; Write-Log $Text }

function Get-SteamCmd {
    $dir = [string]((Get-Cfg 'Steam' @{}).SteamCmdDir)
    if (-not $dir) { $dir = 'C:\steamcmd' }
    $exe = Join-Path $dir 'steamcmd.exe'
    if (Test-Path -LiteralPath $exe) { return $exe }
    try {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        $zip = Join-Path $dir 'steamcmd.zip'
        Invoke-WebRequest 'https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip' -OutFile $zip -UseBasicParsing -TimeoutSec 120
        Expand-Archive -LiteralPath $zip -DestinationPath $dir -Force
        Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue
    } catch { Write-Log "Не вдалося завантажити SteamCMD: $_" 'ERROR' }
    if (Test-Path -LiteralPath $exe) { return $exe }
    return $null
}

# Тимчасове посилання C:\steamcmd\steamapps → бібліотека. Прибирається лише саме посилання, ігри не чіпаються.
function Remove-SteamCmdLink {
    $dir = [string]((Get-Cfg 'Steam' @{}).SteamCmdDir)
    if (-not $dir) { $dir = 'C:\steamcmd' }
    $sa = Join-Path $dir 'steamapps'
    if (-not (Test-Path -LiteralPath $sa)) { return $true }
    $item = Get-Item -LiteralPath $sa -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { & cmd.exe /c rmdir "$sa" 2>&1 | Out-Null }
    else { Rename-Item -LiteralPath $sa -NewName ('steamapps_old_' + (Get-Random)) -ErrorAction SilentlyContinue }
    return -not (Test-Path -LiteralPath $sa)
}

function Update-SteamGames {
    $s = Get-Cfg 'Steam' @{}
    $steamcmd = Get-SteamCmd
    if (-not $steamcmd) { return 'Steam: немає SteamCMD' }
    $dir = Split-Path $steamcmd -Parent
    $sa = Join-Path $dir 'steamapps'
    $out = Join-Path $dir 'last_output.txt'
    $apps = [string]$s.Apps
    $wanted = if (-not $apps -or $apps -eq 'auto') { $null } else { @($apps -split '[\s,;]+' | Where-Object { $_ }) }
    $errors = 0; $ok = 0; $skipped = 0
    foreach ($lib in Get-SteamLibraries) {
        $libApps = Join-Path $lib 'steamapps'
        if (-not (Test-Path -LiteralPath $libApps)) { continue }
        $ids = @(Get-ChildItem -LiteralPath $libApps -Filter 'appmanifest_*.acf' -ErrorAction SilentlyContinue |
            ForEach-Object { $_.BaseName -replace '^appmanifest_', '' } |
            Where-Object { $_ -match '^\d+$' -and $_ -ne '228980' -and (-not $wanted -or $wanted -contains $_) })
        if (-not $ids.Count) { continue }
        Set-Progress "Steam: $lib — $($ids.Count) ігор"
        if (-not (Remove-SteamCmdLink)) { Write-Log "  $sa заважає" 'ERROR'; $errors++; continue }
        & cmd.exe /c mklink /J "$sa" "$libApps" 2>&1 | Out-Null
        if (-not (Test-Path -LiteralPath $sa)) { Write-Log "  не вдалося зробити посилання на $libApps" 'ERROR'; $errors++; continue }
        try {
            $argList = @('+@NoPromptForPassword', '1', '+login', [string]$s.User)
            foreach ($id in $ids) { $argList += '+app_update'; $argList += $id; if ($s.Validate) { $argList += 'validate' } }
            $argList += '+quit'
            & $steamcmd @argList *> $out
        } finally {
            [void](Remove-SteamCmdLink)
        }
        $text = Get-Content -LiteralPath $out -Raw -ErrorAction SilentlyContinue
        if ($text -match 'Cached credentials not found|Login Failure|Not logged on|Steam Public\.\.\.FAILED') {
            Write-Log '  ПОМИЛКА ВХОДУ SteamCMD — запустіть steam-login.bat на цьому ПК' 'ERROR'
            Write-StateFile 'steam-login-error.txt' (Get-Date -Format s)
            return 'Steam: помилка входу'
        }
        Remove-Item -LiteralPath (Join-Path $StateDir 'steam-login-error.txt') -ErrorAction SilentlyContinue
        foreach ($id in $ids) {
            if ($text -match "App '$id' (fully installed|already up to date)") { $ok++ }
            elseif ($text -match "'$id' \(No subscription\)") { $skipped++ }
            else { $errors++; Write-Log "  $id : помилка, див. $out" 'WARN' }
        }
    }
    return "Steam: OK $ok, пропущено $skipped, помилок $errors"
}

# warmup: відновити клубний вхід → запустити лаунчер → чекати, поки він докачає → закрити → стерти логін
function Update-ViaWarmup($L) {
    $snap = Join-Path $ClubDir $L.Name
    if (-not (Test-Path -LiteralPath $snap)) { return "$($L.Name): клубний вхід не збережено (save-club-login.bat $($L.Name))" }
    $exe = @(Expand-AgentPath ([string]$L.Exe))[0]
    if (-not $exe -or -not (Test-Path -LiteralPath $exe)) { return "$($L.Name): не встановлено" }
    $prof = Get-ConsoleUserProfile
    if (-not $prof) { return "$($L.Name): ніхто не увійшов у Windows — пропущено" }

    Write-StateFile 'warmup-active.txt' $L.Name
    try {
        [void](Stop-ByName $L.Processes); Start-Sleep -Seconds 2
        # Відновлюємо файли входу в профіль поточного користувача
        Get-ChildItem -LiteralPath $snap -Recurse -File | ForEach-Object {
            $rel = $_.FullName.Substring($snap.Length).TrimStart('\')
            $target = if ($rel -like 'USER\*') { Join-Path $prof.Path $rel.Substring(5) } else { $null }
            if ($target) {
                New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null
                Copy-Item -LiteralPath $_.FullName -Destination $target -Force
            }
        }
        Set-Progress "$($L.Name): запуск для оновлення"
        if (-not (Start-AsConsoleUser $exe ([string]$L.Args) 'Warmup')) { return "$($L.Name): не вдалося запустити" }

        $minM = [double](Get-Cfg 'WarmupMinMinutes' 4)
        $maxM = [double](Get-Cfg 'WarmupMaxMinutes' 90)
        $quietM = [double](Get-Cfg 'WarmupQuietMinutes' 3)
        $quietBytes = [double](Get-Cfg 'WarmupQuietMBps' 1) * 1MB * 30
        $start = Get-Date; $quietSince = $null; $last = $null
        while ($true) {
            Start-Sleep -Seconds 30
            # Скільки записали на диск процеси лаунчера (і їхні дочірні процеси) за 30 с
            $procs = Get-Processes
            $watch = @($L.Processes) + @($L.IoProcesses)
            $mine = @($procs | Where-Object { Test-NameLike $_.Name $watch })
            $ids = @($mine | ForEach-Object { $_.ProcessId })
            $kids = @($procs | Where-Object { $ids -contains $_.ParentProcessId })
            $total = [double](($mine + $kids | Measure-Object -Property WriteTransferCount -Sum).Sum)
            $elapsed = ((Get-Date) - $start).TotalMinutes
            if ($null -ne $last) {
                $delta = [math]::Max(0, $total - $last)
                if ($delta -lt $quietBytes) { if (-not $quietSince) { $quietSince = Get-Date } } else { $quietSince = $null }
                Set-Progress ("{0}: оновлення, {1:N1} МБ/с, {2:N0} хв" -f $L.Name, ($delta / 30 / 1MB), $elapsed)
            }
            $last = $total
            if (-not @($procs | Where-Object { Test-NameLike $_.Name $L.Processes }).Count -and $elapsed -gt 1) { break }   # лаунчер закрився сам
            if ($elapsed -ge $maxM) { break }
            if ($elapsed -ge $minM -and $quietSince -and ((Get-Date) - $quietSince).TotalMinutes -ge $quietM) { break }
        }
        return "$($L.Name): готово за {0:N0} хв" -f ((Get-Date) - $start).TotalMinutes
    } finally {
        [void](Stop-ByName $L.Processes); Start-Sleep -Seconds 3
        Clear-LauncherLogin $L
        Remove-Item -LiteralPath (Join-Path $StateDir 'warmup-active.txt') -ErrorAction SilentlyContinue
    }
}

# Оновлення працює окремим процесом із завдання «\VADE\Update» — від того облікового запису Windows,
# під яким у SteamCMD збережено вхід (install.bat). Номер процесу лежить у state\update.pid.
function Get-UpdatePid {
    $p = Read-StateFile 'update.pid'
    if ($p -match '^\d+$' -and (Get-Process -Id ([int]$p) -ErrorAction SilentlyContinue)) { return [int]$p }
    return 0
}

function Start-UpdateRun {
    Remove-Item -LiteralPath (Join-Path $StateDir 'update.pid') -ErrorAction SilentlyContinue
    try {
        Start-ScheduledTask -TaskPath '\VADE\' -TaskName 'Update' -ErrorAction Stop
        return $true
    } catch {
        Write-Log "Завдання \VADE\Update не знайдено ($_), запускаю від SYSTEM" 'WARN'
        Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden `
            -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"", '-Update', '-ConfigPath', "`"$ConfigPath`"") | Out-Null
        return $true
    }
}

function Stop-UpdateRun {
    $p = Get-UpdatePid
    if ($p) { Stop-ProcessTree $p }
    try { Stop-ScheduledTask -TaskPath '\VADE\' -TaskName 'Update' -ErrorAction Stop } catch { }
    Remove-Item -LiteralPath (Join-Path $StateDir 'update.pid') -ErrorAction SilentlyContinue
}

function Invoke-UpdateRun {
    $script:LogName = 'update'
    if (Get-UpdatePid) { Write-Log 'Оновлення вже працює — вихід'; return }
    Write-StateFile 'update.pid' ([string]$PID)
    Write-Log '===== ОНОВЛЕННЯ: початок ====='
    $results = @()
    try {
        $deepHour = [int](Get-Cfg 'DeepCleanHour' 4)
        $today = Get-Date -Format 'yyyy-MM-dd'
        $deep = (Get-Date).Hour -ge $deepHour -and (Read-StateFile 'last-deep.txt') -ne $today
        Set-Progress 'Закриваю лаунчери'
        Invoke-LogoutCleanup 'перед оновленням' -DeepClean:$deep
        if ($deep) { Write-StateFile 'last-deep.txt' $today }
        foreach ($l in Get-EnabledLaunchers) {
            try {
                switch ([string]$l.Update) {
                    'steamcmd' { $results += Update-SteamGames }
                    'warmup'   { $results += Update-ViaWarmup $l }
                }
            } catch { $results += "$($l.Name): помилка $_"; Write-Log "$($l.Name): $_" 'ERROR' }
        }
    } finally {
        Remove-Item -LiteralPath (Join-Path $StateDir 'update-progress.txt') -ErrorAction SilentlyContinue
    }
    $summary = ($results | Where-Object { $_ }) -join '; '
    Write-StateFile 'last-update.txt' (Get-Date -Format s)
    Write-StateFile 'last-update-result.txt' $summary
    Write-Log "Результат: $summary"
    Write-Log '===== ОНОВЛЕННЯ: кінець ====='
    Remove-Item -LiteralPath (Join-Path $StateDir 'update.pid') -ErrorAction SilentlyContinue
}

function Test-UpdateHour {
    $spec = [string](Get-Cfg 'UpdateHours' '0-23')
    $h = (Get-Date).Hour
    foreach ($part in $spec -split ',') {
        if ($part -match '^\s*(\d+)\s*-\s*(\d+)\s*$') {
            $a = [int]$Matches[1]; $b = [int]$Matches[2]
            if (($a -le $b -and $h -ge $a -and $h -le $b) -or ($a -gt $b -and ($h -ge $a -or $h -le $b))) { return $true }
        } elseif ($part -match '^\s*(\d+)\s*$' -and [int]$Matches[1] -eq $h) { return $true }
    }
    return $false
}

# =====================================================================
#   Головний цикл (від SYSTEM)
# =====================================================================

function Invoke-Service {
    $script:LogName = 'agent'
    [void](Import-AgentConfig)
    Write-Log "===== VADE Agent запущено: $(Get-PcId) / $(Get-PcName) / $(Get-PcZone) ====="
    if ((Get-Cfg 'Token' '') -eq 'CHANGE_ME') { Write-Log 'Token = CHANGE_ME — звіти на сайт не відправляються' 'WARN' }
    [void](Remove-SteamCmdLink)   # якщо ПК вимкнули посеред оновлення

    $loop = [Math]::Max(2, [int](Get-Cfg 'LoopSeconds' 5))
    $confirm = [int](Get-Cfg 'FreeConfirmSeconds' 30)
    $heartbeat = [Math]::Max(30, [int](Get-Cfg 'HeartbeatSeconds' 60))
    $cfgStamp = (Get-Item -LiteralPath $ConfigPath).LastWriteTime

    $state = $null; $why = ''; $since = Get-Date
    $freeCandidate = $null
    $lastSent = [datetime]::MinValue; $sentState = ''
    $updStarted = [datetime]::MinValue
    $first = $true

    while ($true) {
        try {
            # Змінили налаштування — підхоплюємо без перезапуску
            $stamp = (Get-Item -LiteralPath $ConfigPath).LastWriteTime
            if ($stamp -ne $cfgStamp) { [void](Import-AgentConfig); $cfgStamp = $stamp; $script:GameRootsAt = [datetime]::MinValue; Write-Log 'Налаштування перечитано' }

            $sig = Get-PcSignals
            $r = Resolve-PcState $sig
            $raw = $r.State

            # «вільний» підтверджуємо FreeConfirmSeconds; «зайнятий» — одразу
            $newState = $state
            if ($raw -eq 'busy') { $newState = 'busy'; $freeCandidate = $null }
            else {
                if (-not $freeCandidate) { $freeCandidate = Get-Date }
                if ($first -or $state -ne 'busy' -or ((Get-Date) - $freeCandidate).TotalSeconds -ge $confirm) { $newState = 'free' }
            }

            if ($newState -ne $state) {
                $prev = $state
                $state = $newState; $why = $r.Why; $since = Get-Date
                Write-Log ("Стан: {0} → {1} ({2})" -f $(if ($prev) { $prev } else { 'старт' }), $state, $why)

                $updRunning = (Get-UpdatePid) -or ((Get-Date) - $updStarted).TotalSeconds -lt 60
                if ($state -eq 'busy' -and $updRunning) {
                    # Клієнт сів за ПК — зупиняємо оновлення
                    Write-Log 'Клієнт сів за ПК — оновлення зупинено'
                    Stop-UpdateRun
                    $updStarted = [datetime]::MinValue
                    Start-Sleep -Seconds 2
                    [void](Remove-SteamCmdLink)
                    $active = Read-StateFile 'warmup-active.txt'
                    if ($active) {
                        $l = Get-EnabledLaunchers | Where-Object { $_.Name -eq $active } | Select-Object -First 1
                        if ($l) { [void](Stop-ByName $l.Processes); Start-Sleep -Seconds 2; Clear-LauncherLogin $l }
                        Remove-Item -LiteralPath (Join-Path $StateDir 'warmup-active.txt') -ErrorAction SilentlyContinue
                    }
                    Remove-Item -LiteralPath (Join-Path $StateDir 'update-progress.txt') -ErrorAction SilentlyContinue
                    # Перерване оновлення — повторити через пів години вільного часу, а не через UpdateIntervalHours
                    $interval = [double](Get-Cfg 'UpdateIntervalHours' 6)
                    Write-StateFile 'last-update.txt' ((Get-Date).AddHours(0.5 - $interval).ToString('s'))
                }

                if ($state -eq 'free') {
                    if (($prev -eq 'busy' -and (Get-Cfg 'CleanupOnLogout' $true)) -or ($first -and (Get-Cfg 'CleanupOnStart' $true))) {
                        Invoke-LogoutCleanup $why
                    }
                }
            } elseif ($state -eq 'busy') { $why = $r.Why }

            # Оновлення: ПК вільний досить довго, година підходить, давно не оновлювались
            $updRunning = (Get-UpdatePid) -or ((Get-Date) - $updStarted).TotalSeconds -lt 60
            if ($state -eq 'free' -and (Get-Cfg 'UpdateEnabled' $true) -and -not $updRunning -and -not (Test-Path -LiteralPath (Join-Path $Root 'pause'))) {
                $freeMin = ((Get-Date) - $since).TotalMinutes
                $lastUpd = Read-StateFile 'last-update.txt'
                $hoursAgo = if ($lastUpd) { try { ((Get-Date) - [datetime]$lastUpd).TotalHours } catch { 999 } } else { 999 }
                if ($freeMin -ge [double](Get-Cfg 'UpdateAfterFreeMinutes' 10) -and $hoursAgo -ge [double](Get-Cfg 'UpdateIntervalHours' 6) -and (Test-UpdateHour)) {
                    Write-Log 'Запускаю оновлення ігор'
                    if (Start-UpdateRun) { $updStarted = Get-Date }
                    Write-StateFile 'last-update.txt' (Get-Date -Format s)   # щоб не запускати повторно, навіть якщо перервуть
                }
            }

            # Звіт на сайт: одразу при зміні, інакше раз на хвилину
            $detail = $why
            $progress = Read-StateFile 'update-progress.txt'
            if ($progress) { $detail = "оновлення: $progress" }
            if (Read-StateFile 'steam-login-error.txt') { $detail += ' | SteamCMD: потрібен вхід' }
            if (Test-Path -LiteralPath (Join-Path $Root 'pause')) { $detail += ' | пауза' }
            if ($state -ne $sentState -or ((Get-Date) - $lastSent).TotalSeconds -ge $heartbeat) {
                if (Send-Report $state $detail) { $sentState = $state }
                $lastSent = Get-Date
            }
            Write-StateFile 'current.txt' ("{0}`t{1}`t{2}" -f $state, (Get-Date -Format s), $detail)
            $first = $false
        } catch {
            Write-Log "Помилка в циклі: $_" 'ERROR'
        }
        Start-Sleep -Seconds $loop
    }
}

# =====================================================================
#   Помічник у сесії користувача
# =====================================================================

$ProbeTypes = @'
using System; using System.Text; using System.Collections.Generic; using System.Runtime.InteropServices;
public static class VadeProbe {
  [StructLayout(LayoutKind.Sequential)] struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
  [DllImport("user32.dll")] static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern int GetWindowTextLength(IntPtr h);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll", SetLastError = true)] static extern IntPtr OpenInputDesktop(uint flags, bool inherit, uint access);
  [DllImport("user32.dll")] static extern bool CloseDesktop(IntPtr h);
  public static uint IdleMs() { LASTINPUTINFO i = new LASTINPUTINFO(); i.cbSize = (uint)Marshal.SizeOf(i); if (!GetLastInputInfo(ref i)) return 0; return unchecked((uint)Environment.TickCount - i.dwTime); }
  public static string Title(IntPtr h) { int n = GetWindowTextLength(h); if (n <= 0) return ""; StringBuilder sb = new StringBuilder(n + 1); GetWindowText(h, sb, sb.Capacity); return sb.ToString(); }
  public static uint Pid(IntPtr h) { uint p; GetWindowThreadProcessId(h, out p); return p; }
  public static string ForegroundInfo() { IntPtr h = GetForegroundWindow(); return Pid(h) + "\t" + Title(h); }
  public static List<string> Windows() { List<string> r = new List<string>(); EnumWindows(delegate (IntPtr h, IntPtr l) { if (IsWindowVisible(h)) { string t = Title(h); if (t.Length > 0) r.Add(Pid(h) + "\t" + t); } return true; }, IntPtr.Zero); return r; }
  public static bool Locked() { IntPtr d = OpenInputDesktop(0, false, 0x0100); if (d == IntPtr.Zero) return true; CloseDesktop(d); return false; }
}
'@

function Get-WindowList {
    $names = @{}
    $list = @()
    foreach ($w in [VadeProbe]::Windows()) {
        $parts = $w -split "`t", 2
        $wpid = [int]$parts[0]
        if (-not $names.ContainsKey($wpid)) { $names[$wpid] = try { (Get-Process -Id $wpid -ErrorAction Stop).ProcessName } catch { '?' } }
        $list += [pscustomobject]@{ proc = $names[$wpid]; title = $parts[1] }
    }
    return $list
}

function Invoke-Probe {
    $script:LogName = 'probe'
    Add-Type -TypeDefinition $ProbeTypes -ErrorAction Stop
    if (-not (Test-Path -LiteralPath $ProbeDir)) { New-Item -ItemType Directory -Path $ProbeDir -Force -ErrorAction SilentlyContinue | Out-Null }
    $session = (Get-Process -Id $PID).SessionId
    $file = Join-Path $ProbeDir "probe-$session.json"
    $tmp = "$file.tmp"
    while ($true) {
        try {
            $fg = ([VadeProbe]::ForegroundInfo()) -split "`t", 2
            $fgProc = try { (Get-Process -Id ([int]$fg[0]) -ErrorAction Stop).ProcessName } catch { '' }
            $data = [ordered]@{
                time    = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
                session = $session
                user    = "$env:USERDOMAIN\$env:USERNAME"
                idleSec = [int]([VadeProbe]::IdleMs() / 1000)
                locked  = [VadeProbe]::Locked()
                fg      = @{ proc = $fgProc; title = $fg[1] }
                windows = @(Get-WindowList | Select-Object -First 60)
            }
            Set-Content -LiteralPath $tmp -Value ($data | ConvertTo-Json -Depth 4 -Compress) -Encoding UTF8
            Move-Item -LiteralPath $tmp -Destination $file -Force
        } catch { }
        Start-Sleep -Seconds 3
    }
}

# =====================================================================
#   Навчання: як виглядає сесія Senet
# =====================================================================

# Системні процеси й лаунчери, які нічого не кажуть про сесію Senet
$NoiseProcesses = @(
    'System', 'Idle', 'Registry', 'smss', 'csrss', 'wininit', 'winlogon', 'services', 'lsass', 'svchost', 'fontdrvhost', 'dwm', 'Memory Compression',
    'conhost', 'RuntimeBroker', 'dllhost', 'backgroundTaskHost', 'SearchProtocolHost', 'SearchFilterHost', 'SearchIndexer', 'SearchApp', 'SearchHost',
    'WmiPrvSE', 'WmiApSrv', 'taskhostw', 'taskmgr', 'smartscreen', 'powershell', 'pwsh', 'cmd', 'wscript', 'cscript', 'reg', 'taskkill', 'schtasks',
    'audiodg', 'ctfmon', 'sihost', 'explorer', 'ShellExperienceHost', 'StartMenuExperienceHost', 'TextInputHost', 'SystemSettings', 'ApplicationFrameHost',
    'consent', 'MoUsoCoreWorker', 'TiWorker', 'TrustedInstaller', 'msedge', 'msedgewebview2', 'chrome', 'firefox', 'opera', 'brave',
    'Widgets', 'WidgetService', 'CompPkgSrv', 'MpCmdRun', 'NisSrv', 'MsMpEng', 'MpDefenderCoreService', 'SecurityHealthService', 'SecurityHealthSystray',
    'SgrmBroker', 'spoolsv', 'wuauclt', 'UsoClient', 'LockApp', 'LogonUI', 'mobsync', 'OneDrive', 'Teams', 'ms-teams', 'GameBar', 'GameBarFTServer',
    'PhoneExperienceHost', 'YourPhone', 'UserOOBEBroker', 'WUDFHost', 'unsecapp', 'sppsvc', 'SppExtComObj', 'VSSVC', 'WMIADAP', 'wermgr', 'WerFault',
    'CompatTelRunner', 'DeviceCensus', 'musNotification', 'musNotifyIcon', 'SystemSettingsBroker', 'LsaIso', 'MicrosoftEdgeUpdate', 'GoogleUpdate',
    'NVDisplay.Container', 'nvcontainer', 'NVIDIA Web Helper', 'NVIDIA Share', 'nvsphelper64', 'RtkAudUService64', 'RadeonSoftware', 'AMDRSServ',
    'notepad', 'mmc', 'regedit', 'Code', 'WindowsTerminal', 'OpenConsole', 'rundll32', 'ngen', 'ngentask', 'mscorsvw', 'msiexec', 'TrustedInstaller'
)

function Get-LearnSnapshot {
    $procs = Get-Processes
    $launcherNames = @(Get-EnabledLaunchers | ForEach-Object { $_.Processes }) + @('steamservice', 'vgc', 'vgtray')
    $names = @($procs | ForEach-Object { $_.Name -replace '\.exe$', '' } | Where-Object {
            $_ -and -not (Test-NameLike $_ $NoiseProcesses) -and -not (Test-NameLike $_ $launcherNames) } | Sort-Object -Unique)
    $paths = @{}
    foreach ($p in $procs) { $n = $p.Name -replace '\.exe$', ''; if ($p.ExecutablePath -and -not $paths.ContainsKey($n)) { $paths[$n] = $p.ExecutablePath } }
    $wins = @()
    $probe = Get-ProbeInfo
    if ($probe -and $probe.windows) { $wins = @($probe.windows) }
    elseif ('VadeProbe' -as [type]) { $wins = @(Get-WindowList) }
    $titles = @($wins | Where-Object { $_.title -and -not (Test-NameLike $_.proc $NoiseProcesses) -and -not (Test-NameLike $_.proc $launcherNames) } |
            ForEach-Object { [string]$_.title } | Sort-Object -Unique)
    return [pscustomobject]@{ Names = $names; Titles = $titles; Paths = $paths; Idle = if ($probe) { $probe.idleSec } else { -1 } }
}

function Wait-WithCountdown([int]$Seconds, [string]$Text) {
    Write-Host ''
    Write-Host $Text -ForegroundColor Yellow
    for ($i = $Seconds; $i -gt 0; $i--) {
        Write-Host -NoNewline ("`r  знімок через {0,3} с " -f $i)
        if ($i -le 3) { try { [console]::Beep(880, 150) } catch { } }
        Start-Sleep -Seconds 1
    }
    Write-Host "`r  знімок зроблено.        " -ForegroundColor Green
    try { [console]::Beep(1320, 400) } catch { }
}

function Format-PsdList($Items) {
    if (-not @($Items).Count) { return '@()' }
    return '@(' + ((@($Items) | ForEach-Object { "'" + ([string]$_ -replace "'", "''") + "'" }) -join ', ') + ')'
}

function Invoke-Learn {
    $script:LogName = 'learn'
    [void](Import-AgentConfig)
    try { Add-Type -TypeDefinition $ProbeTypes -ErrorAction Stop } catch { }
    Write-Host '=================================================================' -ForegroundColor Cyan
    Write-Host '  НАВЧАННЯ: як на цьому ПК виглядає сесія клієнта в Senet' -ForegroundColor Cyan
    Write-Host '=================================================================' -ForegroundColor Cyan
    Write-Host 'Буде три знімки процесів і вікон: ВІЛЬНИЙ → ЗАЙНЯТИЙ → ВІЛЬНИЙ.'
    Write-Host 'Перед кожним знімком є час, щоб перевести ПК у потрібний стан. Останні 3 секунди — короткі звукові сигнали.'
    Write-Host 'Ігри та лаунчери під час навчання НЕ запускайте.'
    $wait = 90
    $ans = Read-Host "Скільки секунд давати на кожен крок? (Enter = $wait)"
    if ($ans -match '^\d+$' -and [int]$ans -ge 15) { $wait = [int]$ans }

    Wait-WithCountdown $wait '1/3  Поверніть ПК у стан «ВІЛЬНИЙ»: екран входу Senet, клієнт НЕ залогінений.'
    $free1 = Get-LearnSnapshot
    Wait-WithCountdown $wait '2/3  Увійдіть у Senet як КЛІЄНТ (тестовий акаунт). Нічого не запускайте.'
    $busy = Get-LearnSnapshot
    Wait-WithCountdown $wait '3/3  Вийдіть з акаунта клієнта в Senet (знову екран входу).'
    $free2 = Get-LearnSnapshot

    $busyProcs = @($busy.Names | Where-Object { $free1.Names -notcontains $_ -and $free2.Names -notcontains $_ })
    $freeProcs = @($free1.Names | Where-Object { $free2.Names -contains $_ -and $busy.Names -notcontains $_ })
    $busyWins  = @($busy.Titles | Where-Object { $free1.Titles -notcontains $_ -and $free2.Titles -notcontains $_ } | ForEach-Object { [Management.Automation.WildcardPattern]::Escape($_) })
    $freeWins  = @($free1.Titles | Where-Object { $free2.Titles -contains $_ -and $busy.Titles -notcontains $_ } | ForEach-Object { [Management.Automation.WildcardPattern]::Escape($_) })

    $report = New-Object System.Collections.Generic.List[string]
    $report.Add("Навчання $(Get-Date -Format s) на $env:COMPUTERNAME")
    $report.Add('Процеси, схожі на Senet (у будь-якому знімку):')
    foreach ($n in (@($free1.Names + $busy.Names + $free2.Names) | Sort-Object -Unique)) {
        $path = [string]$free1.Paths[$n]; if (-not $path) { $path = [string]$busy.Paths[$n] }
        if ($n -match 'senet|enes|shell' -or $path -match 'senet|enes') { $report.Add("  $n  $path") }
    }
    $report.Add('Лише під час сесії — процеси: ' + ($busyProcs -join ', '))
    $report.Add('Лише під час сесії — вікна:   ' + ($busyWins -join ' | '))
    $report.Add('Лише без клієнта — процеси:   ' + ($freeProcs -join ', '))
    $report.Add('Лише без клієнта — вікна:     ' + ($freeWins -join ' | '))
    $report.Add("Час без вводу у знімках (с): $($free1.Idle) / $($busy.Idle) / $($free2.Idle)  (-1 = помічник не працює)")
    $reportFile = Join-Path $LogDir 'learn-result.txt'
    Set-Content -LiteralPath $reportFile -Value $report -Encoding UTF8
    Write-Host ''
    $report | ForEach-Object { Write-Host $_ }
    Write-Host ''

    if (-not ($busyProcs.Count + $freeProcs.Count + $busyWins.Count + $freeWins.Count)) {
        Write-Host 'Відмінностей не знайдено. Агент працюватиме за ознаками «гра запущена» і «час без миші/клавіатури».' -ForegroundColor Yellow
        Write-Host "Повторіть навчання з більшою паузою або надішліть $reportFile розробнику." -ForegroundColor Yellow
        return
    }
    $yes = Read-Host 'Зберегти ці ознаки для агента? (Y/N)'
    if ($yes -notmatch '^[YyТтДд]') { Write-Host 'Не збережено.'; return }
    $psd = @(
        "# Створено learn.bat $(Get-Date -Format s) на $env:COMPUTERNAME. Можна скопіювати на інші ПК у папку state.",
        '@{',
        "    BusyProcesses = $(Format-PsdList $busyProcs)",
        "    FreeProcesses = $(Format-PsdList $freeProcs)",
        "    BusyWindows   = $(Format-PsdList $busyWins)",
        "    FreeWindows   = $(Format-PsdList $freeWins)",
        '}'
    )
    Set-Content -LiteralPath (Join-Path $StateDir 'senet-learned.psd1') -Value $psd -Encoding UTF8
    Write-Host "Збережено: $(Join-Path $StateDir 'senet-learned.psd1'). Агент підхопить за хвилину." -ForegroundColor Green
    Write-Host 'Цей файл можна скопіювати на всі інші ПК (папка C:\VadeAgent\state) — Senet однаковий.'
}

# =====================================================================
#   Зберегти клубний вхід лаунчера (для оновлень warmup)
# =====================================================================

function Invoke-SaveClubLogin([string]$Name) {
    $script:LogName = 'agent'
    [void](Import-AgentConfig)
    $l = Get-EnabledLaunchers | Where-Object { $_.Name -eq $Name } | Select-Object -First 1
    if (-not $l) { Write-Host "Немає увімкненого лаунчера '$Name'. Є: $((Get-EnabledLaunchers | ForEach-Object { $_.Name }) -join ', ')" -ForegroundColor Red; return }
    if (-not @($l.ClubLogin).Count) { Write-Host "Для $Name не задано ClubLogin у налаштуваннях." -ForegroundColor Red; return }
    $prof = Get-ConsoleUserProfile
    if (-not $prof) { Write-Host 'Не знайдено користувача Windows, який зараз за ПК.' -ForegroundColor Red; return }
    Write-Host "Користувач Windows: $($prof.User)  ($($prof.Path))"
    Write-Host "1. Відкрийте $Name, увійдіть КЛУБНИМ акаунтом і поставте «запам'ятати мене»."
    Write-Host '2. Переконайтесь, що в налаштуваннях лаунчера ввімкнено автооновлення ігор.'
    Read-Host '3. Натисніть Enter — лаунчер буде закрито і вхід збережено'
    [void](Stop-ByName $l.Processes); Start-Sleep -Seconds 3
    $snap = Join-Path $ClubDir $Name
    if (Test-Path -LiteralPath $snap) { Remove-Item -LiteralPath $snap -Recurse -Force }
    $count = 0
    foreach ($pattern in @($l.ClubLogin)) {
        if ($pattern -notlike '{USER}\*') { continue }
        $rel = $pattern.Substring(7)
        foreach ($f in Get-ChildItem -Path (Join-Path $prof.Path $rel) -File -Force -ErrorAction SilentlyContinue) {
            $relFile = $f.FullName.Substring($prof.Path.Length).TrimStart('\')
            $dest = Join-Path $snap ('USER\' + $relFile)
            New-Item -ItemType Directory -Path (Split-Path $dest -Parent) -Force | Out-Null
            Copy-Item -LiteralPath $f.FullName -Destination $dest -Force
            $count++
        }
    }
    if (-not $count) { Write-Host 'Файлів входу не знайдено — чи точно ви увійшли і поставили «запам''ятати»?' -ForegroundColor Red; return }
    # Доступ лише SYSTEM і адміністраторам
    & icacls.exe "$ClubDir" /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' /T /Q 2>&1 | Out-Null
    Clear-LauncherLogin $l
    Write-Host "Збережено файлів: $count. Клубний вхід з цього профілю стерто — гравці його не побачать." -ForegroundColor Green
    Write-Host "Щоб використати на інших ПК, скопіюйте папку $snap туди ж на інших ПК."
}

# =====================================================================
#   Діагностика
# =====================================================================

function Show-Status {
    [void](Import-AgentConfig)
    $sig = Get-PcSignals
    $r = Resolve-PcState $sig
    Write-Host "ПК: $(Get-PcId)  |  на сайті: $(Get-PcName)  |  зона: $(Get-PcZone)"
    Write-Host ("Зараз: {0}  — {1}" -f $r.State.ToUpper(), $r.Why) -ForegroundColor $(if ($r.State -eq 'busy') { 'Red' } else { 'Green' })
    Write-Host "Користувач Windows: $($sig.User)"
    Write-Host ("Гра: {0}" -f $(if ($sig.Game) { "$($sig.Game.Name)  $($sig.Game.ExecutablePath)" } else { 'немає' }))
    Write-Host ("Senet: {0}" -f $(if ($sig.Senet) { "$($sig.Senet.State) ($($sig.Senet.Why))" } else { 'ознак не задано або не спрацювали' }))
    Write-Host ("Помічник: {0}" -f $(if ($sig.Probe) { "працює, без вводу $($sig.IdleSec) с, заблоковано: $($sig.Locked), активне вікно: $($sig.Probe.fg.proc) — $($sig.Probe.fg.title)" } else { 'не працює' }))
    Write-Host 'Папки ігор:'; Get-GameRoots | ForEach-Object { Write-Host "  $_" }
    Write-Host "Останній стан агента: $(Read-StateFile 'current.txt')"
    Write-Host "Останнє оновлення: $(Read-StateFile 'last-update.txt')  $(Read-StateFile 'last-update-result.txt')"
}

# =====================================================================
#   Запуск
# =====================================================================

try {
    if ($Probe) { Invoke-Probe; return }
    if ($Service) { Invoke-Service; return }
    [void](Import-AgentConfig)
    if ($Update) { Invoke-UpdateRun; return }
    if ($Cleanup) { Invoke-LogoutCleanup 'вручну' -DeepClean:$Deep; return }
    if ($Learn) { Invoke-Learn; return }
    if ($SaveClubLogin) { Invoke-SaveClubLogin $SaveClubLogin; return }
    if ($SteamLogin) {
        $exe = Get-SteamCmd
        $user = [string]((Get-Cfg 'Steam' @{}).User)
        if (-not $exe -or -not $user) { Write-Host 'Немає SteamCMD або Steam.User у налаштуваннях' -ForegroundColor Red; exit 1 }
        Write-Host "Вхід у SteamCMD акаунтом $user. Введіть пароль, потім код Steam Guard (пароль при введенні не видно)."
        & $exe +login $user +quit
        Remove-Item -LiteralPath (Join-Path $StateDir 'steam-login-error.txt') -ErrorAction SilentlyContinue
        return
    }
    if ($TestReport) {
        $sig = Get-PcSignals; $r = Resolve-PcState $sig
        if (Send-Report $r.State ("тест: " + $r.Why)) { Write-Host "Сайт прийняв звіт: $(Get-PcName) — $($r.State)" -ForegroundColor Green }
        else { Write-Host 'Сайт НЕ прийняв звіт — перевірте SiteUrl і Token, деталі в logs\agent.log' -ForegroundColor Red; exit 1 }
        return
    }
    Show-Status
} catch {
    Write-Log "Критична помилка: $_" 'ERROR'
    if (-not $Service -and -not $Probe) { Write-Host $_ -ForegroundColor Red }
    exit 1
}
