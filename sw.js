/* Service worker: la app funciona completa sin conexión. */
const CACHE = "carpcalc-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./engine.js",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
];

self.addEventListener("install", (ev) => {
  ev.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (ev) => {
  if (ev.request.method !== "GET") return;
  ev.respondWith(
    caches.match(ev.request, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(ev.request).then((res) => {
        if (res.ok && new URL(ev.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(ev.request, copy));
        }
        return res;
      }).catch(() => {
        if (ev.request.mode === "navigate") return caches.match("./index.html");
      });
    })
  );
});
