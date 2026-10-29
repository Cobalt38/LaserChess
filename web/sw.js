// Service worker della versione web: il gioco installato dal browser (manifest.webmanifest) si apre
// anche senza internet. web/build.mjs scrive qui la versione e l'elenco dei file del gioco.
// - pagina: dalla rete se c'è (così arriva la versione nuova), altrimenti dalla copia salvata;
// - script, stile, immagini, librerie dal CDN: dalla copia salvata (hanno ?v=versione nell'indirizzo,
//   quindi una versione nuova ha indirizzi nuovi);
// - version.json, download/: sempre dalla rete (servono a sapere se c'è qualcosa di nuovo).
const VERSION = "__VERSION__";
const FILES = __FILES__;
const CACHE = `laserchess-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

// Via le copie delle versioni vecchie
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith("laserchess-") && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname.endsWith("/version.json") || url.pathname.includes("/download/")) return;
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put("index.html", copy));
      }
      return res;
    }).catch(() => caches.match("index.html")));
    return;
  }
  event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
