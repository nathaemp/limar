// Limamar: guarda o app e a carta no celular para abrir sem sinal.
const SHELL_CACHE = 'limar-v4';
const CARTA_CACHE = 'limar-cartas-v1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'cartas/cartas.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL_CACHE && k !== CARTA_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function withTimeout(p, ms) {
  return new Promise((ok, no) => { const t = setTimeout(() => no(new Error('timeout')), ms); p.then(r => { clearTimeout(t); ok(r); }, e => { clearTimeout(t); no(e); }); });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Previsão do tempo: sempre da rede (o app guarda a última cópia sozinho)
  if (url.hostname.endsWith('open-meteo.com')) return;
  if (url.origin === self.location.origin) {
    // Pedaços da carta: primeiro do celular, depois da internet
    if (url.pathname.includes('/cartas/') && url.pathname.endsWith('.webp')) {
      e.respondWith(caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CARTA_CACHE).then(c => c.put(req, copy)); }
        return res;
      })));
      return;
    }
    // App: tenta a internet (até 4 s); sem sinal, usa a cópia salva
    e.respondWith(
      withTimeout(fetch(req, { cache: 'no-cache' }), 4000).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(SHELL_CACHE).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
    );
    return;
  }
  // Fontes do Google: cópia salva primeiro
  if (url.hostname.includes('fonts.g')) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(SHELL_CACHE).then(c => c.put(req, copy));
      return res;
    })));
  }
});
