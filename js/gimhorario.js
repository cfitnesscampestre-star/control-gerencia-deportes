'use strict';
/* =====================================================================
   gimhorario.js — Gimnasio: horarios de los instructores, horario semanal de
   personalizados (para recepción) y solicitudes de rutina genérica.

   DATOS
   · data/<área>/profesores/<id>.horLab  {d0:{i:'06:00',f:'14:00'}, … d6}   horario laboral por día (d0 = lunes)
   · data/<área>/profesores/<id>.horPt   {d0:{i:'15:00',f:'20:00'}, … d6}   horas en que da personalizados
     (un día sin renglón = no trabaja / no da personalizados)
   · data/<área>/profesores/<id>.rutinas  false = no entra en la fila de rutinas genéricas
   · data/<área>/paquetes/<id>.slots     {d1_16:{d:1,h:16}, …}               horario fijo semanal del cliente (ocupa esa hora)
   · data/<área>/rutinas/<id>            {id,nombre,tel,obj,profId,profNom,asig:'auto'|'manual',estado:'pendiente'|'enviada',ts,por}
   ===================================================================== */
const ghMin = t => { const m=String(t||'').match(/^(\d{1,2}):(\d{2})/); return m?(+m[1])*60+(+m[2]):null; };
function ghDia(p,k,d){                                   // renglón válido del día d (o null)
  const H=p&&p[k], x=H&&H['d'+d]; if(!x) return null;
  const a=ghMin(x.i), b=ghMin(x.f); return (a==null||b==null||b<=a)?null:x;
}
const ghCubre = (x,h) => !!x && ghMin(x.i)<=h*60 && ghMin(x.f)>=(h+1)*60;     // la hora h:00–h+1:00 cabe completa en el rango
const ghSlots = x => Object.values((x&&x.slots)||{}).filter(s=>s&&s.d!=null&&s.h!=null);
const ghKey = (d,h) => `d${d}_${h}`;
function ghHorTxt(p,k){                                  // “Lun–Vie 6:00–14:00 · Sáb 8:00–12:00”
  const runs=[]; for(let d=0;d<7;d++){ const x=ghDia(p,k,d); if(!x) continue; const key=x.i+'-'+x.f, l=runs[runs.length-1];
    if(l&&l.key===key&&l.b===d-1) l.b=d; else runs.push({a:d,b:d,key,x}); }
  const hm=t=>{ const m=ghMin(t); return Math.floor(m/60)+':'+pad(m%60); };
  return runs.map(r=>`${DIAS[r.a]}${r.b>r.a?'–'+DIAS[r.b]:''} ${hm(r.x.i)}–${hm(r.x.f)}`).join(' · ');
}

