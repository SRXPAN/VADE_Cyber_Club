# VADE — сторінка-візитка кіберклубу

Сторінка «все в одному посиланні» для біо Instagram/TikTok: бронювання, соцмережі, ціни, графік, карта, аналітика.
Працює як звичайні статичні файли: сервер, база даних і збірка не потрібні.

## Файли

| Файл | Що це |
|---|---|
| `config.js` | **Увесь контент і ID трекерів — редагувати тут** |
| `index.html` | Сторінка. Міняти лише теги в `<head>` (назва, опис, домен) |
| `app.js`, `styles.css` | Логіка та стилі, чіпати не потрібно |
| `assets/` | Логотип, іконки сайту, `og-image.png` — картинка для прев'ю посилань (1200×630) |

## Перед запуском

1. **`config.js`** — замінити все з позначкою `ЗАМІНИТИ`: телефон, адресу, посилання на бронювання, соцмережі, меню, турніри, ціни, графік, місто.
2. **`index.html`** — у `<head>` замінити `https://vade.example/` на свій домен (4 місця: `canonical`, `og:url`, `og:image`, `twitter:image`). Ту саму адресу вписати в `site.url` у `config.js`.
3. **Логотип** — замінити `assets/logo.svg` (або покласти свій PNG і вказати шлях у `site.logo`). Якщо логотип інший — оновити також `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png` і `og-image.png`.
4. **Фото** — покласти в `assets/photos/` і вписати шляхи в `gallery`, напр. `src: "assets/photos/hall.jpg"`. Поки фото немає, показуються фірмові заглушки.

Порожнє посилання (`url: ""`) просто ховає кнопку чи іконку, тож «битих» кнопок на сторінці не буде.

## Аналітика

Вписати ID у `tracking` в `config.js`. Сервіс без ID не підключається.

| Сервіс | Де взяти ID | Поле |
|---|---|---|
| Google Analytics 4 | analytics.google.com → Адміністратор → Потоки даних → *Measurement ID* (`G-…`) | `ga4` |
| Google Tag Manager | tagmanager.google.com → ID контейнера (`GTM-…`) | `gtm` |
| Meta Pixel (Instagram/Facebook) | business.facebook.com → Events Manager → *Pixel ID* | `metaPixel` |
| TikTok Pixel | ads.tiktok.com → Інструменти → Події → Веб-події → *Pixel ID* | `tiktokPixel` |
| Microsoft Clarity (теплові карти, записи сесій) | clarity.microsoft.com → Settings → *Project ID* | `clarity` |

Використовуйте **або** `ga4`, **або** `gtm` з тегом GA4 всередині, але не обидва одразу, інакше відвідування порахуються двічі.

### Які події відправляються

| Дія відвідувача | GA4 / GTM | Meta | TikTok |
|---|---|---|---|
| «Забронювати ПК» | `booking_click` | `Schedule` | `ClickButton` |
| Дзвінок | `phone_click` | `Contact` | `Contact` |
| Соцмережі, Telegram, Discord | `social_click` | `social_click` | `ClickButton` |
| Інші кнопки (меню, турніри) | `link_click` | `link_click` | `ClickButton` |
| «Маршрут» / «Показати на карті» | `route_click` / `map_open` | `FindLocation` | `ClickButton` / — |
| Вікно «Поділитися», вибір мережі | `share_open`, `share` | так само | — |
| Галерея, копіювання адреси, QR | `gallery_interact`, `copy_address`, `qr_download` | так само | — |

Параметри подій: `link_id`, `link_text`, `link_url`. У GTM ті самі події приходять з префіксом `vade_` (напр. `vade_booking_click`).

**Порада:** у GA4 позначте `booking_click` і `phone_click` як ключові події (Адміністратор → Події → «Позначити як ключову подію»). Тоді в звітах буде видно, скільки людей перейшли до бронювання.

**Звідки приходять люди:** у біо ставте посилання з міткою, напр.
`https://ваш-домен/?utm_source=instagram&utm_medium=bio`, у TikTok — `utm_source=tiktok`, на флаєрах/QR — `utm_source=qr`. GA4 сам розкладе трафік за джерелами.

**Перевірка:** поставте `debug: true`, відкрийте сайт, натисніть F12 → Console. Кожен клік друкується як `[VADE] подія: …`. Також є GA4 → DebugView і розширення Chrome *Meta Pixel Helper* / *TikTok Pixel Helper*. Після перевірки поверніть `debug: false`.

## Cookies і згода

Банер з'являється автоматично, щойно вписано хоча б один ID.

- До згоди Google працює в режимі Consent Mode v2 (без cookies), а Meta Pixel, TikTok Pixel і Clarity взагалі не завантажуються.
- Вибір запам'ятовується. Змінити його можна кнопкою «Налаштування cookies» внизу сторінки.
- Для ЄС (зокрема Польщі) потрібна ще сторінка політики конфіденційності: посилання вписати в `site.privacyUrl`.

## Публікація (безкоштовно)

- **Netlify Drop** — найпростіше: відкрити app.netlify.com/drop, перетягнути папку `vade`, отримати посилання. Свій домен підключається в налаштуваннях сайту.
- **Cloudflare Pages** або **GitHub Pages** — так само, як статичні файли.

`index.html` можна відкрити й подвійним кліком, щоб подивитись, але трекери й карта коректно працюють лише з адреси `https://`.
