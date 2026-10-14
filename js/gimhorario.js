'use strict';
/* =====================================================================
   gimhorario.js — Gimnasio: horarios de los instructores, horario semanal de
   personalizados (para recepción) y solicitudes de rutina genérica.

   DATOS
   · data/<área>/profesores/<id>.horLab  {d0:{i:'06:00',f:'14:00'}, … d6}   horario laboral por día (d0 = lunes)
   · Horario de personalizados: lo define el INSTRUCTOR en su pantalla “Mi horario” (ya no la dirección):
       profesores/<id>.horPtH  {d0:'7,8,9,17', …}             horas fijas (todas las semanas)
       profesores/<id>.horSem  {'2026-10-19':{d0:'7,8', …}}    cambios de una semana; '' = ese día no da
       profesores/<id>.blq     {'2026-10-21_13':'Comida', …}   horas que bloquea (recepción las ve ocupadas)
     profesores/<id>.horPt (rangos que antes capturaba la dirección) se sigue leyendo mientras el instructor no defina el suyo.
   · data/<área>/profesores/<id>.rutinas  false = no entra en la fila de rutinas genéricas
   · data/<área>/paquetes/<id>.slots     {d1_16:{d:1,h:16}, …}               horario fijo semanal del cliente (un horario por día)
   · data/<área>/paquetes/<id>.citas     las sesiones con fecha y hora que salen de ese horario (ver gimagenda.js)
   · data/<área>/rutinas/<id>            {id,nombre,tel,obj,profId,profNom,asig:'auto'|'manual',estado:'pendiente'|'enviada',ts,por}
   ===================================================================== */
const ghMin = t => { const m=String(t||'').match(/^(\d{1,2}):(\d{2})/); return m?(+m[1])*60+(+m[2]):null; };
function ghDia(p,k,d){                                   // renglón válido del día d (o null)
  const H=p&&p[k], x=H&&H['d'+d]; if(!x) return null;
  const a=ghMin(x.i), b=ghMin(x.f); return (a==null||b==null||b<=a)?null:x;
}
const ghCubre = (x,h) => !!x && ghMin(x.i)<=h*60 && ghMin(x.f)>=(h+1)*60;     // la hora h:00–h+1:00 cabe completa en el rango
const ghLista = s => String(s==null?'':s).split(',').filter(x=>x!=='').map(Number).filter(n=>!isNaN(n)).sort((a,b)=>a-b);
function ghHorasDia(p,f){                                // horas (enteras) en que da personalizados ese día
  const wk=mondayOf(f), d=wdIdx(f), sem=p&&p.horSem&&p.horSem[wk];
  if(sem&&sem['d'+d]!==undefined) return ghLista(sem['d'+d]);
  if(p&&p.horPtH&&p.horPtH['d'+d]!==undefined) return ghLista(p.horPtH['d'+d]);
  const x=ghDia(p,'horPt',d); if(!x) return [];
  const out=[]; for(let h=Math.floor(ghMin(x.i)/60);h<Math.ceil(ghMin(x.f)/60);h++) if(ghCubre(x,h)) out.push(h); return out;
}
const ghEnHorario = (p,f,h) => ghHorasDia(p,f).includes(+h);
const ghBloqueo = (p,f,h) => (p&&p.blq&&p.blq[`${f}_${pad(h)}`])||'';
const ghTieneHorario = p => !!(p&&(Object.keys(p.horPtH||{}).length||Object.keys(p.horSem||{}).length||Object.keys(p.horPt||{}).length));
function ghRangosTxt(hs){                                 // [7,8,9,15,16] → “7–10 y 15–17”
  const r=[]; hs.forEach(h=>{ const l=r[r.length-1]; if(l&&l[1]===h) l[1]=h+1; else r.push([h,h+1]); });
  return r.map(([a,b])=>`${a}–${b}`).join(' y ');
}
function ghSemanaTxt(p,wk){                               // “Lun–Vie 7–10 y 15–20 · Sáb 8–12” para la semana wk
  const runs=[]; for(let d=0;d<7;d++){ const t=ghRangosTxt(ghHorasDia(p,addDays(wk,d))); if(!t) continue; const l=runs[runs.length-1];
    if(l&&l.t===t&&l.b===d-1) l.b=d; else runs.push({a:d,b:d,t}); }
  return runs.map(r=>`${DIAS[r.a]}${r.b>r.a?'–'+DIAS[r.b]:''} ${r.t}`).join(' · ');
}
const ghSlots = x => Object.values((x&&x.slots)||{}).filter(s=>s&&s.d!=null&&s.h!=null);
const ghKey = (d,h) => `d${d}_${h}`;
const ghSlotsKey = sl => ghSlots({slots:sl}).map(s=>ghKey(+s.d,+s.h)).sort().join(',');
function ghHorTxt(p,k){                                  // “Lun–Vie 6:00–14:00 · Sáb 8:00–12:00”
  const runs=[]; for(let d=0;d<7;d++){ const x=ghDia(p,k,d); if(!x) continue; const key=x.i+'-'+x.f, l=runs[runs.length-1];
    if(l&&l.key===key&&l.b===d-1) l.b=d; else runs.push({a:d,b:d,key,x}); }
  const hm=t=>{ const m=ghMin(t); return Math.floor(m/60)+':'+pad(m%60); };
  return runs.map(r=>`${DIAS[r.a]}${r.b>r.a?'–'+DIAS[r.b]:''} ${hm(r.x.i)}–${hm(r.x.f)}`).join(' · ');
}

