'use strict';
/* =====================================================================
   gimpersonal.js — Gimnasio: el INSTRUCTOR registra y agenda sus personalizados;
   RECEPCIÓN solo ve el horario y le manda solicitudes.

   · Recepción ve el horario semanal (quién está libre a qué hora). Si llega un socio, toca la hora,
     elige a un instructor libre y le manda una solicitud: “Fulano solicita clases”. No se capturan
     teléfonos: el instructor pasa a recepción y ahí se hace el contacto.
   · El instructor ve la solicitud en su pantalla (Enterado · Registrar personalizado · Ya lo atendí)
     y registra el personalizado él mismo, con libertad de agenda, en un calendario por semanas:
       - toca los días y horas de esta semana y, con ›, sigue en las semanas siguientes (ej. 10 sesiones, 3 por semana);
       - “Repetir estas horas cada semana” acomoda solas las que falten en las mismas horas;
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
let ptForm = null;                                           // {id, sel:{'f_h':cita}, base:[citas que se conservan], rep, w:lunes de la semana a la vista, solId, k0}
const PT_SEMANAS = 26;                                       // hasta cuántas semanas adelante se puede agendar en el calendario
function openPT(id,o){
  o=o||{}; const aid=curArea(), x=id?(getPath(`data/${aid}/paquetes/${id}`)||{}):{}, t=todayStr(), coach=isProf();
  if(id&&coach&&x.profId!==session.profId) return;
  if(!id&&!coach){ toast('Los personalizados los registra cada instructor desde su pantalla'); return; }
  const ps=profesores(aid).filter(p=>p.activo!==false), usadas=ptReal(x), iniFijo=!!id&&(usadas>0||ptSes(x).length>0), ini0=x.inicio||t, now=ahoraKey();
  const ag=id?ptMapa(x).ag:[], sel={};
  ag.filter(c=>!c.reg&&ctKey(c.f,c.h)>now).forEach(c=>{ sel[`${c.f}_${+c.h}`]=ptLimpia(c); });      // las futuras se pueden mover en el calendario
  ptForm={id:id||'',sel,base:ag.filter(c=>c.reg||ctKey(c.f,c.h)<=now).map(ptLimpia),rep:ghSlots(x).length>0,w:mondayOf(Object.values(sel).map(c=>c.f).sort()[0]||(ini0>t?ini0:t)),solId:o.solId||'',k0:Object.keys(sel).sort().join(',')};
  openModal(`${mHead(id?'Editar personalizado':'Nuevo personalizado')}
    ${coach?'':`<label class="f"><span>Instructor</span><select id="pt_prof">${ps.map(p=>`<option value="${esc(p.id)}"${x.profId===p.id?' selected':''}>${esc(p.nombre)}</option>`).join('')}</select></label>`}
    <label class="f"><span>Cliente</span><input id="pt_cli" value="${esc(x.cliente||o.cliente||'')}" placeholder="Nombre del socio" autocomplete="off"></label>
    <div class="two"><label class="f"><span>Sesiones contratadas</span><input id="pt_tot" type="number" inputmode="numeric" min="${Math.max(1,usadas)}" value="${esc(x.total||12)}"></label>
      <label class="f"><span>Monto (opcional)</span><input id="pt_monto" type="number" inputmode="numeric" min="0" value="${esc(x.monto||'')}" placeholder="$"></label></div>
    ${usadas?`<small class="mut">Ya se usaron ${usadas} sesiones: no se puede contratar menos.</small>`:''}
    <div class="two"><label class="f"><span>Inicio</span><input id="pt_ini" type="date"${iniFijo?' disabled':` min="${t}"`} value="${esc(ini0)}"></label>
      <label class="f"><span>Vence</span><input id="pt_fin" type="date" value="${esc(x.fin||addDays(ini0,60))}"></label></div>
    <div class="f pt-ag"><span class="lb">Días y horas</span>
      <div id="pt_cal"></div>
      <label class="pt-rep"><input type="checkbox" id="pt_rep"${ptForm.rep?' checked':''}> <span>Repetir estas horas cada semana hasta completar las sesiones</span></label>
      <small class="mut">Toca las horas de la semana y usa › para seguir en la siguiente. Puedes elegir cualquier hora en que abre el gimnasio, aunque no esté en tu horario. Las que no agendes quedan sin fecha y se agendan después con “+ Agendar sesión”.</small></div>
    <div id="pt_prev" class="gh-prev"></div>
    <label class="f"><span>Notas (opcional)</span><textarea id="pt_notas">${esc(x.notas||'')}</textarea></label>
    <div class="btns"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="savePT" data-id="${esc(id||'')}">Guardar</button></div>
    ${(id&&(!coach||!ptSes(x).length))?`<div class="btns"><button class="btn danger" data-act="delPT" data-id="${esc(id)}">Eliminar personalizado</button></div>`:''}`);
  ptFormPintar();
}
const ptFormProf = () => isProf()?session.profId:(($('#pt_prof')||{}).value||'');
const ptSelLista = () => Object.values(ptForm.sel).sort(ctOrd);
function ptSelSlots(){                                        // “Repetir”: el patrón semanal de las horas elegidas
  const o={}; if(ptForm.rep) ptSelLista().forEach(c=>{ const d=wdIdx(c.f); o[ghKey(d,+c.h)]={d,h:+c.h}; }); return o;
}
function ptFormTmp(){                                         // paquete como quedaría con lo que hay en la ventana
  const aid=curArea(), id=ptForm.id, prev=id?(getPath(`data/${aid}/paquetes/${id}`)||{}):{}, prof=ptFormProf();
  const tmp={...prev,id:id||'nuevo',profId:prof,total:parseInt(($('#pt_tot')||{}).value)||0,inicio:($('#pt_ini')||{}).value,slots:ptSelSlots()};
  const sel=ptSelLista(), base=ptForm.base.concat(sel);
  const ult=sel.length?sel[sel.length-1].f:'', llenar={...tmp,inicio:ult&&addDays(ult,1)>tmp.inicio?addDays(ult,1):tmp.inicio};     // lo que se repite empieza después de la última hora elegida
  return {aid,prev,tmp,base,llenar};
}
function ptCalCelda(aid,ctx,p,f,h,ini,fin){
  const k=`${f}_${h}`, a=`data-act="ptCal" data-f="${f}" data-h="${h}"`;
  if(ptForm.sel[k]) return `<button type="button" class="gh-c sel" ${a} aria-pressed="true" aria-label="Elegida: ${esc(ctTxt({f,h}))}"><b>✓</b></button>`;
  if(!ctLibre(f,h)||(ini&&f<ini)||(fin&&f>fin)) return '<span class="gh-c off"></span>';
  if(ptForm.base.some(c=>c.f===f&&+c.h===h)) return '<span class="gh-c sel" aria-label="Ya agendada"><b>✓</b></span>';
  const oc=ctx.occ[`${p.id}|${f}|${h}`];
  if(oc&&oc.bloqueo) return `<span class="gh-c mio" aria-label="Bloqueada"><b>Mío</b></span>`;
  if(oc) return `<span class="gh-c yo" aria-label="Otro socio"><small>${esc(String(oc.cliente||'Socio').split(' ')[0])}</small></span>`;
  return ghEnHorario(p,f,h)?`<button type="button" class="gh-c ok" ${a} aria-label="${esc(ctTxt({f,h}))}, en tu horario"><b>+</b></button>`:`<button type="button" class="gh-c fh" ${a} aria-label="${esc(ctTxt({f,h}))}, fuera de tu horario">·</button>`;
}
function ptFormPintar(){
  const el=$('#pt_cal'); if(!ptForm||!el) return;
  const {aid,tmp,base}=ptFormTmp(), t=todayStr(), ini=tmp.inicio||t, fin=($('#pt_fin')||{}).value, p=getProf(aid,tmp.profId)||{id:tmp.profId}, gc=gimCfg(aid);
  const w0=mondayOf(ini>t?ini:t), ult=addDays(w0,7*(PT_SEMANAS-1));
  if(ptForm.w<w0) ptForm.w=w0; if(ptForm.w>ult) ptForm.w=ult;
  const w=ptForm.w, ctx=ghCtx(aid,tmp.id), fechas=[0,1,2,3,4,5,6].filter(d=>gimDia(aid,d)).map(d=>addDays(w,d));
  const abre=h=>fechas.some(f=>{ const dd=gimDia(aid,wdIdx(f)); return dd&&h>=dd.abre&&h<dd.cierra; });
  const suya=h=>fechas.some(f=>ptForm.sel[`${f}_${h}`]||ghEnHorario(p,f,h)||ctx.occ[`${p.id}|${f}|${h}`]);     // horas con algo para este instructor esa semana
  const hs=[]; for(let h=gc.abre;h<gc.cierra;h++) if(abre(h)) hs.push(h);
  const solo=!ptForm.todas&&hs.some(suya), vis=solo?hs.filter(suya):hs;
  const filas=[]; for(const h of vis){
    filas.push(`<tr><th>${hh(h)}</th>${fechas.map(f=>{ const dd=gimDia(aid,wdIdx(f)); return `<td>${(!dd||h<dd.abre||h>=dd.cierra)?'<span class="gh-c off"></span>':ptCalCelda(aid,ctx,p,f,h,ini,fin)}</td>`; }).join('')}</tr>`);
  }
  el.innerHTML=`<div id="pt_cont" class="pt-cont"></div>
    <div class="calnav"><button type="button" class="ibtn" data-act="ptCalNav" data-n="-1" aria-label="Semana anterior"${w<=w0?' disabled':''}>${ic('back')}</button><b>${esc(fmtCorta(w))} – ${esc(fmtCorta(addDays(w,6)))}${w===mondayOf(t)?' · esta semana':''}</b><button type="button" class="ibtn" data-act="ptCalNav" data-n="1" aria-label="Semana siguiente"${w>=ult?' disabled':''}>${ic('next')}</button></div>
    <div class="gh-wrap"><table class="gh-tb mih pt-cal"><thead><tr><th></th>${fechas.map(f=>`<th class="${f===t?'hoy':''}">${DIAS[wdIdx(f)]}<small>${+f.slice(8,10)}</small></th>`).join('')}</tr></thead><tbody>${filas.join('')}</tbody></table></div>
    <div class="gh-leg"><span><i class="sel"></i>Elegida</span><span><i class="ok"></i>Tu horario</span><span><i class="fh"></i>Fuera de tu horario</span><span><i class="yo"></i>Otro socio</span><span><i class="mio"></i>Mío</span></div>
    ${(solo||ptForm.todas)?`<button type="button" class="btn sm" data-act="ptCalTodas">${ptForm.todas?'Ver solo las horas de mi horario':'Ver todas las horas del gimnasio'}</button>`:''}`;
  ptFormCont();
}
function ptFormCont(){                                       // contador: se actualiza sin volver a dibujar el calendario (así no se pierde un toque)
  const el=$('#pt_cont'); if(!el||!ptForm) return;
  const {tmp,base}=ptFormTmp(), w=ptForm.w, esta=ptSelLista().filter(c=>c.f>=w&&c.f<=addDays(w,6)).length, falt=tmp.total?ptMapa(tmp,base).sinAgendar:0;
  el.innerHTML=`<span><b>${Math.max(0,(tmp.total||0)-falt)}</b> de ${tmp.total||0} sesiones elegidas${ptForm.rep&&falt?' · las demás se repiten solas':''}</span><span>${esta} en esta semana</span>`;
  ptFormPreview();
}
function ptFormPreview(){
  const el=$('#pt_prev'); if(!el||!ptForm) return;
  const {aid,tmp,base,llenar}=ptFormTmp(), fin=($('#pt_fin')||{}).value, out=[], sel=ptSelLista();
  if(!tmp.total||!tmp.inicio){ el.innerHTML=''; return; }
  const R=ptLlenar(aid,llenar,base), now=ahoraKey(), fut=R.citas.filter(c=>ctKey(c.f,c.h)>now);
  if(!sel.length&&!fut.length) out.push('<small class="mut">Aún no eliges horas: toca el calendario.</small>');
  if(fut.length) out.push(`<small><b>${plu(fut.length,'sesión agendada','sesiones agendadas')}</b>: la primera el <b>${esc(ctTxt(fut[0]))}</b> y la última el <b>${esc(fmtFecha(fut[fut.length-1].f))}</b>.</small>`);
  if(R.faltan>0) out.push(`<small class="warn">${plu(R.faltan,'sesión queda','sesiones quedan')} sin fecha: ${ptForm.rep?'no hubo lugar en las semanas siguientes. ':'avanza de semana con › y elige más, marca “Repetir”, o '}agéndalas después con “+ Agendar sesión”.</small>`);
  if(R.saltadas.length) out.push(`<small class="warn">Al repetir se brincan ${plu(R.saltadas.length,'fecha','fechas')} en que ya tienes otro cliente: ${esc(R.saltadas.slice(0,3).map(x=>ctTxt(x)).join(', '))}${R.saltadas.length>3?'…':''}.</small>`);
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
  ptCal(d){                                                 // toca una hora del calendario: la elige o la quita
    if(!ptForm) return; const f=d.f, h=+d.h, k=`${f}_${h}`;
    if(ptForm.sel[k]){ delete ptForm.sel[k]; ptFormPintar(); return; }
    if(!ctLibre(f,h)){ toast('Esa fecha y hora ya pasaron'); return; }
    const {aid,tmp,base}=ptFormTmp();
    if(!tmp.total){ toast('Primero indica cuántas sesiones se contrataron'); return; }
    if(ptMapa(tmp,base).sinAgendar<=0){ toast(`Ya elegiste las ${tmp.total} sesiones. Quita una para cambiarla`); return; }
    const oc=ghCtx(aid,tmp.id).occ[`${tmp.profId}|${f}|${h}`]; if(oc){ toast(oc.bloqueo?'Esa hora está bloqueada':`A esa hora ya tienes a ${oc.cliente||'otro cliente'}`); return; }
    ptForm.sel[k]={id:'c'+uid(),f,h,suelta:true}; ptFormPintar();
  },
  ptCalTodas(){ if(!ptForm) return; ptForm.todas=!ptForm.todas; ptFormPintar(); },
  ptCalNav(d){ if(!ptForm) return; ptForm.w=addDays(ptForm.w,7*(+d.n)); ptFormPintar(); },
  ptAjustaFin(d){ const f=$('#pt_fin'); if(f){ f.value=d.f; ptFormPintar(); } },
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
    const slots=ptSelSlots(), profCambia=!nuevo&&prof!==prev.profId, sel=ptSelLista();
    if(sel.some(c=>c.f<ini)){ toast('Hay horas elegidas antes del inicio: quítalas o cambia el inicio'); return; }
    const occ=ghCtx(aid,id).occ, choca=sel.find(c=>ctKey(c.f,c.h)>ahoraKey()&&occ[`${prof}|${c.f}|${c.h}`]);
    if(choca){ toast(`El ${ctTxt(choca)} ese instructor ya está ocupado: quita esa hora`); return; }
    const cambia=nuevo||profCambia||tot!==(+prev.total||0)||ini!==prev.inicio||ghSlotsKey(slots)!==ghSlotsKey(prev.slots)||Object.keys(ptForm.sel).sort().join(',')!==ptForm.k0;
    let citas=prev.citas||null, R=null;
    if(cambia){
      const tmp={...prev,id,profId:prof,total:tot,inicio:ini,slots}, ult0=sel.length?sel[sel.length-1].f:'';
      R=ptLlenar(aid,{...tmp,inicio:ult0&&addDays(ult0,1)>ini?addDays(ult0,1):ini},ptForm.base.concat(sel).map(ptLimpia));
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
  const id=e.target&&e.target.id; if(!ptForm||!$('#pt_cal')) return;
  if(id==='pt_rep'){ ptForm.rep=e.target.checked; ptFormPintar(); }
  else if(['pt_prof','pt_ini','pt_fin'].includes(id)) ptFormPintar();
  else if(id==='pt_tot') ptFormCont();
});
document.addEventListener('input',e=>{ const id=e.target&&e.target.id; if(ptForm&&$('#pt_cal')&&id==='pt_tot') ptFormCont(); });
