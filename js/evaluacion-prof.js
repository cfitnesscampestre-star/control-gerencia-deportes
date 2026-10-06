'use strict';
/* =====================================================================
   evaluacion-prof.js — Evaluación anual de los profesores (formato
   PA-PPS-DEP-R12: "Indicadores del desempeño del docente de academias
   deportivas en su evaluación anual").
   La hace la DIRECCIÓN de cada área a sus profesores. Cada dirección puede
   dejar los indicadores y su ponderación tal cual o cambiarlos (deben sumar
   100 puntos). Metodología deportiva ve las evaluaciones de cada disciplina
   (al tocar la disciplina en Aforos, y en Reportes) y las imprime con el
   formato del club.
   Para que nadie capture dos veces lo que el sistema ya sabe:
     · "Listas de asistencias" sugiere los puntos según las clases del
       profesor que sí tienen lista capturada en el año.
     · "Retención de la matrícula" convierte el % de retención en puntos con
       la escala del formato (98 a 100% = 10 pts … ).
   Datos propios:
     met/evalCfg/<área>                      → indicadores y ponderación del área
     met/evalProf/<año>/<área>__<profesor>   → evaluación (con sus propios
                                               indicadores, para que cambiar la
                                               ponderación después no la altere)
   ===================================================================== */
const PE_COD = {codigo:'PA-PPS-DEP-R12', revision:'00', fecha:'--', retener:'Al Cambio'};
const PE_BANDAS = [[98,'Excelente','ok'],[90,'Muy bien','ok'],[81,'Bien','info'],[70,'Regular','warn'],[0,'Mal','bad']];
const PE_BANDAS_TXT = [['98 al 100','Excelente'],['90 al 97','Muy bien'],['81 al 89','Bien'],['70 al 80','Regular'],['Menos de 70','Mal']];
const PE_MAT = [[98,10],[90,9],[81,8],[70,7],[0,0]];                 // % de retención → puntos (escala sobre 10)
const PE_MAT_TXT = [['Del 98 al 100 %','10 Pts.'],['90 al 97 %','9 Pts.'],['81 al 89 %','8 Pts.'],['70 al 80 %','7 Pts.'],['Menos de 70','Mal']];
const PE_BASE = [
  {t:'Cumple con los objetivos del programa.',pts:15},
  {t:'Planifica y organiza correctamente la sesión de la clase.',pts:15},
  {t:'Listas de asistencias.',pts:10,tipo:'asistencia'},
  {t:'Cumple y participa en el curso de capacitación.',pts:20},
  {t:'Consulta el Manual del Profesor.',pts:20},
  {t:'Retención de la matrícula.',pts:10,tipo:'matricula'},
  {t:'Tiene y cumple con el reglamento del deporte, del Club.',pts:10}
];
const peArr = v => Array.isArray(v) ? v : Object.values(v||{});
const peCat = t => { const b=PE_BANDAS.find(x=>t>=x[0]); return {t:b[1],c:b[2]}; };
const peMatPts = (pct,max) => { const b=PE_MAT.find(x=>pct>=x[0]); return Math.round((b[1]/10)*max*2)/2; };
const peR = n => Math.round(n*2)/2;
const peBandaTxt = x => x[1]==='Mal' ? `${x[0]} ${x[1]}.` : `${x[0]} = ${x[1]}`;
function peCfg(aid){
  const c=((state.met&&state.met.evalCfg)||{})[aid], l=c?peArr(c.inds).filter(x=>x&&x.t):[];
  return l.length ? l.map(x=>({t:String(x.t),pts:+x.pts||0,tipo:x.tipo||''})) : PE_BASE.map(x=>({...x}));
}
const peCfgPropia = aid => !!(((state.met&&state.met.evalCfg)||{})[aid]);
const peAnios = () => { const y=new Date().getFullYear(); return [y,y-1,y-2]; };
const peKey = (aid,pid) => `${aid}__${String(pid).replace(/[.#$\/\[\]]/g,'_')}`;
const getPe = (aid,pid,anio) => ((((state.met&&state.met.evalProf)||{})[anio])||{})[peKey(aid,pid)]||null;
const pesDeAnio = anio => Object.values((((state.met&&state.met.evalProf)||{})[anio])||{});
const peProfs = aid => profesores(aid).filter(p=>p.activo!==false&&!p.sim);
const peAplica = aid => !!getArea(aid) && !esServ(aid);               // Nutrición, Fisioterapia y Paramédicos no son academias deportivas

