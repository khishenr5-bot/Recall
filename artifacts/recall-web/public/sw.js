const CACHE_NAME = "recall-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

// Handle share target POST (not needed since we use GET, but good practice)
self.addEventListener("fetch", (event) => {
  // Pass through all requests — no offline caching needed for this PWA
  return;
});
