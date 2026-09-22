/* =====================================================================
   sw.js — guarda la app en el equipo para que abra SIN INTERNET.
   · Con internet: siempre descarga la versión más nueva (y la guarda).
   · Sin internet: usa la copia guardada.
   · Los datos NO pasan por aquí: los sincroniza Firebase (ver core.js).
   Si agregas un archivo nuevo a css/, js/ o img/, agrégalo también a ARCHIVOS
   y sube el número de VERSION.
   ===================================================================== */
const VERSION = 'gd-v40';
const ARCHIVOS = [
  './',
  'index.html',
  'manifest.json',
  'css/analisis.css',
  'css/app-desktop.css',
  'css/app-mobile.css',
  'css/gimnasio.css',
  'css/glassmorphism.css',
  'css/main.css',
  'css/servicios.css',
  'js/aforos.js',
  'js/ajustes.js',
  'js/analisis.js',
  'js/app.js',
  'js/auth.js',
  'js/calendario.js',
  'js/config.js',
  'js/core.js',
  'js/dashboard.js',
  'js/desglose.js',
  'js/eventos.js',
  'js/gimnasio.js',
  'js/graficas.js',
  'js/iconos.js',
  'js/impresion.js',
  'js/lista.js',
  'js/listarapida.js',
  'js/mobile.js',
  'js/portal.js',
  'js/profesores.js',
  'js/recepcion.js',
  'js/registros.js',
  'js/reportes.js',
  'js/servicios.js',
  'js/sidebar.js',
  'js/simulacion.js',
  'js/vinculo.js',
  'img/apple-touch-icon.png',
  'img/favicon-32.png',
  'img/icon-192.png',
  'img/icon-512.png',
  'img/logo.png',
  'img/membrete.png',
  'img/textura-clara.svg',
  'img/textura.svg'
];
const EXTERNOS = [
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await Promise.all([...ARCHIVOS, ...EXTERNOS].map(u =>
      fetch(u, {cache:'reload'}).then(r => r.ok || r.type==='opaque' ? c.put(u, r) : null).catch(()=>null)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

const conTiempo = (p, ms) => Promise.race([p, new Promise((_, ko) => setTimeout(() => ko(new Error('lento')), ms))]);

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Firebase (datos en tiempo real) nunca pasa por la caché
  if (/firebaseio\.com|firebasedatabase\.app|googleapis\.com\/identitytoolkit/.test(url.host + url.pathname)) return;
  const propio = url.origin === self.location.origin;
  const librerias = url.host === 'www.gstatic.com' || url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com' || url.host === 'cdnjs.cloudflare.com';
  if (!propio && !librerias) return;

  if (librerias) {                                   // librerías con versión fija: primero la copia
    e.respondWith(caches.match(req).then(h => h || fetch(req).then(r => {
      const cp = r.clone(); caches.open(VERSION).then(c => c.put(req, cp)); return r;
    })));
    return;
  }
  // archivos de la app: primero internet (versión nueva), si no hay → copia guardada
  e.respondWith((async () => {
    try {
      const r = await conTiempo(fetch(req), 4000);
      if (r.ok) { const cp = r.clone(); caches.open(VERSION).then(c => c.put(req, cp)); }
      return r;
    } catch (err) {
      const h = await caches.match(req) || await caches.match(req, {ignoreSearch:true});
      if (h) return h;
      if (req.mode === 'navigate') return caches.match('index.html');
      throw err;
    }
  })());
});