/* % de las clases del profesor que sí tienen lista capturada en el año (sugerencia para "Listas de asistencias") */
function peAsistPct(aid,pid,anio){
  const gs=clasesDe(aid,pid); if(!gs.length) return null;
  const hoy=todayStr(), desde=`${anio}-01-01`, hasta=`${anio}-12-31`<hoy?`${anio}-12-31`:hoy; if(desde>hasta) return null;
  const recs=new Map(coll(aid,'asistencia').map(r=>[`${r.grupoId}_${r.fecha}`,r]));
  let prog=0, cap=0;
  for(let d=desde; d<=hasta; d=addDays(d,1)){
    gs.forEach(g=>{
      if(g.creado&&d<g.creado) return; if(g.fin&&d>g.fin) return; if(!progEn(g,d)) return;
      const r=recs.get(`${g.id}_${d}`); if(r&&r.omitida) return;          // “no hubo clase” no cuenta
      prog++; if(r) cap++;
    });
  }
  return prog?{prog,cap,pct:Math.round(cap/prog*100)}:null;
}

/* ---------- avisos para la dirección ---------- */
function peLinea(aid){
  if(!session||session.rol!=='dir'||!peAplica(aid)) return '';
  const ps=peProfs(aid); if(!ps.length) return '';
  const y=new Date().getFullYear(), hechas=ps.filter(p=>getPe(aid,p.id,y)).length;
  return `<div class="pe-linea"><div>${ic('clip')}<span>Evaluación anual de profesores ${y}: <b>${hechas} de ${ps.length}</b>. La hace la dirección desde la ficha de cada profesor.</span></div>
    <button class="btn sm" data-act="peCfg">Indicadores y ponderación</button></div>`;
}
function peBtn(aid,pid){
  if(!session||session.rol!=='dir'||!peAplica(aid)||!pid) return '';
  const y=new Date().getFullYear(), e=getPe(aid,pid,y);
  return `<div class="btns"><button class="btn${e?'':' primary'}" data-act="peAbrir" data-aid="${esc(aid)}" data-id="${esc(pid)}" data-y="${y}">${e?`Evaluación ${y}: ${e.total} pts · ${esc(peCat(e.total).t)}`:`Evaluar al profesor (${y})`}</button></div>`;
}