/* ---------- Dirección: campos en la ficha del instructor ---------- */
function gimProfCampos(aid,p,ro){
  const dis=ro?' disabled':'';
  const fila=(d)=>{ const L=ghDia(p,'horLab',d), P=ghDia(p,'horPt',d);
    return `<div class="gh-row" data-d="${d}"><b class="gh-d">${DIAS_L[d]}</b>
      <div class="gh-l"><label class="gh-ck"><input type="checkbox" class="gh_l"${L?' checked':''}${dis}><span>Laboral</span></label>
        <input type="time" class="gh_li" step="1800" value="${esc(L?L.i:'06:00')}"${dis}><em>a</em><input type="time" class="gh_lf" step="1800" value="${esc(L?L.f:'14:00')}"${dis}></div>
      <div class="gh-l"><label class="gh-ck"><input type="checkbox" class="gh_p"${P?' checked':''}${dis}><span>Personalizados</span></label>
        <input type="time" class="gh_pi" step="1800" value="${esc(P?P.i:'15:00')}"${dis}><em>a</em><input type="time" class="gh_pf" step="1800" value="${esc(P?P.f:'20:00')}"${dis}></div></div>`; };
  return `<div class="f"><span class="lb">Horario laboral y de personalizados</span>
    <div class="gh-box">${[0,1,2,3,4,5,6].map(fila).join('')}</div>
    ${ro?'':'<button type="button" class="btn sm" data-act="ghCopiar">Copiar el primer día marcado a los demás días</button>'}
    <small class="mut">Marca los días que trabaja y su horario. En “Personalizados” anota las horas en que puede dar entrenamientos personalizados (pueden ir fuera del horario laboral). Un día sin marcar = no trabaja o no da personalizados ese día. Recepción ve estas horas como libres u ocupadas.</small></div>
    <label class="f"><span>Rutinas genéricas</span><select id="gh_rut"${dis}><option value="1"${p.rutinas===false?'':' selected'}>Entra en la fila para recibir rutinas</option><option value="0"${p.rutinas===false?' selected':''}>No recibe rutinas genéricas</option></select></label>`;
}
function gimProfLeer(aid){
  if(!esGim(aid)) return {};
  const horLab={}, horPt={};
  document.querySelectorAll('.gh-row').forEach(r=>{
    const d=r.dataset.d;
    if(r.querySelector('.gh_l').checked) horLab['d'+d]={i:r.querySelector('.gh_li').value,f:r.querySelector('.gh_lf').value};
    if(r.querySelector('.gh_p').checked) horPt['d'+d]={i:r.querySelector('.gh_pi').value,f:r.querySelector('.gh_pf').value};
  });
  const rut=$('#gh_rut');
  return {horLab,horPt,rutinas:rut?rut.value==='1':true};
}
function gimProfError(aid){
  if(!esGim(aid)) return '';
  for(const r of document.querySelectorAll('.gh-row')){
    const d=DIAS_L[+r.dataset.d];
    for(const [c,i,f,t] of [['.gh_l','.gh_li','.gh_lf','laboral'],['.gh_p','.gh_pi','.gh_pf','de personalizados']]){
      if(!r.querySelector(c).checked) continue;
      const a=ghMin(r.querySelector(i).value), b=ghMin(r.querySelector(f).value);
      if(a==null||b==null) return `Anota la hora de inicio y de fin ${t} del ${d}`;
      if(b<=a) return `El fin del horario ${t} del ${d} debe ser después del inicio`;
    }
  }
  return '';
}

/* ---------- Horario semanal de personalizados (dirección y recepción) ---------- */
/* Las sesiones reales de un paquete: desde su inicio, cada semana en los días/horas del horario fijo, hasta completar las contratadas.
   Ej.: 20 sesiones con 1 horario fijo = 20 semanas seguidas en ese mismo día y hora. */