/* ---------- Dirección: campos en la ficha del instructor ---------- */
function gimProfCampos(aid,p,ro){
  const dis=ro?' disabled':'';
  const fila=(d)=>{ const L=ghDia(p,'horLab',d);
    return `<div class="gh-row" data-d="${d}"><b class="gh-d">${DIAS_L[d]}</b>
      <div class="gh-l"><label class="gh-ck"><input type="checkbox" class="gh_l"${L?' checked':''}${dis}><span>Laboral</span></label>
        <input type="time" class="gh_li" step="1800" value="${esc(L?L.i:'06:00')}"${dis}><em>a</em><input type="time" class="gh_lf" step="1800" value="${esc(L?L.f:'14:00')}"${dis}></div></div>`; };
  const wk=mondayOf(todayStr()), mio=p&&p.id?ghSemanaTxt(p,wk):'';
  return `<div class="f"><span class="lb">Horario laboral</span>
    <div class="gh-box">${[0,1,2,3,4,5,6].map(fila).join('')}</div>
    ${ro?'':'<button type="button" class="btn sm" data-act="ghCopiar">Copiar el primer día marcado a los demás días</button>'}
    <small class="mut">Marca los días que trabaja y su horario. Un día sin marcar = no trabaja ese día.</small></div>
    <div class="f"><span class="lb">Horario de personalizados</span>
      <small class="mut">Lo define el instructor en su pantalla, en “Mi horario”, y puede cambiarlo cada semana.${mio?` Esta semana: <b>${esc(mio)}</b>.`:p&&p.id?' Todavía no lo ha definido.':''}</small></div>
    <label class="f"><span>Rutinas genéricas</span><select id="gh_rut"${dis}><option value="1"${p.rutinas===false?'':' selected'}>Entra en la fila para recibir rutinas</option><option value="0"${p.rutinas===false?' selected':''}>No recibe rutinas genéricas</option></select></label>`;
}
function gimProfLeer(aid){
  if(!esGim(aid)) return {};
  const horLab={};                                          // el horario de personalizados no se toca aquí: es del instructor
  document.querySelectorAll('.gh-row').forEach(r=>{
    const d=r.dataset.d;
    if(r.querySelector('.gh_l').checked) horLab['d'+d]={i:r.querySelector('.gh_li').value,f:r.querySelector('.gh_lf').value};
  });
  const rut=$('#gh_rut');
  return {horLab,rutinas:rut?rut.value==='1':true};
}
function gimProfError(aid){
  if(!esGim(aid)) return '';
  for(const r of document.querySelectorAll('.gh-row')){
    const d=DIAS_L[+r.dataset.d];
    for(const [c,i,f,t] of [['.gh_l','.gh_li','.gh_lf','laboral']]){
      if(!r.querySelector(c).checked) continue;
      const a=ghMin(r.querySelector(i).value), b=ghMin(r.querySelector(f).value);
      if(a==null||b==null) return `Anota la hora de inicio y de fin ${t} del ${d}`;
      if(b<=a) return `El fin del horario ${t} del ${d} debe ser después del inicio`;
    }
  }
  return '';
}

