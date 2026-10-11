/* =====================================================================
   VADE Cyber Club — налаштування сторінки
   ---------------------------------------------------------------------
   Увесь контент, переклади та ID трекерів змінюються ТУТ. Інші файли чіпати не треба.
   • Тексти задаються чотирма мовами: { pl: "…", en: "…", uk: "…", ru: "…" }.
     Звичайний рядок ("VADE") показується однаково всіма мовами.
     Якщо в об'єкті бракує якоїсь мови, показується польський варіант.
   • У будь-якому тексті можна писати {phone}, {address} або {name} — підставиться з contacts і site.
   • Порожній url ("") — кнопка або іконка просто не показується.
   • «ЗАМІНИТИ» — цих даних поки немає у відкритих джерелах клубу, впишіть свої.
   Реальні дані взято з Google Maps (картка «VADE Cyber Club») та Instagram @vade_krakow.
   ===================================================================== */

window.VADE_CONFIG = {
  /* ---------- Мови ----------
     Як обирається мова: ?lang=en у посиланні → мова, яку відвідувач уже обрав на сайті
     (запам'ятовується в браузері) → мова браузера → default.
     "uk" — код української мови (ISO 639-1), а на кнопці показується label "UA".
     Порядок кнопок — за розміром аудиторії клубу: польська, українська, англійська, російська. */
  languages: {
    default: "pl",
    list: [
      { code: "pl", label: "PL", name: "Polski",     locale: "pl-PL" },
      { code: "uk", label: "UA", name: "Українська", locale: "uk-UA" },
      { code: "en", label: "EN", name: "English",    locale: "en-GB" },
      { code: "ru", label: "RU", name: "Русский",    locale: "ru-RU" }
    ]
  },

  site: {
    name: "VADE",                                  // великий напис у шапці
    fullName: "VADE Cyber Club",                   // повна назва, як у Google Maps
    title: {                                       // назва вкладки браузера
      pl: "VADE Cyber Club — klub gamingowy w Krakowie",
      en: "VADE Cyber Club — gaming club in Kraków",
      uk: "VADE Cyber Club — кіберклуб у Кракові",
      ru: "VADE Cyber Club — киберклуб в Кракове"
    },
    tagline: {
      pl: "Klub gamingowy · Kraków",
      en: "Gaming club · Kraków",
      uk: "Кіберклуб · Краків",
      ru: "Киберклуб · Краков"
    },
    description: {                                 // опис клубу з Google Maps
      pl: "VADE Cyber Club — gaming, e-sport i rywalizacja w centrum Krakowa. Mocne PC, świetna atmosfera i miejsce stworzone dla graczy.",
      en: "VADE Cyber Club — gaming, esports and competition in the heart of Kraków. Powerful PCs, a great atmosphere and a place built for gamers.",
      uk: "VADE Cyber Club — геймінг, кіберспорт і змагання в центрі Кракова. Потужні ПК, чудова атмосфера та місце, створене для геймерів.",
      ru: "VADE Cyber Club — гейминг, киберспорт и соревнования в центре Кракова. Мощные ПК, отличная атмосфера и место, созданное для геймеров."
    },
    url: "",                                       // домен сайту, напр. "https://vade.pl/" (впишіть, коли буде). Порожньо — береться адреса відкритої сторінки
    logo: "assets/logo.svg",                       // можна замінити на свій файл, напр. "assets/logo.png"
    timeZone: "Europe/Warsaw",                     // часовий пояс клубу (для статусу «Otwarte / Zamknięte»)
    currency: { pl: "zł", en: "zł", uk: "зл", ru: "зл" },
    currencyCode: "PLN",                           // код валюти для Google (структуровані дані)
    priceRange: "",                                // діапазон цін для Google, напр. "15–40 zł". Порожньо — рахується з цін у zones (якщо вони є)
    privacyUrl: ""                               // посилання на політику конфіденційності (для ЄС бажано, якщо є трекери)
  },

  // Контакти з Google Maps: https://maps.app.goo.gl/o9F7oyFsjJJKZTmV9
  contacts: {
    phone: "+48515588475",                         // для дзвінка, у форматі +48XXXXXXXXX
    phoneLabel: "+48 515 588 475",                 // як номер показувати на сторінці
    address: "Starowiślna 95, 31-052 Kraków",      // офіційна польська адреса — однакова для всіх мов (так її шукають у картах і таксі)
    postal: { street: "Starowiślna 95", postalCode: "31-052", city: "Kraków", country: "PL" },   // для Google (структуровані дані)
    geo: { lat: 50.0506449, lng: 19.9512653 },     // координати клубу з Google Maps
    mapsQuery: "VADE Cyber Club, Starowiślna 95, 31-052 Kraków",                                // що показувати на вбудованій карті
    mapsPlaceId: "ChIJCSNm-EtbFkcRusTNGSbC7KY",    // ID місця в Google Maps: «Маршрут» веде точно до клубу
    mapsUrl: "https://maps.app.goo.gl/o9F7oyFsjJJKZTmV9"                                         // картка клубу в Google Maps
  },

  // Головна кнопка. Онлайн-бронювання клуб поки не має, тому кнопка дзвонить у клуб.
  // ЗАМІНИТИ, коли з'явиться бронювання в SENET: вставте посилання в url (UTM-мітки з біо додадуться до нього самі)
  // і змініть subtitle, напр. { pl: "Online w minutę, bez dzwonienia", en: "Online in a minute, no calls", ... }.
  booking: {
    url: "tel:+48515588475",
    title:    { pl: "Zarezerwuj PC",    en: "Book a PC",        uk: "Забронювати ПК",    ru: "Забронировать ПК" },
    subtitle: { pl: "Zadzwoń: {phone}", en: "Call us: {phone}", uk: "Дзвоніть: {phone}", ru: "Звоните: {phone}" }
  },

  // Смужка «залізо» одним рядком під кнопкою бронювання: геймер за секунду бачить рівень клубу.
  // Порожній список ([]) — смужка не показується.
  highlights: [
    "RTX 5070",
    { pl: "Monitory 280 Hz", en: "280 Hz monitors", uk: "Монітори 280 Гц", ru: "Мониторы 280 Гц" },
    "HyperX · Logitech"
  ],

  // Ігри під смужкою «залізо». ЗАМІНИТИ: залиште лише ті, що справді встановлені на ПК клубу.
  // Порожній список ([]) — ряд ігор не показується.
  games: ["CS2", "Valorant", "Dota 2", "League of Legends", "Fortnite"],

  // Червона кнопка «наживо» над посиланнями. Показується ЛИШЕ коли active: true і є url.
  // Увімкніть на час стріму турніру, після стріму — поверніть false.
  liveStream: {
    active: false,
    url: "",                                       // ЗАМІНИТИ: посилання на Twitch / YouTube / Kick
    text:     { pl: "Transmisja na żywo", en: "Live stream", uk: "Пряма трансляція", ru: "Прямая трансляция" },
    subtitle: { pl: "Oglądaj teraz",      en: "Watch now",   uk: "Дивитися зараз",   ru: "Смотреть сейчас" }
  },

  // Вільні / зайняті ПК: бейдж «🟢 12 wolnych PC» у шапці й секція з усіма ПК по зонах.
  // Дані надсилає агент з кожного комп'ютера (папка agent/ у репозиторії) на functions/api/report.js,
  // а сайт читає їх з /api/status. Поки жоден ПК не звітував (або сайт відкрито не з Cloudflare) — нічого не показується.
  // Назва зони з агента (Zone у agent.config.psd1) перекладається, якщо збігається з назвою зони в zones нижче.
  availability: {
    enabled: true,
    endpoint: "/api/status",
    refreshSeconds: 30,                            // як часто оновлювати, поки сторінка відкрита
    showGrid: true                                 // false — лише бейдж у шапці, без секції з усіма ПК
  },

  // Іконки соцмереж під логотипом.
  // Доступні: instagram, tiktok, telegram, discord, youtube, facebook, whatsapp, viber, x
  socials: [
    { network: "instagram", url: "https://www.instagram.com/vade_krakow/" },
    { network: "telegram",  url: "https://t.me/vade_cyberclub" },      // група «VADE Community» з картки Google Maps
    { network: "tiktok",    url: "https://t.me/vade_cyberclub" },      // ЗАМІНИТИ, коли з'явиться
    { network: "discord",   url: "https://t.me/vade_cyberclub" },      // ЗАМІНИТИ, коли з'явиться
    { network: "youtube",   url: "https://t.me/vade_cyberclub" }    // ЗАМІНИТИ, коли з'явиться
  ],

  // Кнопки-посилання.
  // icon: будь-яка соцмережа зі списку вище або phone, utensils, trophy, handshake, map-pin, gamepad-2, monitor, link
  // type: "link" (звичайне), "social", "phone" (url і підпис підставляться з contacts)
  // Окремої кнопки дзвінка немає, бо дзвонить головна кнопка. Коли booking.url стане онлайн-бронюванням,
  // додайте її сюди: { id: "phone", type: "phone", icon: "phone", title: { pl: "Zadzwoń", en: "Call us", uk: "Подзвонити", ru: "Позвонить" } }
  links: [
    {
      id: "instagram", type: "social", icon: "instagram",
      url: "https://www.instagram.com/vade_krakow/",
      title:    "Instagram",
      subtitle: { pl: "@vade_krakow · nowości klubu", en: "@vade_krakow · club news", uk: "@vade_krakow · новини клубу", ru: "@vade_krakow · новости клуба" }
    },
    {
      id: "telegram", type: "social", icon: "telegram",
      url: "https://t.me/vade_cyberclub",
      title:    { pl: "Czat na Telegramie", en: "Telegram chat", uk: "Чат у Telegram", ru: "Чат в Telegram" },
      subtitle: { pl: "VADE Community · dołącz do ekipy", en: "VADE Community · join the crew", uk: "VADE Community · долучайся", ru: "VADE Community · присоединяйся" }
    },
    {
      id: "discord", type: "social", icon: "discord",
      url: "https://t.me/vade_cyberclub",                                     // ЗАМІНИТИ, коли з'явиться сервер. Поки порожньо — кнопку приховано
      title:    { pl: "Serwer Discord", en: "Discord server", uk: "Discord-сервер", ru: "Discord-сервер" },
      subtitle: { pl: "Znajdź ekipę do gry", en: "Find teammates and parties", uk: "Знайди тімейтів і пати", ru: "Найди тиммейтов и пати" }
    },
    {
      id: "menu", icon: "utensils",
      url: "https://vade-restaurant.pl/a/bHVK-tJNz/section:kuchnia-menu",                                     // ЗАМІНИТИ, якщо є меню бару
      title:    { pl: "Menu baru", en: "Bar menu", uk: "Меню бару", ru: "Меню бара" },
      subtitle: { pl: "Napoje, przekąski i jedzenie", en: "Drinks, snacks and food", uk: "Напої, снеки та їжа", ru: "Напитки, снеки и еда" }
    },
    {
      id: "tournaments", icon: "trophy",
      url: "https://t.me/vade_cyberclub",                                     // ЗАМІНИТИ, коли буде розклад турнірів
      title:    { pl: "Turnieje", en: "Tournaments", uk: "Турніри", ru: "Турниры" },
      subtitle: { pl: "Harmonogram i zapisy", en: "Schedule and sign-up", uk: "Розклад і реєстрація", ru: "Расписание и регистрация" }
    },
    {
      id: "partners", icon: "handshake",
      url: "https://t.me/vade_cyberclub",                                     // url порожній — кнопку приховано
      title:    { pl: "Współpraca", en: "Partnerships", uk: "Співпраця", ru: "Сотрудничество" },
      subtitle: { pl: "Dla marek i drużyn", en: "For brands and teams", uk: "Для брендів і команд", ru: "Для брендов и команд" }
    }
  ],

  // Галерея. Покладіть фото у форматі WebP в assets/photos/ і вкажіть src, напр. "assets/photos/hall.webp"
  // (рекомендовано 1200×900, до ~150 КБ). Фото вантажаться ліниво — лише коли до них догортають.
  // Поки src порожній — показується фірмова заглушка з іконкою (icon).
  // ЗАМІНИТИ: фото клубу (3 фото вже є на картці Google Maps).
  gallery: [
    { src: "assets/foto/hall.webp", icon: "gamepad-2", caption: { pl: "Sala gier",             en: "Gaming hall",           uk: "Ігрова зала",           ru: "Игровой зал" } },
    { src: "assets/foto/pc.webp", icon: "monitor",   caption: { pl: "Mocne PC",              en: "Powerful PCs",          uk: "Потужні ПК",            ru: "Мощные ПК" } },
    { src: "assets/foto/tournament.mp4", icon: "trophy",    caption: { pl: "E-sport i rywalizacja", en: "Esports & competition", uk: "Кіберспорт і змагання", ru: "Киберспорт и соревнования" } },
    { src: "assets/foto/club.webp", icon: "gamepad-2", caption: { pl: "Klub",   en: "Club",       uk: "Клуб",         ru: "Клуб" } }
  ],

  // Галерея з Google Таблиці (CSV). Колонка A — посилання на фото/відео (Imgur тощо),
  // B — тип («фото» або «відео»: для звичайних посилань imgur.com/abc саме він визначає, відео це чи фото),
  // C — підпис польською, D — українською, E — англійською, F — російською (у порядку кнопок мов).
  // Якщо якоїсь мови немає — показується підпис з колонки C. Рядки без посилання в колонці A пропускаються,
  // тож інструкцію чи нотатки можна писати в G і далі.
  // Коли в таблиці є хоч одне посилання, її фото замінюють список gallery вище; інакше показується gallery.
  // Таблиця має бути відкрита «Усім, хто має посилання». Порожньо ("") — таблиця не використовується.
  galleryCsvUrl: "https://docs.google.com/spreadsheets/d/1JooBw8fcSRMyDTSVRKVBTN-owocGt1lloHOsiaWjEkw/export?format=csv&gid=0",

  // Зони та ціни.
  // ЗАМІНИТИ: реальні ціни та характеристики. Нижче — лише шаблон: клуб ще не публікував цін.
  // Зона без ціни (price: "") на сайті не показується, а поки жодна зона не має ціни — уся секція прихована.
  // Ціна — число, напр. price: 12 або 12.5 (кома чи крапка підставиться за мовою).
  // unit — одиниця часу; якщо не вказати, буде «h / год / час» з ui.zones.unit.
  zones: [
    {
      name: { pl: "Standard", en: "Standard", uk: "Стандарт", ru: "Стандарт" },
      price: 5,
      // На картці — 3 головні пункти. Повний комплект: навушники HyperX Cloud III, миша HyperX Pulsefire Haste 2,
      // клавіатура HyperX Alloy Origins Core PBT (HX Blue).
      specs: [
        "RTX 5070",
        { pl: "Monitor 280 Hz",  en: "280 Hz monitor", uk: "Монітор 280 Гц", ru: "Монитор 280 Гц" },
        { pl: "Peryferia HyperX", en: "HyperX gear",    uk: "Девайси HyperX", ru: "Девайсы HyperX" }
      ]
    },
    {
      name: { pl: "Streamer", en: "Streamer", uk: "Стрімерська", ru: "Стримерская" },
      price: 10,
      featured: true,
      badge: { pl: "Hit", en: "Top pick", uk: "Хіт", ru: "Хит" },
      // Повний комплект: бездротові навушники HyperX Cloud III Wireless, миша Logitech G Pro X Superlight 2,
      // клавіатура Logitech G413 TKL.
      specs: [
        "RTX 5070",
        { pl: "2× monitor 280 Hz", en: "2× 280 Hz monitors", uk: "2× монітори 280 Гц", ru: "2× монитора 280 Гц" },
        { pl: "Bezprzewodowa mysz i słuchawki", en: "Wireless mouse & headset", uk: "Бездротові миша й навушники", ru: "Беспроводные мышь и наушники" }
      ]
    },
    {
      name: { pl: "PS5", en: "PS5", uk: "PS5", ru: "PS5" },
      price: "",
      specs: [
        "PlayStation 5",
        { pl: "Telewizor 65″ 4K", en: "65″ 4K TV",       uk: "Телевізор 65″ 4K", ru: "Телевизор 65″ 4K" },
        { pl: "Do 4 graczy",      en: "Up to 4 players", uk: "До 4 гравців",     ru: "До 4 игроков" }
      ]
    },
    {
      name: { pl: "Bootcamp 5×5", en: "Bootcamp 5×5", uk: "Bootcamp 5×5", ru: "Bootcamp 5×5" },
      price: "",
      specs: [
        { pl: "5 PC obok siebie",    en: "5 PCs side by side",     uk: "5 ПК поруч",           ru: "5 ПК рядом" },
        { pl: "Dla drużyn",          en: "For teams",              uk: "Для команд",           ru: "Для команд" },
        { pl: "Treningi i turnieje", en: "Practice & tournaments", uk: "Тренування і турніри", ru: "Тренировки и турниры" }
      ]
    }
  ],
  zonesNote: {
    pl: "Ceny za 1 godzinę. O pakiety godzinowe zapytaj na miejscu.",
    en: "Prices per hour. Ask at the club about hour packages.",
    uk: "Ціни за 1 годину. Про пакети годин питайте на рецепції.",
    ru: "Цены за 1 час. О пакетах часов спрашивайте на ресепшене."
  },

  // Відгуки Google. Оновлюйте rating і count вручну з картки Google Maps.
  // Рейтинг у шапці («★ 5,0 · 15 opinii») з'являється лише від showRatingFrom відгуків:
  // 5,0 з двох відгуків виглядає непереконливо. Секція «Opinie» з цитатами й кнопкою «Wystaw opinię» видна завжди.
  // writeUrl зручно надрукувати як QR-код на рецепції — так відгуки збираються найшвидше.
  reviews: {
    rating: 5.0,
    count: 2,                                      // станом на 01.10.2026
    showRatingFrom: 15,
    url: "https://search.google.com/local/reviews?placeid=ChIJCSNm-EtbFkcRusTNGSbC7KY",
    writeUrl: "https://search.google.com/local/writereview?placeid=ChIJCSNm-EtbFkcRusTNGSbC7KY",
    // Справжні відгуки з Google. lang — мова оригіналу: нею відгук показується без змін, іншими — з позначкою «переклад».
    quotes: [
      {
        author: "Egor",
        stars: 5,
        lang: "ru",
        text: {
          ru: "админы про лучшие , клуб очень классный всем советую очень дешево, очень хорошая атмосфера. N1 pc club in krakow",
          pl: "Admini to profesjonaliści, najlepsi. Klub jest naprawdę świetny, polecam wszystkim. Bardzo tanio, bardzo dobra atmosfera. Klub PC nr 1 w Krakowie.",
          en: "The admins are pros, the best. The club is really great, I recommend it to everyone. Very cheap, very good atmosphere. No. 1 PC club in Kraków.",
          uk: "Адміни — профі, найкращі. Клуб дуже класний, усім раджу. Дуже дешево, дуже гарна атмосфера. ПК-клуб №1 у Кракові."
        },
        translated: { pl: "Przetłumaczono z rosyjskiego", en: "Translated from Russian", uk: "Перекладено з російської", ru: "" }
      }
    ]
  },

  // Часті питання. Питання з порожньою відповіддю (a: "") на сайті не показується.
  // У відповідях можна писати {phone}, {address} і {priceFrom} (найнижча ціна з zones, напр. «5 zł/h»).
  faq: [
    {
      q: { pl: "Jak zarezerwować komputer?", en: "How do I book a PC?", uk: "Як забронювати комп'ютер?", ru: "Как забронировать компьютер?" },
      a: {
        pl: "Zadzwoń pod numer {phone}, a zarezerwujemy dla Ciebie stanowisko.",
        en: "Call us at {phone} and we'll reserve a station for you.",
        uk: "Зателефонуйте за номером {phone}, і ми забронюємо для вас місце.",
        ru: "Позвоните по номеру {phone}, и мы забронируем для вас место."
      }
    },
    {
      q: { pl: "Ile kosztuje godzina gry?", en: "How much is an hour of gaming?", uk: "Скільки коштує година гри?", ru: "Сколько стоит час игры?" },
      a: {
        pl: "Od {priceFrom}. Ceny wszystkich stref znajdziesz wyżej, w sekcji «Strefy i ceny».",
        en: "From {priceFrom}. Prices for every zone are listed above under «Zones & prices».",
        uk: "Від {priceFrom}. Ціни всіх зон — вище, у розділі «Зони та ціни».",
        ru: "От {priceFrom}. Цены всех зон — выше, в разделе «Зоны и цены»."
      }
    },
    {
      q: { pl: "Jak do was trafić?", en: "How do I find you?", uk: "Як вас знайти?", ru: "Как вас найти?" },
      // ЗАМІНИТИ: допишіть, як знайти вхід (з вулиці, двір, поверх, вивіска) — це найбільше допомагає новим гостям
      a: {
        pl: "Jesteśmy w centrum Krakowa: {address}. Przycisk «Trasa» poprowadzi Cię prosto do klubu.",
        en: "We're in central Kraków: {address}. The «Directions» button will take you straight to the club.",
        uk: "Ми в центрі Кракова: {address}. Кнопка «Маршрут» приведе вас прямо до клубу.",
        ru: "Мы в центре Кракова: {address}. Кнопка «Маршрут» приведёт вас прямо в клуб."
      }
    },
    {
      q: { pl: "Jak mogę zapłacić?", en: "How can I pay?", uk: "Як можна оплатити?", ru: "Как можно оплатить?" },
      a: ""                                        // ЗАМІНИТИ: напр. { pl: "Kartą, BLIK-iem lub gotówką.", en: "By card, BLIK or cash.", uk: "Карткою, BLIK або готівкою.", ru: "Картой, BLIK или наличными." }
    },
    {
      q: { pl: "Od ilu lat można u was grać?", en: "Is there an age limit?", uk: "З якого віку можна грати?", ru: "С какого возраста можно играть?" },
      a: ""                                        // ЗАМІНИТИ: правила клубу щодо віку
    },
    {
      q: { pl: "Czy mogę przynieść własną myszkę, klawiaturę lub słuchawki?", en: "Can I bring my own mouse, keyboard or headset?", uk: "Чи можна прийти зі своєю мишею, клавіатурою чи навушниками?", ru: "Можно ли прийти со своей мышью, клавиатурой или наушниками?" },
      a: ""                                        // ЗАМІНИТИ: правила клубу щодо своїх девайсів
    }
  ],

  // Графік з Google Maps: щодня 12:00–00:00.
  // Формат: "12:00-00:00" (через північ теж можна), "24h" — цілодобово, "closed" — вихідний
  hours: {
    mon: "12:00-00:00",
    tue: "12:00-00:00",
    wed: "12:00-00:00",
    thu: "12:00-00:00",
    fri: "12:00-00:00",
    sat: "12:00-00:00",
    sun: "12:00-00:00"
  },

  /* ---------- Аналітика та трекери ----------
     Вставте ID тільки тих сервісів, якими користуєтесь. Порожній рядок — сервіс не підключається.
     ВАЖЛИВО: використовуйте АБО ga4 напряму, АБО gtm (з тегом GA4 всередині GTM), щоб не рахувати двічі. */
  tracking: {
    ga4: "G-3D5BRPD5SB",  // Google Analytics 4, вигляд: "G-XXXXXXXXXX"
    gtm: "",              // Google Tag Manager, вигляд: "GTM-XXXXXXX"
    metaPixel: "1135138612181491", // Meta Pixel (Facebook/Instagram), вигляд: "123456789012345"
    tiktokPixel: "",      // TikTok Pixel, вигляд: "CXXXXXXXXXXXXXXXXXXX"
    clarity: "",          // Microsoft Clarity (теплові карти й записи сесій), вигляд: "abcdefghij"
    consentRequired: true, // банер cookies. Для ЄС/Польщі обов'язковий, вимикати лише свідомо
    utmPassthrough: true, // UTM-мітки з адреси сторінки (?utm_source=instagram…) додаються до зовнішніх посилань (бронювання тощо)
    debug: false          // true — кожна подія і кожен пропущений переклад друкуються в консолі браузера (F12)
  },

  // Кольори бренду. Фон чорний (#0A0B0D), основний акцент — бірюза, додатковий — маджента.
  theme: {
    accent: "#2EF2C4",     // основний: бірюза / м'ята (кнопки, світіння, обводки, фон-сцена)
    accentDeep: "#0A9E86", // глибока бірюза: градієнт і тінь кнопок
    accent2: "#E040FB",    // маджента: бейджі, особливі позначки, акценти фону-сцени
    scene: true,           // фон «кіберклуб» — ізометричний 3D-інтер'єр (arena.js). false — простий темний фон
    sceneZoom: 1           // кадрування фону: 1 — видно всю залу, 1.3 — ближче (краї обрізаються)
  },

  /* ---------- Тексти інтерфейсу ----------
     Підписи кнопок, статуси, дні тижня, банер cookies тощо.
     {time}, {day}, {n}, {total} підставляє сама сторінка — не видаляйте їх із текстів. */
  ui: {
    language: { pl: "Język", en: "Language", uk: "Мова", ru: "Язык" },
    copied:   { pl: "Skopiowano", en: "Copied", uk: "Скопійовано", ru: "Скопировано" },

    hero: {
      logoAlt:   { pl: "Logo {name}", en: "{name} logo", uk: "Логотип {name}", ru: "Логотип {name}" },
      socials:   { pl: "Media społecznościowe", en: "Social media", uk: "Соцмережі", ru: "Соцсети" },
      priceFrom: { pl: "od {price}", en: "from {price}", uk: "від {price}", ru: "от {price}" },
      priceHint: { pl: "Zobacz ceny", en: "See prices", uk: "Дивитися ціни", ru: "Смотреть цены" }
    },

    // Смужка «залізо» та ігри під кнопкою бронювання
    kit: {
      label: { pl: "Sprzęt",      en: "Gear",  uk: "Залізо", ru: "Железо" },
      games: { pl: "Gry",         en: "Games", uk: "Ігри",   ru: "Игры" }
    },

    // Панель унизу екрана на телефоні
    actionBar: {
      label: { pl: "Szybkie akcje", en: "Quick actions", uk: "Швидкі дії", ru: "Быстрые действия" }
    },

    reviews: {
      title:       { pl: "Opinie", en: "Reviews", uk: "Відгуки", ru: "Отзывы" },
      count: {
        pl: { one: "{n} opinia", few: "{n} opinie", many: "{n} opinii", other: "{n} opinii" },
        en: { one: "{n} review", other: "{n} reviews" },
        uk: { one: "{n} відгук", few: "{n} відгуки", many: "{n} відгуків", other: "{n} відгуку" },
        ru: { one: "{n} отзыв", few: "{n} отзыва", many: "{n} отзывов", other: "{n} отзыва" }
      },
      ratingLabel: { pl: "Ocena w Google: {rating} na 5", en: "Google rating: {rating} out of 5", uk: "Рейтинг у Google: {rating} з 5", ru: "Рейтинг в Google: {rating} из 5" },
      starsLabel:  { pl: "{n} na 5 gwiazdek", en: "{n} out of 5 stars", uk: "{n} з 5 зірок", ru: "{n} из 5 звёзд" },
      write:       { pl: "Wystaw opinię w Google", en: "Leave a Google review", uk: "Залишити відгук у Google", ru: "Оставить отзыв в Google" },
      writeHint:   { pl: "Twoja opinia po wizycie bardzo nam pomoże.", en: "A review after your visit helps us a lot.", uk: "Ваш відгук після візиту дуже нам допоможе.", ru: "Ваш отзыв после визита очень нам поможет." },
      all:         { pl: "Wszystkie opinie", en: "All reviews", uk: "Усі відгуки", ru: "Все отзывы" }
    },

    faq: {
      title: { pl: "Częste pytania", en: "FAQ", uk: "Часті питання", ru: "Частые вопросы" }
    },

    status: {
      open:          { pl: "Otwarte",                  en: "Open",                     uk: "Відчинено",                 ru: "Открыто" },
      closed:        { pl: "Zamknięte",                en: "Closed",                   uk: "Зачинено",                  ru: "Закрыто" },
      until:         { pl: "do {time}",                en: "until {time}",             uk: "до {time}",                 ru: "до {time}" },
      opensAt:       { pl: "otwieramy o {time}",       en: "opens at {time}",          uk: "відкриємо о {time}",        ru: "откроемся в {time}" },
      opensTomorrow: { pl: "otwieramy jutro o {time}", en: "opens tomorrow at {time}", uk: "відкриємо завтра о {time}", ru: "откроемся завтра в {time}" },
      opensOn:       { pl: "otwieramy {day} o {time}", en: "opens {day} at {time}",    uk: "відкриємо {day} о {time}",  ru: "откроемся {day} в {time}" },
      always:        { pl: "całą dobę",                en: "24/7",                     uk: "цілодобово",                ru: "круглосуточно" },
      allDay:        { pl: "cały dzień",               en: "all day",                  uk: "весь день",                 ru: "весь день" }
    },

    // Дні тижня, від понеділка
    days: {
      pl: ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"],
      en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      uk: ["Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота", "Неділя"],
      ru: ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"]
    },
    // Для фрази «otwieramy {day} o 12:00»
    daysOn: {
      pl: ["w poniedziałek", "we wtorek", "w środę", "w czwartek", "w piątek", "w sobotę", "w niedzielę"],
      en: ["on Monday", "on Tuesday", "on Wednesday", "on Thursday", "on Friday", "on Saturday", "on Sunday"],
      uk: ["в понеділок", "у вівторок", "в середу", "в четвер", "в п'ятницю", "в суботу", "в неділю"],
      ru: ["в понедельник", "во вторник", "в среду", "в четверг", "в пятницу", "в субботу", "в воскресенье"]
    },

    hours: {
      today:  { pl: "dziś",      en: "today",         uk: "сьогодні",   ru: "сегодня" },
      dayOff: { pl: "Nieczynne", en: "Closed",        uk: "Вихідний",   ru: "Выходной" },
      allDay: { pl: "Całą dobę", en: "Open 24 hours", uk: "Цілодобово", ru: "Круглосуточно" }
    },

    location: {
      title:         { pl: "Godziny i adres",  en: "Hours & location", uk: "Графік і адреса",    ru: "График и адрес" },
      copyAddress:   { pl: "Kopiuj adres",     en: "Copy address",     uk: "Скопіювати адресу",  ru: "Скопировать адрес" },
      addressCopied: { pl: "Adres skopiowany", en: "Address copied",   uk: "Адресу скопійовано", ru: "Адрес скопирован" },
      showMap:       { pl: "Pokaż na mapie",   en: "Show on map",      uk: "Показати на карті",  ru: "Показать на карте" },
      mapTitle:      { pl: "Mapa: {address}",  en: "Map: {address}",   uk: "Карта: {address}",   ru: "Карта: {address}" },
      route:         { pl: "Trasa",            en: "Directions",       uk: "Маршрут",            ru: "Маршрут" },
      call:          { pl: "Zadzwoń",          en: "Call",             uk: "Подзвонити",         ru: "Позвонить" }
    },

    gallery: {
      title:    { pl: "Galeria",            en: "Gallery",        uk: "Галерея",        ru: "Галерея" },
      label:    { pl: "Zdjęcia klubu",      en: "Club photos",    uk: "Фото клубу",     ru: "Фото клуба" },
      carousel: { pl: "karuzela",           en: "carousel",       uk: "карусель",       ru: "карусель" },
      slide:    { pl: "slajd",              en: "slide",          uk: "слайд",          ru: "слайд" },
      slideOf:  { pl: "{n} z {total}",      en: "{n} of {total}", uk: "{n} з {total}",  ru: "{n} из {total}" },
      prev:     { pl: "Poprzednie zdjęcie", en: "Previous photo", uk: "Попереднє фото", ru: "Предыдущее фото" },
      next:     { pl: "Następne zdjęcie",   en: "Next photo",     uk: "Наступне фото",  ru: "Следующее фото" },
      photo:    { pl: "Zdjęcie {n}",        en: "Photo {n}",      uk: "Фото {n}",       ru: "Фото {n}" }
    },

    live: {
      badge: { pl: "Na żywo", en: "Live", uk: "Наживо", ru: "В эфире" }
    },

    // Вільні ПК. Форми множини: one — 1, few — 2–4, many — 5+ (для польської, української й російської)
    availability: {
      free: {
        pl: { one: "{n} wolny PC",       few: "{n} wolne PC",       many: "{n} wolnych PC",     other: "{n} wolnego PC" },
        en: { one: "{n} PC available",   other: "{n} PCs available" },
        uk: { one: "{n} вільний ПК",     few: "{n} вільні ПК",      many: "{n} вільних ПК",     other: "{n} вільного ПК" },
        ru: { one: "{n} свободный ПК",   few: "{n} свободных ПК",   many: "{n} свободных ПК",   other: "{n} свободного ПК" }
      },
      none:  { pl: "Wszystkie PC zajęte", en: "All PCs are busy", uk: "Усі ПК зайняті", ru: "Все ПК заняты" },
      label: { pl: "Dostępność komputerów teraz", en: "PC availability right now", uk: "Наявність ПК зараз", ru: "Наличие ПК сейчас" },
      title: { pl: "Wolne komputery teraz", en: "Free PCs right now", uk: "Вільні ПК зараз", ru: "Свободные ПК сейчас" },
      state: {
        free:    { pl: "Wolny",    en: "Free",    uk: "Вільний",  ru: "Свободен" },
        busy:    { pl: "Zajęty",   en: "Busy",    uk: "Зайнятий", ru: "Занят" },
        offline: { pl: "Wyłączony", en: "Off",    uk: "Вимкнено", ru: "Выключен" }
      },
      since: {
        free: { pl: "wolny od {time}",  en: "free since {time}", uk: "вільний з {time}",  ru: "свободен с {time}" },
        busy: { pl: "zajęty od {time}", en: "busy since {time}", uk: "зайнятий з {time}", ru: "занят с {time}" }
      },
      updated:   { pl: "Stan na {time}", en: "As of {time}", uk: "Станом на {time}", ru: "По состоянию на {time}" },
      otherZone: { pl: "Pozostałe", en: "Other", uk: "Інші", ru: "Другие" }
    },

    zones: {
      title: { pl: "Strefy i ceny", en: "Zones & prices", uk: "Зони та ціни", ru: "Зоны и цены" },
      unit:  { pl: "h", en: "h", uk: "год", ru: "час" }
    },

    share: {
      open:    { pl: "Udostępnij stronę", en: "Share this page", uk: "Поділитися сторінкою",  ru: "Поделиться страницей" },
      title:   { pl: "Udostępnij",        en: "Share",           uk: "Поділитися",            ru: "Поделиться" },
      close:   { pl: "Zamknij",           en: "Close",           uk: "Закрити",               ru: "Закрыть" },
      more:    { pl: "Więcej…",           en: "More…",           uk: "Ще…",                   ru: "Ещё…" },
      link:    { pl: "Link do strony",    en: "Page link",       uk: "Посилання на сторінку", ru: "Ссылка на страницу" },
      copy:    { pl: "Kopiuj",            en: "Copy",            uk: "Копіювати",             ru: "Копировать" },
      copied:  { pl: "Link skopiowany",   en: "Link copied",     uk: "Посилання скопійовано", ru: "Ссылка скопирована" },
      qrTitle: { pl: "Kod QR",            en: "QR code",         uk: "QR-код",                ru: "QR-код" },
      qrText: {
        pl: "Na stoliki, ulotki i witrynę klubu.",
        en: "For tables, flyers and the club window.",
        uk: "Для столів, флаєрів і вітрини клубу.",
        ru: "Для столов, флаеров и витрины клуба."
      },
      qrAlt:   { pl: "Kod QR tej strony", en: "QR code for this page", uk: "QR-код сторінки", ru: "QR-код страницы" },
      qrSave:  { pl: "Zapisz PNG",        en: "Save PNG",              uk: "Зберегти PNG",    ru: "Сохранить PNG" }
    },

    consent: {
      // Компактний банер: один рядок тексту і дві однаково помітні кнопки (так вимагають правила ЄС щодо згоди)
      short:  { pl: "Używamy plików cookie do analityki i reklamy.", en: "We use cookies for analytics and ads.", uk: "Ми використовуємо cookies для аналітики й реклами.", ru: "Мы используем cookies для аналитики и рекламы." },
      accept: { pl: "Akceptuj", en: "Accept", uk: "Прийняти", ru: "Принять" },
      reject: { pl: "Odrzuć", en: "Reject", uk: "Відхилити", ru: "Отклонить" },
      title: { pl: "Pliki cookie", en: "Cookies", uk: "Cookies на сайті", ru: "Cookies на сайте" },
      text: {
        pl: "Używamy plików cookie, aby wiedzieć, co jest przydatne dla odwiedzających, i pokazywać reklamy klubu osobom, które mogą być nimi zainteresowane. Swój wybór możesz zmienić w każdej chwili na dole strony.",
        en: "We use cookies to understand what is useful to our visitors and to show the club's ads to people who may be interested. You can change your choice at any time at the bottom of the page.",
        uk: "Ми використовуємо cookies, щоб розуміти, що корисно відвідувачам, і показувати рекламу клубу тим, кому вона цікава. Змінити вибір можна будь-коли внизу сторінки.",
        ru: "Мы используем cookies, чтобы понимать, что полезно посетителям, и показывать рекламу клуба тем, кому она интересна. Изменить выбор можно в любой момент внизу страницы."
      },
      necessary:     { pl: "Niezbędne",                     en: "Necessary",                     uk: "Необхідні",                 ru: "Необходимые" },
      necessaryHint: { pl: "Potrzebne do działania strony", en: "Required for the site to work", uk: "Потрібні для роботи сайту", ru: "Нужны для работы сайта" },
      analytics:     { pl: "Analityczne",                   en: "Analytics",                     uk: "Аналітика",                 ru: "Аналитика" },
      marketing:     { pl: "Marketingowe",                  en: "Marketing",                     uk: "Реклама",                   ru: "Реклама" },
      acceptAll:     { pl: "Akceptuj wszystkie",            en: "Accept all",                    uk: "Прийняти все",              ru: "Принять все" },
      necessaryOnly: { pl: "Tylko niezbędne",               en: "Necessary only",                uk: "Лише необхідні",            ru: "Только необходимые" },
      customize:     { pl: "Dostosuj",                      en: "Customize",                     uk: "Налаштувати",               ru: "Настроить" },
      save:          { pl: "Zapisz wybór",                  en: "Save choices",                  uk: "Зберегти вибір",            ru: "Сохранить выбор" },
      settings:      { pl: "Ustawienia cookie",             en: "Cookie settings",               uk: "Налаштування cookies",      ru: "Настройки cookies" }
    },

    footer: {
      privacy: { pl: "Polityka prywatności", en: "Privacy policy", uk: "Політика конфіденційності", ru: "Политика конфиденциальности" }
    }
  }
};