/* ---------- captura (director) ---------- */
function openPe(aid,pid,anio){
  const p=getProf(aid,pid)||{}, a=getArea(aid)||{nombre:''}, ex=getPe(aid,pid,anio);
  const inds=ex?peArr(ex.inds):peCfg(aid), sug=peAsistPct(aid,pid,anio);
  const fila=(x,i)=>{
    const v=ex&&ex.inds?(peArr(ex.inds)[i]||{}):{};
    let ctl;
    if(x.tipo==='matricula') ctl=`<div class="pe-mat"><label><span>Retención %</span><input class="pe-pct" data-i="${i}" type="number" inputmode="decimal" min="0" max="100" step="0.1" value="${v.pct==null?'':esc(v.pct)}" placeholder="%"></label><b class="pe-ptsv" data-i="${i}">${v.pts==null?'—':v.pts}</b></div>`;
    else ctl=`<input class="pe-pts" data-i="${i}" type="number" inputmode="decimal" min="0" max="${x.pts}" step="0.5" value="${v.pts==null?'':esc(v.pts)}" placeholder="0">`;
    const sugTxt=(x.tipo==='asistencia'&&sug)?`<div class="pe-sug">Según el sistema: <b>${sug.pct}%</b> de las clases con lista (${sug.cap} de ${sug.prog}) <button type="button" class="btn sm" data-act="peUsarSug" data-i="${i}" data-v="${peR(x.pts*sug.pct/100)}">Usar ${peR(x.pts*sug.pct/100)} pts</button></div>`:'';
    return `<div class="pe-ind" data-i="${i}" data-max="${x.pts}" data-tipo="${esc(x.tipo||'')}"><div class="pe-t"><span class="pe-n">${i+1}</span><span>${esc(x.t)}</span><em>${x.pts} pts</em></div>${ctl}${sugTxt}</div>`;
  };
  const tot=ex?ex.total:0;
  openModal(`${mHead('Evaluación del profesor')}
    <div class="sub"><b>${esc(p.nombre||'Profesor')}</b> · ${esc(a.nombre)}</div>
    <label class="f"><span>Año de la evaluación</span><select id="pe_anio" data-pid="${esc(pid)}" data-aid="${esc(aid)}">${peAnios().map(y=>`<option value="${y}"${String(y)===String(anio)?' selected':''}>${y}${getPe(aid,pid,y)?' · ya evaluado':''}</option>`).join('')}</select></label>
    <div class="pe-lista" id="pe_lista" data-aid="${esc(aid)}" data-pid="${esc(pid)}" data-anio="${esc(anio)}">${inds.map(fila).join('')}</div>
    <div class="pe-total"><span>Total de puntos</span><b id="pe_tot">${tot}</b><em id="pe_cat">${ex?esc(peCat(ex.total).t):'—'}</em></div>
    <details class="pe-escalas"><summary>Escalas de la evaluación</summary>
      <div class="pe-esc2"><div><b>Evaluación final</b>${PE_BANDAS_TXT.map(x=>`<p>${peBandaTxt(x)}</p>`).join('')}</div><div><b>Retención de la matrícula</b>${PE_MAT_TXT.map(x=>`<p>${peBandaTxt(x)}</p>`).join('')}</div></div></details>
    <label class="f"><span>Observaciones</span><textarea id="pe_obs" rows="4" placeholder="Fortalezas, áreas de mejora, acuerdos…">${esc(ex?ex.obs||'':'')}</textarea></label>
    <label class="f"><span>Nombre del evaluador</span><input id="pe_eval" value="${esc(ex?ex.evaluador||'':'')}" placeholder="Nombre y apellidos" autocomplete="off"></label>
    <div class="btns"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="peGuardar" data-aid="${esc(aid)}" data-id="${esc(pid)}">Guardar evaluación</button></div>
    ${ex?`<div class="btns"><button class="btn danger" data-act="peBorrar" data-aid="${esc(aid)}" data-id="${esc(pid)}" data-y="${esc(anio)}">Eliminar evaluación</button></div>`:''}`);
  peRecalc();
}
function peRecalc(){                      // total y categoría en vivo; la retención se convierte a puntos
  let tot=0;
  document.querySelectorAll('#pe_lista .pe-ind').forEach(r=>{
    const max=+r.dataset.max, pct=r.querySelector('.pe-pct'), pts=r.querySelector('.pe-pts');
    let v=null;
    if(pct){ const x=parseFloat(pct.value); const s=r.querySelector('.pe-ptsv'); if(!isNaN(x)){ v=peMatPts(Math.max(0,Math.min(100,x)),max); if(s) s.textContent=v; } else if(s) s.textContent='—'; }
    else if(pts){ const x=parseFloat(pts.value); if(!isNaN(x)) v=Math.max(0,Math.min(max,x)); }
    if(v!=null) tot+=v;
  });
  tot=Math.round(tot*10)/10;
  const t=$('#pe_tot'), c=$('#pe_cat'); if(t) t.textContent=tot; if(c) c.textContent=peCat(tot).t;
  return tot;
}
document.addEventListener('input',e=>{ if(e.target.classList&&(e.target.classList.contains('pe-pts')||e.target.classList.contains('pe-pct'))) peRecalc(); });

/* ---------- configuración de indicadores y ponderación (director) ---------- */
function peCfgRow(x){
  return `<div class="pc-row" data-tipo="${esc(x.tipo||'')}"><input class="pc-t" value="${esc(x.t||'')}" placeholder="Indicador a medir" autocomplete="off"><input class="pc-p" type="number" inputmode="numeric" min="0" max="100" value="${x.pts==null?'':esc(x.pts)}" placeholder="Pts"><button type="button" class="ibtn" data-act="pcDel" aria-label="Quitar">${ic('x')}</button></div>`;
}
function openPeCfg(aid){
  const a=getArea(aid)||{nombre:''}, inds=peCfg(aid);
  openModal(`${mHead('Indicadores y ponderación')}
    <div class="sub">Evaluación de los profesores de <b>${esc(a.nombre)}</b>. Deja los indicadores como están o cámbialos; los puntos deben sumar <b>100</b>. Las evaluaciones ya hechas conservan su ponderación.</div>
    <div class="pc-lista" id="pc_lista">${inds.map(peCfgRow).join('')}</div>
    <button type="button" class="btn sm" data-act="pcAdd">+ Agregar indicador</button>
    <div class="pe-total"><span>Suma de puntos</span><b id="pc_suma">0</b><em id="pc_estado"></em></div>
    <div class="sub">“Listas de asistencias” sugiere los puntos con las listas que ya captura el profesor, y “Retención de la matrícula” convierte el % de retención en puntos. Si cambias el texto de esos indicadores, siguen funcionando igual.</div>
    <div class="btns"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="pcGuardar" data-aid="${esc(aid)}">Guardar</button></div>
    ${peCfgPropia(aid)?`<div class="btns"><button class="btn" data-act="pcReset" data-aid="${esc(aid)}">Volver a los indicadores originales</button></div>`:''}`);
  pcSuma();
}
function pcLee(){ return [...document.querySelectorAll('#pc_lista .pc-row')].map(r=>({t:r.querySelector('.pc-t').value.trim(),pts:Math.max(0,Math.round(+r.querySelector('.pc-p').value||0)),tipo:r.dataset.tipo||''})); }
function pcSuma(){
  const l=pcLee().filter(x=>x.t||x.pts), s=l.reduce((a,x)=>a+x.pts,0), e=$('#pc_estado'), b=$('#pc_suma');
  if(b) b.textContent=s;
  if(e){ e.textContent=s===100?'Completo':s<100?`Faltan ${100-s}`:`Sobran ${s-100}`; e.className=s===100?'ok':'bad'; }
  return s;
}
document.addEventListener('input',e=>{ if(e.target.classList&&(e.target.classList.contains('pc-p')||e.target.classList.contains('pc-t'))) pcSuma(); });

