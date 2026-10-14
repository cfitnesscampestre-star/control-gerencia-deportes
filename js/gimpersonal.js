'use strict';
/* =====================================================================
   gimpersonal.js — Gimnasio: el INSTRUCTOR registra y agenda sus personalizados;
   RECEPCIÓN solo ve el horario y le manda solicitudes.

   · Recepción ve el horario semanal (quién está libre a qué hora). Si llega un socio, toca la hora,
     elige a un instructor libre y le manda una solicitud: “Fulano solicita clases”. No se capturan
     teléfonos: el instructor pasa a recepción y ahí se hace el contacto.
   · El instructor ve la solicitud en su pantalla (Enterado · Registrar personalizado · Ya lo atendí)
     y registra el personalizado él mismo, con libertad de agenda:
       - horario que se repite (cualquier día y hora en que abre el gimnasio: Lun 7:00, Jue 20:00…)
       - y/o fechas sueltas
       - las sesiones que no se agenden quedan “sin fecha” y se agendan después.
     Solo se bloquea lo que no puede pasar: fechas u horas que ya pasaron y dos clientes a la misma hora.
   · Dirección y gerencia ven todo (dirección puede corregir con “Editar”).

   Datos: data/<área>/solicitudes/<id> {id,ts,profId,cliente,nota,f,h,por,estado:'nueva'|'vista'|'atendida',vista,atendida,pk}
   ===================================================================== */
LG_T.solicitud = ['Solicitud de recepción','info'];
LG_T.agenda = ['Sesión agendada','info'];
const SOL_EST = {nueva:['Nueva','warn'],vista:['Vista','info'],atendida:['Atendida','ok']};
const solicitudes = aid => coll(aid,'solicitudes').sort((a,b)=>(b.ts||0)-(a.ts||0));
const solPendientes = (aid,profId) => solicitudes(aid).filter(s=>s.estado!=='atendida'&&(!profId||s.profId===profId));
const ptHoraOpts = (horas,sel,dis) => horas.map(h=>`<option value="${h}"${String(h)===String(sel)?' selected':''}${dis&&dis[h]?' disabled':''}>${hh(h)}${dis&&dis[h]?' · '+esc(dis[h]):''}</option>`).join('');

/* ---------- solicitudes: recepción → instructor ---------- */
function solNueva(profId,f,h){
  const aid=curArea(), p=getProf(aid,profId); if(!p) return;
  openModal(`${mHead('Solicitud para '+esc(p.nombre))}
    <div class="sub">Un socio quiere personalizados. ${esc(p.nombre.split(' ')[0])} lo verá en su pantalla y se acercará a recepción para atenderlo.</div>
    <label class="f"><span>Nombre del socio</span><input id="sl_cli" autocomplete="off" placeholder="Nombre completo"></label>
    <label class="f"><span>Nota (opcional)</span><input id="sl_nota" autocomplete="off" placeholder="Ej. quiere 3 veces por semana, por las mañanas"></label>
    <small class="mut">Horario que vio libre: ${esc(ctTxt({f,h:+h}))}. No escribas teléfonos: los datos del socio se quedan en recepción.</small>
    <div class="btns"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="solGuardar" data-prof="${esc(profId)}" data-f="${esc(f)}" data-h="${esc(h)}">Enviar solicitud</button></div>`);
}
function solFila(aid,s,o){
  o=o||{}; const p=getProf(aid,s.profId)||{}, E=SOL_EST[s.estado]||SOL_EST.nueva;
  return `<div class="card sol${s.estado==='nueva'?' nueva':''}"><div class="sol-h"><b>${esc(s.cliente||'Socio')}</b>${pill(E[0],E[1])}</div>
    <small>${o.prof?'Recepción':esc(p.nombre||'Instructor')} · ${esc(fmtTs(s.ts))}${s.f?` · vio libre ${esc(ctTxt({f:s.f,h:s.h}))}`:''}${s.por&&!o.prof?' · envió '+esc(s.por):''}</small>
    ${s.nota?`<div class="sol-n">${esc(s.nota)}</div>`:''}
    ${o.prof?`<small class="mut">Pasa a recepción por los datos del socio.</small><div class="btns">${s.estado==='nueva'?`<button class="btn sm" data-act="solVista" data-id="${esc(s.id)}">Enterado</button>`:''}<button class="btn sm primary" data-act="solRegistrar" data-id="${esc(s.id)}">Registrar personalizado</button><button class="btn sm" data-act="solAtendida" data-id="${esc(s.id)}">Ya lo atendí</button></div>`:''}
    ${(o.rec&&s.estado==='nueva')?`<div class="btns"><button class="btn sm" data-act="solBorrar" data-id="${esc(s.id)}">Cancelar solicitud</button></div>`:''}</div>`;
}
function gimSolProf(aid,pid){                               // pantalla del instructor
  const L=solPendientes(aid,pid); if(!L.length) return '';
  return `<div class="h2">Solicitudes de recepción <span class="pill warn">${L.length}</span></div>${L.map(s=>solFila(aid,s,{prof:true})).join('')}`;
}
function gimSolRec(aid){                                    // lo que recepción ya envió
  const L=solicitudes(aid).slice(0,10); if(!L.length) return '';
  return `<div class="h2 sm">Solicitudes enviadas</div><div class="sub">Nueva = el instructor aún no la ve · Vista = ya la vio · Atendida = ya habló con el socio.</div>${L.map(s=>solFila(aid,s,{rec:isRec()||session.rol==='dir'})).join('')}`;
}

