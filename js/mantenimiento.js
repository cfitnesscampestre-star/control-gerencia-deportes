'use strict';
/* =====================================================================
   mantenimiento.js — Control Mantenimiento → Gerencia y direcciones (SOLO LECTURA)
   Lee en tiempo real la base de Control Mantenimiento (proyecto registro-mantenimiento-9854c):
     /reportes    reportes abiertos que mandan los entrenadores
     /historial   reportes que el entrenador ya cerró
     /equipos, /salones, /preventivo, /fotos/{id}   (las fotos solo se piden al abrir un reporte)
   Gerencia y las direcciones NUNCA escriben en esa base. Los reportes los atiende el técnico en su app.

   Pantalla "Mantenimiento": la misma de Reportes de Control Mantenimiento (periodo con calendario, filtro de urgencia,
   carrusel que avanza solo, botones rojo / amarillo / verde y detalle del reporte), pero sin poder modificar nada.
     · Gerencia (pestaña "Mantenimiento"): todos los reportes, con un filtro por área.
     · Cada dirección: solo los reportes de los entrenadores de su área.

   ¿De qué área es un reporte?  mantArea(r)
     · Fitness: origen:'fitness' o profId numérico (número de instructor de Fitness Control) → el área vinculada a Fitness.
     · Entrenadores de Gerencia: origen:'gerencia' y areaId = id del área en Gerencia.
     · Los de ejemplo o de prueba (profId 'ejemplo' / 'prueba') nunca se muestran.
   El entrenador puede reportar si su ficha tiene mantenimiento:true (se activa al darlo de alta, en Profesores).
   ===================================================================== */
const MANT_NODOS = ['salones','equipos','reportes','preventivo'];
const MANT_CACHE = 'gd_mant_cache_v1';
const MANT_URG = { normal:'Normal', urgente:'Urgente', fuera:'No se puede usar' };
const MT_SEG = 6, MT_ESPERA = 15;                    // carrusel: segundos por reporte y espera después de tocarlo
let mantRaw = { salones:null, equipos:null, reportes:null, preventivo:null, historial:null }, mantMeta = { estado:'sin', msg:'' }, mantT = null, mantDb = null;
let mantInformes = {};                               // reportes que Mantenimiento mandó a Gerencia (no se guardan en el caché)
const MFOT = {};                                     // fotos ya pedidas: MFOT[idReporte] = {antes,despues}
const mnUi = { estado:null, urg:null, urgAbre:false, per:{t:'pend'}, area:'todas', reset:false,
  pausa:!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches) };
let mnScroll = 0, mnHover = false, mnUlt = 0, mnSheetId = null;

if(typeof ICONS!=='undefined'){
  ICONS.llave = '<path d="M14.5 6.5a4 4 0 0 0-5 5L4 17l3 3 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z"/>';
  ICONS.pausa = '<path d="M8 5v14M16 5v14"/>';
  ICONS.play = '<path d="M8 5l11 7-11 7z"/>';
  ICONS.reloj = '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>';
}
try{ const c=JSON.parse(localStorage.getItem(MANT_CACHE)||'null'); if(c&&c.raw){ mantRaw=Object.assign(mantRaw,c.raw); mantMeta={estado:'cache',msg:''}; } }catch(e){}

function mantConectar(db){
  mantDb=db;
  if(mantMeta.estado!=='cache') mantMeta={estado:'conectando',msg:''};
  MANT_NODOS.forEach(k=>{
    db.ref(k).on('value',snap=>{
      mantRaw[k]=snap.val()||{}; mantMeta={estado:'ok',msg:''}; clearTimeout(mantT);
      mantT=setTimeout(()=>{ try{ localStorage.setItem(MANT_CACHE,JSON.stringify({ts:Date.now(),raw:mantRaw})); }catch(e){} safeRender(); },250);
    },err=>{ mantMeta={estado:'error',msg:(err&&err.message)||String(err)}; safeRender(); });
  });
  db.ref('informes').limitToLast(30).on('value',snap=>{ mantInformes=snap.val()||{}; clearTimeout(mantT); mantT=setTimeout(safeRender,250); },()=>{});
  db.ref('historial').limitToLast(200).on('value',snap=>{            // reportes que el entrenador ya cerró (para contar los atendidos)
    mantRaw.historial=snap.val()||{}; clearTimeout(mantT);
    mantT=setTimeout(()=>{ try{ localStorage.setItem(MANT_CACHE,JSON.stringify({ts:Date.now(),raw:mantRaw})); }catch(e){} safeRender(); },250);
  },()=>{});
}

