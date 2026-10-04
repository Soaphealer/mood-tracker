// ============================================================
// MOOD TRACKER — Service Worker
// Gère les notifications push locales
// ============================================================

const CACHE_NAME = "mood-v1";
const ASSETS = ["/", "/index.html"];

// ── Install ──────────────────────────────────────────────────
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch (offline fallback) ──────────────────────────────────
self.addEventListener("fetch", e => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

// ── Messages from main thread ─────────────────────────────────
self.addEventListener("message", e => {
  if (e.data && e.data.type === "SHOW_NOTIF") {
    self.registration.showNotification("Mood 🌡️", {
      body: e.data.body || "Comment tu te sens ?",
      icon: "/icon.png",
      badge: "/icon.png",
      tag: "mood-check",        // remplace la précédente si elle traîne encore
      renotify: true,
      vibrate: [100, 50, 100],
      actions: [
        { action: "open", title: "Logger" }
      ],
      data: { url: "/" }
    });
  }
});

// ── Notification click ────────────────────────────────────────
self.addEventListener("notificationclick", e => {
  e.notification.close();

  const target = (e.notification.data && e.notification.data.url) || "/";

  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
      // Focus existing tab if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open new tab
      if (self.clients.openWindow) {
        return self.clients.openWindow(target);
      }
    })
  );
});
