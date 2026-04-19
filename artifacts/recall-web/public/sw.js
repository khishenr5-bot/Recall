/* Recall AI Service Worker — full offline + Background Sync */
const VERSION = "v3.0.0";
const SHELL_CACHE = `recall-shell-${VERSION}`;
const STATIC_CACHE = `recall-static-${VERSION}`;
const RUNTIME_CACHE = `recall-runtime-${VERSION}`;
const LIBRARY_CACHE = `recall-library-${VERSION}`;
const OFFLINE_URL = "/offline.html";

const SHELL_URLS = [
  "/",
  "/offline.html",
  "/manifest.json",
  "/icons/icon-72.png",
  "/icons/icon-96.png",
  "/icons/icon-128.png",
  "/icons/icon-144.png",
  "/icons/icon-152.png",
  "/icons/icon-192.png",
  "/icons/icon-384.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_URLS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => ![SHELL_CACHE, STATIC_CACHE, RUNTIME_CACHE, LIBRARY_CACHE].includes(k))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  // Cache the user's library for offline browsing
  if (url.pathname === "/api/saved" && req.method === "GET") {
    event.respondWith(libraryNetworkFirst(req));
    return;
  }

  // Queue offline saves via Background Sync
  if (url.pathname === "/api/saved" && req.method === "POST") {
    event.respondWith(saveWithBackgroundSync(req));
    return;
  }

  // Don't intercept other API calls
  if (url.pathname.startsWith("/api/")) return;

  // SPA navigations: network-first, fallback to cached shell, then offline page
  if (req.mode === "navigate") {
    event.respondWith(navigationHandler(req));
    return;
  }

  // Static assets: cache-first
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/screenshots/") ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/widgets/") ||
    /\.(png|jpg|jpeg|svg|webp|ico|woff2?|ttf|css|js)$/.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }
});

async function navigationHandler(req) {
  try {
    const fresh = await fetch(req);
    const cache = await caches.open(SHELL_CACHE);
    cache.put("/", fresh.clone()).catch(() => {});
    return fresh;
  } catch {
    const cached = (await caches.match(req)) || (await caches.match("/"));
    return cached || caches.match(OFFLINE_URL);
  }
}

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh.ok) {
      const cache = await caches.open(cacheName);
      cache.put(req, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch {
    return cached || Response.error();
  }
}

async function libraryNetworkFirst(req) {
  try {
    const fresh = await fetch(req);
    if (fresh.ok) {
      const clone = fresh.clone();
      const cache = await caches.open(LIBRARY_CACHE);
      // Trim to most recent 50 items before caching
      try {
        const data = await clone.clone().json();
        if (Array.isArray(data)) {
          const trimmed = data.slice(0, 50);
          const trimmedRes = new Response(JSON.stringify(trimmed), {
            status: 200,
            headers: { "Content-Type": "application/json", "X-Recall-Cached": "true" },
          });
          cache.put(req, trimmedRes).catch(() => {});
        } else {
          cache.put(req, clone).catch(() => {});
        }
      } catch {
        cache.put(req, clone).catch(() => {});
      }
      return fresh;
    }
    return fresh;
  } catch {
    const cached = await caches.match(req, { cacheName: LIBRARY_CACHE });
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set("X-Recall-Offline", "true");
      const body = await cached.text();
      return new Response(body, { status: 200, headers });
    }
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json", "X-Recall-Offline": "true" },
    });
  }
}

/* ─── Background Sync for offline saves ───────────────────────────────────── */
async function saveWithBackgroundSync(req) {
  try {
    return await fetch(req.clone());
  } catch {
    const body = await req.clone().text();
    await queueSave({
      url: req.url,
      method: req.method,
      headers: [...req.headers.entries()],
      body,
      ts: Date.now(),
    });
    if ("sync" in self.registration) {
      try {
        await self.registration.sync.register("recall-save-queue");
      } catch {}
    }
    return new Response(
      JSON.stringify({ queued: true, message: "Will sync when online" }),
      { status: 202, headers: { "Content-Type": "application/json" } }
    );
  }
}

const QUEUE_DB = "recall-queue";
const QUEUE_STORE = "saves";

function openQueueDB() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(QUEUE_DB, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore(QUEUE_STORE, { keyPath: "ts" });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function queueSave(item) {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    tx.objectStore(QUEUE_STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function drainQueue() {
  const db = await openQueueDB();
  const items = await new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readonly");
    const req = tx.objectStore(QUEUE_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  for (const item of items) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: new Headers(item.headers),
        body: item.body,
      });
      if (res.ok) {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(QUEUE_STORE, "readwrite");
          tx.objectStore(QUEUE_STORE).delete(item.ts);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      }
    } catch {
      // remain queued
    }
  }
}

self.addEventListener("sync", (event) => {
  if (event.tag === "recall-save-queue") {
    event.waitUntil(drainQueue());
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
  if (event.data === "drainQueue") event.waitUntil(drainQueue());
});
