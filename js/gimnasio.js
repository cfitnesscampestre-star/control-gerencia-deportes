'use strict';
/* =====================================================================
   gimnasio.js — control del Gimnasio (sala de aparatos).
   No hay inscripciones ni grupos. Se controla:
     · Aforo por hora, separado en mujeres y hombres, contra la capacidad de la sala
     · Entrenamientos personalizados que tiene contratados cada instructor
       (sesiones contratadas, realizadas, saldo y vigencia)
   El área se reconoce por  tipo:'gimnasio'  y guarda su capacidad y su horario
   (apertura y cierre) en la configuración del área.
   ===================================================================== */
const GIM_SAT = 90;                                   // % de la capacidad desde el que se considera saturado
const esGim = aid => (getArea(aid)||{}).tipo==='gimnasio';
/* Horario y capacidad POR DÍA. area.horario = {d0:{a:6,c:23,cap:''}, …, d6:{…}} (d0 = lunes). Un día sin renglón = cerrado.
   La capacidad de un día vacía usa la capacidad general de la sala. Sin horario (áreas anteriores) todos los días abren igual. */
function gimDias(aid){
  const a=getArea(aid)||{}, cap=Math.max(1,+a.cap||60), H=a.horario;
  if(H&&typeof H==='object') return [0,1,2,3,4,5,6].map(d=>{
    const x=H['d'+d]||H[d]; if(!x) return null;
    const ab=+x.a, ci=+x.c; return (isNaN(ab)||isNaN(ci)||ci<=ab)?null:{abre:ab,cierra:ci,cap:Math.max(1,+x.cap||cap)};
  });
  const ab=(a.abre!=null&&a.abre!=='')?+a.abre:6, ci=(a.cierra!=null&&a.cierra!=='')?+a.cierra:22;
  return [0,1,2,3,4,5,6].map(()=>({abre:ab,cierra:ci,cap}));
}
const gimDia = (aid,wd) => gimDias(aid)[wd];
const gimCfg = aid => { const a=getArea(aid)||{}, H=gimDias(aid).filter(Boolean);
  return {cap:Math.max(1,+a.cap||60), abre:H.length?Math.min(...H.map(d=>d.abre)):6, cierra:H.length?Math.max(...H.map(d=>d.cierra)):22, estancia:Math.max(.5,+a.estancia||1.25)}; };
const gimCapDia = (aid,f) => { const d=gimDia(aid,wdIdx(f)); return d?d.cap:gimCfg(aid).cap; };
const gimHoras = (aid,f) => {                           // con fecha: las horas de ese día; sin fecha: todas las horas en que abre algún día
  const h=[]; if(f){ const d=gimDia(aid,wdIdx(f)); if(d) for(let i=d.abre;i<d.cierra;i++) h.push(i); return h; }
  const c=gimCfg(aid); for(let i=c.abre;i<c.cierra;i++) h.push(i); return h;
};
function gimHorarioTxt(aid){                            // “Lun–Sáb 6:00–23:00 · Dom 9:00–16:00”
  const D=gimDias(aid), runs=[]; for(let i=0;i<7;i++){ const d=D[i]; if(!d) continue; const k=d.abre+'-'+d.cierra+'-'+d.cap, l=runs[runs.length-1];
    if(l&&l.k===k&&l.b===i-1) l.b=i; else runs.push({a:i,b:i,k,d}); }
  return runs.map(r=>`${DIAS[r.a]}${r.b>r.a?'–'+DIAS[r.b]:''} ${r.d.abre}:00–${r.d.cierra}:00`).join(' · ')||'Cerrado';
}
const hh = h => pad(h)+':00';
const gimTot = r => (+r.mu||0)+(+r.ho||0);
const gimAreaId = () => { const a=areasList().find(x=>x.tipo==='gimnasio'); return a?a.id:null; };

