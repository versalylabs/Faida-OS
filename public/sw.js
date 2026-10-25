// Faida OS Service Worker - Offline Caching & PWA Support
const CACHE_NAME = "faida-os-v1";
const STATIC_CACHE = "faida-static-v1";
const PAGES_CACHE = "faida-pages-v1";
const API_CACHE = "faida-api-v1";

const PRECACHE_ASSETS = [
  "/",
  "/favicon.ico",
  "/icon.svg",
  "/manifest.webmanifest",
];

// Install event - precache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn("[SW] Precache failed partly:", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (![CACHE_NAME, STATIC_CACHE, PAGES_CACHE, API_CACHE].includes(key)) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-http(s) requests (e.g. chrome-extension://)
  if (!url.protocol.startsWith("http")) return;

  // 1. Navigation requests (HTML pages)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(PAGES_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request);
          if (cachedPage) return cachedPage;
          const fallback = await caches.match("/");
          if (fallback) return fallback;
          return new Response(
            `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Faida OS - Offline</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="background:#020617;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;padding:20px;max-width:400px"><h2 style="color:#60a5fa">Faida OS (Offline)</h2><p style="color:#94a3b8;font-size:14px">You are offline. Cached pages will load once available.</p><button onclick="window.location.reload()" style="background:#2563eb;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:bold">Try Again</button></div></body></html>`,
            { headers: { "Content-Type": "text/html" } }
          );
        })
    );
    return;
  }

  // 2. Static assets: _next/static, images, fonts, icons (Cache-first)
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            if (response.status === 200) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
      })
    );
    return;
  }

  // 3. API GET requests (Network-first with cache fallback)
  if (url.pathname.startsWith("/api/") && request.method === "GET") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(API_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response(JSON.stringify({ success: false, offline: true, error: "Offline" }), {
            headers: { "Content-Type": "application/json" },
          });
        })
    );
    return;
  }
});
