// GET  /api/tv-config — публічна конфігурація TV-екрана клубу (банери 16:9 + QR-картки + мова/інтервал).
// POST /api/tv-config — оновлення з Vade Launcher (Authorization: Bearer <VADE_TOKEN>).
//
// Дані зберігаються у Cloudflare D1 (нарізка чанками по 64 КБ у таблиці tv_config_chunks),
// щоб без ліміту на розмір одного рядка безпечно тримати оптимізовані WebP-зображення до ~4 МБ.

import { json, sameSecret, bearer } from "../_lib/pcs.js";

const CHUNK_SIZE = 65536;
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const DEFAULT_PORT = 7425;
const SAFE_DATA_IMAGE_RE = /^data:image\/(?:webp|jpeg|jpg|png|svg\+xml);base64,[A-Za-z0-9+/=]+$/i;
const SAFE_LOCAL_ASSET_RE = /^\/tv-assets\/[a-f0-9]{16}\.(?:webp|jpg|jpeg|png|svg)$/i;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

let tvSchemaReady = false;
async function ensureTvSchema(db) {
  if (tvSchemaReady) return;
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS tv_config_meta (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        updated_at INTEGER NOT NULL,
        total_bytes INTEGER NOT NULL,
        chunk_count INTEGER NOT NULL
      )`
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS tv_config_chunks (
        idx INTEGER PRIMARY KEY,
        data TEXT NOT NULL
      )`
    )
    .run();
  tvSchemaReady = true;
}

export function defaultTvConfig() {
  return {
    updatedAt: 0,
    lang: "pl",
    defaultSlideDurationSec: 8,
    localServerEnabled: true,
    localServerPort: DEFAULT_PORT,
    slides: [],
    qrCards: [],
  };
}

function isSafeImageRef(v) {
  if (typeof v !== "string") return false;
  const s = v.trim();
  if (!s || s.length > 1_500_000) return false;
  return SAFE_DATA_IMAGE_RE.test(s) || SAFE_LOCAL_ASSET_RE.test(s);
}

function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function normalizeLang(v) {
  if (v === "pl" || v === "ua" || v === "en") return v;
  if (v === "uk") return "ua";
  return "pl";
}

function cleanUniqueId(raw, used, prefix) {
  let id = typeof raw === "string" ? raw.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48) : "";
  if (!id || used.has(id)) {
    let n = used.size + 1;
    while (used.has(`${prefix}-${n}`)) n++;
    id = `${prefix}-${n}`;
  }
  used.add(id);
  return id;
}

export function sanitizeTvConfig(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const defaultSlideDurationSec = clampInt(src.defaultSlideDurationSec, 5, 30, 8);
  const updatedAtRaw = Number(src.updatedAt);
  const updatedAt = Number.isFinite(updatedAtRaw) && updatedAtRaw > 0 ? Math.floor(updatedAtRaw) : Date.now();

  const slideIds = new Set();
  const slides = [];
  for (const item of Array.isArray(src.slides) ? src.slides : []) {
    if (slides.length >= 8) break;
    if (!item || typeof item !== "object") continue;
    const imageDataUrl = isSafeImageRef(item.imageDataUrl) ? item.imageDataUrl.trim() : "";
    const mode = item.mode === "with_text" ? "with_text" : "image_only";
    const title = typeof item.title === "string" ? item.title.trim().slice(0, 120) : "";
    const subtitle = typeof item.subtitle === "string" ? item.subtitle.trim().slice(0, 220) : "";
    const durationSec =
      item.durationSec != null && item.durationSec !== ""
        ? clampInt(item.durationSec, 5, 30, defaultSlideDurationSec)
        : undefined;
    slides.push({
      id: cleanUniqueId(item.id, slideIds, "slide"),
      enabled: item.enabled !== false,
      imageDataUrl,
      mode,
      ...(title ? { title } : {}),
      ...(subtitle ? { subtitle } : {}),
      ...(durationSec !== undefined ? { durationSec } : {}),
    });
  }

  const cardIds = new Set();
  const qrCards = [];
  for (const item of Array.isArray(src.qrCards) ? src.qrCards : []) {
    if (qrCards.length >= 4) break;
    if (!item || typeof item !== "object") continue;
    const label = typeof item.label === "string" ? item.label.trim().slice(0, 40) : "";
    const sublabel = typeof item.sublabel === "string" ? item.sublabel.trim().slice(0, 60) : "";
    const qrSource = item.qrSource === "upload" ? "upload" : "generate";
    const qrText = typeof item.qrText === "string" ? item.qrText.trim().slice(0, 500) : "";
    const qrImageDataUrl = isSafeImageRef(item.qrImageDataUrl) ? item.qrImageDataUrl.trim() : undefined;
    const bgType = item.bgType === "image" ? "image" : "color";
    const bgColorRaw = typeof item.bgColor === "string" ? item.bgColor.trim() : "";
    const bgColor = HEX_COLOR_RE.test(bgColorRaw) ? bgColorRaw.toLowerCase() : "#161b26";
    const bgImageDataUrl = isSafeImageRef(item.bgImageDataUrl) ? item.bgImageDataUrl.trim() : undefined;
    qrCards.push({
      id: cleanUniqueId(item.id, cardIds, "qr"),
      enabled: item.enabled !== false,
      label,
      ...(sublabel ? { sublabel } : {}),
      qrSource,
      ...(qrText ? { qrText } : {}),
      ...(qrImageDataUrl ? { qrImageDataUrl } : {}),
      bgType,
      bgColor,
      ...(bgImageDataUrl ? { bgImageDataUrl } : {}),
    });
  }

  return {
    updatedAt,
    lang: normalizeLang(src.lang),
    defaultSlideDurationSec,
    localServerEnabled: typeof src.localServerEnabled === "boolean" ? src.localServerEnabled : true,
    localServerPort: clampInt(src.localServerPort, 1024, 65535, DEFAULT_PORT),
    slides,
    qrCards,
  };
}