/* ---------- cálculo ---------- */
function gimStats(aid,desde,hasta){
  const cap0=gimCfg(aid).cap, recs=coll(aid,'accesos').filter(r=>r.fecha>=desde&&r.fecha<=hasta), cd={}, capR=r=>cd[r.fecha]||(cd[r.fecha]=gimCapDia(aid,r.fecha));
  const horas={}, heat={}; let mu=0, ho=0, capS=0;
  recs.forEach(r=>{
    const h=+r.hora, t=gimTot(r), c=capR(r); mu+=+r.mu||0; ho+=+r.ho||0; capS+=c;
    const H=horas[h]=horas[h]||{n:0,mu:0,ho:0,cap:0}; H.n++; H.mu+=+r.mu||0; H.ho+=+r.ho||0; H.cap+=c;
    const k=wdIdx(r.fecha)+'_'+h, C=heat[k]=heat[k]||{n:0,t:0,cap:0}; C.n++; C.t+=t; C.cap+=c;
  });
  const porHora=Object.keys(horas).map(h=>({h:+h,muP:horas[h].mu/horas[h].n,hoP:horas[h].ho/horas[h].n,tP:(horas[h].mu+horas[h].ho)/horas[h].n,capP:horas[h].cap/horas[h].n,n:horas[h].n})).sort((a,b)=>a.h-b.h);
  porHora.forEach(x=>{ x.pct=Math.round(x.tP/x.capP*100); });
  const cap=recs.length?Math.round(capS/recs.length):cap0;                       // capacidad promedio de los días contados
  const tot=mu+ho, maxN=Math.max(0,...porHora.map(x=>x.n)), sig=porHora.filter(x=>x.n>=Math.max(1,Math.ceil(maxN/2)));   // pico y valle solo entre horas con suficientes conteos
  const pico=sig.slice().sort((a,b)=>b.tP-a.tP)[0]||null, valle=sig.slice().sort((a,b)=>a.tP-b.tP)[0]||null;
  return {cap,recs:recs.length,personasHora:tot,visitas:Math.round(tot/gimCfg(aid).estancia),mu,ho,pctMu:tot?Math.round(mu/tot*100):null,pctHo:tot?Math.round(ho/tot*100):null,
    aforo:recs.length?Math.round(recs.reduce((s,r)=>s+gimTot(r)/capR(r)*100,0)/recs.length):null,porHora,heat,pico,valle,
    saturadas:recs.filter(r=>gimTot(r)/capR(r)*100>=GIM_SAT).length, bajas:recs.filter(r=>gimTot(r)/capR(r)*100<20).length, dias:new Set(recs.map(r=>r.fecha)).size};
}
const ptSes = p => Object.values(p.sesiones||{});
const ptReal = p => ptSes(p).filter(s=>s.e==='realizada').length;
function ptEstado(p){
  const t=todayStr(), real=ptReal(p);
  if(real>=(+p.total||0)) return 'completado';
  if(p.fin&&p.fin<t) return 'vencido';
  if(p.fin&&p.fin<=addDays(t,7)) return 'por vencer';
  return 'activo';
}
const PT_CLS = {activo:'ok','por vencer':'warn',vencido:'bad',completado:'info'};
const ptVigente = p => ['activo','por vencer'].includes(ptEstado(p));
function ptResumen(aid){                                   // una fila por instructor
  const pk=coll(aid,'paquetes');
  return profesores(aid).map(p=>{
    const mios=pk.filter(x=>x.profId===p.id), act=mios.filter(ptVigente);
    const contratadas=act.reduce((n,x)=>n+(+x.total||0),0), realizadas=act.reduce((n,x)=>n+ptReal(x),0);
    return {p,mios,act,contratadas,realizadas,saldo:contratadas-realizadas,porVencer:act.filter(x=>ptEstado(x)==='por vencer').length,
      vencidos:mios.filter(x=>ptEstado(x)==='vencido').length,monto:act.reduce((n,x)=>n+(+x.monto||0),0)};
  });
}
function ptSesionesEn(aid,desde,hasta,e){                  // sesiones de todos los paquetes dentro de un período
  const out=[]; coll(aid,'paquetes').forEach(pk=>ptSes(pk).forEach(s=>{ if(s.f>=desde&&s.f<=hasta&&(!e||s.e===e)) out.push({pk,s}); })); return out;
}
function ptTotales(aid){
  const f=ptResumen(aid);
  return {instructores:f.filter(x=>x.mios.length).length,paquetes:anSum(f,x=>x.act.length),contratadas:anSum(f,x=>x.contratadas),realizadas:anSum(f,x=>x.realizadas),saldo:anSum(f,x=>x.saldo),porVencer:anSum(f,x=>x.porVencer),vencidos:anSum(f,x=>x.vencidos)};
}

/* ---------- gráfica de barras por hora (mujeres abajo, hombres arriba) ---------- */
function gimBarras(data,cap,alto){
  if(!data.length) return empty('Sin conteos capturados.');
  const max=Math.max(cap,...data.map(x=>x.mu+x.ho)), pct=v=>Math.min(100,v/max*100);
  return `<div class="gb"><div class="gb-plot" style="height:${alto||150}px">
      <div class="gb-grid"><i class="gb-l cap" style="bottom:${pct(cap)}%"><em>Capacidad ${cap}</em></i><i class="gb-l sat" style="bottom:${pct(cap*GIM_SAT/100)}%"></i></div>
      <div class="gb-cols">${data.map(x=>`<div class="gb-c" title="${hh(x.h)} · ${Math.round(x.mu)} mujeres · ${Math.round(x.ho)} hombres"><div class="gb-s"><i class="mu" style="height:${pct(x.mu)}%"></i><i class="ho" style="height:${pct(x.ho)}%"></i></div><span>${pad(x.h)}</span></div>`).join('')}</div>
    </div>
    <div class="an-leg"><span><i class="mu"></i>Mujeres</span><span><i class="ho"></i>Hombres</span><span>Línea punteada: ${GIM_SAT}% de la capacidad</span></div></div>`;
}
const gimSerie = (aid,fecha) => gimHoras(aid,fecha).map(h=>{ const r=getPath(`data/${aid}/accesos/${fecha}_${pad(h)}`); return r?{h,mu:+r.mu||0,ho:+r.ho||0}:null; }).filter(Boolean);

