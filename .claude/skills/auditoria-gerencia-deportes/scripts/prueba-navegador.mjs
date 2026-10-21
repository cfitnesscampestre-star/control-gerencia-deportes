#!/usr/bin/env node
/* Prueba en navegador de Control Gerencia de Deportes, en MODO SIMULACIÓN (sin tocar Firebase).
   Uso: node .claude/skills/auditoria-gerencia-deportes/scripts/prueba-navegador.mjs [carpeta-salida]
   · Copia el proyecto a una carpeta temporal con CONECTAR_FIREBASE = false (el repo no se modifica).
   · Lo sirve en http://localhost, entra como Gerencia y Metodología con las contraseñas de fábrica,
     recorre cada pestaña del menú lateral en escritorio (1366x900) y móvil (390x844).
   · Anota errores de JavaScript, errores de consola, peticiones fallidas, desbordes horizontales
     y botones sin nombre accesible. Guarda capturas y un informe.json en la carpeta de salida. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(path.join(execRoot(), 'playwright'))); }
function execRoot() { return require('node:child_process').execSync('npm root -g').toString().trim(); }

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../..');
const salida = path.resolve(process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'auditoria-gd-')));
fs.mkdirSync(salida, { recursive: true });

// 1. Copia en modo simulación
const copia = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-sim-'));
fs.cpSync(raiz, copia, { recursive: true, filter: s => !/\/(\.git|\.claude|node_modules)(\/|$)/.test(s) });
const cfg = path.join(copia, 'js/config.js');
fs.writeFileSync(cfg, fs.readFileSync(cfg, 'utf8').replace(/const CONECTAR_FIREBASE\s*=\s*true/, 'const CONECTAR_FIREBASE = false'));
const core = fs.readFileSync(path.join(copia, 'js/core.js'), 'utf8');
const clave = n => (core.match(new RegExp(`DEF_PASS_${n}\\s*=\\s*'([^']+)'`)) || [])[1];

// 2. Servidor estático
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((req, res) => {
  const f = path.join(copia, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  if (!f.startsWith(copia) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': tipos[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => srv.listen(0, r));
const URL0 = `http://localhost:${srv.address().port}/`;

const informe = { url: URL0, salida, vistas: [] };
const browser = await chromium.launch();

async function recorrer(rol, clv, nombreVp, viewport) {
  const ctx = await browser.newContext({ viewport, serviceWorkers: 'block', isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
  const page = await ctx.newPage();
  let errores = [];
  page.on('pageerror', e => errores.push('JS: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errores.push('consola: ' + m.text()); });
  page.on('requestfailed', r => { if (r.url().startsWith(URL0)) errores.push('petición fallida: ' + r.url()); });
  page.on('response', r => { if (r.url().startsWith(URL0) && r.status() >= 400) errores.push(`HTTP ${r.status()}: ${r.url()}`); });

  const captura = async (nombre) => {
    await page.waitForTimeout(400);
    const archivo = `${rol}-${nombreVp}-${nombre}.png`.replace(/[^\w.-]+/g, '_');
    await page.screenshot({ path: path.join(salida, archivo), fullPage: true });
    const revision = await page.evaluate(() => {
      const anchoDoc = document.documentElement.scrollWidth, ancho = window.innerWidth;
      const sinNombre = [...document.querySelectorAll('button, a[href], [role=button]')]
        .filter(b => b.offsetParent && !(b.innerText || '').trim() && !b.getAttribute('aria-label') && !b.title).length;
      const pequenos = [...document.querySelectorAll('button, a[href], input, select')]
        .filter(b => { const r = b.getBoundingClientRect(); return b.offsetParent && r.width && (r.width < 32 || r.height < 32); }).length;
      return { desborde: anchoDoc > ancho + 1 ? `${anchoDoc}px > ${ancho}px` : '', sinNombre, pequenos };
    });
    informe.vistas.push({ rol, viewport: nombreVp, vista: nombre, captura: archivo, errores, ...revision });
    errores = [];
  };

  await page.goto(URL0, { waitUntil: 'networkidle' });
  await captura('login');
  await page.click(`[data-act="loginRol"][data-rol="${rol}"]`);
  await page.waitForSelector('#pw', { timeout: 5000 });
  await page.fill('#pw', clv);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  await captura('inicio');

  // En móvil el menú puede estar oculto: se abre si hay botón de menú
  const tabs = await page.$$eval('[data-act="gTab"],[data-act="mTab"],[data-act="aTab"],[data-act="pTab"]',
    els => [...new Map(els.map(e => [e.dataset.tab, { act: e.dataset.act, tab: e.dataset.tab }])).values()]);
  for (const t of tabs) {
    const sel = `[data-act="${t.act}"][data-tab="${t.tab}"]`;
    try {
      const visible = await page.locator(sel).filter({ visible: true }).first();
      if (await visible.count()) await visible.click({ timeout: 3000 });
      else await page.evaluate(s => document.querySelector(s).click(), sel);
      await page.waitForTimeout(600);
      await captura(t.tab);
    } catch (e) { errores.push(`no se pudo abrir la pestaña ${t.tab}: ${e.message.split('\n')[0]}`); await captura(t.tab + '-fallo'); }
  }
  // Gerencia en escritorio: abre cada disciplina del menú lateral (lo que ve Dirección)
  if (rol === 'ger' && viewport.width >= 600) {
    const areas = await page.$$eval('[data-act="openArea"]', els => [...new Set(els.map(e => e.dataset.id))]);
    for (const id of areas) {
      try {
        await page.evaluate(i => document.querySelector(`[data-act="openArea"][data-id="${i}"]`).click(), id);
        await page.waitForTimeout(600);
        await captura('area-' + id);
      } catch (e) { errores.push(`no se pudo abrir el área ${id}: ${e.message.split('\n')[0]}`); await captura('area-' + id + '-fallo'); }
    }
  }
  await ctx.close();
}

const roles = [['ger', clave('GER')], ['met', clave('MET')]];
const viewports = [['escritorio', { width: 1366, height: 900 }], ['movil', { width: 390, height: 844 }]];
for (const [rol, clv] of roles) for (const [n, vp] of viewports) {
  try { await recorrer(rol, clv, n, vp); }
  catch (e) { informe.vistas.push({ rol, viewport: n, vista: '(recorrido)', errores: ['falló el recorrido: ' + e.message.split('\n')[0]] }); }
}
await browser.close();
srv.close();
fs.rmSync(copia, { recursive: true, force: true });
fs.writeFileSync(path.join(salida, 'informe.json'), JSON.stringify(informe, null, 2));

// Resumen
console.log(`Capturas e informe en: ${salida}\n`);
for (const v of informe.vistas) {
  const avisos = [...(v.errores || []), v.desborde && `desborde horizontal ${v.desborde}`, v.sinNombre && `${v.sinNombre} botones sin nombre`, v.pequenos && `${v.pequenos} controles < 32px`].filter(Boolean);
  console.log(`${avisos.length ? '✗' : '✓'} ${v.rol}/${v.viewport}/${v.vista}${avisos.length ? '\n    - ' + avisos.join('\n    - ') : ''}`);
}
