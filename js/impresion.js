'use strict';
/* =====================================================================
   impresion.js — reportes para imprimir o guardar en PDF con el membrete
   de Campestre (img/membrete.png: franja izquierda, logo y pie con pictogramas).
   Se abre el diálogo de impresión; ahí se elige "Guardar como PDF" para descargarlo.
   Tamaño carta. El contenido se acomoda dentro de las zonas libres del membrete
   y se repite el margen en cada página.
   ===================================================================== */
const membreteSrc = () => (typeof window!=='undefined'&&window.MEMBRETE_URI) || 'img/membrete.png';

const DOC_CSS = `
@page{size:letter;margin:0}
*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
html{margin:0!important;padding:0!important;background:#fff!important;background-image:none!important;min-height:0!important}
body{margin:0!important;padding:0!important;background:transparent!important;background-image:none!important;min-height:0!important}   /* transparente: si no, tapa el membrete */
body{color:#10222b;font-size:11.5px;line-height:1.4}
.mb-bg{position:fixed;left:0;top:0;width:100%;height:100%;z-index:-1}
.mb-t{width:100%;border-collapse:collapse}
.mb-t td{padding:0}
.mb-sp-h{height:30mm}
.mb-sp-f{height:28mm}
.mb-b{padding:0 13mm 0 26mm}
.doc-h{margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid #0f7a5a}
.doc-h h1{margin:0;font-size:22px;font-weight:700;color:#0a4d3a;letter-spacing:-.01em;line-height:1.15}
.doc-h p{margin:3px 0 0;font-size:12.5px;color:#334a54}
.doc-h small{display:block;margin-top:2px;font-size:10.5px;color:#748792}
.doc-c .h2{margin:16px 0 8px;font-size:15px;color:#0a4d3a;break-after:avoid}
.doc-c .h2.sm{font-size:13px;margin:12px 0 6px}
.doc-c .h2::before{height:14px}
.doc-c .card,.doc-c .kpi,.doc-c .an-i,.doc-c .line,.doc-c .dl,.doc-c .an-rk,.doc-c tr{break-inside:avoid}
.doc-c .card,.doc-c .kpi,.doc-c .an-i,.doc-c .line{box-shadow:none!important;background:#fff!important;border:1px solid #cfdad8!important}
.doc-c .card{padding:10px 12px;border-radius:12px}
.doc-c .card+.card,.doc-c .an-p>.card{margin-top:8px}
.doc-c .kpis,.doc-c .an-kpis{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:8px!important}
.doc-c .kpi{min-height:0!important;padding:8px 10px!important;border-radius:10px}
.doc-c .kpi b{font-size:22px!important}
.doc-c .kpi .k-l{font-size:9.5px}
.doc-c .an-p{display:block!important;margin-bottom:6px}
.doc-c .an-ins{gap:6px}
.doc-c .an-i{padding:7px 10px;border-radius:10px}
.doc-c .an-i span,.doc-c .an-i b{font-size:11.5px}
.doc-c .an-t{min-width:0!important;font-size:11px}
.doc-c .an-t th,.doc-c .an-t td{padding:5px 6px}
.doc-c .an-scroll{overflow:visible!important}
.doc-c .fgrid{display:grid!important;grid-template-columns:1fr 1fr!important;column-gap:14px}
.doc-c .fsec{font-size:13px;margin:12px 0 6px;padding-top:8px}
.doc-c .dl{margin-bottom:8px}
.doc-c .dl dt{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#748792}
.doc-c .dl dd{font-size:12px}
.doc-c .an-nota{font-size:9.5px;margin-top:14px}
.doc-c .an-hm{gap:2px}.doc-c .an-c{min-height:22px;font-size:10px}
.doc-c .line{padding:6px 10px;margin-bottom:6px}
.doc-c .line .b b{font-size:12px}.doc-c .line .b small{font-size:10.5px}
.doc-c .gb-plot{height:130px!important}
.doc-c .btn,.doc-c .seg,.doc-c .chips,.doc-c .ibtn,.doc-c .no-print,.doc-c .k-go{display:none!important}
.doc-c .kpi-btn{width:auto;text-align:left;cursor:default}
.doc-c .doc-tabla{width:100%;border-collapse:collapse;font-size:11px;margin:6px 0}
.doc-c .doc-tabla th{background:#eaf3f1;color:#0a4d3a;text-align:left;padding:5px 7px;font-size:10px;letter-spacing:.05em;text-transform:uppercase}
.doc-c .doc-tabla td{padding:5px 7px;border-bottom:1px solid #dbe6e4}
.doc-c .doc-tabla td.n,.doc-c .doc-tabla th.n{text-align:right}
.doc-c .doc-tabla tr.tot td{font-weight:700;background:#f4f8f7}
.doc-c .doc-firmas{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:38px}
.doc-c .doc-firmas div{border-top:1px solid #334a54;padding-top:4px;text-align:center;font-size:10.5px;color:#334a54}
`;