/* ---------- Horario semanal de personalizados (dirección y recepción) ---------- */
/* Paquetes ANTERIORES (sin citas guardadas): desde su inicio, cada semana en los días/horas del horario fijo, hasta completar las contratadas.
   Ej.: 20 sesiones con 1 horario fijo = 20 semanas seguidas en ese mismo día y hora. Los paquetes nuevos guardan sus citas (gimagenda.js). */
function ghSesiones(pk){
  const S=ghSlots(pk).map(s=>({d:+s.d,h:+s.h})).sort((x,y)=>(x.d-y.d)||(x.h-y.h)), n=Math.max(0,+pk.total||0), out=[];
  if(!S.length||!n||!pk.inicio) return out;
  let f=pk.inicio;
  for(let i=0;i<n*7+14&&out.length<n;i++,f=addDays(f,1)){ const wd=wdIdx(f); S.filter(s=>s.d===wd).forEach(s=>{ if(out.length<n) out.push({f,h:s.h}); }); }
  return out;
}
function ghCtx(aid,excluir){                             // instructores activos y qué fecha+hora tiene ocupada cada uno
  const ps=profesores(aid).filter(p=>p.activo!==false), pk=coll(aid,'paquetes').filter(x=>ptVigente(x)&&x.id!==excluir), occ={};
  pk.forEach(x=>ptMapa(x).ag.forEach(c=>{ if(ctCuenta(c)) occ[`${x.profId}|${c.f}|${c.h}`]=x; }));     // las canceladas liberan la hora
  ps.forEach(p=>Object.entries(p.blq||{}).forEach(([k,m])=>{ const i=k.lastIndexOf('_'); const key=`${p.id}|${k.slice(0,i)}|${+k.slice(i+1)}`;   // horas que bloqueó el instructor
    if(!occ[key]) occ[key]={cliente:'hora bloqueada',bloqueo:true,motivo:m}; }));
  return {ps,pk,occ};
}
function ghOferta(ctx,f,h){                              // instructores con esa hora en su horario, o que ya la tienen ocupada aunque esté fuera de él
  return ctx.ps.filter(p=>ghEnHorario(p,f,h)||ctx.occ[`${p.id}|${f}|${h}`]).map(p=>({p,oc:ctx.occ[`${p.id}|${f}|${h}`]||null}));
}
const ghSemana = () => ui.ghSem||mondayOf(todayStr());
function vGimHorario(aid,embed){
  const ro=roDatos(aid), ctx=ghCtx(aid), sem=ghSemana(), hoy=todayStr();
  let h0=24, h1=0;                                       // filas: solo las horas en que alguien tiene horario o una sesión esa semana
  const gc=gimCfg(aid);
  for(let d=0;d<7;d++){ const f=addDays(sem,d); for(let h=gc.abre;h<gc.cierra;h++) if(ghOferta(ctx,f,h).length){ h0=Math.min(h0,h); h1=Math.max(h1,h+1); } }
  const sw=(!embed&&typeof gimPtSwitch==='function')?gimPtSwitch():'';
  const head=embed?`<div class="h2" style="margin-top:18px">Horario de personalizados <button class="btn sm" data-act="aTab" data-tab="gimhorario">Ver completo</button></div>`:`<div class="h2">Horario semanal de personalizados</div>${sw}`;
  if(h1<=h0) return `${head}<div class="sub">Aquí se ve qué horas tienen libres los entrenadores para un personalizado.</div>${empty('Esta semana ningún instructor tiene horario de personalizados. Cada instructor lo define en su pantalla, en “Mi horario”.')}`;
  let libres=0, llenas=0;
  const fechas=[0,1,2,3,4,5,6].map(i=>addDays(sem,i));
  const filas=[]; for(let h=h0;h<h1;h++){
    filas.push(`<tr><th>${hh(h)}</th>${fechas.map((f,d)=>{
      const of=ghOferta(ctx,f,h), lib=of.filter(x=>!x.oc).length;
      if(!of.length||!ctLibre(f,h)) return `<td><span class="gh-c off" aria-label="${of.length?'Ya pasó':'Sin instructor'}"></span></td>`;
      lib?libres++:llenas++;
      return `<td><button class="gh-c ${lib?'ok':'bad'}" data-act="ghCelda" data-f="${f}" data-h="${h}" aria-label="${DIAS_L[d]} ${esc(fmtCorta(f))} ${hh(h)}: ${lib?plu(lib,'instructor libre','instructores libres'):'todo ocupado'}">${lib?`<b>${lib}</b><small>${lib===1?'libre':'libres'}</small>`:'<b>Lleno</b>'}</button></td>`;
    }).join('')}</tr>`);
  }
  const nav=`<div class="calnav"><button class="ibtn" data-act="ghSem" data-n="-1" aria-label="Semana anterior">${ic('back')}</button><b>${esc(fmtCorta(sem))} – ${esc(fmtCorta(addDays(sem,6)))}</b><button class="ibtn" data-act="ghSem" data-n="1" aria-label="Semana siguiente">${ic('next')}</button><button class="btn sm" data-act="ghSemHoy">Esta semana</button></div>`;
  return `${head}
    <div class="sub">${ro?'Horas de personalizados de los entrenadores.':'Toca una hora para ver qué instructores están libres y mandarle una solicitud al que elijas.'} Verde = hay al menos un instructor libre · Rojo = todos ocupados · Gris = nadie tiene horario o la hora ya pasó. Avanza de semana para ver lo que ya apartaron los paquetes contratados.</div>
    ${nav}
    ${embed?'':`<div class="kpis k3">${kpi('Horas con lugar',libres,'verdes en la semana',{cls:'ok',color:'var(--b1)'})}${kpi('Horas llenas',llenas,'rojas en la semana',{cls:llenas?'bad':'',color:'var(--bad)'})}${kpi('Instructores',ctx.ps.filter(p=>[0,1,2,3,4,5,6].some(d=>ghHorasDia(p,addDays(sem,d)).length)).length,'con horario esta semana',{color:'var(--b3)'})}</div>`}
    <div class="gh-wrap"><table class="gh-tb"><thead><tr><th></th>${fechas.map((f,i)=>`<th class="${f===hoy?'hoy':''}">${DIAS[i]}<small>${+f.slice(8,10)}</small></th>`).join('')}</tr></thead><tbody>${filas.join('')}</tbody></table></div>
    <div class="gh-leg"><span><i class="ok"></i>Libre</span><span><i class="bad"></i>Ocupado</span><span><i class="off"></i>Sin instructor o ya pasó</span></div>
    ${(!embed&&typeof gimSolRec==='function')?gimSolRec(aid):''}`;
}
function ghCelda(f,h){
  const aid=curArea(), ctx=ghCtx(aid), of=ghOferta(ctx,f,+h), wd=wdIdx(f), ro=roDatos(aid)||!ctLibre(f,+h)||isProf();
  openModal(`${mHead(`${DIAS_L[wd]} ${esc(fmtCorta(f))} · ${hh(+h)}`)}
    <div class="sub">${ctLibre(f,+h)?'Instructores con horario de personalizados a esta hora. A uno libre le puedes mandar una solicitud: se acerca a recepción para atender al socio.':'Esta hora ya pasó.'}</div>
    ${of.length?of.map(({p,oc})=>`<div class="card gh-ins"><div class="row">${avatarHTML(p.nombre,p.foto,40)}<div><b>${esc(p.nombre)}</b><small>${oc?'Ocupado a esta hora':'Libre'}</small></div>${pill(oc?'Ocupado':'Libre',oc?'bad':'ok')}</div>
      ${(oc||ro)?'':`<div class="btns"><button class="btn primary block" data-act="solNueva" data-prof="${esc(p.id)}" data-h="${h}" data-f="${f}">Enviar solicitud a ${esc(p.nombre.split(' ')[0])}</button></div>`}</div>`).join(''):empty('Nadie tiene horario de personalizados a esta hora.')}
    <div class="btns"><button class="btn" data-act="closeModal">Cerrar</button></div>`);
}

