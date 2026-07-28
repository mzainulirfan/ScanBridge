const CACHE_NAME = "scanbridge-shell-v2";
const APP_SHELL = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    (event.request.mode === "navigate"
      ? fetch(event.request)
          .then((response) => {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
            return response;
          })
          .catch(() => caches.match("/"))
      : caches.match(event.request).then((cached) => {
          const network = fetch(event.request)
            .then((response) => {
              if (response.ok) {
                const copy = response.clone();
                void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
              }
              return response;
            })
            .catch(() => cached ?? caches.match("/"));
          return cached ?? network;
        }))
  );
});
