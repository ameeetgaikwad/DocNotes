// DocNotes service worker — minimal, install-only.
// Intentionally does NOT cache or intercept tRPC/auth requests; the app's
// data is server-authoritative (Clerk + Neon) and offline operation
// would need designed sync. This SW exists so the PWA install criteria
// are met (manifest + scoped, controlled by an active SW).

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Pass-through fetch handler. Present so the SW "controls" the page,
// which Chromium requires before showing the install prompt.
self.addEventListener("fetch", () => {
  // Default network behaviour — no interception.
});
