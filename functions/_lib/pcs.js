// Спільний код для /api/report і /api/status: таблиця ПК у базі Cloudflare D1.
// Таблиця створюється сама при першому запиті, окремо нічого запускати не треба.

export const STATES = ["free", "busy", "offline"];

// Скільки секунд без звістки від агента — і ПК вважається вимкненим.
// Агент шле «я живий» раз на 60 с, тож 3 хвилини — із запасом на перезавантаження й мережу.
export const OFFLINE_AFTER_DEFAULT = 180;

const SCHEMA = `CREATE TABLE IF NOT EXISTS pcs (
  id     TEXT PRIMARY KEY,
  name   TEXT NOT NULL,
  zone   TEXT NOT NULL DEFAULT '',
  pos    INTEGER NOT NULL DEFAULT 0,
  state  TEXT NOT NULL,
  since  INTEGER NOT NULL,
  seen   INTEGER NOT NULL,
  detail TEXT NOT NULL DEFAULT ''
)`;

// Vade Launcher (адмін-панель на головному ПК) шле стани всіх ПК одним запитом на /api/club-status.
// Його ПК лежать у тій самій таблиці pcs з id "vade:<номер столу>" (двокрапки в id агентів не буває — не переплутаються),
// а в vade_source — коли Vade Launcher востаннє виходив на зв'язок і скільки секунд його дані вважаються свіжими.
export const VADE_PREFIX = "vade:";
const VADE_SCHEMA = `CREATE TABLE IF NOT EXISTS vade_source (
  k       TEXT PRIMARY KEY,
  seen    INTEGER NOT NULL,
  ttl     INTEGER NOT NULL,
  updated INTEGER NOT NULL DEFAULT 0
)`;

let schemaReady = false;
export async function ensureSchema(db) {
  if (schemaReady) return;
  await db.prepare(SCHEMA).run();
  await db.prepare(VADE_SCHEMA).run();
  schemaReady = true;
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", ...headers },
  });
}

// Порівняння токена за однаковий час, щоб його не можна було підібрати по символу за часом відповіді
export function sameSecret(given, expected) {
  if (typeof given !== "string" || typeof expected !== "string" || !expected) return false;
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i];
  return diff === 0;
}

export function bearer(request) {
  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

export const nowSec = () => Math.floor(Date.now() / 1000);

export function offlineAfter(env) {
  const value = Number(env.OFFLINE_AFTER);
  return Number.isFinite(value) && value >= 60 ? value : OFFLINE_AFTER_DEFAULT;
}