/* ---------- alta y edición del personalizado ---------- */
let ptForm = null;                                           // {id, slots:{k:{d,h}}, sueltas:[{id,f,h,suelta}], solId}
function openPT(id,o){
  o=o||{}; const aid=curArea(), x=id?(getPath(`data/${aid}/paquetes/${id}`)||{}):{}, t=todayStr(), coach=isProf();
  if(id&&coach&&x.profId!==session.profId) return;
  if(!id&&!coach){ toast('Los personalizados los registra cada instructor desde su pantalla'); return; }
  const ps=profesores(aid).filter(p=>p.activo!==false), usadas=ptReal(x), iniFijo=!!id&&(usadas>0||ptSes(x).length>0), ini0=x.inicio||t;
  ptForm={id:id||'',slots:{},sueltas:[],solId:o.solId||''};
  ghSlots(x).forEach(s=>{ ptForm.slots[ghKey(+s.d,+s.h)]={d:+s.d,h:+s.h}; });
  const dHoy=wdIdx(t);
  openModal(`${mHead(id?'Editar personalizado':'Nuevo personalizado')}
    ${coach?'':`<label class="f"><span>Instructor</span><select id="pt_prof">${ps.map(p=>`<option value="${esc(p.id)}"${x.profId===p.id?' selected':''}>${esc(p.nombre)}</option>`).join('')}</select></label>`}
    <label class="f"><span>Cliente</span><input id="pt_cli" value="${esc(x.cliente||o.cliente||'')}" placeholder="Nombre del socio" autocomplete="off"></label>
    <div class="two"><label class="f"><span>Sesiones contratadas</span><input id="pt_tot" type="number" inputmode="numeric" min="${Math.max(1,usadas)}" value="${esc(x.total||12)}"></label>
      <label class="f"><span>Monto (opcional)</span><input id="pt_monto" type="number" inputmode="numeric" min="0" value="${esc(x.monto||'')}" placeholder="$"></label></div>
    ${usadas?`<small class="mut">Ya se usaron ${usadas} sesiones: no se puede contratar menos.</small>`:''}
    <div class="two"><label class="f"><span>Inicio</span><input id="pt_ini" type="date"${iniFijo?' disabled':` min="${t}"`} value="${esc(ini0)}"></label>
      <label class="f"><span>Vence</span><input id="pt_fin" type="date" value="${esc(x.fin||addDays(ini0,60))}"></label></div>
    <div class="f pt-ag"><span class="lb">Horario que se repite cada semana <small class="mut">(opcional)</small></span>
      <div id="pt_rep" class="gh-chips"></div>
      <div class="two"><select id="pt_rd" aria-label="Día">${DIAS_L.map((n,i)=>`<option value="${i}"${i===dHoy?' selected':''}>${n}</option>`).join('')}</select><select id="pt_rh" aria-label="Hora"></select></div>
      <button type="button" class="btn sm" data-act="ptRepAdd">+ Agregar día y hora</button>
      <small class="mut">Cualquier día y hora en que abre el gimnasio, por ejemplo lunes 7:00 y jueves 20:00. Se repite cada semana desde el inicio hasta completar las sesiones.</small></div>
    <div class="f pt-ag"><span class="lb">Fechas sueltas <small class="mut">(opcional)</small></span>
      <div id="pt_sue" class="gh-chips"></div>
      <div class="two"><input id="pt_sf" type="date" min="${t}" value="${t}" aria-label="Fecha"><select id="pt_sh" aria-label="Hora"></select></div>
      <button type="button" class="btn sm" data-act="ptSueAdd">+ Agregar fecha</button></div>
    <div id="pt_prev" class="gh-prev"></div>
    <label class="f"><span>Notas (opcional)</span><textarea id="pt_notas">${esc(x.notas||'')}</textarea></label>
    <div class="btns"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="savePT" data-id="${esc(id||'')}">Guardar</button></div>
    ${(id&&(!coach||!ptSes(x).length))?`<div class="btns"><button class="btn danger" data-act="delPT" data-id="${esc(id)}">Eliminar personalizado</button></div>`:''}`);
  ptFormPintar();
}
const ptFormProf = () => isProf()?session.profId:(($('#pt_prof')||{}).value||'');
function ptFormTmp(){                                         // paquete como quedaría con lo que hay en la ventana + citas que se conservan
  const aid=curArea(), id=ptForm.id, prev=id?(getPath(`data/${aid}/paquetes/${id}`)||{}):{}, prof=ptFormProf();
  const tmp={...prev,id:id||'nuevo',profId:prof,total:parseInt(($('#pt_tot')||{}).value)||0,inicio:($('#pt_ini')||{}).value,slots:{...ptForm.slots}};
  const base=(id?ptBase(prev,prof!==prev.profId):[]).concat(ptForm.sueltas.map(ptLimpia));
  return {aid,prev,tmp,base};
}
function ptFormPintar(){
  const aid=curArea(); if(!ptForm||!$('#pt_rep')) return;
  const R=Object.values(ptForm.slots).sort((a,b)=>(a.d-b.d)||(a.h-b.h));
  $('#pt_rep').innerHTML=R.length?R.map(s=>`<span class="gh-chip">${DIAS[s.d]} ${hh(s.h)}<button type="button" data-act="ptRepDel" data-k="${ghKey(s.d,s.h)}" aria-label="Quitar">${ic('x')}</button></span>`).join(''):'<small class="mut">Sin horario que se repite.</small>';
  $('#pt_sue').innerHTML=ptForm.sueltas.length?ptForm.sueltas.slice().sort(ctOrd).map(c=>`<span class="gh-chip">${esc(ctTxt(c))}<button type="button" data-act="ptSueDel" data-id="${esc(c.id)}" aria-label="Quitar">${ic('x')}</button></span>`).join(''):'<small class="mut">Sin fechas sueltas.</small>';
  const rd=+($('#pt_rd')||{}).value||0, rh=$('#pt_rh'), dd=gimDia(aid,rd), hs=[]; for(let h=dd?dd.abre:5;h<(dd?dd.cierra:23);h++) hs.push(h);
  if(rh){ const k=rh.value; rh.innerHTML=hs.length?ptHoraOpts(hs,k||hs[0]):'<option value="">El gimnasio no abre</option>'; }
  ptFormHorasSuelta(); ptFormPreview();
}
function ptFormHorasSuelta(){
  const aid=curArea(), sh=$('#pt_sh'), f=($('#pt_sf')||{}).value; if(!sh) return;
  const {tmp,base}=ptFormTmp(), ctx=ghCtx(aid,tmp.id), propias=new Set(base.map(c=>ctKey(c.f,c.h))), dis={}, hs=f?gimHorasDia(aid,f):[];
  hs.forEach(h=>{ if(!ctLibre(f,h)) dis[h]='ya pasó'; else if(propias.has(ctKey(f,h))) dis[h]='ya agendada'; else if(ctx.occ[`${tmp.profId}|${f}|${h}`]) dis[h]='ocupado'; });
  const k=sh.value, first=hs.find(h=>!dis[h]);
  sh.innerHTML=hs.length?ptHoraOpts(hs,(k&&!dis[k])?k:first,dis):'<option value="">El gimnasio no abre</option>';
}
function ptFormPreview(){
  const el=$('#pt_prev'); if(!el||!ptForm) return;
  const {aid,tmp,base}=ptFormTmp(), fin=($('#pt_fin')||{}).value, out=[];
  if(!tmp.total||!tmp.inicio){ el.innerHTML=''; return; }
  const R=ptLlenar(aid,tmp,base), now=ahoraKey(), fut=R.citas.filter(c=>ctKey(c.f,c.h)>now);
  if(fut.length) out.push(`<small><b>${plu(fut.length,'sesión agendada','sesiones agendadas')}</b>: la primera el <b>${esc(ctTxt(fut[0]))}</b> y la última el <b>${esc(fmtFecha(fut[fut.length-1].f))}</b>.</small>`);
  if(R.faltan>0) out.push(`<small class="warn">${plu(R.faltan,'sesión queda','sesiones quedan')} sin fecha: puedes agendarlas después con “+ Agendar sesión”.</small>`);
  if(R.saltadas.length) out.push(`<small class="warn">Se brincan ${plu(R.saltadas.length,'fecha','fechas')} en que ya tienes otro cliente: ${esc(R.saltadas.slice(0,3).map(x=>ctTxt(x)).join(', '))}${R.saltadas.length>3?'…':''}.</small>`);
  const ult=fut.length?fut[fut.length-1].f:'';
  if(fin&&ult&&ult>fin) out.push(`<small class="bad">La última sesión cae después del vencimiento (${esc(fmtCorta(fin))}). <button type="button" class="btn sm" data-act="ptAjustaFin" data-f="${ult}">Vencer el ${esc(fmtCorta(ult))}</button></small>`);
  el.innerHTML=out.join('');
}