/* ---------- el formato (pantalla, modal e impresión) ---------- */
function peDocHTML(ev){
  const a=getArea(ev.aid)||{nombre:''}, inds=peArr(ev.inds), cat=peCat(ev.total);
  return `<div class="pe-doc">
    <div class="pe-dat"><b>Nombre y Apellidos:</b> ${esc(ev.nombre||'')}</div>
    <div class="pe-dat"><b>Deporte:</b> ${esc(a.nombre)}</div>
    <table class="fm-t pe-tb"><thead><tr><th style="width:5%">#</th><th>INDICADORES A MEDIR</th><th style="width:9%">PTS.</th><th style="width:9%">PTS.</th></tr></thead><tbody>
      ${inds.map((x,i)=>`<tr><td class="c">${i+1}</td><td class="l">${esc(x.t)}${x.pct!=null?` <span class="pe-pct-t">(retención ${esc(x.pct)}%)</span>`:''}</td><td class="c">${x.max}</td><td class="c b">${x.pts==null?'':x.pts}</td></tr>`).join('')}
      <tr class="tot"><td></td><td class="l">Total, de puntos.</td><td class="c">${inds.reduce((s,x)=>s+(+x.max||0),0)}</td><td class="c">${ev.total}</td></tr></tbody></table>
    <div class="pe-res">Evaluación final: <b>${ev.total} puntos · ${esc(cat.t)}</b></div>
    <div class="pe-dos"><div><h4>Evaluación Final</h4>${PE_BANDAS_TXT.map(x=>`<p>${peBandaTxt(x)}</p>`).join('')}</div>
      <div><h4>Evaluación de la matrícula</h4>${PE_MAT_TXT.map(x=>`<p>${peBandaTxt(x)}</p>`).join('')}</div></div>
    <h4 class="pe-h">OBSERVACIONES</h4><div class="pe-obs">${esc(ev.obs||'')||'&nbsp;'}</div>
    <div class="pe-firmas"><div>Nombre y firma del profesor<br><small>${esc(ev.nombre||'')}</small></div><div>Nombre y firma del evaluador<br><small>${esc(ev.evaluador||'')}</small></div></div>
    <div class="pe-ger">GERENCIA DE DEPORTES</div></div>`;
}
function peVerModal(aid,pid,anio){
  const ev=getPe(aid,pid,anio); if(!ev) return;
  openModal(`${mHead('Evaluación del profesor')}
    <div class="sub">${esc(ev.nombre||'')} · ${esc((getArea(aid)||{}).nombre||'')} · ${esc(anio)}${ev.fecha?' · evaluada el '+esc(fmtCorta(ev.fecha)):''}</div>
    <div class="rep-pantalla pe-pv">${peDocHTML(ev)}</div>
    <div class="btns"><button class="btn" data-act="closeModal">Cerrar</button><button class="btn primary" data-act="peImprimir" data-aid="${esc(aid)}" data-id="${esc(pid)}" data-y="${esc(anio)}">Imprimir formato</button></div>`);
}
/* ---------- vistas de Metodología ---------- */
function peSeccionMet(aid){                 // al final del detalle de una disciplina en Aforos
  if(!peAplica(aid)) return '';
  const y=+(ui.mt&&ui.mt.peAnio)||new Date().getFullYear(), ps=peProfs(aid);
  const filas=ps.map(p=>({p,e:getPe(aid,p.id,y)}));
  const hechas=filas.filter(x=>x.e).length;
  return `<div class="h2 sm" style="margin-top:18px">Evaluación anual de los profesores</div>
    <div class="an-f no-print"><label class="f"><span>Año</span><select id="pe_met_anio">${peAnios().map(a=>`<option value="${a}"${a===y?' selected':''}>${a}</option>`).join('')}</select></label></div>
    <div class="sub">${hechas} de ${ps.length} profesores evaluados por la dirección en ${y}. Toca uno para ver y imprimir el formato.</div>
    ${filas.length?filas.map(({p,e})=>{ const c=e?peCat(e.total):null;
      return e?`<button class="line" style="--ac:${esc((getArea(aid)||{}).color||'var(--b3)')}" data-act="peVer" data-aid="${esc(aid)}" data-id="${esc(p.id)}" data-y="${y}"><div class="b"><b>${esc(p.nombre)}</b><small>${esc(fmtCorta(e.fecha||''))}${e.evaluador?' · Evaluó: '+esc(e.evaluador):''}</small></div><div class="r"><b>${e.total}</b>${pill(c.t,c.c)}</div></button>`
        :`<div class="line" style="--ac:var(--mut)"><div class="b"><b>${esc(p.nombre)}</b><small>Sin evaluar</small></div><div class="r">${pill('Pendiente','mut')}</div></div>`; }).join('')
      :empty('Esta disciplina todavía no tiene profesores dados de alta.')}`;
}
function vPeReporte(){
  const y=+(ui.mt&&ui.mt.peAnio)||new Date().getFullYear(), as=areasList().filter(a=>peAplica(a.id)).sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre),'es'));
  const todas=as.flatMap(a=>peProfs(a.id).map(p=>({a,p,e:getPe(a.id,p.id,y)})));
  const hechas=todas.filter(x=>x.e), prom=hechas.length?Math.round(hechas.reduce((s,x)=>s+x.e.total,0)/hechas.length*10)/10:null;
  return `<div class="mt-back"><button class="btn sm" data-act="rpVolver">${ic('back')} Regresar</button></div>
    <div class="h2">Evaluación de los profesores</div>
    <div class="an-f no-print"><label class="f"><span>Año</span><select id="pe_met_anio">${peAnios().map(a=>`<option value="${a}"${a===y?' selected':''}>${a}</option>`).join('')}</select></label></div>
    <div class="kpis k3 mt-kpis">${kpi('Evaluados',`${hechas.length}/${todas.length}`,'profesores',{cls:hechas.length<todas.length?'warn':'ok',color:'var(--b2)'})}${kpi('Promedio',prom==null?'—':prom,prom==null?'':peCat(prom).t,{color:'var(--b3)'})}${kpi('Disciplinas',as.length,'',{color:'var(--b1)'})}</div>
    ${as.map(a=>{ const fs=todas.filter(x=>x.a.id===a.id); if(!fs.length) return '';
      return `<div class="h2 sm">${areaIco(a,{size:18})} ${esc(a.nombre)} · ${fs.filter(x=>x.e).length}/${fs.length}</div>`+fs.map(({p,e})=>e
        ?`<button class="line" style="--ac:${esc(a.color)}" data-act="peVer" data-aid="${esc(a.id)}" data-id="${esc(p.id)}" data-y="${y}"><div class="b"><b>${esc(p.nombre)}</b><small>${esc(fmtCorta(e.fecha||''))}${e.evaluador?' · Evaluó: '+esc(e.evaluador):''}</small></div><div class="r"><b>${e.total}</b>${pill(peCat(e.total).t,peCat(e.total).c)}</div></button>`
        :`<div class="line" style="--ac:var(--mut)"><div class="b"><b>${esc(p.nombre)}</b><small>Sin evaluar</small></div><div class="r">${pill('Pendiente','mut')}</div></div>`).join(''); }).join('')}
    <div class="an-nota">La evaluación la hace la dirección de cada disciplina con los indicadores y la ponderación que tenga definidos. Escala: 98 a 100 excelente · 90 a 97 muy bien · 81 a 89 bien · 70 a 80 regular · menos de 70 mal.</div>`;
}

