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
     "uk" — код української мови (ISO 639-1), а на кнопці показується label "UA". */
  languages: {
    default: "pl",
    list: [
      { code: "pl", label: "PL", name: "Polski",     locale: "pl-PL" },
      { code: "en", label: "EN", name: "English",    locale: "en-GB" },
      { code: "uk", label: "UA", name: "Українська", locale: "uk-UA" },
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
    privacyUrl: ""                                 // посилання на політику конфіденційності (для ЄС бажано, якщо є трекери)
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
  // ЗАМІНИТИ, коли з'явиться система бронювання (Senet, Langame, Gizmo тощо): вставте її посилання в url
  // і змініть subtitle, напр. { pl: "Online w minutę, bez dzwonienia", ... }.
  booking: {
    url: "tel:+48515588475",
    title:    { pl: "Zarezerwuj PC",    en: "Book a PC",        uk: "Забронювати ПК",    ru: "Забронировать ПК" },
    subtitle: { pl: "Zadzwoń: {phone}", en: "Call us: {phone}", uk: "Дзвоніть: {phone}", ru: "Звоните: {phone}" }
  },

  // Іконки соцмереж під логотипом.
  // Доступні: instagram, tiktok, telegram, discord, youtube, facebook, whatsapp, viber, x
  socials: [
    { network: "instagram", url: "https://www.instagram.com/vade_krakow/" },
    { network: "telegram",  url: "https://t.me/vade_cyberclub" },      // група «VADE Community» з картки Google Maps
    { network: "tiktok",    url: "" },                                 // ЗАМІНИТИ, коли з'явиться
    { network: "discord",   url: "" },                                 // ЗАМІНИТИ, коли з'явиться
    { network: "youtube",   url: "" }
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
      url: "",                                     // ЗАМІНИТИ, коли з'явиться сервер. Поки порожньо — кнопку приховано
      title:    { pl: "Serwer Discord", en: "Discord server", uk: "Discord-сервер", ru: "Discord-сервер" },
      subtitle: { pl: "Znajdź ekipę do gry", en: "Find teammates and parties", uk: "Знайди тімейтів і пати", ru: "Найди тиммейтов и пати" }
    },
    {
      id: "menu", icon: "utensils",
      url: "",                                     // ЗАМІНИТИ, якщо є меню бару
      title:    { pl: "Menu baru", en: "Bar menu", uk: "Меню бару", ru: "Меню бара" },
      subtitle: { pl: "Napoje, przekąski i jedzenie", en: "Drinks, snacks and food", uk: "Напої, снеки та їжа", ru: "Напитки, снеки и еда" }
    },
    {
      id: "tournaments", icon: "trophy",
      url: "",                                     // ЗАМІНИТИ, коли буде розклад турнірів
      title:    { pl: "Turnieje", en: "Tournaments", uk: "Турніри", ru: "Турниры" },
      subtitle: { pl: "Harmonogram i zapisy", en: "Schedule and sign-up", uk: "Розклад і реєстрація", ru: "Расписание и регистрация" }
    },
    {
      id: "partners", icon: "handshake",
      url: "",                                     // url порожній — кнопку приховано
      title:    { pl: "Współpraca", en: "Partnerships", uk: "Співпраця", ru: "Сотрудничество" },
      subtitle: { pl: "Dla marek i drużyn", en: "For brands and teams", uk: "Для брендів і команд", ru: "Для брендов и команд" }
    }
  ],

  // Галерея. Покладіть фото в assets/photos/ і вкажіть src, напр. "assets/photos/hall.jpg".
  // Поки src порожній — показується фірмова заглушка з іконкою (icon).
  // ЗАМІНИТИ: фото клубу (3 фото вже є на картці Google Maps).
  gallery: [
    { src: "", icon: "gamepad-2", caption: { pl: "Sala gier",             en: "Gaming hall",           uk: "Ігрова зала",           ru: "Игровой зал" } },
    { src: "", icon: "monitor",   caption: { pl: "Mocne PC",              en: "Powerful PCs",          uk: "Потужні ПК",            ru: "Мощные ПК" } },
    { src: "", icon: "trophy",    caption: { pl: "E-sport i rywalizacja", en: "Esports & competition", uk: "Кіберспорт і змагання", ru: "Киберспорт и соревнования" } },
    { src: "", icon: "map-pin",   caption: { pl: "Centrum Krakowa",       en: "Heart of Kraków",       uk: "Центр Кракова",         ru: "Центр Кракова" } }
  ],

  // Зони та ціни.
  // ЗАМІНИТИ: реальні ціни та характеристики. Нижче — лише шаблон: клуб ще не публікував цін.
  // Зона без ціни (price: "") на сайті не показується, а поки жодна зона не має ціни — уся секція прихована.
  // Ціна — число, напр. price: 12 або 12.5 (кома чи крапка підставиться за мовою).
  // unit — одиниця часу; якщо не вказати, буде «h / год / час» з ui.zones.unit.
  zones: [
    {
      name: { pl: "Standard", en: "Standard", uk: "Стандарт", ru: "Стандарт" },
      price: "",
      specs: [
        "RTX 4060",
        { pl: "Monitor 165 Hz", en: "165 Hz monitor", uk: "Монітор 165 Гц", ru: "Монитор 165 Гц" },
        { pl: "Sprzęt HyperX",  en: "HyperX gear",    uk: "Девайси HyperX", ru: "Девайсы HyperX" }
      ]
    },
    {
      name: { pl: "VIP", en: "VIP", uk: "VIP", ru: "VIP" },
      price: "",
      featured: true,
      badge: { pl: "Hit", en: "Top pick", uk: "Хіт", ru: "Хит" },
      specs: [
        "RTX 4070 Super",
        { pl: "Monitor 240 Hz", en: "240 Hz monitor", uk: "Монітор 240 Гц", ru: "Монитор 240 Гц" },
        { pl: "Osobny pokój",   en: "Private room",   uk: "Окрема кімната", ru: "Отдельная комната" }
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
    ga4: "",              // Google Analytics 4, вигляд: "G-XXXXXXXXXX"
    gtm: "",              // Google Tag Manager, вигляд: "GTM-XXXXXXX"
    metaPixel: "",        // Meta Pixel (Facebook/Instagram), вигляд: "123456789012345"
    tiktokPixel: "",      // TikTok Pixel, вигляд: "CXXXXXXXXXXXXXXXXXXX"
    clarity: "",          // Microsoft Clarity (теплові карти й записи сесій), вигляд: "abcdefghij"
    consentRequired: true, // банер cookies. Для ЄС/Польщі обов'язковий, вимикати лише свідомо
    debug: false          // true — кожна подія і кожен пропущений переклад друкуються в консолі браузера (F12)
  },

  // Кольори бренду
  theme: {
    accent: "#8B5CF6",     // основний (кнопка бронювання, акценти)
    accentDeep: "#5B21B6", // темніший відтінок для градієнта кнопки
    accent2: "#22D3EE"     // другий акцент (деталі, іконки)
  },

  /* ---------- Тексти інтерфейсу ----------
     Підписи кнопок, статуси, дні тижня, банер cookies тощо.
     {time}, {day}, {n}, {total} підставляє сама сторінка — не видаляйте їх із текстів. */
  ui: {
    language: { pl: "Język", en: "Language", uk: "Мова", ru: "Язык" },
    copied:   { pl: "Skopiowano", en: "Copied", uk: "Скопійовано", ru: "Скопировано" },

    hero: {
      logoAlt: { pl: "Logo {name}", en: "{name} logo", uk: "Логотип {name}", ru: "Логотип {name}" },
      socials: { pl: "Media społecznościowe", en: "Social media", uk: "Соцмережі", ru: "Соцсети" }
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