function docEstilos(){
  return [...document.querySelectorAll('link[rel=stylesheet],style')].map(n=>{ const c=n.cloneNode(true); if(c.tagName==='LINK') c.removeAttribute('media'); return c.outerHTML; }).join('\n');
}
function docHTML({titulo,sub,html,estilos}){
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
${estilos!=null?estilos:docEstilos()}
<style>${DOC_CSS}</style></head><body>
<img class="mb-bg" src="${membreteSrc()}" alt="">
<table class="mb-t"><thead><tr><td><div class="mb-sp-h"></div></td></tr></thead>
<tbody><tr><td><div class="mb-b">
  <div class="doc-h"><h1>${esc(titulo)}</h1>${sub?`<p>${esc(sub)}</p>`:''}<small>Club Campestre Aguascalientes · generado el ${esc(fmtLarga(todayStr()))}</small></div>
  <div class="doc-c">${html}</div>
</div></td></tr></tbody>
<tfoot><tr><td><div class="mb-sp-f"></div></td></tr></tfoot></table>
</body></html>`;
}
let docActual = null;
function imprimirDirecto(o){                          // abre el cuadro de impresión del navegador (ahí se elige "Guardar como PDF")
  const f=document.createElement('iframe');
  f.setAttribute('aria-hidden','true'); f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(f);
  const d=f.contentDocument; d.open(); d.write(docHTML(o)); d.close();
  let lanzado=false;
  const lanzar=()=>{ if(lanzado) return; lanzado=true;
    try{ f.contentWindow.focus(); f.contentWindow.print(); }catch(e){ toast('No se pudo abrir la impresión en este navegador'); }
    setTimeout(()=>f.remove(),120000); };
  const img=d.querySelector('.mb-bg'), espera=()=>{ const fu=d.fonts&&d.fonts.ready?d.fonts.ready:Promise.resolve(); fu.then(()=>setTimeout(lanzar,250)); };
  if(img.complete) espera(); else { img.onload=espera; img.onerror=espera; }
  setTimeout(lanzar,4000);                          // por si algo no termina de cargar
}
function docEscala(){                                // ajusta la vista previa (hoja carta de 816 px) al ancho disponible
  const pv=$('#docPv'), f=$('#docFrame'); if(!pv||!f) return;
  const s=Math.min(1,(pv.clientWidth||560)/816); f.style.transform=`scale(${s})`; pv.style.height=Math.round(1056*s)+'px';
}
function imprimirDoc(o){
  if(typeof window!=='undefined'&&window.IMPRIMIR_HOOK){ window.IMPRIMIR_HOOK(docHTML(o),o); return; }     // solo para pruebas
  docActual=o;
  openModal(`${mHead('Reporte con membrete')}
    <div class="doc-pv" id="docPv"><iframe id="docFrame" title="Vista previa del reporte"></iframe></div>
    <div class="sub" style="margin:10px 0 0">Tamaño carta, con el membrete de Campestre. La vista muestra el inicio; al imprimir se acomoda en páginas. En el cuadro de impresión elige <b>Guardar como PDF</b> para descargarlo.</div>
    <div class="btns"><button class="btn" data-act="closeModal">Cerrar</button><button class="btn primary" data-act="docPrint">Imprimir / guardar PDF</button></div>`);
  $('#docFrame').srcdoc=docHTML(o); docEscala();
}
window.addEventListener('resize',docEscala);

/* ---------- reporte semanal ---------- */
function repDocHTML(aid,wk){
  const a=getArea(aid), rep=(areaData(aid).reportes||{})[wk]||{}, F=repFields(aid);
  const incs=coll(aid,'incidencias').filter(i=>i.fecha>=wk&&i.fecha<=addDays(wk,6)).sort(incSort);
  const estado=rep.entregado?'Entregado el '+fmtCorta(String(rep.entregadoEn||wk).slice(0,10)):rep.semana?'Borrador':'Sin capturar';
  const campos=F.map(f=>{
    if(f.sec) return `<div class="fsec">${esc(f.sec)}</div>`;
    const v=String(rep[f.k]==null?'':rep[f.k]).trim(); return v?`<div class="dl"><dt>${esc(f.l)}</dt><dd>${esc(v)}</dd></div>`:'';
  }).join('');
  return `<table class="doc-tabla"><tbody><tr><th>Área</th><td>${areaIco(a,{size:14})} ${esc(a.nombre)}</td><th>Semana</th><td>${esc(fmtCorta(wk))} al ${esc(fmtCorta(addDays(wk,6)))} de ${esc(addDays(wk,6).slice(0,4))}</td><th>Estado</th><td>${esc(estado)}</td></tr></tbody></table>
    ${campos.replace(/<div class="fsec">[^<]*<\/div>(?=<div class="fsec">|$)/g,'')||'<div class="empty">Este reporte todavía no tiene información capturada.</div>'}
    <div class="h2 sm">Incidencias registradas en la semana (${incs.length})</div>
    ${incs.length?`<table class="doc-tabla"><thead><tr><th>Fecha</th><th>Tipo</th><th>Gravedad</th><th>Descripción</th><th>Estado</th></tr></thead><tbody>${incs.map(i=>`<tr><td>${esc(fmtFecha(i.fecha))}</td><td>${esc(i.tipo||'')}</td><td>${esc(i.grav||'')}</td><td>${esc(i.desc||'')}</td><td>${esc(i.estado||'')}</td></tr>`).join('')}</tbody></table>`:'<p>Sin incidencias en la semana.</p>'}
    <div class="doc-firmas"><div>Dirección del área</div><div>Gerencia deportiva</div></div>`;
}

/* ---------- gimnasio: hoja de aforo por hora y hoja de personalizados ---------- */
function gaDocHTML(aid,fecha){
  const c=gimCfg(aid), horas=gimHoras(aid), S=gimStats(aid,fecha,fecha), serie=gimSerie(aid,fecha);
  const fila=h=>{ const r=getPath(`data/${aid}/accesos/${fecha}_${pad(h)}`), t=r?gimTot(r):null, p=r?Math.round(t/c.cap*100):null;
    return `<tr><td>${hh(h)} – ${hh(h+1)}</td><td class="n">${r?(+r.mu||0):'—'}</td><td class="n">${r?(+r.ho||0):'—'}</td><td class="n"><b>${r?t:'—'}</b></td><td class="n ${aforoCls(p)}">${p==null?'—':p+'%'}</td></tr>`; };
  return `<div class="kpis an-kpis">
      ${kpi('Horas capturadas',`${S.recs}/${horas.length}`,'del día')}
      ${kpi('Aforo promedio',anPct(S.aforo),`capacidad ${c.cap} personas`,{cls:aforoCls(S.aforo)})}
      ${kpi('Mujeres / hombres',S.pctMu==null?'—':`${S.pctMu}% / ${S.pctHo}%`,`${S.mu} mujeres · ${S.ho} hombres`)}</div>
    <div class="card" style="margin-top:8px">${gimBarras(serie,c.cap,130)}</div>
    <table class="doc-tabla"><thead><tr><th>Hora</th><th class="n">Mujeres</th><th class="n">Hombres</th><th class="n">Total</th><th class="n">% de la capacidad</th></tr></thead><tbody>${horas.map(fila).join('')}
      <tr class="tot"><td>Suma de conteos</td><td class="n">${S.mu}</td><td class="n">${S.ho}</td><td class="n">${S.personasHora}</td><td class="n">${anPct(S.aforo)}</td></tr></tbody></table>
    <p style="font-size:10px;color:#748792">Cada renglón es el número de personas en la sala a esa hora. La suma cuenta personas-hora, no visitas distintas.</p>
    <div class="doc-firmas"><div>Responsable del conteo</div><div>Dirección del gimnasio</div></div>`;
}
function ptDocHTML(aid){
  const T=ptTotales(aid), filas=ptResumen(aid).filter(x=>x.mios.length);
  const est=p=>ptEstado(p);
  return `<div class="kpis an-kpis">
      ${kpi('Paquetes activos',T.paquetes,`de ${plu(T.instructores,'instructor','instructores')}`)}
      ${kpi('Contratadas',T.contratadas,'sesiones en paquetes activos')}
      ${kpi('Por entregar',T.saldo,`${T.realizadas} realizadas`)}</div>
    ${filas.map(x=>`<div class="h2 sm">${esc(x.p.nombre)}</div>
      <table class="doc-tabla"><thead><tr><th>Cliente</th><th class="n">Contratadas</th><th class="n">Realizadas</th><th class="n">Pendientes</th><th>Inicio</th><th>Vence</th><th>Estado</th></tr></thead><tbody>
      ${x.mios.slice().sort((a,b)=>(ptVigente(b)-ptVigente(a))||String(b.fin).localeCompare(String(a.fin))).map(p=>`<tr><td>${esc(p.cliente||'')}</td><td class="n">${+p.total||0}</td><td class="n">${ptReal(p)}</td><td class="n">${Math.max(0,(+p.total||0)-ptReal(p))}</td><td>${esc(fmtCorta(p.inicio))}</td><td>${esc(fmtCorta(p.fin))}</td><td>${esc(est(p))}</td></tr>`).join('')}
      <tr class="tot"><td>Paquetes activos</td><td class="n">${x.contratadas}</td><td class="n">${x.realizadas}</td><td class="n">${x.saldo}</td><td colspan="3">${x.act.length} activos${x.porVencer?` · ${x.porVencer} por vencer`:''}${x.vencidos?` · ${x.vencidos} vencidos con saldo`:''}</td></tr></tbody></table>`).join('')||'<p>Todavía no hay personalizados contratados.</p>'}
    <div class="doc-firmas"><div>Dirección del gimnasio</div><div>Gerencia deportiva</div></div>`;
}

Object.assign(actions,{
  docPrint(){ if(docActual) imprimirDirecto(docActual); },
  anPrint(){
    const d=anData(), q=AN_Q.find(x=>x[0]===ui.an.q), area=ui.an.area==='all'?'Todas las áreas':getArea(ui.an.area).nombre;
    imprimirDoc({titulo:'Informe para comité directivo'+(ui.an.q==='todo'||ui.an.q==='resumen'?'':' · '+q[1].replace(/[¿?]/g,'')),
      sub:`${area} · ${anPeriodoTxt(d.r)}${anCompTxt(d.r)}`,html:anCuerpo(d)});
  },
  repPrint(){
    const aid=curArea(), a=getArea(aid), wk=ui.repWeek;
    imprimirDoc({titulo:'Reporte semanal · '+a.nombre,sub:`Semana del ${fmtCorta(wk)} al ${fmtCorta(addDays(wk,6))}`,html:repDocHTML(aid,wk)});
  },
  gaPrint(){
    const aid=curArea(), fecha=ui.gaFecha;
    imprimirDoc({titulo:'Aforo por hora · '+getArea(aid).nombre,sub:fmtLarga(fecha),html:gaDocHTML(aid,fecha)});
  },
  ptPrint(){
    const aid=curArea();
    imprimirDoc({titulo:'Personalizados por instructor · '+getArea(aid).nombre,sub:'Estado al '+fmtLarga(todayStr()),html:ptDocHTML(aid)});
  }
});
