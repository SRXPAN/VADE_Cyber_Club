/* VADE — Service Worker: офлайн-кеш сторінки.
   • Сторінка, config.js, app.js, styles.css — «спершу мережа»: зміни в config.js видно одразу,
     а без інтернету відкривається остання збережена версія.
   • Картинки, іконки та шрифти — «спершу кеш»: відкриваються миттєво, оновлюються у фоні.
   • /api/ (вільні ПК), аналітика й карти не кешуються ніколи.
   Змінили список CORE нижче — збільште VERSION, щоб старий кеш видалився. */

const VERSION = "vade-v1";
const CORE = [
  "./",
  "index.html",
  "styles.css",
  "config.js",
  "app.js",
  "manifest.json",
  "assets/logo.svg",
  "assets/favicon.svg",
  "assets/favicon-32.png",
  "assets/apple-touch-icon.png",
  "assets/icon-192.png",
  "assets/icon-512.png",
];
// Сторонні файли, які варто мати офлайн: шрифти Google і бібліотека QR-коду
const CACHEABLE_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com", "cdnjs.cloudflare.com"];
const NETWORK_TIMEOUT = 4000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      // cache: "reload" — беремо свіжі файли з сервера, а не з HTTP-кешу браузера
      .then((cache) => cache.addAll(CORE.map((path) => new Request(path, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.includes("/api/")) return; // живі дані — лише з мережі
    if (request.mode === "navigate") {
      event.respondWith(networkFirst(request, pageKey(url)));
      return;
    }
    if (/\.(?:js|css|json)$/.test(url.pathname)) {
      event.respondWith(networkFirst(request, url.origin + url.pathname));
      return;
    }
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (CACHEABLE_HOSTS.includes(url.hostname)) event.respondWith(staleWhileRevalidate(request));
  // усе інше (аналітика, Google Maps, пікселі) — без втручання
});

// ?lang=, ?utm_… не множать копії сторінки в кеші: усі зберігаються під одною адресою
function pageKey(url) {
  return url.origin + url.pathname;
}

function cacheable(response) {
  return response && (response.ok || response.type === "opaque");
}

async function networkFirst(request, key) {
  const cache = await caches.open(VERSION);
  try {
    const response = await withTimeout(fetch(request), NETWORK_TIMEOUT);
    if (cacheable(response)) cache.put(key, response.clone());
    return response;
  } catch {
    const cached =
      (await cache.match(key, { ignoreSearch: true })) ||
      (request.mode === "navigate" ? (await cache.match("./")) || (await cache.match("index.html")) : undefined);
    if (cached) return cached;
    return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request);
  const update = fetch(request)
    .then((response) => {
      if (cacheable(response)) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached || Response.error());
  return cached || update;
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