function ghSesiones(pk){
  const S=ghSlots(pk).map(s=>({d:+s.d,h:+s.h})).sort((x,y)=>(x.d-y.d)||(x.h-y.h)), n=Math.max(0,+pk.total||0), out=[];
  if(!S.length||!n||!pk.inicio) return out;
  let f=pk.inicio;
  for(let i=0;i<n*7+14&&out.length<n;i++,f=addDays(f,1)){ const wd=wdIdx(f); S.filter(s=>s.d===wd).forEach(s=>{ if(out.length<n) out.push({f,h:s.h}); }); }
  return out;
}
function ghCtx(aid,excluir){                             // instructores activos y qué fecha+hora tiene ocupada cada uno
  const ps=profesores(aid).filter(p=>p.activo!==false), pk=coll(aid,'paquetes').filter(x=>ptVigente(x)&&x.id!==excluir), occ={};
  pk.forEach(x=>ghSesiones(x).forEach(s=>{ occ[`${x.profId}|${s.f}|${s.h}`]=x; }));
  return {ps,pk,occ};
}
function ghOferta(ctx,f,h){                              // instructores AUTORIZADOS a esa hora (en ese día de la semana) y si ya están ocupados
  const d=wdIdx(f);
  return ctx.ps.filter(p=>ghCubre(ghDia(p,'horPt',d),h)).map(p=>({p,oc:ctx.occ[`${p.id}|${f}|${h}`]||null}));
}
const ghSemana = () => ui.ghSem||mondayOf(todayStr());
function vGimHorario(aid,embed){
  const ro=roDatos(aid), ctx=ghCtx(aid), sem=ghSemana(), hoy=todayStr();
  let h0=24, h1=0;
  ctx.ps.forEach(p=>{ for(let d=0;d<7;d++){ const x=ghDia(p,'horPt',d); if(!x) continue; h0=Math.min(h0,Math.floor(ghMin(x.i)/60)); h1=Math.max(h1,Math.ceil(ghMin(x.f)/60)); } });
  const sw=(!embed&&typeof gimPtSwitch==='function')?gimPtSwitch():'';
  const head=embed?`<div class="h2" style="margin-top:18px">Horario de personalizados <button class="btn sm" data-act="aTab" data-tab="gimhorario">Ver completo</button></div>`:`<div class="h2">Horario semanal de personalizados</div>${sw}`;
  if(h1<=h0) return `${head}<div class="sub">Aquí se ve qué horas tienen libres los entrenadores para un personalizado.</div>${empty(ro?'Todavía no hay horarios de personalizados capturados.':'Primero captura el horario de personalizados de cada instructor, en Instructores.')}`;
  let libres=0, llenas=0;
  const fechas=[0,1,2,3,4,5,6].map(i=>addDays(sem,i));
  const filas=[]; for(let h=h0;h<h1;h++){
    filas.push(`<tr><th>${hh(h)}</th>${fechas.map((f,d)=>{
      const of=ghOferta(ctx,f,h), lib=of.filter(x=>!x.oc).length;
      if(!of.length||f<hoy) return `<td><span class="gh-c off" aria-label="Sin instructor"></span></td>`;
      lib?libres++:llenas++;
      return `<td><button class="gh-c ${lib?'ok':'bad'}" data-act="ghCelda" data-f="${f}" data-h="${h}" aria-label="${DIAS_L[d]} ${esc(fmtCorta(f))} ${hh(h)}: ${lib?plu(lib,'instructor libre','instructores libres'):'todo ocupado'}">${lib?`<b>${lib}</b><small>${lib===1?'libre':'libres'}</small>`:'<b>Lleno</b>'}</button></td>`;
    }).join('')}</tr>`);
  }
  const nav=`<div class="calnav"><button class="ibtn" data-act="ghSem" data-n="-1" aria-label="Semana anterior">${ic('back')}</button><b>${esc(fmtCorta(sem))} – ${esc(fmtCorta(addDays(sem,6)))}</b><button class="ibtn" data-act="ghSem" data-n="1" aria-label="Semana siguiente">${ic('next')}</button><button class="btn sm" data-act="ghSemHoy">Esta semana</button></div>`;
  return `${head}
    <div class="sub">${ro?'Horas de personalizados de los entrenadores.':'Toca una hora para ver qué instructores tienen libre y asignarle el personalizado al socio.'} Verde = hay al menos un instructor libre · Rojo = todos ocupados · Gris = nadie autorizado a esa hora. Avanza de semana para ver lo que ya apartaron los paquetes contratados.</div>
    ${nav}
    ${embed?'':`<div class="kpis k3">${kpi('Horas con lugar',libres,'verdes en la semana',{cls:'ok',color:'var(--b1)'})}${kpi('Horas llenas',llenas,'rojas en la semana',{cls:llenas?'bad':'',color:'var(--bad)'})}${kpi('Instructores',ctx.ps.filter(p=>Object.keys(p.horPt||{}).length).length,'con horario de personalizados',{color:'var(--b3)'})}</div>`}
    <div class="gh-wrap"><table class="gh-tb"><thead><tr><th></th>${fechas.map((f,i)=>`<th class="${f===hoy?'hoy':''}">${DIAS[i]}<small>${+f.slice(8,10)}</small></th>`).join('')}</tr></thead><tbody>${filas.join('')}</tbody></table></div>
    <div class="gh-leg"><span><i class="ok"></i>Libre</span><span><i class="bad"></i>Ocupado</span><span><i class="off"></i>Sin instructor autorizado</span></div>`;
}
function ghCelda(f,h){
  const aid=curArea(), ro=roDatos(aid), ctx=ghCtx(aid), of=ghOferta(ctx,f,+h), wd=wdIdx(f);
  openModal(`${mHead(`${DIAS_L[wd]} ${esc(fmtCorta(f))} · ${hh(+h)}`)}
    <div class="sub">Instructores autorizados para personalizados a esta hora.</div>
    ${of.length?of.map(({p,oc})=>`<div class="card gh-ins"><div class="row">${avatarHTML(p.nombre,p.foto,40)}<div><b>${esc(p.nombre)}</b><small>${oc?`Ocupado con ${esc(oc.cliente||'un cliente')}`:'Libre'}</small></div>${pill(oc?'Ocupado':'Libre',oc?'bad':'ok')}</div>
      ${(oc||ro)?'':`<div class="btns"><button class="btn primary block" data-act="ghAsignar" data-prof="${esc(p.id)}" data-d="${wd}" data-h="${h}" data-f="${f}">Asignar personalizado a ${esc(p.nombre.split(' ')[0])}</button></div>`}</div>`).join(''):empty('Nadie está autorizado para personalizados a esta hora.')}
    <div class="btns"><button class="btn" data-act="closeModal">Cerrar</button></div>`);
}

