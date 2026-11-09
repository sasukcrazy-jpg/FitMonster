const CACHE = 'fitmonster-v3';
const SHELL = ['/', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Nunca interceptar a API de pagamento
  if (req.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  // Não mexer em nada de outros domínios (fontes, ícones, Tailwind): o navegador cuida disso
  if (url.origin !== self.location.origin) return;

  // Páginas: rede primeiro, cache como reserva (funciona offline)
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put('/', copy)); return r; })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Demais arquivos: usa o cache e atualiza em segundo plano
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((r) => {
          if (r && r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
          return r;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
