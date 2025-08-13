const CACHE = "hok-counter-v1";
const ASSETS = [
  "/", "/index.html", "/manifest.webmanifest"
  // + tambahkan file build (mis. /assets/index-*.js dan *.css)
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request).then(net => {
      const copy = net.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => { });
      return net;
    }).catch(() => caches.match("/index.html")))
  );
});