/* ---------- Rutinas genéricas ---------- */
const RUT_OBJ = {masa:'Incremento de masa muscular',grasa:'Pérdida de porcentaje de grasa',rend:'Rendimiento'};
const rutinas = aid => coll(aid,'rutinas').sort((a,b)=>(b.ts||0)-(a.ts||0));
const rutCola = aid => profesores(aid).filter(p=>p.activo!==false&&p.rutinas!==false);
function rutSiguiente(aid){                                // el que sigue en la fila: después del último asignado en automático
  const cola=rutCola(aid); if(!cola.length) return null;
  const ult=rutinas(aid).find(r=>r.asig==='auto'); if(!ult) return cola[0];
  const i=cola.findIndex(p=>p.id===ult.profId);
  if(i>=0) return cola[(i+1)%cola.length];
  return cola.find(p=>String(p.nombre).localeCompare(String(ult.profNom||''),'es')>0)||cola[0];     // el último ya no está en la fila: sigue por orden alfabético
}
const rutProfNom = (aid,r) => (getProf(aid,r.profId)||{}).nombre||r.profNom||'—';
/* Estados: pendiente (en elaboración) → lista (el instructor la dejó en recepción) → entregada (recepción se la dio al socio).
   'enviada' es el estado anterior a este cambio y se lee como entregada. El teléfono es opcional y solo lo ve recepción y la dirección. */