/* ---------- Inicio del Gimnasio ---------- */
function vGimInicio(aid){
  const t=todayStr(), c=gimCfg(aid), dh=gimDia(aid,wdIdx(t)), cap=gimCapDia(aid,t), ro=isRO(), S=gimStats(aid,t,t), S30=gimStats(aid,addDays(t,-29),t), P=ptTotales(aid);
  const serie=gimSerie(aid,t), ult=serie.length?serie[serie.length-1]:null, filas=ptResumen(aid).filter(x=>x.mios.length);
  const pAhora=ult?Math.round((ult.mu+ult.ho)/cap*100):null;
  return `<div class="dash has-chart gi">
    <div class="d-kpis">
      <div class="sub">${esc(fmtLarga(t))} · ${dh?`hoy abierto de ${hh(dh.abre)} a ${hh(dh.cierra)} · capacidad ${cap} personas`:'hoy el gimnasio no abre'}</div>
      <div class="gi-hero">
        <div class="gi-h1">
          <div class="gi-lbl">Mujeres / Hombres</div>
          <b class="gi-big">${S.pctMu==null?'—':`${S.pctMu}% / ${S.pctHo}%`}</b>
          <div class="gi-nums"><span><i class="mu"></i><b>${S.mu.toLocaleString('es-MX')}</b> mujeres</span><span><i class="ho"></i><b>${S.ho.toLocaleString('es-MX')}</b> hombres</span></div>
          <span>de ${S.personasHora.toLocaleString('es-MX')} personas contadas hoy</span>
        </div>
        <div class="gi-h2">
          <div class="gi-lbl">Personalizados activos</div>
          <div class="gi-numrow"><b class="gi-big">${P.paquetes}</b><button class="gi-plus" data-act="aTab" data-tab="gimpt" aria-label="Ver personalizados">+</button></div>
          <span>${plu(P.saldo,'sesión','sesiones')} por entregar</span>
        </div>
      </div>
    </div>
    <div class="d-hoy">
      <div class="h2">Hoy por hora</div>
      <div class="card gi-hoy">
        <div class="gi-now"><span>Ahora <b class="${aforoCls(pAhora)}">${ult?ult.mu+ult.ho:'—'}</b> ${ult?`personas · ${hh(ult.h)}`:'· sin captura hoy'}</span><span>Aforo de hoy <b class="${aforoCls(S.aforo)}">${anPct(S.aforo)}</b>${S.recs?` <small>· promedio ${Math.round(S.personasHora/S.recs)} de ${cap}</small>`:''}</span></div>
        ${gimBarras(serie,cap,140)}
        ${ro?'':`<div class="gi-cap"><span><b>${serie.length}/${gimHoras(aid,t).length}</b> horas con conteo</span><button class="btn sm primary" data-act="aTab" data-tab="gimaforo">Capturar aforo</button></div>`}
      </div>
      <div class="h2">Últimos 30 días</div>
      <div class="gi-30">
        <div><span class="gi-l">Aforo promedio</span><b class="${aforoCls(S30.aforo)}">${anPct(S30.aforo)}</b><small>${S30.recs?`${Math.round(S30.personasHora/S30.recs)} de ${S30.cap} personas`:'de la capacidad'}</small></div>
        <div><span class="gi-l">Hora pico</span><b class="gi-navy">${S30.pico?hh(S30.pico.h):'—'}</b><small>${S30.pico?`${Math.round(S30.pico.tP)} de ${S30.cap} personas`:'sin datos'}</small></div>
        <div><span class="gi-l">Horas saturadas</span><b class="${S30.saturadas?'warn':'ok'}">${S30.saturadas}</b><small>de ${S30.recs.toLocaleString('es-MX')} horas contadas, desde ${GIM_SAT}%</small></div>
      </div>
    </div>
    ${chSeccion(aid)}
    <div class="d-side">
      <div class="h2">Personalizados por instructor</div>
      ${filas.length?filas.map(x=>ptCard(x)).join(''):empty('Todavía no hay personalizados contratados.')}
      ${ro?'':`<div class="btns"><button class="btn" data-act="aTab" data-tab="gimpt">Ver personalizados</button></div>`}
    </div>
  </div>`;
}