/* ---------- agendar una sesión que quedó sin fecha ---------- */
function ctNueva(pkId){
  const aid=curArea(), pk=getPath(`data/${aid}/paquetes/${pkId}`); if(!pk||!ptPuedeMover(pkId)) return;
  if(!ptMapa(pk).sinAgendar){ toast('Todas las sesiones ya tienen fecha'); return; }
  const t=todayStr(); rgCtx={pkId,cid:'',from:'',nueva:true};
  openModal(`${mHead('Agendar sesión')}
    <div class="sub">${esc(pk.cliente||'Cliente')} · ${plu(ptMapa(pk).sinAgendar,'sesión sin fecha','sesiones sin fecha')}</div>
    <div class="two"><label class="f"><span>Fecha</span><input id="rg_f" type="date" min="${t}"${pk.fin?` max="${esc(pk.fin)}"`:''} value="${t}"></label>
      <label class="f"><span>Hora</span><select id="rg_h"></select></label></div>
    <div id="rg_av"></div>
    <div class="btns"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="ctNuevaGuardar">Agendar</button></div>`);
  rgFillHoras();
}

Object.assign(actions,{
  openPT(d){ if(roDatos(curArea())) return; closeModal(); openPT(d.id||'',{prof:d.prof}); },
  ptRepAdd(){
    const d=+$('#pt_rd').value, h=$('#pt_rh').value; if(h===''){ toast('El gimnasio no abre ese día'); return; }
    ptForm.slots[ghKey(d,+h)]={d,h:+h}; ptFormPintar();
  },
  ptRepDel(d){ delete ptForm.slots[d.k]; ptFormPintar(); },
  ptSueAdd(){
    const f=$('#pt_sf').value, h=parseInt($('#pt_sh').value,10), fin=($('#pt_fin')||{}).value;
    if(!f||isNaN(h)){ toast('Elige la fecha y una hora libre'); return; }
    if(!ctLibre(f,h)){ toast('Esa fecha y hora ya pasaron'); return; }
    if(fin&&f>fin){ toast(`Queda después del vencimiento (${fmtCorta(fin)})`); return; }
    const {aid,tmp,base}=ptFormTmp();
    if(base.some(c=>c.f===f&&+c.h===h)){ toast('Esa fecha y hora ya están agendadas'); return; }
    const oc=ghCtx(aid,tmp.id).occ[`${tmp.profId}|${f}|${h}`]; if(oc){ toast(`A esa hora ya tienes a ${oc.cliente||'otro cliente'}`); return; }
    ptForm.sueltas.push({id:'c'+uid(),f,h,suelta:true}); ptFormPintar();
  },
  ptSueDel(d){ ptForm.sueltas=ptForm.sueltas.filter(c=>c.id!==d.id); ptFormPintar(); },
  ptAjustaFin(d){ const f=$('#pt_fin'); if(f){ f.value=d.f; ptFormPreview(); } },
  savePT(d){
    const aid=curArea(); if(roDatos(aid)||!ptForm) return;
    const cli=$('#pt_cli').value.trim(), tot=parseInt($('#pt_tot').value)||0, ini=$('#pt_ini').value, fin=$('#pt_fin').value, prof=ptFormProf(), t=todayStr();
    const id=d.id||('pt'+uid()), prev=d.id?(getPath(`data/${aid}/paquetes/${id}`)||{}):{}, nuevo=!d.id, usadas=ptReal(prev);
    if(isProf()&&!nuevo&&prev.profId!==session.profId) return;
    if(!prof){ toast('Elige al instructor'); return; }
    if(!cli){ toast('Escribe el nombre del cliente'); return; }
    if(tot<1){ toast('Indica cuántas sesiones se contrataron'); return; }
    if(tot<usadas){ toast(`Ya se usaron ${usadas} sesiones: no se puede contratar menos`); return; }
    if(!ini||!fin||fin<ini){ toast('Revisa las fechas de inicio y vencimiento'); return; }
    if((nuevo||ini!==prev.inicio)&&ini<t){ toast('El inicio no puede ser una fecha que ya pasó'); return; }
    const slots={...ptForm.slots}, profCambia=!nuevo&&prof!==prev.profId;
    const cambia=nuevo||profCambia||tot!==(+prev.total||0)||ini!==prev.inicio||ghSlotsKey(slots)!==ghSlotsKey(prev.slots)||ptForm.sueltas.length>0;
    let citas=prev.citas||null, R=null;
    if(cambia){
      const tmp={...prev,id,profId:prof,total:tot,inicio:ini,slots};
      R=ptLlenar(aid,tmp,(nuevo?[]:ptBase(prev,profCambia)).concat(ptForm.sueltas.map(ptLimpia)));
      const fut=R.citas.filter(c=>ctKey(c.f,c.h)>ahoraKey()), ult=fut.length?fut[fut.length-1].f:'';
      if(ult&&ult>fin){ toast(`La última sesión queda el ${fmtCorta(ult)}, después del vencimiento. Usa “Vencer el ${fmtCorta(ult)}”`); return; }
      citas=ptCitasMap(R.citas);
    }
    const o={...prev,id,slots,frec:Object.keys(slots).length,profId:prof,cliente:cli,total:tot,monto:+$('#pt_monto').value||0,inicio:ini,fin,notas:$('#pt_notas').value.trim(),por:prev.por||gimQuien(),alta:prev.alta||Date.now()};
    if(citas) o.citas=citas;
    setPath(`data/${aid}/paquetes/${id}`,o);
    const hor=Object.values(slots).sort((a,b)=>(a.d-b.d)||(a.h-b.h)).map(x=>DIAS[x.d]+' '+hh(x.h)).join(', ');
    const fut=R?R.citas.filter(c=>ctKey(c.f,c.h)>ahoraKey()):[], rango=fut.length?` · ${plu(fut.length,'sesión agendada','sesiones agendadas')} del ${ctTxt(fut[0])} al ${fmtFecha(fut[fut.length-1].f)}`:'';
    const sinF=R&&R.faltan?` · ${R.faltan} sin fecha`:'', av=!isProf();
    if(nuevo) gimLog(aid,{tipo:'alta',txt:`${cli}: ${tot} sesiones${hor?` (${hor})`:''}${rango}${sinF}`,pk:id,prof,aviso:av});
    else if(profCambia){
      gimLog(aid,{tipo:'reasigna',txt:`${cli}: se te asignó${rango}`,pk:id,prof,aviso:true});
      gimLog(aid,{tipo:'reasigna',txt:`${cli}: pasó a ${(getProf(aid,prof)||{}).nombre||'otro instructor'}`,pk:id,prof:prev.profId,aviso:true});
    } else if(cambia) gimLog(aid,{tipo:'cambio',txt:`${cli}: ${tot} sesiones${hor?` (${hor})`:''}${rango}${sinF}`,pk:id,prof,aviso:av});
    else if(cli!==prev.cliente||fin!==prev.fin||o.notas!==(prev.notas||'')||o.monto!==(+prev.monto||0)) gimLog(aid,{tipo:'edicion',txt:`${cli}: datos actualizados${fin!==prev.fin?` · vence el ${fmtCorta(fin)}`:''}`,pk:id,prof,aviso:av&&(fin!==prev.fin||cli!==prev.cliente)});
    if(ptForm.solId){ const s=getPath(`data/${aid}/solicitudes/${ptForm.solId}`); if(s) setPath(`data/${aid}/solicitudes/${ptForm.solId}`,{...s,estado:'atendida',atendida:Date.now(),pk:id}); }
    ptForm=null; closeModal(); render();
    toast(nuevo?(fut.length?`Personalizado guardado: primera sesión el ${ctTxt(fut[0])}`:'Personalizado guardado'):'Personalizado guardado');
  },
  delPT(d){
    const aid=curArea(), pkx=getPath(`data/${aid}/paquetes/${d.id}`)||{}; if(roDatos(aid)) return;
    if(isProf()&&(pkx.profId!==session.profId||ptSes(pkx).length)){ toast('Ya tiene sesiones registradas: solo la dirección puede eliminarlo'); return; }
    if(!confirm('¿Eliminar este personalizado y sus sesiones?')) return;
    setPath(`data/${aid}/paquetes/${d.id}`,undefined);
    if(pkx.profId) gimLog(aid,{tipo:'baja',txt:`${pkx.cliente||'Cliente'}: se eliminó el personalizado (${ptReal(pkx)} de ${+pkx.total||0} sesiones usadas)`,prof:pkx.profId,aviso:!isProf()});
    ptForm=null; closeModal(); render(); toast('Personalizado eliminado');
  },
  ctNueva(d){ ctNueva(d.pk); },
  ctNuevaGuardar(){
    const aid=curArea(); if(!rgCtx||!rgCtx.nueva||!ptPuedeMover(rgCtx.pkId)) return;
    const pk=getPath(`data/${aid}/paquetes/${rgCtx.pkId}`), f=$('#rg_f').value, h=parseInt($('#rg_h').value,10);
    if(!pk||!ptMapa(pk).sinAgendar){ toast('Todas las sesiones ya tienen fecha'); return; }
    if(!f||isNaN(h)){ toast('Elige la fecha y una hora libre'); return; }
    if(!ctLibre(f,h)){ toast('Esa fecha y hora ya pasaron'); return; }
    if(pk.fin&&f>pk.fin){ toast(`Queda después del vencimiento (${fmtCorta(pk.fin)}). Amplíalo en “Editar”`); return; }
    const o=rgOpciones(aid,pk,'',f).find(x=>x.h===h); if(!o||!o.ok){ toast(o?`Esa hora no está libre: ${o.por}`:'El gimnasio no abre a esa hora'); return; }
    const L=ptCitas(pk).map(ptLimpia); L.push({id:'c'+uid(),f,h,suelta:true});
    setPath(`data/${aid}/paquetes/${rgCtx.pkId}/citas`,ptCitasMap(L));
    gimLog(aid,{tipo:'agenda',txt:`${pk.cliente||'Cliente'}: ${ctTxt({f,h})}`,pk:rgCtx.pkId,prof:pk.profId,aviso:!isProf()});
    rgCtx=null; closeModal(); render(); toast(`Sesión agendada el ${ctTxt({f,h})}`);
  },
  solNueva(d){ if(roDatos(curArea())||isProf()) return; solNueva(d.prof,d.f,d.h); },
  solGuardar(d){
    const aid=curArea(); if(roDatos(aid)||isProf()) return;
    const cli=$('#sl_cli').value.trim(), p=getProf(aid,d.prof); if(!cli){ toast('Escribe el nombre del socio'); return; } if(!p) return;
    const nota=$('#sl_nota').value.trim().replace(/(\+?\d[\d\s\-().]{7,}\d)/g,'[teléfono en recepción]');      // los teléfonos no viajan: se quedan en recepción
    const id='sl'+uid(); setPath(`data/${aid}/solicitudes/${id}`,{id,ts:Date.now(),profId:p.id,cliente:cli,nota,f:d.f,h:+d.h,por:gimQuien(),estado:'nueva'});
    gimLog(aid,{tipo:'solicitud',txt:`${cli} solicita personalizados (vio libre ${ctTxt({f:d.f,h:+d.h})})${nota?' · '+nota:''}`,prof:p.id});
    closeModal(); render(); toast(`Solicitud enviada a ${p.nombre}`);
  },
  solVista(d){ const aid=curArea(), s=getPath(`data/${aid}/solicitudes/${d.id}`); if(!s||!isProf()||s.profId!==session.profId) return; setPath(`data/${aid}/solicitudes/${d.id}`,{...s,estado:'vista',vista:Date.now()}); render(); },
  solAtendida(d){ const aid=curArea(), s=getPath(`data/${aid}/solicitudes/${d.id}`); if(!s||!isProf()||s.profId!==session.profId) return; setPath(`data/${aid}/solicitudes/${d.id}`,{...s,estado:'atendida',vista:s.vista||Date.now(),atendida:Date.now()}); render(); toast('Solicitud marcada como atendida'); },
  solRegistrar(d){
    const aid=curArea(), s=getPath(`data/${aid}/solicitudes/${d.id}`); if(!s||!isProf()||s.profId!==session.profId) return;
    if(s.estado==='nueva') setPath(`data/${aid}/solicitudes/${d.id}`,{...s,estado:'vista',vista:Date.now()});
    openPT('',{cliente:s.cliente,solId:s.id});
  },
  solBorrar(d){ const aid=curArea(), s=getPath(`data/${aid}/solicitudes/${d.id}`); if(!s||s.estado!=='nueva'||isProf()||roDatos(aid)) return; if(!confirm('¿Cancelar esta solicitud?')) return; setPath(`data/${aid}/solicitudes/${d.id}`,undefined); render(); }
});
document.addEventListener('change',e=>{
  const id=e.target&&e.target.id; if(!ptForm||!$('#pt_rep')) return;
  if(id==='pt_rd'||id==='pt_prof') ptFormPintar();
  else if(id==='pt_sf') ptFormHorasSuelta();
  else if(['pt_ini','pt_fin','pt_tot'].includes(id)) ptFormPreview();
});
document.addEventListener('input',e=>{ const id=e.target&&e.target.id; if(ptForm&&$('#pt_rep')&&(id==='pt_tot'||id==='pt_fin')) ptFormPreview(); });