const RUT_PLAZOS = [24,48,72];
const rutEst = r => r.estado==='enviada'?'entregada':(r.estado||'pendiente');
const rutPlazo = r => +r.plazo||48;
const rutAtr = r => rutEst(r)==='pendiente'&&Date.now()-(r.ts||0)>rutPlazo(r)*3600e3;
const rutAtrasadas = aid => rutinas(aid).filter(rutAtr);
const RUT_EST = {pendiente:['En elaboración','info'],lista:['Lista en recepción','ok'],entregada:['Entregada','mut']};
const rutPill = r => rutAtr(r)?pill('Atrasada','bad'):pill(RUT_EST[rutEst(r)][0],RUT_EST[rutEst(r)][1]);
const rutVeTel = () => !isProf();                            // los teléfonos se quedan en recepción
function vGimRutinas(aid){
  const ro=roDatos(aid), L=rutinas(aid), sig=rutSiguiente(aid), cola=rutCola(aid);
  const n=e=>L.filter(r=>rutEst(r)===e).length, fil=(ui.rutFil==='enviada'?'entregada':ui.rutFil)||(n('lista')?'lista':'pendiente');
  const list=fil==='todas'?L:L.filter(r=>rutEst(r)===fil);
  const sw=(typeof gimPtSwitch==='function')?gimPtSwitch():'';
  return `<div class="h2">Rutinas genéricas ${ro?'':`<button class="btn sm primary" data-act="rutNueva">+ Solicitar rutina</button>`}</div>${sw}
    <div class="sub">Recepción la pide con el nombre del socio y el plazo de entrega. Le llega al entrenador que sigue en la fila; él la elabora y la deja en recepción, y recepción se la entrega al socio.</div>
    <div class="card gh-sig"><span>Siguiente en turno</span><b>${sig?esc(sig.nombre):'Sin entrenadores en la fila'}</b>
      ${cola.length?`<div class="gh-fila">${cola.map(p=>`<span class="${sig&&p.id===sig.id?'on':''}">${esc(p.nombre.split(' ')[0])}</span>`).join('<i>›</i>')}</div>`:''}</div>
    <div class="kpis k3">${kpi('En elaboración',n('pendiente'),rutAtrasadas(aid).length?`${rutAtrasadas(aid).length} atrasadas`:'dentro del plazo',{cls:rutAtrasadas(aid).length?'bad':'',color:'var(--b3)'})}${kpi('Listas en recepción',n('lista'),'por entregar al socio',{cls:n('lista')?'warn':'ok',color:'var(--warn)'})}${kpi('Entregadas',n('entregada'),'en total',{cls:'ok',color:'var(--b1)'})}</div>
    <div class="chips">${[['pendiente','En elaboración'],['lista','Listas para entregar'],['entregada','Entregadas'],['todas','Todas']].map(([id,l])=>`<button class="chip${fil===id?' on':''}" data-act="rutFil" data-f="${id}">${l}</button>`).join('')}</div>
    ${list.length?list.map(r=>`<button class="line gh-rut" style="--ac:${rutAtr(r)?'var(--bad)':areaColor(aid)}" data-act="rutVer" data-id="${esc(r.id)}"><div class="t">${esc(fmtCorta(ymd(new Date(r.ts||Date.now()))))}</div>
      <div class="b"><b>${esc(r.nombre)}</b><small>${esc(RUT_OBJ[r.obj]||'')} · para ${esc(rutProfNom(aid,r))} · plazo ${rutPlazo(r)} h</small></div>
      <div class="r">${rutPill(r)}</div></button>`).join(''):empty({pendiente:'No hay rutinas en elaboración.',lista:'No hay rutinas listas para entregar.',entregada:'Todavía no se entrega ninguna.'}[fil]||'No hay rutinas.')}`;
}
function rutNueva(){
  const aid=curArea(), sig=rutSiguiente(aid), cola=rutCola(aid);
  if(!cola.length){ toast('Primero da de alta a los instructores (y que entren en la fila de rutinas)'); return; }
  openModal(`${mHead('Solicitar rutina genérica')}
    <label class="f"><span>Nombre del socio</span><input id="ru_nombre" autocomplete="off" placeholder="Nombre completo"></label>
    <label class="f"><span>Teléfono (opcional)</span><input id="ru_tel" inputmode="tel" autocomplete="off" placeholder="Solo lo ve recepción"><small class="mut">Se queda en recepción: el entrenador no lo ve.</small></label>
    <div class="two"><label class="f"><span>Objetivo</span><select id="ru_obj">${Object.entries(RUT_OBJ).map(([k,l])=>`<option value="${k}">${l}</option>`).join('')}</select></label>
      <label class="f"><span>Entregar en</span><select id="ru_plazo">${RUT_PLAZOS.map(h=>`<option value="${h}"${h===48?' selected':''}>${h} horas</option>`).join('')}</select></label></div>
    <label class="f"><span>Enviar a</span><select id="ru_prof"><option value="">Siguiente en turno: ${esc(sig.nombre)}</option>${cola.map(p=>`<option value="${esc(p.id)}">${esc(p.nombre)}</option>`).join('')}</select>
      <small class="mut">Lo normal es dejar al que sigue en la fila. Si eliges a otro, la fila no se mueve.</small></label>
    <div class="btns"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="rutGuardar">Enviar solicitud</button></div>`);
}
function rutVer(id){
  const aid=curArea(), r=getPath(`data/${aid}/rutinas/${id}`); if(!r) return;
  const ro=roDatos(aid), cola=rutCola(aid), est=rutEst(r), mia=isProf()&&r.profId===session.profId, f=ts=>ts?esc(fmtCorta(ymd(new Date(ts)))):'';
  let acc='';
  if(!ro){
    if(est==='pendiente'&&(mia||!isProf())) acc+=`<button class="btn primary" data-act="rutLista" data-id="${esc(id)}">Dejar en recepción</button>`;
    if(est==='pendiente'&&!isProf()) acc=`<button class="btn" data-act="rutReasignar" data-id="${esc(id)}">Cambiar entrenador</button>`+acc;
    if(est==='lista'&&!isProf()) acc+=`<button class="btn primary" data-act="rutEntregada" data-id="${esc(id)}">Entregada al socio</button>`;
    if(est!=='pendiente'&&!isProf()) acc+=`<button class="btn" data-act="rutPendiente" data-id="${esc(id)}">Volver a elaboración</button>`;
  }
  openModal(`${mHead(esc(r.nombre))}
    <div class="sub">${esc(RUT_OBJ[r.obj]||'')} · ${rutPill(r)}</div>
    <div class="card"><div class="dl"><dt>Entrenador</dt><dd>${esc(rutProfNom(aid,r))}${r.asig==='manual'?' · elegido por recepción':' · por turno'}</dd></div>
      ${rutVeTel()?`<div class="dl"><dt>Teléfono</dt><dd>${r.tel?esc(r.tel):'—'}</dd></div>`:''}
      <div class="dl"><dt>Solicitada</dt><dd>${f(r.ts)}${r.por?' · '+esc(r.por):''} · plazo ${rutPlazo(r)} h</dd></div>
      ${r.lista?`<div class="dl"><dt>Lista en recepción</dt><dd>${f(r.lista)}</dd></div>`:''}
      ${(r.entregada||r.envio)?`<div class="dl"><dt>Entregada</dt><dd>${f(r.entregada||r.envio)}</dd></div>`:''}</div>
    ${(!ro&&est==='pendiente'&&!isProf())?`<label class="f"><span>Cambiar de entrenador</span><select id="ru_re"><option value="">No cambiar</option>${cola.filter(p=>p.id!==r.profId).map(p=>`<option value="${esc(p.id)}">${esc(p.nombre)}</option>`).join('')}</select></label>`:''}
    <div class="btns"><button class="btn" data-act="closeModal">Cerrar</button>${acc}</div>
    ${(!ro&&!isRec()&&!isProf())?`<div class="btns"><button class="btn danger" data-act="rutBorrar" data-id="${esc(id)}">Eliminar solicitud</button></div>`:''}`);
}
/* lo que ve el instructor en su pantalla */
function gimRutProf(){
  const aid=session.area, mias=rutinas(aid).filter(r=>r.profId===session.profId&&rutEst(r)==='pendiente').reverse();
  if(!mias.length) return '';
  return `<div class="h2">Rutinas por elaborar <span class="pill warn">${mias.length}</span></div>
    <div class="sub">Un socio pidió una rutina genérica. Elabórala y déjala en recepción: ellos se la entregan.</div>
    ${mias.map(r=>{ const resta=Math.round((rutPlazo(r)*3600e3-(Date.now()-(r.ts||0)))/3600e3);
      return `<div class="card gh-rp${rutAtr(r)?' atr':''}"><div class="row"><div><b>${esc(r.nombre)}</b><small>${esc(RUT_OBJ[r.obj]||'')} · pedida ${esc(fmtCorta(ymd(new Date(r.ts||Date.now()))))} · ${rutAtr(r)?'<span class="bad">atrasada</span>':`quedan ${plu(Math.max(0,resta),'hora','horas')}`}</small></div></div>
      <div class="btns"><button class="btn primary" data-act="rutLista" data-id="${esc(r.id)}">Dejar en recepción</button></div></div>`; }).join('')}`;
}

