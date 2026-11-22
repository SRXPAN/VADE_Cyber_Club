// GET /api/status — стан усіх ПК для сайту.
// Відповідь: { updated, free, busy, maintenance, offline, total, pcs: [{ id, name, zone, state, since }] }
//   state — free | busy | maintenance (обслуговування, лише від Vade Launcher) | offline
// З заголовком Authorization: Bearer <AGENT_TOKEN або VADE_TOKEN> у кожному ПК додається ще detail і seen — для адміністратора.

import { ensureSchema, json, sameSecret, bearer, nowSec, offlineAfter, VADE_PREFIX } from "../_lib/pcs.js";

// «PC 2» перед «PC 10»
const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: "D1 database is not bound as DB" }, 503, { "Cache-Control": "no-store" });

  const db = env.DB;
  await ensureSchema(db);
  const [rows, source] = await db.batch([
    db.prepare("SELECT id, name, zone, pos, state, since, seen, detail FROM pcs"),
    db.prepare("SELECT seen, ttl FROM vade_source WHERE k = 'vade'"),
  ]);
  const results = rows.results || [];
  const vade = source.results?.[0];

  const token = bearer(request);
  const admin = sameSecret(token, env.AGENT_TOKEN) || sameSecret(token, env.VADE_TOKEN);
  const now = nowSec();
  const limit = offlineAfter(env);
  // ПК від Vade Launcher свіжі, поки свіжий сам Vade Launcher (він шле весь клуб разом, heartbeat раз на 10 хв)
  const vadeFresh = !!vade && now - vade.seen <= vade.ttl;
  const counts = { free: 0, busy: 0, maintenance: 0, offline: 0 };

  const pcs = results
    .map((row) => {
      const fromVade = row.id.startsWith(VADE_PREFIX);
      const seen = fromVade && vade ? vade.seen : row.seen;
      const stale = fromVade ? !vadeFresh : now - row.seen > limit;
      const state = stale ? "offline" : row.state;
      counts[state] = (counts[state] || 0) + 1;
      const pc = { id: row.id, name: row.name, zone: row.zone, pos: row.pos, state, since: stale ? seen : row.since };
      if (admin) Object.assign(pc, { seen, detail: row.detail });
      return pc;
    })
    .sort((a, b) => a.pos - b.pos || collator.compare(a.name, b.name));

  return json(
    { updated: now, ...counts, total: pcs.length, pcs },
    200,
    // Короткий кеш: сайт оновлює дані раз на 30–60 с, а база не отримує запит від кожного відвідувача
    { "Cache-Control": admin ? "no-store" : "public, max-age=10" }
  );
}

export function onRequest() {
  return json({ error: "method not allowed" }, 405, { Allow: "GET" });
}
