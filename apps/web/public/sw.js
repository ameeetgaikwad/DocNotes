// ClinikNote service worker — offline navigation fallback (Manoj msg
// 2040, diagnosed 2043-2044). When the network is down or a local
// mid-box responds with a bad TLS cert (router captive portal, ISP
// NXDOMAIN redirect, etc.), navigation requests are transparently
// served the cached /offline.html instead of Chrome's scary
// "Your connection is not private" screen. All non-navigation
// requests pass through — no interception of tRPC/auth/live data.

// Amit msg 2318: bumped from v1 → v2 so activate() will purge the
// stale v1 cache and clients pick up the offline-page + fetch handler
// changes on next load.
const CACHE_VERSION = "cn-offline-v2";
const OFFLINE_URL = "/offline.html";
const PRECACHE_URLS = [OFFLINE_URL, "/icon.svg", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Purge older cache versions so the app doesn't accumulate stale
      // offline pages across releases.
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Amit msg 2318: precached assets (icon.svg, manifest.json) must
  // fall back to the cache on network failure — otherwise the offline
  // page loaded fine but its <img src="/icon.svg"> broke because the
  // asset request wasn't a navigation and passed through to a dead
  // network. Handle precached URLs first: try network, fall back to
  // cache on any error. Non-navigation requests for URLs outside the
  // precache list still pass through unchanged so live data isn't
  // stale-cached.
  const url = new URL(request.url);
  if (
    request.method === "GET" &&
    url.origin === self.location.origin &&
    PRECACHE_URLS.includes(url.pathname)
  ) {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(CACHE_VERSION);
          const cached = await cache.match(url.pathname);
          if (cached) return cached;
          throw new Error("Precached asset missing from cache");
        }
      })(),
    );
    return;
  }

  // Navigation requests — same behaviour as before: try network,
  // serve the cached offline page on any failure.
  if (request.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      try {
        const networkResponse = await fetch(request);
        return networkResponse;
      } catch {
        const cache = await caches.open(CACHE_VERSION);
        const cached = await cache.match(OFFLINE_URL);
        if (cached) return cached;
        return new Response("Offline", {
          status: 503,
          statusText: "Offline",
          headers: { "Content-Type": "text/plain" },
        });
      }
    })(),
  );
});
