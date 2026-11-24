/* VADE TV Kiosk — жива карта залу 60% + промо-банери 16:9 і QR-картки 40% */
(() => {
  "use strict";

  const C = window.VADE_CONFIG || {};
  const M = window.VADE_CLUB_MAP;
  const QR = window.VADE_QR;
  if (!M) {
    console.error("VADE TV: не завантажився club-map.js");
    return;
  }

  const site = C.site || {};
  const AV = C.availability || {};
  const U = C.ui || {};
  const LANGS = (C.languages?.list || []).filter((l) => l && l.code);
  const CODES = LANGS.map((l) => l.code);
  const DEFAULT_LANG = CODES.includes(C.languages?.default) ? C.languages.default : "pl";
  const LANG_ALIASES = { ua: "uk" };

  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (ch) => ESC[ch]);
  const isDict = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const SAFE_DATA_IMAGE_RE = /^data:image\/(?:webp|jpeg|jpg|png|svg\+xml);base64,[A-Za-z0-9+/=]+$/i;
  const SAFE_LOCAL_ASSET_RE = /^\/tv-assets\/[a-f0-9]{16}\.(?:webp|jpg|jpeg|png|svg)$/i;
  const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

  function normalizeLangCode(raw) {
    if (typeof raw !== "string" || !raw.trim()) return null;
    const base = raw.trim().toLowerCase().split(/[-_]/)[0];
    const code = LANG_ALIASES[base] || base;
    return CODES.includes(code) ? code : null;
  }

  const urlForcedLang = normalizeLangCode(new URLSearchParams(location.search).get("lang"));
  let lang = urlForcedLang || DEFAULT_LANG;
  const getLangInfo = () => LANGS.find((l) => l.code === lang) || { code: lang, locale: "pl-PL" };

  function tr(value) {
    if (!isDict(value)) return value ?? "";
    return value[lang] ?? value[DEFAULT_LANG] ?? Object.values(value).find((v) => v != null) ?? "";
  }

  const fill = (text, vars) => String(text ?? "").replace(/\{(\w+)\}/g, (m, k) => String(vars?.[k] ?? m));
  const lookup = (path) => path.split(".").reduce((node, key) => (node == null ? undefined : node[key]), U);
  const ui = (path, vars) => fill(tr(lookup(path) ?? path), vars);
  const t = (val, vars) => fill(tr(val), vars);

  function zoneTitle(zone) {
    if (!zone) return "";
    const key = zone.trim().toLowerCase();
    const match = (C.zones || []).find((z) => [tr(z.name), z.id].some((v) => v && String(v).trim().toLowerCase() === key));
    return match ? t(match.name) : zone;
  }

  // Тема з config.js
  const theme = C.theme || {};
  const rootStyle = document.documentElement.style;
  if (theme.accent) rootStyle.setProperty("--accent", theme.accent);
  if (theme.accentDeep) rootStyle.setProperty("--accent-deep", theme.accentDeep);
  if (theme.accent2) rootStyle.setProperty("--accent-2", theme.accent2);

  const rootEl = document.getElementById("tvRoot");
  const logoEl = document.getElementById("tvLogo");
  const brandEl = document.getElementById("tvBrand");
  const titleEl = document.getElementById("tvTitle");
  const zonesEl = document.getElementById("tvZones");
  const mapEl = document.getElementById("tvMap");
  const legendEl = document.getElementById("tvLegend");
  const clockEl = document.getElementById("tvClock");
  const reconnectEl = document.getElementById("tvReconnect");
  const reconnectTextEl = document.getElementById("tvReconnectText");
  const updatedEl = document.getElementById("tvUpdated");
  const rightEl = document.getElementById("tvRight");
  const bannersEl = document.getElementById("tvBanners");
  const qrRowEl = document.getElementById("tvQrRow");

  let mapLabels = {};
  let lastData = null;

  function applyStaticLocaleTexts() {
    document.documentElement.lang = lang;
    if (logoEl && site.logo) logoEl.src = site.logo;
    if (brandEl) brandEl.textContent = site.name || "VADE";
    if (titleEl) titleEl.textContent = ui("availability.tv.title");
    if (reconnectTextEl) reconnectTextEl.textContent = ui("availability.tv.reconnecting");
    document.title = `${site.fullName || site.name || "VADE"} — ${ui("availability.tv.title")}`;

    if (legendEl) {
      legendEl.innerHTML = [
        { cls: "free", label: ui("availability.state.free") },
        { cls: "busy", label: ui("availability.state.busy") },
        { cls: "maint", label: ui("availability.state.maintenance") },
        { cls: "off", label: ui("availability.state.offline") },
      ]
        .map((item) => `<span class="tv-key tv-key--${item.cls}"><i aria-hidden="true"></i><span>${esc(item.label)}</span></span>`)
        .join("");
    }

    mapLabels = {
      entrance: ui("availability.map.entrance"),
      admin: ui("availability.map.admin"),
      wc: ui("availability.map.wc"),
      regular: ui("availability.map.regular"),
      stream: ui("availability.map.stream"),
      mapAria: ui("availability.map.label"),
    };
  }

  function formatClubTime(date) {
    const info = getLangInfo();
    try {
      return new Intl.DateTimeFormat(info.locale || lang, {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone: site.timeZone || "Europe/Warsaw",
      }).format(date);
    } catch {
      return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    }
  }

  function clubHourMinute() {
    try {
      const parts = new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone: site.timeZone || "Europe/Warsaw",
      }).formatToParts(new Date());
      return {
        hour: Number(parts.find((p) => p.type === "hour")?.value),
        minute: Number(parts.find((p) => p.type === "minute")?.value),
      };
    } catch {
      const d = new Date();
      return { hour: d.getHours(), minute: d.getMinutes() };
    }
  }

  function updateClock() {
    if (clockEl) clockEl.textContent = formatClubTime(new Date());
  }

  function renderZones(data) {
    if (!zonesEl) return;
    if (!data || !Array.isArray(data.pcs) || !data.pcs.length) {
      zonesEl.innerHTML = [
        { key: "Standard", total: 20, stream: false },
        { key: "Streamer", total: 2, stream: true },
      ]
        .map((z) => `<span class="tv-zpill${z.stream ? " tv-zpill--stream" : ""}"><b>${esc(zoneTitle(z.key))}:</b> <span>—/${z.total}</span></span>`)
        .join("");
      return;
    }

    const groups = [];
    data.pcs.forEach((raw) => {
      const state = M.normState(raw.state);
      const key = raw.zone || "";
      let group = groups.find((g) => g.key === key);
      if (!group) groups.push((group = { key, free: 0, total: 0 }));
      group.total += 1;
      if (state === "free") group.free += 1;
    });

    zonesEl.innerHTML = groups
      .map((g) => {
        const isStream = /stream/i.test(g.key);
        return `<span class="tv-zpill${isStream ? " tv-zpill--stream" : ""}${g.free > 0 ? " is-avail" : ""}"><b>${esc(zoneTitle(g.key) || ui("availability.otherZone"))}:</b> <span>${esc(g.free)}/${esc(g.total)}</span></span>`;
      })
      .join("");
  }

  function renderMap(data) {
    if (!mapEl) return;
    const byNum = data ? M.indexPcs(data.pcs) : new Map();
    mapEl.innerHTML = M.renderSvg(byNum, {
      interactive: false,
      svgClass: "tv-map__svg",
      labels: mapLabels,
    });
  }

  function renderUpdated(data) {
    if (!updatedEl) return;
    if (!data || !data.updated) {
      updatedEl.textContent = ui("availability.tv.loading");
      return;
    }
    updatedEl.textContent = ui("availability.updated", { time: formatClubTime(new Date(data.updated * 1000)) });
  }

  function renderLeftAll(data) {
    renderZones(data);
    renderMap(data);
    renderUpdated(data);
  }

  // ---------- Права панель: промо-банери 16:9 + ряд QR-карток ----------
  let lastConfigSig = "";
  let slideTimer = null;
  let activeSlides = [];
  let activeDefaultSec = 8;
  let currentSlideIdx = 0;

  function safeImgSrc(src) {
    if (typeof src !== "string") return "";
    const trimmed = src.trim();
    return SAFE_DATA_IMAGE_RE.test(trimmed) || SAFE_LOCAL_ASSET_RE.test(trimmed) ? trimmed : "";
  }

  function showSlideAt(idx) {
    if (slideTimer) {
      clearTimeout(slideTimer);
      slideTimer = null;
    }
    if (!bannersEl || !activeSlides.length) return;
    currentSlideIdx = ((idx % activeSlides.length) + activeSlides.length) % activeSlides.length;

    const slideNodes = bannersEl.querySelectorAll(".tv-slide");
    slideNodes.forEach((el, i) => el.classList.toggle("is-active", i === currentSlideIdx));
    const dotNodes = bannersEl.querySelectorAll(".tv-slide__dot");
    dotNodes.forEach((el, i) => el.classList.toggle("is-active", i === currentSlideIdx));

    const current = activeSlides[currentSlideIdx];
    const sec = Math.min(30, Math.max(5, Number(current?.durationSec) || activeDefaultSec));
    const bar = bannersEl.querySelector(".tv-slide__bar");
    if (bar) {
      bar.style.transition = "none";
      bar.style.width = "0%";
      void bar.offsetWidth;
      if (activeSlides.length > 1) {
        bar.style.transition = `width ${sec}s linear`;
        bar.style.width = "100%";
      } else {
        bar.style.width = "100%";
      }
    }
    if (activeSlides.length > 1) {
      slideTimer = setTimeout(() => showSlideAt(currentSlideIdx + 1), sec * 1000);
    }
  }

  function renderTvRight(cfg) {
    if (!rootEl || !rightEl || !bannersEl || !qrRowEl) return;
    if (slideTimer) {
      clearTimeout(slideTimer);
      slideTimer = null;
    }

    const slides = (Array.isArray(cfg?.slides) ? cfg.slides : []).filter((s) => s && s.enabled && safeImgSrc(s.imageDataUrl));
    const cards = (Array.isArray(cfg?.qrCards) ? cfg.qrCards : []).filter((c) => c && c.enabled).slice(0, 4);

    if (!slides.length && !cards.length) {
      rightEl.hidden = true;
      rootEl.classList.add("tv--map-only");
      bannersEl.innerHTML = "";
      qrRowEl.innerHTML = "";
      return;
    }

    rootEl.classList.remove("tv--map-only");
    rightEl.hidden = false;

    activeSlides = slides;
    activeDefaultSec = Math.min(30, Math.max(5, Number(cfg?.defaultSlideDurationSec) || 8));

    if (slides.length) {
      const slidesHtml = slides
        .map((s, i) => {
          const imgSrc = safeImgSrc(s.imageDataUrl);
          const withText = s.mode === "with_text" && (s.title || s.subtitle);
          return `
            <div class="tv-slide${i === 0 ? " is-active" : ""}">
              <img class="tv-slide__img" src="${esc(imgSrc)}" alt="${esc(s.title || "VADE")}">
              ${
                withText
                  ? `<div class="tv-slide__scrim">
                      ${s.title ? `<h2 class="tv-slide__title">${esc(s.title)}</h2>` : ""}
                      ${s.subtitle ? `<p class="tv-slide__sub">${esc(s.subtitle)}</p>` : ""}
                    </div>`
                  : ""
              }
            </div>`;
        })
        .join("");

      const dotsHtml =
        slides.length > 1
          ? `<div class="tv-slide__dots">${slides.map((_, i) => `<span class="tv-slide__dot${i === 0 ? " is-active" : ""}"></span>`).join("")}</div>`
          : "";

      bannersEl.innerHTML = `${slidesHtml}${dotsHtml}<div class="tv-slide__bar-track"><div class="tv-slide__bar"></div></div>`;
      showSlideAt(0);
    } else {
      bannersEl.innerHTML = `
        <div class="tv-promo-fallback">
          <img src="${esc(site.logo || "assets/logo.svg")}" alt="">
          <div class="tv-promo-fallback__name">${esc(site.name || "VADE")}</div>
          <div class="tv-promo-fallback__tag">${esc(t(site.tagline))}</div>
        </div>`;
    }

    if (cards.length) {
      qrRowEl.hidden = false;
      qrRowEl.style.setProperty("--qr-cols", String(cards.length));
      qrRowEl.innerHTML = cards
        .map((card) => {
          const bgImg = card.bgType === "image" ? safeImgSrc(card.bgImageDataUrl) : "";
          const bgColor = HEX_COLOR_RE.test(String(card.bgColor || "").trim()) ? card.bgColor.trim() : "#161b26";
          const cardStyle = bgImg
            ? `background-image:url('${esc(bgImg)}');background-color:${esc(bgColor)}`
            : `background:${esc(bgColor)}`;

          let qrSrc = "";
          if (card.qrSource === "upload") {
            qrSrc = safeImgSrc(card.qrImageDataUrl);
          } else if (card.qrText && QR) {
            try {
              qrSrc = QR.toDataUrl(String(card.qrText));
            } catch {
              qrSrc = "";
            }
          }

          return `
            <div class="tv-qr-card${bgImg ? " tv-qr-card--has-bg" : ""}" style="${cardStyle}">
              <div class="tv-qr-card__box">
                ${qrSrc ? `<img src="${esc(qrSrc)}" alt="${esc(card.label || "QR")}">` : ""}
              </div>
              <div class="tv-qr-card__text">
                <div class="tv-qr-card__label">${esc(card.label || "")}</div>
                ${card.sublabel ? `<div class="tv-qr-card__sub">${esc(card.sublabel)}</div>` : ""}
              </div>
            </div>`;
        })
        .join("");
    } else {
      qrRowEl.hidden = true;
      qrRowEl.innerHTML = "";
    }
  }

  function applyTvConfig(cfg) {
    if (!cfg || typeof cfg !== "object") return;
    if (!urlForcedLang && cfg.lang) {
      const nextLang = normalizeLangCode(cfg.lang);
      if (nextLang && nextLang !== lang) {
        lang = nextLang;
        applyStaticLocaleTexts();
        updateClock();
        renderLeftAll(lastData);
      }
    }
    const sig = JSON.stringify({
      updatedAt: cfg.updatedAt,
      lang: cfg.lang,
      dur: cfg.defaultSlideDurationSec,
      slides: (cfg.slides || []).map((s) => `${s.id}:${s.enabled}:${s.mode}:${s.title}:${s.subtitle}:${s.durationSec}:${(s.imageDataUrl || "").length}`),
      cards: (cfg.qrCards || []).map((c) => `${c.id}:${c.enabled}:${c.label}:${c.sublabel}:${c.qrSource}:${c.qrText}:${c.bgType}:${c.bgColor}:${(c.qrImageDataUrl || "").length}:${(c.bgImageDataUrl || "").length}`),
    });
    if (sig === lastConfigSig) return;
    lastConfigSig = sig;
    renderTvRight(cfg);
  }

  // Початковий рендер одразу при відкритті
  applyStaticLocaleTexts();
  updateClock();
  renderLeftAll(null);

  const endpoint = AV.endpoint || "/api/status";
  const rawSec = Number(AV.tvRefreshSeconds);
  const pollMs = Math.min(10000, Math.max(5000, (Number.isFinite(rawSec) && rawSec > 0 ? rawSec : 7) * 1000));
  let inflight = false;

  async function pollStatus() {
    if (inflight) return;
    inflight = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(4000, pollMs - 1000));
    try {
      const res = await fetch(endpoint, { cache: "no-store", signal: controller.signal, headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data || !Array.isArray(data.pcs)) throw new Error("bad payload");
      lastData = data;
      if (reconnectEl) reconnectEl.hidden = true;
      renderLeftAll(lastData);
    } catch (err) {
      if (C.debug) console.warn("[VADE TV] /api/status:", err);
      if (reconnectEl) reconnectEl.hidden = false;
    } finally {
      clearTimeout(timer);
      inflight = false;
    }
  }

  async function pollTvConfig() {
    try {
      const res = await fetch("/api/tv-config", { cache: "no-store", headers: { Accept: "application/json" } });
      if (!res.ok) return;
      const cfg = await res.json();
      applyTvConfig(cfg);
    } catch (err) {
      if (C.debug) console.warn("[VADE TV] /api/tv-config:", err);
    }
  }

  pollStatus();
  pollTvConfig();
  setInterval(pollStatus, pollMs);
  setInterval(pollTvConfig, 60000);
  setInterval(updateClock, 5000);

  // Щоденне тихе перезавантаження о 06:00 за часом клубу
  const bootMs = Date.now();
  setInterval(() => {
    if (Date.now() - bootMs < 120000) return;
    const { hour, minute } = clubHourMinute();
    if (hour === 6 && minute === 0) location.reload();
  }, 20000);

  // Wake Lock API
  let wakeLock = null;
  async function acquireWakeLock() {
    if (!("wakeLock" in navigator) || document.hidden || wakeLock) return;
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {
        wakeLock = null;
      });
    } catch {
      wakeLock = null;
    }
  }

  acquireWakeLock();
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      acquireWakeLock();
      pollStatus();
      pollTvConfig();
    }
  });
})();
