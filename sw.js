// ============================================================
// MOOD TRACKER — Service Worker
// ============================================================

const CACHE_NAME = "mood-v2";
const ASSETS = ["/", "/index.html"];

// Fenêtres de notification (heure de début, heure de fin)
const WINDOWS = [
  { start: 8,  end: 11, tag: "mood-matin" },
  { start: 12, end: 15, tag: "mood-midi" },
  { start: 18, end: 21, tag: "mood-soir" },
];

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

  // Enregistre le periodic sync si supporté
  e.waitUntil(registerPeriodicSync());
});

async function registerPeriodicSync() {
  try {
    await self.registration.periodicSync.register("mood-check", {
      minInterval: 60 * 60 * 1000 // 1h minimum (le navigateur décide de la fréquence réelle)
    });
  } catch (_) {
    // Periodic sync non supporté — fallback sur le check à l'activation
  }
}

// ── Periodic Background Sync ──────────────────────────────────
self.addEventListener("periodicsync", e => {
  if (e.tag === "mood-check") {
    e.waitUntil(checkAndNotify());
  }
});

// ── Check à chaque activation du SW ──────────────────────────
// (se déclenche aussi quand l'app est ouverte ou qu'une notif est cliquée)
self.addEventListener("activate", e => {
  e.waitUntil(checkAndNotify());
});

async function checkAndNotify() {
  const now = new Date();
  const hour = now.getHours();
  const todayKey = now.toDateString();

  // Récupère les fenêtres déjà notifiées aujourd'hui (stockées dans IndexedDB via le client)
  const fired = await getFired(todayKey);

  for (const w of WINDOWS) {
    if (hour >= w.start && hour < w.end && !fired.includes(w.tag)) {
      await self.registration.showNotification("Mood 🌡️", {
        body: notifBody(w),
        tag: w.tag,
        renotify: false,
        vibrate: [100, 50, 100],
        actions: [{ action: "open", title: "Logger" }],
        data: { url: "/", tag: w.tag, todayKey }
      });
      await markFired(todayKey, w.tag);
    }
  }
}

function notifBody(w) {
  const msgs = {
    "mood-matin": "Bonjour — comment tu te sens ce matin ?",
    "mood-midi":  "Pause de midi — un check-in rapide ?",
    "mood-soir":  "Fin de journée — comment ça s'est passé ?",
  };
  return msgs[w.tag] || "Comment tu te sens ?";
}

// ── Stockage léger dans le SW (via Cache API comme KV) ───────
const KV_CACHE = "mood-kv";

async function getFired(todayKey) {
  try {
    const cache = await caches.open(KV_CACHE);
    const res = await cache.match("fired-" + todayKey);
    if (!res) return [];
    return await res.json();
  } catch (_) { return []; }
}

async function markFired(todayKey, tag) {
  try {
    const cache = await caches.open(KV_CACHE);
    const existing = await getFired(todayKey);
    if (!existing.includes(tag)) existing.push(tag);
    await cache.put("fired-" + todayKey, new Response(JSON.stringify(existing)));
    // Nettoie les vieux jours
    const keys = await cache.keys();
    for (const key of keys) {
      if (key.url.includes("fired-") && !key.url.includes(todayKey)) {
        await cache.delete(key);
      }
    }
  } catch (_) {}
}

// ── Messages from main thread ─────────────────────────────────
self.addEventListener("message", e => {
  if (e.data && e.data.type === "SHOW_NOTIF") {
    self.registration.showNotification("Mood 🌡️", {
      body: e.data.body || "Comment tu te sens ?",
      tag: "mood-manual",
      renotify: true,
      vibrate: [100, 50, 100],
      actions: [{ action: "open", title: "Logger" }],
      data: { url: "/" }
    });
  }
  if (e.data && e.data.type === "CHECK_NOW") {
    checkAndNotify();
  }
});

// ── Notification click ────────────────────────────────────────
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});

// ── Fetch (offline fallback) ──────────────────────────────────
self.addEventListener("fetch", e => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