/* ---------- datos ---------- */
const mantConfig = () => !!(typeof FIREBASE_CONFIG_MANT!=='undefined'&&FIREBASE_CONFIG_MANT.databaseURL);
const mantArr = k => Object.keys(mantRaw[k]||{}).map(id=>Object.assign({id},mantRaw[k][id]));
const mantEq = id => Object.assign({nombre:'Equipo (eliminado)',salonId:''},(mantRaw.equipos||{})[id]||{});
const mantSalon = id => Object.assign({nombre:'—',area:''},(mantRaw.salones||{})[id]||{});
const mantVence = r => r.estado==='nuevo';                         // ROJO: nadie lo ha abierto (sin importar la urgencia). Amarillo: en proceso. Verde: resuelto.
const mantEsPrueba = r => r.profId==='ejemplo' || r.profId==='prueba';
const mantEsFitness = r => r.origen==='fitness' || (r.origen==null && /^\d+$/.test(String(r.profId==null?'':r.profId)));
/* ¿De qué área es un reporte? Devuelve el id del área en Gerencia, o null (no se muestra). */
function mantArea(r){
  if(mantEsPrueba(r)) return null;
  if(mantEsFitness(r)) return typeof fcAreaVinculada==='function' ? fcAreaVinculada() : null;
  if(r.origen==='gerencia' && r.areaId && getArea(r.areaId)) return r.areaId;
  return null;
}
const mantDe = (aid,r) => !!aid && mantArea(r)===aid;
/* ¿El área usa Mantenimiento? Fitness siempre (sus reportes vienen de Control Fitness); las demás, solo si gerencia deportiva
   la activó (Ajustes → Mantenimiento por área). Después, la dirección activa a cada profesor. */
function mantAplica(aid){
  if(!aid||!mantConfig()) return false;
  const a=getArea(aid); if(!a) return false;
  return esFitArea(aid) || !!a.mantenimiento;
}
const mantAlguna = () => mantConfig() && areasList().some(a=>mantAplica(a.id));   // ¿hay algún área con Mantenimiento? (para mostrar la pestaña de gerencia)
const mantArrP = v => Array.isArray(v) ? v : v ? Object.values(v) : [];
function mantHace(ts){
  const m=Math.max(0,Math.round((Date.now()-ts)/6e4));
  if(m<60) return 'hace '+m+' min';
  const h=Math.round(m/60); if(h<48) return 'hace '+h+' h';
  return 'hace '+Math.round(h/24)+' días';
}
function mantStats(aid){
  const rs=mantAplica(aid)?mantArr('reportes').filter(r=>mantDe(aid,r)):[];
  const compras=rs.filter(r=>(r.compra||r.cambio)&&r.estado!=='resuelto');
  const hace30=Date.now()-30*864e5;
  const cer=mantAplica(aid)?Object.keys(mantRaw.historial||{}).map(id=>mantRaw.historial[id]).filter(r=>mantDe(aid,r)&&(r.cerrado||0)>=hace30).length:0;
  return {
    rs, cer,
    rojos:rs.filter(mantVence),
    proceso:rs.filter(r=>r.estado==='atencion'),
    res:rs.filter(r=>r.estado==='resuelto'),
    compras, total:compras.reduce((n,r)=>n+(parseFloat(r.costo)||0),0)
  };
}
function mantPrevVencidos(){
  const hoy=new Date(); hoy.setHours(0,0,0,0);
  return mantArr('preventivo').filter(p=>Math.round((p.proxima-hoy.getTime())/864e5)<0).length;
}
/* Todos los reportes (abiertos y ya cerrados por el entrenador) de un área, o de todas si scope es null. Cada uno trae _a = su área. */
function mantFilas(scope){
  const out=[];
  const toma=(r,cerrada)=>{ const a=mantArea(r); if(!a) return; if(scope?a!==scope:!mantAplica(a)) return; out.push(Object.assign({},r,{_a:a,cerrada})); };
  mantArr('reportes').forEach(r=>toma(r,false));
  mantArr('historial').forEach(r=>toma(r,true));
  return out;
}

