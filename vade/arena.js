/* VADE — 3D-фон «кіберзал»: неонові wireframe-ряди ПК, крісла, лампи на стелі й сітка підлоги.
   Без бібліотек: власна перспективна проєкція на Canvas 2D (~6 КБ замість ~600 КБ Three.js).
   • Камера повільно пливе проходом між рядами; на комп'ютері злегка реагує на курсор.
   • 30 кадрів/с, пауза у фоновій вкладці. «Менше руху» в системі, режим економії трафіку
     або слабкий пристрій — один статичний кадр без анімації.
   • Кольори беруться з config.js → theme (accent — бірюза, accent2 — маджента).
   • Вимкнути фон: config.js → theme.scene: false. */
(() => {
  "use strict";

  const C = window.VADE_CONFIG || {};
  const host = document.querySelector(".bg");
  if ((C.theme || {}).scene === false || !host) return;

  const canvas = document.createElement("canvas");
  canvas.className = "bg__scene";
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  host.prepend(canvas);

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const saveData = Boolean(navigator.connection && navigator.connection.saveData);
  const weakDevice = (navigator.hardwareConcurrency || 4) <= 2;
  const animate = !reduceMotion && !saveData && !weakDevice;

  /* ---------- Кольори ---------- */

  const css = getComputedStyle(document.documentElement);
  const rgb = (value, fallback) => {
    const hex = String(value || "").trim().replace("#", "");
    const full = hex.length === 3 ? hex.replace(/./g, "$&$&") : hex;
    if (!/^[0-9a-f]{6}$/i.test(full)) return fallback;
    const n = parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const MINT = rgb(css.getPropertyValue("--accent"), [46, 242, 196]);
  const MINT_DEEP = rgb(css.getPropertyValue("--accent-deep"), [10, 158, 134]);
  const MAGENTA = rgb(css.getPropertyValue("--accent-2"), [224, 64, 251]);
  const BG = rgb(css.getPropertyValue("--bg"), [10, 11, 13]);
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;

  /* ---------- Сцена (одиниці — метри) ---------- */

  const ROW = 2.6; // відстань між рядами столів
  const EYE = 1.5; // висота камери
  const CEIL = 3.3; // висота стелі
  const NEAR = 0.35;
  const STATIONS = [1.7, 3.0, 4.3]; // відстань ПК від центру проходу
  const SPEED = 0.32; // м/с

  // Стабільний «випадковий» вибір для ряду: той самий ряд завжди має ті самі кольори екранів
  const hash = (a, b, c) => {
    let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  let w = 0;
  let h = 0;
  let dpr = 1;
  let f = 1; // фокусна відстань у пікселях
  let cx = 0;
  let cy = 0; // лінія горизонту
  let far = 26;
  let camX = 0;
  let camY = EYE;
  let camZ = 0;
  let targetX = 0;
  let targetY = EYE;

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, w < 700 ? 1.5 : 1.25);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    f = Math.max(w * 0.5, h * 0.62);
    cx = w / 2;
    cy = h * 0.42;
    far = w < 700 ? 20 : 26;
  }

  // Світ → екран. null — точка за камерою
  function project(x, y, z) {
    const dz = z - camZ;
    if (dz < NEAR) return null;
    return [cx + (f * (x - camX)) / dz, cy - (f * (y - camY)) / dz];
  }

  // Відрізок з обрізанням по ближній площині
  function line(x1, y1, z1, x2, y2, z2) {
    let a = z1 - camZ;
    let b = z2 - camZ;
    if (a < NEAR && b < NEAR) return;
    if (a < NEAR || b < NEAR) {
      const t = (NEAR - a) / (b - a);
      const nx = x1 + (x2 - x1) * t;
      const ny = y1 + (y2 - y1) * t;
      const nz = z1 + (z2 - z1) * t;
      if (a < NEAR) [x1, y1, z1] = [nx, ny, nz];
      else [x2, y2, z2] = [nx, ny, nz];
    }
    const p = project(x1, y1, z1);
    const q = project(x2, y2, z2);
    if (!p || !q) return;
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(q[0], q[1]);
  }

  // Вертикальний прямокутник, повернутий до камери (екран, спинка крісла)
  function quadPath(x1, y1, x2, y2, z) {
    const p = project(x1, y2, z);
    const q = project(x2, y1, z);
    if (!p || !q) return null;
    ctx.beginPath();
    ctx.rect(Math.min(p[0], q[0]), p[1], Math.abs(q[0] - p[0]), q[1] - p[1]);
    return [p, q];
  }

  // Горизонтальний прямокутник (стільниця, сидіння, клавіатура)
  function flat(x1, x2, y, z1, z2) {
    line(x1, y, z1, x2, y, z1);
    line(x2, y, z1, x2, y, z2);
    line(x2, y, z2, x1, y, z2);
    line(x1, y, z2, x1, y, z1);
  }

  // Прозорість за відстанню: удалині зал тоне в темряві, а зовсім близькі до камери
  // крісла й столи плавно зникають, щоб не перекривали екран величезними плитами
  const fog = (z) => {
    const dz = z - camZ;
    const near = Math.min(1, Math.max(0, (dz - 1.2) / 2.2));
    return near * Math.max(0, 1 - dz / far) ** 1.4;
  };

  /* ---------- Малювання ---------- */

  function drawGlow() {
    // Світло в глибині залу й неонові відблиски з боків
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.6);
    g.addColorStop(0, rgba(MINT, 0.16));
    g.addColorStop(0.45, rgba(MINT_DEEP, 0.05));
    g.addColorStop(1, rgba(MINT_DEEP, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const m = ctx.createRadialGradient(w * 0.92, h * 0.12, 0, w * 0.92, h * 0.12, Math.max(w, h) * 0.45);
    m.addColorStop(0, rgba(MAGENTA, 0.12));
    m.addColorStop(1, rgba(MAGENTA, 0));
    ctx.fillStyle = m;
    ctx.fillRect(0, 0, w, h);
  }

  function drawFloor() {
    ctx.lineWidth = 1;
    // Поздовжні лінії — у бік горизонту
    for (let x = -6; x <= 6; x += 1) {
      ctx.beginPath();
      line(x, 0, camZ + NEAR, x, 0, camZ + far);
      ctx.strokeStyle = rgba(MINT, x === 0 ? 0.0 : 0.09);
      ctx.stroke();
    }
    // Поперечні лінії — пливуть разом з камерою
    const step = 1.3;
    for (let z = Math.ceil(camZ / step) * step; z < camZ + far; z += step) {
      ctx.beginPath();
      line(-6, 0, z, 6, 0, z);
      ctx.strokeStyle = rgba(MINT, 0.1 * Math.max(0, 1 - (z - camZ) / far));
      ctx.stroke();
    }
    // Підсвічений прохід посередині
    ctx.beginPath();
    line(-0.6, 0.002, camZ + NEAR, -0.6, 0.002, camZ + far);
    line(0.6, 0.002, camZ + NEAR, 0.6, 0.002, camZ + far);
    ctx.strokeStyle = rgba(MINT, 0.28);
    ctx.stroke();
  }

  function drawCeiling(k) {
    const z = k * ROW + ROW * 0.5;
    const a = fog(z);
    if (a <= 0.01) return;
    const magenta = k % 5 === 0;
    const c = magenta ? MAGENTA : MINT;
    // Дві неонові лампи над рядами
    for (const s of [-1, 1]) {
      ctx.beginPath();
      line(s * 1.4, CEIL, z - 0.7, s * 1.4, CEIL, z + 0.7);
      ctx.lineWidth = 3;
      ctx.strokeStyle = rgba(c, 0.18 * a);
      ctx.stroke();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = rgba(c, 0.75 * a);
      ctx.stroke();
    }
  }

  function drawRow(k) {
    const z0 = k * ROW; // передній край столу
    const a = fog(z0 + 0.4);
    if (a <= 0.01) return;

    for (const s of [-1, 1]) {
      // Стіл на весь ряд
      const xa = s * 1.1;
      const xb = s * 5.2;
      ctx.beginPath();
      flat(xa, xb, 0.75, z0, z0 + 0.8);
      line(xa, 0.75, z0, xa, 0, z0);
      line(xb, 0.75, z0, xb, 0, z0);
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(MINT, 0.45 * a);
      ctx.stroke();

      STATIONS.forEach((dx, i) => {
        const x = s * dx;
        const r = hash(k, s, i);
        const screen = r < 0.18 ? MAGENTA : MINT;
        const on = r < 0.85;
        const sz = z0 + 0.62;

        // Монітор: світний екран + рамка + ніжка
        const rect = quadPath(x - 0.34, 0.9, x + 0.34, 1.28, sz);
        if (rect) {
          const [p, q] = rect;
          const g = ctx.createLinearGradient(0, p[1], 0, q[1]);
          g.addColorStop(0, rgba(screen, (on ? 0.38 : 0.08) * a));
          g.addColorStop(1, rgba(screen, (on ? 0.12 : 0.03) * a));
          ctx.fillStyle = g;
          ctx.fill();
          ctx.strokeStyle = rgba(screen, 0.85 * a);
          ctx.lineWidth = 1;
          ctx.stroke();
          // «Інтерфейс гри» на ближніх екранах
          const sw = Math.abs(q[0] - p[0]);
          if (on && sw > 34) {
            const left = Math.min(p[0], q[0]);
            const sh = q[1] - p[1];
            ctx.fillStyle = rgba(screen, 0.5 * a);
            ctx.fillRect(left + sw * 0.08, p[1] + sh * 0.12, sw * 0.35, Math.max(1, sh * 0.05));
            ctx.fillRect(left + sw * 0.08, p[1] + sh * 0.78, sw * 0.6, Math.max(1, sh * 0.05));
            ctx.fillRect(left + sw * 0.82, p[1] + sh * 0.12, sw * 0.1, sw * 0.1);
          }
        }
        ctx.beginPath();
        line(x, 0.9, sz, x, 0.75, sz);
        // Клавіатура
        flat(x - 0.22, x + 0.22, 0.755, z0 + 0.12, z0 + 0.3);
        ctx.strokeStyle = rgba(MINT, 0.5 * a);
        ctx.stroke();

        // Крісло перед столом: темна спинка перекриває все, що за нею, — так видно глибину
        const cz = z0 - 0.5;
        const back = quadPath(x - 0.24, 0.55, x + 0.24, 1.22, cz);
        if (back) {
          ctx.fillStyle = rgba(BG, 0.92 * fog(cz));
          ctx.fill();
          ctx.strokeStyle = rgba(MINT, 0.55 * fog(cz));
          ctx.stroke();
        }
        ctx.beginPath();
        flat(x - 0.25, x + 0.25, 0.5, cz - 0.02, cz + 0.42);
        line(x, 0.5, cz + 0.2, x, 0.08, cz + 0.2);
        line(x - 0.24, 0.08, cz + 0.2, x + 0.24, 0.08, cz + 0.2);
        ctx.strokeStyle = rgba(MINT, 0.4 * fog(cz));
        ctx.stroke();
      });
    }
  }

  function frame() {
    ctx.clearRect(0, 0, w, h);
    drawGlow();
    ctx.lineCap = "round";
    drawFloor();

    const first = Math.floor((camZ - ROW) / ROW);
    const last = Math.ceil((camZ + far) / ROW);
    for (let k = last; k >= first; k--) drawCeiling(k);
    // Від дальніх рядів до ближніх: ближчі крісла перекривають дальні екрани
    ctx.globalCompositeOperation = "source-over";
    for (let k = last; k >= first; k--) drawRow(k);
  }

  /* ---------- Анімація ---------- */

  let raf = 0;
  let prev = 0;
  const FRAME_MS = 1000 / 30;

  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = now - prev;
    if (dt < FRAME_MS - 2) return;
    prev = now;
    const sec = Math.min(dt, 100) / 1000;
    camZ += SPEED * sec;
    camX += (targetX - camX) * Math.min(1, sec * 2);
    camY += (targetY - camY) * Math.min(1, sec * 2);
    frame();
  }

  function start() {
    if (!raf && animate && !document.hidden) {
      prev = performance.now();
      raf = requestAnimationFrame(tick);
    }
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  resize();
  camZ = ROW * 0.3;
  frame();

  window.addEventListener(
    "resize",
    () => {
      resize();
      frame();
    },
    { passive: true }
  );

  if (animate) {
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
    // Легкий паралакс за курсором (лише миша, на телефоні не заважає гортанню)
    window.addEventListener(
      "pointermove",
      (e) => {
        if (e.pointerType !== "mouse") return;
        targetX = (e.clientX / w - 0.5) * 0.7;
        targetY = EYE + (e.clientY / h - 0.5) * -0.25;
      },
      { passive: true }
    );
    start();
  }
})();
