/* VADE — логіка сторінки: рендер з config.js, чотири мови (PL/EN/UA/RU), графік роботи, галерея,
   «Поділитися», банер cookies, аналітика з UTM-мітками, кнопка трансляції, галерея з Google Таблиці і PWA.
   Контент, переклади та ID трекерів змінюються в config.js. */
(() => {
  "use strict";

  const C = window.VADE_CONFIG;
  if (!C) {
    console.error("VADE: не завантажився config.js");
    return;
  }

  const site = C.site || {};
  const contacts = C.contacts || {};
  const T = C.tracking || {};
  const U = C.ui || {};

  /* ================= Утиліти ================= */

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ESC[ch]);
  const icon = (name, cls = "") => `<svg class="ico ${cls}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  const isWeb = (url) => /^https?:\/\//i.test(url);
  const targetAttrs = (url) => (isWeb(url) ? ' target="_blank" rel="noopener"' : "");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const store = {
    get(key) {
      try {
        return JSON.parse(localStorage.getItem(key));
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* приватний режим або заблоковане сховище — просто не запам'ятовуємо */
      }
    },
  };

  /* ================= Мови ================= */

  const LANG_KEY = "vade_lang";
  const LANGS = (C.languages?.list || []).filter((l) => l && l.code);
  if (!LANGS.length) LANGS.push({ code: "pl", label: "PL", name: "Polski", locale: "pl-PL" });
  const CODES = LANGS.map((l) => l.code);
  const DEFAULT_LANG = CODES.includes(C.languages?.default) ? C.languages.default : CODES[0];
  // «UA» — код країни, а не мови. Приймаємо його як синонім «uk», якщо хтось напише ?lang=ua
  const LANG_ALIASES = { ua: "uk" };
  // Пошуковим роботам — основна мова, щоб Google індексував польську версію, а не мову свого браузера
  const IS_BOT = /googlebot|google-inspectiontool|bingbot|yandex|duckduckbot|baiduspider|applebot|petalbot|facebookexternalhit|crawler|spider/i.test(
    navigator.userAgent
  );

  function normLang(tag) {
    if (typeof tag !== "string" || !tag.trim()) return null;
    const base = tag.trim().toLowerCase().split(/[-_]/)[0];
    const code = LANG_ALIASES[base] || base;
    return CODES.includes(code) ? code : null;
  }

  // Порядок: ?lang= у посиланні → вибір відвідувача (localStorage) → мови браузера → основна мова
  function detectLanguage() {
    const fromUrl = normLang(new URLSearchParams(location.search).get("lang"));
    if (fromUrl) return fromUrl;
    const saved = normLang(store.get(LANG_KEY));
    if (saved) return saved;
    if (!IS_BOT) {
      const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
      for (const tag of preferred) {
        const code = normLang(tag);
        if (code) return code;
      }
    }
    return DEFAULT_LANG;
  }

  let lang = detectLanguage();
  const langInfo = () => LANGS.find((l) => l.code === lang) || LANGS[0];

  const warned = new Set();
  const warnOnce = (message) => {
    if (warned.has(message)) return;
    warned.add(message);
    console.warn("[VADE] " + message);
  };

  const isDict = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

  // Значення з config: звичайний рядок (однаковий для всіх мов) або { pl, en, uk, ru }
  function tr(value, code = lang) {
    if (!isDict(value)) return value ?? "";
    if (value[code] != null) return value[code];
    if (T.debug) warnOnce(`немає перекладу «${code}» для ${JSON.stringify(value).slice(0, 80)}`);
    return value[DEFAULT_LANG] ?? Object.values(value).find((v) => v != null) ?? "";
  }

  // {phone}, {address} і {name} працюють у будь-якому тексті; решту змінних передає код
  const VARS = { name: site.name || "", phone: contacts.phoneLabel || contacts.phone || "", address: contacts.address || "" };
  const fill = (text, vars) => String(text ?? "").replace(/\{(\w+)\}/g, (match, key) => String(vars?.[key] ?? VARS[key] ?? match));

  // Текст із config поточною мовою (або мовою code)
  const t = (value, vars, code) => fill(tr(value, code), vars);

  // Текст інтерфейсу з config.ui за шляхом, напр. ui("status.open")
  const lookup = (path) => path.split(".").reduce((node, key) => (node == null ? undefined : node[key]), U);
  function ui(path, vars, code) {
    const value = lookup(path);
    if (value == null) {
      warnOnce(`у config.js немає тексту ui.${path}`);
      return path;
    }
    return fill(tr(value, code), vars);
  }
  const uiList = (path) => {
    const value = tr(lookup(path));
    return Array.isArray(value) ? value : [];
  };

  // Підписи для аналітики — завжди основною мовою, щоб одна кнопка не дробилась у звітах на чотири назви
  const tDef = (value) => t(value, null, DEFAULT_LANG);
  const uiDef = (path) => ui(path, null, DEFAULT_LANG);

  function formatNumber(value) {
    if (typeof value !== "number") return String(value);
    try {
      return new Intl.NumberFormat(langInfo().locale || lang).format(value);
    } catch {
      return String(value);
    }
  }

  // Рейтинг з одним знаком після коми за правилами мови: 5,0 / 5.0
  function formatRating(value) {
    try {
      return new Intl.NumberFormat(langInfo().locale || lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
    } catch {
      return Number(value).toFixed(1);
    }
  }

  // Множина за правилами мови: 1 opinia / 2 opinie / 5 opinii
  function pluralText(path, n, vars) {
    const forms = tr(lookup(path));
    const values = { n: formatNumber(n), ...vars };
    if (!isDict(forms)) return fill(forms, values);
    let category = "other";
    try {
      category = new Intl.PluralRules(langInfo().locale || lang).select(n);
    } catch {
      /* старий браузер — лишається "other" */
    }
    return fill(forms[category] ?? forms.other ?? forms.many ?? Object.values(forms)[0], values);
  }

  /* ================= Дані ================= */

  const phoneHref = contacts.phone ? "tel:" + contacts.phone.replace(/[^\d+]/g, "") : "";
  const mapsQuery = contacts.mapsQuery || contacts.address || "";
  const pageUrl = site.url || location.href.split(/[?#]/)[0];
  // З ID місця Google Maps веде маршрут точно до клубу, а не просто до будинку
  const routeUrl =
    "https://www.google.com/maps/dir/?api=1&destination=" +
    encodeURIComponent(mapsQuery) +
    (contacts.mapsPlaceId ? "&destination_place_id=" + encodeURIComponent(contacts.mapsPlaceId) : "");

  /* ================= UTM-мітки ================= */

  // Мітки з адреси сторінки (?utm_source=instagram&utm_medium=bio) переносимо на зовнішні посилання
  // (онлайн-бронювання тощо), щоб система бронювання бачила, звідки прийшов клієнт.
  // Запам'ятовуємо їх на сесію: після перезавантаження без міток атрибуція не губиться.
  const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id"];
  const UTM_KEY = "vade_utm";

  const utm = (() => {
    if (T.utmPassthrough === false) return {};
    const params = new URLSearchParams(location.search);
    const found = {};
    UTM_KEYS.forEach((key) => {
      const value = params.get(key);
      if (value) found[key] = value.slice(0, 200);
    });
    try {
      if (Object.keys(found).length) sessionStorage.setItem(UTM_KEY, JSON.stringify(found));
      else return JSON.parse(sessionStorage.getItem(UTM_KEY)) || {};
    } catch {
      /* сховище заблоковане — працюємо лише з поточною адресою */
    }
    return found;
  })();
  const hasUtm = Object.keys(utm).length > 0;

  // Мітки, які вже є в посиланні, не перезаписуємо
  function withUtm(url) {
    if (!hasUtm || !isWeb(url)) return url;
    try {
      const target = new URL(url);
      UTM_KEYS.forEach((key) => {
        if (utm[key] && !target.searchParams.has(key)) target.searchParams.set(key, utm[key]);
      });
      return target.href;
    } catch {
      return url;
    }
  }

  // Після кожного рендеру: усі зовнішні http(s)-посилання, крім позначених data-no-utm
  // (кнопки «Поділитися» та Google Maps — там мітки не потрібні)
  function applyUtm(root = document) {
    if (!hasUtm) return;
    $$("a[href]", root).forEach((a) => {
      if (a.closest("[data-no-utm]")) return;
      const href = a.getAttribute("href");
      if (!isWeb(href)) return;
      const next = withUtm(href);
      if (next !== href) a.setAttribute("href", next);
    });
  }

  // Кольори іконок — лише з палітри бренду (бірюза / маджента), без «брендових» кольорів соцмереж:
  // так сторінка виглядає цілісно. Власний колір для кнопки — поле color у config.js → links.
  const MINT = "var(--accent)";
  const MAG = "var(--accent-2)";
  const NETWORKS = {
    instagram: ["Instagram", MAG],
    tiktok: ["TikTok", MINT],
    telegram: ["Telegram", MINT],
    discord: ["Discord", MAG],
    youtube: ["YouTube", MAG],
    facebook: ["Facebook", MINT],
    whatsapp: ["WhatsApp", MINT],
    viber: ["Viber", MAG],
    x: ["X", MINT],
  };
  const ICON_COLORS = {
    phone: MINT,
    utensils: MAG,
    trophy: MINT,
    handshake: MAG,
    "map-pin": MINT,
    "gamepad-2": MINT,
    monitor: MINT,
    link: MAG,
  };
  const colorFor = (item) => item.color || NETWORKS[item.icon]?.[1] || ICON_COLORS[item.icon] || MINT;

  /* ================= Аналітика та згода на cookies ================= */

  const CONSENT_KEY = "vade_consent_v1";
  const hasTrackers = Boolean(T.ga4 || T.gtm || T.metaPixel || T.tiktokPixel || T.clarity);
  const needsConsentUi = hasTrackers && T.consentRequired !== false;
  const ANALYTICS_TOOLS = [T.ga4 && "Google Analytics", T.gtm && "Google Tag Manager", T.clarity && "Microsoft Clarity"].filter(Boolean);
  const MARKETING_TOOLS = [(T.ga4 || T.gtm) && "Google Ads", T.metaPixel && "Meta Pixel", T.tiktokPixel && "TikTok Pixel"].filter(Boolean);

  let consent = T.consentRequired === false ? { analytics: true, marketing: true } : store.get(CONSENT_KEY);
  const loaded = { meta: false, tiktok: false, clarity: false };
  const granted = (kind) => Boolean(consent && consent[kind]);

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = window.gtag || gtag;

  const googleConsent = () => {
    const ads = granted("marketing") ? "granted" : "denied";
    return {
      analytics_storage: granted("analytics") ? "granted" : "denied",
      ad_storage: ads,
      ad_user_data: ads,
      ad_personalization: ads,
    };
  };

  // integrity (SRI) — браузер виконає файл, лише якщо його хеш збігся: підмінений на CDN файл не запуститься
  function loadScript(src, integrity) {
    const script = document.createElement("script");
    script.async = true;
    if (integrity) {
      script.integrity = integrity;
      script.crossOrigin = "anonymous";
    }
    script.src = src;
    document.head.appendChild(script);
    return script;
  }

  function initAnalytics() {
    // Google Consent Mode v2: поки людина не погодилась, Google працює без cookies
    gtag("consent", "default", { ...googleConsent(), wait_for_update: 500 });

    if (T.ga4) {
      loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(T.ga4)}`);
      gtag("js", new Date());
      gtag("config", T.ga4, T.debug ? { debug_mode: true } : {});
    }
    if (T.gtm) {
      window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
      loadScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(T.gtm)}`);
    }
    applyConsent();
  }

  function loadMeta() {
    /* Офіційний код Meta Pixel */
    !(function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = !0;
      n.version = "2.0";
      n.queue = [];
      t = b.createElement(e);
      t.async = !0;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", T.metaPixel);
    window.fbq("track", "PageView");
    loaded.meta = true;
  }

  function loadTikTok() {
    /* Офіційний код TikTok Pixel */
    !(function (w, d, t) {
      w.TiktokAnalyticsObject = t;
      const ttq = (w[t] = w[t] || []);
      ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie", "holdConsent", "revokeConsent", "grantConsent"];
      ttq.setAndDefer = function (obj, method) {
        obj[method] = function () {
          obj.push([method].concat(Array.prototype.slice.call(arguments, 0)));
        };
      };
      for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
      ttq.instance = function (id) {
        const inst = ttq._i[id] || [];
        for (let n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(inst, ttq.methods[n]);
        return inst;
      };
      ttq.load = function (id, opts) {
        const url = "https://analytics.tiktok.com/i18n/pixel/events.js";
        ttq._i = ttq._i || {};
        ttq._i[id] = [];
        ttq._i[id]._u = url;
        ttq._t = ttq._t || {};
        ttq._t[id] = +new Date();
        ttq._o = ttq._o || {};
        ttq._o[id] = opts || {};
        const s = d.createElement("script");
        s.type = "text/javascript";
        s.async = true;
        s.src = url + "?sdkid=" + id + "&lib=" + t;
        const first = d.getElementsByTagName("script")[0];
        first.parentNode.insertBefore(s, first);
      };
      ttq.load(T.tiktokPixel);
      ttq.page();
    })(window, document, "ttq");
    loaded.tiktok = true;
  }

  function loadClarity() {
    /* Офіційний код Microsoft Clarity */
    (function (c, l, a, r, i, t, y) {
      c[a] =
        c[a] ||
        function () {
          (c[a].q = c[a].q || []).push(arguments);
        };
      t = l.createElement(r);
      t.async = 1;
      t.src = "https://www.clarity.ms/tag/" + i;
      y = l.getElementsByTagName(r)[0];
      y.parentNode.insertBefore(t, y);
    })(window, document, "clarity", "script", T.clarity);
    loaded.clarity = true;
  }

  // Вмикає/вимикає трекери відповідно до поточної згоди
  function applyConsent() {
    const analytics = granted("analytics");
    const marketing = granted("marketing");

    if (T.clarity) {
      if (analytics && !loaded.clarity) loadClarity();
      if (loaded.clarity) window.clarity("consent", analytics);
    }
    if (T.metaPixel) {
      if (marketing && !loaded.meta) loadMeta();
      else if (loaded.meta) window.fbq("consent", marketing ? "grant" : "revoke");
    }
    if (T.tiktokPixel) {
      if (marketing && !loaded.tiktok) loadTikTok();
      else if (loaded.tiktok) marketing ? window.ttq.grantConsent() : window.ttq.revokeConsent();
    }
  }

  function saveConsent(choice) {
    consent = { analytics: Boolean(choice.analytics), marketing: Boolean(choice.marketing), ts: Date.now() };
    store.set(CONSENT_KEY, consent);
    gtag("consent", "update", googleConsent());
    applyConsent();
    window.dataLayer.push({ event: "vade_consent_update", consent_analytics: consent.analytics, consent_marketing: consent.marketing });
    $("#consent").hidden = true;
    updateActionBar(); // банер зник — нижня панель дій знову може з'явитись
  }

  // Назви подій для GA4 / GTM і відповідники стандартних подій Meta та TikTok
  const EVENT_NAMES = {
    booking: "booking_click",
    phone: "phone_click",
    social: "social_click",
    link: "link_click",
    route: "route_click",
    map: "map_open",
    share: "share",
    share_open: "share_open",
    copy_address: "copy_address",
    qr_download: "qr_download",
    gallery: "gallery_interact",
    language: "language_switch",
    live: "live_click",
    review: "review_click",
    faq: "faq_open",
  };
  const META_EVENTS = { booking: "Lead", phone: "Contact", route: "FindLocation", map: "FindLocation" };
  const TIKTOK_EVENTS = { booking: "ClickButton", phone: "Contact", social: "ClickButton", link: "ClickButton", route: "ClickButton", live: "ClickButton" };

  function track(type, info = {}) {
    const name = EVENT_NAMES[type] || type;
    const params = { site_language: lang };
    if (info.id) params.link_id = info.id;
    if (info.label) params.link_text = info.label;
    if (info.url) params.link_url = info.url;
    if (type === "share" && info.id) params.method = info.id;

    if (T.debug) console.info("[VADE] подія:", name, params);

    if (T.ga4) gtag("event", name, params);
    // Конверсія в GA4: натискання головної кнопки бронювання — це лід
    if (type === "booking" && T.ga4 && typeof gtag === "function") {
      gtag("event", "generate_lead", { event_category: "booking", event_label: "Booking Button Clicked" });
    }
    if (T.gtm) window.dataLayer.push({ event: "vade_" + name, ...params });
    // Натискання «Забронювати» йде в Meta як стандартна подія Lead (конверсія), див. META_EVENTS
    if (loaded.meta && typeof window.fbq === "function") {
      if (META_EVENTS[type]) window.fbq("track", META_EVENTS[type], { content_name: info.label || name });
      else window.fbq("trackCustom", name, params);
    }
    if (loaded.tiktok && TIKTOK_EVENTS[type]) {
      // content_type у TikTok зарезервований під товари, тому тип кнопки передаємо в description
      window.ttq.track(TIKTOK_EVENTS[type], { content_name: info.label || name, description: name });
    }
    if (loaded.clarity) window.clarity("event", name);
  }

  function onTrackedClick(event) {
    if (event.type === "auxclick" && event.button !== 1) return;
    const el = event.target.closest("[data-track]");
    if (!el) return;
    const href = el.getAttribute("href");
    track(el.dataset.track, { id: el.dataset.id, label: el.dataset.label || el.textContent.trim(), url: href || undefined });
  }

  /* ================= Графік роботи ================= */

  const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const DAYS_EN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]; // для schema.org

  const toMin = (hhmm) => {
    const [h, m] = hhmm.trim().split(":").map(Number);
    return h * 60 + (m || 0);
  };
  const fmt = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

  function parseDay(value) {
    const v = String(value || "").trim().toLowerCase();
    if (!v || v === "closed") return null;
    if (v === "24h") return { open: 0, close: 1440, allDay: true };
    const [from, to] = v.split("-");
    if (!to) return null;
    const open = toMin(from);
    const close = toMin(to);
    return { open, close, allDay: open === 0 && close === 1440 };
  }

  const schedule = DAYS.map((day) => parseDay((C.hours || {})[day]));
  const hasSchedule = schedule.some(Boolean);

  // Поточний день (0 = понеділок) і хвилини — за часом клубу, а не відвідувача
  function clubNow() {
    try {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: site.timeZone || undefined,
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(new Date());
      const get = (type) => parts.find((p) => p.type === type)?.value;
      const day = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday"));
      return { day, min: Number(get("hour")) * 60 + Number(get("minute")) };
    } catch {
      const d = new Date();
      return { day: (d.getDay() + 6) % 7, min: d.getHours() * 60 + d.getMinutes() };
    }
  }

  function getStatus() {
    const { day, min } = clubNow();
    const today = schedule[day];
    const yesterday = schedule[(day + 6) % 7];

    if (schedule.every((d) => d && d.allDay)) return { open: true, text: ui("status.always") };
    // нічна зміна, що почалась учора
    if (yesterday && !yesterday.allDay && yesterday.close <= yesterday.open && min < yesterday.close) {
      return { open: true, text: ui("status.until", { time: fmt(yesterday.close) }) };
    }
    if (today) {
      if (today.allDay) return { open: true, text: ui("status.allDay") };
      const overnight = today.close <= today.open;
      if (min >= today.open && (overnight || min < today.close)) return { open: true, text: ui("status.until", { time: fmt(today.close) }) };
      if (min < today.open) return { open: false, text: ui("status.opensAt", { time: fmt(today.open) }) };
    }
    for (let i = 1; i <= 7; i++) {
      const index = (day + i) % 7;
      const next = schedule[index];
      if (!next) continue;
      const time = fmt(next.open);
      return { open: false, text: i === 1 ? ui("status.opensTomorrow", { time }) : ui("status.opensOn", { day: uiList("daysOn")[index] || DAYS_EN[index], time }) };
    }
    return { open: false, text: "" };
  }

  function renderStatus() {
    if (!hasSchedule) return;
    const status = getStatus();
    $$("[data-status]").forEach((el) => {
      el.hidden = false;
      el.dataset.state = status.open ? "open" : "closed";
      $("[data-status-text]", el).innerHTML = `<b>${esc(ui(status.open ? "status.open" : "status.closed"))}</b>${status.text ? " · " + esc(status.text) : ""}`;
    });
  }

  const dayText = (d) => (!d ? ui("hours.dayOff") : d.allDay ? ui("hours.allDay") : `${fmt(d.open)} – ${fmt(d.close)}`);

  /* ================= Розмітка ================= */

  const section = (id, title, body) => `
    <section class="section rise" id="${id}" aria-labelledby="${id}-title">
      <h2 class="section__title" id="${id}-title">${esc(title)}</h2>
      ${body}
    </section>`;

  function heroHtml() {
    const socials = (C.socials || []).filter((s) => s.url && NETWORKS[s.network]);
    const tagline = t(site.tagline);
    return `
      <div class="rise">
        <div class="hero__logo"><img src="${esc(site.logo || "assets/logo.svg")}" alt="${esc(ui("hero.logoAlt"))}" width="96" height="96" loading="eager" fetchpriority="high" decoding="async"></div>
        <h1 class="hero__name">${esc(site.name)}</h1>
        ${tagline ? `<p class="hero__tagline">${esc(tagline)}</p>` : ""}
        <div class="hero__badges">
          <p class="status" data-status hidden><span class="status__dot"></span><span data-status-text></span></p>
          ${availChipHtml()}
          ${priceChipHtml()}
          ${ratingChipHtml()}
        </div>
        ${heroAddressHtml()}
        ${
          socials.length
            ? `<ul class="socials" aria-label="${esc(ui("hero.socials"))}">${socials
                .map(({ network, url }) => {
                  const [label, color] = NETWORKS[network];
                  return `<li><a class="social" href="${esc(url)}" target="_blank" rel="noopener" aria-label="${label}" title="${label}" style="--brand:${color}" data-track="social" data-id="${network}" data-label="${label}">${icon(network)}</a></li>`;
                })
                .join("")}</ul>`
            : ""
        }
      </div>`;
  }

  // «od 5 zł/h» — найнижча ціна з зон; натиск прокручує до цін
  function priceChipHtml() {
    const price = priceFrom();
    if (!price) return "";
    const text = esc(ui("hero.priceFrom", { price: "%PRICE%" })).replace("%PRICE%", `<b>${esc(price)}</b>`);
    return `<a class="status status--chip" href="#zones" data-track="link" data-id="price_hero" data-label="${esc(uiDef("hero.priceHint"))}" title="${esc(ui("hero.priceHint"))}">${text}</a>`;
  }

  // Рейтинг Google — лише коли відгуків достатньо (reviews.showRatingFrom), інакше 5,0 з двох виглядає непереконливо
  function ratingChipHtml() {
    const r = C.reviews || {};
    if (!r.url || !r.rating || !(Number(r.count) >= Number(r.showRatingFrom ?? 15))) return "";
    const rating = formatRating(r.rating);
    const count = pluralText("reviews.count", Number(r.count));
    return `<a class="status status--chip" href="${esc(r.url)}" target="_blank" rel="noopener" data-no-utm data-track="review" data-id="rating_hero" data-label="Google rating" aria-label="${esc(ui("reviews.ratingLabel", { rating }))}, ${esc(count)}">${icon("star", "star")}<b>${esc(rating)}</b><span aria-hidden="true">·</span>${esc(count)}</a>`;
  }

  // Адреса в шапці: одним натиском — маршрут у Google Maps
  function heroAddressHtml() {
    const street = contacts.postal?.street || contacts.address;
    if (!street) return "";
    return `
      <a class="hero__address" href="${esc(routeUrl)}" target="_blank" rel="noopener" data-no-utm data-track="route" data-id="route_hero" data-label="${esc(uiDef("location.route"))}">
        ${icon("map-pin")}<span class="hero__street">${esc(street)}</span>
        <span class="hero__route">${icon("navigation")}${esc(ui("location.route"))}</span>
      </a>`;
  }

  // Смужка «залізо» та ряд ігор під кнопкою бронювання
  function kitHtml() {
    const specs = (C.highlights || []).map((s) => t(s)).filter(Boolean);
    const games = (C.games || []).map((g) => t(g)).filter(Boolean);
    if (!specs.length && !games.length) return "";
    return `
      <div class="kit rise">
        ${
          specs.length
            ? `<p class="kit__specs">${icon("monitor")}<span><span class="sr-only">${esc(ui("kit.label"))}: </span>${specs.map(esc).join('<span class="kit__sep" aria-hidden="true">·</span>')}</span></p>`
            : ""
        }
        ${games.length ? `<ul class="kit__games" aria-label="${esc(ui("kit.games"))}">${games.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>` : ""}
      </div>`;
  }

  // Червона кнопка трансляції — лише коли liveStream.active === true і вказано посилання
  function liveHtml() {
    const live = C.liveStream || {};
    if (live.active !== true || !live.url) return "";
    const subtitle = t(live.subtitle);
    return `
      <a class="live rise" href="${esc(live.url)}"${targetAttrs(live.url)} data-track="live" data-id="live_stream" data-label="${esc(tDef(live.text))}">
        <span class="live__badge"><span class="live__dot" aria-hidden="true"></span>${esc(ui("live.badge"))}</span>
        <span class="live__text">
          <span class="live__title">${esc(t(live.text))}</span>
          ${subtitle ? `<span class="live__sub">${esc(subtitle)}</span>` : ""}
        </span>
        ${icon("arrow-up-right", "live__arrow")}
      </a>`;
  }

  function ctaHtml() {
    const b = C.booking || {};
    if (!b.url) return "";
    const subtitle = t(b.subtitle);
    return `
      <a class="cta rise" href="${esc(b.url)}"${targetAttrs(b.url)} data-track="booking" data-id="booking" data-label="${esc(tDef(b.title))}">
        <span class="cta__icon">${icon("calendar-check")}</span>
        <span class="cta__text">
          <span class="cta__title">${esc(t(b.title))}</span>
          ${subtitle ? `<span class="cta__sub">${esc(subtitle)}</span>` : ""}
        </span>
        ${icon("arrow-up-right", "cta__arrow")}
      </a>`;
  }

  function fullSiteHtml() {
    const f = C.fullSite || {};
    if (!f.url) return "";
    const subtitle = t(f.subtitle);
    return `
      <a class="cta cta--site rise" href="${esc(f.url)}"${targetAttrs(f.url)} data-track="link" data-id="full_site" data-label="${esc(tDef(f.title))}">
        <span class="cta__icon">${icon("globe")}</span>
        <span class="cta__text">
          <span class="cta__title">${esc(t(f.title))}</span>
          ${subtitle ? `<span class="cta__sub">${esc(subtitle)}</span>` : ""}
        </span>
        ${icon("arrow-up-right", "cta__arrow")}
      </a>`;
  }

  function linksHtml() {
    const links = (C.links || [])
      .map((link) => {
        if (link.type === "phone") {
          return { ...link, url: link.url || phoneHref, subtitle: link.subtitle || contacts.phoneLabel, icon: link.icon || "phone" };
        }
        return link;
      })
      .filter((link) => link.url);
    if (!links.length) return "";

    return `
      <ul class="links rise">${links
        .map((link) => {
          const subtitle = t(link.subtitle);
          return `
        <li>
          <a class="link" href="${esc(link.url)}"${targetAttrs(link.url)} data-track="${esc(link.type || "link")}" data-id="${esc(link.id || tDef(link.title))}" data-label="${esc(tDef(link.title))}">
            <span class="link__icon" style="--c:${colorFor(link)}">${icon(link.icon || "link")}</span>
            <span class="link__body">
              <span class="link__title">${esc(t(link.title))}</span>
              ${subtitle ? `<span class="link__sub">${esc(subtitle)}</span>` : ""}
            </span>
            ${icon("arrow-up-right", "link__arrow")}
          </a>
        </li>`;
        })
        .join("")}
      </ul>`;
  }

  const PH_POSITIONS = ["18%", "80%", "50%", "28%", "70%"];
  const placeholderHtml = (item, i) => `<div class="slide__ph" style="--x:${PH_POSITIONS[i % PH_POSITIONS.length]}">${icon(item.icon || "gamepad-2")}</div>`;

  // Відео — за розширенням у шляху, тож ?параметри в посиланні не заважають (….mp4?raw=1)
  const isVideo = (src) => {
    try {
      return /\.(mp4|mov|webm)$/i.test(new URL(src, location.href).pathname);
    } catch {
      return false;
    }
  };

  // Більше фото — замість крапок лічильник «3 / 12»: ряд з десятків крапок не влазить у ширину телефона
  const MAX_DOTS = 8;

  function galleryHtml() {
    const items = C.gallery || [];
    if (!items.length) return "";
    const total = items.length;
    const slides = items
      .map((item, i) => {
        const caption = t(item.caption);
        return `
        <figure class="slide" role="group" aria-roledescription="${esc(ui("gallery.slide"))}" aria-label="${esc(ui("gallery.slideOf", { n: i + 1, total }))}" data-ph-index="${i}">
          ${
            item.src
              ? (item.isVideo || isVideo(item.src)
                ? `<video src="${esc(item.src)}" autoplay loop muted playsinline width="800" height="600"></video>`
                : `<img src="${esc(item.src)}" alt="${esc(caption || site.name)}" width="800" height="600" loading="lazy" decoding="async">`)
              : placeholderHtml(item, i)
          }
          ${caption ? `<figcaption>${esc(caption)}</figcaption>` : ""}
        </figure>`;
      })
      .join("");
    const nav =
      total > 1
        ? `
        <div class="carousel__nav">
          <button class="icon-btn icon-btn--sm carousel__arrow" type="button" data-dir="-1" aria-label="${esc(ui("gallery.prev"))}">${icon("chevron-left")}</button>
          ${
            total <= MAX_DOTS
              ? `<div class="dots">${items
                  .map((_, i) => `<button class="dot" type="button" aria-label="${esc(ui("gallery.photo", { n: i + 1 }))}" aria-current="${i === slideIndex}"></button>`)
                  .join("")}</div>`
              : `<span class="carousel__count" aria-hidden="true"><b data-count>${Math.min(slideIndex, total - 1) + 1}</b> / ${total}</span>`
          }
          <button class="icon-btn icon-btn--sm carousel__arrow" type="button" data-dir="1" aria-label="${esc(ui("gallery.next"))}">${icon("chevron-right")}</button>
        </div>`
        : "";
    return section(
      "gallery",
      ui("gallery.title"),
      `<div class="carousel" role="region" aria-roledescription="${esc(ui("gallery.carousel"))}" aria-label="${esc(ui("gallery.label"))}">
        <div class="carousel__rail" tabindex="0">${slides}</div>
        ${nav}
      </div>`
    );
  }

  // Зона без ціни не показується; поки цін немає зовсім — секція прихована
  const filled = (price) => price !== "" && price != null;
  // Тарифи зони за днями тижня (rates) — лише рядки з ціною
  const zoneRates = (zone) => (zone && Array.isArray(zone.rates) ? zone.rates.filter((r) => r && filled(r.price)) : []);
  const hasPrice = (zone) => Boolean(zone) && (filled(zone.price) || zoneRates(zone).length > 0);
  // Усі числові ціни зони: одна price або кілька з rates
  const zonePrices = (zone) =>
    [zone.price, ...zoneRates(zone).map((r) => r.price)].filter(filled).map(Number).filter(Number.isFinite);

  function zonesHtml() {
    const zones = (C.zones || []).filter(hasPrice);
    const packages = (C.packages || []).filter((p) => p && filled(p.price));
    if (!zones.length && !packages.length) return "";
    const currency = t(site.currency);
    const cards = zones
      .map((z) => {
        const badge = t(z.badge);
        const specs = (tr(z.specs) || []).map((s) => t(s)).filter(Boolean);
        const unit = t(z.unit) || ui("zones.unit");
        const per = currency ? `${currency}/${unit}` : unit;
        const rates = zoneRates(z);
        const price = rates.length
          ? `<ul class="zone__rates">${rates
              .map((r) => {
                const hours = t(r.hours);
                return `
              <li class="rate">
                <span class="rate__days">${esc(t(r.days))}</span>
                <span class="rate__price">${esc(formatNumber(r.price))} <small>${esc(per)}</small></span>
                ${hours ? `<span class="rate__hours">${esc(hours)}</span>` : ""}
              </li>`;
              })
              .join("")}</ul>`
          : `<p class="zone__price">${esc(formatNumber(z.price))} <small>${esc(per)}</small></p>`;
        return `
        <li class="zone${z.featured ? " zone--featured" : ""}">
          <div class="zone__top">
            <h3 class="zone__name">${esc(t(z.name))}</h3>
            ${badge ? `<span class="zone__badge">${esc(badge)}</span>` : ""}
          </div>
          ${price}
          ${specs.length ? `<ul class="zone__specs">${specs.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
        </li>`;
      })
      .join("");
    // Пакети (напр. нічний): широка картка з ціною за пакет і подарунком у комплекті
    const packs = packages
      .map((p) => {
        const unit = t(p.unit);
        const details = t(p.details);
        const hours = t(p.hours);
        const bonus = t(p.bonus);
        return `
        <li class="pack">
          <div class="pack__body">
            <div class="pack__info">
              <h3 class="pack__name">${icon("moon")}${esc(t(p.name))}</h3>
              ${details ? `<p class="pack__details">${esc(details)}</p>` : ""}
              ${hours ? `<p class="pack__hours">${esc(hours)}</p>` : ""}
            </div>
            <p class="pack__price">${esc(formatNumber(p.price))} <small>${esc([currency, unit].filter(Boolean).join(" / "))}</small></p>
          </div>
          ${bonus ? `<p class="pack__bonus">${esc(bonus)}</p>` : ""}
        </li>`;
      })
      .join("");
    const note = t(C.zonesNote);
    return section(
      "zones",
      ui("zones.title"),
      `${cards ? `<ul class="zones">${cards}</ul>` : ""}${packs ? `<ul class="packs">${packs}</ul>` : ""}${note ? `<p class="section__note">${esc(note)}</p>` : ""}`
    );
  }

  // Найнижча ціна серед зон: «5 zł/h» — для шапки та {priceFrom} у FAQ. Немає цін — порожньо
  function priceFrom() {
    const zones = (C.zones || []).filter((z) => hasPrice(z) && zonePrices(z).length);
    if (!zones.length) return "";
    const lowest = (z) => Math.min(...zonePrices(z));
    const cheapest = zones.reduce((a, b) => (lowest(b) < lowest(a) ? b : a));
    const currency = t(site.currency);
    const unit = t(cheapest.unit) || ui("zones.unit");
    return `${formatNumber(lowest(cheapest))} ${currency ? `${currency}/${unit}` : unit}`;
  }

  // Відгуки: справжні цитати з Google і кнопка «Wystaw opinię» — так відгуки збираються швидше
  function reviewsHtml() {
    const r = C.reviews || {};
    const quotes = (r.quotes || []).map((q) => ({ ...q, body: t(q.text) })).filter((q) => q.body);
    if (!quotes.length && !r.writeUrl) return "";
    const stars = (n) => `<span class="stars" role="img" aria-label="${esc(ui("reviews.starsLabel", { n }))}">${icon("star").repeat(Math.max(0, Math.min(5, Math.round(n))))}</span>`;
    const cards = quotes
      .map((q) => {
        // Є переклад мовою сторінки — показуємо його з позначкою; інакше — оригінал мовою відгуку
        const translated = Boolean(q.lang && q.lang !== lang && isDict(q.text) && q.text[lang]);
        const text = translated ? q.text[lang] : isDict(q.text) && q.lang ? q.text[q.lang] ?? q.body : q.body;
        const note = translated ? t(q.translated) : "";
        return `
        <figure class="review">
          ${q.stars ? stars(q.stars) : ""}
          <blockquote class="review__text"${!translated && q.lang ? ` lang="${esc(q.lang)}"` : ""}>${esc(text)}</blockquote>
          <figcaption class="review__by">${esc(q.author)} · Google${note ? `<span class="review__note">${esc(note)}</span>` : ""}</figcaption>
        </figure>`;
      })
      .join("");
    const actions =
      r.writeUrl || r.url
        ? `
        <div class="reviews__actions">
          ${r.writeUrl ? `<a class="btn btn--primary" href="${esc(r.writeUrl)}" target="_blank" rel="noopener" data-no-utm data-track="review" data-id="review_write" data-label="${esc(uiDef("reviews.write"))}">${icon("star")}${esc(ui("reviews.write"))}</a>` : ""}
          ${r.url ? `<a class="btn btn--text" href="${esc(r.url)}" target="_blank" rel="noopener" data-no-utm data-track="review" data-id="review_all" data-label="${esc(uiDef("reviews.all"))}">${esc(ui("reviews.all"))}</a>` : ""}
        </div>
        ${r.writeUrl ? `<p class="section__note">${esc(ui("reviews.writeHint"))}</p>` : ""}`
        : "";
    return section("reviews", ui("reviews.title"), `${cards ? `<div class="reviews">${cards}</div>` : ""}${actions}`);
  }

  // Часті питання: показуються лише ті, що мають відповідь. {priceFrom} без цін — питання ховається
  const faqOpen = new Set(); // відкриті питання не згортаються при зміні мови
  function faqItems(code) {
    const vars = { priceFrom: priceFrom() || undefined };
    return (C.faq || [])
      .map((item, i) => ({ id: "faq_" + (i + 1), q: t(item.q, vars, code), a: t(item.a, vars, code) }))
      .filter((item) => item.q && item.a && !item.a.includes("{priceFrom}"));
  }

  function faqHtml() {
    const items = faqItems();
    if (!items.length) return "";
    const labels = Object.fromEntries(faqItems(DEFAULT_LANG).map((item) => [item.id, item.q]));
    return section(
      "faq",
      ui("faq.title"),
      `<div class="faq">${items
        .map(
          (item) => `
        <details class="faq__item" data-faq="${item.id}" data-label="${esc(labels[item.id] || item.q)}"${faqOpen.has(item.id) ? " open" : ""}>
          <summary>${esc(item.q)}${icon("chevron-down", "faq__chev")}</summary>
          <p>${esc(item.a)}</p>
        </details>`
        )
        .join("")}</div>`
    );
  }

  function onFaqToggle(event) {
    const item = event.target;
    if (!(item instanceof HTMLDetailsElement) || !item.dataset.faq) return;
    if (item.open) {
      faqOpen.add(item.dataset.faq);
      track("faq", { id: item.dataset.faq, label: item.dataset.label });
    } else {
      faqOpen.delete(item.dataset.faq);
    }
  }

  function locationHtml() {
    if (!hasSchedule && !contacts.address) return "";
    const today = clubNow().day;
    const days = uiList("days");

    const hours = hasSchedule
      ? `
        <div class="status-row" data-status hidden><span class="status__dot"></span><span data-status-text></span></div>
        <ul class="hours">${schedule
          .map(
            (d, i) => `
          <li${i === today ? ' class="is-today"' : ""}>
            <span>${esc(days[i] || DAYS_EN[i])}${i === today ? `<span class="hours__tag">${esc(ui("hours.today"))}</span>` : ""}</span>
            <span class="hours__time">${esc(dayText(d))}</span>
          </li>`
          )
          .join("")}
        </ul>`
      : "";

    const copyLabel = ui("location.copyAddress");
    const place = contacts.address
      ? `
        <div class="address">
          ${icon("map-pin")}
          <span class="address__text">${esc(contacts.address)}</span>
          <button class="icon-btn icon-btn--sm" type="button" data-copy="${esc(contacts.address)}" data-copy-msg="${esc(ui("location.addressCopied"))}" data-track="copy_address" data-id="copy_address" data-label="${esc(uiDef("location.copyAddress"))}" aria-label="${esc(copyLabel)}" title="${esc(copyLabel)}">${icon("copy")}</button>
        </div>
        <div class="map" id="map">${
          mapLoaded
            ? mapFrameHtml()
            : `
          <button class="map__facade" type="button" id="mapLoad">
            <span class="map__pin">${icon("map-pin")}</span>
            <span class="map__label">${esc(ui("location.showMap"))}</span>
          </button>`
        }
        </div>
        <div class="card__actions">
          <a class="btn btn--primary" href="${esc(routeUrl)}" target="_blank" rel="noopener" data-no-utm data-track="route" data-id="route" data-label="${esc(uiDef("location.route"))}">${icon("navigation")}${esc(ui("location.route"))}</a>
          ${phoneHref ? `<a class="btn btn--ghost" href="${esc(phoneHref)}" data-track="phone" data-id="phone_card" data-label="${esc(uiDef("location.call"))}">${icon("phone")}${esc(ui("location.call"))}</a>` : ""}
        </div>`
      : "";

    return section("location", ui("location.title"), `<div class="card">${hours}${place}</div>`);
  }

  function footerHtml() {
    const privacyUrl = t(site.privacyUrl);
    const cookieBtn = needsConsentUi ? `<button class="linklike" type="button" id="cookieSettings">${esc(ui("consent.settings"))}</button>` : "";
    const privacy = privacyUrl ? `<a href="${esc(privacyUrl)}"${targetAttrs(privacyUrl)}>${esc(ui("footer.privacy"))}</a>` : "";
    return `
      <p>© ${new Date().getFullYear()} ${esc(site.fullName || site.name)}</p>
      ${cookieBtn || privacy ? `<p class="footer__links">${cookieBtn}${privacy}</p>` : ""}`;
  }

  /* ================= Вільні ПК (агент на комп'ютерах → /api/status) ================= */

  // Дані приходять з functions/api/status.js. Поки їх немає (функцію не налаштовано, сайт відкрито
  // не з Cloudflare, жоден ПК ще не звітував) — бейдж і секція просто не показуються.
  const AV = C.availability || {};
  let pcData = null;
  let pcView = "map"; // "map" (за замовчуванням) | "list"
  let selectedPcNum = null;
  let tooltipPcNum = null;

  // Точна геометрія клубу на сітці 16×10 (x: 0..15, y: 0..9), крок клітинки 60px.
  // Центр клітинки: cx = gx * 60 + 30, cy = gy * 60 + 46 (відступ 16px зверху для підпису рамки над PC 1).
  const MAP_CELL = 60;
  const mapCx = (gx) => gx * MAP_CELL + 30;
  const mapCy = (gy) => gy * MAP_CELL + 46;

  const CLUB_MAP_SLOTS = [
    // Верхній центр — вертикальний ряд Regular (x = 9, y = 0..4)
    { num: 1, gx: 9, gy: 0, zone: "Standard" },
    { num: 2, gx: 9, gy: 1, zone: "Standard" },
    { num: 3, gx: 9, gy: 2, zone: "Standard" },
    { num: 4, gx: 9, gy: 3, zone: "Standard" },
    { num: 5, gx: 9, gy: 4, zone: "Standard" },
    // Стрім-кімнати Stream на тій самій вертикалі x = 9: 18 (y = 6), 19 (y = 9)
    { num: 18, gx: 9, gy: 6, zone: "Streamer", stream: true },
    { num: 19, gx: 9, gy: 9, zone: "Streamer", stream: true },
    // Лівий нижній зал — верхній ряд 6–9 (y = 7, x = 1..4)
    { num: 6, gx: 1, gy: 7, zone: "Standard" },
    { num: 7, gx: 2, gy: 7, zone: "Standard" },
    { num: 8, gx: 3, gy: 7, zone: "Standard" },
    { num: 9, gx: 4, gy: 7, zone: "Standard" },
    // Центр — слоти 10, 11 прямо під WC (y = 7, x = 6..7)
    { num: 10, gx: 6, gy: 7, zone: "Standard" },
    { num: 11, gx: 7, gy: 7, zone: "Standard" },
    // Лівий нижній зал — нижній ряд 12–17 (y = 9, x = 1..6)
    { num: 12, gx: 1, gy: 9, zone: "Standard" },
    { num: 13, gx: 2, gy: 9, zone: "Standard" },
    { num: 14, gx: 3, gy: 9, zone: "Standard" },
    { num: 15, gx: 4, gy: 9, zone: "Standard" },
    { num: 16, gx: 5, gy: 9, zone: "Standard" },
    { num: 17, gx: 6, gy: 9, zone: "Standard" },
    // Середня права кімната Regular: слоти 21 (11,3), 22 (12,3), 20 (11,4); активні 24 (11,6), 23 (12,6)
    { num: 21, gx: 11, gy: 3, zone: "Standard" },
    { num: 22, gx: 12, gy: 3, zone: "Standard" },
    { num: 20, gx: 11, gy: 4, zone: "Standard" },
    { num: 24, gx: 11, gy: 6, zone: "Standard" },
    { num: 23, gx: 12, gy: 6, zone: "Standard" },
    // Крайній правий вертикальний ряд Regular (x = 14, y = 3..7)
    { num: 25, gx: 14, gy: 3, zone: "Standard" },
    { num: 26, gx: 14, gy: 4, zone: "Standard" },
    { num: 27, gx: 14, gy: 5, zone: "Standard" },
    { num: 28, gx: 14, gy: 6, zone: "Standard" },
    { num: 29, gx: 14, gy: 7, zone: "Standard" },
  ];

  // Акуратні тонкі рамки зон навколо кожної групи столів (у координатах сітки)
  const CLUB_MAP_ZONES = [
    { x0: 9, y0: 0, x1: 9, y1: 4, kind: "regular" },
    { x0: 1, y0: 7, x1: 4, y1: 7, kind: "regular" },
    { x0: 6, y0: 7, x1: 7, y1: 7, kind: "regular" },
    { x0: 1, y0: 9, x1: 6, y1: 9, kind: "regular" },
    { x0: 9, y0: 6, x1: 9, y1: 6, kind: "stream" },
    { x0: 9, y0: 9, x1: 9, y1: 9, kind: "stream" },
    { x0: 11, y0: 3, x1: 12, y1: 4, kind: "regular" },
    { x0: 11, y0: 6, x1: 12, y1: 6, kind: "regular" },
    { x0: 14, y0: 3, x1: 14, y1: 7, kind: "regular" },
  ];

  const normPcState = (state) => {
    const s = String(state || "").toLowerCase();
    if (s === "occupied") return "busy";
    if (s === "free" || s === "busy" || s === "maintenance" || s === "offline") return s;
    return "offline";
  };

  const extractPcNum = (pc) => {
    if (!pc) return null;
    if (Number.isInteger(pc.pos) && pc.pos > 0) return pc.pos;
    const m = String(pc.id || "").match(/(\d+)$/) || String(pc.name || "").match(/(\d+)/);
    return m ? Number(m[1]) : null;
  };

  const pcsOnline = () => (pcData ? pcData.pcs.filter((pc) => normPcState(pc.state) !== "offline") : []);

  function pcMapByNum() {
    const map = new Map();
    if (!pcData) return map;
    pcData.pcs.forEach((pc) => {
      const n = extractPcNum(pc);
      if (n != null && !map.has(n)) map.set(n, { ...pc, num: n, state: normPcState(pc.state) });
    });
    return map;
  }

  function bookingUrlForPc(pc) {
    const base = C.booking?.url || phoneHref;
    if (!base) return "";
    if (!isWeb(base)) return base;
    try {
      const target = new URL(base);
      if (pc?.num && !target.searchParams.has("pc")) target.searchParams.set("pc", String(pc.num));
      if (pc?.zone && !target.searchParams.has("zone")) target.searchParams.set("zone", pc.zone);
      return withUtm(target.href);
    } catch {
      return withUtm(base);
    }
  }

  function availChipHtml() {
    if (!pcData || !pcsOnline().length) return `<a class="status status--chip avail" data-avail hidden></a>`;
    const free = pcData.free;
    const text = free > 0 ? pluralText("availability.free", free) : ui("availability.none");
    const n = esc(formatNumber(free));
    const html = free > 0 ? esc(text).replace(n, `<b>${n}</b>`) : esc(text);
    const href = AV.showGrid === false ? "" : ' href="#pcs"';
    return `<a class="status status--chip avail" data-avail data-state="${free > 0 ? "open" : "closed"}"${href} data-track="link" data-id="pcs_hero" data-label="${esc(uiDef("availability.label"))}" title="${esc(ui("availability.label"))}"><span class="status__dot"></span><span>${html}</span></a>`;
  }

  function clock(sec) {
    try {
      return new Intl.DateTimeFormat(langInfo().locale || lang, { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" }).format(new Date(sec * 1000));
    } catch {
      const d = new Date(sec * 1000);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
  }

  // Назву зони з агента (напр. "Standard") показуємо перекладом із zones у config.js, якщо така зона там є
  function zoneTitle(zone) {
    if (!zone) return "";
    const key = zone.trim().toLowerCase();
    const match = (C.zones || []).find((z) => [tDef(z.name), t(z.name), z.id].some((v) => v && String(v).trim().toLowerCase() === key));
    return match ? t(match.name) : zone;
  }

  function clubMapHtml(byNum) {
    const entranceLabel = ui("availability.map.entrance");
    const adminLabel = ui("availability.map.admin");
    const wcLabel = ui("availability.map.wc");
    const regularLabel = ui("availability.map.regular");
    const streamLabel = ui("availability.map.stream");

    // Тонкі рамки зон із маленьким підписом Regular / Stream прямо на верхній лінії рамки
    const zoneFrames = CLUB_MAP_ZONES.map((z) => {
      const x = mapCx(z.x0) - 29;
      const y = mapCy(z.y0) - 26;
      const w = (z.x1 - z.x0) * MAP_CELL + 58;
      const h = (z.y1 - z.y0) * MAP_CELL + 52;
      const isStream = z.kind === "stream";
      const label = isStream ? streamLabel : regularLabel;
      const tagW = Math.min(w - 10, isStream ? 44 : 48);
      const tagX = x + (w - tagW) / 2;
      return `
        <g class="map-zbox${isStream ? " map-zbox--stream" : ""}" aria-hidden="true">
          <rect class="map-zbox__rect" x="${x}" y="${y}" width="${w}" height="${h}" rx="9"/>
          <rect class="map-zbox__mask" x="${tagX}" y="${y - 6}" width="${tagW}" height="12" rx="3"/>
          <text class="map-zbox__label" x="${x + w / 2}" y="${y + 0.5}" text-anchor="middle" dominant-baseline="central">${esc(label)}</text>
        </g>`;
    }).join("");

    // Іконки комп'ютерів на сітці 16×10
    const stations = CLUB_MAP_SLOTS.map((slot) => {
      const cx = mapCx(slot.gx);
      const cy = mapCy(slot.gy);
      const pc = byNum.get(slot.num);
      if (!pc) {
        return `
          <g class="map-pc-inactive" transform="translate(${cx}, ${cy})" aria-hidden="true">
            <rect class="map-pc-inactive__screen" x="-22" y="-17" width="44" height="26" rx="5"/>
            <text class="map-pc-inactive__num" x="0" y="-4" text-anchor="middle" dominant-baseline="central">${slot.num}</text>
            <rect class="map-pc-inactive__neck" x="-4" y="9" width="8" height="3.5" rx="1"/>
            <rect class="map-pc-inactive__led" x="-13" y="13.5" width="26" height="3.2" rx="1.6"/>
          </g>`;
      }
      const state = pc.state;
      const isSelected = selectedPcNum === slot.num && state === "free";
      const zLabel = zoneTitle(pc.zone || slot.zone);
      const stateText = ui(`availability.state.${state}`);
      const pcLabel = ui("availability.map.pcLabel", { n: slot.num });
      const aria = [pcLabel, zLabel, stateText].filter(Boolean).join(" · ");
      const cls = `map-pc map-pc--${state}${slot.stream ? " map-pc--stream" : ""}${isSelected ? " is-selected" : ""}`;
      return `
        <g class="${cls}" data-pc-num="${slot.num}" transform="translate(${cx}, ${cy})" tabindex="0" role="button" aria-label="${esc(aria)}"${state === "free" ? ` aria-pressed="${isSelected}"` : ""}>
          <rect class="map-pc__hit" x="-27" y="-23" width="54" height="46" rx="7"/>
          <rect class="map-pc__ring" x="-25" y="-20" width="50" height="41" rx="7.5"/>
          <rect class="map-pc__screen" x="-22" y="-17" width="44" height="26" rx="5"/>
          <line class="map-pc__glint" x1="-16" y1="-13" x2="16" y2="-13"/>
          <text class="map-pc__num" x="0" y="-3.5" text-anchor="middle" dominant-baseline="central">${slot.num}</text>
          <rect class="map-pc__neck" x="-4" y="9" width="8" height="3.5" rx="1"/>
          <rect class="map-pc__led" x="-14" y="13.5" width="28" height="3.5" rx="1.75"/>
        </g>`;
    }).join("");

    // Точний внутрішній контур приміщення (без зайвої зовнішньої коробки навколо порожніх полів)
    const floorPath =
      "M 300 8 H 614 V 182 H 914 V 510 H 614 V 626 H 34 V 200 H 300 Z";

    return `
      <div class="club-map" data-club-map>
        <div class="club-map__viewport" data-map-viewport>
          <svg class="club-map__svg" viewBox="22 0 904 636" role="img" aria-label="${esc(ui("availability.map.label"))}">
            <defs>
              <clipPath id="vadeClubInterior">
                <path d="${floorPath}"/>
              </clipPath>
              <pattern id="vadeMapGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(148,163,184,0.045)" stroke-width="1"/>
              </pattern>
              <radialGradient id="vadeMapMintGlow" cx="25%" cy="62%" r="48%">
                <stop offset="0%" stop-color="#2ef2c4" stop-opacity="0.08"/>
                <stop offset="100%" stop-color="#2ef2c4" stop-opacity="0"/>
              </radialGradient>
              <radialGradient id="vadeMapStreamGlow" cx="63%" cy="76%" r="24%">
                <stop offset="0%" stop-color="#e040fb" stop-opacity="0.12"/>
                <stop offset="100%" stop-color="#e040fb" stop-opacity="0"/>
              </radialGradient>
            </defs>

            <!-- Підлога лише всередині реального контуру стін клубу -->
            <g clip-path="url(#vadeClubInterior)">
              <rect x="22" y="0" width="904" height="636" class="map-floor"/>
              <rect x="22" y="0" width="904" height="636" fill="url(#vadeMapGrid)"/>
              <rect x="22" y="0" width="904" height="636" fill="url(#vadeMapMintGlow)"/>
              <rect x="22" y="0" width="904" height="636" fill="url(#vadeMapStreamGlow)"/>
            </g>

            <!-- Акуратні рамки зон навколо груп столів -->
            <g class="map-zones">${zoneFrames}</g>

            <!-- Архітектурні стіни клубу (товсті сегменти з чіткими проходами) -->
            <g class="map-walls">
              <!-- Г-подібний коридор біля входу (1,3) → (5,3) → (5,0) і верх над 1–5 -->
              <path class="map-wall" d="M 34 200 H 62 M 118 200 H 300 V 8 H 614"/>
              <!-- Ліва та нижня зовнішні стіни (під 12–17 і 19) -->
              <path class="map-wall" d="M 34 200 V 626 H 614"/>
              <!-- Центральна стіна за 1–5, прохід у праву кімнату, стіна за 18 і 19 -->
              <path class="map-wall" d="M 614 8 V 318 M 614 368 V 626"/>
              <!-- Праве крило: верхня стіна (21–22, 25), права (25–29), нижня -->
              <path class="map-wall" d="M 614 182 H 914 V 510 H 614"/>
              <!-- Перегородка з проходом між середньою правою кімнатою (20–24) і рядом 25–29 -->
              <path class="map-wall" d="M 810 182 V 312 M 810 374 V 510"/>
              <!-- Перегородка над рядом 6–9 (відокремлює зону адміна) -->
              <path class="map-wall" d="M 34 410 H 308"/>
              <!-- Кімнатка WC (7,5) зі стінами та дверним проходом -->
              <path class="map-wall map-wall--inner" d="M 412 304 H 488 V 328 M 488 368 V 390 H 412 V 304"/>
              <!-- Окремі перегородки стрім-кабінок 18 (9,6) та 19 (9,9) з проходами -->
              <path class="map-wall map-wall--inner" d="M 614 356 H 524 V 376 M 524 424 V 448 H 614"/>
              <path class="map-wall map-wall--inner" d="M 614 536 H 524 V 556 M 524 604 V 626"/>
            </g>

            <!-- Орієнтир: Вхід (1, 3) — компактна неонова стрілка вниз -->
            <g class="map-landmark map-landmark--entrance" transform="translate(${mapCx(1)}, ${mapCy(3)})">
              <line x1="-22" y1="-26" x2="22" y2="-26" class="map-entrance-glow"/>
              <path d="M 0 -17 V 7 M -8 -1 L 0 7 L 8 -1" class="map-entrance-arrow"/>
              <text x="0" y="23" text-anchor="middle" class="map-landmark__label map-landmark__label--accent">${esc(entranceLabel)}</text>
            </g>

            <!-- Орієнтир: Адмін / рецепція + вогнегасник (1.5, 5) — компактні іконки без великої рамки -->
            <g class="map-landmark map-landmark--admin" transform="translate(${mapCx(1.5)}, ${mapCy(5)})">
              <!-- Мінімалістична іконка адміна/рецепції -->
              <g transform="translate(-14, -4)" class="map-landmark__ico">
                <circle cx="0" cy="-9" r="4"/>
                <path d="M -8 2 A 8 7 0 0 1 8 2"/>
                <path d="M -12 4 H 12 M -9 4 V 10 M 9 4 V 10"/>
              </g>
              <text x="-14" y="22" text-anchor="middle" class="map-landmark__label">${esc(adminLabel)}</text>
              <!-- Компактна іконка вогнегасника поруч -->
              <g transform="translate(24, -2)" class="map-extinguisher" aria-hidden="true">
                <rect x="-5" y="-5" width="10" height="16" rx="3"/>
                <path d="M 0 -5 V -9 M -3 -9 H 4 M 2 -7 C 7 -7 8 -3 8 1"/>
              </g>
            </g>

            <!-- Орієнтир: WC (7, 5) — мінімалістична іконка чоловік/жінка без важкої рамки -->
            <g class="map-landmark map-landmark--wc" transform="translate(${mapCx(7)}, ${mapCy(5)})">
              <g transform="translate(0, -6)" class="map-landmark__ico">
                <circle cx="-8" cy="-8" r="2.6"/>
                <path d="M -11.5 5 V -1 A 3.5 3.5 0 0 1 -4.5 -1 V 5"/>
                <line x1="0" y1="-10" x2="0" y2="6" stroke-opacity="0.4"/>
                <circle cx="8" cy="-8" r="2.6"/>
                <path d="M 4.5 5 L 6.3 -2.5 H 9.7 L 11.5 5"/>
              </g>
              <text x="0" y="18" text-anchor="middle" class="map-landmark__label">${esc(wcLabel)}</text>
            </g>

            <!-- Усі 29 місць ПК -->
            <g class="map-pcs">${stations}</g>
          </svg>
        </div>
        <div class="club-map__tooltip" data-map-tooltip hidden role="tooltip"></div>
        <p class="club-map__hint" aria-hidden="true"><span>${esc(ui("availability.map.scrollHint"))}</span> →</p>
      </div>`;
  }

  function bookBarHtml(byNum) {
    if (selectedPcNum == null) return "";
    const pc = byNum.get(selectedPcNum);
    if (!pc || pc.state !== "free") return "";
    const pcLabel = ui("availability.map.pcLabel", { n: pc.num });
    const zLabel = zoneTitle(pc.zone);
    const stateText = ui("availability.state.free");
    const href = bookingUrlForPc(pc);
    const isTel = /^tel:/i.test(href);
    const bookText = ui("availability.map.bookPc", { n: pc.num });
    return `
      <div class="pcs__bookbar">
        <div class="pcs__bookinfo">
          <span class="pcs__bookdot" aria-hidden="true"></span>
          <span class="pcs__bookmeta">
            <b>${esc(pcLabel)}</b>
            <small>${esc([zLabel, stateText].filter(Boolean).join(" · "))}</small>
          </span>
        </div>
        <div class="pcs__bookactions">
          ${
            href
              ? `<a class="btn btn--primary btn--sm" href="${esc(href)}"${targetAttrs(href)} data-track="booking" data-id="booking_pc_${pc.num}" data-label="${esc(ui("availability.map.bookPc", { n: pc.num }, DEFAULT_LANG))}">${icon(isTel ? "phone" : "calendar-check")}${esc(bookText)}</a>`
              : ""
          }
          <button class="icon-btn icon-btn--sm" type="button" data-pc-clear aria-label="${esc(ui("share.close"))}">${icon("close")}</button>
        </div>
      </div>`;
  }

  function pcsHtml() {
    if (AV.showGrid === false || !pcData || !pcsOnline().length) return "";
    const byNum = pcMapByNum();
    // Якщо обраний ПК уже не вільний — знімаємо виділення
    if (selectedPcNum != null && byNum.get(selectedPcNum)?.state !== "free") selectedPcNum = null;

    const groups = [];
    pcData.pcs.forEach((raw) => {
      const pc = { ...raw, num: extractPcNum(raw), state: normPcState(raw.state) };
      const key = pc.zone || "";
      let group = groups.find((g) => g.key === key);
      if (!group) groups.push((group = { key, pcs: [] }));
      group.pcs.push(pc);
    });

    const zonesBar = groups.length
      ? `<div class="pcs__zones-bar">${groups
          .map((g) => {
            const free = g.pcs.filter((pc) => pc.state === "free").length;
            const total = g.pcs.length;
            const isStream = /stream/i.test(g.key);
            return `<span class="pcs__zpill${isStream ? " pcs__zpill--stream" : ""}${free > 0 ? " is-avail" : ""}"><b>${esc(zoneTitle(g.key) || ui("availability.otherZone"))}:</b> <span>${esc(free)}/${esc(total)}</span></span>`;
          })
          .join("")}</div>`
      : "";

    const listBody = () => {
      const tile = (pc) => {
        const stateText = ui(`availability.state.${pc.state}`);
        const sinceText = pc.state !== "offline" && pc.since ? ui(`availability.since.${pc.state}`, { time: clock(pc.since) }) : "";
        const isFree = pc.state === "free" && pc.num != null;
        const isSelected = isFree && selectedPcNum === pc.num;
        return `<li class="pc pc--${esc(pc.state)}${isFree ? " is-selectable" : ""}${isSelected ? " is-selected" : ""}"${isFree ? ` data-pc-num="${pc.num}" tabindex="0" role="button" aria-pressed="${isSelected}"` : ""} title="${esc([pc.name, stateText, sinceText].filter(Boolean).join(" · "))}">
            <span class="pc__name">${esc(pc.name)}</span>
            <span class="pc__state">${esc(stateText)}</span>
          </li>`;
      };
      return groups
        .map((g) => {
          const free = g.pcs.filter((pc) => pc.state === "free").length;
          const total = g.pcs.length;
          const head =
            groups.length > 1 || g.key
              ? `<h3 class="pcs__zone">${esc(zoneTitle(g.key) || ui("availability.otherZone"))}<span>${esc(free)}/${esc(total)}</span></h3>`
              : "";
          return `<div class="pcs__group">${head}<ul class="pcs">${g.pcs.map(tile).join("")}</ul></div>`;
        })
        .join("");
    };

    const body = pcView === "list" ? listBody() : clubMapHtml(byNum);
    const bookBar = `<div data-bookbar-slot>${bookBarHtml(byNum)}</div>`;

    // «Обслуговування» (лише від Vade Launcher) у легенді — тільки коли такий ПК зараз є
    const legend = ["free", "busy", "maintenance", "offline"]
      .filter((s) => s !== "maintenance" || pcData.pcs.some((pc) => normPcState(pc.state) === s))
      .map((s) => `<span class="pcs__key pc--${s}"><i aria-hidden="true"></i>${esc(ui(`availability.state.${s}`))}</span>`)
      .join("");
    const note = `<p class="section__note pcs__note"><span class="pcs__legend">${legend}</span><span>${esc(ui("availability.updated", { time: clock(pcData.updated) }))}</span></p>`;

    return `
      <section class="section rise" id="pcs" aria-labelledby="pcs-title">
        <div class="pcs__head">
          <h2 class="section__title" id="pcs-title">${esc(ui("availability.title"))}</h2>
          <div class="pcs__toggle" role="group" aria-label="${esc(ui("availability.view.label"))}">
            <button class="pcs__toggle-btn" type="button" data-pc-view="map" aria-pressed="${pcView === "map"}">${icon("map")}<span>${esc(ui("availability.view.map"))}</span></button>
            <button class="pcs__toggle-btn" type="button" data-pc-view="list" aria-pressed="${pcView === "list"}">${icon("layout-grid")}<span>${esc(ui("availability.view.list"))}</span></button>
          </div>
        </div>
        ${zonesBar}
        ${body}
        ${bookBar}
        ${note}
      </section>`;
  }

  const pcsSlotHtml = () => `<div id="pcsSlot">${pcsHtml()}</div>`;

  // Оновлюємо лише бейдж і секцію — решта сторінки (галерея, відкриті FAQ) не перемальовується
  function renderAvailability() {
    const chip = $("[data-avail]");
    if (chip) chip.outerHTML = availChipHtml();
    const slot = $("#pcsSlot");
    if (slot) {
      const prevScroll = $("[data-map-viewport]", slot)?.scrollLeft || 0;
      const html = pcsHtml();
      // Секція з'являється з анімацією лише першого разу, далі тихо оновлюється
      if (slot.innerHTML && html) slot.classList.add("no-anim");
      slot.innerHTML = html;
      const viewport = $("[data-map-viewport]", slot);
      if (viewport && prevScroll) viewport.scrollLeft = prevScroll;
      applyUtm(slot);
    }
  }

  function showMapTooltip(el) {
    const mapRoot = el?.closest("[data-club-map]");
    if (!mapRoot || !pcData) return;
    const tip = $("[data-map-tooltip]", mapRoot);
    if (!tip) return;
    const num = Number(el.dataset.pcNum);
    const pc = pcMapByNum().get(num);
    if (!pc) return;
    tooltipPcNum = num;

    const state = pc.state;
    const pcLabel = ui("availability.map.pcLabel", { n: num });
    const zLabel = zoneTitle(pc.zone);
    const stateText = ui(`availability.state.${state}`);
    const sinceText = state !== "offline" && pc.since ? ui(`availability.since.${state}`, { time: clock(pc.since) }) : "";

    tip.className = `club-map__tooltip club-map__tooltip--${state}`;
    tip.innerHTML = `
      <div class="club-map__tip-top">
        <b>${esc(pcLabel)}</b>
        <span class="club-map__tip-badge">${esc(stateText)}</span>
      </div>
      <div class="club-map__tip-meta">${esc([zLabel, sinceText].filter(Boolean).join(" · "))}</div>`;
    tip.hidden = false;

    const mapRect = mapRoot.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const pad = 8;
    const centerX = elRect.left - mapRect.left + elRect.width / 2;
    const left = Math.max(pad, Math.min(mapRect.width - tipRect.width - pad, centerX - tipRect.width / 2));
    let top = elRect.top - mapRect.top - tipRect.height - 8;
    let placedBelow = false;
    if (top < 6) {
      top = elRect.bottom - mapRect.top + 8;
      placedBelow = true;
    }
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
    tip.classList.toggle("is-below", placedBelow);
  }

  function hideMapTooltip() {
    tooltipPcNum = null;
    const tip = $("[data-map-tooltip]");
    if (tip) tip.hidden = true;
  }

  function syncSelectedPcUi() {
    const slot = $("#pcsSlot");
    if (!slot) return;
    const byNum = pcMapByNum();
    $$("[data-pc-num]", slot).forEach((el) => {
      const n = Number(el.dataset.pcNum);
      const active = selectedPcNum === n && byNum.get(n)?.state === "free";
      el.classList.toggle("is-selected", active);
      if (el.hasAttribute("aria-pressed")) el.setAttribute("aria-pressed", String(active));
    });
    const bookSlot = $("[data-bookbar-slot]", slot);
    if (bookSlot) {
      bookSlot.innerHTML = bookBarHtml(byNum);
      applyUtm(bookSlot);
    }
  }

  function handlePcActivate(el) {
    const num = Number(el.dataset.pcNum);
    const pc = pcMapByNum().get(num);
    if (!pc) return;
    if (el.closest("[data-club-map]")) showMapTooltip(el);
    if (pc.state === "free") {
      selectedPcNum = selectedPcNum === num ? null : num;
      syncSelectedPcUi();
    } else if (selectedPcNum != null) {
      selectedPcNum = null;
      syncSelectedPcUi();
    }
  }

  async function fetchAvailability() {
    if (!AV.enabled || !AV.endpoint || document.hidden) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(AV.endpoint, { cache: "no-store", signal: controller.signal, headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data || !Array.isArray(data.pcs)) throw new Error("bad data");
      pcData = data;
    } catch (err) {
      if (C.debug) console.warn("[VADE] /api/status:", err);
      // Поки немає зв'язку, показуємо останні дані не довше 5 хвилин, потім ховаємо
      if (pcData && Date.now() / 1000 - pcData.updated > 300) pcData = null;
    } finally {
      clearTimeout(timer);
    }
    renderAvailability();
  }

  function initAvailability() {
    if (!AV.enabled || !AV.endpoint) return;
    fetchAvailability();
    const every = Math.max(15, Number(AV.refreshSeconds) || 60) * 1000;
    setInterval(fetchAvailability, every);
    // Повернулись на вкладку — одразу свіжі дані, а не через хвилину
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) fetchAvailability();
    });
  }

  function render() {
    $("#hero").innerHTML = heroHtml();
    $("#main").innerHTML =
      liveHtml() + ctaHtml() + kitHtml() + pcsSlotHtml() + linksHtml() + fullSiteHtml() + galleryHtml() + zonesHtml() + reviewsHtml() + locationHtml() + faqHtml();
    $("#footer").innerHTML = footerHtml();
    $$(".rise").forEach((el, i) => el.style.setProperty("--i", i));
    applyUtm();

    // Якщо логотип не завантажився — підставляємо стандартний, щоб не було «битої» картинки
    $(".hero__logo img").addEventListener(
      "error",
      (e) => {
        e.currentTarget.src = "assets/logo.svg";
      },
      { once: true }
    );
  }

  /* ================= Галерея ================= */

  // Стан галереї переживає перемальовування: зміна мови не скидає поточне фото й автопрокрутку
  let slideIndex = 0;
  let autoplayOff = reduceMotion;
  let galleryReported = false;
  let autoplayTimer = 0;
  let galleryObserver = null;

  let carouselAbort = new AbortController(); // знімає слухачі window від попередньої каруселі

  function initCarousel() {
    clearInterval(autoplayTimer);
    galleryObserver?.disconnect();
    galleryObserver = null;
    carouselAbort.abort();
    carouselAbort = new AbortController();

    const root = $(".carousel");
    if (!root) return;
    const rail = $(".carousel__rail", root);
    const slides = Array.from(rail.children);
    const dots = $$(".dot", root);
    const counter = $("[data-count]", root);
    if (slideIndex >= slides.length) slideIndex = 0;
    let paused = false;
    let visible = true;

    // Фото, яке не завантажилось, замінюємо фірмовою заглушкою
    rail.addEventListener(
      "error",
      (e) => {
        if (e.target.tagName !== "IMG") return;
        const fig = e.target.closest(".slide");
        const i = Number(fig.dataset.phIndex);
        e.target.outerHTML = placeholderHtml((C.gallery || [])[i] || {}, i);
        fitHeight();
      },
      true
    );

    const go = (i, smooth = true) => {
      slideIndex = (i + slides.length) % slides.length;
      const slide = slides[slideIndex];
      rail.scrollTo({ left: slide.offsetLeft - (rail.clientWidth - slide.offsetWidth) / 2, behavior: smooth && !reduceMotion ? "smooth" : "auto" });
    };

    const sync = () => {
      const center = rail.scrollLeft + rail.clientWidth / 2;
      let best = 0;
      let bestDist = Infinity;
      slides.forEach((slide, i) => {
        const dist = Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - center);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      });
      slideIndex = best;
      dots.forEach((dot, i) => dot.setAttribute("aria-current", String(i === best)));
      if (counter) counter.textContent = String(best + 1);
      fitHeight();
    };

    // Аналог autoHeight: стрічка завжди висотою з активний слайд (горизонтальне фото — нижча, вертикальне відео — вища)
    const fitHeight = () => {
      const slide = slides[slideIndex];
      if (slide) rail.style.height = slide.offsetHeight + "px";
    };
    // Розміри фото/відео відомі лише після завантаження — тоді й перераховуємо
    rail.addEventListener("load", fitHeight, true);
    rail.addEventListener("loadedmetadata", fitHeight, true);
    window.addEventListener("resize", fitHeight, { passive: true, signal: carouselAbort.signal });

    // Після першої дії користувача автопрокрутку вимикаємо, щоб не «смикати» фото з-під пальця
    const onUser = () => {
      autoplayOff = true;
      if (!galleryReported) {
        galleryReported = true;
        track("gallery", { id: "gallery", label: uiDef("gallery.title") });
      }
    };

    let frame = 0;
    rail.addEventListener(
      "scroll",
      () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(sync);
      },
      { passive: true }
    );
    rail.addEventListener("pointerdown", onUser, { passive: true });
    rail.addEventListener("wheel", (e) => Math.abs(e.deltaX) > Math.abs(e.deltaY) && onUser(), { passive: true });
    rail.addEventListener("keydown", (e) => e.key.startsWith("Arrow") && onUser());

    root.addEventListener("click", (e) => {
      const dot = e.target.closest(".dot");
      const arrow = e.target.closest("[data-dir]");
      if (dot) go(dots.indexOf(dot));
      else if (arrow) go(slideIndex + Number(arrow.dataset.dir));
      else return;
      onUser();
    });

    root.addEventListener("mouseenter", () => (paused = true));
    root.addEventListener("mouseleave", () => (paused = false));
    root.addEventListener("focusin", () => (paused = true));
    root.addEventListener("focusout", () => (paused = false));
    if ("IntersectionObserver" in window) {
      galleryObserver = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting), { threshold: 0.4 });
      galleryObserver.observe(root);
    }

    if (slideIndex) go(slideIndex, false);
    fitHeight();

    if (slides.length > 1 && !autoplayOff) {
      autoplayTimer = setInterval(() => {
        if (!autoplayOff && !paused && visible && !document.hidden) go(slideIndex + 1);
      }, 4500);
    }
  }

  /* ================= Галерея з Google Таблиці ================= */

  // Таблиця: колонка A — посилання на фото/відео, B — тип («фото» / «відео»), C — підпис (необов'язково).
  // Перший рядок — заголовки.
  // Рядки без посилання http(s) (порожні, інструкція збоку тощо) пропускаються.
  // Якщо таблиця недоступна або в ній ще немає посилань — лишається галерея з config.js.

  // CSV з лапками: коми й переноси рядків усередині "…" — частина клітинки, "" — це одна лапка
  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') {
          cell += '"';
          i++;
        } else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ",") {
        row.push(cell);
        cell = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else cell += ch;
    }
    row.push(cell);
    rows.push(row);
    return rows;
  }

  // Білий список джерел: з таблиці приймаються ЛИШЕ файли Imgur і файли з цього ж сайту (assets/…).
  // Посилання на будь-який інший сайт ігнорується — навіть якщо хтось чужий отримає доступ до таблиці,
  // підставити в галерею картинку з довільного сайту не вийде.
  // Посилання Imgur на сторінку (imgur.com/abc) → пряме на файл: i.imgur.com/abc.mp4 для відео, abc.jpeg для фото; .gifv → .mp4
  const IMGUR_HOSTS = ["imgur.com", "www.imgur.com", "m.imgur.com", "i.imgur.com"];
  const IMGUR_FILE = /^[A-Za-z0-9]{5,10}(\.(jpe?g|png|gif|gifv|webp|mp4))?$/i; // ID Imgur — лише латиниця й цифри

  // Файли з цього ж сайту — лише фото чи відео за розширенням
  const MEDIA_FILE = /\.(jpe?g|png|gif|webp|avif|mp4|webm|mov)$/i;

  function normalizeMediaUrl(raw, isVideoType) {
    // Порожня клітинка без цієї перевірки перетворювалась на адресу самого сайту і ставала порожнім слайдом
    if (typeof raw !== "string" || !raw.trim()) return "";
    let url;
    try {
      url = new URL(raw.trim(), location.href); // відносний шлях (assets/foto/…) — від адреси сайту
    } catch {
      return "";
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    if (url.origin === location.origin) return MEDIA_FILE.test(url.pathname) ? url.href : "";
    if (!IMGUR_HOSTS.includes(url.hostname.toLowerCase())) return "";

    const [id, ...rest] = url.pathname.split("/").filter(Boolean);
    if (!id || rest.length || !IMGUR_FILE.test(id)) return ""; // альбоми (/a/…), галереї та інше не підтримуються
    if (/\.gifv$/i.test(id)) return `https://i.imgur.com/${id.replace(/\.gifv$/i, ".mp4")}`;
    return `https://i.imgur.com/${/\.\w+$/.test(id) ? id : id + (isVideoType ? ".mp4" : ".jpeg")}`;
  }

  async function fetchGalleryData() {
    if (!C.galleryCsvUrl) return false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(C.galleryCsvUrl, { cache: "no-store", signal: controller.signal });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const items = parseCsv(await res.text())
        .slice(1)
        .map(([url = "", mediaType = "", ...captions]) => {
          const isVideoType = /відео|video/i.test(mediaType);
          const item = { src: normalizeMediaUrl(url, isVideoType), isVideo: isVideoType };
          // Підписи: C, D, E, F — мовами в порядку кнопок (PL, UA, EN, RU); бракує мови — береться основна
          const caption = {};
          LANGS.forEach((l, i) => {
            const text = (captions[i] || "").trim();
            if (text) caption[l.code] = text;
          });
          if (Object.keys(caption).length) item.caption = caption;
          return item;
        })
        .filter((item) => item.src);
      if (!items.length) return false;
      C.gallery = items;
      return true;
    } catch (error) {
      if (T.debug) warnOnce("не вдалося завантажити галерею з таблиці: " + error);
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  /* ================= Карта ================= */

  // Карта Google вантажиться лише після натискання: сторінка відкривається швидше і не ставить зайвих cookies.
  // Мова підписів на карті — та сама, що й на сайті.
  let mapLoaded = false;

  const mapFrameHtml = () => {
    const src = `https://www.google.com/maps?q=${encodeURIComponent(mapsQuery)}&hl=${encodeURIComponent(lang)}&z=16&output=embed`;
    return `<iframe src="${esc(src)}" title="${esc(ui("location.mapTitle"))}" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>`;
  };

  function onMainClick(event) {
    if (event.target.closest("#mapLoad")) {
      mapLoaded = true;
      $("#map").innerHTML = mapFrameHtml();
      track("map", { id: "map", label: uiDef("location.showMap") });
      return;
    }
    const viewBtn = event.target.closest("[data-pc-view]");
    if (viewBtn) {
      const next = viewBtn.dataset.pcView;
      if (next !== pcView && (next === "map" || next === "list")) {
        pcView = next;
        hideMapTooltip();
        renderAvailability();
      }
      return;
    }
    if (event.target.closest("[data-pc-clear]")) {
      selectedPcNum = null;
      syncSelectedPcUi();
      return;
    }
    const pcEl = event.target.closest("[data-pc-num]");
    if (pcEl) {
      handlePcActivate(pcEl);
      return;
    }
    if (!event.target.closest("[data-map-tooltip]")) hideMapTooltip();
  }

  function onMainPointerOver(event) {
    if (event.pointerType !== "mouse") return;
    const pcEl = event.target.closest(".map-pc[data-pc-num]");
    if (pcEl) showMapTooltip(pcEl);
  }

  function onMainPointerOut(event) {
    if (event.pointerType !== "mouse") return;
    const fromPc = event.target.closest(".map-pc[data-pc-num]");
    if (!fromPc) return;
    const toPc = event.relatedTarget?.closest?.(".map-pc[data-pc-num]");
    if (!toPc) hideMapTooltip();
  }

  function onMainFocusIn(event) {
    const pcEl = event.target.closest(".map-pc[data-pc-num]");
    if (pcEl) showMapTooltip(pcEl);
  }

  function onMainFocusOut(event) {
    const fromPc = event.target.closest(".map-pc[data-pc-num]");
    if (!fromPc) return;
    const toPc = event.relatedTarget?.closest?.(".map-pc[data-pc-num]");
    if (!toPc) hideMapTooltip();
  }

  function onMainKeyDown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const pcEl = event.target.closest("[data-pc-num]");
    if (!pcEl) return;
    event.preventDefault();
    handlePcActivate(pcEl);
  }

  function onDocumentClick(event) {
    if (tooltipPcNum != null && !event.target.closest("[data-club-map]")) hideMapTooltip();
  }

  /* ================= Копіювання та сповіщення ================= */

  let toastTimer = 0;
  function toast(message) {
    const el = $("#toast");
    // Відкрите модальне вікно перекриває все, тому показуємо сповіщення всередині нього
    (document.querySelector("dialog[open]") || document.body).appendChild(el);
    el.innerHTML = `${icon("check")}<span>${esc(message)}</span>`;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-visible"), 2200);
  }

  async function copyText(text, host) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.cssText = "position:fixed;opacity:0;";
      host.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
  }

  function onCopyClick(event) {
    const btn = event.target.closest("[data-copy]");
    if (!btn) return;
    copyText(btn.dataset.copy, btn.closest("dialog") || document.body).then(() => toast(btn.dataset.copyMsg || ui("copied")));
  }

  /* ================= «Поділитися» ================= */

  const SHARE_TARGETS = [
    ["telegram", (u, t) => `https://t.me/share/url?url=${u}&text=${t}`],
    ["whatsapp", (u, t) => `https://wa.me/?text=${t}%20${u}`],
    ["viber", (u, t) => `viber://forward?text=${t}%20${u}`],
    ["facebook", (u) => `https://www.facebook.com/sharer/sharer.php?u=${u}`],
    ["x", (u, t) => `https://x.com/intent/tweet?url=${u}&text=${t}`],
  ];
  const QR_LIB = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
  // Хеш саме цієї версії (з cdnjs). Змінили версію в QR_LIB — візьміть новий хеш на cdnjs.com, інакше QR не з'явиться
  const QR_LIB_SRI = "sha512-ZDSPMa/JM1D+7kdg2x3BsruQ6T/JpJo3jWDWkCZsP+5yVyp1KfESqLI+7RqB5k24F7p2cV7i2YHh/890y6P6Sw==";
  let qrState = "idle";

  function shareHtml() {
    const u = encodeURIComponent(pageUrl);
    const text = encodeURIComponent([site.name, t(site.tagline)].filter(Boolean).join(" — "));
    const items = SHARE_TARGETS.map(([id, make]) => {
      const href = make(u, text);
      const [label, color] = NETWORKS[id];
      return `<a class="share-item" href="${esc(href)}"${targetAttrs(href)} style="--c:${color}" data-track="share" data-id="${id}" data-label="${label}"><span class="share-item__icon">${icon(id)}</span>${label}</a>`;
    }).join("");
    const native = navigator.share
      ? `<button class="share-item" type="button" id="nativeShare"><span class="share-item__icon">${icon("share-2")}</span>${esc(ui("share.more"))}</button>`
      : "";

    return `
      <div class="sheet__inner" data-no-utm>
        <div class="sheet__grab" aria-hidden="true"></div>
        <div class="sheet__head">
          <h2 class="sheet__title" id="shareTitle">${esc(ui("share.title"))}</h2>
          <button class="icon-btn icon-btn--sm" type="button" data-close aria-label="${esc(ui("share.close"))}">${icon("close")}</button>
        </div>
        <div class="share-grid">${items}${native}</div>
        <div class="copy-row">
          <input type="text" value="${esc(pageUrl)}" readonly aria-label="${esc(ui("share.link"))}">
          <button class="btn btn--primary" type="button" data-copy="${esc(pageUrl)}" data-copy-msg="${esc(ui("share.copied"))}" data-track="share" data-id="copy" data-label="${esc(uiDef("share.copy"))}">${icon("copy")}${esc(ui("share.copy"))}</button>
        </div>
        <div class="qr" id="qr" hidden>
          <canvas width="1024" height="1024" role="img" aria-label="${esc(ui("share.qrAlt"))}"></canvas>
          <div class="qr__text">
            <b>${esc(ui("share.qrTitle"))}</b>
            <p>${esc(ui("share.qrText"))}</p>
            <button class="btn btn--ghost btn--sm" type="button" id="qrDownload" data-track="qr_download" data-id="qr_download" data-label="${esc(uiDef("share.qrSave"))}">${icon("download")}${esc(ui("share.qrSave"))}</button>
          </div>
        </div>
      </div>`;
  }

  function drawQr() {
    const box = $("#qr");
    const canvas = $("canvas", box);
    const qr = window.qrcode(0, "M");
    qr.addData(pageUrl);
    qr.make();
    const count = qr.getModuleCount();
    const quiet = 4;
    const cell = Math.floor(canvas.width / (count + quiet * 2));
    const offset = Math.floor((canvas.width - cell * count) / 2);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0a0b0d";
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) ctx.fillRect(offset + c * cell, offset + r * cell, cell, cell);
      }
    }
    box.hidden = false;
  }

  function ensureQr() {
    if (qrState !== "idle") return;
    qrState = "loading";
    const script = loadScript(QR_LIB, QR_LIB_SRI);
    script.onload = () => {
      qrState = "ready";
      drawQr();
    };
    script.onerror = () => (qrState = "error"); // без інтернету блок QR просто не з'явиться
  }

  function downloadQr() {
    $("#qr canvas")?.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${(site.name || "qr").toLowerCase().replace(/\s+/g, "-")}-qr.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, "image/png");
  }

  // Вміст вікна перемальовується при зміні мови; QR, якщо вже був, малюємо знову
  function renderShare() {
    const dialog = $("#share");
    if (!dialog) return;
    dialog.innerHTML = shareHtml();
    if (qrState === "ready") drawQr();
  }

  function initShare() {
    const dialog = $("#share");
    const button = $("#shareBtn");
    if (!dialog || !button) return;
    button.hidden = false;

    button.addEventListener("click", () => {
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
        ensureQr();
      } else if (navigator.share) {
        navigator.share({ title: document.title, url: pageUrl }).catch(() => {});
      } else {
        copyText(pageUrl, document.body).then(() => toast(ui("share.copied")));
      }
      track("share_open", { id: "share_open", label: uiDef("share.title") });
    });

    dialog.addEventListener("click", (e) => {
      if (e.target === dialog || e.target.closest("[data-close]")) {
        dialog.close();
      } else if (e.target.closest("#nativeShare")) {
        navigator
          .share({ title: document.title, url: pageUrl })
          .then(() => track("share", { id: "native", label: "native" }))
          .catch(() => {});
      } else if (e.target.closest("#qrDownload")) {
        downloadQr();
      }
    });
  }

  /* ================= Панель дій унизу (телефон) ================= */

  // «Trasa» і «Zarezerwuj» завжди під пальцем. Панель з'являється, коли головна кнопка бронювання
  // прокрутилась за екран, і ховається, поки видно банер cookies або кнопки в блоці «Godziny i adres».
  // Окрема кнопка «Zadzwoń» з'являється, лише коли бронювання — не дзвінок (інакше дві однакові кнопки).
  const actionBarState = { ctaVisible: true, actionsVisible: false };
  let actionBarObserver = null;

  function renderActionBar() {
    const bar = $("#actionBar");
    if (!bar) return;
    const b = C.booking || {};
    const buttons = [];
    if (mapsQuery) {
      buttons.push(
        `<a class="actionbar__btn" href="${esc(routeUrl)}" target="_blank" rel="noopener" data-no-utm data-track="route" data-id="route_bar" data-label="${esc(uiDef("location.route"))}">${icon("navigation")}<span>${esc(ui("location.route"))}</span></a>`
      );
    }
    if (phoneHref && b.url !== phoneHref) {
      buttons.push(
        `<a class="actionbar__btn" href="${esc(phoneHref)}" data-track="phone" data-id="phone_bar" data-label="${esc(uiDef("location.call"))}">${icon("phone")}<span>${esc(ui("location.call"))}</span></a>`
      );
    }
    if (b.url) {
      buttons.push(
        `<a class="actionbar__btn actionbar__btn--primary" href="${esc(b.url)}"${targetAttrs(b.url)} data-track="booking" data-id="booking_bar" data-label="${esc(tDef(b.title))}">${icon(/^tel:/i.test(b.url) ? "phone" : "calendar-check")}<span>${esc(t(b.title))}</span></a>`
      );
    }
    bar.innerHTML = buttons.join("");
    bar.setAttribute("aria-label", ui("actionBar.label"));
    bar.hidden = !buttons.length;
    document.body.classList.toggle("with-actionbar", buttons.length > 0);
    applyUtm(bar);
    watchActionBar();
    updateActionBar();
  }

  function updateActionBar() {
    const bar = $("#actionBar");
    if (!bar || bar.hidden) return;
    const consentOpen = !($("#consent")?.hidden ?? true);
    const show = !actionBarState.ctaVisible && !actionBarState.actionsVisible && !consentOpen;
    bar.classList.toggle("is-visible", show);
    bar.inert = !show; // прихована панель не ловить фокус клавіатури
    document.body.classList.toggle("actionbar-shown", show);
  }

  // Після кожного рендеру кнопки нові — стежимо за ними заново
  function watchActionBar() {
    actionBarObserver?.disconnect();
    const cta = $(".cta");
    const actions = $(".card__actions");
    actionBarState.ctaVisible = Boolean(cta);
    actionBarState.actionsVisible = false;
    if (!("IntersectionObserver" in window)) {
      actionBarState.ctaVisible = false;
      return;
    }
    actionBarObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.target === cta) actionBarState.ctaVisible = entry.isIntersecting;
        if (entry.target === actions) actionBarState.actionsVisible = entry.isIntersecting;
      });
      updateActionBar();
    });
    if (cta) actionBarObserver.observe(cta);
    if (actions) actionBarObserver.observe(actions);
  }

  /* ================= Банер cookies ================= */

  // draft — ще не збережені перемикачі (щоб зміна мови їх не скидала)
  function renderConsent(showPrefs, draft = {}) {
    const box = $("#consent");
    const isOn = (name) => (typeof draft[name] === "boolean" ? draft[name] : granted(name));
    const row = (name, title, tools) =>
      tools.length
        ? `<label class="switch-row"><span><b>${esc(title)}</b><small>${esc(tools.join(", "))}</small></span><input class="switch" type="checkbox" name="${name}"${isOn(name) ? " checked" : ""}></label>`
        : "";

    // Компактний вигляд: один рядок і дві однаково помітні кнопки — відмовитись так само легко, як погодитись
    box.classList.toggle("consent--compact", !showPrefs);
    if (!showPrefs) {
      box.innerHTML = `
        <p class="consent__short">${icon("cookie")}<span>${esc(ui("consent.short"))} <button class="linklike" type="button" data-consent="prefs">${esc(ui("consent.customize"))}</button></span></p>
        <div class="consent__actions consent__actions--equal">
          <button class="btn btn--ghost" type="button" data-consent="necessary">${esc(ui("consent.reject"))}</button>
          <button class="btn btn--ghost" type="button" data-consent="all">${esc(ui("consent.accept"))}</button>
        </div>`;
      box.hidden = false;
      updateActionBar();
      return;
    }

    box.innerHTML = `
      <div class="consent__head">${icon("cookie")}<b>${esc(ui("consent.title"))}</b></div>
      <p class="consent__text">${esc(ui("consent.text"))}</p>
      <div class="consent__prefs"${showPrefs ? "" : " hidden"}>
        <label class="switch-row"><span><b>${esc(ui("consent.necessary"))}</b><small>${esc(ui("consent.necessaryHint"))}</small></span><input class="switch" type="checkbox" checked disabled></label>
        ${row("analytics", ui("consent.analytics"), ANALYTICS_TOOLS)}
        ${row("marketing", ui("consent.marketing"), MARKETING_TOOLS)}
      </div>
      <div class="consent__actions">
        <button class="btn btn--primary" type="button" data-consent="all">${esc(ui("consent.acceptAll"))}</button>
        <button class="btn btn--ghost" type="button" data-consent="necessary">${esc(ui("consent.necessaryOnly"))}</button>
        <button class="btn btn--text" type="button" data-consent="save">${esc(ui("consent.save"))}</button>
      </div>`;
    box.hidden = false;
    updateActionBar();
  }

  function refreshConsent() {
    const box = $("#consent");
    if (!box || box.hidden || !box.firstElementChild) return;
    const prefs = $(".consent__prefs", box);
    const draft = {};
    $$("input[name]", box).forEach((input) => (draft[input.name] = input.checked));
    renderConsent(Boolean(prefs && !prefs.hidden), draft);
  }

  function initConsent() {
    if (!needsConsentUi) return;
    const box = $("#consent");

    box.addEventListener("click", (e) => {
      const action = e.target.closest("[data-consent]")?.dataset.consent;
      if (action === "all") saveConsent({ analytics: true, marketing: true });
      else if (action === "necessary") saveConsent({ analytics: false, marketing: false });
      else if (action === "prefs") renderConsent(true);
      else if (action === "save") {
        saveConsent({
          analytics: Boolean($('[name="analytics"]', box)?.checked),
          marketing: Boolean($('[name="marketing"]', box)?.checked),
        });
      }
    });

    if (!consent) renderConsent(false);
  }

  function onFooterClick(event) {
    if (event.target.closest("#cookieSettings")) renderConsent(true);
  }

  /* ================= PWA ================= */

  // Service Worker: сторінка відкривається без інтернету і швидше при повторних візитах.
  // Працює лише через https (або localhost); з file:// просто пропускаємо.
  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    const register = () =>
      navigator.serviceWorker.register("sw.js").catch((error) => {
        if (T.debug) warnOnce("Service Worker не зареєструвався: " + error);
      });
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }

  /* ================= Структуровані дані для Google ================= */

  let jsonLd = null;

  function injectJsonLd() {
    const abs = (path) => {
      try {
        return new URL(path, pageUrl).href;
      } catch {
        return path;
      }
    };
    const postal = contacts.postal || {};
    const geo = contacts.geo || {};
    const clubId = pageUrl + "#club";
    const siteId = pageUrl + "#website";
    // BCP 47 коди всіх мов сайту (pl-PL, en-GB, uk-UA, ru-RU)
    const languages = LANGS.map((l) => l.locale || l.code);

    // Діапазон цін: вручну з site.priceRange або з цін зон, якщо вони вже вписані
    const prices = (C.zones || []).filter(hasPrice).flatMap(zonePrices);
    const currency = tDef(site.currency) || site.currencyCode || "";
    const priceRange =
      tDef(site.priceRange) ||
      (prices.length
        ? `${Math.min(...prices) === Math.max(...prices) ? Math.min(...prices) : `${Math.min(...prices)}–${Math.max(...prices)}`} ${currency}`.trim()
        : undefined);

    // Онлайн-бронювання — як дія «Забронювати» для Google; дзвінок сюди не підходить
    const booking = C.booking || {};
    const reserve = isWeb(booking.url)
      ? {
          "@type": "ReserveAction",
          name: tDef(booking.title) || undefined,
          target: { "@type": "EntryPoint", urlTemplate: booking.url, inLanguage: languages, actionPlatform: ["https://schema.org/DesktopWebPlatform", "https://schema.org/MobileWebPlatform"] },
        }
      : undefined;

    const club = {
      "@type": "EntertainmentBusiness",
      "@id": clubId,
      name: site.fullName || site.name,
      alternateName: site.fullName && site.name !== site.fullName ? site.name : undefined,
      description: t(site.description) || undefined,
      url: pageUrl,
      logo: abs(site.logo || "assets/logo.svg"),
      image: [abs("assets/og-image.jpg"), abs(site.logo || "assets/logo.svg")],
      telephone: contacts.phone || undefined,
      priceRange,
      currenciesAccepted: site.currencyCode || undefined,
      potentialAction: reserve,
      address: contacts.address
        ? {
            "@type": "PostalAddress",
            streetAddress: postal.street || contacts.address,
            postalCode: postal.postalCode || undefined,
            addressLocality: postal.city || undefined,
            addressCountry: postal.country || undefined,
          }
        : undefined,
      geo: typeof geo.lat === "number" && typeof geo.lng === "number" ? { "@type": "GeoCoordinates", latitude: geo.lat, longitude: geo.lng } : undefined,
      hasMap: contacts.mapsUrl || undefined,
      sameAs: (C.socials || []).map((s) => s.url).filter(Boolean),
      openingHoursSpecification: schedule
        .map((d, i) =>
          d
            ? {
                "@type": "OpeningHoursSpecification",
                dayOfWeek: "https://schema.org/" + DAYS_EN[i],
                opens: fmt(d.open),
                closes: d.close === 1440 ? "23:59" : fmt(d.close),
              }
            : null
        )
        .filter(Boolean),
    };

    const data = {
      "@context": "https://schema.org",
      "@graph": [
        club,
        // Сайт доступний чотирма мовами
        { "@type": "WebSite", "@id": siteId, url: pageUrl, name: site.fullName || site.name, inLanguage: languages, publisher: { "@id": clubId } },
        // Поточна сторінка — мовою, яку бачить відвідувач
        { "@type": "WebPage", "@id": pageUrl + "#page", url: pageUrl, name: document.title, inLanguage: langInfo().locale || lang, isPartOf: { "@id": siteId }, about: { "@id": clubId } },
      ],
    };
    // Часті питання — ті самі, що видно на сторінці
    const faq = faqItems();
    if (faq.length) {
      data["@graph"].push({
        "@type": "FAQPage",
        "@id": pageUrl + "#faq",
        inLanguage: langInfo().locale || lang,
        mainEntity: faq.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
      });
    }
    if (!jsonLd) {
      jsonLd = document.createElement("script");
      jsonLd.type = "application/ld+json";
      document.head.appendChild(jsonLd);
    }
    jsonLd.textContent = JSON.stringify(data);
  }

  /* ================= Перемикач мов ================= */

  // Кнопки створюються один раз і не перемальовуються, тож фокус клавіатури лишається на місці
  function initLangSwitch() {
    const box = $("#langSwitch");
    if (!box || LANGS.length < 2) return;
    box.innerHTML = LANGS.map((l) => {
      const label = l.label || l.code.toUpperCase();
      const name = l.name || label;
      return `<button class="lang-switch__btn" type="button" data-lang="${esc(l.code)}" lang="${esc(l.code)}" title="${esc(name)}" aria-label="${esc(`${name} (${label})`)}">${esc(label)}</button>`;
    }).join("");
    box.hidden = false;
    box.addEventListener("click", (e) => {
      const button = e.target.closest("[data-lang]");
      if (button) setLanguage(button.dataset.lang);
    });
  }

  function syncLangSwitch() {
    const box = $("#langSwitch");
    if (!box) return;
    box.setAttribute("aria-label", ui("language"));
    $$("[data-lang]", box).forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.lang === lang)));
  }

  // Якщо мову задано в посиланні (?lang=…), міняємо її і там — інакше після перезавантаження повернеться стара
  function syncUrlLang() {
    try {
      const url = new URL(location.href);
      if (!url.searchParams.has("lang")) return;
      url.searchParams.set("lang", lang);
      history.replaceState(history.state, "", url);
    } catch {
      /* file:// або старий браузер — не страшно */
    }
  }

  function applyLanguage() {
    document.documentElement.lang = lang;
    const title = t(site.title) || [site.name, t(site.tagline)].filter(Boolean).join(" — ");
    if (title) document.title = title;
    const description = t(site.description);
    if (description) $('meta[name="description"]')?.setAttribute("content", description);
    $("#shareBtn")?.setAttribute("aria-label", ui("share.open"));
    $("#consent")?.setAttribute("aria-label", ui("consent.settings"));
    syncLangSwitch();

    render();
    renderStatus();
    initCarousel();
    renderShare();
    refreshConsent();
    renderActionBar();
    injectJsonLd();
  }

  function setLanguage(code) {
    const next = normLang(code);
    if (!next || next === lang) return;
    lang = next;
    store.set(LANG_KEY, lang);
    syncUrlLang();
    document.documentElement.classList.add("no-anim"); // без повторної анімації появи блоків
    applyLanguage();
    track("language", { id: lang, label: langInfo().name });
  }

  /* ================= Запуск ================= */

  function applyTheme() {
    const theme = C.theme || {};
    const rootStyle = document.documentElement.style;
    if (theme.accent) rootStyle.setProperty("--accent", theme.accent);
    if (theme.accentDeep) rootStyle.setProperty("--accent-deep", theme.accentDeep);
    if (theme.accent2) rootStyle.setProperty("--accent-2", theme.accent2);
  }

  initAnalytics();
  applyTheme();
  initLangSwitch();
  initShare();
  applyLanguage();
  initConsent();
  // Сторінка не чекає на Google: спершу показується галерея з config.js, а коли таблиця
  // завантажиться — сторінка перемальовується з фото з таблиці (без повторної анімації)
  fetchGalleryData().then((updated) => {
    if (!updated) return;
    document.documentElement.classList.add("no-anim");
    applyLanguage();
  });
  initAvailability();
  registerServiceWorker();
  setInterval(renderStatus, 60 * 1000); // статус «Otwarte / Zamknięte» оновлюється щохвилини

  document.addEventListener("click", onTrackedClick);
  document.addEventListener("auxclick", onTrackedClick);
  document.addEventListener("click", onCopyClick);
  document.addEventListener("click", onDocumentClick);
  const mainEl = $("#main");
  mainEl.addEventListener("click", onMainClick);
  mainEl.addEventListener("pointerover", onMainPointerOver);
  mainEl.addEventListener("pointerout", onMainPointerOut);
  mainEl.addEventListener("focusin", onMainFocusIn);
  mainEl.addEventListener("focusout", onMainFocusOut);
  mainEl.addEventListener("keydown", onMainKeyDown);
  mainEl.addEventListener(
    "scroll",
    (e) => {
      if (e.target.matches?.("[data-map-viewport]")) {
        hideMapTooltip();
        e.target.closest("[data-club-map]")?.classList.add("is-scrolled");
      }
    },
    true
  );
  mainEl.addEventListener("toggle", onFaqToggle, true); // «toggle» не спливає, тому ловимо на етапі захоплення
  $("#footer").addEventListener("click", onFooterClick);
})();