/* ---------- fechas y tiempos (con prefijo mn para no chocar con los de Gerencia) ---------- */
const mnSod = t => { const d=new Date(t); d.setHours(0,0,0,0); return d.getTime(); };
const mnFin = t => { const d=new Date(t); d.setHours(23,59,59,999); return d.getTime(); };
const mnAdd = (t,n) => { const d=new Date(t); d.setDate(d.getDate()+n); return d.getTime(); };
const mnInput = t => { const d=new Date(t); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const mnFechaTxt = t => new Date(t).toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long'});
const mnCorta = t => new Date(t).toLocaleDateString('es-MX',{day:'numeric',month:'short'}).replace('.','');
const mnFechaHora = t => new Date(t).toLocaleString('es-MX',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
function mnDur(ms){
  ms=Math.max(0,ms); let s=Math.floor(ms/1000); const d=Math.floor(s/86400); s%=86400;
  const h=Math.floor(s/3600); s%=3600; const m=Math.floor(s/60); s%=60;
  return (d?d+' d ':'')+pad(h)+':'+pad(m)+':'+pad(s);
}
function mnDurCorta(ms){
  const m=Math.round(Math.max(0,ms)/6e4);
  if(m<1) return Math.round(Math.max(0,ms)/1000)+' s';
  if(m<60) return m+' min';
  const h=Math.floor(m/60), mm=m%60;
  return h<48 ? h+' h'+(mm?' '+mm+' min':'') : Math.floor(h/24)+' d '+(h%24)+' h';
}
/* Sin periodo ("pend") se ven los pendientes de resolver. Con periodo se ven TODOS los reportes que llegaron en esas fechas (abiertos y ya cerrados). */
function mnRango(){
  const p=mnUi.per; if(p.t==='pend') return null;
  const hoy=mnSod(Date.now()); let d, h=mnFin(hoy);
  if(p.t==='hoy') d=hoy; else if(p.t==='7') d=mnAdd(hoy,-6); else if(p.t==='30') d=mnAdd(hoy,-29);
  else if(p.t==='90') d=mnAdd(hoy,-89); else if(p.t==='365') d=mnAdd(hoy,-364);
  else if(p.t==='mes'){ const m=new Date(hoy); m.setDate(1); d=m.getTime(); }
  else if(p.t==='all') d=0;
  else { d=new Date(p.desde+'T00:00:00').getTime(); h=mnFin(new Date(p.hasta+'T00:00:00').getTime()); }
  return {desde:d,hasta:h};
}

/* ---------- piezas de la pantalla ---------- */
const mnSem = r => r.estado==='resuelto'?'verde':r.estado==='atencion'?'amar':'rojo';
const mnPillEstado = r => r.estado==='resuelto'?pill('Resuelto','ok big'):r.estado==='atencion'?pill('En proceso','warn big'):pill('Sin atender','bad big');
const mnPillUrg = r => r.urg==='fuera'?pill('No se puede usar','u-fuera'):r.urg==='urgente'?pill('Urgente','u-urg'):pill('Normal','mut');
function mnTimer(r){
  const fin=r.estado==='resuelto'?(r.resuelto||Date.now()):0;
  return `<div class="rep-time">${ic('reloj')}<span>${fin?'Resuelto en':'Tiempo desde que llegó'}</span><b class="timer${fin?' stop':''}" data-t0="${r.creado}">${mnDur((fin||Date.now())-r.creado)}</b></div>`;
}
function mnRepCard(r,todas){
  const e=mantEq(r.equipoId), x=[];
  const a=todas&&r._a?getArea(r._a):null;
  if(r.otroLugar) x.push('<small><b>Reportado desde otro salón</b></small>');
  if(r.cerrada) x.push('<small>El entrenador ya cerró este aviso</small>');
  if(r.tecnico&&r.estado!=='nuevo') x.push(`<small>Atiende: ${esc(r.tecnico)}</small>`);
  if(r.diag) x.push(`<small><b>Diagnóstico:</b> ${esc(r.diag)}</small>`);
  if(r.compra||r.cambio) x.push(`<small>${r.compra?'Requiere compra':''}${r.compra&&r.cambio?' · ':''}${r.cambio?'Requiere cambio':''}${r.costo?' · estimado $'+esc(r.costo):''}</small>`);
  return `<button class="rep ${mnSem(r)}" data-act="mnOpen" data-id="${esc(r.id)}">
    <div class="rep-h">${mnPillEstado(r)}${mnPillUrg(r)}<span class="go">${ic('next')}</span></div>
    <b class="rep-t">${esc(e.nombre)}</b><span class="rep-d">${esc(r.desc||'')}</span>
    <small>${esc(mantSalon(e.salonId).nombre)} · ${esc(r.prof||'Entrenador')}${r.clase?' · '+esc(r.clase):''}${a?' · '+esc(a.nombre):''} · llegó ${mnFechaHora(r.creado)}</small>
    ${x.length?`<div class="rep-x">${x.join('')}</div>`:''}${mnTimer(r)}</button>`;
}
function mnBarraPeriodo(R,total){
  const nombres={hoy:'Hoy','7':'Últimos 7 días','30':'Últimos 30 días','90':'Últimos 3 meses','365':'Últimos 12 meses',mes:'Este mes',all:'Todo el historial'};
  let t;
  if(!R) t=['Hoy · '+mnFechaTxt(mnSod(Date.now())),'Pendientes de resolver'];
  else {
    const rango=mnUi.per.t==='all'?'Desde el primer reporte':mnUi.per.t==='hoy'?mnFechaTxt(R.desde):mnCorta(R.desde)+' – '+mnCorta(R.hasta)+' '+new Date(R.hasta).getFullYear();
    t=[mnUi.per.t==='custom'?rango:nombres[mnUi.per.t]+' · '+rango, plu(total,'reporte','reportes')+' en el periodo'];
  }
  return `<div class="mn-per"><div class="mn-pt"><b>${esc(t[0])}</b><small>${esc(t[1])}</small></div><div class="mn-btns">
    ${R?'<button class="btn sm" data-act="mnPer" data-v="pend">Pendientes</button>':''}
    <button class="mn-cal" data-act="mnCal" aria-label="Elegir el periodo">${ic('cal')}<span>Fechas</span></button></div></div>`;
}
function mantEstadoConexion(){
  const m=mantMeta;
  if(m.estado==='ok') return '<div class="mn-conn"><i></i>Conectado · solo lectura</div>';
  if(m.estado==='error') return `<div class="vinc off"><b>No se pudo leer Control Mantenimiento</b><span>${esc(m.msg)}</span></div>`;
  if(m.estado==='cache') return '<div class="vinc off"><b>Copia guardada de Control Mantenimiento</b><span>Se muestra lo último que se recibió en este equipo.</span></div>';
  return '<div class="vinc off"><b>Conectando con Control Mantenimiento…</b><span>Un momento…</span></div>';
}

/* ---------- pantalla principal (scope: id del área, o null = todas, para gerencia) ---------- */
function vMantPantalla(scope){
  let todos=mantFilas(scope);
  if(!scope&&mnUi.area!=='todas') todos=todos.filter(r=>r._a===mnUi.area);
  const R=mnRango(), base=R?todos.filter(r=>r.creado>=R.desde&&r.creado<=R.hasta):todos.filter(r=>!r.cerrada);
  const cnt={nuevo:0,atencion:0,resuelto:0};
  base.forEach(r=>{ cnt[r.estado]=(cnt[r.estado]||0)+1; });
  let l=base.filter(r=>mnUi.estado?r.estado===mnUi.estado:(R?true:r.estado!=='resuelto'));
  if(mnUi.urg) l=l.filter(r=>r.urg===mnUi.urg);
  l.sort((a,b)=>{ const ga=a.estado==='resuelto'?1:0, gb=b.estado==='resuelto'?1:0; return ga!==gb?ga-gb:ga?(b.resuelto||0)-(a.resuelto||0):a.creado-b.creado; });
  const titulo=mnUi.estado==='nuevo'?'No visto':mnUi.estado==='atencion'?'En proceso':mnUi.estado==='resuelto'?'Resueltos':R?'Todos los reportes':'Sin resolver';
  const orden=R?plu(l.length,'reporte','reportes')+' · pendientes primero':mnUi.estado==='resuelto'?'Los más recientes primero':'El que lleva más tiempo, primero';
  const sts=[['nuevo','rojo','No visto'],['atencion','amar','En proceso'],['resuelto','verde','Resuelto']];
  const urgBarra=`<div class="urgf"><button class="chip${mnUi.urg?' on':''}" data-act="mnUrgAbre" aria-expanded="${mnUi.urgAbre}">Urgencia${mnUi.urg?': '+MANT_URG[mnUi.urg]:''}${mnUi.urgAbre?' ▴':' ▾'}</button>
      <button class="chip${mnUi.urg?'':' on'}" data-act="mnUrgTodos" aria-pressed="${!mnUi.urg}">Todos</button></div>`+
    (mnUi.urgAbre?`<div class="chips">${[['fuera','No se puede usar'],['urgente','Urgente'],['normal','Normal']].map(f=>`<button class="chip${mnUi.urg===f[0]?' on':''}" data-act="mnUrg" data-v="${f[0]}">${f[1]}</button>`).join('')}</div>`:'');
  const listo=mantMeta.estado==='ok'||mantMeta.estado==='cache';
  return mantEstadoConexion()+mnBarraPeriodo(R,base.length)+urgBarra+
    `<div class="mn-carr-nav"><div><b>${titulo}</b><small>${orden}</small></div>
      ${l.length?`<div class="mn-carr-ctl"><span id="mn-carr-n">1 de ${l.length}</span>
        ${l.length>1?`<button class="ibtn" data-act="mnPausa" aria-label="${mnUi.pausa?'Reanudar el carrusel':'Pausar el carrusel'}">${ic(mnUi.pausa?'play':'pausa')}</button>`:''}
        <button class="ibtn" data-act="mnCarr" data-v="-1" aria-label="Anterior">${ic('back')}</button><button class="ibtn" data-act="mnCarr" data-v="1" aria-label="Siguiente">${ic('next')}</button></div>`:''}</div>`+
    (l.length?`<div class="mn-carr">${l.map(r=>mnRepCard(r,!scope)).join('')}</div>`
      :empty(!listo?'Cargando…':R?'No hay reportes en este periodo'+(mnUi.estado?' con ese estado.':'.'):mnUi.estado?'No hay reportes en este estado.':'No hay reportes sin resolver. Todo en orden.'))+
    `<div class="sts">${sts.map(x=>`<button class="stb ${x[1]}${mnUi.estado===x[0]?' on':''}" data-act="mnEstado" data-v="${x[0]}" aria-pressed="${mnUi.estado===x[0]}"><b>${cnt[x[0]]||0}</b><span>${x[2]}</span></button>`).join('')}</div>`;
}
/* Pestaña "Mantenimiento" dentro de un área (la ve la dirección de esa área y gerencia al abrirla) */
function vMantenimiento(aid){
  if(!mantAplica(aid)) return empty('Mantenimiento todavía no está activo en esta área. Actívalo en la ficha de cada profesor (Profesores → editar → Mantenimiento).');
  return `<div class="mantv">${vMantPantalla(aid)}</div>`;
}
/* Pestaña "Mantenimiento" de gerencia: todas las áreas, con filtro por área */
function vMantGerencia(){
  if(!mantConfig()) return empty('Control Mantenimiento no está conectado.');
  const as=areasList().filter(a=>mantAplica(a.id));
  if(mnUi.area!=='todas'&&!as.some(a=>a.id===mnUi.area)) mnUi.area='todas';
  const chips=as.length>1?`<div class="chips"><button class="chip${mnUi.area==='todas'?' on':''}" data-act="mnArea" data-v="todas">Todas las áreas</button>${as.map(a=>`<button class="chip${mnUi.area===a.id?' on':''}" data-act="mnArea" data-v="${esc(a.id)}">${esc(a.nombre)}</button>`).join('')}</div>`:'';
  return `<div class="mantv">${mnInformesHTML()}${chips}${vMantPantalla(null)}</div>`;
}

/* ---------- reportes que manda Mantenimiento (informes) ----------
   Mantenimiento los arma y los envía ya terminados (títulos, indicadores y tablas en texto);
   aquí solo se leen y se imprimen con el membrete, igual que los demás reportes de Gerencia. */
const mnArrI = v => Array.isArray(v) ? v : v ? Object.values(v) : [];
const mnInfLista = () => Object.keys(mantInformes||{}).map(id=>Object.assign({id},mantInformes[id])).sort((a,b)=>(b.creado||0)-(a.creado||0));
function mnInfCelda(s){ const p=String(s==null?'':s).split('\n'); return esc(p[0])+p.slice(1).map(x=>`<br><small>${esc(x)}</small>`).join(''); }
function mnInfSec(s){
  const filas=mnArrI(s.filas), cols=mnArrI(s.cols), sem=mnArrI(s.sem);
  if(!filas.length) return `<div class="h2 sm">${esc(s.t)} (0)</div><div class="empty">No hay registros.</div>`;
  return `<div class="h2 sm">${esc(s.t)} (${filas.length})</div><table class="doc-tabla mnt-t"><colgroup>${cols.map(c=>`<col style="width:${+c.w||10}%">`).join('')}</colgroup>
    <thead><tr>${cols.map(c=>`<th${c.n?' class="n"':''}>${esc(c.t)}</th>`).join('')}</tr></thead><tbody>${filas.map((f,i)=>`<tr>${mnArrI(f).map((v,j)=>`<td class="${j===0&&sem[i]?'s-'+esc(sem[i]):''}${cols[j]&&cols[j].n?' n':''}">${mnInfCelda(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
function mnInfCuerpo(x){
  const k=mnArrI(x.kpis).map(mnArrI);
  return (k.length?`<div class="kpis">${k.map(a=>`<div class="kpi" style="--kc:var(--g)"><span class="k-l">${esc(a[0])}</span><b>${esc(a[1])}</b>${a[2]?`<em class="k-c">${esc(a[2])}</em>`:''}</div>`).join('')}</div>`:'')+
    mnArrI(x.secs).map(mnInfSec).join('')+(x.nota?`<p class="an-nota">${esc(x.nota)}</p>`:'')+
    '<div class="doc-firmas"><div>Mantenimiento</div><div>Gerencia deportiva</div></div>';
}
function mnInformesHTML(){
  const l=mnInfLista(); if(!l.length) return '';
  const ver=mnUi.infTodos?l:l.slice(0,4), fh=ts=>new Date(ts).toLocaleString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}).replace('.','');
  return `<div class="h2 sm">Reportes de Mantenimiento</div><div class="sub" style="margin-top:-2px">Los que manda el técnico desde Control Mantenimiento. Ábrelos para verlos e imprimirlos.</div>
    <div class="mn-infs">${ver.map(x=>`<button class="mn-inf" data-act="mnInfAbre" data-id="${esc(x.id)}"><span class="mn-inf-i">${ic('doc')}</span><span class="mn-mnt-t"><b>${esc(x.titulo||'Reporte')}</b><small>${esc(fh(x.creado||0))}${x.por?' · '+esc(x.por):''} · ${plu(+x.n||0,'renglón','renglones')}</small>${x.sub?`<small>${esc(x.sub)}</small>`:''}</span><span class="go">${ic('next')}</span></button>`).join('')}</div>
    ${l.length>4?`<button class="btn sm" data-act="mnInfTodos">${mnUi.infTodos?'Ver solo los recientes':`Ver los ${l.length} reportes`}</button>`:''}`;
}
function mnInfImprime(id){
  const x=mantInformes[id]; if(!x) return;
  imprimirDoc({titulo:x.titulo||'Reporte de mantenimiento', sub:x.sub||'', html:mnInfCuerpo(x)});
}

/* ---------- detalle de un reporte (solo lectura) ---------- */
function mnFotosHTML(id){
  const f=MFOT[id], g=f||{};
  const bloque=(tipo,tit)=>`<div class="mn-foto"><div class="mn-foto-t"><b>${tit}</b>${g[tipo]?pill('Tomada','ok'):pill('Sin foto','mut')}</div>${g[tipo]?`<img src="${esc(g[tipo])}" alt="Foto del ${tit.toLowerCase()}" data-act="mnZoom" data-id="${esc(id)}" data-t="${tipo}">`:'<div class="mn-foto-v">Sin foto</div>'}</div>`;
  return `<div class="mn-fotos">${bloque('antes','Antes')}${bloque('despues','Después')}</div>${f===undefined?'<div class="sub">Cargando fotos…</div>':''}`;
}
function mnDetalle(id){
  const raw=(mantRaw.reportes||{})[id]||(mantRaw.historial||{})[id]; if(!raw) return '';
  const r=Object.assign({id},raw), e=mantEq(r.equipoId), a=mantArea(r)?getArea(mantArea(r)):null;
  const fila=(t,v)=>`<div class="row"><div><b>${t}</b><small>${v}</small></div></div>`;
  return `<div class="mantv">${mHead(esc(e.nombre))}
    <div class="rep ${mnSem(r)}" style="margin-bottom:14px"><div class="rep-h">${mnPillEstado(r)}${mnPillUrg(r)}</div>
      <span class="rep-d">${esc(r.desc||'')}</span>
      <small>${esc(mantSalon(e.salonId).nombre)} · ${esc(r.prof||'Entrenador')}${a?' · '+esc(a.nombre):''}${r.clase?' · '+esc(r.clase):''} · ${mantHace(r.creado)}</small>${mnTimer(r)}</div>
    <div class="card" style="margin-bottom:14px"><div class="h2 sm" style="margin:0 0 8px">Tiempos</div>
      ${fila('Llegó',mnFechaHora(r.creado))}
      ${r.tecnico?fila('Atiende',esc(r.tecnico)):''}
      ${fila('Lo abrió mantenimiento',r.visto?mnFechaHora(r.visto)+' · tardó '+mnDurCorta(r.visto-r.creado):'Todavía no')}
      ${r.estado==='resuelto'?fila('Resuelto',mnFechaHora(r.resuelto||Date.now())+' · en proceso '+mnDurCorta((r.resuelto||Date.now())-(r.visto||r.creado))):''}</div>
    <div class="h2 sm" style="margin:6px 0 8px">Fotos</div><div id="mn_fotos">${mnFotosHTML(id)}</div>
    <div class="card"><div class="h2 sm" style="margin:0 0 8px">Atención de mantenimiento</div>
      ${fila('Qué encontró y qué hizo',r.diag?esc(r.diag):'Todavía sin nota')}
      ${fila('Compra o cambio',(r.compra||r.cambio)?`${r.compra?'Requiere compra':''}${r.compra&&r.cambio?' · ':''}${r.cambio?'Requiere cambio':''}${r.costo?' · estimado $'+esc(r.costo):''}`:'No requiere')}</div>
    <div class="sub">Solo lectura: el técnico de Mantenimiento es quien atiende y actualiza este reporte.</div>
    <div class="btns"><button class="btn" data-act="closeModal">Cerrar</button></div></div>`;
}
function mnCargaFotos(id){
  if(!mantDb||MFOT[id]!==undefined) return;
  MFOT[id]=undefined;
  mantDb.ref('fotos/'+id).once('value').then(s=>{ MFOT[id]=s.val()||{}; }).catch(()=>{ MFOT[id]={}; }).then(()=>{
    const el=document.getElementById('mn_fotos'); if(el&&mnSheetId===id) el.innerHTML=mnFotosHTML(id);
  });
}
function mnCalendario(){
  const hoy=mnInput(mnSod(Date.now())), R=mnRango(), q=[['pend','Pendientes'],['hoy','Hoy'],['7','7 días'],['30','30 días'],['90','3 meses'],['365','12 meses'],['mes','Este mes'],['all','Todo']];
  const d=mnInput(R&&R.desde>0?R.desde:mnAdd(mnSod(Date.now()),-6)), h=mnInput(R?Math.min(R.hasta,mnSod(Date.now())):mnSod(Date.now()));
  return `<div class="mantv">${mHead('Elegir periodo')}
    <div class="chips" style="margin-bottom:10px">${q.map(x=>`<button class="chip${mnUi.per.t===x[0]?' on':''}" data-act="mnPer" data-v="${x[0]}">${x[1]}</button>`).join('')}</div>
    <div class="sub">O elige las fechas en el calendario. Se cuentan los reportes que llegaron en ese periodo.</div>
    <div class="two"><label class="f"><span>Desde</span><input type="date" id="mn_desde" max="${hoy}" value="${d}"></label><label class="f"><span>Hasta</span><input type="date" id="mn_hasta" max="${hoy}" value="${h}"></label></div>
    <div class="btns"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="mnPerAplicar">Aplicar</button></div></div>`;
}

/* ---------- carrusel: avanza solo, igual que en Control Mantenimiento ---------- */
const mnCar = () => document.querySelector('.mn-carr');
function mnObjetivo(c,i){
  const k=c.children[i], al=getComputedStyle(k).scrollSnapAlign||'';
  return al.indexOf('center')>=0 ? k.offsetLeft-(c.clientWidth-k.offsetWidth)/2 : k.offsetLeft-2;
}
function mnN(){
  const c=mnCar(), n=document.getElementById('mn-carr-n'); if(!c||!n||!c.children.length) return;
  const w=c.children[0].offsetWidth+12, i=w>0?Math.min(c.children.length-1,Math.round(c.scrollLeft/w)):0;
  n.textContent=(i+1)+' de '+c.children.length;
}
function mnAvanza(){
  const c=mnCar(), m=document.getElementById('modal'); if(!c||document.hidden||mnUi.pausa||mnHover||(m&&!m.hidden)) return;
  if(Date.now()-mnUlt<MT_ESPERA*1000) return;
  const n=c.children.length; if(n<2) return;
  const max=c.scrollWidth-c.clientWidth; let cur=0, best=1e9;
  for(let i=0;i<n;i++){ const d=Math.abs(mnObjetivo(c,i)-c.scrollLeft); if(d<best){ best=d; cur=i; } }
  const fin=c.scrollLeft>=max-3||cur+1>=n;
  c.scrollTo({left:fin?0:Math.min(max,Math.max(0,mnObjetivo(c,cur+1))),behavior:'smooth'});
}
/* Después de cada pintado: vuelve al reporte en el que iba (o al primero si se cambió un filtro) */
function mnInit(){
  const c=mnCar(); if(!c) return;
  if(mnUi.reset){ mnScroll=0; mnUi.reset=false; }
  c.style.scrollBehavior='auto'; c.scrollLeft=mnScroll; c.style.scrollBehavior=''; mnN();
}
function mnTick(){ const n=Date.now(); document.querySelectorAll('.timer[data-t0]:not(.stop)').forEach(el=>{ el.textContent=mnDur(n-(+el.getAttribute('data-t0'))); }); }
if(typeof document!=='undefined'){
  document.addEventListener('scroll',e=>{ const t=e.target; if(t&&t.classList&&t.classList.contains('mn-carr')){ mnScroll=t.scrollLeft; mnN(); } },true);
  ['pointerdown','touchstart','wheel','keydown'].forEach(ev=>document.addEventListener(ev,e=>{ if(e.target.closest&&e.target.closest('.mn-carr, .mn-carr-nav')) mnUlt=Date.now(); },{passive:true,capture:true}));
  document.addEventListener('mouseover',e=>{ mnHover=!!(e.target.closest&&e.target.closest('.mn-carr')); });
  setInterval(mnAvanza,MT_SEG*1000);
  setInterval(mnTick,1000);
}

Object.assign(actions,{
  mnEstado(d){ mnUi.estado=mnUi.estado===d.v?null:d.v; mnUi.reset=true; render(); },
  mnUrgAbre(){ mnUi.urgAbre=!mnUi.urgAbre; render(); },
  mnUrgTodos(){ mnUi.urg=null; mnUi.urgAbre=false; mnUi.reset=true; render(); },
  mnUrg(d){ mnUi.urg=mnUi.urg===d.v?null:d.v; mnUi.reset=true; render(); },
  mnPausa(){ mnUi.pausa=!mnUi.pausa; render(); },
  mnCarr(d){ mnUlt=Date.now(); const c=mnCar(); if(c) c.scrollBy({left:(+d.v)*c.clientWidth*0.9,behavior:'smooth'}); },
  mnInfAbre(d){ mnInfImprime(d.id); },
  mnInfTodos(){ mnUi.infTodos=!mnUi.infTodos; render(); },
  mnArea(d){ mnUi.area=d.v; mnUi.reset=true; render(); },
  mnCal(){ mnSheetId=null; openModal(mnCalendario()); },
  mnPer(d){ mnUi.per={t:d.v}; mnUi.estado=null; mnUi.reset=true; closeModal(); render(); },
  mnPerAplicar(){
    let a=($('#mn_desde')||{}).value, b=($('#mn_hasta')||{}).value; if(!a||!b){ toast('Elige las dos fechas'); return; }
    if(a>b){ const x=a; a=b; b=x; }
    mnUi.per={t:'custom',desde:a,hasta:b}; mnUi.estado=null; mnUi.reset=true; closeModal(); render();
  },
  mantAreaSet(d){ if(!getArea(d.id)) return; setPath(`cfg/areas/${d.id}/mantenimiento`,d.v==='1'); render(); toast(d.v==='1'?'Mantenimiento activado en el área':'Mantenimiento desactivado en el área'); },
  mnOpen(d){ mnSheetId=d.id; openModal(mnDetalle(d.id)); mnCargaFotos(d.id); },
  mnZoom(d){
    const f=MFOT[d.id]||{}; if(!f[d.t]) return;
    const z=document.createElement('div'); z.className='mn-zoom'; z.innerHTML=`<img src="${esc(f[d.t])}" alt="">`;
    z.addEventListener('click',()=>z.remove()); document.body.appendChild(z);
  }
});
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ const z=document.querySelector('.mn-zoom'); if(z) z.remove(); } });

/* ---------- resumen general para gerencia ---------- */
function mantResumenGerencia(){
  const aids=(typeof areasList==='function'?areasList().map(a=>a.id):[]).filter(mantAplica); if(!aids.length) return '';
  const st=aids.map(aid=>({aid,a:getArea(aid),S:mantStats(aid)}));
  const sum=f=>st.reduce((n,x)=>n+f(x.S),0);
  const rojos=sum(S=>S.rojos.length), proc=sum(S=>S.proceso.length), res=sum(S=>S.res.length), cer=sum(S=>S.cer), ven=mantPrevVencidos();
  return `<div class="h2">Mantenimiento</div>
    <div class="kpis k3">
      ${kpi('Sin atender',rojos,rojos?'problemas en rojo':'sin problemas',{cls:rojos?'bad':'ok',color:'var(--bad)'})}
      ${kpi('En proceso',proc,'ya los vio mantenimiento',{color:'var(--b2)'})}
      ${kpi('Atendidos',res+cer,`${res} por cerrar · ${cer} cerrados en 30 días`,{cls:'ok',color:'var(--b1)'})}
    </div>
    ${ven?`<div class="sub">${plu(ven,'revisión de preventivo vencida','revisiones de preventivo vencidas')} en el club.</div>`:''}
    ${st.map(x=>`<button class="line" style="--ac:${x.a.color}" data-act="openArea" data-id="${esc(x.aid)}" data-tab="mantenimiento">
      <div class="t">${ic('llave')}</div>
      <div class="b"><b>${esc(x.a.nombre)}</b><small>${plu(x.S.rojos.length,'reporte en rojo','reportes en rojo')} · ${plu(x.S.proceso.length,'en proceso','en proceso')} · ${plu(x.S.compras.length,'compra pendiente','compras pendientes')}</small></div>
      <div class="r">${x.S.rojos.length?pill('atención','bad'):pill('al día','ok')}</div></button>`).join('')}`;
}
/* Tarjeta de estado en Ajustes */
function mantCard(){
  const cfg=mantConfig(), m=mantMeta;
  const est=!cfg?['mut','Sin configurar']:m.estado==='ok'?['ok','Conectado']:m.estado==='error'?['bad','Error']:m.estado==='cache'?['warn','Copia guardada']:['warn','Conectando…'];
  return `<div class="card">
    <div class="row"><div><b>Control Mantenimiento</b><small>Solo lectura · reportes de equipo de los entrenadores</small></div>${pill(est[1],est[0])}</div>
    ${m.estado==='ok'||m.estado==='cache'?`<div class="row"><div><b>Datos recibidos</b><small>${plu(mantArr('reportes').length,'reporte abierto','reportes abiertos')} · ${plu(mantArr('equipos').length,'equipo','equipos')} · ${plu(mantArr('preventivo').length,'revisión de preventivo','revisiones de preventivo')}</small></div></div>`:''}
    ${m.estado==='error'?`<div class="row"><div><b>No se pudo leer</b><small>${esc(m.msg)}. Revisa las reglas de Firebase del proyecto de mantenimiento.</small></div></div>`:''}
    <div class="row"><div><small>Gerencia y las direcciones solo leen. Los profesores solo envían sus reportes y eliminan sus avisos ya resueltos.</small></div></div>
  </div>
  <div class="h2">Mantenimiento por área</div>
  <div class="card">
    <div class="row"><div><small>Elige qué áreas usan Mantenimiento. En las áreas activadas, la dirección ve la pestaña Mantenimiento y puede activar el módulo a cada profesor (Profesores → editar). Fitness siempre lo tiene: sus reportes salen de Control Fitness.</small></div></div>
    ${areasList().map(a=>`<div class="row"><div><b>${areaIco(a,{size:18})} ${esc(a.nombre)}</b><small>${esFitArea(a.id)?'Siempre activo (Control Fitness)':a.mantenimiento?'Activo: '+plu(profesores(a.id).filter(p=>p.mantenimiento).length,'profesor con el módulo','profesores con el módulo'):'Sin Mantenimiento'}</small></div>
      ${esFitArea(a.id)?pill('Activo','ok'):`<div class="seg"><button class="${a.mantenimiento?'on':''}" data-act="mantAreaSet" data-id="${esc(a.id)}" data-v="1">Sí</button><button class="${a.mantenimiento?'':'on'}" data-act="mantAreaSet" data-id="${esc(a.id)}" data-v="0">No</button></div>`}</div>`).join('')}
  </div>`;
}
/* Menús: la pestaña "Mantenimiento" existe en las áreas que lo usan, y en gerencia si hay alguna */
const NAV_MANT = {id:'mantenimiento',label:'Mantenimiento',ic:'llave'}, NAV_MANT_M = {id:'mantenimiento',label:'Manten.',ic:'llave',tabs:['mantenimiento']};
const navDirExtra = base => mantAplica(session&&session.area) ? base.concat([NAV_MANT]) : base;
const navMDirExtra = base => mantAplica(session&&session.area) ? base.concat([NAV_MANT_M]) : base;
const navGer = () => mantAlguna() ? NAV_GER.concat([NAV_MANT]) : NAV_GER;
const navMGer = () => mantAlguna() ? NAV_M_GER.concat([NAV_MANT_M]) : NAV_M_GER;
function navDir(){ return navDirExtra(NAV_DIR); }
function navMDir(){ return navMDirExtra(NAV_M_DIR); }
