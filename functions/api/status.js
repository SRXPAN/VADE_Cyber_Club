/**
 * Cloudflare Pages Function: GET /api/status
 * Проксі до API SENET: повертає кількість вільних ПК для бейджа «🟢 12 вільних ПК» на сайті.
 * Ключ API лишається на сервері Cloudflare і ніколи не потрапляє в браузер.
 *
 * Відповідь:  { "available": 12, "total": 20, "updatedAt": "2026-10-01T18:00:00.000Z" }
 * Помилки:    503 { "error": "not_configured" } — змінні нижче ще не задані (сайт тоді просто ховає бейдж)
 *             502 { "error": "upstream" }       — SENET не відповів або відповів незрозуміло
 *
 * Змінні середовища (Cloudflare Pages → Settings → Variables and Secrets):
 *   SENET_API_URL         ЗАМІНИТИ: адреса API, напр. "https://api.senet.example/v1/clubs/{club}/computers".
 *                         {club} підставиться з SENET_CLUB_ID.
 *   SENET_API_KEY         ЗАМІНИТИ: ключ API (тип «Secret»).
 *   SENET_CLUB_ID         ID клубу в SENET (якщо адреса його потребує).
 *   SENET_AUTH_HEADER     Як передавати ключ: "Authorization" (за замовчуванням, "Bearer <ключ>") або назва
 *                         власного заголовка, напр. "X-API-Key" (тоді ключ передається як є).
 *   STATUS_CACHE_SECONDS  Скільки секунд кешувати відповідь на краю Cloudflare (за замовчуванням 30).
 *   STATUS_MOCK           "1" — повертати тестові дані без SENET (лише для перевірки вигляду, не для продакшну).
 *
 * Формат відповіді SENET тут — припущення. Функція normalize() розуміє два варіанти:
 *   1) готові числа: { available | free | free_count, total | total_count }
 *   2) список ПК: масив (або { data | items | computers | devices | pcs: [...] }) з полем стану,
 *      напр. { status: "free" } чи { busy: false }.
 * Якщо реальний API SENET відповідає інакше — достатньо поправити normalize().
 */

const UPSTREAM_TIMEOUT_MS = 5000;
const FREE_STATES = new Set(["free", "available", "idle", "online", "ready", "vacant"]);
const OFF_STATES = new Set(["offline", "off", "maintenance", "disabled", "broken", "service"]);

export async function onRequestGet({ request, env, waitUntil }) {
  const cacheSeconds = clampInt(env.STATUS_CACHE_SECONDS, 30, 5, 300);

  if (env.STATUS_MOCK === "1") {
    return json({ available: 12, total: 20, updatedAt: new Date().toISOString(), mock: true }, 200, "no-store");
  }

  if (!env.SENET_API_URL || !env.SENET_API_KEY) {
    return json({ error: "not_configured" }, 503, "no-store");
  }

  // Спільний кеш на краю Cloudflare: при сотнях відвідувачів SENET отримує ~1 запит на 30 с
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const cacheKey = new Request(new URL("/api/status", request.url).toString(), { method: "GET" });
  if (cache) {
    const hit = await cache.match(cacheKey).catch(() => null);
    if (hit) return hit;
  }

  let status;
  try {
    status = normalize(await fetchSenet(env));
  } catch (error) {
    console.error("SENET status failed:", error && error.message);
    return json({ error: "upstream" }, 502, "no-store");
  }

  const response = json({ ...status, updatedAt: new Date().toISOString() }, 200, `public, max-age=${cacheSeconds}`);
  if (cache) {
    const put = cache.put(cacheKey, response.clone()).catch(() => {});
    if (typeof waitUntil === "function") waitUntil(put);
  }
  return response;
}

async function fetchSenet(env) {
  const url = env.SENET_API_URL.replace("{club}", encodeURIComponent(env.SENET_CLUB_ID || ""));
  const headerName = env.SENET_AUTH_HEADER || "Authorization";
  const headers = { Accept: "application/json" };
  headers[headerName] = headerName.toLowerCase() === "authorization" ? `Bearer ${env.SENET_API_KEY}` : env.SENET_API_KEY;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) throw new Error(`SENET HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Зводить відповідь SENET до { available, total }
export function normalize(data) {
  const num = (value) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null);

  if (data && !Array.isArray(data)) {
    const available = num(data.available ?? data.free ?? data.free_count ?? data.freeCount);
    if (available !== null) {
      const total = num(data.total ?? data.total_count ?? data.totalCount);
      return { available, total: total !== null && total >= available ? total : null };
    }
  }

  const list = Array.isArray(data) ? data : data && (data.data || data.items || data.computers || data.devices || data.pcs);
  if (!Array.isArray(list)) throw new Error("unknown SENET response shape");

  let total = 0;
  let available = 0;
  for (const pc of list) {
    if (!pc || typeof pc !== "object") continue;
    const state = String(pc.status ?? pc.state ?? "").toLowerCase();
    if (OFF_STATES.has(state) || pc.online === false || pc.enabled === false) continue; // вимкнені ПК не рахуємо
    total++;
    const busy = pc.busy ?? pc.is_busy ?? pc.isBusy ?? pc.occupied ?? pc.in_use ?? pc.inUse;
    if (typeof busy === "boolean" ? !busy : FREE_STATES.has(state)) available++;
  }
  return { available, total };
}

function json(body, status, cacheControl) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheControl,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function clampInt(value, fallback, min, max) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
