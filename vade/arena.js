/* VADE — фон «кіберклуб»: чистий ізометричний 3D-інтер'єр із чотирма зонами —
   Standard (PC-зал), Bootcamp 5×5, PS5-лаунж і Streamer-кімната.
   Усе малюється кодом на Canvas: без картинок і бібліотек, різко на будь-якому екрані (враховує щільність пікселів).
   • Світло, тіні та неон — плавні градієнти без зерна й дізерингу. Написи — шрифтом сайту (Unbounded).
   • Живе лише світло: екрани моніторів і телевізорів, RGB-підсвітка столів, «ON AIR», порошинки (≈12 кадрів/с,
     у фоновій вкладці пауза). «Менше руху» в системі, економія трафіку або слабкий пристрій — один нерухомий кадр.
   • Кольори беруться з config.js → theme (accent — бірюза, accent2 — маджента).
   • Вимкнути фон: theme.scene: false. Кадрування: theme.sceneZoom (1 — вся зала; більше — ближче). */
(() => {
  "use strict";

  const CFG = window.VADE_CONFIG || {};
  const THEME = CFG.theme || {};
  const host = document.querySelector(".bg");
  if (THEME.scene === false || !host) return;

  const canvas = document.createElement("canvas");
  canvas.className = "bg__scene";
  const view = canvas.getContext("2d", { alpha: false });
  if (!view) return;
  host.prepend(canvas);

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const saveData = Boolean(navigator.connection && navigator.connection.saveData);
  const weakDevice = (navigator.hardwareConcurrency || 4) <= 2;
  const animate = !reduceMotion && !saveData && !weakDevice;

  /* ================= Кольори ================= */

  const hexc = (s) => {
    const n = parseInt(s.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const rgba = (c, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const shade = (c, f) => [Math.min(255, c[0] * f), Math.min(255, c[1] * f), Math.min(255, c[2] * f)];

  const css = getComputedStyle(document.documentElement);
  const themed = (name, fallback) => {
    const v = css.getPropertyValue(name).trim();
    return hexc(/^#[0-9a-f]{6}$/i.test(v) ? v : fallback);
  };
  const BG = themed("--bg", "#0a0b0d");
  const MINT = themed("--accent", "#2ef2c4");
  const MAG = themed("--accent-2", "#e040fb");
  const WHITE = hexc("#eafffa");
  const INK = hexc("#0f1318");

  const hash = (a, b = 0, c = 0) => {
    let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  // Матеріал із трьох відтінків: верх, ліва грань (+B), права грань (+A) — світло зверху зліва
  const mat = (c) => ({ t: c, l: shade(c, 0.74), r: shade(c, 0.52) });
  const M = {
    desk: mat(hexc("#34414d")),
    deskTop: mat(hexc("#3d4b58")),
    metal: mat(hexc("#5a6975")),
    dark: mat(hexc("#232c35")),
    black: mat(hexc("#161c22")),
    chair: mat(hexc("#2e3944")),
    hood: mat(hexc("#202830")),
    skin: mat(hexc("#56626e")),
    white: mat(hexc("#eef3fc")),
  };

  const FONT = "'Unbounded','Arial Black','Segoe UI',system-ui,sans-serif";

  /* ================= Проєкція ================= */

  // Світ у метрах. A — вправо-вниз, B — вліво-вниз, Z — вгору. Ізометрія: усі три осі мають на екрані однакову довжину S.
  const K = Math.cos(Math.PI / 6);
  const GA = 17; // підлога, м
  const GB = 17;
  const WH = 4; // висота стін
  const SLAB = 0.5; // товщина «острова»
  const DIO_W = (GA + GB) * K;
  const DIO_H = (GA + GB) * 0.5 + WH + SLAB;
  const U = 0.01; // 1 см у метрах: на поверхнях малюємо в сантиметрах

  let g = view; // поточне полотно: base (статика) або основне (кадр анімації)
  let dpr = 1;
  let W = 0;
  let H = 0;
  let S = 40; // пікселів полотна на метр
  let OX = 0;
  let OY = 0;

  const px = (A, B) => OX + (A - B) * K * S;
  const py = (A, B, Z) => OY + (A + B) * 0.5 * S - Z * S;
  const P3 = (A, B, Z) => [px(A, B), py(A, B, Z)];

  // Поверхні: локальні координати в сантиметрах, x вправо, y вниз (текст і малюнки не перевернуті)
  function onFloor(A, B, Z, fn) {
    g.save();
    g.transform(K * S * U, 0.5 * S * U, -K * S * U, 0.5 * S * U, px(A, B), py(A, B, Z));
    fn();
    g.restore();
  }
  // стіна A = const (видно грань +A): x іде до кута (зменшення B); початок — лівий верхній кут
  function onWallA(A, Bleft, Ztop, fn) {
    g.save();
    g.transform(K * S * U, -0.5 * S * U, 0, S * U, px(A, Bleft), py(A, Bleft, Ztop));
    fn();
    g.restore();
  }
  // стіна B = const (видно грань +B): x іде вздовж +A
  function onWallB(Aleft, B, Ztop, fn) {
    g.save();
    g.transform(K * S * U, 0.5 * S * U, 0, S * U, px(Aleft, B), py(Aleft, B, Ztop));
    fn();
    g.restore();
  }
  const onePx = () => 1 / (S * U); // скільки локальних сантиметрів у одному пікселі полотна

  /* ================= Малювання ================= */

  const lg = (x0, y0, x1, y1, stops) => {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    for (const [o, c] of stops) gr.addColorStop(o, c);
    return gr;
  };
  const rg = (x, y, r0, r1, stops) => {
    const gr = g.createRadialGradient(x, y, r0, x, y, r1);
    for (const [o, c] of stops) gr.addColorStop(o, c);
    return gr;
  };

  function trace(pts) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
  }

  // Заливка грані; контур того ж кольору ховає щілини між гранями й злегка заокруглює кути
  function paint(pts, fill, seam) {
    trace(pts);
    g.fillStyle = fill;
    g.fill();
    if (seam) {
      g.strokeStyle = fill;
      g.lineWidth = seam;
      g.lineJoin = "round";
      g.stroke();
    }
  }

  function vfill(pts, c, k, a) {
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of pts) {
      if (p[1] < y0) y0 = p[1];
      if (p[1] > y1) y1 = p[1];
    }
    return lg(0, y0, 0, y1, [[0, rgba(c, a)], [1, rgba(shade(c, k), a)]]);
  }

  // Коробка: m — матеріал; o: rim — світла кромка, glow — її ореол, alpha — прозорість (скло), soft — заокруглення, ao — затемнення низу
  function box(A, B, Z, w, d, h, m, o) {
    o = o || {};
    const a = o.alpha == null ? 1 : o.alpha;
    const zt = Z + h;
    const t0 = P3(A, B, zt);
    const t1 = P3(A + w, B, zt);
    const t2 = P3(A + w, B + d, zt);
    const t3 = P3(A, B + d, zt);
    const b1 = P3(A + w, B, Z);
    const b2 = P3(A + w, B + d, Z);
    const b3 = P3(A, B + d, Z);
    const seam = a < 1 ? 0 : o.soft == null ? Math.max(0.8, S * 0.014) : o.soft;
    const ao = o.ao == null ? 0.7 : o.ao;
    paint([t3, t2, b2, b3], vfill([t3, t2, b2, b3], m.l, ao, a), seam);
    paint([t1, t2, b2, b1], vfill([t1, t2, b2, b1], m.r, ao * 0.95, a), seam);
    paint([t0, t1, t2, t3], lg(t0[0], t0[1], t2[0], t2[1], [[0, rgba(shade(m.t, 1.16), a)], [1, rgba(shade(m.t, 0.9), a)]]), seam);
    if (o.rim) {
      g.save();
      g.lineJoin = "round";
      g.lineCap = "round";
      g.strokeStyle = rgba(o.rim, o.rimA == null ? 0.55 : o.rimA);
      g.lineWidth = Math.max(1, S * 0.02);
      if (o.glow) {
        g.shadowColor = rgba(o.rim, 0.85);
        g.shadowBlur = o.glow * S * 0.06;
      }
      g.beginPath();
      g.moveTo(t3[0], t3[1]);
      g.lineTo(t2[0], t2[1]);
      g.lineTo(t1[0], t1[1]);
      g.stroke();
      g.restore();
    }
  }

  // Вертикальний циліндр
  function cyl(A, B, Z, r, h, c, o) {
    o = o || {};
    const cx = px(A, B);
    const rx = 1.2247 * r * S;
    const ry = 0.7071 * r * S;
    const yb = py(A, B, Z);
    const yt = py(A, B, Z + h);
    g.beginPath();
    g.moveTo(cx - rx, yt);
    g.lineTo(cx - rx, yb);
    g.ellipse(cx, yb, rx, ry, 0, Math.PI, 0, true);
    g.lineTo(cx + rx, yt);
    g.closePath();
    g.fillStyle = lg(cx - rx, 0, cx + rx, 0, [[0, rgba(shade(c, 1.15))], [0.45, rgba(c)], [1, rgba(shade(c, 0.5))]]);
    g.fill();
    g.beginPath();
    g.ellipse(cx, yt, rx, ry, 0, 0, Math.PI * 2);
    g.fillStyle = rgba(shade(c, o.top || 1.2));
    g.fill();
  }

  // Світла пляма на підлозі (коло в ізометрії — еліпс): додається до кольору
  function floorGlow(A, B, r, c, a, z = 0) {
    const cx = px(A, B);
    const cy = py(A, B, z);
    g.save();
    g.globalCompositeOperation = "lighter";
    g.translate(cx, cy);
    g.scale(1.2247 * r * S, 0.7071 * r * S);
    g.fillStyle = rg(0, 0, 0, 1, [[0, rgba(c, a)], [0.45, rgba(c, a * 0.42)], [1, rgba(c, 0)]]);
    g.beginPath();
    g.arc(0, 0, 1, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  // Кругле м'яке світло в просторі екрана (ореоли навколо екранів і вивісок)
  function halo(x, y, rx, ry, c, a) {
    g.save();
    g.globalCompositeOperation = "lighter";
    g.translate(x, y);
    g.scale(rx, ry);
    g.fillStyle = rg(0, 0, 0, 1, [[0, rgba(c, a)], [0.5, rgba(c, a * 0.38)], [1, rgba(c, 0)]]);
    g.beginPath();
    g.arc(0, 0, 1, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  // М'яка тінь багатокутника: сама фігура малюється за межами полотна, видно лише розмиту тінь
  function softShadow(pts, blur, alpha) {
    let maxX = 0;
    for (const p of pts) if (p[0] > maxX) maxX = p[0];
    const off = maxX + blur * 5 + 100; // фігура опиняється повністю лівіше за полотно за будь-якого кадрування
    g.save();
    g.shadowColor = `rgba(0,0,0,${alpha})`;
    g.shadowBlur = blur;
    g.shadowOffsetX = off;
    g.translate(-off, 0);
    trace(pts);
    g.fillStyle = "#000";
    g.fill();
    g.restore();
  }
  const quadAt = (A, B, w, d, z = 0) => [P3(A, B, z), P3(A + w, B, z), P3(A + w, B + d, z), P3(A, B + d, z)];

  // Неонова лінія між двома точками полотна
  function neonLine(p, q, c, width, glowPx) {
    g.save();
    g.lineCap = "round";
    g.shadowColor = rgba(c, 0.9);
    g.shadowBlur = glowPx;
    g.strokeStyle = rgba(c, 0.95);
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(p[0], p[1]);
    g.lineTo(q[0], q[1]);
    g.stroke();
    g.shadowBlur = glowPx * 0.4;
    g.stroke();
    g.shadowBlur = 0;
    g.strokeStyle = rgba(mix(c, WHITE, 0.65), 0.95);
    g.lineWidth = Math.max(0.8, width * 0.4);
    g.stroke();
    g.restore();
  }

  // Неоновий напис на поточній поверхні: x — центр напису, y — базова лінія, size — висота літер (усе в см).
  // Ширина вимірюється, тож шрифт можна змінити, і напис лишиться по центру.
  function neonText(str, x, y, size, c, a = 1) {
    g.save();
    g.font = `800 ${size}px ${FONT}`;
    g.textBaseline = "alphabetic";
    g.textAlign = "center";
    const glow = size * S * U;
    g.fillStyle = rgba(c, a);
    g.shadowColor = rgba(c, 0.95 * a);
    g.shadowBlur = glow * 0.55;
    g.fillText(str, x, y);
    g.shadowBlur = glow * 0.18;
    g.fillText(str, x, y);
    g.shadowBlur = 0;
    g.fillStyle = rgba(mix(c, WHITE, 0.62), a);
    g.fillText(str, x, y);
    g.restore();
  }

  function rrect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  /* ================= Екрани ================= */

  // Малюнок на поточній поверхні, розмір w×h (см). kind: 0 шутер, 1 синтвейв-гонка, 2 мапа, 3 стрім і чат,
  // 4 файтинг, 5 табло, 6 RGB-панель, 7 очікування. t — секунди.
  function art(kind, w, h, t, seed, c1, c2) {
    const hi = mix(c1, WHITE, 0.5);
    const dk = INK;
    const lw = Math.max(onePx() * 1.2, h * 0.012);
    switch (kind) {
      case 0: {
        const hor = h * 0.5;
        g.fillStyle = lg(0, 0, 0, hor, [[0, rgba(mix(dk, c2, 0.2))], [1, rgba(mix(dk, c2, 0.85))]]);
        g.fillRect(0, 0, w, hor);
        const span = w * 1.3;
        for (let i = 0; i < 9; i++) {
          const bw = w * (0.07 + hash(seed, i) * 0.08);
          const bx = ((((i * w * 0.15 + hash(seed, i, 3) * 20 - t * 2.4) % span) + span) % span) - w * 0.15;
          const bh = h * (0.1 + hash(seed, i, 1) * 0.24);
          g.fillStyle = rgba(mix(dk, c2, 0.16 + hash(seed, i, 2) * 0.14));
          g.fillRect(bx, hor - bh, bw, bh);
        }
        g.fillStyle = lg(0, hor, 0, h, [[0, rgba(mix(dk, c1, 0.26))], [1, rgba(mix(dk, c1, 0.05))]]);
        g.fillRect(0, hor, w, h - hor);
        g.strokeStyle = rgba(c1, 0.5);
        g.lineWidth = lw;
        g.beginPath();
        for (let i = -6; i <= 6; i++) {
          g.moveTo(w / 2 + i * w * 0.03, hor);
          g.lineTo(w / 2 + i * w * 0.22, h);
        }
        for (let j = 0; j < 5; j++) {
          const f = ((j + t * 0.7) % 5) / 5;
          const y = hor + (h - hor) * f * f;
          g.moveTo(0, y);
          g.lineTo(w, y);
        }
        g.stroke();
        g.fillStyle = rgba(hi, 0.95);
        g.fillRect(0, hor - lw, w, lw * 2);
        // приціл, смуга здоров'я, набої
        g.strokeStyle = rgba(WHITE, 0.95);
        g.lineWidth = lw * 1.4;
        const cx = w / 2;
        const cy = h * 0.46;
        const cs = h * 0.07;
        g.beginPath();
        g.moveTo(cx - cs * 2, cy);
        g.lineTo(cx - cs * 0.7, cy);
        g.moveTo(cx + cs * 0.7, cy);
        g.lineTo(cx + cs * 2, cy);
        g.moveTo(cx, cy - cs * 2);
        g.lineTo(cx, cy - cs * 0.7);
        g.moveTo(cx, cy + cs * 0.7);
        g.lineTo(cx, cy + cs * 2);
        g.stroke();
        g.fillStyle = rgba(dk, 0.6);
        rrect(w * 0.05, h * 0.86, w * 0.3, h * 0.07, h * 0.035);
        g.fill();
        g.fillStyle = rgba(c1, 0.95);
        rrect(w * 0.05, h * 0.86, w * (0.12 + 0.16 * (0.5 + 0.5 * Math.sin(t * 0.8 + seed))), h * 0.07, h * 0.035);
        g.fill();
        g.fillStyle = rgba(hi, 0.9);
        g.fillRect(w * 0.8, h * 0.86, w * 0.15, h * 0.07);
        return;
      }
      case 1: {
        const hor = h * 0.55;
        g.fillStyle = lg(0, 0, 0, hor, [[0, rgba(mix(dk, c2, 0.3))], [0.7, rgba(mix(dk, c2, 0.9))], [1, rgba(mix(c2, WHITE, 0.25))]]);
        g.fillRect(0, 0, w, hor);
        g.save();
        g.beginPath();
        g.rect(0, 0, w, hor);
        g.clip();
        g.fillStyle = lg(0, hor - h * 0.34, 0, hor, [[0, rgba(mix(c1, WHITE, 0.4))], [1, rgba(c1)]]);
        g.beginPath();
        g.arc(w / 2, hor - h * 0.06, h * 0.26, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = rgba(mix(dk, c2, 0.6));
        for (let i = 1; i < 5; i++) g.fillRect(0, hor - h * 0.05 * i, w, h * 0.012 * i);
        g.restore();
        g.fillStyle = rgba(dk);
        g.fillRect(0, hor, w, h - hor);
        g.strokeStyle = rgba(c1, 0.8);
        g.lineWidth = lw;
        g.beginPath();
        for (let i = -8; i <= 8; i++) {
          g.moveTo(w / 2 + i * w * 0.02, hor);
          g.lineTo(w / 2 + i * w * 0.2, h);
        }
        for (let j = 0; j < 6; j++) {
          const f = ((j + t * 0.9) % 6) / 6;
          const y = hor + (h - hor) * f * f;
          g.moveTo(0, y);
          g.lineTo(w, y);
        }
        g.stroke();
        g.fillStyle = rgba(hi);
        g.fillRect(0, hor - lw, w, lw * 2);
        g.fillStyle = rgba(mix(dk, WHITE, 0.15));
        rrect(w * 0.42, h * 0.8, w * 0.16, h * 0.12, h * 0.03);
        g.fill();
        g.fillStyle = rgba(c2);
        g.fillRect(w * 0.43, h * 0.86, w * 0.14, h * 0.02);
        return;
      }
      case 2: {
        g.fillStyle = rgba(mix(dk, c1, 0.14));
        g.fillRect(0, 0, w, h);
        g.strokeStyle = rgba(c1, 0.22);
        g.lineWidth = lw;
        g.beginPath();
        for (let i = 1; i < 10; i++) {
          g.moveTo(w * i * 0.1, 0);
          g.lineTo(w * i * 0.1, h);
        }
        for (let j = 1; j < 6; j++) {
          g.moveTo(0, h * j * 0.17);
          g.lineTo(w, h * j * 0.17);
        }
        g.stroke();
        g.strokeStyle = rgba(c1, 0.7);
        g.lineWidth = lw * 2;
        g.beginPath();
        g.moveTo(w * 0.05, h * 0.95);
        g.lineTo(w * 0.95, h * 0.05);
        g.stroke();
        for (let i = 0; i < 6; i++) {
          const f = (t * 0.06 + i * 0.17 + seed * 0.1) % 1;
          g.fillStyle = rgba(i % 2 ? c1 : c2, 0.95);
          g.beginPath();
          g.arc(w * (0.1 + f * 0.8), h * (0.9 - f * 0.8) + Math.sin(t + i) * h * 0.03, h * 0.035, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = rgba(dk, 0.75);
        rrect(w * 0.72, h * 0.06, w * 0.24, h * 0.34, h * 0.03);
        g.fill();
        g.strokeStyle = rgba(hi, 0.9);
        g.lineWidth = lw * 1.4;
        g.stroke();
        return;
      }
      case 3: {
        g.fillStyle = rgba(mix(dk, c2, 0.14));
        g.fillRect(0, 0, w, h);
        g.fillStyle = lg(0, 0, w * 0.62, h * 0.7, [[0, rgba(mix(dk, c1, 0.5))], [1, rgba(mix(dk, c2, 0.7))]]);
        rrect(w * 0.04, h * 0.08, w * 0.6, h * 0.62, h * 0.04);
        g.fill();
        g.fillStyle = rgba(WHITE, 0.85);
        g.beginPath();
        g.arc(w * 0.34, h * 0.32, h * 0.1, 0, Math.PI * 2);
        g.fill();
        rrect(w * 0.22, h * 0.45, w * 0.24, h * 0.2, h * 0.05);
        g.fill();
        for (let i = 0; i < 6; i++) {
          const row = i + Math.floor(t * 0.7);
          const y = h * (0.1 + (((i + (t * 0.7) % 1) * 0.15) % 0.9));
          g.fillStyle = rgba(hash(seed, row) < 0.4 ? c1 : c2, 0.9);
          g.beginPath();
          g.arc(w * 0.7, y, h * 0.025, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = rgba(WHITE, 0.55);
          g.fillRect(w * 0.74, y - h * 0.012, w * (0.08 + hash(seed, row, 4) * 0.14), h * 0.024);
        }
        return;
      }
      case 4: {
        const floorY = h * 0.78;
        g.fillStyle = lg(0, 0, 0, floorY, [[0, rgba(mix(dk, c2, 0.3))], [1, rgba(mix(dk, c1, 0.5))]]);
        g.fillRect(0, 0, w, floorY);
        g.fillStyle = rgba(mix(dk, c1, 0.15));
        g.fillRect(0, floorY, w, h - floorY);
        g.fillStyle = rgba(hi);
        g.fillRect(0, floorY - lw, w, lw * 2);
        // смуги здоров'я
        const bw = w * 0.4;
        g.fillStyle = rgba(dk, 0.7);
        rrect(w * 0.04, h * 0.06, bw, h * 0.06, h * 0.03);
        g.fill();
        rrect(w * 0.56, h * 0.06, bw, h * 0.06, h * 0.03);
        g.fill();
        g.fillStyle = rgba(c1);
        rrect(w * 0.04, h * 0.06, bw * (0.62 + 0.2 * Math.sin(t * 0.7)), h * 0.06, h * 0.03);
        g.fill();
        g.fillStyle = rgba(c2);
        const bw2 = bw * (0.6 + 0.2 * Math.sin(t * 0.6 + 1));
        rrect(w * 0.56 + bw - bw2, h * 0.06, bw2, h * 0.06, h * 0.03);
        g.fill();
        // двоє бійців
        const sway = Math.sin(t * 2.2) * h * 0.012;
        for (const [fx, c, dir] of [[w * 0.28, c1, 1], [w * 0.72, c2, -1]]) {
          g.fillStyle = rgba(c);
          rrect(fx - w * 0.05, floorY - h * 0.4 + sway * dir, w * 0.1, h * 0.28, w * 0.03);
          g.fill();
          g.beginPath();
          g.arc(fx, floorY - h * 0.45 + sway * dir, h * 0.06, 0, Math.PI * 2);
          g.fillStyle = rgba(mix(c, WHITE, 0.35));
          g.fill();
          rrect(fx - w * 0.05, floorY - h * 0.14, w * 0.04, h * 0.14, w * 0.012);
          g.fillStyle = rgba(shade(c, 0.7));
          g.fill();
          rrect(fx + w * 0.01, floorY - h * 0.14, w * 0.04, h * 0.14, w * 0.012);
          g.fill();
        }
        return;
      }
      case 5: {
        g.fillStyle = lg(0, 0, w, h, [[0, rgba(mix(dk, c1, 0.18))], [1, rgba(mix(dk, c2, 0.24))]]);
        g.fillRect(0, 0, w, h);
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.font = `800 ${h * 0.46}px ${FONT}`;
        g.fillStyle = rgba(WHITE, 0.96);
        g.shadowColor = rgba(c1, 0.8);
        g.shadowBlur = h * S * U * 0.3;
        g.fillText("5 × 5", w / 2, h * 0.4);
        g.shadowBlur = 0;
        const rowH = h * 0.07;
        for (let i = 0; i < 2; i++) {
          const f = 0.45 + 0.4 * (0.5 + 0.5 * Math.sin(t * 0.5 + i * 2));
          g.fillStyle = rgba(dk, 0.7);
          rrect(w * 0.08, h * (0.72 + i * 0.12), w * 0.84, rowH, rowH / 2);
          g.fill();
          g.fillStyle = rgba(i ? c2 : c1, 0.95);
          rrect(w * 0.08, h * (0.72 + i * 0.12), w * 0.84 * f, rowH, rowH / 2);
          g.fill();
        }
        return;
      }
      case 6: {
        const gr = lg(0, 0, w, 0, [[0, rgba(c1)], [0.5, rgba(c2)], [1, rgba(c1)]]);
        g.fillStyle = gr;
        g.fillRect(0, 0, w, h);
        g.fillStyle = rgba(dk, 0.38);
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 6; i++) {
          const x = (((i * 0.2 + t * 0.07) % 1.2) - 0.1) * w;
          g.fillStyle = lg(x - w * 0.12, 0, x + w * 0.12, 0, [[0, rgba(c1, 0)], [0.5, rgba(i % 2 ? c2 : c1, 0.55)], [1, rgba(c2, 0)]]);
          g.fillRect(x - w * 0.12, 0, w * 0.24, h);
        }
        return;
      }
      default: {
        g.fillStyle = rgba(mix(dk, c1, 0.1));
        g.fillRect(0, 0, w, h);
        const pulse = 0.55 + 0.45 * Math.sin(t * 0.9 + seed);
        g.fillStyle = rgba(mix(dk, c1, 0.5 + 0.3 * pulse));
        g.beginPath();
        const cx = w / 2;
        const cy = h * 0.5;
        const s = h * 0.2;
        g.moveTo(cx - s, cy - s * 0.8);
        g.lineTo(cx - s * 0.45, cy - s * 0.8);
        g.lineTo(cx, cy + s * 0.25);
        g.lineTo(cx + s * 0.45, cy - s * 0.8);
        g.lineTo(cx + s, cy - s * 0.8);
        g.lineTo(cx + s * 0.18, cy + s * 0.95);
        g.lineTo(cx - s * 0.18, cy + s * 0.95);
        g.closePath();
        g.fill();
      }
    }
  }

  // Екран = поверхня + вміст; те саме малюється і в статичному кадрі, і в кожному кадрі анімації
  const screens = [];
  function screen(plane, w, h, kind, c1, c2, seed, o) {
    const sc = { plane, w, h, kind, c1, c2, seed, o: o || {} };
    screens.push(sc);
    drawScreen(sc, 0);
    return sc;
  }
  function drawScreen(sc, t) {
    // Поверхня задається в абсолютних координатах полотна, тож спершу скидаємо будь-яку чинну трансформацію
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    sc.plane(() => {
      g.save();
      g.beginPath();
      g.rect(0, 0, sc.w, sc.h);
      g.clip();
      art(sc.kind, sc.w, sc.h, t, sc.seed, sc.c1, sc.c2);
      // відблиск скла
      g.fillStyle = lg(0, 0, sc.w, sc.h, [[0, "rgba(255,255,255,0.10)"], [0.42, "rgba(255,255,255,0.02)"], [0.5, "rgba(255,255,255,0)"], [1, "rgba(255,255,255,0.03)"]]);
      g.fillRect(0, 0, sc.w, sc.h);
      if (sc.o.tint) {
        g.fillStyle = sc.o.tint;
        g.fillRect(0, 0, sc.w, sc.h);
      }
      g.restore();
    });
    g.restore();
  }

  /* ================= Сцена ================= */

  const items = []; // предмети, що малюються від дальніх до ближніх
  const pools = []; // плями світла на підлозі
  const shadows = []; // тіні під меблями
  const strips = []; // RGB-підсвітка столів
  const motes = []; // порошинки
  const lamps = []; // «ON AIR»
  const item = (depth, fn) => items.push({ depth, fn });

  function backdrop() {
    g.fillStyle = rgba(BG);
    g.fillRect(0, 0, W, H);
    const dw = DIO_W * S;
    halo(OX - dw * 0.36, OY - WH * S * 0.1, dw * 0.55, dw * 0.4, MINT, 0.17);
    halo(OX + dw * 0.4, OY - WH * S * 0.1, dw * 0.55, dw * 0.4, MAG, 0.2);
    halo(OX, OY + (GA + GB) * 0.25 * S, dw * 0.7, dw * 0.32, mix(MINT, MAG, 0.5), 0.07);
  }

  function slab() {
    const fl = [P3(0, GB, 0), P3(GA, GB, 0), P3(GA, GB, -SLAB), P3(0, GB, -SLAB)];
    const fr = [P3(GA, 0, 0), P3(GA, GB, 0), P3(GA, GB, -SLAB), P3(GA, 0, -SLAB)];
    // світло під «островом»
    halo(px(GA * 0.5, GB), py(GA * 0.5, GB, -SLAB) + S * 0.2, GA * 0.5 * K * S * 1.1, S * 1.1, MAG, 0.3);
    halo(px(GA, GB * 0.5), py(GA, GB * 0.5, -SLAB) + S * 0.2, GB * 0.5 * K * S * 1.1, S * 1.1, MINT, 0.24);
    paint(fl, lg(0, fl[0][1], 0, fl[3][1], [[0, "#27313a"], [1, "#12171c"]]), 1);
    paint(fr, lg(0, fr[0][1], 0, fr[2][1], [[0, "#1c242b"], [1, "#0d1115"]]), 1);
    // шви й кромки
    g.save();
    g.lineWidth = Math.max(1, S * 0.012);
    g.strokeStyle = "rgba(0,0,0,0.35)";
    g.beginPath();
    for (let a = 1.7; a < GA; a += 1.7) {
      g.moveTo(...P3(a, GB, 0));
      g.lineTo(...P3(a, GB, -SLAB));
    }
    for (let b = 1.7; b < GB; b += 1.7) {
      g.moveTo(...P3(GA, b, 0));
      g.lineTo(...P3(GA, b, -SLAB));
    }
    g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.2)";
    g.lineWidth = Math.max(1, S * 0.018);
    g.beginPath();
    g.moveTo(...P3(0, GB, 0));
    g.lineTo(...P3(GA, GB, 0));
    g.lineTo(...P3(GA, 0, 0));
    g.stroke();
    g.restore();
    neonLine(P3(0.2, GB, -SLAB + 0.07), P3(GA, GB, -SLAB + 0.07), MAG, Math.max(1.5, S * 0.05), S * 0.35);
    neonLine(P3(GA, GB, -SLAB + 0.07), P3(GA, 0.2, -SLAB + 0.07), MINT, Math.max(1.5, S * 0.05), S * 0.35);
  }

  const ZONE = {
    boot: [0, 3.6, 5.4, GB], // килим Bootcamp
    lounge: [12.8, GA, 0, 5.8], // килим PS5
    booth: [7.4, 12.0, 0, 4.6], // стрім-кімната
  };
  const zonePoly = (z) => [P3(z[0], z[2], 0), P3(z[1], z[2], 0), P3(z[1], z[3], 0), P3(z[0], z[3], 0)];

  function floor() {
    const poly = [P3(0, 0, 0), P3(GA, 0, 0), P3(GA, GB, 0), P3(0, GB, 0)];
    const c = P3(GA * 0.42, GB * 0.42, 0);
    paint(poly, rg(c[0], c[1], 0, S * GA * 1.05, [[0, "#222c35"], [0.6, "#161d24"], [1, "#0f1419"]]), 0);
    // плитка 1×1 м
    g.save();
    g.strokeStyle = "rgba(170,210,220,0.07)";
    g.lineWidth = Math.max(1, S * 0.012);
    g.beginPath();
    for (let i = 1; i < GA; i++) {
      g.moveTo(...P3(i, 0, 0));
      g.lineTo(...P3(i, GB, 0));
    }
    for (let j = 1; j < GB; j++) {
      g.moveTo(...P3(0, j, 0));
      g.lineTo(...P3(GA, j, 0));
    }
    g.stroke();
    g.restore();
    // глянцевий відблиск
    paint(poly, lg(...P3(0, 0, 0), ...P3(GA, GB, 0), [[0, "rgba(255,255,255,0.05)"], [0.45, "rgba(255,255,255,0)"], [1, "rgba(255,255,255,0.025)"]]), 0);
    // неон зі стін розливається по підлозі: бірюза зліва, маджента справа
    g.save();
    g.globalCompositeOperation = "lighter";
    // контури градієнта мають бути паралельні стіні, тож вектор градієнта — перпендикуляр до стіни на екрані
    const wash = (poly, from, n, c, a) => {
      const L = 3 * K * S;
      paint(poly, lg(from[0], from[1], from[0] + n[0] * L, from[1] + n[1] * L, [[0, rgba(c, a)], [1, rgba(c, 0)]]), 0);
    };
    wash([P3(0, 0, 0), P3(3, 0, 0), P3(3, GB, 0), P3(0, GB, 0)], P3(0, GB * 0.5, 0), [0.5, 0.866], MINT, 0.13);
    wash([P3(0, 0, 0), P3(GA, 0, 0), P3(GA, 3, 0), P3(0, 3, 0)], P3(GA * 0.5, 0, 0), [-0.5, 0.866], MAG, 0.14);
    g.restore();

    // Bootcamp: килим з м'ятним відтінком і смугами
    let z = ZONE.boot;
    paint(zonePoly(z), lg(...P3(z[0], z[2], 0), ...P3(z[1], z[3], 0), [[0, rgba(MINT, 0.17)], [1, rgba(MINT, 0.06)]]), 0);
    g.save();
    g.strokeStyle = rgba(MINT, 0.1);
    g.lineWidth = Math.max(1, S * 0.02);
    g.beginPath();
    for (let a = 0.6; a < z[1]; a += 0.6) {
      g.moveTo(...P3(a, z[2], 0));
      g.lineTo(...P3(a, z[3], 0));
    }
    g.stroke();
    g.restore();
    neonLine(P3(z[1], z[2], 0), P3(z[1], z[3], 0), MINT, Math.max(1.4, S * 0.04), S * 0.28);
    neonLine(P3(0, z[2], 0), P3(z[1], z[2], 0), MINT, Math.max(1.4, S * 0.04), S * 0.28);

    // PS5: килим із маджентою і візерунком
    z = ZONE.lounge;
    paint(zonePoly(z), lg(...P3(z[0], z[2], 0), ...P3(z[1], z[3], 0), [[0, rgba(MAG, 0.3)], [1, rgba(MAG, 0.12)]]), 0);
    g.save();
    g.strokeStyle = rgba(MAG, 0.4);
    g.lineWidth = Math.max(1, S * 0.025);
    for (const inset of [0.3, 0.6]) {
      trace(zonePoly([z[0] + inset, z[1] - inset * 0.5, z[2], z[3] - inset]));
      g.stroke();
    }
    g.restore();
    neonLine(P3(z[0], z[2], 0), P3(z[0], z[3], 0), MAG, Math.max(1.4, S * 0.04), S * 0.28);
    neonLine(P3(z[0], z[3], 0), P3(z[1], z[3], 0), MAG, Math.max(1.4, S * 0.04), S * 0.28);

    // стрім-кімната: темна глянцева підлога
    z = ZONE.booth;
    paint(zonePoly(z), "rgba(4,5,8,0.55)", 0);
    paint(zonePoly(z), lg(...P3(z[0], z[2], 0), ...P3(z[1], z[3], 0), [[0, rgba(MAG, 0.1)], [1, rgba(MAG, 0.02)]]), 0);

    // емблема в центрі: неонове кільце та літера V
    const ex = 2.35;
    const ey = 1.55;
    onFloor(ex, ey, 0, () => {
      g.save();
      g.lineCap = "round";
      g.strokeStyle = rgba(MINT, 0.9);
      g.shadowColor = rgba(MINT, 0.9);
      g.shadowBlur = S * 0.3;
      g.lineWidth = 5;
      g.beginPath();
      g.arc(0, 0, 112, 0, Math.PI * 2);
      g.stroke();
      g.shadowBlur = 0;
      g.strokeStyle = rgba(MINT, 0.35);
      g.lineWidth = 2.5;
      g.beginPath();
      g.arc(0, 0, 90, 0, Math.PI * 2);
      g.stroke();
      g.restore();
      g.beginPath();
      g.moveTo(-50, -48);
      g.lineTo(-23, -48);
      g.lineTo(0, 18);
      g.lineTo(23, -48);
      g.lineTo(50, -48);
      g.lineTo(15, 54);
      g.lineTo(-15, 54);
      g.closePath();
      g.fillStyle = lg(-50, -48, 50, 54, [[0, rgba(MINT, 0.95)], [1, rgba(MAG, 0.95)]]);
      g.shadowColor = rgba(MINT, 0.7);
      g.shadowBlur = S * 0.25;
      g.fill();
    });
    pools.push([ex, ey, 2.3, MINT, 0.26]);
  }

  /* ---------- Стіни ---------- */

  const lx = (B) => (GB - B) * 100; // ліва стіна: локальний x у см
  const ly = (z) => (WH - z) * 100; //  локальний y у см (для обох стін)
  const rx = (A) => A * 100; //        права стіна
  const wallL = (fn) => onWallA(0, GB, WH, fn);
  const wallR = (fn) => onWallB(0, 0, WH, fn);

  function wallBase(w, tint, accent) {
    // фон, панелі та неонова смуга; w — довжина стіни в см
    g.fillStyle = lg(0, 0, 0, WH * 100, [[0, rgba(shade(tint, 1.35))], [0.55, rgba(tint)], [1, rgba(shade(tint, 0.62))]]);
    g.fillRect(-30, 0, w + 30, WH * 100);
    g.lineWidth = Math.max(onePx(), 1.6);
    for (let x = 170; x < w; x += 170) {
      g.strokeStyle = "rgba(0,0,0,0.38)";
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, WH * 100);
      g.stroke();
      g.strokeStyle = "rgba(255,255,255,0.05)";
      g.beginPath();
      g.moveTo(x + g.lineWidth, 0);
      g.lineTo(x + g.lineWidth, WH * 100);
      g.stroke();
    }
    // плінтус
    g.fillStyle = "rgba(0,0,0,0.38)";
    g.fillRect(-30, ly(0.22), w + 30, 22);
    g.fillStyle = rgba(accent, 0.55);
    g.fillRect(-30, ly(0.22), w + 30, 2.5);
    // неонова смуга під стелею + світлий «омив» стіни
    g.save();
    g.lineCap = "round";
    g.strokeStyle = rgba(accent, 0.95);
    g.shadowColor = rgba(accent, 0.9);
    g.shadowBlur = S * 0.28;
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(-30, ly(3.88));
    g.lineTo(w, ly(3.88));
    g.stroke();
    g.shadowBlur = 0;
    g.strokeStyle = rgba(mix(accent, WHITE, 0.65), 0.95);
    g.lineWidth = 2.4;
    g.stroke();
    g.restore();
    g.fillStyle = lg(0, ly(3.88), 0, ly(2.2), [[0, rgba(accent, 0.22)], [1, rgba(accent, 0)]]);
    g.fillRect(-30, ly(3.88), w + 30, ly(2.2) - ly(3.88));
    // конуси світла від стельових світильників: м'які промені вздовж стіни
    g.save();
    g.globalCompositeOperation = "lighter";
    for (let x = 120; x < w; x += 340) {
      g.fillStyle = lg(0, ly(3.85), 0, ly(0.3), [[0, rgba(mix(accent, WHITE, 0.4), 0.13)], [1, rgba(accent, 0)]]);
      g.beginPath();
      g.moveTo(x - 18, ly(3.85));
      g.lineTo(x + 18, ly(3.85));
      g.lineTo(x + 130, ly(0.3));
      g.lineTo(x - 130, ly(0.3));
      g.closePath();
      g.fill();
    }
    g.restore();
  }

  function posterArt(w, h, c1, c2, seed) {
    g.fillStyle = lg(0, 0, w, h, [[0, rgba(mix(INK, c1, 0.5))], [1, rgba(mix(INK, c2, 0.7))]]);
    g.fillRect(0, 0, w, h);
    g.fillStyle = rgba(WHITE, 0.85);
    g.beginPath();
    const cx = w / 2;
    const cy = h * 0.42;
    const s = w * 0.28;
    g.moveTo(cx - s, cy - s * 0.8);
    g.lineTo(cx - s * 0.4, cy - s * 0.8);
    g.lineTo(cx, cy + s * 0.3);
    g.lineTo(cx + s * 0.4, cy - s * 0.8);
    g.lineTo(cx + s, cy - s * 0.8);
    g.lineTo(cx + s * 0.18, cy + s);
    g.lineTo(cx - s * 0.18, cy + s);
    g.closePath();
    g.fill();
    g.fillStyle = rgba(WHITE, 0.55);
    g.fillRect(w * 0.18, h * 0.78, w * 0.64, h * 0.025);
    g.fillRect(w * 0.3, h * 0.85, w * 0.4, h * 0.02);
  }

  function frame(x, y, w, h, c, thick = 5) {
    g.save();
    g.fillStyle = "rgba(0,0,0,0.5)";
    rrect(x - thick - 2, y - thick - 2, w + (thick + 2) * 2, h + (thick + 2) * 2, 6);
    g.fill();
    g.strokeStyle = rgba(c, 0.85);
    g.lineWidth = thick * 0.5;
    g.shadowColor = rgba(c, 0.8);
    g.shadowBlur = S * 0.16;
    rrect(x - thick, y - thick, w + thick * 2, h + thick * 2, 5);
    g.stroke();
    g.restore();
  }

  function walls() {
    box(-0.3, -0.3, 0, 0.3, GB + 0.3, WH, mat(hexc("#2d3843")), { soft: 1, rim: [255, 255, 255], rimA: 0.28 });
    box(0, -0.3, 0, GA, 0.3, WH, mat(hexc("#344250")), { soft: 1, rim: [255, 255, 255], rimA: 0.28 });

    /* ---- ліва стіна: Bootcamp, плакати ---- */
    wallL(() => {
      wallBase(lx(-0.3), hexc("#1d2832"), MINT);
      // табло над рядом Bootcamp
      const sb = { x: lx(14.8), y: ly(3.15), w: lx(7.4) - lx(14.8), h: 140 };
      frame(sb.x, sb.y, sb.w, sb.h, MINT);
      screen((fn) => onWallA(0, GB, WH, () => { g.translate(sb.x, sb.y); fn(); }), sb.w, sb.h, 5, MINT, MAG, 3);
      neonText("BOOTCAMP", lx(11.1), ly(3.42), 50, MINT);
      // плакати
      for (const [b0, b1, z0, z1, c1, c2, seed] of [[0.5, 1.9, 1.5, 3.25, MINT, MAG, 1], [2.6, 3.9, 2.5, 3.55, MAG, MINT, 2]]) {
        const p = { x: lx(b1), y: ly(z1), w: lx(b0) - lx(b1), h: ly(z0) - ly(z1) };
        frame(p.x, p.y, p.w, p.h, c1, 3);
        g.save();
        g.translate(p.x, p.y);
        g.beginPath();
        g.rect(0, 0, p.w, p.h);
        g.clip();
        posterArt(p.w, p.h, c1, c2, seed);
        g.restore();
      }
    });

    /* ---- права стіна: вікно в нічне місто, студія, PS5 ---- */
    wallR(() => {
      wallBase(rx(GA), hexc("#222d38"), MAG);
      // вікно
      const wx = rx(0.8);
      const wy = ly(3.5);
      const ww = rx(4.4) - wx;
      const wh = ly(1.0) - wy;
      frame(wx, wy, ww, wh, mix(MAG, MINT, 0.3), 4);
      g.save();
      g.beginPath();
      g.rect(wx, wy, ww, wh);
      g.clip();
      g.fillStyle = lg(0, wy, 0, wy + wh, [[0, "#0d0720"], [0.55, "#2a0f4a"], [1, rgba(mix(MAG, hexc("#2a0f4a"), 0.45))]]);
      g.fillRect(wx, wy, ww, wh);
      g.fillStyle = rgba(mix(MAG, WHITE, 0.4), 0.9);
      g.shadowColor = rgba(MAG, 0.9);
      g.shadowBlur = S * 0.3;
      g.beginPath();
      g.arc(wx + ww * 0.78, wy + wh * 0.22, 15, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
      for (let layer = 0; layer < 3; layer++) {
        const base = wy + wh * (0.9 - layer * 0.0);
        let x = wx - 4;
        while (x < wx + ww) {
          const bw = 14 + hash(layer, Math.floor(x), 1) * 26;
          const bh = wh * (0.18 + (2 - layer) * 0.07 + hash(layer, Math.floor(x), 2) * 0.28);
          g.fillStyle = layer === 0 ? rgba(mix(hexc("#1a0f33"), MAG, 0.18)) : layer === 1 ? "#120a26" : "#0a0716";
          g.fillRect(x, base - bh, bw, bh + wh);
          if (layer === 2) {
            for (let wy2 = base - bh + 6; wy2 < base - 4; wy2 += 9) {
              for (let wx2 = x + 3; wx2 < x + bw - 4; wx2 += 8) {
                if (hash(Math.floor(wx2), Math.floor(wy2), 5) < 0.2) {
                  g.fillStyle = hash(Math.floor(wx2), Math.floor(wy2), 6) < 0.5 ? rgba(MINT, 0.95) : rgba(mix(MAG, WHITE, 0.4), 0.95);
                  g.fillRect(wx2, wy2, 3.4, 4.4);
                }
              }
            }
          }
          x += bw + 2 + hash(layer, Math.floor(x), 3) * 4;
        }
      }
      g.fillStyle = lg(wx, wy, wx + ww, wy + wh, [[0, "rgba(255,255,255,0.12)"], [0.4, "rgba(255,255,255,0.02)"], [0.5, "rgba(255,255,255,0)"], [1, "rgba(255,255,255,0.04)"]]);
      g.fillRect(wx, wy, ww, wh);
      g.restore();
      g.fillStyle = rgba(mix(MAG, MINT, 0.3), 0.55);
      g.fillRect(wx + ww / 2 - 2, wy, 4, wh);
      g.fillRect(wx, wy + wh * 0.5 - 2, ww, 4);

      // стрім-кімната: LED-фон
      const bp = { x: rx(8.1), y: ly(3.1), w: rx(11.3) - rx(8.1), h: ly(1.4) - ly(3.1) };
      frame(bp.x, bp.y, bp.w, bp.h, MAG);
      screen((fn) => onWallB(0, 0, WH, () => { g.save(); g.translate(bp.x, bp.y); fn(); g.restore(); }), bp.w, bp.h, 6, MAG, MINT, 2);
      neonText("STREAMER", rx(9.7), ly(3.42), 50, MAG);

      // PS5: телевізор і вивіска
      const tv = { x: rx(13.5), y: ly(2.85), w: rx(16.5) - rx(13.5), h: ly(1.15) - ly(2.85) };
      frame(tv.x, tv.y, tv.w, tv.h, MINT, 5);
      screen((fn) => onWallB(0, 0, WH, () => { g.save(); g.translate(tv.x, tv.y); fn(); g.restore(); }), tv.w, tv.h, 4, MINT, MAG, 4);
      neonText("PS5", rx(15), ly(3.4), 56, MAG);
    });

    // «ON AIR» — табличка з мерехтінням
    lamps.push({
      draw: (on) =>
        wallR(() => {
          const x = rx(12.0);
          const y = ly(2.95);
          g.save();
          rrect(x, y, 150, 52, 9);
          g.fillStyle = on ? lg(0, y, 0, y + 52, [[0, rgba(mix(MAG, WHITE, 0.2), 0.95)], [1, rgba(shade(MAG, 0.7), 0.95)]]) : "rgba(25,12,32,0.95)";
          if (on) {
            g.shadowColor = rgba(MAG, 0.95);
            g.shadowBlur = S * 0.5;
          }
          g.fill();
          g.shadowBlur = 0;
          g.font = `800 28px ${FONT}`;
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.fillStyle = on ? "#fff" : rgba(MAG, 0.3);
          g.fillText("ON AIR", x + 75, y + 28);
          g.restore();
        }),
    });
    lamps[0].draw(false);
  }

  /* ---------- Меблі ---------- */

  // Ігрове місце. dir "A" — екран дивиться вздовж +A, "B" — вздовж +B. (a0, b0) — кут столу з найменшими A і B;
  // s — від екрана до гравця, t — уздовж столу.
  function station(dir, a0, b0, o) {
    const acc = o.acc;
    const alt = acc === MINT ? MAG : MINT;
    const L =
      dir === "A"
        ? (s, t, z, ds, dt, h, m, opt) => box(a0 + s, b0 + t, z, ds, dt, h, m, opt)
        : (s, t, z, ds, dt, h, m, opt) => box(a0 + t, b0 + s, z, dt, ds, h, m, opt);
    const wpt = (s, t, z) => (dir === "A" ? P3(a0 + s, b0 + t, z) : P3(a0 + t, b0 + s, z));
    const monitor = (fn) => (dir === "A" ? onWallA(a0 + 0.2, b0 + 1.52, 1.55, fn) : onWallB(a0 + 0.48, b0 + 0.2, 1.55, fn));
    const wc = dir === "A" ? [a0 + 1.9, b0 + 1.0] : [a0 + 1.0, b0 + 1.9];
    pools.push([wc[0], wc[1], 1.6, acc, o.seated ? 0.3 : 0.15]);
    pools.push(dir === "A" ? [a0 + 0.9, b0 + 1.0, 1.7, acc, 0.14] : [a0 + 1.0, b0 + 0.9, 1.7, acc, 0.14]);
    const sh = (s, t, ds, dt, blur, a) => {
      const q = dir === "A" ? [a0 + s, b0 + t, ds, dt] : [a0 + t, b0 + s, dt, ds];
      shadows.push({ pts: quadAt(...q), blur, a });
    };
    sh(-0.05, -0.05, 1.2, 2.1, S * 0.3, 0.55);
    sh(1.25, 0.35, 1.1, 1.3, S * 0.3, 0.5);

    item(a0 + b0 + 3.5, () => {
      // стіл: стільниця на двох боковинах
      L(0.12, 0.08, 0, 0.78, 0.07, 0.72, M.black, { soft: 0.6 });
      L(0.12, 1.85, 0, 0.78, 0.07, 0.72, M.black, { soft: 0.6 });
      const rgbLine = [wpt(1.0, 0.1, 0.7), wpt(1.0, 1.9, 0.7)];
      strips.push({ p: rgbLine, phase: o.seed || 0, acc });
      neonLine(rgbLine[0], rgbLine[1], mix(acc, BG, 0.2), Math.max(1.4, S * 0.035), S * 0.18);
      L(0, 0, 0.72, 1.0, 2.0, 0.07, M.deskTop, { rim: WHITE, rimA: 0.3, soft: 1.2 });
      // килимок, клавіатура, миша
      L(0.5, 0.7, 0.79, 0.5, 0.95, 0.012, mat(mix(INK, acc, 0.16)), { rim: acc, rimA: 0.6, soft: 0.5 });
      L(0.62, 0.38, 0.79, 0.2, 0.62, 0.03, mat(mix([40, 50, 60], acc, 0.35)), { rim: acc, rimA: 0.8, soft: 0.5, glow: 0.5 });
      L(0.66, 1.2, 0.79, 0.1, 0.08, 0.035, M.metal, { soft: 0.5 });
      // системний блок із прозорою стінкою й вентиляторами
      L(0.2, 0.06, 0.79, 0.5, 0.3, 0.62, M.black, { soft: 0.8 });
      (dir === "A" ? (fn) => onWallA(a0 + 0.7, b0 + 0.36, 1.41, fn) : (fn) => onWallB(a0 + 0.06, b0 + 0.7, 1.41, fn))(() => {
        g.fillStyle = rgba(mix(INK, acc, 0.14), 0.95);
        g.fillRect(2, 2, 26, 58);
        for (const fy of [18, 44]) {
          g.strokeStyle = rgba(acc, 0.95);
          g.lineWidth = 2.6;
          g.beginPath();
          g.arc(15, fy, 8, 0, Math.PI * 2);
          g.stroke();
          g.fillStyle = rgba(acc, 0.5);
          g.beginPath();
          g.arc(15, fy, 3.2, 0, Math.PI * 2);
          g.fill();
        }
      });
      // монітор: ніжка, рамка, екран
      L(0.1, 0.96, 0.79, 0.24, 0.08, 0.03, M.metal, { soft: 0.6 });
      L(0.17, 0.99, 0.8, 0.05, 0.02, 0.2, M.metal, { soft: 0.6 });
      L(0.16, 0.45, 0.98, 0.04, 1.1, 0.6, M.black, { rim: acc, rimA: 0.55, soft: 1 });
      screen(monitor, 105, 54, o.seated ? o.kind || 0 : 7, acc, alt, o.seed || 0);
      // крісло
      const cx = 1.75;
      const ct = 1.0;
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2 + 0.3;
        const ex = cx + Math.cos(ang) * 0.34;
        const ey = ct + Math.sin(ang) * 0.34;
        g.save();
        g.strokeStyle = "rgba(20,26,32,0.95)";
        g.lineWidth = Math.max(1.2, S * 0.05);
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(...wpt(cx, ct, 0.1));
        g.lineTo(...wpt(ex, ey, 0.08));
        g.stroke();
        g.fillStyle = "#0b0f13";
        g.beginPath();
        const wp = wpt(ex, ey, 0.05);
        g.arc(wp[0], wp[1], Math.max(1.4, S * 0.05), 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      L(cx - 0.04, ct - 0.04, 0.1, 0.08, 0.08, 0.34, M.metal, { soft: 0.6 });
      if (o.seated) {
        L(1.5, 0.78, 0.55, 0.5, 0.44, 0.6, M.hood, { soft: 3 });
        // голова та гарнітура
        const hp = wpt(1.74, 1.0, 1.52);
        const hr = 0.16 * S * 1.2247;
        g.save();
        g.fillStyle = rg(hp[0] - hr * 0.35, hp[1] - hr * 0.35, hr * 0.1, hr * 1.1, [[0, "#707d89"], [1, "#2a333c"]]);
        g.beginPath();
        g.arc(hp[0], hp[1], hr, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = rgba(acc, 0.95);
        g.lineWidth = Math.max(1.4, S * 0.045);
        g.shadowColor = rgba(acc, 0.8);
        g.shadowBlur = S * 0.14;
        g.beginPath();
        g.arc(hp[0], hp[1], hr * 1.04, Math.PI * 1.08, Math.PI * 1.92);
        g.stroke();
        g.fillStyle = rgba(acc, 0.95);
        for (const sx of [-1, 1]) {
          g.beginPath();
          g.ellipse(hp[0] + sx * hr * 1.02, hp[1] + hr * 0.1, hr * 0.26, hr * 0.38, 0, 0, Math.PI * 2);
          g.fill();
        }
        g.restore();
      }
      L(1.4, 0.65, 0.4, 0.75, 0.7, 0.12, M.chair, { rim: acc, rimA: 0.35, soft: 4 });
      L(2.02, 0.68, 0.5, 0.12, 0.64, 0.95, M.chair, { rim: acc, rimA: 0.5, soft: 3 });
      L(2.02, 0.6, 0.5, 0.14, 0.1, 0.78, mat(mix(M.chair.t, acc, 0.45)), { soft: 2 });
      L(2.02, 1.3, 0.5, 0.14, 0.1, 0.78, mat(mix(M.chair.t, acc, 0.45)), { soft: 2 });
      L(2.0, 0.78, 1.28, 0.16, 0.44, 0.22, mat(mix(M.chair.t, acc, 0.6)), { rim: WHITE, rimA: 0.3, soft: 4 });
      L(1.5, 0.52, 0.62, 0.5, 0.08, 0.05, M.dark, { soft: 1 });
      L(1.5, 1.4, 0.62, 0.5, 0.08, 0.05, M.dark, { soft: 1 });
    });
  }

  function lounge() {
    // тумба, консоль PS5, телевізор висить на стіні
    shadows.push({ pts: quadAt(13.4, 0, 3.4, 0.9), blur: S * 0.3, a: 0.5 }, { pts: quadAt(13.2, 3.0, 3.8, 1.4), blur: S * 0.35, a: 0.5 }, { pts: quadAt(14.4, 1.5, 1.9, 1.0), blur: S * 0.25, a: 0.4 });
    pools.push([15.0, 2.6, 3.6, MAG, 0.4]);
    item(13.4 + 0.9 + 0.1, () => {
      box(13.4, 0.0, 0, 3.2, 0.7, 0.55, M.dark, { rim: MINT, rimA: 0.5, glow: 0.6, soft: 2 });
      box(14.3, 0.1, 0.55, 0.28, 0.4, 0.72, M.white, { soft: 3 });
      onWallB(14.3, 0.5, 1.27, () => {
        g.fillStyle = "#12161f";
        g.fillRect(9, 6, 10, 62);
        g.fillStyle = rgba(MINT, 0.95);
        g.shadowColor = rgba(MINT, 0.9);
        g.shadowBlur = S * 0.12;
        g.fillRect(12, 6, 4, 6);
      });
    });
    item(13.2 + 3.9, () => {
      // пуфи
      for (const [a, b, r, c] of [[12.9, 2.4, 0.5, MINT], [13.1, 5.4, 0.46, MAG]]) {
        const cx = px(a, b);
        const cy = py(a, b, 0.2);
        const rr = r * S * 1.2;
        g.fillStyle = rg(cx - rr * 0.3, cy - rr * 0.5, rr * 0.1, rr * 1.2, [[0, rgba(mix(c, WHITE, 0.25), 0.95)], [0.6, rgba(shade(c, 0.55), 0.95)], [1, rgba(shade(c, 0.28), 0.95)]]);
        g.beginPath();
        g.ellipse(cx, cy, rr, rr * 0.82, 0, 0, Math.PI * 2);
        g.fill();
      }
    });
    item(14.4 + 2.5, () => {
      // журнальний столик зі скла й контролери
      box(14.4, 1.5, 0.36, 1.9, 1.0, 0.04, mat(mix(BG, MINT, 0.22)), { alpha: 0.7, rim: MINT, rimA: 0.7, glow: 0.5 });
      for (const [a, b] of [[14.5, 1.6], [16.1, 1.6], [14.5, 2.3], [16.1, 2.3]]) box(a, b, 0, 0.08, 0.08, 0.36, M.metal, { soft: 0.6 });
      box(14.8, 1.8, 0.4, 0.28, 0.14, 0.04, M.white, { soft: 1 });
      box(15.5, 1.9, 0.4, 0.28, 0.14, 0.04, mat(mix(INK, MINT, 0.6)), { soft: 1, rim: MINT, rimA: 0.8 });
    });
    item(13.2 + 4.4 + 3.8, () => {
      // диван спиною до глядача
      const sofa = mat(mix(BG, MAG, 0.38));
      const cushion = mat(mix(BG, MAG, 0.5));
      const rimC = mix(MAG, WHITE, 0.3);
      box(13.45, 3.05, 0, 3.1, 1.35, 0.36, sofa, { soft: 7, rim: rimC, rimA: 0.3 }); // основа
      box(13.45, 4.1, 0.36, 3.1, 0.3, 0.66, sofa, { soft: 7, rim: rimC, rimA: 0.45 }); // спинка
      box(13.1, 3.05, 0, 0.35, 1.35, 0.72, sofa, { soft: 7, rim: rimC, rimA: 0.4 }); //   підлокітники
      box(16.55, 3.05, 0, 0.35, 1.35, 0.72, sofa, { soft: 7, rim: rimC, rimA: 0.4 });
      for (const a of [13.5, 14.5, 15.5]) box(a, 3.1, 0.36, 0.95, 0.98, 0.14, cushion, { soft: 7, rim: rimC, rimA: 0.35 });
    });
    item(16.6 + 0.6 + 1, () => {
      // неонова торшер-трубка
      box(16.6, 0.5, 0, 0.08, 0.08, 3.1, mat(mix(MAG, WHITE, 0.55)), { soft: 2 });
      halo(px(16.64, 0.54), py(16.64, 0.54, 1.55), S * 0.9, S * 2.2, MAG, 0.32);
    });
  }

  function booth() {
    const a0 = 8.0;
    shadows.push({ pts: quadAt(a0 - 0.05, 0, 3.5, 1.1), blur: S * 0.3, a: 0.55 }, { pts: quadAt(a0 + 1.4, 1.2, 1.1, 1.2), blur: S * 0.3, a: 0.5 });
    pools.push([a0 + 1.7, 2.1, 2.8, MAG, 0.45]);
    item(a0 + 3.4 + 2.2, () => {
      // стіл стрімера з двома моніторами (екрани дивляться вздовж +B)
      box(a0 + 0.1, 0.06, 0, 0.07, 0.85, 0.72, M.black, { soft: 0.6 });
      box(a0 + 3.2, 0.06, 0, 0.07, 0.85, 0.72, M.black, { soft: 0.6 });
      const rgbLine = [P3(a0 + 0.1, 1.0, 0.7), P3(a0 + 3.3, 1.0, 0.7)];
      strips.push({ p: rgbLine, phase: 4, acc: MAG });
      neonLine(rgbLine[0], rgbLine[1], mix(MAG, BG, 0.2), Math.max(1.4, S * 0.035), S * 0.2);
      box(a0, 0, 0.72, 3.4, 1.0, 0.07, M.deskTop, { rim: WHITE, rimA: 0.3, soft: 1.2 });
      box(a0 + 0.4, 0.6, 0.79, 0.62, 0.3, 0.03, mat(mix([40, 50, 60], MAG, 0.35)), { rim: MAG, rimA: 0.8, soft: 0.5, glow: 0.5 });
      for (const [t, kind, c1, c2, seed] of [[0.35, 3, MAG, MINT, 7], [1.95, 0, MAG, MINT, 9]]) {
        box(a0 + t + 0.45, 0.12, 0.79, 0.2, 0.1, 0.2, M.metal, { soft: 0.6 });
        box(a0 + t, 0.18, 0.98, 1.1, 0.04, 0.6, M.black, { rim: MAG, rimA: 0.6, soft: 1 });
        screen((fn) => onWallB(a0 + t + 0.03, 0.22, 1.55, fn), 105, 54, kind, c1, c2, seed, { tint: "rgba(220,235,255,0.045)" });
      }
      // мікрофон на «журавлі»
      box(a0 + 1.55, 0.5, 0.79, 0.05, 0.05, 0.62, M.metal, { soft: 0.6 });
      box(a0 + 1.5, 0.35, 1.3, 0.14, 0.2, 0.1, M.black, { rim: MAG, rimA: 0.8, soft: 2 });
      box(a0 + 1.25, 0.28, 1.38, 0.55, 0.05, 0.03, M.metal, { soft: 0.6 });
      // крісло стрімера
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2 + 0.3;
        g.save();
        g.strokeStyle = "rgba(20,26,32,0.95)";
        g.lineWidth = Math.max(1.2, S * 0.05);
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(...P3(a0 + 1.7, 2.0, 0.1));
        g.lineTo(...P3(a0 + 1.7 + Math.cos(ang) * 0.34, 2.0 + Math.sin(ang) * 0.34, 0.08));
        g.stroke();
        g.restore();
      }
      box(a0 + 1.66, 1.96, 0.1, 0.08, 0.08, 0.34, M.metal, { soft: 0.6 });
      const chair = mat(mix(BG, MAG, 0.4));
      box(a0 + 1.35, 1.65, 0.55, 0.7, 0.5, 0.6, M.hood, { soft: 3 });
      const hp = P3(a0 + 1.62, 1.85, 1.52);
      const hr = 0.16 * S * 1.2247;
      g.save();
      g.fillStyle = rg(hp[0] - hr * 0.35, hp[1] - hr * 0.35, hr * 0.1, hr * 1.1, [[0, "#707d89"], [1, "#2a333c"]]);
      g.beginPath();
      g.arc(hp[0], hp[1], hr, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = rgba(MAG, 0.95);
      g.lineWidth = Math.max(1.4, S * 0.045);
      g.shadowColor = rgba(MAG, 0.8);
      g.shadowBlur = S * 0.14;
      g.beginPath();
      g.arc(hp[0], hp[1], hr * 1.04, Math.PI * 1.08, Math.PI * 1.92);
      g.stroke();
      g.restore();
      box(a0 + 1.3, 1.52, 0.4, 0.8, 0.7, 0.12, chair, { rim: MAG, rimA: 0.4, soft: 4 });
      box(a0 + 1.35, 2.15, 0.5, 0.7, 0.12, 0.95, chair, { rim: MAG, rimA: 0.5, soft: 3 });
      box(a0 + 1.45, 2.13, 1.28, 0.5, 0.16, 0.22, mat(mix(chair.t, MAG, 0.5)), { soft: 4 });
    });
    // кільцеве світло на штативі
    item(8.3 + 3.4 + 1, () => {
      box(8.3, 3.4, 0, 0.06, 0.06, 1.9, M.metal, { soft: 0.6 });
      const cx = px(8.33, 3.43);
      const cy = py(8.33, 3.43, 2.25);
      const r = 0.45 * S * 1.2247;
      g.save();
      g.translate(cx, cy);
      g.scale(1, 0.92);
      g.strokeStyle = rgba(mix(MAG, WHITE, 0.82), 0.98);
      g.lineWidth = Math.max(2, S * 0.1);
      g.shadowColor = rgba(MAG, 0.95);
      g.shadowBlur = S * 0.55;
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.stroke();
      g.shadowBlur = S * 0.2;
      g.stroke();
      g.restore();
      halo(cx, cy, r * 2.4, r * 2.2, MAG, 0.2);
    });
    // камера на штативі
    item(10.6 + 3.8 + 1, () => {
      box(10.6, 3.7, 0, 0.05, 0.05, 1.05, M.metal, { soft: 0.6 });
      box(10.46, 3.6, 1.05, 0.34, 0.24, 0.2, M.black, { rim: MINT, rimA: 0.6, soft: 2 });
      box(10.5, 3.84, 1.1, 0.26, 0.1, 0.1, mat(mix(INK, MINT, 0.5)), { soft: 2, rim: MINT, rimA: 0.9 });
    });
    // скляні перегородки
    item(12 + 4.6 + 20, () => {
      const glass = mat(mix(BG, WHITE, 0.2));
      const rim = mix(MAG, WHITE, 0.3);
      box(7.4, 0, 0, 0.05, 4.6, 2.2, glass, { alpha: 0.12, rim, rimA: 0.55 });
      box(7.4, 4.55, 0, 4.6, 0.05, 2.2, glass, { alpha: 0.12, rim, rimA: 0.55, glow: 0.4 });
      box(11.95, 0, 0, 0.05, 4.6, 2.2, glass, { alpha: 0.12, rim, rimA: 0.55 });
    });
  }

  function props() {
    // автомат із напоями біля лівої стіни
    shadows.push({ pts: quadAt(0, 2.3, 1.2, 1.8), blur: S * 0.25, a: 0.55 });
    item(0.95 + 4.0 + 0.1, () => {
      box(0.02, 2.4, 0, 0.93, 1.6, 2.15, M.metal, { rim: WHITE, rimA: 0.3, soft: 2 });
      onWallA(0.95, 3.95, 2.0, () => {
        g.fillStyle = "#0a0f14";
        rrect(6, 6, 148, 190, 6);
        g.fill();
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 6; c++) {
            const col = hash(r, c, 8) < 0.5 ? MINT : MAG;
            g.fillStyle = rgba(mix(INK, col, 0.65 + hash(r, c, 2) * 0.3));
            rrect(14 + c * 23, 14 + r * 44, 15, 32, 4);
            g.fill();
            g.fillStyle = rgba(WHITE, 0.35);
            g.fillRect(16 + c * 23, 18 + r * 44, 3, 22);
          }
          g.fillStyle = rgba(WHITE, 0.14);
          g.fillRect(8, 48 + r * 44, 144, 2.4);
        }
        g.fillStyle = rgba(MINT, 0.9);
        g.shadowColor = rgba(MINT, 0.9);
        g.shadowBlur = S * 0.12;
        rrect(60, 196, 36, 10, 3);
        g.fill();
      });
      halo(px(1.0, 3.2), py(1.0, 3.2, 1.2), S * 1.8, S * 1.9, MINT, 0.22);
    });
    const plant = (A, B) =>
      item(A + B + 0.6, () => {
        cyl(A, B, 0, 0.26, 0.4, hexc("#2f3b46"));
        const cx = px(A, B);
        const cy = py(A, B, 0.42);
        for (let i = 0; i < 9; i++) {
          const ang = -Math.PI / 2 + (i - 4) * 0.33;
          const len = S * (0.55 + hash(i, A, 1) * 0.35);
          const lx2 = cx + Math.cos(ang) * len;
          const ly2 = cy + Math.sin(ang) * len;
          g.save();
          g.fillStyle = rg(cx, cy, 2, len, [[0, rgba(mix(MINT, BG, 0.78))], [1, rgba(mix(MINT, BG, 0.45 + hash(i, A, 2) * 0.15))]]);
          g.beginPath();
          g.moveTo(cx, cy);
          g.quadraticCurveTo(cx + Math.cos(ang - 0.35) * len * 0.62, cy + Math.sin(ang - 0.35) * len * 0.62, lx2, ly2);
          g.quadraticCurveTo(cx + Math.cos(ang + 0.35) * len * 0.62, cy + Math.sin(ang + 0.35) * len * 0.62, cx, cy);
          g.fill();
          g.restore();
        }
      });
    plant(0.35, 5.0);
    plant(12.4, 0.5);
    plant(15.4, 15.2);
    // вивіска «STANDARD» на ніжках біля входу в PC-зал
    shadows.push({ pts: quadAt(4.3, 3.3, 2.8, 0.3), blur: S * 0.2, a: 0.4 });
    item(7.1 + 3.6, () => {
      box(4.5, 3.34, 0, 0.07, 0.07, 1.5, M.metal, { soft: 0.6 });
      box(6.8, 3.34, 0, 0.07, 0.07, 1.5, M.metal, { soft: 0.6 });
      box(4.3, 3.3, 1.4, 2.8, 0.1, 0.72, M.black, { rim: MINT, rimA: 0.7, glow: 0.7, soft: 2 });
      onWallB(4.3, 3.4, 2.12, () => {
        neonText("STANDARD", 140, 54, 37, MINT);
      });
    });
  }

  // Бар: стійка, підсвічена полиця з пляшками за нею, неонова вивіска й барні стільці
  function bar() {
    const a0 = 12.0;
    const a1 = 16.4;
    const w = (a1 - a0) * 100;
    shadows.push({ pts: quadAt(a0 - 0.1, 8.9, a1 - a0 + 0.2, 0.95), blur: S * 0.3, a: 0.5 }, { pts: quadAt(a0 - 0.1, 10.7, a1 - a0 + 0.2, 1.45), blur: S * 0.3, a: 0.5 });
    pools.push([(a0 + a1) / 2, 11.5, 3.6, MINT, 0.26]);
    // полиця за стійкою (дивиться на бармена й гостей, тобто вздовж +B)
    item(a1 + 9.7, () => {
      box(a0, 8.9, 0, a1 - a0, 0.8, 2.5, M.dark, { rim: MINT, rimA: 0.5, glow: 0.4, soft: 2 });
      onWallB(a0, 9.7, 2.4, () => {
        g.fillStyle = lg(0, 0, 0, 230, [[0, "#0d141a"], [1, "#070b0f"]]);
        g.fillRect(8, 6, w - 16, 228);
        for (let r = 0; r < 3; r++) {
          const y = 70 + r * 68;
          g.save();
          g.strokeStyle = rgba(r % 2 ? MAG : MINT, 0.95);
          g.shadowColor = rgba(r % 2 ? MAG : MINT, 0.9);
          g.shadowBlur = S * 0.1;
          g.lineWidth = 3;
          g.beginPath();
          g.moveTo(14, y);
          g.lineTo(w - 14, y);
          g.stroke();
          g.restore();
          g.fillStyle = lg(0, y - 62, 0, y, [[0, rgba(r % 2 ? MAG : MINT, 0.14)], [1, rgba(r % 2 ? MAG : MINT, 0)]]);
          g.fillRect(14, y - 62, w - 28, 62);
          for (let x = 26; x < w - 30; x += 24 + hash(r, x, 4) * 10) {
            const col = hash(r, x, 1) < 0.5 ? MINT : MAG;
            const bh = 30 + hash(r, x, 2) * 16;
            g.fillStyle = lg(x, 0, x + 12, 0, [[0, rgba(mix(INK, col, 0.55))], [0.45, rgba(mix(col, WHITE, 0.3), 0.9)], [1, rgba(mix(INK, col, 0.4))]]);
            rrect(x, y - 4 - bh, 12, bh, 3);
            g.fill();
            g.fillRect(x + 4, y - 4 - bh - 9, 4, 10);
          }
        }
      });
      // табличка з неоновою вивіскою над полицею
      const pa = (a0 + a1) / 2 - 1.0;
      box(pa, 9.1, 2.5, 2.0, 0.1, 0.78, M.black, { rim: MINT, rimA: 0.7, glow: 0.7, soft: 2 });
      onWallB(pa, 9.2, 3.28, () => {
        neonText("BAR", 100, 58, 52, MINT);
      });
    });
    // стійка
    item(a1 + 11.9, () => {
      box(a0, 10.8, 0, a1 - a0, 1.0, 1.0, M.dark, { soft: 2 });
      neonLine(P3(a0 + 0.15, 11.82, 0.28), P3(a1 - 0.15, 11.82, 0.28), MINT, Math.max(1.5, S * 0.04), S * 0.25);
      box(a0 - 0.1, 10.7, 1.0, a1 - a0 + 0.2, 1.25, 0.08, M.deskTop, { rim: WHITE, rimA: 0.35, soft: 1.5 });
      for (let i = 0; i < 6; i++) {
        const col = i % 2 ? MAG : MINT;
        cyl(a0 + 0.5 + i * 0.72, 11.3, 1.08, 0.07, 0.24, mix(INK, col, 0.7), { top: 1.5 });
      }
    });
    // барні стільці
    for (const a of [12.8, 13.9, 15.0, 16.0]) {
      item(a + 13.0, () => {
        cyl(a, 13.0, 0, 0.05, 0.62, hexc("#56636f"));
        cyl(a, 13.0, 0.62, 0.27, 0.11, mix(INK, MINT, 0.25), { top: 1.5 });
        g.save();
        g.strokeStyle = rgba(MINT, 0.9);
        g.lineWidth = Math.max(1, S * 0.03);
        g.beginPath();
        g.ellipse(px(a, 13.0), py(a, 13.0, 0.73), 1.2247 * 0.27 * S, 0.7071 * 0.27 * S, 0, 0, Math.PI * 2);
        g.stroke();
        g.restore();
      });
      shadows.push({ pts: quadAt(a - 0.3, 12.7, 0.6, 0.6), blur: S * 0.18, a: 0.45 });
    }
  }

  function furniture() {
    // Bootcamp 5×5 — п'ять місць у ряд уздовж лівої стіни
    for (let i = 0; i < 5; i++) station("A", 0, 6.0 + i * 2.1, { acc: MINT, kind: i % 2 ? 0 : 2, seated: true, seed: 20 + i });
    // Standard — два ряди «острівних» місць, частина вільна
    for (let i = 0; i < 6; i++) station("A", 4.8, 4.2 + i * 2.15, { acc: hash(i, 1) < 0.35 ? MAG : MINT, kind: i % 4, seated: hash(i, 2) < 0.72, seed: 40 + i });
    for (let i = 0; i < 5; i++) station("A", 9.4, 5.4 + i * 2.15, { acc: hash(i, 7) < 0.35 ? MAG : MINT, kind: (i + 1) % 4, seated: hash(i, 8) < 0.62, seed: 60 + i });
    lounge();
    booth();
    bar();
    props();
  }

  function floorLights() {
    for (const s of shadows) softShadow(s.pts, s.blur, s.a);
    for (const [A, B, r, c, a] of pools) floorGlow(A, B, r, c, a);
  }

  function bloom() {
    // ореол навколо екранів
    for (const sc of screens) {
      if (sc.w < 90) continue;
      const a = sc.w > 200 ? 0.2 : 0.13;
      sc.plane(() => {
        const m = g.getTransform();
        const x = m.a * (sc.w / 2) + m.c * (sc.h / 2) + m.e;
        const y = m.b * (sc.w / 2) + m.d * (sc.h / 2) + m.f;
        g.save();
        g.setTransform(1, 0, 0, 1, 0, 0);
        halo(x, y, sc.w * S * U * 0.95, sc.h * S * U * 1.25, sc.c1, a);
        g.restore();
      });
    }
  }

  function seedMotes() {
    for (let i = 0; i < 34; i++) {
      motes.push({
        x: OX + (hash(i, 1) - 0.5) * DIO_W * S * 0.95,
        y: OY - WH * S * 0.8 + hash(i, 2) * (DIO_H * S),
        vy: 0.06 + hash(i, 3) * 0.16,
        ph: hash(i, 4) * 6.28,
        c: hash(i, 5) < 0.55 ? MINT : MAG,
        r: 0.8 + hash(i, 6) * 1.6,
      });
    }
  }

  function buildScene() {
    items.length = 0;
    pools.length = 0;
    shadows.length = 0;
    screens.length = 0;
    strips.length = 0;
    motes.length = 0;
    lamps.length = 0;

    backdrop();
    slab();
    floor();
    walls();
    furniture(); // лише реєструє предмети, тіні та плями світла
    floorLights();
    items.sort((p, q) => p.depth - q.depth);
    for (const it of items) it.fn();
    bloom();
    seedMotes();
  }

  /* ================= Показ і анімація ================= */

  const baseCv = document.createElement("canvas");
  const baseCtx = baseCv.getContext("2d", { alpha: false });
  let raf = 0;
  let last = 0;
  let booted = false;
  let lastW = 0;
  let lastH = 0;

  function layout() {
    const vw = Math.max(320, window.innerWidth);
    const vh = Math.max(320, window.innerHeight);
    lastW = vw;
    lastH = vh;
    const cssH = vh + 120; // запас по висоті: адресний рядок мобільного браузера не відкриє «щілину» внизу
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const budget = 5.5e6; // на дуже великих екранах малюємо трохи грубіше, CSS розтягує
    if (vw * cssH * dpr * dpr > budget) dpr = Math.max(0.7, Math.sqrt(budget / (vw * cssH)));
    W = Math.round(vw * dpr);
    H = Math.round(cssH * dpr);
    for (const cv of [canvas, baseCv]) {
      cv.width = W;
      cv.height = H;
    }
    canvas.style.width = vw + "px";
    canvas.style.height = cssH + "px";

    const zoom = Number(THEME.sceneZoom) || 1;
    const portrait = vh > vw * 1.1;
    const fitW = ((vw * dpr) / DIO_W) * (portrait ? 1.12 : 1.04);
    const fitH = ((vh * dpr) / DIO_H) * 1.08;
    S = Math.min(fitW, fitH) * zoom;
    const cy = (portrait ? vh * 0.3 : vh * 0.54) * dpr;
    const focus = THEME.sceneFocus;
    if (Array.isArray(focus) && focus.length >= 2) {
      OX = W / 2 - (focus[0] - focus[1]) * K * S;
      OY = cy - ((focus[0] + focus[1]) * 0.5 - (focus[2] || 0)) * S;
    } else {
      OX = W / 2;
      OY = cy - (((GA + GB) * 0.5 + SLAB - WH) * S) / 2;
    }
  }

  function render() {
    g = baseCtx;
    buildScene();
    g = view;
    view.drawImage(baseCv, 0, 0);
  }

  function dynamic(t) {
    view.drawImage(baseCv, 0, 0);
    g = view;
    for (const sc of screens) drawScreen(sc, t);
    // RGB-підсвітка столів
    g.save();
    g.globalCompositeOperation = "lighter";
    g.lineCap = "round";
    g.lineWidth = Math.max(1.4, S * 0.03);
    for (const st of strips) {
      const v = 0.5 + 0.5 * Math.sin(t * 0.9 + st.phase);
      g.strokeStyle = rgba(mix(MINT, MAG, v), 0.55);
      g.beginPath();
      g.moveTo(st.p[0][0], st.p[0][1]);
      g.lineTo(st.p[1][0], st.p[1][1]);
      g.stroke();
    }
    g.restore();
    // «ON AIR»
    lamps[0].draw(t % 3.2 < 2.3);
    // порошинки
    g.save();
    g.globalCompositeOperation = "lighter";
    for (const m of motes) {
      const y = OY - WH * S * 0.8 + ((((m.y - (OY - WH * S * 0.8) - t * m.vy * S * 0.5) % (DIO_H * S)) + DIO_H * S) % (DIO_H * S));
      const x = m.x + Math.sin(t * 0.4 + m.ph) * S * 0.25;
      g.fillStyle = rg(x, y, 0, m.r * dpr * 3, [[0, rgba(m.c, 0.5)], [1, rgba(m.c, 0)]]);
      g.beginPath();
      g.arc(x, y, m.r * dpr * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  function present(now) {
    raf = requestAnimationFrame(present);
    if (now - last < 80) return;
    last = now;
    try {
      dynamic(now / 1000);
    } catch (e) {
      stop(); // щось пішло не так — лишаємо останній кадр, анімацію вимикаємо
    }
  }

  function start() {
    if (!raf && animate && !document.hidden) raf = requestAnimationFrame(present);
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  // Повне перемальовування; якщо воно не вдалося, фон просто прибираємо — сторінка лишається з темним градієнтом
  function rebuild() {
    stop();
    try {
      layout();
      render();
      if (animate) dynamic(0.01);
    } catch (e) {
      canvas.remove();
      return false;
    }
    start();
    return true;
  }

  function boot() {
    if (!rebuild()) return;
    booted = true;
    canvas.classList.add("is-ready"); // плавна поява: див. .bg__scene у styles.css
  }

  // Шрифт сайту потрібен для написів на стінах; не чекаємо його довше за 1,5 с
  const fontReady = () => {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.race([document.fonts.load("800 40px Unbounded"), new Promise((r) => setTimeout(r, 1500))]).catch(() => {});
  };
  // Малюємо, коли браузер уже показав сторінку й вільний: фон не затримує появу кнопок
  const later = (fn) => (window.requestIdleCallback ? window.requestIdleCallback(fn, { timeout: 900 }) : setTimeout(fn, 150));
  later(() => fontReady().then(boot));

  let resizeTimer = 0;
  window.addEventListener(
    "resize",
    () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        // адресний рядок мобільного браузера змінює лише висоту — не перемальовуємо
        const dw = Math.abs(window.innerWidth - lastW);
        const dh = Math.abs(window.innerHeight - lastH);
        if (!booted || (dw < 2 && dh < 160)) return;
        rebuild();
      }, 200);
    },
    { passive: true }
  );

  if (animate) document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
})();