export async function onRequestGet({ env }) {
  if (!env.DB) return json({ error: "D1 database is not bound as DB" }, 503, { "Cache-Control": "no-store" });
  const db = env.DB;
  await ensureTvSchema(db);

  const [metaRes, chunksRes] = await db.batch([
    db.prepare("SELECT updated_at, total_bytes, chunk_count FROM tv_config_meta WHERE id = 1"),
    db.prepare("SELECT data FROM tv_config_chunks ORDER BY idx ASC"),
  ]);

  const meta = metaRes.results?.[0];
  const chunks = chunksRes.results || [];
  if (!meta || !chunks.length) {
    return json(defaultTvConfig(), 200, { "Cache-Control": "public, max-age=15" });
  }

  try {
    const raw = chunks.map((r) => r.data).join("");
    const parsed = JSON.parse(raw);
    const clean = sanitizeTvConfig(parsed);
    if (!Number.isFinite(Number(parsed?.updatedAt))) clean.updatedAt = Number(meta.updated_at) || 0;
    return json(clean, 200, { "Cache-Control": "public, max-age=15" });
  } catch {
    return json(defaultTvConfig(), 200, { "Cache-Control": "no-store" });
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "D1 database is not bound as DB" }, 503);
  if (!sameSecret(bearer(request), env.VADE_TOKEN)) return json({ error: "unauthorized" }, 401);

  let rawText;
  try {
    rawText = await request.text();
  } catch {
    return json({ error: "bad body" }, 400);
  }
  const byteLength = new TextEncoder().encode(rawText).byteLength;
  if (byteLength > MAX_BODY_BYTES) return json({ error: "payload too large" }, 413);

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return json({ error: "bad json" }, 400);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return json({ error: "bad payload" }, 400);
  }

  const clean = sanitizeTvConfig(parsed);
  if (!clean.updatedAt) clean.updatedAt = Date.now();
  const serialized = JSON.stringify(clean);
  const totalBytes = new TextEncoder().encode(serialized).byteLength;
  if (totalBytes > MAX_BODY_BYTES) return json({ error: "payload too large" }, 413);

  const chunks = [];
  for (let i = 0; i < serialized.length; i += CHUNK_SIZE) {
    chunks.push(serialized.slice(i, i + CHUNK_SIZE));
  }

  const db = env.DB;
  await ensureTvSchema(db);
  const stmts = [db.prepare("DELETE FROM tv_config_chunks")];
  chunks.forEach((chunk, idx) => {
    stmts.push(db.prepare("INSERT INTO tv_config_chunks (idx, data) VALUES (?1, ?2)").bind(idx, chunk));
  });
  stmts.push(
    db
      .prepare(
        `INSERT OR REPLACE INTO tv_config_meta (id, updated_at, total_bytes, chunk_count)
         VALUES (1, ?1, ?2, ?3)`
      )
      .bind(clean.updatedAt, totalBytes, chunks.length)
  );
  await db.batch(stmts);

  return json({
    ok: true,
    updatedAt: clean.updatedAt,
    slides: clean.slides.length,
    qrCards: clean.qrCards.length,
    bytes: totalBytes,
  });
}

export function onRequest() {
  return json({ error: "method not allowed" }, 405, { Allow: "GET, POST" });
}
