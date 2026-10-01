/* VADE — логіка сторінки: рендер з config.js, чотири мови (PL/EN/UA/RU), графік роботи, галерея,
   «Поділитися», банер cookies, аналітика з UTM-мітками, кнопка трансляції, вільні ПК з SENET і PWA.
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
  // (бронювання SENET тощо), щоб система бронювання бачила, звідки прийшов клієнт.
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

  const NETWORKS = {
    instagram: ["Instagram", "#E4405F"],
    tiktok: ["TikTok", "#FE2C55"],
    telegram: ["Telegram", "#26A5E4"],
    discord: ["Discord", "#5865F2"],
    youtube: ["YouTube", "#FF0033"],
    facebook: ["Facebook", "#1877F2"],
    whatsapp: ["WhatsApp", "#25D366"],
    viber: ["Viber", "#7360F2"],
    x: ["X", "#FFFFFF"],
  };
  const ICON_COLORS = {
    phone: "#34D399",
    utensils: "#F59E0B",
    trophy: "#FACC15",
    handshake: "#A78BFA",
    "map-pin": "#22D3EE",
    "gamepad-2": "#8B5CF6",
    monitor: "#22D3EE",
    link: "#A3A9BC",
  };
  const colorFor = (item) => item.color || NETWORKS[item.icon]?.[1] || ICON_COLORS[item.icon] || "var(--accent)";

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

  function loadScript(src) {
    const script = document.createElement("script");
    script.async = true;
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
  };
  const META_EVENTS = { booking: "Schedule", phone: "Contact", route: "FindLocation", map: "FindLocation" };
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
    if (T.gtm) window.dataLayer.push({ event: "vade_" + name, ...params });
    if (loaded.meta) {
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
    <section class="section rise" aria-labelledby="${id}-title">
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
          <p class="status status--avail" data-avail hidden></p>
        </div>
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
              ? `<img src="${esc(item.src)}" alt="${esc(caption || site.name)}" width="800" height="600" loading="lazy" decoding="async">`
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
          <div class="dots">${items
            .map((_, i) => `<button class="dot" type="button" aria-label="${esc(ui("gallery.photo", { n: i + 1 }))}" aria-current="${i === slideIndex}"></button>`)
            .join("")}</div>
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
  const hasPrice = (zone) => Boolean(zone) && zone.price !== "" && zone.price != null;

  function zonesHtml() {
    const zones = (C.zones || []).filter(hasPrice);
    if (!zones.length) return "";
    const currency = t(site.currency);
    const cards = zones
      .map((z) => {
        const badge = t(z.badge);
        const specs = (tr(z.specs) || []).map((s) => t(s)).filter(Boolean);
        const unit = t(z.unit) || ui("zones.unit");
        return `
        <li class="zone${z.featured ? " zone--featured" : ""}">
          <div class="zone__top">
            <h3 class="zone__name">${esc(t(z.name))}</h3>
            ${badge ? `<span class="zone__badge">${esc(badge)}</span>` : ""}
          </div>
          <p class="zone__price">${esc(formatNumber(z.price))} <small>${esc(currency ? `${currency}/${unit}` : unit)}</small></p>
          ${specs.length ? `<ul class="zone__specs">${specs.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
        </li>`;
      })
      .join("");
    const note = t(C.zonesNote);
    return section("zones", ui("zones.title"), `<ul class="zones">${cards}</ul>${note ? `<p class="section__note">${esc(note)}</p>` : ""}`);
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

  function render() {
    $("#hero").innerHTML = heroHtml();
    $("#main").innerHTML = liveHtml() + ctaHtml() + linksHtml() + galleryHtml() + zonesHtml() + locationHtml();
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

  function initCarousel() {
    clearInterval(autoplayTimer);
    galleryObserver?.disconnect();
    galleryObserver = null;

    const root = $(".carousel");
    if (!root) return;
    const rail = $(".carousel__rail", root);
    const slides = Array.from(rail.children);
    const dots = $$(".dot", root);
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
    };

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

    if (slides.length > 1 && !autoplayOff) {
      autoplayTimer = setInterval(() => {
        if (!autoplayOff && !paused && visible && !document.hidden) go(slideIndex + 1);
      }, 4500);
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
    if (!event.target.closest("#mapLoad")) return;
    mapLoaded = true;
    $("#map").innerHTML = mapFrameHtml();
    track("map", { id: "map", label: uiDef("location.showMap") });
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
    ctx.fillStyle = "#07080d";
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
    const script = loadScript(QR_LIB);
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

  /* ================= Банер cookies ================= */

  // draft — ще не збережені перемикачі (щоб зміна мови їх не скидала)
  function renderConsent(showPrefs, draft = {}) {
    const box = $("#consent");
    const isOn = (name) => (typeof draft[name] === "boolean" ? draft[name] : granted(name));
    const row = (name, title, tools) =>
      tools.length
        ? `<label class="switch-row"><span><b>${esc(title)}</b><small>${esc(tools.join(", "))}</small></span><input class="switch" type="checkbox" name="${name}"${isOn(name) ? " checked" : ""}></label>`
        : "";

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
        <button class="btn btn--text" type="button" data-consent="${showPrefs ? "save" : "prefs"}">${esc(ui(showPrefs ? "consent.save" : "consent.customize"))}</button>
      </div>`;
    box.hidden = false;
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

  /* ================= Вільні ПК (SENET через /api/status) ================= */

  // Відповідь функції functions/api/status.js: { available: 12, total: 20, updatedAt: "…" }.
  // Якщо функції немає (локальний перегляд, інший хостинг) або SENET не налаштовано — бейдж не показується.
  const AV = C.availability || {};
  let availability = null;
  let availabilityOff = !AV.enabled || !AV.endpoint || location.protocol === "file:";
  let availabilityTimer = 0;

  // Множина за правилами мови: 1 wolny / 2 wolne / 5 wolnych PC
  function pluralText(path, n) {
    const forms = tr(lookup(path));
    if (!isDict(forms)) return fill(forms, { n: formatNumber(n) });
    let category = "other";
    try {
      category = new Intl.PluralRules(langInfo().locale || lang).select(n);
    } catch {
      /* старий браузер — лишається "other" */
    }
    return fill(forms[category] ?? forms.other ?? forms.many ?? Object.values(forms)[0], { n: formatNumber(n) });
  }

  function renderAvailability() {
    const el = $("[data-avail]");
    if (!el) return;
    // Коли клуб зачинено, SENET бачить усі ПК «вільними» — такий бейдж лише заплутає
    const closed = hasSchedule && !getStatus().open;
    if (!availability || closed) {
      el.hidden = true;
      return;
    }
    const n = availability.available;
    el.dataset.state = n > 0 ? "open" : "closed";
    el.title = ui("availability.label");
    el.innerHTML = `<span class="status__dot"></span><span><b>${esc(n > 0 ? pluralText("availability.free", n) : ui("availability.none"))}</b></span>`;
    el.hidden = false;
  }

  async function loadAvailability() {
    if (availabilityOff) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(AV.endpoint, { headers: { Accept: "application/json" }, cache: "no-store", signal: controller.signal });
      // 404 — функції немає на цьому хостингу; 503 — SENET ще не налаштовано. Більше не питаємо.
      if (res.status === 404 || res.status === 503) {
        availabilityOff = true;
        clearInterval(availabilityTimer);
        availability = null;
      } else if (!res.ok) {
        availability = null;
      } else {
        const data = await res.json();
        const available = Number(data.available);
        availability = Number.isFinite(available) && available >= 0 ? { available: Math.floor(available), total: Number(data.total) || null } : null;
      }
    } catch (error) {
      availability = null;
      if (T.debug) warnOnce("не вдалося отримати вільні ПК: " + error);
    } finally {
      clearTimeout(timeout);
    }
    renderAvailability();
  }

  function initAvailability() {
    if (availabilityOff) return;
    loadAvailability();
    const every = Math.max(15, Number(AV.refreshSeconds) || 60) * 1000;
    availabilityTimer = setInterval(() => {
      if (!document.hidden) loadAvailability();
    }, every);
    // Повернулись на вкладку — одразу свіжі дані
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) loadAvailability();
    });
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
    const prices = (C.zones || []).filter(hasPrice).map((z) => Number(z.price)).filter(Number.isFinite);
    const currency = tDef(site.currency) || site.currencyCode || "";
    const priceRange =
      tDef(site.priceRange) ||
      (prices.length
        ? `${Math.min(...prices) === Math.max(...prices) ? Math.min(...prices) : `${Math.min(...prices)}–${Math.max(...prices)}`} ${currency}`.trim()
        : undefined);

    // Онлайн-бронювання (SENET) — як дія «Забронювати» для Google; дзвінок сюди не підходить
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
      image: [abs("assets/og-image.png"), abs(site.logo || "assets/logo.svg")],
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
    renderAvailability();
    initCarousel();
    renderShare();
    refreshConsent();
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
  initAvailability();
  registerServiceWorker();
  setInterval(() => {
    renderStatus();
    renderAvailability(); // о 00:00 клуб зачиняється — бейдж вільних ПК ховається
  }, 60 * 1000);

  document.addEventListener("click", onTrackedClick);
  document.addEventListener("auxclick", onTrackedClick);
  document.addEventListener("click", onCopyClick);
  $("#main").addEventListener("click", onMainClick);
  $("#footer").addEventListener("click", onFooterClick);
})();
