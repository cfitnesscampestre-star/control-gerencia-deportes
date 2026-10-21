#!/usr/bin/env node
/* Revisión estática de Control Gerencia de Deportes.
   Uso: node .claude/skills/auditoria-gerencia-deportes/scripts/revision-estatica.mjs [raíz]
   Revisa: sintaxis de cada js/, que sw.js (ARCHIVOS) incluya todos los archivos de css/ js/ img/,
   que index.html cargue scripts y hojas que existan, versiones ?v= de scripts, VERSION del service
   worker contra el último LEEME-parche, y patrones de riesgo (console.log, debugger, eval, innerHTML con variables, claves en localStorage).
   El escape de texto en las plantillas (${...} sin esc()) se revisa a mano: ver SKILL.md. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const raiz = path.resolve(process.argv[2] || '.');
const leer = f => fs.readFileSync(path.join(raiz, f), 'utf8');
const existe = f => fs.existsSync(path.join(raiz, f));
const hallazgos = [];
const add = (grav, archivo, msg) => hallazgos.push({ grav, archivo, msg });

// 1. Sintaxis de cada archivo JS
const js = fs.readdirSync(path.join(raiz, 'js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f);
for (const f of [...js, 'sw.js']) {
  try { execFileSync(process.execPath, ['--check', path.join(raiz, f)], { stdio: 'pipe' }); }
  catch (e) { add('CRÍTICO', f, 'Error de sintaxis: ' + String(e.stderr).split('\n').slice(0, 5).join(' | ')); }
}

// 2. sw.js: ARCHIVOS contra los archivos reales
const sw = leer('sw.js');
const bloque = (sw.match(/const ARCHIVOS\s*=\s*\[([\s\S]*?)\];/) || [])[1] || '';
const enSw = new Set([...bloque.matchAll(/'([^']+)'/g)].map(m => m[1]));
const reales = ['css', 'js', 'img'].flatMap(d => existe(d) ? fs.readdirSync(path.join(raiz, d)).filter(f => !f.endsWith('.txt')).map(f => d + '/' + f) : []);
for (const f of reales) if (!enSw.has(f)) add('ALTO', 'sw.js', `${f} existe pero no está en ARCHIVOS: no abrirá sin internet`);
for (const f of enSw) if (f !== './' && !existe(f)) add('MEDIO', 'sw.js', `ARCHIVOS incluye ${f}, que no existe`);
const version = (sw.match(/const VERSION\s*=\s*'([^']+)'/) || [])[1];

// 3. index.html: scripts y estilos referenciados
const html = leer('index.html');
const refs = [...html.matchAll(/(?:src|href)="((?:js|css|img)\/[^"?]+)(?:\?v=(\d+))?"/g)];
const cargados = new Set();
for (const [, f] of refs) { cargados.add(f); if (!existe(f)) add('CRÍTICO', 'index.html', `Referencia a ${f}, que no existe`); }
const todoJs = js.map(leer).join('\n');
for (const f of js) if (!cargados.has(f) && !todoJs.includes(`'${f}'`)) add('MEDIO', 'index.html', `${f} no se carga en index.html ni dinámicamente (¿código muerto o falta el <script>?)`);
for (const d of ['css']) for (const f of reales.filter(x => x.startsWith(d + '/'))) if (!cargados.has(f)) add('BAJO', 'index.html', `${f} no se carga en index.html`);
for (const [, f, v] of refs) if (f.startsWith('js/') && !v) add('BAJO', 'index.html', `${f} sin ?v=: el navegador puede quedarse con la versión vieja`);

// 4. Versión del service worker contra el último LEEME-parche
const parches = fs.readdirSync(raiz).filter(f => /^LEEME-parche\d*\.txt$/.test(f))
  .sort((a, b) => (+(a.match(/\d+/) || [1])[0]) - (+(b.match(/\d+/) || [1])[0]));
if (parches.length) {
  const ult = parches.at(-1), txt = leer(ult), vp = (txt.match(/gd-v\d+/) || [])[0];
  if (vp && version && vp !== version) add('MEDIO', 'sw.js', `VERSION es ${version} pero ${ult} dice ${vp}`);
}

// 5. Patrones de riesgo línea por línea
const patrones = [
  [/console\.log\(/, 'BAJO', 'console.log olvidado'],
  [/debugger;/, 'ALTO', 'debugger olvidado'],
  [/\beval\(|new Function\(/, 'ALTO', 'eval / new Function'],
  [/document\.write\(/, 'MEDIO', 'document.write'],
  [/\.innerHTML\s*\+?=\s*[^`'"]/, 'MEDIO', 'innerHTML con una variable: confirmar que el texto pasa por esc()'],
  [/localStorage\.setItem\([^)]*(pass|clave|pin)/i, 'ALTO', 'Contraseña o PIN guardado en localStorage'],
];
for (const f of js.filter(f => !f.endsWith('.min.js') && f !== 'js/xlsx.js')) {
  leer(f).split('\n').forEach((l, i) => {
    for (const [re, g, m] of patrones) if (re.test(l)) add(g, `${f}:${i + 1}`, `${m} → ${l.trim().slice(0, 140)}`);
  });
}

// Informe
const orden = ['CRÍTICO', 'ALTO', 'MEDIO', 'BAJO'];
hallazgos.sort((a, b) => orden.indexOf(a.grav) - orden.indexOf(b.grav));
console.log(`Revisión estática — ${js.length} archivos JS, sw.js ${version || '(sin VERSION)'}, ${parches.length} LEEME-parche\n`);
for (const g of orden) {
  const h = hallazgos.filter(x => x.grav === g);
  if (!h.length) continue;
  console.log(`## ${g} (${h.length})`);
  for (const x of h) console.log(`- [${x.archivo}] ${x.msg}`);
  console.log();
}
if (!hallazgos.length) console.log('Sin hallazgos.');
process.exitCode = hallazgos.some(x => x.grav === 'CRÍTICO') ? 1 : 0;
