// ClinikNote service worker — offline navigation fallback (Manoj msg
// 2040, diagnosed 2043-2044). When the network is down or a local
// mid-box responds with a bad TLS cert (router captive portal, ISP
// NXDOMAIN redirect, etc.), navigation requests are transparently
// served the cached /offline.html instead of Chrome's scary
// "Your connection is not private" screen. All non-navigation
// requests pass through — no interception of tRPC/auth/live data.

const CACHE_VERSION = "cn-offline-v1";
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
  // Only intercept top-level navigations — everything else (assets,
  // tRPC, Clerk, images) falls through to the network unchanged so
  // errors bubble up normally and live data isn't stale-cached.
  if (request.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      try {
        const networkResponse = await fetch(request);
        return networkResponse;
      } catch {
        // Network failure of any kind (offline, DNS, TLS/cert error,
        // timeout) → serve the pre-cached offline page.
        const cache = await caches.open(CACHE_VERSION);
        const cached = await cache.match(OFFLINE_URL);
        if (cached) return cached;
        // Last-ditch fallback — an empty 503 rather than throwing so
        // the browser doesn't show its own error page.
        return new Response("Offline", {
          status: 503,
          statusText: "Offline",
          headers: { "Content-Type": "text/plain" },
        });
      }
    })(),
  );
});
