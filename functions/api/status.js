// GET /api/status — стан усіх ПК для сайту.
// Відповідь: { updated, free, busy, offline, total, pcs: [{ id, name, zone, state, since }] }
// З заголовком Authorization: Bearer <AGENT_TOKEN> у кожному ПК додається ще detail і seen — для адміністратора.

import { ensureSchema, json, sameSecret, bearer, nowSec, offlineAfter } from "../_lib/pcs.js";

// «PC 2» перед «PC 10»
const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: "D1 database is not bound as DB" }, 503, { "Cache-Control": "no-store" });

  await ensureSchema(env.DB);
  const { results = [] } = await env.DB.prepare("SELECT id, name, zone, pos, state, since, seen, detail FROM pcs").all();

  const admin = sameSecret(bearer(request), env.AGENT_TOKEN);
  const now = nowSec();
  const limit = offlineAfter(env);
  const counts = { free: 0, busy: 0, offline: 0 };

  const pcs = results
    .map((row) => {
      const stale = now - row.seen > limit;
      const state = stale ? "offline" : row.state;
      counts[state] = (counts[state] || 0) + 1;
      const pc = { id: row.id, name: row.name, zone: row.zone, pos: row.pos, state, since: stale ? row.seen : row.since };
      if (admin) Object.assign(pc, { seen: row.seen, detail: row.detail });
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
