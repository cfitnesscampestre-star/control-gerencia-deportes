'use strict';
/* =====================================================================
   gimvistas.js — Gimnasio: pantallas por rol.
   · Dirección (y gerencia): Hoy · Agenda · Equipo · Reportes. Cada sección tiene un sub-menú (gimSub):
       Agenda   → Por instructor · Personalizados · Disponibilidad · Rutinas · Aforo por hora
       Equipo   → Instructores · Recepción
       Reportes → Reporte semanal · Eventos · Mantenimiento
     “Por instructor” (vGimAgendaDir): la semana, un día a la vez, con una columna por instructor.
   · Recepción: Aforo · Disponibilidad · Avisos (vGimAvisosRec: rutinas por entregar y solicitudes enviadas).
   · Instructor: Por hacer · Agenda · Socios · Mi horario (vGimProf está en recepcion.js; Mi horario en gimmihorario.js).
   ===================================================================== */
const GIM_SUB_L = {inicio:'Hoy',gimagenda:'Por instructor',gimpt:'Personalizados',gimhorario:'Disponibilidad',gimrutinas:'Rutinas',gimaforo:'Aforo por hora',
  profesores:'Instructores',recepcion:'Recepción',reporte:'Reporte semanal',eventos:'Eventos',mantenimiento:'Mantenimiento'};
function gimSub(aid){
  const g=NAV_GIM.find(n=>n.tabs.includes(ui.aTab)); if(!g) return '';
  const T=g.tabs.filter(t=>t!=='mantenimiento'||(typeof mantAplica==='function'&&mantAplica(aid)));
  if(T.length<2) return '';
  return `<div class="seg gim-sub" role="tablist">${T.map(t=>`<button class="${ui.aTab===t?'on':''}" data-act="aTab" data-tab="${t}">${GIM_SUB_L[t]}</button>`).join('')}</div>`;
}

