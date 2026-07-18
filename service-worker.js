const CACHE_NAME = "bakkal-stok-v4-networkfirst";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./js/i18n.js",
  "./js/firebase-config.js",
  "./js/bulk-scan-config.js",
  "./js/admin-config.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

// ---- Share Target: galeriden/başka uygulamadan paylaşılan fotoğrafı yakala ----
async function handleShareTarget(event) {
  try {
    const formData = await event.request.formData();
    const file = formData.get("photos");
    if (file) {
      const cache = await caches.open("shared-photo-cache");
      await cache.put("/shared-photo", new Response(file));
    }
  } catch (e) {
    // paylaşım okunamadıysa sessizce devam et
  }
  return Response.redirect("./index.html?shared=1", 303);
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Paylaşılan fotoğraf isteği (manifest.json > share_target)
  if (event.request.method === "POST" && url.pathname.endsWith("/index.html")) {
    event.respondWith(handleShareTarget(event));
    return;
  }

  if (event.request.method !== "GET") return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  // "Network first" stratejisi: HER ZAMAN önce internetten taze veri çekmeyi
  // dener, sadece internet yoksa (çevrimdışıysa) önbelleğe döner.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ---- Push Notifications (Firebase Cloud Messaging) ----
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");
importScripts("./js/firebase-config.js");

if (typeof firebaseConfig !== "undefined" && firebaseConfig.apiKey && firebaseConfig.apiKey.indexOf("BURAYA") !== 0) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = (payload.notification && payload.notification.title) || "Bakkal Stok Takip";
    const options = {
      body: (payload.notification && payload.notification.body) || "",
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png"
    };
    self.registration.showNotification(title, options);
  });
}

// ---- Background Sync: bağlantı geri gelince açık sekmelere haber ver ----
self.addEventListener("sync", (event) => {
  if (event.tag === "bakkal-sync") {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => client.postMessage({ type: "BAKKAL_SYNC_RECONNECTED" }));
      })
    );
  }
});

// ---- Periodic Background Sync: uygulama kapalıyken bile temel dosyaları tazele ----
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "bakkal-refresh") {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
    );
  }
});
