// Faida OS Service Worker - offline pages & PWA support.
//
// What it stores: the app's pages (HTML), their scripts/styles/fonts and images. API responses
// contain private, per-account data and are never stored here; the app keeps its own
// per-user offline cache instead (see src/lib/offlineSync.ts).
//
// Changing these names makes the activate handler delete every older cache.
const STATIC_CACHE = "faida-static-v4";
const PAGES_CACHE = "faida-pages-v4";

// Every page of the app. After sign-in the app asks the worker to save all of them (plus the
// scripts each needs) so any page can open offline, even one never visited before.
const APP_ROUTES = [
  "/", "/tasks", "/projects", "/notes", "/finance", "/business", "/university", "/planner",
  "/calendar", "/learning", "/files", "/shopping", "/menu", "/maintenance", "/analytics",
  "/developer", "/lazy", "/settings", "/capture",
];

const PRECACHE_ASSETS = ["/favicon.ico", "/icon.svg", "/manifest.webmanifest", "/icon-192.png"];

// A saved page is reused if the network is slower than this.
const NAVIGATION_TIMEOUT_MS = 4000;
// Re-save pages at most this often.
const PRECACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const META_URL = "/__faida_meta/precached-at";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      Promise.all(PRECACHE_ASSETS.map((u) => cache.add(u).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => ![STATIC_CACHE, PAGES_CACHE].includes(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ---- helpers -------------------------------------------------------------------------------

/** Script, style and font addresses mentioned in a page's HTML (including the inline data Next.js embeds). */
function findAssets(html) {
  const found = new Set();
  const re = /(?:\/_next\/)?static\/(?:chunks|css|media)\/[A-Za-z0-9_\-./%~]+\.(?:js|css|woff2?)/g;
  let m;
  while ((m = re.exec(html))) {
    const path = m[0].startsWith("/_next/") ? m[0] : "/_next/" + m[0];
    found.add(path);
  }
  return [...found];
}

async function saveAssets(urls) {
  const cache = await caches.open(STATIC_CACHE);
  for (const url of urls) {
    try {
      if (await cache.match(url)) continue;
      const res = await fetch(url);
      if (res.ok) await cache.put(url, res);
    } catch {
      /* skipped: it will be saved the next time it is requested online */
    }
  }
}

async function savePage(route) {
  const res = await fetch(route, { credentials: "same-origin" });
  // A redirect means "not signed in" (-> /login); saving it under this address would be wrong.
  if (!res.ok || res.redirected) return false;
  const copy = res.clone();
  const html = await res.text();
  const pages = await caches.open(PAGES_CACHE);
  await pages.put(route, copy);
  await saveAssets(findAssets(html));
  return true;
}

async function precacheAllPages(force) {
  const pages = await caches.open(PAGES_CACHE);
  if (!force) {
    const meta = await pages.match(META_URL);
    if (meta) {
      const at = Number(await meta.text());
      const complete = (await Promise.all(APP_ROUTES.map((r) => pages.match(r)))).every(Boolean);
      if (complete && Date.now() - at < PRECACHE_MAX_AGE_MS) return { saved: APP_ROUTES.length, skipped: true };
    }
  }
  let saved = 0;
  for (const route of APP_ROUTES) {
    try {
      if (await savePage(route)) saved++;
    } catch {
      /* offline or server busy: the rest still get a chance */
    }
  }
  if (saved > 0) await pages.put(META_URL, new Response(String(Date.now())));
  return { saved, skipped: false };
}

function offlinePage() {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Faida OS - Offline</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="background:#020617;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;"><div style="text-align:center;padding:24px;max-width:420px"><h2 style="color:#60a5fa;margin:0 0 8px">You're offline</h2><p style="color:#94a3b8;font-size:14px;line-height:1.5;margin:0 0 16px">This page hasn't been saved on this device yet. Open it once while online and it will be available offline from then on.</p><a href="/" style="background:#2563eb;color:#fff;text-decoration:none;padding:9px 16px;border-radius:10px;font-weight:bold;font-size:14px;margin-right:8px">Go to Home</a><button onclick="location.reload()" style="background:#1e293b;color:#e2e8f0;border:1px solid #334155;padding:8px 16px;border-radius:10px;cursor:pointer;font-weight:bold;font-size:14px">Try again</button></div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

async function findSavedPage(request) {
  const url = new URL(request.url);
  return (
    (await caches.match(request, { ignoreVary: true })) ||
    // The same page with a different query (e.g. /notes?courseId=...) is the same screen.
    (await caches.match(url.pathname, { ignoreSearch: true, ignoreVary: true }))
  );
}

// ---- messages from the app ---------------------------------------------------------------

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "PRECACHE_PAGES") {
    event.waitUntil(
      precacheAllPages(Boolean(data.force)).then((result) => {
        if (event.source) event.source.postMessage({ type: "PRECACHE_DONE", ...result });
      })
    );
  }
});

// ---- requests ------------------------------------------------------------------------------

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (!url.protocol.startsWith("http") || url.origin !== self.location.origin) return;

  // 1. Pages: use the network, but fall back to the saved copy when it fails or is too slow.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const saved = await findSavedPage(request);

        const network = fetch(request).then((response) => {
          // Skip redirects (e.g. signed-out "/" -> /login) so they are not saved under the wrong address.
          if (response.status === 200 && !response.redirected) {
            const copy = response.clone();
            caches.open(PAGES_CACHE).then((cache) => cache.put(request, copy));
            copy
              .clone()
              .text()
              .then((html) => saveAssets(findAssets(html)))
              .catch(() => {});
          }
          return response;
        });

        if (!saved) return network.catch(() => offlinePage());

        // A saved copy exists: do not make the user wait on a weak connection.
        const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NAVIGATION_TIMEOUT_MS));
        try {
          const winner = await Promise.race([network, timeout]);
          if (winner) return winner;
          network.catch(() => {}); // keep refreshing the saved copy in the background
          return saved;
        } catch {
          return saved;
        }
      })()
    );
    return;
  }

  // 2. Scripts, styles, fonts, images: saved copy first (file names change with every build).
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/bg/") ||
    /\.(svg|ico|png|webp|jpe?g|avif|woff2?)$/.test(url.pathname)
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
          .catch(() => cached || Response.error());
      })
    );
    return;
  }

  // 3. API GETs: network only (private data is never stored here). When the network is down answer
  // 503 so the app falls back to its own per-user offline cache. Mutations are left alone so
  // failures still throw and get queued by the app.
  if (url.pathname.startsWith("/api/") && request.method === "GET") {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(JSON.stringify({ success: false, offline: true, error: "Offline" }), {
            status: 503,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          })
      )
    );
  }
});
