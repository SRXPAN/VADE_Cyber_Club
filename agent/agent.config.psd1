# =====================================================================
#   VADE Agent — налаштування. Однаковий файл на всіх ПК клубу.
#   Що відрізняється між ПК (номер, зона) — визначається само з імені
#   комп'ютера або задається тут у PcName / Zone.
#   Після зміни файлу агент сам підхоплює налаштування за кілька секунд.
#   Синтаксис: рядки в 'одинарних лапках', списки @('a','b'), $true / $false.
# =====================================================================
@{
    # ----------------------------- Цей ПК ------------------------------
    # Ідентифікатор для сайту: латиниця, цифри, - або _. Порожньо — ім'я комп'ютера (напр. VADE-PC07).
    PcId     = ''
    # Як ПК підписаний на сайті. Порожньо — 'PC ' + число з імені комп'ютера (VADE-PC07 → 'PC 7').
    PcName   = ''
    # Зона на сайті. Пишіть так само, як name.pl у zones в config.js сайту (Standard, Streamer, Bootcamp 5×5),
    # тоді назва перекладеться. Можна задати по імені комп'ютера в ZoneByPc нижче.
    Zone     = 'Standard'
    # Окремі ПК в інших зонах: шаблон імені комп'ютера = зона. Перший збіг перемагає.
    ZoneByPc = @{
        # '*PC2[1-5]' = 'Bootcamp 5×5'
        # '*STREAM*'  = 'Streamer'
    }
    # Порядок на сайті. 0 — за назвою (PC 2 перед PC 10).
    Position = 0

    # ------------------------------ Сайт -------------------------------
    SiteUrl = 'https://vade-cyberclub.pages.dev'
    # Той самий секрет, що AGENT_TOKEN у Cloudflare. Однаковий для всіх ПК.
    Token   = 'CHANGE_ME'
    # Як часто ПК каже сайту «я живий». Зміна стану відправляється одразу.
    HeartbeatSeconds = 60

    # ---------------------- Як визначається «зайнятий» ----------------------
    # Перевірка кожні LoopSeconds секунд. ПК ЗАЙНЯТИЙ, якщо:
    #   1) запущена гра (будь-який процес з папки ігор — Steam, Epic, Riot тощо знаходяться самі), АБО
    #   2) Senet показує сесію клієнта (ознаки з блоку Senet нижче або з файлу state\senet-learned.psd1,
    #      який створює learn.bat), АБО
    #   3) ознак Senet ще немає — хтось користувався мишею/клавіатурою останні IdleFreeMinutes хвилин.
    LoopSeconds        = 5
    IdleFreeMinutes    = 10
    # «Зайнятий → вільний» лише коли ПК вільний стільки секунд поспіль (щоб не смикалось між іграми).
    FreeConfirmSeconds = 30

    # Ознаки сесії Senet. Заповнюються самі через learn.bat — руками можна не чіпати.
    # Шаблони з * — назви процесів (без .exe) і заголовки вікон.
    Senet = @{
        BusyProcesses = @()   # процеси, які є ЛИШЕ під час сесії клієнта
        FreeProcesses = @()   # процеси, які є ЛИШЕ коли клієнта немає (екран входу Senet)
        BusyWindows   = @()   # заголовки вікон, які є лише під час сесії
        FreeWindows   = @()   # заголовки вікон екрана входу
    }

    # Додаткові папки з іграми (бібліотеки Steam і ігри Epic знаходяться самі).
    GameFolders = @(
        'C:\Riot Games', 'D:\Riot Games',
        'C:\Program Files (x86)\World of Warcraft',
        'C:\Program Files (x86)\Call of Duty', 'C:\Program Files (x86)\Overwatch', 'C:\Program Files (x86)\Diablo IV',
        'C:\Program Files\EA Games', 'C:\Program Files (x86)\Ubisoft\Ubisoft Game Launcher\games',
        'C:\Games', 'D:\Games', 'E:\Games'
    )
    # Ігри поза цими папками — назви процесів.
    GameProcesses = @()
    # Процеси в папках ігор, які НЕ означають, що хтось грає (античити, краш-репортери, сервіси).
    IgnoreProcesses = @(
        'UnityCrashHandler*', 'CrashReport*', 'CrashHandler*', '*CrashReporter*', 'EasyAntiCheat*', 'BEService*',
        'vgc', 'vgtray', 'RiotClient*', 'Battle.net*', 'BlizzardError', 'steamwebhelper', 'steamservice',
        'EpicWebHelper', 'EpicGamesLauncher', 'EACefSubProcess', 'Uplay*', 'upc', 'UbisoftConnect', 'GalaxyClient*'
    )

    # ------------------------ Після виходу клієнта ------------------------
    # Перехід «зайнятий → вільний» = клієнт вийшов: закрити ігри й лаунчери, стерти логіни гравця.
    CleanupOnLogout = $true
    # Те саме при старті ПК (якщо минулу сесію закінчили вимкненням).
    CleanupOnStart  = $true
    # Закривати процеси ігор, якщо гравець залишив гру відкритою.
    KillGames       = $true
    # Чистити TEMP усіх користувачів Windows.
    CleanTemp       = $true

    # ---------------------------- Оновлення ігор ----------------------------
    # Оновлення запускаються, коли ПК вільний UpdateAfterFreeMinutes хвилин, не частіше ніж раз на
    # UpdateIntervalHours годин і лише в години UpdateHours. Щойно клієнт сідає — оновлення зупиняється
    # (Steam докачає сам при запуску гри).
    UpdateEnabled          = $true
    UpdateAfterFreeMinutes = 10
    UpdateIntervalHours    = 6
    UpdateHours            = '0-23'      # напр. '0-11' — лише з півночі до полудня
    # Раз на добу, у перше оновлення після цієї години — глибоке чищення кешу Steam (як у club_night.bat).
    DeepCleanHour          = 4

    Steam = @{
        Path          = 'C:\Program Files (x86)\Steam'
        SteamCmdDir   = 'C:\steamcmd'
        User          = 'vadekrarow'   # клубний акаунт для SteamCMD. Пароль тут не зберігається.
        Apps          = 'auto'         # 'auto' — усі встановлені ігри, або '730 570 578080'
        Validate      = $false         # $true — перевіряти файли (повільно)
        CleanUserdata = $false         # $true — стирати локальні налаштування ігор гравців (userdata)
    }

    # -------------------------------- Лаунчери --------------------------------
    # Для кожного лаунчера:
    #   Processes   — що закрити після виходу клієнта
    #   DeleteFiles / DeleteDirs — файли збереженого входу. {USER} = кожна папка C:\Users\<ім'я>,
    #                 {STEAM} = папка Steam. * — будь-які символи.
    #   IniSections — секції ini-файлу, які стерти; VdfBlocks — блоки vdf-файлу Steam;
    #   TextReplace — замінити текст у файлі (регулярний вираз);
    #   Registry    — значення в реєстрі кожного користувача (HKCU) стерти або змінити;
    #   Credentials — записи Диспетчера облікових даних Windows (шаблон із *).
    #   Update      — 'steamcmd' (Steam) | 'warmup' | 'none'.
    #       warmup: лаунчер запускається з КЛУБНИМ входом, сам оновлює ігри, потім закривається й логін стирається.
    #       Клубний вхід зберігається один раз командою save-club-login.bat <Name> (див. README).
    #   ClubLogin   — які файли зберегти для warmup.
    #   IoProcesses — додаткові процеси, за записом яких на диск видно, що лаунчер ще качає (не закриваються).
    Launchers = @(
        @{
            Name        = 'Steam'
            Enabled     = $true
            Processes   = @('steam', 'steamwebhelper', 'gameoverlayui', 'gameoverlayui64', 'steamerrorreporter', 'steamerrorreporter64')
            DeleteFiles = @('{STEAM}\config\loginusers.vdf', '{STEAM}\ssfn*', '{USER}\AppData\Local\Steam\local.vdf')
            DeleteDirs  = @('{USER}\AppData\Local\Steam\htmlcache', '{STEAM}\config\htmlcache')
            VdfBlocks   = @(@{ File = '{STEAM}\config\config.vdf'; Blocks = @('ConnectCache', 'Accounts') })
            Registry    = @(
                @{ Key = 'Software\Valve\Steam'; Value = 'AutoLoginUser'; Delete = $true },
                @{ Key = 'Software\Valve\Steam'; Value = 'RememberPassword'; Type = 'REG_DWORD'; Data = '0' }
            )
            Update      = 'steamcmd'
        },
        @{
            Name        = 'Epic'
            Enabled     = $true
            Processes   = @('EpicGamesLauncher', 'EpicWebHelper', 'EpicOnlineServicesUserHelper')
            IniSections = @(@{ File = '{USER}\AppData\Local\EpicGamesLauncher\Saved\Config\Windows\GameUserSettings.ini'; Sections = @('RememberMe', 'Offline') })
            DeleteDirs  = @('{USER}\AppData\Local\EpicGamesLauncher\Saved\webcache*')
            Update      = 'warmup'
            Exe         = '{PF86}\Epic Games\Launcher\Portal\Binaries\Win64\EpicGamesLauncher.exe'
            Args        = '-silent'
            ClubLogin   = @('{USER}\AppData\Local\EpicGamesLauncher\Saved\Config\Windows\GameUserSettings.ini')
        },
        @{
            Name        = 'Riot'
            Enabled     = $true
            Processes   = @('RiotClientServices', 'RiotClientUx', 'RiotClientUxRender', 'RiotClientCrashHandler', 'Riot Client',
                            'LeagueClient', 'LeagueClientUx', 'LeagueClientUxRender', 'League of Legends', 'VALORANT', 'VALORANT-Win64-Shipping')
            DeleteFiles = @('{USER}\AppData\Local\Riot Games\Riot Client\Data\RiotGamesPrivateSettings.yaml',
                            '{USER}\AppData\Local\Riot Games\Riot Client\Data\RiotClientPrivateSettings.yaml')
            DeleteDirs  = @('{USER}\AppData\Local\Riot Games\Riot Client\Data\Sessions')
            Update      = 'warmup'
            Exe         = 'C:\Riot Games\Riot Client\RiotClientServices.exe'
            Args        = ''
            ClubLogin   = @('{USER}\AppData\Local\Riot Games\Riot Client\Data\RiotGamesPrivateSettings.yaml',
                            '{USER}\AppData\Local\Riot Games\Riot Client\Data\RiotClientPrivateSettings.yaml')
        },
        @{
            Name        = 'Battle.net'
            Enabled     = $true
            Processes   = @('Battle.net', 'Battle.net Helper', 'BlizzardError')
            IoProcesses = @('Agent')   # завантажує ігри Battle.net; лише для спостереження, не закривається
            TextReplace = @(@{ File = '{USER}\AppData\Roaming\Battle.net\Battle.net.config'; Pattern = '"SavedAccountNames"\s*:\s*"[^"]*"'; Replace = '"SavedAccountNames": ""' })
            DeleteDirs  = @('{USER}\AppData\Local\Battle.net\BrowserCaches', '{USER}\AppData\Local\Battle.net\Cache')
            Credentials = @('Battle.net*', 'Blizzard*')
            Update      = 'warmup'
            Exe         = '{PF86}\Battle.net\Battle.net Launcher.exe'
            Args        = ''
            ClubLogin   = @('{USER}\AppData\Roaming\Battle.net\Battle.net.config')
        },
        @{
            Name        = 'EA'
            Enabled     = $true
            Processes   = @('EADesktop', 'EACefSubProcess', 'EALauncher', 'Origin', 'OriginWebHelperService')
            DeleteDirs  = @('{USER}\AppData\Local\Electronic Arts\EA Desktop\CEF\BrowserCache', '{USER}\AppData\Local\Electronic Arts\EA Desktop\CEF\Cookies')
            Update      = 'none'
        },
        @{
            Name        = 'Ubisoft'
            Enabled     = $true
            Processes   = @('upc', 'UbisoftConnect', 'UplayWebCore', 'UbisoftGameLauncher', 'UbisoftGameLauncher64')
            DeleteFiles = @('{USER}\AppData\Local\Ubisoft Game Launcher\user.dat', '{USER}\AppData\Local\Ubisoft Game Launcher\ConnectSecureStorage.dat')
            Update      = 'none'
        },
        @{
            Name        = 'GOG'
            Enabled     = $true
            Processes   = @('GalaxyClient', 'GalaxyClient Helper', 'GOG Galaxy Notifications Renderer')
            Update      = 'none'
        },
        @{
            # Discord вимкнено: увімкніть, якщо гравці логіняться у свій Discord на ПК.
            Name        = 'Discord'
            Enabled     = $false
            Processes   = @('Discord')
            DeleteDirs  = @('{USER}\AppData\Roaming\discord\Local Storage', '{USER}\AppData\Roaming\discord\Session Storage')
            Update      = 'none'
        }
    )

    # Скільки триває warmup: щонайменше / щонайбільше (хвилин) і коли вважати, що завантаження скінчилось.
    WarmupMinMinutes   = 4
    WarmupMaxMinutes   = 90
    WarmupQuietMinutes = 3     # стільки хвилин поспіль лаунчер майже нічого не пише на диск
    WarmupQuietMBps    = 1
}
