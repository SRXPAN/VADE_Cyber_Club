// POST /api/report — сюди агент з кожного ПК надсилає свій стан.
// Заголовок: Authorization: Bearer <AGENT_TOKEN>   (секрет задається в Cloudflare, див. agent/README.md)
// Тіло (JSON): { "id": "pc01", "name": "PC 1", "zone": "Standard", "pos": 1, "state": "busy", "detail": "game: cs2.exe" }
//   state — "free" | "busy" | "offline" ("offline" агент шле, коли ПК вимикається)
//   detail — коротке пояснення для адміністратора; відвідувачам сайту не показується

import { ensureSchema, json, sameSecret, bearer, nowSec, STATES } from "../_lib/pcs.js";

const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;
const clip = (value, max) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "D1 database is not bound as DB" }, 503);
  if (!sameSecret(bearer(request), env.AGENT_TOKEN)) return json({ error: "unauthorized" }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }

  const id = clip(body.id, 32);
  const state = clip(body.state, 10);
  if (!ID_RE.test(id)) return json({ error: "bad id" }, 400);
  if (!STATES.includes(state)) return json({ error: "bad state" }, 400);

  const name = clip(body.name, 40) || id;
  const zone = clip(body.zone, 40);
  const pos = Number.isFinite(Number(body.pos)) ? Math.trunc(Number(body.pos)) : 0;
  const detail = clip(body.detail, 200);
  const now = nowSec();

  await ensureSchema(env.DB);
  // since — коли ПК перейшов у поточний стан. Не змінюється, поки стан той самий.
  await env.DB.prepare(
    `INSERT INTO pcs (id, name, zone, pos, state, since, seen, detail)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6, ?7)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       zone = excluded.zone,
       pos = excluded.pos,
       since = CASE WHEN pcs.state = excluded.state AND pcs.seen > ?6 - ?8 THEN pcs.since ELSE excluded.since END,
       state = excluded.state,
       seen = excluded.seen,
       detail = excluded.detail`
  )
    .bind(id, name, zone, pos, state, now, detail, 600)
    .run();

  return json({ ok: true, now });
}

// Видалити ПК зі списку (наприклад, його прибрали з залу): DELETE /api/report?id=pc07 з тим самим токеном
export async function onRequestDelete({ request, env }) {
  if (!env.DB) return json({ error: "D1 database is not bound as DB" }, 503);
  if (!sameSecret(bearer(request), env.AGENT_TOKEN)) return json({ error: "unauthorized" }, 401);
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!ID_RE.test(id)) return json({ error: "bad id" }, 400);
  await ensureSchema(env.DB);
  const result = await env.DB.prepare("DELETE FROM pcs WHERE id = ?1").bind(id).run();
  return json({ ok: true, deleted: result.meta?.changes ?? 0 });
}

export function onRequest() {
  return json({ error: "method not allowed" }, 405, { Allow: "POST, DELETE" });
}
