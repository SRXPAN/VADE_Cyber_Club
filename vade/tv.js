/* VADE TV Kiosk — жива карта залу для екрана в клубі (опитування 5–10с, WakeLock, 06:00 reload) */
(() => {
  "use strict";

  const C = window.VADE_CONFIG || {};
  const M = window.VADE_CLUB_MAP;
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

  function resolveLang() {
    const raw = new URLSearchParams(location.search).get("lang");
    if (typeof raw === "string" && raw.trim()) {
      const base = raw.trim().toLowerCase().split(/[-_]/)[0];
      const code = LANG_ALIASES[base] || base;
      if (CODES.includes(code)) return code;
    }
    return DEFAULT_LANG;
  }

  const lang = resolveLang();
  const langInfo = LANGS.find((l) => l.code === lang) || { code: lang, locale: "pl-PL" };
  document.documentElement.lang = lang;

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

  // Початкові підписи інтерфейсу
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

  if (logoEl && site.logo) logoEl.src = site.logo;
  if (brandEl) brandEl.textContent = site.name || "VADE";
  if (titleEl) titleEl.textContent = ui("availability.tv.title");
  if (reconnectTextEl) reconnectTextEl.textContent = ui("availability.tv.reconnecting");
  document.title = `${site.fullName || site.name || "VADE"} — ${ui("availability.tv.title")}`;

  if (legendEl) {
    legendEl.innerHTML = [
      { cls: "free", label: ui("availability.state.free") },
      { cls: "busy", label: ui("availability.state.busy") },
      { cls: "off", label: ui("availability.state.offline") },
    ]
      .map((item) => `<span class="tv-key tv-key--${item.cls}"><i aria-hidden="true"></i><span>${esc(item.label)}</span></span>`)
      .join("");
  }

  const mapLabels = {
    entrance: ui("availability.map.entrance"),
    admin: ui("availability.map.admin"),
    wc: ui("availability.map.wc"),
    regular: ui("availability.map.regular"),
    stream: ui("availability.map.stream"),
    mapAria: ui("availability.map.label"),
  };

  function formatClubTime(date) {
    try {
      return new Intl.DateTimeFormat(langInfo.locale || lang, {
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

  let lastData = null;

  function renderZones(data) {
    if (!zonesEl) return;
    if (!data || !Array.isArray(data.pcs) || !data.pcs.length) {
      zonesEl.innerHTML = [
        { key: "Standard", total: 20, stream: false },
        { key: "Streamer", total: 2, stream: true },
      ]
        .map(
          (z) =>
            `<span class="tv-zpill${z.stream ? " tv-zpill--stream" : ""}"><b>${esc(zoneTitle(z.key))}:</b> <span>—/${z.total}</span></span>`
        )
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

  function renderAll(data) {
    renderZones(data);
    renderMap(data);
    renderUpdated(data);
  }

  // Початковий рендер одразу при відкритті, не чекаючи першого API-відгуку
  updateClock();
  renderAll(null);

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
      renderAll(lastData);
    } catch (err) {
      if (C.debug) console.warn("[VADE TV] /api/status:", err);
      // При обриві мережі карта й останні статуси залишаються на екрані
      if (reconnectEl) reconnectEl.hidden = false;
    } finally {
      clearTimeout(timer);
      inflight = false;
    }
  }

  pollStatus();
  setInterval(pollStatus, pollMs);
  setInterval(updateClock, 5000);

  // Щоденне тихе перезавантаження о 06:00 за часом клубу (проти витоків пам'яті 24/7)
  const bootMs = Date.now();
  setInterval(() => {
    if (Date.now() - bootMs < 120000) return;
    const { hour, minute } = clubHourMinute();
    if (hour === 6 && minute === 0) location.reload();
  }, 20000);

  // Wake Lock API: не даємо екрану телевізора заснути
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
    }
  });
})();