/* ---------- Dirección: agenda por instructor ---------- */
const gadSem = () => ui.gadSem||mondayOf(todayStr());
function gadDia(){
  const sem=gadSem(), hoy=todayStr(), fin=addDays(sem,6);
  if(ui.gadDia&&ui.gadDia>=sem&&ui.gadDia<=fin) return ui.gadDia;
  return hoy>=sem&&hoy<=fin?hoy:sem;
}
function vGimAgendaDir(aid){
  const sem=gadSem(), f=gadDia(), hoy=todayStr(), dd=gimDia(aid,wdIdx(f));
  const ps=profesores(aid).filter(p=>p.activo!==false).sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre),'es'));
  const cit={}, delDia=[], todas=gimCitas(aid);
  todas.forEach(y=>{ if(y.c.f!==f) return; delDia.push(y); cit[`${y.pk.profId}|${y.c.h}`]=y; });
  const nav=`<div class="calnav"><button class="ibtn" data-act="gadNav" data-n="-1" aria-label="Semana anterior">${ic('back')}</button><b>${esc(fmtCorta(sem))} – ${esc(fmtCorta(addDays(sem,6)))}</b><button class="ibtn" data-act="gadNav" data-n="1" aria-label="Semana siguiente">${ic('next')}</button>${sem!==mondayOf(hoy)?'<button class="btn sm" data-act="gadHoy">Esta semana</button>':''}</div>`;
  const dias=`<div class="chips">${[0,1,2,3,4,5,6].map(i=>{ const x=addDays(sem,i), n=todas.filter(y=>y.c.f===x).length;
    return `<button class="chip${x===f?' on':''}" data-act="gadDia" data-f="${x}">${DIAS[i]} ${+x.slice(8,10)}${n?` · ${n}`:''}${x===hoy?' · hoy':''}</button>`; }).join('')}</div>`;
  const head=`<div class="h2">Agenda por instructor</div>
    <div class="sub">Quién tiene a quién y a qué hora. Toca una sesión para ver el detalle o reagendarla. Mío = hora que el instructor bloqueó (comida, salida…).</div>${nav}${dias}`;
  if(!ps.length) return head+empty('Todavía no hay instructores activos. Dalos de alta en Equipo › Instructores.');
  if(!dd) return head+empty(`El gimnasio no abre el ${DIAS_L[wdIdx(f)].toLowerCase()}.`);
  const celda=(p,h)=>{
    const y=cit[`${p.id}|${h}`];
    if(y){ const sr=y.c.st==='sin registrar';
      return `<button class="gh-c ${sr?'bad':'yo'}" data-act="ctVer" data-pk="${esc(y.pk.id)}" data-c="${esc(y.c.id)}" data-from="" aria-label="${esc(y.pk.cliente||'Cliente')} · ${esc((CT_ST[y.c.st]||[y.c.st])[0])}"><small>${esc(String(y.pk.cliente||'Cliente').split(' ')[0])}</small>${sr?'<small>sin registro</small>':''}</button>`; }
    const b=ghBloqueo(p,f,h); if(b) return `<span class="gh-c mio" aria-label="Bloqueada: ${esc(b)}"><b>Mío</b><small>${esc(b)}</small></span>`;
    if(ghEnHorario(p,f,h)) return `<span class="gh-c ok" aria-label="Libre"><small>libre</small></span>`;
    return '<span class="gh-c off" aria-label="Fuera de su horario"></span>';
  };
  let h0=24, h1=0;                                       // filas: solo horas con algo (horario, sesión o bloqueo)
  for(let h=dd.abre;h<dd.cierra;h++) if(ps.some(p=>cit[`${p.id}|${h}`]||ghBloqueo(p,f,h)||ghEnHorario(p,f,h))){ h0=Math.min(h0,h); h1=Math.max(h1,h+1); }
  const huerf=delDia.filter(y=>!ps.some(p=>p.id===y.pk.profId));
  const tabla=h1<=h0?empty('Ese día ningún instructor tiene horario ni sesiones.')
    :`<div class="gh-wrap"><table class="gh-tb gad"><thead><tr><th></th>${ps.map(p=>`<th>${esc(String(p.nombre).split(' ')[0])}</th>`).join('')}</tr></thead>
      <tbody>${Array.from({length:h1-h0},(_,i)=>h0+i).map(h=>`<tr><th>${hh(h)}</th>${ps.map(p=>`<td>${celda(p,h)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <div class="gh-leg"><span><i class="yo"></i>Con socio</span><span><i class="bad"></i>Sin registrar</span><span><i class="mio"></i>Mío (bloqueada)</span><span><i class="ok"></i>Libre</span><span><i class="off"></i>Fuera de horario</span></div>`;
  delDia.sort((a,b)=>ctOrd(a.c,b.c));
  return `${head}${tabla}
    <div class="h2 sm">Sesiones del ${esc(fmtLarga(f))} <span class="pill">${delDia.length}</span></div>
    ${delDia.length?delDia.map(y=>ctFila(aid,y.pk,y.c,{prof:true})).join(''):empty('No hay sesiones ese día.')}
    ${huerf.length?`<div class="sub">${plu(huerf.length,'sesión es','sesiones son')} de un instructor dado de baja: decide qué pasa con su paquete en “Hoy”.</div>`:''}`;
}

/* ---------- Recepción: avisos ---------- */
function vGimAvisosRec(aid){
  const L=rutinas(aid), listas=L.filter(r=>rutEst(r)==='lista'), elab=L.filter(r=>rutEst(r)==='pendiente'), ent=L.filter(r=>rutEst(r)==='entregada').slice(0,5);
  const f=ts=>esc(fmtCorta(ymd(new Date(ts||Date.now()))));
  const linea=r=>`<button class="line gh-rut" style="--ac:${rutAtr(r)?'var(--bad)':areaColor(aid)}" data-act="rutVer" data-id="${esc(r.id)}"><div class="t">${f(r.ts)}</div>
    <div class="b"><b>${esc(r.nombre)}</b><small>${esc(RUT_OBJ[r.obj]||'')} · ${esc(rutProfNom(aid,r))} · plazo ${rutPlazo(r)} h</small></div><div class="r">${rutPill(r)}</div></button>`;
  return `<div class="h2">Avisos <button class="btn sm primary" data-act="rutNueva">+ Pedir rutina</button></div>
    <div class="sub">Lo que tienes que entregarle al socio y cómo van las solicitudes que mandaste a los instructores.</div>
    <div class="h2 sm">Rutinas listas para entregar ${listas.length?`<span class="pill warn">${listas.length}</span>`:''}</div>
    ${listas.length?listas.map(r=>`<div class="card gh-rp"><div class="row"><div><b>${esc(r.nombre)}</b><small>${esc(RUT_OBJ[r.obj]||'')} · la dejó ${esc(rutProfNom(aid,r))} el ${f(r.lista)}${r.tel?` · Tel. ${esc(r.tel)}`:''}</small></div></div>
      <div class="btns"><button class="btn primary" data-act="rutEntregada" data-id="${esc(r.id)}">Entregada al socio</button></div></div>`).join(''):empty('No hay rutinas esperando al socio.')}
    <div class="h2 sm">Rutinas en elaboración ${elab.length?`<span class="pill">${elab.length}</span>`:''}</div>
    ${elab.length?elab.map(linea).join(''):empty('Ningún instructor tiene rutinas pendientes.')}
    ${gimSolRec(aid)}
    ${ent.length?`<div class="h2 sm">Entregadas recientemente</div>${ent.map(linea).join('')}`:''}
    <div class="btns"><button class="btn" data-act="aTab" data-tab="gimrutinas">Ver todas las rutinas</button></div>`;
}

/* ---------- Instructor: Agenda (semana) y Socios ---------- */
const pagSem = () => ui.pagSem||mondayOf(todayStr());
function vGimProfAgenda(){
  const aid=session.area, pid=session.profId, p=getProf(aid,pid)||{}, sem=pagSem(), hoy=todayStr(), C=gimCitas(aid,pid);
  const nav=`<div class="calnav"><button class="ibtn" data-act="pagNav" data-n="-1" aria-label="Semana anterior">${ic('back')}</button><b>${esc(fmtCorta(sem))} – ${esc(fmtCorta(addDays(sem,6)))}${sem===mondayOf(hoy)?' · esta semana':''}</b><button class="ibtn" data-act="pagNav" data-n="1" aria-label="Semana siguiente">${ic('next')}</button>${sem!==mondayOf(hoy)?'<button class="btn sm" data-act="pagHoy">Esta semana</button>':''}</div>`;
  const dias=[0,1,2,3,4,5,6].map(i=>{
    const f=addDays(sem,i), items=C.filter(y=>y.c.f===f).map(y=>({h:y.c.h,html:ctFila(aid,y.pk,y.c)}));
    Object.entries(p.blq||{}).forEach(([k,m])=>{ if(k.slice(0,10)===f&&m) items.push({h:+k.slice(11),html:`<div class="line" style="--ac:var(--warn)"><div class="t">${hh(+k.slice(11))}</div><div class="b"><b>Mío</b><small>${esc(m)}</small></div><div class="r">${pill('Bloqueada','warn')}</div></div>`}); });
    if(!items.length) return '';
    items.sort((a,b)=>a.h-b.h);
    return `<div class="ct-dia">${esc(fmtLarga(f))}${f===hoy?' · hoy':''}</div>${items.map(x=>x.html).join('')}`;
  }).join('');
  return `<div class="gpf"><div class="h2">Mi agenda</div>
    <div class="sub">Tus sesiones de la semana y las horas que bloqueaste. Toca una sesión para registrarla o reagendarla.</div>
    ${nav}${dias||empty('No tienes sesiones ni horas bloqueadas esta semana.')}
    <div class="btns"><button class="btn" data-act="pTab" data-tab="horario">Cambiar mi horario</button><button class="btn primary" data-act="openPT">+ Nuevo personalizado</button></div></div>`;
}
function vGimProfSocios(){
  const aid=session.area, pid=session.profId;
  const pk=coll(aid,'paquetes').filter(x=>x.profId===pid).sort((a,b)=>(ptVigente(b)-ptVigente(a))||String(b.fin).localeCompare(String(a.fin)));
  const act=pk.filter(ptVigente), ant=pk.filter(x=>!ptVigente(x)).slice(0,6);
  return `<div class="gpf"><div class="h2">Mis socios <button class="btn sm primary" data-act="openPT">+ Nuevo personalizado</button></div>
    <div class="sub">Tus personalizados: cuántas sesiones lleva cada socio y cuándo es la siguiente.</div>
    ${act.length?act.map(x=>ptPaqHTML(aid,x,{prof:true})).join(''):empty('Todavía no tienes personalizados. Regístralos con “+ Nuevo personalizado”.')}
    ${ant.length?`<div class="h2 sm">Anteriores</div>${ant.map(x=>ptPaqHTML(aid,x,{prof:true})).join('')}`:''}</div>`;
}
function vGimProfTab(){
  if(!['hoy','agenda','socios','horario'].includes(ui.pTab)) ui.pTab='hoy';
  return ui.pTab==='horario'?vGimMiHorario():ui.pTab==='agenda'?vGimProfAgenda():ui.pTab==='socios'?vGimProfSocios():vGimProf();
}

Object.assign(actions,{
  gadNav(d){ ui.gadSem=addDays(gadSem(),7*(+d.n)); ui.gadDia=null; render(); },
  gadHoy(){ ui.gadSem=mondayOf(todayStr()); ui.gadDia=null; render(); },
  gadDia(d){ ui.gadDia=d.f; render(); },
  pagNav(d){ ui.pagSem=addDays(pagSem(),7*(+d.n)); render(); },
  pagHoy(){ ui.pagSem=mondayOf(todayStr()); render(); }
});