/* ---------- Aforo por hora: captura ---------- */
const GA_TXT = {none:'Sin captura',saving:'Guardando…',saved:'Guardado ✔'};
const gaTimers = {}, gaPending = new Set(), gaVals = {};
const gaBusy = () => gaPending.size>0;
function gaEstado(r){ return r?'saved':'none'; }
function gaFilaCard(aid,fecha,h,r,ro,cap,esHoy,hActual){
  const mu=r?(+r.mu||0):'', ho=r?(+r.ho||0):'', tot=r?gimTot(r):0, p=r?Math.round(tot/cap*100):null, cls=aforoCls(p);
  const ctl=(g,lbl,v)=>ro?`<div class="ga-g ${g}"><span>${lbl}</span><b class="ga-ro">${v===''?'—':v}</b></div>`
    :`<div class="ga-g ${g}"><span>${lbl}</span><div class="ga-s"><button data-act="gaStep" data-h="${h}" data-g="${g}" data-n="-1" aria-label="Uno menos">−</button><input class="ga-in" data-h="${h}" data-g="${g}" type="number" inputmode="numeric" min="0" value="${v}" placeholder="0" aria-label="${lbl} a las ${hh(h)}"><button data-act="gaStep" data-h="${h}" data-g="${g}" data-n="1" aria-label="Uno más">+</button></div></div>`;
  return `<div class="ga-row${esHoy&&h===hActual?' now':''}" data-h="${h}" data-st="${gaEstado(r)}">
    <div class="ga-h"><b>${hh(h)}${esHoy&&h===hActual?' <em>ahora</em>':''}</b><span class="af-state">${GA_TXT[gaEstado(r)]}</span></div>
    <div class="ga-c">${ctl('mu','Mujeres',mu)}${ctl('ho','Hombres',ho)}</div>
    <div class="ga-f"><div class="bar ga-bar"><i class="${cls}" style="width:${Math.min(p||0,100)}%"></i></div><b class="ga-t ${cls}">${r?`${tot} personas · ${p}%`:'—'}</b></div>
    ${ro?'':`<button class="ga-cp" data-act="gaCopiar" data-h="${h}">Copiar la hora anterior</button>`}
  </div>`;
}
function gaFilaTr(aid,fecha,h,r,ro,cap){
  const mu=r?(+r.mu||0):'', ho=r?(+r.ho||0):'', tot=r?gimTot(r):0, p=r?Math.round(tot/cap*100):null, cls=aforoCls(p);
  const inp=(g,v)=>ro?`<span class="num">${v===''?'—':v}</span>`:`<input class="ga-in" data-h="${h}" data-g="${g}" type="number" inputmode="numeric" min="0" value="${v}" aria-label="${g==='mu'?'Mujeres':'Hombres'} a las ${hh(h)}">`;
  return `<tr class="ga-row" data-h="${h}" data-st="${gaEstado(r)}"><td class="num"><b>${hh(h)}</b></td><td>${inp('mu',mu)}</td><td>${inp('ho',ho)}</td>
    <td class="num ga-t2">${r?tot:'—'}</td><td><div class="af-cell"><div class="bar ga-bar"><i class="${cls}" style="width:${Math.min(p||0,100)}%"></i></div><span class="af-pct ${cls}">${p==null?'—':p+'%'}</span></div></td>
    <td><span class="af-state">${GA_TXT[gaEstado(r)]}</span></td><td>${ro?'':`<button class="btn sm" data-act="gaCopiar" data-h="${h}">Copiar hora anterior</button>`}</td></tr>`;
}
function vGimAforo(aid){
  const fecha=ui.gaFecha, ro=isRO(), desk=isDesktop(), cap=gimCapDia(aid,fecha), horas=gimHoras(aid,fecha), esHoy=fecha===todayStr(), hAct=new Date().getHours();
  const S=gimStats(aid,fecha,fecha), serie=gimSerie(aid,fecha);
  const nav=`<div class="af-date"><button class="ibtn" data-act="gaNav" data-n="-1" aria-label="Día anterior">${ic('back')}</button><b>${esc(fmtLarga(fecha))}</b><button class="ibtn" data-act="gaNav" data-n="1" aria-label="Día siguiente">${ic('next')}</button><input class="only-d" type="date" id="ga_date" value="${esc(fecha)}" aria-label="Elegir fecha"><button class="btn sm" data-act="gaHoy">Hoy</button></div>`;
  const filas=horas.map(h=>({h,r:getPath(`data/${aid}/accesos/${fecha}_${pad(h)}`)}));
  const body=!horas.length?empty('El gimnasio no abre este día según el horario configurado en Ajustes.'):desk
    ?`<div class="af-wrap"><table class="af-table ga-table"><thead><tr><th>Hora</th><th>Mujeres</th><th>Hombres</th><th>Total</th><th>Aforo</th><th>Estado</th><th></th></tr></thead><tbody>${filas.map(x=>gaFilaTr(aid,fecha,x.h,x.r,ro,cap)).join('')}</tbody></table></div>`
    :filas.map(x=>gaFilaCard(aid,fecha,x.h,x.r,ro,cap,esHoy,hAct)).join('');
  return `<div class="h2">Aforo por hora <button class="btn sm" data-act="gaPrint">Imprimir / PDF</button></div>
    <div class="sub">${ro?'Conteos capturados por la dirección y la recepción del gimnasio.':'Cada hora cuenta cuántas personas hay en la sala, separadas en mujeres y hombres. Se guarda solo.'} Capacidad: ${cap} personas.</div>
    ${nav}
    <div class="ga-sum">${gaResumen(aid,fecha)}</div>
    <div class="card" style="margin:12px 0">${gimBarras(serie,cap,120)}</div>
    ${body}`;
}
function gaResumen(aid,fecha){
  const S=gimStats(aid,fecha,fecha);
  return `<div class="kpis k3">
    ${kpi('Horas capturadas',`${S.recs}/${gimHoras(aid,fecha).length}`,'del día',{cls:S.recs===gimHoras(aid,fecha).length?'ok':'',color:'var(--b2)'})}
    ${kpi('Aforo del día',anPct(S.aforo),S.recs?`promedio ${Math.round(S.personasHora/S.recs)} de ${gimCapDia(aid,fecha)} personas`:'promedio',{cls:aforoCls(S.aforo),color:'var(--b1)'})}
    ${kpi('Mujeres / hombres',S.pctMu==null?'—':`${S.pctMu}/${S.pctHo}`,S.recs?`${S.mu} mujeres · ${S.ho} hombres`:'% del día',{color:'var(--b3)'})}</div>`;
}
function gaPaint(h,mu,ho,st){
  const aid=curArea(), cap=gimCapDia(aid,ui.gaFecha), tot=(+mu||0)+(+ho||0), p=(mu===''&&ho==='')?null:Math.round(tot/cap*100), cls=aforoCls(p);
  document.querySelectorAll(`.ga-row[data-h="${h}"]`).forEach(row=>{
    row.dataset.st=st;
    const bi=row.querySelector('.ga-bar i'); if(bi){ bi.className=cls; bi.style.width=Math.min(p||0,100)+'%'; }
    const t=row.querySelector('.ga-t'); if(t){ t.textContent=p==null?'—':`${tot} personas · ${p}%`; t.className='ga-t '+cls; }
    const t2=row.querySelector('.ga-t2'); if(t2) t2.textContent=p==null?'—':tot;
    const pc=row.querySelector('.af-pct'); if(pc){ pc.textContent=p==null?'—':p+'%'; pc.className='af-pct '+cls; }
    const s=row.querySelector('.af-state'); if(s) s.textContent=GA_TXT[st]||'';
  });
}
function gaLeer(h){ const row=document.querySelector(`.ga-row[data-h="${h}"]`); if(!row) return gaVals[h]||{mu:'',ho:''}; const g=x=>{ const i=row.querySelector(`.ga-in[data-g=${x}]`); return i?i.value:''; }; return {mu:g('mu'),ho:g('ho')}; }
function gaCommit(aid,fecha,h){
  const v=gaVals[h]||gaLeer(h); gaPending.delete(h); delete gaVals[h];
  if(v.mu===''&&v.ho==='') return;
  const id=`${fecha}_${pad(h)}`, mu=Math.max(0,Math.round(+v.mu||0)), ho=Math.max(0,Math.round(+v.ho||0));
  setPath(`data/${aid}/accesos/${id}`,{id,fecha,hora:h,mu,ho});
  if(aid===curArea()&&fecha===ui.gaFecha){ gaPaint(h,mu,ho,'saved'); const el=$('.ga-sum'); if(el) el.innerHTML=gaResumen(aid,fecha); }
  if(pendingRender&&!gaBusy()&&!(typeof afBusy==='function'&&afBusy())){ pendingRender=false; safeRender(); }
}
function gaQueue(h,delay){
  clearTimeout(gaTimers[h]); const aid=curArea(), fecha=ui.gaFecha;
  gaVals[h]=gaLeer(h); gaPending.add(h);
  gaTimers[h]=setTimeout(()=>gaCommit(aid,fecha,h),delay);
}
function gaSet(h,g,val,delay){
  const row=document.querySelector(`.ga-row[data-h="${h}"]`), inp=row&&row.querySelector(`.ga-in[data-g=${g}]`); if(!inp) return;
  inp.value=Math.max(0,Math.round(+val||0)); const v=gaLeer(h);
  if(v.mu===''&&g!=='mu') { const o=row.querySelector('.ga-in[data-g=mu]'); if(o) o.value=0; }
  if(v.ho===''&&g!=='ho') { const o=row.querySelector('.ga-in[data-g=ho]'); if(o) o.value=0; }
  const w=gaLeer(h); gaPaint(h,w.mu,w.ho,'saving'); gaQueue(h,delay==null?400:delay);
}

