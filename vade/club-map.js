/* VADE — спільний рендер інтерактивної 2D-карти залу (SVG на сітці 16×10).
   Використовується на головній сторінці (app.js) та на TV-екрані клубу (tv.js),
   щоб геометрія приміщення, стіни та позиції всіх 29 ПК завжди збігалися. */
(() => {
  "use strict";

  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ESC[ch]);

  const CELL = 60;
  const cx = (gx) => gx * CELL + 30;
  const cy = (gy) => gy * CELL + 46;
  const VIEW_BOX = "22 0 904 636";
  const FLOOR_PATH = "M 300 8 H 614 V 182 H 914 V 510 H 614 V 626 H 34 V 200 H 300 Z";

  const SLOTS = [
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
  const ZONES = [
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

  function normState(state) {
    const s = String(state || "").toLowerCase();
    if (s === "occupied") return "busy";
    if (s === "free" || s === "busy" || s === "maintenance" || s === "offline") return s;
    return "offline";
  }

  function extractNum(pc) {
    if (!pc) return null;
    if (Number.isInteger(pc.pos) && pc.pos > 0) return pc.pos;
    const m = String(pc.id || "").match(/(\d+)$/) || String(pc.name || "").match(/(\d+)/);
    return m ? Number(m[1]) : null;
  }

  function indexPcs(pcs) {
    const map = new Map();
    if (!Array.isArray(pcs)) return map;
    pcs.forEach((pc) => {
      const n = extractNum(pc);
      if (n != null && !map.has(n)) map.set(n, { ...pc, num: n, state: normState(pc.state) });
    });
    return map;
  }

  function renderSvg(byNum, opts = {}) {
    const map = byNum instanceof Map ? byNum : new Map();
    const interactive = opts.interactive !== false;
    const selectedNum = opts.selectedNum ?? null;
    const svgClass = opts.svgClass || "club-map__svg";
    const labels = opts.labels || {};
    const formatAria = typeof opts.formatAria === "function" ? opts.formatAria : null;

    const entranceLabel = labels.entrance || "Entrance";
    const adminLabel = labels.admin || "Admin";
    const wcLabel = labels.wc || "WC";
    const regularLabel = labels.regular || "Regular";
    const streamLabel = labels.stream || "Stream";
    const mapAria = labels.mapAria || "VADE hall map";

    // Тонкі рамки зон із маленьким підписом Regular / Stream прямо на верхній лінії рамки
    const zoneFrames = ZONES.map((z) => {
      const x = cx(z.x0) - 29;
      const y = cy(z.y0) - 26;
      const w = (z.x1 - z.x0) * CELL + 58;
      const h = (z.y1 - z.y0) * CELL + 52;
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
    const stations = SLOTS.map((slot) => {
      const x = cx(slot.gx);
      const y = cy(slot.gy);
      const pc = map.get(slot.num);
      if (!pc) {
        return `
          <g class="map-pc-inactive" transform="translate(${x}, ${y})" aria-hidden="true">
            <rect class="map-pc-inactive__screen" x="-22" y="-17" width="44" height="26" rx="5"/>
            <text class="map-pc-inactive__num" x="0" y="-4" text-anchor="middle" dominant-baseline="central">${slot.num}</text>
            <rect class="map-pc-inactive__neck" x="-4" y="9" width="8" height="3.5" rx="1"/>
            <rect class="map-pc-inactive__led" x="-13" y="13.5" width="26" height="3.2" rx="1.6"/>
          </g>`;
      }
      const state = normState(pc.state);
      const isSelected = interactive && selectedNum === slot.num && state === "free";
      const cls = `map-pc map-pc--${state}${slot.stream ? " map-pc--stream" : ""}${isSelected ? " is-selected" : ""}`;
      if (!interactive) {
        return `
          <g class="${cls}" data-pc-num="${slot.num}" transform="translate(${x}, ${y})">
            <rect class="map-pc__screen" x="-22" y="-17" width="44" height="26" rx="5"/>
            <line class="map-pc__glint" x1="-16" y1="-13" x2="16" y2="-13"/>
            <text class="map-pc__num" x="0" y="-3.5" text-anchor="middle" dominant-baseline="central">${slot.num}</text>
            <rect class="map-pc__neck" x="-4" y="9" width="8" height="3.5" rx="1"/>
            <rect class="map-pc__led" x="-14" y="13.5" width="28" height="3.5" rx="1.75"/>
          </g>`;
      }
      const aria = formatAria ? formatAria(pc, slot, state) : `PC #${slot.num} · ${state}`;
      return `
        <g class="${cls}" data-pc-num="${slot.num}" transform="translate(${x}, ${y})" tabindex="0" role="button" aria-label="${esc(aria)}"${state === "free" ? ` aria-pressed="${isSelected}"` : ""}>
          <rect class="map-pc__hit" x="-27" y="-23" width="54" height="46" rx="7"/>
          <rect class="map-pc__ring" x="-25" y="-20" width="50" height="41" rx="7.5"/>
          <rect class="map-pc__screen" x="-22" y="-17" width="44" height="26" rx="5"/>
          <line class="map-pc__glint" x1="-16" y1="-13" x2="16" y2="-13"/>
          <text class="map-pc__num" x="0" y="-3.5" text-anchor="middle" dominant-baseline="central">${slot.num}</text>
          <rect class="map-pc__neck" x="-4" y="9" width="8" height="3.5" rx="1"/>
          <rect class="map-pc__led" x="-14" y="13.5" width="28" height="3.5" rx="1.75"/>
        </g>`;
    }).join("");

    return `
      <svg class="${esc(svgClass)}" viewBox="${VIEW_BOX}"${!interactive ? ' preserveAspectRatio="xMidYMid meet"' : ""} role="img" aria-label="${esc(mapAria)}">
        <defs>
          <clipPath id="vadeClubInterior">
            <path d="${FLOOR_PATH}"/>
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
          <!-- Центральна стіна за 1–5 і 18 (прохід у праве крило відкритий під 18 і над 19) -->
          <path class="map-wall" d="M 614 8 V 452"/>
          <!-- Праве крило: верх (21–22, 25), права (25–29), нижній коридор і стіна за 19 -->
          <path class="map-wall" d="M 614 182 H 914 V 510 H 614 V 626"/>
          <!-- Суцільна перегородка між 20–24 та 25–29 і горизонтальна стіна під 24–23 із входом зліва -->
          <path class="map-wall" d="M 810 182 V 452 H 668"/>
          <!-- Перегородка над рядом 6–9 (відокремлює зону адміна) -->
          <path class="map-wall" d="M 34 410 H 308"/>
          <!-- Спільна вертикальна стіна WC та кабінки 18 (без нижньої стіни під 18) -->
          <path class="map-wall map-wall--inner" d="M 408 328 V 304 H 524 V 444"/>
          <!-- Ліва стіна WC із проходом, горизонтальна стіна над 10–11 і перемичка між 5 та 18 -->
          <path class="map-wall map-wall--inner" d="M 408 372 V 410 M 360 410 H 524 M 524 352 H 614"/>
          <!-- Ліва перегородка стрім-кабінки 19 (9,9) — вхід відкритий зверху -->
          <path class="map-wall map-wall--inner" d="M 524 542 V 626"/>
        </g>

        <!-- Орієнтир: Вхід (1, 3) — компактна неонова стрілка вниз -->
        <g class="map-landmark map-landmark--entrance" transform="translate(${cx(1)}, ${cy(3)})">
          <line x1="-22" y1="-26" x2="22" y2="-26" class="map-entrance-glow"/>
          <path d="M 0 -17 V 7 M -8 -1 L 0 7 L 8 -1" class="map-entrance-arrow"/>
          <text x="0" y="23" text-anchor="middle" class="map-landmark__label map-landmark__label--accent">${esc(entranceLabel)}</text>
        </g>

        <!-- Орієнтир: Адмін / рецепція + вогнегасник (1.5, 5) — компактні іконки без великої рамки -->
        <g class="map-landmark map-landmark--admin" transform="translate(${cx(1.5)}, ${cy(5)})">
          <g transform="translate(-14, -4)" class="map-landmark__ico">
            <circle cx="0" cy="-9" r="4"/>
            <path d="M -8 2 A 8 7 0 0 1 8 2"/>
            <path d="M -12 4 H 12 M -9 4 V 10 M 9 4 V 10"/>
          </g>
          <text x="-14" y="22" text-anchor="middle" class="map-landmark__label">${esc(adminLabel)}</text>
          <g transform="translate(24, -2)" class="map-extinguisher" aria-hidden="true">
            <rect x="-5" y="-5" width="10" height="16" rx="3"/>
            <path d="M 0 -5 V -9 M -3 -9 H 4 M 2 -7 C 7 -7 8 -3 8 1"/>
          </g>
        </g>

        <!-- Орієнтир: WC (7, 5) — мінімалістична іконка чоловік/жінка без важкої рамки -->
        <g class="map-landmark map-landmark--wc" transform="translate(${cx(7)}, ${cy(5)})">
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
      </svg>`;
  }

  window.VADE_CLUB_MAP = {
    CELL,
    VIEW_BOX,
    FLOOR_PATH,
    SLOTS,
    ZONES,
    cx,
    cy,
    normState,
    extractNum,
    indexPcs,
    renderSvg,
  };
})();
