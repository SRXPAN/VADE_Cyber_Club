// POST /api/club-status — стани всіх ПК від Vade Launcher (адмін-панель на головному ПК клубу).
// Один запит на весь клуб: при зміні стану будь-якого ПК (зміни за ~2 с об'єднуються) і heartbeat раз на 10 хв.
// Заголовки:
//   Authorization: Bearer <VADE_TOKEN>        секрет у Cloudflare = «API Secret» у Vade Launcher
//   X-Vade-Event: change | heartbeat | test   test — «Тест підключення»: перевіряє все, але в базу не пише
//   X-Vade-Heartbeat: 600                     як часто Vade Launcher повторює стан (з цього рахується «застарів»)
// Тіло: { "updatedAt": "2026-11-22T14:30:00.000Z", "pcs": [{ "id": 1, "zone": "Regular", "status": "free" }] }
//   status — free | occupied | maintenance | offline. IP, MAC, імена гравців Vade Launcher не надсилає.
//
// ПК записуються в ту саму таблицю pcs, що й від PowerShell-агента (id "vade:1", назва "PC 1"),
// тож /api/status і сайт показують їх як звичайно. У базу пишуться лише ПК, у яких щось змінилось,
// плюс один рядок «Vade Launcher на зв'язку» — так безкоштовного ліміту D1 вистачає з великим запасом.

import { ensureSchema, json, sameSecret, bearer, nowSec, VADE_PREFIX } from "../_lib/pcs.js";

// Стан Vade Launcher → стан на сайті
const STATE = { free: "free", occupied: "busy", maintenance: "maintenance", offline: "offline" };

// Зони Vade Launcher → назви зон у vade/config.js (тоді сайт перекладає їх: Стандарт, Стрімерська).
// Інші назви зон передаються як є.
const ZONE = { regular: "Standard", stream: "Streamer" };

const MAX_PCS = 500;
const DEFAULT_HEARTBEAT = 600;

const clip = (value, max) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
const zoneName = (zone) => {
  const z = clip(zone, 40);
  return ZONE[z.toLowerCase()] || z;
};

// Через скільки секунд без звістки від Vade Launcher усі його ПК показуються як вимкнені:
// два пропущені heartbeat + 2 хвилини на повтори після помилки мережі.
function ttlFor(request) {
  const hb = Number(request.headers.get("X-Vade-Heartbeat"));
  const beat = Number.isFinite(hb) && hb >= 15 && hb <= 86400 ? hb : DEFAULT_HEARTBEAT;
  return Math.min(2 * 86400, Math.max(300, 2 * beat + 120));
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "D1 database is not bound as DB" }, 503);
  if (!sameSecret(bearer(request), env.VADE_TOKEN)) return json({ error: "unauthorized" }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }
  const updatedMs = Date.parse(body?.updatedAt);
  if (!Array.isArray(body?.pcs) || body.pcs.length > MAX_PCS || Number.isNaN(updatedMs)) return json({ error: "bad payload" }, 400);

  // Лише очікувані поля, навіть якщо прийде щось зайве; повтор номера — перший перемагає
  const pcs = new Map();
  for (const p of body.pcs) {
    const n = p?.id;
    if (!Number.isInteger(n) || n <= 0 || n > 99999 || pcs.has(n) || !Object.hasOwn(STATE, p?.status)) continue;
    pcs.set(n, { id: `${VADE_PREFIX}${n}`, name: `PC ${n}`, zone: zoneName(p.zone), pos: n, state: STATE[p.status] });
  }

  const event = request.headers.get("X-Vade-Event") || "";
  if (event === "test") return json({ ok: true, test: true, pcs: pcs.size });

  const db = env.DB;
  const now = nowSec();
  const ttl = ttlFor(request);
  await ensureSchema(db);
  const [source, existing] = await db.batch([
    db.prepare("SELECT seen, ttl FROM vade_source WHERE k = 'vade'"),
    db.prepare("SELECT id, name, zone, pos, state, since FROM pcs WHERE substr(id, 1, 5) = ?1").bind(VADE_PREFIX),
  ]);
  const src = source.results?.[0];
  // Порядок запитів не перевіряється: Vade Launcher шле їх по одному, а годинник адмін-ПК може переводитись назад.
  // Vade Launcher довго мовчав — сайт показував ці ПК вимкненими, тож «з якого часу» рахуємо заново
  const wasStale = !src || now - src.seen > src.ttl;

  const old = new Map((existing.results || []).map((row) => [row.id, row]));
  const writes = [];
  for (const pc of pcs.values()) {
    const prev = old.get(pc.id);
    old.delete(pc.id);
    const sameState = !!prev && !wasStale && prev.state === pc.state;
    if (sameState && prev.name === pc.name && prev.zone === pc.zone && prev.pos === pc.pos) continue;
    writes.push(
      db
        .prepare(
          `INSERT INTO pcs (id, name, zone, pos, state, since, seen, detail)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'Vade Launcher')
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name, zone = excluded.zone, pos = excluded.pos, state = excluded.state,
             since = excluded.since, seen = excluded.seen, detail = excluded.detail`
        )
        .bind(pc.id, pc.name, pc.zone, pc.pos, pc.state, sameState ? prev.since : now, now)
    );
  }
  // ПК, яких більше немає у Vade Launcher (видалили зі списку), зникають і з сайту
  for (const id of old.keys()) writes.push(db.prepare("DELETE FROM pcs WHERE id = ?1").bind(id));
  writes.push(
    db
      .prepare(
        `INSERT INTO vade_source (k, seen, ttl, updated) VALUES ('vade', ?1, ?2, ?3)
         ON CONFLICT(k) DO UPDATE SET seen = excluded.seen, ttl = excluded.ttl, updated = excluded.updated`
      )
      .bind(now, ttl, updatedMs)
  );
  await db.batch(writes); // одна транзакція

  return json({ ok: true, pcs: pcs.size, written: writes.length - 1 });
}

export function onRequest() {
  return json({ error: "method not allowed" }, 405, { Allow: "POST" });
}