/* ---------- Personalizados ---------- */
function ptCard(x){
  const pct=x.contratadas?Math.round(x.realizadas/x.contratadas*100):0;
  return `<button class="ptc" data-act="ptDetalle" data-id="${esc(x.p.id)}">
    ${avatarHTML(x.p.nombre,x.p.foto,46)}
    <div class="ptc-b"><b>${esc(x.p.nombre)}</b>
      <div class="ptc-n"><span><b>${x.contratadas}</b> contratadas</span><span><b>${x.realizadas}</b> realizadas</span><span><b class="${x.saldo?'warn':'ok'}">${x.saldo}</b> pendientes</span></div>
      <div class="bar"><i class="${pct>=75?'ok':pct>=30?'warn':'bad'}" style="width:${pct}%"></i></div>
      <small>${plu(x.act.length,'paquete activo','paquetes activos')}${x.porVencer?` · <span class="warn">${plu(x.porVencer,'por vencer','por vencer')}</span>`:''}${x.vencidos?` · <span class="bad">${plu(x.vencidos,'vencido con saldo','vencidos con saldo')}</span>`:''}</small></div>
  </button>`;
}
function vGimPT(aid){
  const ro=roDatos(aid), T=ptTotales(aid), filas=ptResumen(aid), conP=filas.filter(x=>x.mios.length), sinP=filas.filter(x=>!x.mios.length);
  return `<div class="h2">Personalizados <button class="btn sm" data-act="ptPrint">Imprimir / PDF</button>${ro?'':`<button class="btn sm primary" data-act="openPT" style="margin-left:8px">+ Personalizado</button>`}</div>
    <div class="sub">Entrenamientos personalizados que tiene contratados cada instructor: sesiones contratadas, realizadas y por entregar.</div>
    <div class="kpis an-kpis">
      ${kpi('Paquetes activos',T.paquetes,`de ${plu(T.instructores,'instructor','instructores')}`,{color:'var(--b2)'})}
      ${kpi('Contratadas',T.contratadas,'sesiones en paquetes activos',{color:'var(--b3)'})}
      ${kpi('Realizadas',T.realizadas,T.contratadas?`${Math.round(T.realizadas/T.contratadas*100)}% de avance`:'',{cls:'ok',color:'var(--b1)'})}
      ${kpi('Por entregar',T.saldo,'sesiones pendientes',{cls:T.saldo?'warn':'',color:'var(--warn)'})}
      ${kpi('Por vencer',T.porVencer,'en los próximos 7 días',{cls:T.porVencer?'warn':'ok',color:'var(--bad)'})}
      ${kpi('Vencidos con saldo',T.vencidos,'sesiones sin usar a tiempo',{cls:T.vencidos?'bad':'ok',color:'var(--bad)'})}
    </div>
    <div class="h2 sm">Por instructor</div>
    ${conP.length?`<div class="ptlist">${conP.map(ptCard).join('')}</div>`:empty(ro?'Todavía no hay personalizados contratados.':'Todavía no hay personalizados. Registra el primero con “+ Personalizado”.')}
    ${sinP.length?`<div class="an-cs" style="margin-top:12px">Sin personalizados: ${esc(sinP.map(x=>x.p.nombre).join(', '))}.</div>`:''}`;
}
function ptDetalle(pid){
  const aid=curArea(), p=getProf(aid,pid); if(!p) return;
  const pk=coll(aid,'paquetes').filter(x=>x.profId===pid).sort((a,b)=>(ptVigente(b)-ptVigente(a))||String(b.fin).localeCompare(String(a.fin)));
  const ro=roDatos(aid), rec=isRec();
  openModal(`${mHead(esc(p.nombre))}
    <div class="sub">${esc(p.tipo||'Instructor')} · ${plu(pk.filter(ptVigente).length,'paquete activo','paquetes activos')}</div>
    ${pk.length?pk.map(x=>{
      const real=ptReal(x), tot=+x.total||0, est=ptEstado(x), sim=fcId(x.id), ses=ptSes(x).sort((a,b)=>(b.f+(b.h||'')).localeCompare(a.f+(a.h||''))).slice(0,4);
      return `<div class="card ptp"><div class="row"><div><b>${esc(x.cliente||'Cliente')}</b><small>${esc(fmtCorta(x.inicio))} al ${esc(fmtCorta(x.fin))}${x.monto?' · '+esc(mxn(+x.monto)):''}</small></div>${pill(est,PT_CLS[est])}</div>
        <div class="ptp-b"><div class="bar"><i class="${real>=tot?'info':aforoCls(tot?Math.round(real/tot*100):0)}" style="width:${tot?Math.min(100,Math.round(real/tot*100)):0}%"></i></div><b>${real}/${tot}</b></div>
        ${ses.length?`<div class="ptp-s">${ses.map(s=>`<span class="${s.e==='realizada'?'ok':'mut'}">${esc(fmtFecha(s.f))}${s.h?' '+esc(s.h):''} · ${esc(s.e==='realizada'?'realizada':s.e)}</span>${(ro||sim||rec)?'':`<button class="ptp-x" data-act="delSesion" data-pk="${esc(x.id)}" data-id="${esc(s.id)}" aria-label="Borrar sesión">${ic('x')}</button>`}`).join('')}</div>`:''}
        ${x.notas?`<small class="mut">${esc(x.notas)}</small>`:''}
        ${x.por?`<small class="mut">Dado de alta por ${esc(x.por)}</small>`:''}
        ${(ro||sim)?'':`<div class="btns">${rec?'':`<button class="btn sm primary" data-act="openSesion" data-id="${esc(x.id)}">+ Sesión</button>`}<button class="btn sm" data-act="openPT" data-id="${esc(x.id)}">Editar</button></div>`}</div>`; }).join(''):empty('Este instructor todavía no tiene personalizados.')}
    ${ro?`<div class="btns"><button class="btn" data-act="closeModal">Cerrar</button></div>`:`<div class="btns"><button class="btn primary" data-act="openPT" data-prof="${esc(pid)}">+ Personalizado para ${esc(p.nombre.split(' ')[0])}</button></div>`}`);
}
function openPT(id,profPre){
  const aid=curArea(), x=id?(getPath(`data/${aid}/paquetes/${id}`)||{}):{}, ps=profesores(aid).filter(p=>p.activo!==false), t=todayStr(), cur=x.profId||profPre||'';
  if(!ps.length){ toast('Primero da de alta a los instructores'); return; }
  openModal(`${mHead(id?'Editar personalizado':'Nuevo personalizado')}
    <label class="f"><span>Asignar al instructor</span><select id="pt_prof">${ps.map(p=>`<option value="${esc(p.id)}"${cur===p.id?' selected':''}>${esc(p.nombre)}${p.pin?'':' (sin PIN: aún no puede entrar)'}</option>`).join('')}</select></label>
    <label class="f"><span>Cliente</span><input id="pt_cli" value="${esc(x.cliente)}" placeholder="Nombre o iniciales"></label>
    <div class="two"><label class="f"><span>Sesiones contratadas</span><input id="pt_tot" type="number" inputmode="numeric" min="1" value="${esc(x.total||12)}"></label>
      <label class="f"><span>Monto (opcional)</span><input id="pt_monto" type="number" inputmode="numeric" min="0" value="${esc(x.monto)}" placeholder="$"></label></div>
    <div class="two"><label class="f"><span>Inicio</span><input id="pt_ini" type="date" value="${esc(x.inicio||t)}"></label>
      <label class="f"><span>Vence</span><input id="pt_fin" type="date" value="${esc(x.fin||addDays(t,60))}"></label></div>
    <label class="f"><span>Notas (opcional)</span><textarea id="pt_notas">${esc(x.notas)}</textarea></label>
    <div class="btns"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="savePT" data-id="${esc(id||'')}">Guardar</button></div>
    ${(id&&(!isRec()||!ptSes(x).length))?`<div class="btns"><button class="btn danger" data-act="delPT" data-id="${esc(id)}">Eliminar personalizado</button></div>`:''}`);
}
function openSesion(pkId){
  const aid=curArea(), x=getPath(`data/${aid}/paquetes/${pkId}`); if(!x) return;
  openModal(`${mHead('Registrar sesión')}
    <div class="sub">${esc(x.cliente||'Cliente')} · lleva ${ptReal(x)} de ${+x.total||0}</div>
    <div class="two"><label class="f"><span>Fecha</span><input id="ss_f" type="date" max="${todayStr()}" value="${todayStr()}"></label><label class="f"><span>Hora</span><input id="ss_h" type="time" value="${pad(new Date().getHours())}:00"></label></div>
    <label class="f"><span>Resultado</span><select id="ss_e"><option value="realizada">Realizada</option><option value="cancelada por el cliente">Cancelada por el cliente</option><option value="cancelada por el instructor">Cancelada por el instructor</option></select></label>
    <div class="btns"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="saveSesion" data-id="${esc(pkId)}">Guardar sesión</button></div>`);
}