Object.assign(actions,{
  peAbrir(d){ closeModal(); openPe(d.aid,d.id,d.y||new Date().getFullYear()); },
  peUsarSug(d){ const i=document.querySelector(`#pe_lista .pe-pts[data-i="${d.i}"]`); if(i){ i.value=d.v; peRecalc(); } },
  peGuardar(d){
    const L=$('#pe_lista'); if(!L) return;
    const aid=d.aid, pid=d.id, anio=L.dataset.anio, base=peCfgDe(aid,pid,anio), inds=[]; let falta=false;
    L.querySelectorAll('.pe-ind').forEach((r,i)=>{
      const x=base[i], max=+r.dataset.max, pct=r.querySelector('.pe-pct'), pts=r.querySelector('.pe-pts');
      if(pct){ const v=parseFloat(pct.value); if(isNaN(v)){ falta=true; return; } const c=Math.max(0,Math.min(100,v)); inds.push({t:x.t,max,tipo:x.tipo||'',pct:c,pts:peMatPts(c,max)}); }
      else { const v=parseFloat(pts.value); if(isNaN(v)){ falta=true; return; } inds.push({t:x.t,max,tipo:x.tipo||'',pts:Math.max(0,Math.min(max,v))}); }
    });
    if(falta){ toast('Captura los puntos de todos los indicadores (pon 0 si no cumple)'); return; }
    const total=Math.round(inds.reduce((s,x)=>s+x.pts,0)*10)/10, p=getProf(aid,pid)||{};
    setPath(`met/evalProf/${anio}/${peKey(aid,pid)}`,{id:peKey(aid,pid),aid,profId:pid,nombre:p.nombre||'',anio:+anio,inds,total,obs:($('#pe_obs')||{}).value.trim(),evaluador:($('#pe_eval')||{}).value.trim(),fecha:todayStr(),ts:Date.now()});
    closeModal(); render(); toast(`Evaluación guardada: ${total} puntos · ${peCat(total).t}`);
  },
  peBorrar(d){ if(!confirm('¿Eliminar esta evaluación?')) return; setPath(`met/evalProf/${d.y}/${peKey(d.aid,d.id)}`,undefined); closeModal(); render(); toast('Evaluación eliminada'); },
  peCfg(){ openPeCfg(session.area); },
  pcAdd(){ const l=$('#pc_lista'); if(!l) return; l.insertAdjacentHTML('beforeend',peCfgRow({t:'',pts:null})); const f=l.querySelectorAll('.pc-t'); f[f.length-1].focus(); pcSuma(); },
  pcDel(d,e){ const r=e&&e.target.closest('.pc-row'); if(r){ r.remove(); pcSuma(); } },
  pcGuardar(d){
    const l=pcLee().filter(x=>x.t||x.pts);
    if(l.some(x=>!x.t)){ toast('Cada indicador necesita su texto'); return; }
    if(l.some(x=>!x.pts)){ toast('Cada indicador necesita sus puntos'); return; }
    if(!l.length){ toast('Agrega al menos un indicador'); return; }
    const s=l.reduce((a,x)=>a+x.pts,0); if(s!==100){ toast(s<100?`Faltan ${100-s} puntos para sumar 100`:`Sobran ${s-100} puntos para sumar 100`); return; }
    setPath(`met/evalCfg/${d.aid}`,{inds:l,act:todayStr()}); closeModal(); render(); toast('Indicadores guardados');
  },
  pcReset(d){ if(!confirm('¿Volver a los indicadores y puntos originales del formato?')) return; setPath(`met/evalCfg/${d.aid}`,undefined); closeModal(); render(); toast('Indicadores originales restablecidos'); },
  peVer(d){ closeModal(); peVerModal(d.aid,d.id,d.y); },
  peImprimir(d){
    const ev=getPe(d.aid,d.id,d.y); if(!ev) return; closeModal();
    imprimirFormato({titulo:'EVALUACIÓN DE LOS PROFESORES',sub:'INDICADORES DEL DESEMPEÑO DEL DOCENTE DE ACADEMIAS DEPORTIVAS EN SU EVALUACIÓN ANUAL',codigo:PE_COD,vertical:true,centrar:true,cuerpo:peDocHTML(ev)});
  }
});
/* indicadores con los que se evalúa: los de la evaluación ya guardada o los vigentes del área */
function peCfgDe(aid,pid,anio){ const ex=getPe(aid,pid,anio); return ex?peArr(ex.inds).map(x=>({t:x.t,pts:x.max,tipo:x.tipo||''})):peCfg(aid); }
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.id==='pe_anio'){ closeModal(); openPe(t.dataset.aid,t.dataset.pid,t.value); }
  else if(t.id==='pe_met_anio'){ ui.mt.peAnio=+t.value; render(); }
});