/* horario fijo del cliente dentro de la ventana de “Personalizado”: solo días y horas AUTORIZADOS al instructor */
let ptSlotsTmp = {};
function ghSlotsHTML(){
  const L=Object.values(ptSlotsTmp).sort((a,b)=>(a.d-b.d)||(a.h-b.h));
  return L.length?L.map(s=>`<span class="gh-chip">${DIAS[s.d]} ${hh(s.h)}<button type="button" data-act="ptSlotDel" data-k="${ghKey(s.d,s.h)}" aria-label="Quitar horario">${ic('x')}</button></span>`).join(''):'<small class="mut">Sin horario fijo.</small>';
}
function ghSlotsCampo(id){
  return `<div class="f"><span class="lb">Horario fijo del cliente (cada semana)</span>
    <input type="hidden" id="pt_pkid" value="${esc(id||'')}">
    <div id="pt_aviso"></div>
    <div id="pt_slots" class="gh-chips">${ghSlotsHTML()}</div>
    <div class="two"><select id="pt_sd" aria-label="Día"></select><select id="pt_sh" aria-label="Hora"></select></div>
    <button type="button" class="btn sm" data-act="ptSlotAdd">+ Agregar este día y hora</button>
    <div id="pt_prev" class="gh-prev"></div>
    <small class="mut">Elige un horario por cada sesión de la semana (máximo tantos como sesiones contratadas). Ese horario se repite cada semana hasta completar las sesiones. Solo salen las horas que la dirección autorizó a este instructor.</small></div>`;
}
function ghFillHoras(){
  const aid=curArea(), sd=$('#pt_sd'), sh=$('#pt_sh'), pr=$('#pt_prof'); if(!sd||!sh||!pr) return;
  const p=getProf(aid,pr.value), d=sd.value===''?NaN:+sd.value, x=p&&!isNaN(d)?ghDia(p,'horPt',d):null;
  if(!x){ sh.innerHTML=''; return; }
  const ini=($('#pt_ini')||{}).value||todayStr(), ctx=ghCtx(aid,($('#pt_pkid')||{}).value);
  let f0=ini; for(let i=0;i<7&&wdIdx(f0)!==d;i++) f0=addDays(f0,1);                 // primera fecha en que cae ese día
  const keep=sh.value; let html='', first='';
  for(let h=Math.floor(ghMin(x.i)/60);h<Math.ceil(ghMin(x.f)/60);h++){
    if(!ghCubre(x,h)) continue;
    const oc=ctx.occ[`${p.id}|${f0}|${h}`], ya=!!ptSlotsTmp[ghKey(d,h)], dis=!!oc||ya;
    if(!dis&&first==='') first=String(h);
    html+=`<option value="${h}"${dis?' disabled':''}>${hh(h)}${oc?' · ocupado':ya?' · ya elegido':''}</option>`;
  }
  sh.innerHTML=html; if(keep&&sh.querySelector(`option[value="${keep}"]:not([disabled])`)) sh.value=keep; else if(first) sh.value=first;
}
function ghFillSel(){
  const aid=curArea(), sd=$('#pt_sd'), pr=$('#pt_prof'); if(!sd||!pr) return;
  const p=getProf(aid,pr.value), dias=p?[0,1,2,3,4,5,6].filter(d=>ghDia(p,'horPt',d)):[], keep=sd.value;
  sd.innerHTML=dias.length?dias.map(d=>`<option value="${d}">${DIAS_L[d]}</option>`).join(''):'<option value="">Sin horario autorizado</option>';
  if(keep!==''&&dias.includes(+keep)) sd.value=keep;
  ghFillHoras();
  const add=document.querySelector('[data-act=ptSlotAdd]'); if(add) add.disabled=!dias.length;
  const av=$('#pt_aviso'); if(av) av.innerHTML=dias.length?`<small class="mut">Autorizado para ${esc(p.nombre)}: ${esc(ghHorTxt(p,'horPt'))}.</small>`
    :`<small class="bad">${esc(p?p.nombre:'Este instructor')} no tiene horario de personalizados autorizado. La dirección debe asignárselo en Instructores.</small>`;
}
function ghRefrescar(){ const el=$('#pt_slots'); if(el) el.innerHTML=ghSlotsHTML(); ghFillHoras(); ghPreview(); }
function ghPreview(){
  const el=$('#pt_prev'); if(!el) return;
  const tot=parseInt(($('#pt_tot')||{}).value)||0, ini=($('#pt_ini')||{}).value, fin=($('#pt_fin')||{}).value;
  const ses=ghSesiones({total:tot,inicio:ini,slots:ptSlotsTmp});
  if(!ses.length){ el.innerHTML=''; return; }
  const ult=ses[ses.length-1].f, tarde=!!fin&&ult>fin;
  el.innerHTML=`<small><b>${ses.length}</b> de ${tot} sesiones apartadas, del ${esc(fmtCorta(ses[0].f))} al ${esc(fmtCorta(ult))}.</small>${tarde?`<small class="bad">La última sesión cae después del vencimiento (${esc(fmtCorta(fin))}). <button type="button" class="btn sm" data-act="ptAjustaFin" data-f="${ult}">Vencer el ${esc(fmtCorta(ult))}</button></small>`:''}`;
}
function ghValidarSlots(aid,pkId,profId,tot,ini){        // '' si está bien; si no, el motivo
  const S=Object.values(ptSlotsTmp); if(!S.length) return '';
  if(S.length>tot) return `Con ${tot} ${tot===1?'sesión':'sesiones'} solo puedes elegir ${tot} ${tot===1?'horario':'horarios'} por semana`;
  const p=getProf(aid,profId); if(!p) return 'Elige al instructor';
  for(const s of S) if(!ghCubre(ghDia(p,'horPt',+s.d),+s.h)) return `${p.nombre} no tiene autorizado dar personalizados el ${DIAS_L[s.d]} a las ${hh(s.h)}. Quita ese horario o pide a la dirección que lo autorice`;
  const ctx=ghCtx(aid,pkId);
  for(const s of ghSesiones({total:tot,inicio:ini,slots:ptSlotsTmp})){ const c=ctx.occ[`${profId}|${s.f}|${s.h}`]; if(c) return `El ${DIAS[wdIdx(s.f)]} ${fmtCorta(s.f)} a las ${hh(s.h)} ya está ocupado por ${c.cliente||'otro cliente'}`; }
  return '';
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
function vGimRutinas(aid){
  const ro=roDatos(aid), L=rutinas(aid), sig=rutSiguiente(aid), cola=rutCola(aid), fil=ui.rutFil||'pendiente';
  const pend=L.filter(r=>r.estado!=='enviada'), list=fil==='todas'?L:L.filter(r=>fil==='enviada'?r.estado==='enviada':r.estado!=='enviada');
  const sw=(typeof gimPtSwitch==='function')?gimPtSwitch():'';
  return `<div class="h2">Rutinas genéricas ${ro?'':`<button class="btn sm primary" data-act="rutNueva">+ Solicitar rutina</button>`}</div>${sw}
    <div class="sub">Cuando un socio pide una rutina genérica, se manda al entrenador que sigue en la fila. Ese entrenador la ve en su pantalla, se pone en contacto con el socio y la marca como enviada.</div>
    <div class="card gh-sig"><span>Siguiente en turno</span><b>${sig?esc(sig.nombre):'Sin entrenadores en la fila'}</b>
      ${cola.length?`<div class="gh-fila">${cola.map(p=>`<span class="${sig&&p.id===sig.id?'on':''}">${esc(p.nombre.split(' ')[0])}</span>`).join('<i>›</i>')}</div>`:''}</div>
    <div class="kpis k3">${kpi('Por enviar',pend.length,'rutinas pendientes',{cls:pend.length?'warn':'ok',color:'var(--warn)'})}${kpi('Enviadas',L.length-pend.length,'en total',{cls:'ok',color:'var(--b1)'})}${kpi('Este mes',L.filter(r=>String(new Date(r.ts||0).toISOString()).slice(0,7)===todayStr().slice(0,7)).length,'solicitadas',{color:'var(--b3)'})}</div>
    <div class="chips">${[['pendiente','Por enviar'],['enviada','Enviadas'],['todas','Todas']].map(([id,l])=>`<button class="chip${fil===id?' on':''}" data-act="rutFil" data-f="${id}">${l}</button>`).join('')}</div>
    ${list.length?list.map(r=>`<button class="line gh-rut" style="--ac:${areaColor(aid)}" data-act="rutVer" data-id="${esc(r.id)}"><div class="t">${esc(fmtCorta(ymd(new Date(r.ts||Date.now()))))}</div>
      <div class="b"><b>${esc(r.nombre)}</b><small>${esc(RUT_OBJ[r.obj]||'')} · para ${esc(rutProfNom(aid,r))}${r.asig==='manual'?' (elegido)':''}</small></div>
      <div class="r">${pill(r.estado==='enviada'?'Enviada':'Por enviar',r.estado==='enviada'?'ok':'warn')}</div></button>`).join(''):empty(fil==='pendiente'?'No hay rutinas por enviar.':'No hay rutinas en esta lista.')}`;
}
function rutNueva(){
  const aid=curArea(), sig=rutSiguiente(aid), cola=rutCola(aid);
  if(!cola.length){ toast('Primero da de alta a los instructores (y que entren en la fila de rutinas)'); return; }
  openModal(`${mHead('Solicitar rutina genérica')}
    <label class="f"><span>Nombre del socio</span><input id="ru_nombre" autocomplete="off" placeholder="Nombre completo"></label>
    <label class="f"><span>Teléfono o contacto (para que el entrenador lo busque)</span><input id="ru_tel" inputmode="tel" autocomplete="off"></label>
    <label class="f"><span>Objetivo</span><select id="ru_obj">${Object.entries(RUT_OBJ).map(([k,l])=>`<option value="${k}">${l}</option>`).join('')}</select></label>
    <label class="f"><span>Enviar a</span><select id="ru_prof"><option value="">Siguiente en turno: ${esc(sig.nombre)}</option>${cola.map(p=>`<option value="${esc(p.id)}">${esc(p.nombre)}</option>`).join('')}</select>
      <small class="mut">Lo normal es dejar al que sigue en la fila. Si eliges a otro, la fila no se mueve.</small></label>
    <div class="btns"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="rutGuardar">Enviar solicitud</button></div>`);
}
function rutVer(id){
  const aid=curArea(), r=getPath(`data/${aid}/rutinas/${id}`); if(!r) return;
  const ro=roDatos(aid), cola=rutCola(aid), pend=r.estado!=='enviada';
  openModal(`${mHead(esc(r.nombre))}
    <div class="sub">${esc(RUT_OBJ[r.obj]||'')}</div>
    <div class="card"><div class="dl"><dt>Entrenador</dt><dd>${esc(rutProfNom(aid,r))}${r.asig==='manual'?' · elegido por recepción':' · por turno'}</dd></div>
      <div class="dl"><dt>Contacto</dt><dd>${r.tel?`<a href="tel:${esc(r.tel)}">${esc(r.tel)}</a>`:'—'}</dd></div>
      <div class="dl"><dt>Solicitada</dt><dd>${esc(fmtCorta(ymd(new Date(r.ts||Date.now()))))}${r.por?' · '+esc(r.por):''}</dd></div>
      <div class="dl"><dt>Estado</dt><dd>${pend?'Por enviar':'Enviada'+(r.envio?' el '+esc(fmtCorta(ymd(new Date(r.envio)))):'')}</dd></div></div>
    ${(ro||!pend)?'':`<label class="f"><span>Cambiar de entrenador</span><select id="ru_re"><option value="">No cambiar</option>${cola.filter(p=>p.id!==r.profId).map(p=>`<option value="${esc(p.id)}">${esc(p.nombre)}</option>`).join('')}</select></label>`}
    <div class="btns"><button class="btn" data-act="closeModal">Cerrar</button>
      ${ro?'':(pend?`<button class="btn" data-act="rutReasignar" data-id="${esc(id)}">Cambiar entrenador</button><button class="btn primary" data-act="rutEnviada" data-id="${esc(id)}">Marcar enviada</button>`:`<button class="btn" data-act="rutPendiente" data-id="${esc(id)}">Volver a pendiente</button>`)}</div>
    ${(!ro&&!isRec())?`<div class="btns"><button class="btn danger" data-act="rutBorrar" data-id="${esc(id)}">Eliminar solicitud</button></div>`:''}`);
}
/* lo que ve el instructor en su pantalla */
function gimRutProf(){
  const aid=session.area, mias=rutinas(aid).filter(r=>r.profId===session.profId&&r.estado!=='enviada').reverse();
  if(!mias.length) return '';
  return `<div class="h2">Rutinas por enviar <span class="pill warn">${mias.length}</span></div>
    <div class="sub">Un socio pidió una rutina genérica. Ponte en contacto y márcala como enviada.</div>
    ${mias.map(r=>`<div class="card gh-rp"><div class="row"><div><b>${esc(r.nombre)}</b><small>${esc(RUT_OBJ[r.obj]||'')} · ${esc(fmtCorta(ymd(new Date(r.ts||Date.now()))))}</small></div></div>
      <div class="btns">${r.tel?`<a class="btn" href="tel:${esc(r.tel)}">${esc(r.tel)}</a>`:'<small class="mut">Sin teléfono: pregunta en recepción.</small>'}<button class="btn primary" data-act="rutEnviada" data-id="${esc(r.id)}">Marcar enviada</button></div></div>`).join('')}`;
}

Object.assign(actions,{
  ghCopiar(){
    const rows=[...document.querySelectorAll('.gh-row')], src=rows.find(r=>r.querySelector('.gh_l').checked||r.querySelector('.gh_p').checked);
    if(!src){ toast('Marca primero un día'); return; }
    rows.forEach(r=>{ if(r===src) return; ['gh_l','gh_li','gh_lf','gh_p','gh_pi','gh_pf'].forEach(c=>{ const a=src.querySelector('.'+c), b=r.querySelector('.'+c); if(a.type==='checkbox') b.checked=a.checked; else b.value=a.value; }); });
    toast('Horario copiado a todos los días');
  },
  ghCelda(d){ ghCelda(d.f,d.h); },
  ghSem(d){ ui.ghSem=addDays(ghSemana(),7*(+d.n)); render(); },
  ghSemHoy(){ ui.ghSem=mondayOf(todayStr()); render(); },
  ghAsignar(d){ closeModal(); openPT('',d.prof,{d:+d.d,h:+d.h,f:d.f}); },
  ptSlotAdd(){
    const d=$('#pt_sd').value, h=$('#pt_sh').value, tot=parseInt($('#pt_tot').value)||0;
    if(d===''||h===''){ toast('Elige un día y una hora autorizados'); return; }
    if(tot<1){ toast('Primero indica cuántas sesiones se contrataron'); return; }
    if(Object.keys(ptSlotsTmp).length>=tot){ toast(`Con ${tot} ${tot===1?'sesión':'sesiones'} solo puedes elegir ${tot} ${tot===1?'horario':'horarios'} por semana`); return; }
    ptSlotsTmp[ghKey(+d,+h)]={d:+d,h:+h}; ghRefrescar();
  },
  ptSlotDel(d){ delete ptSlotsTmp[d.k]; ghRefrescar(); },
  ptAjustaFin(d){ const f=$('#pt_fin'); if(f){ f.value=d.f; ghPreview(); } },
  rutFil(d){ ui.rutFil=d.f; render(); },
  rutNueva(){ if(roDatos(curArea())) return; rutNueva(); },
  rutGuardar(){
    const aid=curArea(); if(roDatos(aid)) return;
    const nombre=$('#ru_nombre').value.trim(); if(!nombre){ toast('Escribe el nombre del socio'); return; }
    const sel=$('#ru_prof').value, auto=!sel, p=auto?rutSiguiente(aid):getProf(aid,sel); if(!p){ toast('No hay entrenador disponible'); return; }
    const id='ru'+uid();
    setPath(`data/${aid}/rutinas/${id}`,{id,nombre,tel:$('#ru_tel').value.trim(),obj:$('#ru_obj').value,profId:p.id,profNom:p.nombre,asig:auto?'auto':'manual',estado:'pendiente',ts:Date.now(),por:gimPor()});
    closeModal(); render(); toast(`Rutina enviada a ${p.nombre}`);
  },
  rutVer(d){ rutVer(d.id); },
  rutEnviada(d){
    const aid=curArea(), r=getPath(`data/${aid}/rutinas/${d.id}`); if(!r||roDatos(aid)) return;
    if(isProf()&&r.profId!==session.profId) return;
    setPath(`data/${aid}/rutinas/${d.id}`,{...r,estado:'enviada',envio:Date.now()}); closeModal(); render(); toast('Rutina marcada como enviada');
  },
  rutPendiente(d){ const aid=curArea(), r=getPath(`data/${aid}/rutinas/${d.id}`); if(!r||roDatos(aid)||isProf()) return; const o={...r,estado:'pendiente'}; delete o.envio; setPath(`data/${aid}/rutinas/${d.id}`,o); closeModal(); render(); },
  rutReasignar(d){
    const aid=curArea(), r=getPath(`data/${aid}/rutinas/${d.id}`), sel=($('#ru_re')||{}).value; if(!r||roDatos(aid)) return;
    if(!sel){ toast('Elige a qué entrenador se la cambias'); return; }
    const p=getProf(aid,sel); if(!p) return;
    setPath(`data/${aid}/rutinas/${d.id}`,{...r,profId:p.id,profNom:p.nombre,asig:'manual'}); closeModal(); render(); toast(`Rutina pasada a ${p.nombre}`);
  },
  rutBorrar(d){ if(isRec()||roDatos(curArea())||!confirm('¿Eliminar esta solicitud?')) return; setPath(`data/${curArea()}/rutinas/${d.id}`,undefined); closeModal(); render(); }
});

/* cambios dentro de la ventana de Personalizado */
document.addEventListener('change',e=>{
  const id=e.target&&e.target.id; if(!$('#pt_slots')) return;
  if(id==='pt_prof'){
    const p=getProf(curArea(),e.target.value), antes=Object.keys(ptSlotsTmp).length;
    Object.keys(ptSlotsTmp).forEach(k=>{ const s=ptSlotsTmp[k]; if(!p||!ghCubre(ghDia(p,'horPt',s.d),s.h)) delete ptSlotsTmp[k]; });
    const q=antes-Object.keys(ptSlotsTmp).length; if(q) toast(`Se quitaron ${q} ${q===1?'horario':'horarios'} que no están autorizados para ${p?p.nombre:'ese instructor'}`);
    ghFillSel(); ghRefrescar();
  } else if(id==='pt_sd') ghFillHoras();
  else if(id==='pt_ini'){ ghFillHoras(); ghPreview(); }
  else if(id==='pt_fin'||id==='pt_tot') ghPreview();
});
document.addEventListener('input',e=>{ const id=e.target&&e.target.id; if((id==='pt_tot'||id==='pt_fin'||id==='pt_ini')&&$('#pt_slots')) ghPreview(); });