Object.assign(actions,{
  gaNav(d){ ui.gaFecha=addDays(ui.gaFecha,+d.n); render(); },
  gaHoy(){ ui.gaFecha=todayStr(); render(); },
  gaStep(d){ const inp=document.querySelector(`.ga-row[data-h="${d.h}"] .ga-in[data-g=${d.g}]`); if(!inp) return; gaSet(d.h,d.g,(inp.value===''?0:+inp.value)+(+d.n)); },
  gaCopiar(d){
    const aid=curArea(), prev=getPath(`data/${aid}/accesos/${ui.gaFecha}_${pad(+d.h-1)}`);
    if(!prev){ toast('La hora anterior no tiene captura'); return; }
    gaSet(d.h,'mu',prev.mu,150); gaSet(d.h,'ho',prev.ho,150);
  },
  ptDetalle(d){ ptDetalle(d.id); },
  openPT(d){ if(roDatos(curArea())) return; closeModal(); openPT(d.id||'',d.prof||''); },
  savePT(d){
    const aid=curArea(), cli=$('#pt_cli').value.trim(), tot=parseInt($('#pt_tot').value)||0, ini=$('#pt_ini').value, fin=$('#pt_fin').value;
    if(!cli){ toast('Escribe el nombre del cliente'); return; }
    if(tot<1){ toast('Indica cuántas sesiones se contrataron'); return; }
    if(!ini||!fin||fin<ini){ toast('Revisa las fechas de inicio y vencimiento'); return; }
    const id=d.id||('pt'+uid()), prev=d.id?(getPath(`data/${aid}/paquetes/${id}`)||{}):{};
    setPath(`data/${aid}/paquetes/${id}`,{...prev,id,profId:$('#pt_prof').value,cliente:cli,total:tot,monto:+$('#pt_monto').value||0,inicio:ini,fin,notas:$('#pt_notas').value.trim(),por:prev.por||gimPor(),alta:prev.alta||Date.now()});
    closeModal(); render(); toast('Personalizado guardado');
  },
  delPT(d){ if(isRec()&&ptSes(getPath(`data/${curArea()}/paquetes/${d.id}`)||{}).length){ toast('Ya tiene sesiones registradas: solo la dirección puede eliminarlo'); return; } if(!confirm('¿Eliminar este personalizado y sus sesiones?')) return; setPath(`data/${curArea()}/paquetes/${d.id}`,undefined); closeModal(); render(); toast('Personalizado eliminado'); },
  openSesion(d){ closeModal(); openSesion(d.id); },
  saveSesion(d){
    const aid=curArea(), f=$('#ss_f').value, pk=getPath(`data/${aid}/paquetes/${d.id}`); if(!pk||isRec()) return;
    if(isProf()&&pk.profId!==session.profId) return;                                 // el instructor solo registra sesiones de sus personalizados
    if(!f){ toast('Elige la fecha'); return; }
    if(f>todayStr()){ toast('La sesión no puede ser de una fecha futura'); return; }
    const sid='s'+uid(); setPath(`data/${aid}/paquetes/${d.id}/sesiones/${sid}`,{id:sid,f,h:$('#ss_h').value,e:$('#ss_e').value,ts:Date.now(),por:isProf()?session.profId:'dir'});
    closeModal(); render(); toast('Sesión registrada');
  },
  delSesion(d){
    const p=getPath(`data/${curArea()}/paquetes/${d.pk}`); if(isRec()||(isProf()&&(!p||p.profId!==session.profId))) return;
    if(isProf()&&!confirm('¿Borrar esta sesión?')) return;
    setPath(`data/${curArea()}/paquetes/${d.pk}/sesiones/${d.id}`,undefined); render(); if(p&&!isProf()) ptDetalle(p.profId);
  }
});
document.addEventListener('input',e=>{
  const t=e.target; if(!t.classList||!t.classList.contains('ga-in')) return;
  const h=t.dataset.h, v=gaLeer(h); gaPaint(h,v.mu,v.ho,'saving'); gaQueue(h,700);
});
document.addEventListener('change',e=>{ if(e.target.id==='ga_date'&&e.target.value){ ui.gaFecha=e.target.value; render(); } });
document.addEventListener('keydown',e=>{
  const t=e.target; if(e.key!=='Enter'||!t.classList||!t.classList.contains('ga-in')) return; e.preventDefault();
  const all=[...document.querySelectorAll('.ga-in')], nx=all[all.indexOf(t)+1]||t; nx.focus(); if(nx.select) nx.select();
});
