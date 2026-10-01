/* VADE — логіка сторінки: рендер з config.js, графік роботи, галерея, «Поділитися»,
   банер cookies та аналітика. Контент і ID трекерів змінюються в config.js. */
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

  const phoneHref = contacts.phone ? "tel:" + contacts.phone.replace(/[^\d+]/g, "") : "";
  const mapsQuery = contacts.mapsQuery || contacts.address || "";
  const pageUrl = site.url || location.href.split(/[?#]/)[0];

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
  };
  const META_EVENTS = { booking: "Schedule", phone: "Contact", route: "FindLocation", map: "FindLocation" };
  const TIKTOK_EVENTS = { booking: "ClickButton", phone: "Contact", social: "ClickButton", link: "ClickButton", route: "ClickButton" };

  function track(type, info = {}) {
    const name = EVENT_NAMES[type] || type;
    const params = {};
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
  const DAYS_EN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const DAY_LABELS = ["Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота", "Неділя"];
  const DAY_ON = ["в понеділок", "у вівторок", "в середу", "в четвер", "в п'ятницю", "в суботу", "в неділю"];

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

    if (schedule.every((d) => d && d.allDay)) return { open: true, text: "цілодобово" };
    // нічна зміна, що почалась учора
    if (yesterday && !yesterday.allDay && yesterday.close <= yesterday.open && min < yesterday.close) {
      return { open: true, text: `до ${fmt(yesterday.close)}` };
    }
    if (today) {
      if (today.allDay) return { open: true, text: "весь день" };
      const overnight = today.close <= today.open;
      if (min >= today.open && (overnight || min < today.close)) return { open: true, text: `до ${fmt(today.close)}` };
      if (min < today.open) return { open: false, text: `відкриємо о ${fmt(today.open)}` };
    }
    for (let i = 1; i <= 7; i++) {
      const next = schedule[(day + i) % 7];
      if (next) return { open: false, text: `відкриємо ${i === 1 ? "завтра" : DAY_ON[(day + i) % 7]} о ${fmt(next.open)}` };
    }
    return { open: false, text: "" };
  }

  function renderStatus() {
    if (!hasSchedule) return;
    const status = getStatus();
    $$("[data-status]").forEach((el) => {
      el.hidden = false;
      el.dataset.state = status.open ? "open" : "closed";
      $("[data-status-text]", el).innerHTML = `<b>${status.open ? "Відчинено" : "Зачинено"}</b>${status.text ? " · " + esc(status.text) : ""}`;
    });
  }

  const dayText = (d) => (!d ? "Вихідний" : d.allDay ? "Цілодобово" : `${fmt(d.open)} – ${fmt(d.close)}`);

  /* ================= Розмітка ================= */

  const section = (id, title, body) => `
    <section class="section rise" aria-labelledby="${id}-title">
      <h2 class="section__title" id="${id}-title">${esc(title)}</h2>
      ${body}
    </section>`;

  function heroHtml() {
    const socials = (C.socials || []).filter((s) => s.url && NETWORKS[s.network]);
    return `
      <button class="icon-btn hero__share" type="button" id="shareBtn" aria-label="Поділитися сторінкою">${icon("share-2")}</button>
      <div class="rise">
        <div class="hero__logo"><img src="${esc(site.logo || "assets/logo.svg")}" alt="Логотип ${esc(site.name)}" width="96" height="96"></div>
        <h1 class="hero__name">${esc(site.name)}</h1>
        ${site.tagline ? `<p class="hero__tagline">${esc(site.tagline)}</p>` : ""}
        <p class="status" data-status hidden><span class="status__dot"></span><span data-status-text></span></p>
        ${
          socials.length
            ? `<ul class="socials" aria-label="Соцмережі">${socials
                .map(({ network, url }) => {
                  const [label, color] = NETWORKS[network];
                  return `<li><a class="social" href="${esc(url)}" target="_blank" rel="noopener" aria-label="${label}" title="${label}" style="--brand:${color}" data-track="social" data-id="${network}" data-label="${label}">${icon(network)}</a></li>`;
                })
                .join("")}</ul>`
            : ""
        }
      </div>`;
  }

  function ctaHtml() {
    const b = C.booking || {};
    if (!b.url) return "";
    return `
      <a class="cta rise" href="${esc(b.url)}"${targetAttrs(b.url)} data-track="booking" data-id="booking" data-label="${esc(b.title)}">
        <span class="cta__icon">${icon("calendar-check")}</span>
        <span class="cta__text">
          <span class="cta__title">${esc(b.title || "Забронювати")}</span>
          ${b.subtitle ? `<span class="cta__sub">${esc(b.subtitle)}</span>` : ""}
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
        .map(
          (link) => `
        <li>
          <a class="link" href="${esc(link.url)}"${targetAttrs(link.url)} data-track="${esc(link.type || "link")}" data-id="${esc(link.id || link.title)}" data-label="${esc(link.title)}">
            <span class="link__icon" style="--c:${colorFor(link)}">${icon(link.icon || "link")}</span>
            <span class="link__body">
              <span class="link__title">${esc(link.title)}</span>
              ${link.subtitle ? `<span class="link__sub">${esc(link.subtitle)}</span>` : ""}
            </span>
            ${icon("arrow-up-right", "link__arrow")}
          </a>
        </li>`
        )
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
      .map(
        (item, i) => `
        <figure class="slide" role="group" aria-roledescription="слайд" aria-label="${i + 1} з ${total}" data-ph-index="${i}">
          ${
            item.src
              ? `<img src="${esc(item.src)}" alt="${esc(item.caption || site.name)}" width="800" height="600" loading="lazy" decoding="async">`
              : placeholderHtml(item, i)
          }
          ${item.caption ? `<figcaption>${esc(item.caption)}</figcaption>` : ""}
        </figure>`
      )
      .join("");
    const nav =
      total > 1
        ? `
        <div class="carousel__nav">
          <button class="icon-btn icon-btn--sm carousel__arrow" type="button" data-dir="-1" aria-label="Попереднє фото">${icon("chevron-left")}</button>
          <div class="dots">${items.map((_, i) => `<button class="dot" type="button" aria-label="Фото ${i + 1}" aria-current="${i === 0}"></button>`).join("")}</div>
          <button class="icon-btn icon-btn--sm carousel__arrow" type="button" data-dir="1" aria-label="Наступне фото">${icon("chevron-right")}</button>
        </div>`
        : "";
    return section(
      "gallery",
      "Галерея",
      `<div class="carousel" role="region" aria-roledescription="карусель" aria-label="Фото клубу">
        <div class="carousel__rail" tabindex="0">${slides}</div>
        ${nav}
      </div>`
    );
  }

  function zonesHtml() {
    const zones = C.zones || [];
    if (!zones.length) return "";
    const currency = esc(site.currency || "");
    const cards = zones
      .map(
        (z) => `
        <li class="zone${z.featured ? " zone--featured" : ""}">
          <div class="zone__top">
            <h3 class="zone__name">${esc(z.name)}</h3>
            ${z.badge ? `<span class="zone__badge">${esc(z.badge)}</span>` : ""}
          </div>
          <p class="zone__price">${esc(z.price)} <small>${currency}/${esc(z.unit || "год")}</small></p>
          ${z.specs?.length ? `<ul class="zone__specs">${z.specs.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
        </li>`
      )
      .join("");
    return section("zones", "Зони та ціни", `<ul class="zones">${cards}</ul>${C.zonesNote ? `<p class="section__note">${esc(C.zonesNote)}</p>` : ""}`);
  }

  function locationHtml() {
    if (!hasSchedule && !contacts.address) return "";
    const today = clubNow().day;
    const routeUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapsQuery)}`;

    const hours = hasSchedule
      ? `
        <div class="status-row" data-status hidden><span class="status__dot"></span><span data-status-text></span></div>
        <ul class="hours">${schedule
          .map(
            (d, i) => `
          <li${i === today ? ' class="is-today"' : ""}>
            <span>${DAY_LABELS[i]}${i === today ? '<span class="hours__tag">сьогодні</span>' : ""}</span>
            <span class="hours__time">${dayText(d)}</span>
          </li>`
          )
          .join("")}
        </ul>`
      : "";

    const place = contacts.address
      ? `
        <div class="address">
          ${icon("map-pin")}
          <span class="address__text">${esc(contacts.address)}</span>
          <button class="icon-btn icon-btn--sm" type="button" data-copy="${esc(contacts.address)}" data-copy-msg="Адресу скопійовано" data-track="copy_address" data-id="copy_address" data-label="Скопіювати адресу" aria-label="Скопіювати адресу">${icon("copy")}</button>
        </div>
        <div class="map" id="map">
          <button class="map__facade" type="button" id="mapLoad">
            <span class="map__pin">${icon("map-pin")}</span>
            <span class="map__label">Показати на карті</span>
          </button>
        </div>
        <div class="card__actions">
          <a class="btn btn--primary" href="${esc(routeUrl)}" target="_blank" rel="noopener" data-track="route" data-id="route" data-label="Маршрут">${icon("navigation")}Маршрут</a>
          ${phoneHref ? `<a class="btn btn--ghost" href="${esc(phoneHref)}" data-track="phone" data-id="phone_card" data-label="Подзвонити">${icon("phone")}Подзвонити</a>` : ""}
        </div>`
      : "";

    return section("location", "Графік і адреса", `<div class="card">${hours}${place}</div>`);
  }

  function footerHtml() {
    const cookieBtn = needsConsentUi ? `<button class="linklike" type="button" id="cookieSettings">Налаштування cookies</button>` : "";
    const privacy = site.privacyUrl ? `<a href="${esc(site.privacyUrl)}"${targetAttrs(site.privacyUrl)}>Політика конфіденційності</a>` : "";
    return `
      <p>© ${new Date().getFullYear()} ${esc(site.name)}</p>
      ${cookieBtn || privacy ? `<p class="footer__links">${cookieBtn}${privacy}</p>` : ""}`;
  }

  function render() {
    const theme = C.theme || {};
    const rootStyle = document.documentElement.style;
    if (theme.accent) rootStyle.setProperty("--accent", theme.accent);
    if (theme.accentDeep) rootStyle.setProperty("--accent-deep", theme.accentDeep);
    if (theme.accent2) rootStyle.setProperty("--accent-2", theme.accent2);

    $("#hero").innerHTML = heroHtml();
    $("#main").innerHTML = ctaHtml() + linksHtml() + galleryHtml() + zonesHtml() + locationHtml();
    $("#footer").innerHTML = footerHtml();
    $$(".rise").forEach((el, i) => el.style.setProperty("--i", i));

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

  function initCarousel() {
    const root = $(".carousel");
    if (!root) return;
    const rail = $(".carousel__rail", root);
    const slides = Array.from(rail.children);
    const dots = $$(".dot", root);
    let index = 0;
    let stopped = reduceMotion || slides.length < 2;
    let paused = false;
    let visible = true;
    let reported = false;

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

    const go = (i) => {
      index = (i + slides.length) % slides.length;
      const slide = slides[index];
      rail.scrollTo({ left: slide.offsetLeft - (rail.clientWidth - slide.offsetWidth) / 2, behavior: reduceMotion ? "auto" : "smooth" });
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
      index = best;
      dots.forEach((dot, i) => dot.setAttribute("aria-current", String(i === best)));
    };

    // Після першої дії користувача автопрокрутку вимикаємо, щоб не «смикати» фото з-під пальця
    const onUser = () => {
      stopped = true;
      if (!reported) {
        reported = true;
        track("gallery", { id: "gallery", label: "Галерея" });
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
      else if (arrow) go(index + Number(arrow.dataset.dir));
      else return;
      onUser();
    });

    root.addEventListener("mouseenter", () => (paused = true));
    root.addEventListener("mouseleave", () => (paused = false));
    root.addEventListener("focusin", () => (paused = true));
    root.addEventListener("focusout", () => (paused = false));
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => (visible = entry.isIntersecting), { threshold: 0.4 }).observe(root);
    }

    if (!stopped) {
      setInterval(() => {
        if (!stopped && !paused && visible && !document.hidden) go(index + 1);
      }, 4500);
    }
  }

  /* ================= Карта ================= */

  function initMap() {
    const btn = $("#mapLoad");
    if (!btn) return;
    // Карта Google вантажиться лише після натискання: сторінка відкривається швидше і не ставить зайвих cookies
    btn.addEventListener("click", () => {
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.google.com/maps?q=${encodeURIComponent(mapsQuery)}&hl=uk&z=16&output=embed`;
      iframe.title = `Карта: ${contacts.address}`;
      iframe.referrerPolicy = "no-referrer-when-downgrade";
      iframe.allowFullscreen = true;
      $("#map").replaceChildren(iframe);
      track("map", { id: "map", label: "Показати на карті" });
    });
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
    copyText(btn.dataset.copy, btn.closest("dialog") || document.body).then(() => toast(btn.dataset.copyMsg || "Скопійовано"));
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
    const t = encodeURIComponent([site.name, site.tagline].filter(Boolean).join(" — "));
    const items = SHARE_TARGETS.map(([id, make]) => {
      const href = make(u, t);
      const [label, color] = NETWORKS[id];
      return `<a class="share-item" href="${esc(href)}"${targetAttrs(href)} style="--c:${color}" data-track="share" data-id="${id}" data-label="${label}"><span class="share-item__icon">${icon(id)}</span>${label}</a>`;
    }).join("");
    const native = navigator.share ? `<button class="share-item" type="button" id="nativeShare"><span class="share-item__icon">${icon("share-2")}</span>Ще…</button>` : "";

    return `
      <div class="sheet__inner">
        <div class="sheet__grab" aria-hidden="true"></div>
        <div class="sheet__head">
          <h2 class="sheet__title" id="shareTitle">Поділитися</h2>
          <button class="icon-btn icon-btn--sm" type="button" data-close aria-label="Закрити">${icon("close")}</button>
        </div>
        <div class="share-grid">${items}${native}</div>
        <div class="copy-row">
          <input type="text" value="${esc(pageUrl)}" readonly aria-label="Посилання на сторінку">
          <button class="btn btn--primary" type="button" data-copy="${esc(pageUrl)}" data-copy-msg="Посилання скопійовано" data-track="share" data-id="copy" data-label="Копіювати">${icon("copy")}Копіювати</button>
        </div>
        <div class="qr" id="qr" hidden>
          <canvas width="1024" height="1024" role="img" aria-label="QR-код сторінки"></canvas>
          <div class="qr__text">
            <b>QR-код</b>
            <p>Для столів, флаєрів і вітрини клубу.</p>
            <button class="btn btn--ghost btn--sm" type="button" id="qrDownload" data-track="qr_download" data-id="qr_download" data-label="Завантажити QR">${icon("download")}Зберегти PNG</button>
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

  function initShare() {
    const dialog = $("#share");
    dialog.innerHTML = shareHtml();

    $("#shareBtn").addEventListener("click", () => {
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
        ensureQr();
      } else if (navigator.share) {
        navigator.share({ title: document.title, url: pageUrl }).catch(() => {});
      } else {
        copyText(pageUrl, document.body).then(() => toast("Посилання скопійовано"));
      }
      track("share_open", { id: "share_open", label: "Поділитися" });
    });

    dialog.addEventListener("click", (e) => {
      if (e.target === dialog || e.target.closest("[data-close]")) dialog.close();
    });

    $("#nativeShare")?.addEventListener("click", () => {
      navigator
        .share({ title: document.title, url: pageUrl })
        .then(() => track("share", { id: "native", label: "Системне меню" }))
        .catch(() => {});
    });

    $("#qrDownload").addEventListener("click", () => {
      $("#qr canvas").toBlob((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${(site.name || "qr").toLowerCase().replace(/\s+/g, "-")}-qr.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }, "image/png");
    });
  }

  /* ================= Банер cookies ================= */

  function renderConsent(showPrefs) {
    const box = $("#consent");
    const row = (name, title, tools) =>
      tools.length
        ? `<label class="switch-row"><span><b>${title}</b><small>${tools.join(", ")}</small></span><input class="switch" type="checkbox" name="${name}"${granted(name) ? " checked" : ""}></label>`
        : "";

    box.innerHTML = `
      <div class="consent__head">${icon("cookie")}<b>Cookies на сайті</b></div>
      <p class="consent__text">Ми використовуємо cookies, щоб розуміти, що корисно відвідувачам, і показувати рекламу клубу тим, кому вона цікава. Змінити вибір можна будь-коли внизу сторінки.</p>
      <div class="consent__prefs"${showPrefs ? "" : " hidden"}>
        <label class="switch-row"><span><b>Необхідні</b><small>Потрібні для роботи сайту</small></span><input class="switch" type="checkbox" checked disabled></label>
        ${row("analytics", "Аналітика", ANALYTICS_TOOLS)}
        ${row("marketing", "Реклама", MARKETING_TOOLS)}
      </div>
      <div class="consent__actions">
        <button class="btn btn--primary" type="button" data-consent="all">Прийняти все</button>
        <button class="btn btn--ghost" type="button" data-consent="necessary">Лише необхідні</button>
        <button class="btn btn--text" type="button" data-consent="${showPrefs ? "save" : "prefs"}">${showPrefs ? "Зберегти вибір" : "Налаштувати"}</button>
      </div>`;
    box.hidden = false;
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

    $("#cookieSettings")?.addEventListener("click", () => renderConsent(true));
    if (!consent) renderConsent(false);
  }

  /* ================= Структуровані дані для Google ================= */

  function injectJsonLd() {
    const abs = (path) => {
      try {
        return new URL(path, pageUrl).href;
      } catch {
        return path;
      }
    };
    const data = {
      "@context": "https://schema.org",
      "@type": "EntertainmentBusiness",
      name: site.name,
      description: site.description,
      url: pageUrl,
      image: abs(site.logo || "assets/logo.svg"),
      telephone: contacts.phone || undefined,
      address: contacts.address ? { "@type": "PostalAddress", streetAddress: contacts.address } : undefined,
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
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
  }

  /* ================= Запуск ================= */

  initAnalytics();
  render();
  renderStatus();
  setInterval(renderStatus, 60 * 1000);
  initCarousel();
  initMap();
  initShare();
  initConsent();
  injectJsonLd();

  document.addEventListener("click", onTrackedClick);
  document.addEventListener("auxclick", onTrackedClick);
  document.addEventListener("click", onCopyClick);
})();
