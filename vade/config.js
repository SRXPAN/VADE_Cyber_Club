/* =====================================================================
   VADE — налаштування сторінки
   ---------------------------------------------------------------------
   Увесь контент і ID трекерів змінюються ТУТ. Інші файли чіпати не треба.
   • Усе з позначкою «ЗАМІНИТИ» — тестові дані, підставте свої.
   • Порожній url ("") — кнопка або іконка просто не показується.
   ===================================================================== */

window.VADE_CONFIG = {
  site: {
    name: "VADE",
    tagline: "Кіберклуб · Київ",                 // ЗАМІНИТИ: місто
    description: "Кіберклуб VADE: топові ПК, PS5, турніри та бар. Бронюй місце онлайн.",
    url: "https://vade.example/",                // ЗАМІНИТИ: адреса, на якій буде сайт
    logo: "assets/logo.svg",                     // можна замінити на свій файл, напр. "assets/logo.png"
    timeZone: "Europe/Kyiv",                     // часовий пояс клубу (для статусу «Відчинено/Зачинено»)
    currency: "грн",
    privacyUrl: ""                               // посилання на політику конфіденційності (бажано, якщо є трекери)
  },

  contacts: {
    phone: "+380000000000",                      // ЗАМІНИТИ: номер у форматі +380XXXXXXXXX
    phoneLabel: "+38 (000) 000-00-00",           // ЗАМІНИТИ: як номер показувати на сторінці
    address: "вул. Прикладна, 1, Київ",          // ЗАМІНИТИ
    mapsQuery: ""                                // необов'язково: точна назва з Google Maps або координати "50.4501,30.5234"
  },

  // Головна кнопка. Посилання на систему бронювання (Senet, Langame, Gizmo тощо)
  booking: {
    url: "https://example.com/booking",          // ЗАМІНИТИ
    title: "Забронювати ПК",
    subtitle: "Онлайн за хвилину, без дзвінків"
  },

  // Іконки соцмереж під логотипом.
  // Доступні: instagram, tiktok, telegram, discord, youtube, facebook, whatsapp, viber, x
  socials: [
    { network: "instagram", url: "https://instagram.com/vade.club" },   // ЗАМІНИТИ
    { network: "tiktok",    url: "https://tiktok.com/@vade.club" },     // ЗАМІНИТИ
    { network: "telegram",  url: "https://t.me/vade_club" },            // ЗАМІНИТИ
    { network: "discord",   url: "https://discord.gg/vade" },           // ЗАМІНИТИ
    { network: "youtube",   url: "" }
  ],

  // Кнопки-посилання.
  // icon: будь-яка соцмережа зі списку вище або phone, utensils, trophy, handshake, map-pin, gamepad-2, monitor, link
  // type: "link" (звичайне), "social", "phone" (url і підпис підставляться з contacts), "booking"
  links: [
    { id: "telegram",    title: "Telegram-канал", subtitle: "Новини, акції та розіграші", url: "https://t.me/vade_club", icon: "telegram", type: "social" },   // ЗАМІНИТИ url
    { id: "discord",     title: "Discord-сервер", subtitle: "Знайди тімейтів і пати",     url: "https://discord.gg/vade", icon: "discord", type: "social" },  // ЗАМІНИТИ url
    { id: "phone",       title: "Подзвонити",     icon: "phone", type: "phone" },
    { id: "menu",        title: "Меню бару",      subtitle: "Напої, снеки та їжа",        url: "https://example.com/menu", icon: "utensils" },             // ЗАМІНИТИ url
    { id: "tournaments", title: "Турніри",        subtitle: "Розклад і реєстрація",       url: "https://example.com/tournaments", icon: "trophy" },        // ЗАМІНИТИ url
    { id: "partners",    title: "Співпраця",      subtitle: "Для брендів і команд",       url: "", icon: "handshake" }                                     // url порожній — кнопку приховано
  ],

  // Галерея. Покладіть фото в assets/photos/ і вкажіть src, напр. "assets/photos/hall.jpg".
  // Поки src порожній — показується фірмова заглушка з іконкою (icon).
  gallery: [
    { src: "", caption: "Ігрова зала",  icon: "monitor" },
    { src: "", caption: "VIP-кімната",  icon: "gamepad-2" },
    { src: "", caption: "PS5-зона",     icon: "gamepad-2" },
    { src: "", caption: "Бар",          icon: "utensils" },
    { src: "", caption: "Турніри",      icon: "trophy" }
  ],

  // Зони та ціни. ЗАМІНИТИ: ціни й характеристики — приклад
  zones: [
    { name: "Standard",     price: 60,  unit: "год", specs: ["RTX 4060", "Монітор 165 Гц", "Девайси HyperX"] },
    { name: "VIP",          price: 90,  unit: "год", badge: "Хіт", featured: true, specs: ["RTX 4070 Super", "Монітор 240 Гц", "Окрема кімната"] },
    { name: "PS5",          price: 120, unit: "год", specs: ["PlayStation 5", "TV 65″ 4K", "До 4 гравців"] },
    { name: "Bootcamp 5×5", price: 400, unit: "год", specs: ["5 ПК поруч", "Для команд", "Тренування і турніри"] }
  ],
  zonesNote: "Ціни за 1 годину. Пакети та нічні тарифи уточнюйте на рецепції.",

  // Графік: "10:00-02:00" (через північ теж можна), "24h" — цілодобово, "closed" — вихідний
  hours: {
    mon: "10:00-02:00",
    tue: "10:00-02:00",
    wed: "10:00-02:00",
    thu: "10:00-02:00",
    fri: "10:00-06:00",
    sat: "10:00-06:00",
    sun: "10:00-02:00"
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
    debug: false          // true — кожна подія друкується в консолі браузера (F12), щоб перевірити налаштування
  },

  // Кольори бренду
  theme: {
    accent: "#8B5CF6",     // основний (кнопка бронювання, акценти)
    accentDeep: "#5B21B6", // темніший відтінок для градієнта кнопки
    accent2: "#22D3EE"     // другий акцент (деталі, іконки)
  }
};
