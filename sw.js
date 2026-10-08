/* =====================================================================
   sw.js — guarda la app en el equipo para que abra SIN INTERNET.
   · Siempre abre primero la copia guardada (rápido y sin señal) y en segundo plano baja la versión nueva.
   · Sin internet: usa la copia guardada. Con internet: la versión nueva se usa la próxima vez que se abra la app.
   · Los datos NO pasan por aquí: los sincroniza Firebase (ver core.js).
   Si agregas un archivo nuevo a css/, js/ o img/, agrégalo también a ARCHIVOS
   y sube el número de VERSION.
   ===================================================================== */
const VERSION = 'gd-v79';
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
  'css/mantenimiento.css',
  'css/metodologia.css',
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
  'js/mantenimiento.js',
  'js/mantprof.js',
  'js/jsqr.min.js',
  'js/xlsx.js',
  'js/metodologia.js',
  'js/reportes-met.js',
  'js/evaluacion-prof.js',
  'js/sincronizacion.js',
  'js/carrusel.js',
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
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION), fallos = [];
    /* Se instala completa o no se instala: si por mala señal falla la descarga de algún archivo, la instalación se cancela y
       se conserva la versión anterior (que ya está completa en el equipo) hasta que haya mejor conexión.
       Un archivo que no existe en el sitio (error 404) no cuenta como falla. */
    await Promise.all(ARCHIVOS.map(u =>
      fetch(u, {cache:'reload'}).then(r => { if (r.ok) return c.put(u, r); if (r.status !== 404) fallos.push(u); }).catch(() => { fallos.push(u); })));
    await Promise.all(EXTERNOS.map(u =>
      fetch(u, {cache:'reload'}).then(r => r.ok || r.type==='opaque' ? c.put(u, r) : null).catch(() => null)));
    if (fallos.length) { await caches.delete(VERSION); throw new Error('Instalación incompleta por mala conexión (' + fallos.length + ' archivos)'); }
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
  // archivos de la app: SIEMPRE se abre primero la copia guardada (rápido y sin señal, como en una cancha con
  // cobertura mala) y en segundo plano se baja la versión nueva, que se usa la próxima vez que se abra la app.
  const actualizar = fetch(req).then(r => {
    if (r && r.ok) { const cp = r.clone(); caches.open(VERSION).then(c => c.put(req, cp)); }
    return r;
  }).catch(() => null);
  e.waitUntil(actualizar);
  e.respondWith((async () => {
    const hit = await caches.match(req) || await caches.match(req, {ignoreSearch:true})
      || (req.mode === 'navigate' ? await caches.match('index.html') : null);
    if (hit) return hit;
    const r = await conTiempo(actualizar, 8000).catch(() => null);          // primera vez en este equipo: hay que esperar a internet
    if (r) return r;
    if (req.mode === 'navigate') { const h = await caches.match('index.html'); if (h) return h; }
    return Response.error();
  })());
});
