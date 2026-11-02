/* Kosmo: aplikacija se naloži tudi brez interneta (zadnja naložena različica). */
const CACHE = "kjejekos-v11";
const SHELL = ["./", "index.html", "sat.js", "megatischler.js", "corpus.js", "config.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-180.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.endsWith("supabase.co")) return;                      // podatki vedno z interneta
  const isLib = /cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com/.test(url.hostname);
  if (isLib) {                                                            // knjižnice: iz predpomnilnika, sicer z interneta
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const c = res.clone(); caches.open(CACHE).then(k => k.put(req, c)); return res; })));
    return;
  }
  if (url.origin === location.origin) {                                   // aplikacija: najprej splet (posodobitve), sicer shranjena
    e.respondWith(fetch(req).then(res => { const c = res.clone(); caches.open(CACHE).then(k => k.put(req, c)); return res; }).catch(() => caches.match(req).then(r => r || caches.match("index.html"))));
  }
});