Object.assign(actions,{
  ghCopiar(){
    const rows=[...document.querySelectorAll('.gh-row')], src=rows.find(r=>r.querySelector('.gh_l').checked);
    if(!src){ toast('Marca primero un día'); return; }
    rows.forEach(r=>{ if(r===src) return; ['gh_l','gh_li','gh_lf'].forEach(c=>{ const a=src.querySelector('.'+c), b=r.querySelector('.'+c); if(a.type==='checkbox') b.checked=a.checked; else b.value=a.value; }); });
    toast('Horario copiado a todos los días');
  },
  ghCelda(d){ ghCelda(d.f,d.h); },
  ghSem(d){ ui.ghSem=addDays(ghSemana(),7*(+d.n)); render(); },
  ghSemHoy(){ ui.ghSem=mondayOf(todayStr()); render(); },
  rutFil(d){ ui.rutFil=d.f; render(); },
  rutNueva(){ if(roDatos(curArea())) return; rutNueva(); },
  rutGuardar(){
    const aid=curArea(); if(roDatos(aid)) return;
    const nombre=$('#ru_nombre').value.trim(); if(!nombre){ toast('Escribe el nombre del socio'); return; }
    const sel=$('#ru_prof').value, auto=!sel, p=auto?rutSiguiente(aid):getProf(aid,sel); if(!p){ toast('No hay entrenador disponible'); return; }
    const id='ru'+uid();
    setPath(`data/${aid}/rutinas/${id}`,{id,nombre,tel:$('#ru_tel').value.trim(),obj:$('#ru_obj').value,plazo:+(($('#ru_plazo')||{}).value||48),profId:p.id,profNom:p.nombre,asig:auto?'auto':'manual',estado:'pendiente',ts:Date.now(),por:gimPor()});
    closeModal(); render(); toast(`Rutina enviada a ${p.nombre}`);
  },
  rutVer(d){ rutVer(d.id); },
  rutLista(d){                                             // el instructor la dejó en recepción
    const aid=curArea(), r=getPath(`data/${aid}/rutinas/${d.id}`); if(!r||roDatos(aid)||isRec()) return;
    if(isProf()&&r.profId!==session.profId) return;
    setPath(`data/${aid}/rutinas/${d.id}`,{...r,estado:'lista',lista:Date.now()}); closeModal(); render(); toast('Listo: recepción la ve para entregarla');
  },
  rutEntregada(d){                                         // recepción se la entregó al socio
    const aid=curArea(), r=getPath(`data/${aid}/rutinas/${d.id}`); if(!r||roDatos(aid)||isProf()) return;
    setPath(`data/${aid}/rutinas/${d.id}`,{...r,estado:'entregada',entregada:Date.now()}); closeModal(); render(); toast('Rutina entregada al socio');
  },
  rutPendiente(d){ const aid=curArea(), r=getPath(`data/${aid}/rutinas/${d.id}`); if(!r||roDatos(aid)||isProf()) return; const o={...r,estado:'pendiente'}; delete o.envio; delete o.lista; delete o.entregada; setPath(`data/${aid}/rutinas/${d.id}`,o); closeModal(); render(); },
  rutReasignar(d){
    const aid=curArea(), r=getPath(`data/${aid}/rutinas/${d.id}`), sel=($('#ru_re')||{}).value; if(!r||roDatos(aid)) return;
    if(!sel){ toast('Elige a qué entrenador se la cambias'); return; }
    const p=getProf(aid,sel); if(!p) return;
    setPath(`data/${aid}/rutinas/${d.id}`,{...r,profId:p.id,profNom:p.nombre,asig:'manual'}); closeModal(); render(); toast(`Rutina pasada a ${p.nombre}`);
  },
  rutBorrar(d){ if(isRec()||roDatos(curArea())||!confirm('¿Eliminar esta solicitud?')) return; setPath(`data/${curArea()}/rutinas/${d.id}`,undefined); closeModal(); render(); }
});
