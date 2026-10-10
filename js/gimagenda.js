'use strict';
/* =====================================================================
   gimagenda.js — Gimnasio: agenda real de los personalizados.

   Cada personalizado guarda sus CITAS con fecha y hora, armadas con el horario fijo del cliente:
   · data/<área>/paquetes/<id>.frec     sesiones por semana que contrató el cliente (= horarios fijos que hay que elegir)
   · data/<área>/paquetes/<id>.citas    {cId:{id,f:'2026-10-12',h:16, orig:{f,h}, reag:1, repo:true, por, ts}}
   · data/<área>/paquetes/<id>/sesiones/<sId>.cita   la cita que se registra (realizada, no asistió o cancelada)
   · data/<área>/gimlog/<id>            bitácora del área: {id,ts,tipo,txt,pk,prof,por,rol,aviso,visto}

   REGLAS
   · Nada se agenda antes de la fecha y la hora actuales (ni el alta, ni un reagendado, ni una reposición).
   · Una cita solo se registra cuando ya empezó su hora; antes solo se puede reagendar o cancelar.
   · “Realizada” y “No asistió” descuentan; “Cancelada” (por el cliente con aviso o por el instructor) no descuenta
     y se repone sola al final, en el horario fijo del cliente.
   · El instructor no puede tener dos citas a la misma hora: lo ocupado se brinca o no se deja elegir.
   · Recepción reagenda o cancela; el instructor recibe el aviso y marca “Enterado”; la dirección ve todo en la bitácora.
   Paquetes anteriores (sin .citas): la agenda se calcula con el horario fijo desde el inicio, como antes,
   y se guarda como citas la primera vez que se edita su horario, se reagenda o se cancela una sesión.
   ===================================================================== */
const PT_DESC = ['realizada','falta'];                                   // resultados que descuentan una sesión del paquete
const ptRepone = e => /^cancelada/.test(String(e||''));                 // cancelada: no descuenta y se repone
const PT_E = {realizada:'Realizada',falta:'No asistió (se descuenta)','cancelada por el cliente':'Cancelada por el cliente (se repone)','cancelada por el instructor':'Cancelada por el instructor (se repone)'};
const PT_ECORTO = {realizada:'Realizada',falta:'No asistió','cancelada por el cliente':'Cancelada (cliente)','cancelada por el instructor':'Cancelada (instructor)'};
const ctKey = (f,h) => `${f} ${pad(h)}`;
const ahoraKey = () => ctKey(todayStr(),new Date().getHours());
const ctOrd = (a,b) => ctKey(a.f,a.h).localeCompare(ctKey(b.f,b.h));
const ctLibre = (f,h) => ctKey(f,h) > ahoraKey();                       // se puede agendar: esa hora todavía no empieza
const ctTxt = c => `${DIAS[wdIdx(c.f)]} ${fmtCorta(c.f)} · ${hh(+c.h)}`;
const fmtTs = ts => { const d=new Date(ts||0); return `${fmtCorta(ymd(d))} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
function ptLimpia(c){ const o={id:c.id,f:c.f,h:+c.h}; ['orig','reag','repo','por','ts'].forEach(k=>{ if(c[k]!=null&&c[k]!=='') o[k]=c[k]; }); return o; }
const ptCitasMap = L => Object.fromEntries(L.map(c=>[c.id,ptLimpia(c)]));

/* ---------- agenda de un paquete ---------- */
function ptCitas(pk){
  if(pk&&pk.citas&&typeof pk.citas==='object') return Object.values(pk.citas).filter(c=>c&&c.f&&c.h!=null).map(c=>({...c,h:+c.h})).sort(ctOrd);
  return ghSesiones(pk||{}).map(s=>({id:`b${s.f.replace(/-/g,'')}_${s.h}`,f:s.f,h:s.h}));       // paquete anterior: se calcula
}
/* Une cada cita con su registro y le pone estado. Devuelve {ag, sueltas (registros fuera de agenda), sinAgendar}.
   Si sobran citas (p. ej. se registró una sesión fuera de agenda), se quitan las últimas que aún no ocurren. */
function ptMapa(pk,lista){
  const S=ptSes(pk||{}), usados=new Set(), now=ahoraKey(), t=todayStr();
  let ag=(lista||ptCitas(pk)).map(c=>{
    const r=S.find(s=>s.cita===c.id&&!usados.has(s.id))||S.find(s=>!s.cita&&!usados.has(s.id)&&s.f===c.f&&(!s.h||parseInt(s.h,10)===+c.h));
    if(r) usados.add(r.id);
    const k=ctKey(c.f,c.h);
    return {...c,h:+c.h,reg:r||null,st:r?r.e:(k<now?'sin registrar':k===now?'en curso':c.f===t?'hoy':'programada')};
  });
  const sueltas=S.filter(s=>!usados.has(s.id)), tot=+(pk&&pk.total)||0;
  const cuenta=()=>ag.filter(c=>!(c.reg&&ptRepone(c.reg.e))).length+sueltas.filter(s=>PT_DESC.includes(s.e)).length;
  let sobra=cuenta()-tot;
  for(let i=ag.length-1;i>=0&&sobra>0;i--){ const c=ag[i]; if(!c.reg&&ctKey(c.f,c.h)>now){ ag.splice(i,1); sobra--; } }
  return {ag,sueltas,sinAgendar:Math.max(0,tot-cuenta())};
}
const ptAgenda = pk => ptMapa(pk).ag;
const ctCuenta = c => !(c.reg&&ptRepone(c.reg.e));                       // ocupa lugar en la agenda del instructor

/* Agrega citas con el horario fijo hasta completar las contratadas: desde ahora (y no antes del inicio), sin repetir una cita
   que ya está, sin usar la fecha original de una cita reagendada y brincando las fechas en que el instructor ya está ocupado.
   Devuelve {citas, nuevas, saltadas, faltan}. */
function ptLlenar(aid,pk,base){
  const S=ghSlots(pk).map(s=>({d:+s.d,h:+s.h})).sort((a,b)=>a.h-b.h), nuevas=[], saltadas=[];
  let faltan=ptMapa(pk,base).sinAgendar;
  if(!S.length||!faltan||!pk.inicio) return {citas:base.slice().sort(ctOrd),nuevas,saltadas,faltan};
  const ctx=ghCtx(aid,pk.id), ya=new Set(), now=ahoraKey();
  base.forEach(c=>{ ya.add(ctKey(c.f,c.h)); if(c.orig) ya.add(ctKey(c.orig.f,c.orig.h)); });
  let f=pk.inicio>todayStr()?pk.inicio:todayStr();
  for(let i=0;i<800&&faltan>0;i++,f=addDays(f,1)){
    const wd=wdIdx(f);
    for(const s of S){
      if(s.d!==wd||faltan<=0) continue;
      const k=ctKey(f,s.h); if(k<=now||ya.has(k)) continue;
      const oc=ctx.occ[`${pk.profId}|${f}|${s.h}`];
      if(oc){ saltadas.push({f,h:s.h,quien:oc.cliente||'otro cliente'}); continue; }
      nuevas.push({id:'c'+uid()+nuevas.length,f,h:s.h}); ya.add(k); faltan--;
    }
  }
  return {citas:base.concat(nuevas).sort(ctOrd),nuevas,saltadas,faltan};
}
/* citas que se conservan al cambiar el horario: las que ya empezaron o tienen registro, y las reagendadas a mano (si sigue el mismo instructor) */
function ptBase(pk,profCambia){
  const now=ahoraKey();
  return ptMapa(pk).ag.filter(c=>c.reg||ctKey(c.f,c.h)<=now||(c.orig&&!profCambia)).map(ptLimpia);
}
/* después de una cancelación: agrega la reposición al final. Devuelve las citas nuevas. */
function ptReponer(aid,pkId){
  const pk=getPath(`data/${aid}/paquetes/${pkId}`); if(!pk) return [];
  const R=ptLlenar(aid,pk,ptCitas(pk).map(ptLimpia));
  R.nuevas.forEach(c=>{ c.repo=true; });
  if(R.nuevas.length||!pk.citas) setPath(`data/${aid}/paquetes/${pkId}/citas`,ptCitasMap(R.citas));
  return R.nuevas;
}

/* ---------- bitácora y avisos ---------- */
const LG_T = {alta:['Alta','ok'],cambio:['Cambio de horario','warn'],edicion:['Edición','mut'],reasigna:['Cambio de instructor','warn'],reagenda:['Reagendada','warn'],
  cancelacion:['Cancelación','bad'],reposicion:['Reposición','info'],sesion:['Sesión','ok'],borrado:['Registro borrado','bad'],baja:['Baja','bad']};
function gimQuien(){
  if(!session) return '';
  if(isProf()) return (getProf(session.area,session.profId)||{}).nombre||'Instructor';
  return gimPor()||(session.rol==='ger'?'Gerencia':'');
}
function gimLog(aid,o){                                    // o: {tipo, txt, pk, prof, aviso}
  const id='lg'+uid(), x={id,ts:Date.now(),por:gimQuien(),rol:(session&&session.rol)||'',...o};
  if(!x.aviso) delete x.aviso;
  setPath(`data/${aid}/gimlog/${id}`,x);
}
const gimLogs = aid => coll(aid,'gimlog').sort((a,b)=>(b.ts||0)-(a.ts||0));
function lgFila(aid,l,o){
  o=o||{}; const T=LG_T[l.tipo]||[l.tipo||'Movimiento','mut'], p=l.prof?((getProf(aid,l.prof)||{}).nombre||''):'';
  return `<div class="lg"><div class="lg-h">${pill(T[0],T[1])}<small>${esc(fmtTs(l.ts))}${l.por?' · '+esc(l.por):''}</small></div>
    <div class="lg-t">${esc(l.txt||'')}</div>
    ${(o.prof&&p)?`<small class="mut">Instructor: ${esc(p)}</small>`:''}
    ${(l.aviso&&!o.sinVisto)?`<small class="${l.visto?'ok':'warn'}">${l.visto?`✓ Visto por el instructor el ${esc(fmtTs(l.visto))}`:'El instructor todavía no lo ve'}</small>`:''}</div>`;
}
function gimAvisosProf(aid,pid){
  const L=gimLogs(aid).filter(l=>l.aviso&&l.prof===pid&&!l.visto).reverse();
  if(!L.length) return '';
  return `<div class="h2">Avisos <span class="pill warn">${L.length}</span></div>
    <div class="sub">Cambios que hicieron recepción o la dirección en tus personalizados. Marca “Enterado” para que sepan que ya lo viste.</div>
    ${L.map(l=>`<div class="card lg-av">${lgFila(aid,l,{sinVisto:true})}<div class="btns"><button class="btn primary block" data-act="lgVisto" data-id="${esc(l.id)}">Enterado</button></div></div>`).join('')}
    ${L.length>1?`<div class="btns"><button class="btn block" data-act="lgVistoTodos">Enterado de todos (${L.length})</button></div>`:''}`;
}

/* ---------- filas y estados ---------- */
const CT_ST = {programada:['Programada','mut'],hoy:['Hoy','info'],'en curso':['En curso','info'],'sin registrar':['Sin registrar','bad'],realizada:['Realizada','ok'],falta:['No asistió','warn']};
const ctPill = c => { const s=CT_ST[c.st]||[PT_ECORTO[c.st]||c.st,ptRepone(c.st)?'mut':'']; return pill(s[0],s[1]); };
const ctColor = c => c.st==='realizada'?'var(--ok)':c.st==='sin registrar'?'var(--bad)':c.st==='falta'?'var(--warn)':ptRepone(c.st)?'var(--line-2)':'var(--b2)';
function ctFila(aid,pk,c,o){
  o=o||{}; const p=o.prof?((getProf(aid,pk.profId)||{}).nombre||''):'';
  const extra=[o.fecha?fmtFecha(c.f):'',p,c.orig?`reagendada (antes ${ctTxt(c.orig)})`:'',c.repo?'reposición':''].filter(Boolean).join(' · ');
  return `<button class="line ct" style="--ac:${ctColor(c)}" data-act="ctVer" data-pk="${esc(pk.id)}" data-c="${esc(c.id)}" data-from="${esc(o.from||'')}">
    <div class="t">${hh(c.h)}</div><div class="b"><b>${esc(o.titulo||pk.cliente||'Cliente')}</b>${extra?`<small>${esc(extra)}</small>`:''}</div><div class="r">${ctPill(c)}</div></button>`;
}
/* todas las citas del área (o de un instructor) con su paquete */
function gimCitas(aid,profId){
  const out=[]; coll(aid,'paquetes').forEach(pk=>{ if(profId&&pk.profId!==profId) return; ptMapa(pk).ag.forEach(c=>out.push({pk,c})); });
  return out.sort((a,b)=>ctOrd(a.c,b.c));
}

/* ---------- tarjeta de un personalizado (instructor y dirección) ---------- */
function ptPaqHTML(aid,x,o){
  o=o||{}; const M=ptMapa(x), real=ptReal(x), tot=+x.total||0, est=ptEstado(x), pct=tot?Math.min(100,Math.round(real/tot*100)):0;
  const ro=roDatos(aid)||fcId(x.id), rec=isRec(), vig=ptVigente(x), from=o.from||'';
  const fut=M.ag.filter(c=>!c.reg&&c.st!=='sin registrar'), sinReg=M.ag.filter(c=>c.st==='sin registrar'), prox=fut[0];
  const tarde=x.fin?fut.filter(c=>c.f>x.fin).length:0, lista=sinReg.concat(fut).slice(0,o.prof?3:4);
  const libre=!M.ag.length&&vig&&!ro;                      // sin agenda (paquete anterior sin horario fijo): registro libre
  return `<div class="card ptp"><div class="row"><div><b>${esc(x.cliente||'Cliente')}</b><small>${esc(fmtCorta(x.inicio))} al ${esc(fmtCorta(x.fin))}${(x.monto&&!o.prof)?' · '+esc(mxn(+x.monto)):''}${x.frec?` · ${x.frec} por semana`:''}</small></div>${pill(est,PT_CLS[est])}</div>
    <div class="ptp-b"><div class="bar"><i class="${real>=tot?'info':aforoCls(pct)}" style="width:${pct}%"></i></div><b>${real}/${tot}</b></div>
    <div class="ptp-n"><span><b>${Math.max(0,tot-real)}</b> pendientes</span><span><b>${fut.length}</b> agendadas</span>${sinReg.length?`<span class="bad"><b>${sinReg.length}</b> sin registrar</span>`:''}</div>
    ${prox?`<small>Próxima: <b>${esc(ctTxt(prox))}</b></small>`:''}
    ${(M.sinAgendar&&vig)?`<small class="bad">${plu(M.sinAgendar,'sesión sin fecha','sesiones sin fecha')}: ${o.prof?'pide a recepción que la agende.':'edita el personalizado y elige su horario fijo.'}</small>`:''}
    ${tarde?`<small class="warn">${plu(tarde,'cita queda','citas quedan')} después del vencimiento (${esc(fmtCorta(x.fin))}).</small>`:''}
    ${lista.length?`<div class="ct-list">${lista.map(c=>ctFila(aid,x,c,{from,titulo:fmtFecha(c.f)})).join('')}</div>`:''}
    ${ghSlots(x).length?`<small class="mut">Horario fijo: ${esc(ghSlots(x).sort((a,b)=>(a.d-b.d)||(a.h-b.h)).map(s=>DIAS[s.d]+' '+hh(s.h)).join(' · '))}</small>`:''}
    ${x.notas?`<small class="mut">${esc(x.notas)}</small>`:''}
    ${(x.por&&!o.prof)?`<small class="mut">Dado de alta por ${esc(x.por)}</small>`:''}
    <div class="btns"><button class="btn sm" data-act="ptAgenda" data-id="${esc(x.id)}" data-from="${esc(from)}">Ver agenda</button>
      ${(libre&&(o.prof||(!rec&&!isProf())))?`<button class="btn sm primary" data-act="openSesion" data-id="${esc(x.id)}">+ Registrar sesión</button>`:''}
      ${(!ro&&!o.prof)?`<button class="btn sm" data-act="openPT" data-id="${esc(x.id)}">Editar</button>`:''}</div></div>`;
}

/* ---------- ventana de una cita ---------- */
function ctVolverBtn(from){ return from?`<button class="btn" data-act="ctVolver" data-from="${esc(from)}">Volver</button>`:`<button class="btn" data-act="closeModal">Cerrar</button>`; }
function ctVolver(from){
  const [k,id]=String(from||'').split(':');
  if(k==='det'&&id) ptDetalle(id); else if(k==='ag'&&id) ptAgendaModal(id); else { closeModal(); render(); }
}
function ctVer(pkId,cid,from){
  const aid=curArea(), pk=getPath(`data/${aid}/paquetes/${pkId}`); if(!pk) return;
  const M=ptMapa(pk), c=M.ag.find(x=>x.id===cid); if(!c){ toast('Esa sesión ya no está en la agenda'); ctVolver(from); return; }
  const p=getProf(aid,pk.profId)||{}, ro=roDatos(aid)||fcId(pk.id), rec=isRec(), mio=isProf()&&pk.profId===session.profId;
  const empezo=ctKey(c.f,c.h)<=ahoraKey(), n=M.ag.filter(ctCuenta).findIndex(x=>x.id===c.id)+1;
  const puedeReg=!ro&&!c.reg&&empezo&&(mio||(!isProf()&&!rec));
  const puedeMover=!ro&&!c.reg&&!isProf();
  const quien=c.reg?(c.reg.porNom||(c.reg.por==='dir'?'Dirección':((getProf(aid,c.reg.por)||{}).nombre||''))):'';
  openModal(`${mHead(esc(ctTxt(c)))}
    <div class="card">
      <div class="dl"><dt>Cliente</dt><dd>${esc(pk.cliente||'Cliente')}${n?` · sesión ${n} de ${+pk.total||0}`:''}</dd></div>
      <div class="dl"><dt>Instructor</dt><dd>${esc(p.nombre||'—')}</dd></div>
      <div class="dl"><dt>Estado</dt><dd>${ctPill(c)}</dd></div>
      ${c.orig?`<div class="dl"><dt>Reagendada</dt><dd>Antes era el ${esc(ctTxt(c.orig))}${c.por?' · la movió '+esc(c.por):''}</dd></div>`:''}
      ${c.repo?`<div class="dl"><dt>Reposición</dt><dd>Se agregó por una sesión cancelada</dd></div>`:''}
      ${c.reg?`<div class="dl"><dt>Registro</dt><dd>${esc(fmtTs(c.reg.ts))}${quien?' · '+esc(quien):''}</dd></div>`:''}</div>
    ${puedeReg?`<label class="f"><span>¿Cómo fue la sesión?</span><select id="ct_e">${Object.entries(PT_E).map(([k,l])=>`<option value="${esc(k)}">${esc(l)}</option>`).join('')}</select></label>
      <div class="btns"><button class="btn primary block" data-act="ctRegistrar" data-pk="${esc(pkId)}" data-c="${esc(cid)}" data-from="${esc(from||'')}">Registrar sesión</button></div>`:''}
    ${(!c.reg&&!empezo&&(mio||(!isProf()&&!rec)))?`<small class="mut">Se podrá registrar a partir de las ${hh(c.h)} del ${esc(fmtFecha(c.f))}.</small>`:''}
    ${puedeMover?`<div class="btns"><button class="btn" data-act="ctReagendar" data-pk="${esc(pkId)}" data-c="${esc(cid)}" data-from="${esc(from||'')}">Reagendar</button><button class="btn" data-act="ctCancelar" data-pk="${esc(pkId)}" data-c="${esc(cid)}" data-from="${esc(from||'')}">Cancelar (el cliente avisó)</button></div>
      <small class="mut">Reagendar mueve esta sesión a otra fecha y hora libre del instructor. Cancelar no descuenta la sesión: se repone al final, en el horario fijo del cliente. En los dos casos el instructor recibe el aviso.</small>`:''}
    ${(c.reg&&!ro&&(mio||(!isProf()&&!rec)))?`<div class="btns"><button class="btn danger" data-act="ctBorrarReg" data-pk="${esc(pkId)}" data-c="${esc(cid)}" data-from="${esc(from||'')}">Borrar el registro</button></div>`:''}
    <div class="btns">${ctVolverBtn(from)}</div>`);
}

/* ---------- reagendar ---------- */
let rgCtx = null;
function ctReagendar(pkId,cid,from){
  const aid=curArea(), pk=getPath(`data/${aid}/paquetes/${pkId}`); if(!pk) return;
  const c=ptMapa(pk).ag.find(x=>x.id===cid), p=getProf(aid,pk.profId); if(!c||!p){ toast('No se encontró la sesión'); return; }
  if(c.reg){ toast('Esa sesión ya tiene registro: no se puede reagendar'); return; }
  const t=todayStr(), def=c.f>=t?c.f:t;
  rgCtx={pkId,cid,from};
  openModal(`${mHead('Reagendar sesión')}
    <div class="sub">${esc(pk.cliente||'Cliente')} con ${esc(p.nombre)} · estaba el <b>${esc(ctTxt(c))}</b></div>
    <div class="two"><label class="f"><span>Nueva fecha</span><input id="rg_f" type="date" min="${t}"${pk.fin?` max="${esc(pk.fin)}"`:''} value="${esc(def)}"></label>
      <label class="f"><span>Hora</span><select id="rg_h"></select></label></div>
    <div id="rg_av"></div>
    <label class="f"><span>Motivo (opcional)</span><input id="rg_mot" autocomplete="off" placeholder="Ej. el cliente sale de viaje"></label>
    <small class="mut">Solo salen las horas autorizadas a ${esc(p.nombre)} para personalizados que no tiene ocupadas, y nunca horas que ya pasaron. Al guardar, ${esc(p.nombre.split(' ')[0])} recibe el aviso en su pantalla.</small>
    <div class="btns">${ctVolverBtn(from)}<button class="btn primary" data-act="rgGuardar">Guardar nueva fecha</button></div>`);
  rgFillHoras();
}
function rgOpciones(aid,pk,cid,f){                         // horas para reagendar ese día: {h, ok, por}
  const p=getProf(aid,pk.profId), x=(p&&f)?ghDia(p,'horPt',wdIdx(f)):null; if(!x) return [];
  const ctx=ghCtx(aid,pk.id), propias=new Set(ptMapa(pk).ag.filter(c=>c.id!==cid&&ctCuenta(c)).map(c=>ctKey(c.f,c.h))), out=[];
  for(let h=Math.floor(ghMin(x.i)/60);h<Math.ceil(ghMin(x.f)/60);h++){
    if(!ghCubre(x,h)) continue;
    const oc=ctx.occ[`${pk.profId}|${f}|${h}`];
    out.push({h,ok:ctLibre(f,h)&&!oc&&!propias.has(ctKey(f,h)),por:!ctLibre(f,h)?'ya pasó':oc?`ocupado con ${oc.cliente||'otro cliente'}`:propias.has(ctKey(f,h))?'ya tiene sesión':''});
  }
  return out;
}
function rgFillHoras(){
  if(!rgCtx) return;
  const aid=curArea(), pk=getPath(`data/${aid}/paquetes/${rgCtx.pkId}`), f=($('#rg_f')||{}).value, sel=$('#rg_h'), av=$('#rg_av'); if(!pk||!sel) return;
  const p=getProf(aid,pk.profId)||{}, O=rgOpciones(aid,pk,rgCtx.cid,f), keep=sel.value;
  sel.innerHTML=O.map(o=>`<option value="${o.h}"${o.ok?'':' disabled'}>${hh(o.h)}${o.por?' · '+esc(o.por):''}</option>`).join('');
  const first=O.find(o=>o.ok); if(keep&&O.some(o=>o.ok&&String(o.h)===keep)) sel.value=keep; else if(first) sel.value=String(first.h);
  let msg='';
  if(!f) msg='<small class="bad">Elige la nueva fecha.</small>';
  else if(f<todayStr()) msg='<small class="bad">No se puede reagendar a una fecha que ya pasó.</small>';
  else if(!O.length) msg=`<small class="bad">${esc(p.nombre||'El instructor')} no tiene autorizados personalizados los ${esc(DIAS_L[wdIdx(f)].toLowerCase())}.</small>`;
  else if(!first) msg='<small class="bad">Ese día ya no hay horas libres. Elige otra fecha.</small>';
  else if(pk.fin&&f>pk.fin) msg=`<small class="bad">Queda después del vencimiento (${esc(fmtCorta(pk.fin))}). Amplía el vencimiento en “Editar” o elige otra fecha.</small>`;
  if(av) av.innerHTML=msg;
}

/* ---------- agenda completa de un paquete ---------- */
function ptAgendaModal(pkId,from){
  const aid=curArea(), x=getPath(`data/${aid}/paquetes/${pkId}`); if(!x) return;
  const M=ptMapa(x), p=getProf(aid,x.profId)||{}, fr='ag:'+pkId;
  const fut=M.ag.filter(c=>!c.reg&&c.st!=='sin registrar'), pas=M.ag.filter(c=>c.reg||c.st==='sin registrar').reverse();
  const hist=gimLogs(aid).filter(l=>l.pk===pkId).slice(0,20);
  const volver=from&&String(from).startsWith('det:')?`<button class="btn" data-act="ctVolver" data-from="${esc(from)}">Volver</button>`:`<button class="btn" data-act="closeModal">Cerrar</button>`;
  openModal(`${mHead('Agenda · '+esc(x.cliente||'Cliente'))}
    <div class="sub">${esc(p.nombre||'—')} · ${ptReal(x)} de ${+x.total||0} sesiones usadas · ${plu(fut.length,'agendada','agendadas')}${M.sinAgendar?` · <span class="bad">${plu(M.sinAgendar,'sin fecha','sin fecha')}</span>`:''}</div>
    <div class="h2 sm">Por venir</div>
    ${fut.length?fut.map(c=>ctFila(aid,x,c,{from:fr,titulo:fmtFecha(c.f)})).join(''):empty('No hay sesiones por venir.')}
    <div class="h2 sm">Anteriores</div>
    ${pas.length?pas.map(c=>ctFila(aid,x,c,{from:fr,titulo:fmtFecha(c.f)})).join(''):empty('Todavía no hay sesiones anteriores.')}
    ${M.sueltas.length?`<div class="h2 sm">Registradas fuera de agenda</div><div class="ptp-s">${M.sueltas.sort((a,b)=>String(b.f).localeCompare(String(a.f))).map(s=>`<span class="${s.e==='realizada'?'ok':'mut'}">${esc(fmtFecha(s.f))}${s.h?' '+esc(s.h):''} · ${esc(PT_ECORTO[s.e]||s.e)}</span>`).join('')}</div>`:''}
    ${hist.length?`<div class="h2 sm">Movimientos</div>${hist.map(l=>lgFila(aid,l)).join('')}`:''}
    <div class="btns">${volver}</div>`);
}

/* ---------- dirección y recepción: hoy, pendientes y bitácora ---------- */
function gimHoyHTML(aid){
  const t=todayStr(), L=gimCitas(aid).filter(y=>y.c.f===t);
  return `<div class="h2 sm">Personalizados de hoy <span class="pill info">${L.length}</span></div>
    ${L.length?L.map(y=>ctFila(aid,y.pk,y.c,{prof:true})).join(''):empty('Hoy no hay sesiones de personalizados agendadas.')}`;
}
function gimAtencion(aid){
  const t=todayStr(), desde=addDays(t,-30), C=gimCitas(aid);
  const sinReg=C.filter(y=>y.c.st==='sin registrar'&&y.c.f>=desde).reverse();
  const sinVer=gimLogs(aid).filter(l=>l.aviso&&!l.visto);
  const sinAg=coll(aid,'paquetes').filter(x=>ptVigente(x)&&!fcId(x.id)).map(x=>({x,n:ptMapa(x).sinAgendar})).filter(y=>y.n>0);
  return {sinReg,sinVer,sinAg};
}
function gimAtencionHTML(aid){
  const A=gimAtencion(aid);
  if(!A.sinReg.length&&!A.sinVer.length&&!A.sinAg.length) return `<div class="an-cs" style="margin:6px 0 10px">✓ Sin pendientes: todas las sesiones pasadas están registradas y los instructores ya vieron los avisos.</div>`;
  return `<div class="h2 sm">Requiere atención</div>
    ${A.sinReg.length?`<div class="sub"><b class="bad">${plu(A.sinReg.length,'sesión ya pasó','sesiones ya pasaron')} sin registro</b> (últimos 30 días). El instructor debe indicar si se dio, si el cliente no asistió o si se canceló.</div>${A.sinReg.slice(0,8).map(y=>ctFila(aid,y.pk,y.c,{prof:true,fecha:true})).join('')}${A.sinReg.length>8?`<small class="mut">y ${A.sinReg.length-8} más…</small>`:''}`:''}
    ${A.sinVer.length?`<div class="sub"><b class="warn">${plu(A.sinVer.length,'aviso','avisos')} sin ver por el instructor:</b> ${esc([...new Set(A.sinVer.map(l=>(getProf(aid,l.prof)||{}).nombre).filter(Boolean))].join(', '))}.</div>`:''}
    ${A.sinAg.length?`<div class="sub"><b class="bad">Sesiones sin fecha:</b> ${A.sinAg.map(y=>`${esc(y.x.cliente||'Cliente')} (${y.n})`).join(', ')}. Edita el personalizado y elige el horario fijo del cliente.</div>`:''}`;
}
const LG_FIL = {todo:['Todo',null],agenda:['Agenda',['alta','cambio','reasigna','reagenda','cancelacion','reposicion','baja','edicion']],sesiones:['Sesiones',['sesion','borrado']],sinver:['Sin ver por el instructor',null]};
function gimLogHTML(aid){
  const fil=ui.lgFil||'todo', n=ui.lgN||15, F=LG_FIL[fil]||LG_FIL.todo;
  const L=gimLogs(aid).filter(l=>fil==='sinver'?(l.aviso&&!l.visto):(!F[1]||F[1].includes(l.tipo)));
  return `<div class="h2 sm">Bitácora del área</div>
    <div class="sub">Todo lo que pasa con los personalizados: altas, cambios de horario, reagendas, cancelaciones y sesiones registradas, con quién lo hizo y si el instructor ya lo vio.</div>
    <div class="chips">${Object.entries(LG_FIL).map(([k,[l]])=>`<button class="chip${fil===k?' on':''}" data-act="lgFil" data-f="${k}">${l}</button>`).join('')}</div>
    ${L.length?L.slice(0,n).map(l=>`<div class="card lg-c">${lgFila(aid,l,{prof:true})}</div>`).join(''):empty('Sin movimientos en esta lista.')}
    ${L.length>n?`<div class="btns"><button class="btn block" data-act="lgMas">Ver más (${L.length-n})</button></div>`:''}`;
}
/* resumen corto para el Inicio del director */
function gimPtHoyResumen(aid){
  const t=todayStr(), C=gimCitas(aid), hoy=C.filter(y=>y.c.f===t), A=gimAtencion(aid);
  const hechas=hoy.filter(y=>y.c.reg&&PT_DESC.includes(y.c.reg.e)).length;
  return `<div class="card gi-pth"><div class="gi-pth-n"><span><b>${hoy.length}</b> sesiones hoy</span><span><b>${hechas}</b> registradas</span>
      <span class="${A.sinReg.length?'bad':''}"><b>${A.sinReg.length}</b> sin registrar</span><span class="${A.sinVer.length?'warn':''}"><b>${A.sinVer.length}</b> avisos sin ver</span></div>
    ${hoy.filter(y=>!y.c.reg).slice(0,3).map(y=>ctFila(aid,y.pk,y.c,{prof:true})).join('')}</div>`;
}

/* ---------- acciones ---------- */
Object.assign(actions,{
  ctVer(d){ ctVer(d.pk,d.c,d.from); },
  ctVolver(d){ ctVolver(d.from); },
  ptAgenda(d){ ptAgendaModal(d.id,d.from); },
  ctRegistrar(d){
    const aid=curArea(), pk=getPath(`data/${aid}/paquetes/${d.pk}`); if(!pk||roDatos(aid)||isRec()) return;
    if(isProf()&&pk.profId!==session.profId) return;                    // el instructor solo registra sus personalizados
    const c=ptMapa(pk).ag.find(x=>x.id===d.c), e=($('#ct_e')||{}).value;
    if(!c){ toast('Esa sesión ya no está en la agenda'); return; }
    if(c.reg){ toast('Esa sesión ya está registrada'); return; }
    if(ctKey(c.f,c.h)>ahoraKey()){ toast('Todavía no es la hora de esta sesión'); return; }
    if(!PT_E[e]){ toast('Elige cómo fue la sesión'); return; }
    if(PT_DESC.includes(e)&&ptReal(pk)>=(+pk.total||0)){ toast('Ya se usaron todas las sesiones contratadas'); return; }
    const sid='s'+uid();
    setPath(`data/${aid}/paquetes/${d.pk}/sesiones/${sid}`,{id:sid,cita:c.id,f:c.f,h:hh(c.h),e,ts:Date.now(),por:isProf()?session.profId:'dir',porNom:gimQuien()});
    let txt=`${pk.cliente||'Cliente'} · ${ctTxt(c)}: ${PT_ECORTO[e]||e}`;
    if(ptRepone(e)){ const N=ptReponer(aid,d.pk); txt+=N.length?` · se repone el ${ctTxt(N[0])}`:' · no hubo lugar para reponerla: agéndala a mano'; }
    gimLog(aid,{tipo:'sesion',txt,pk:d.pk,prof:pk.profId,aviso:!isProf()&&ptRepone(e)});
    toast('Sesión registrada'); ctVolver(d.from); render();
  },
  ctBorrarReg(d){
    const aid=curArea(), pk=getPath(`data/${aid}/paquetes/${d.pk}`); if(!pk||roDatos(aid)||isRec()) return;
    if(isProf()&&pk.profId!==session.profId) return;
    const c=ptMapa(pk).ag.find(x=>x.id===d.c); if(!c||!c.reg) return;
    if(!confirm('¿Borrar el registro de esta sesión? Vuelve a quedar sin registrar.')) return;
    setPath(`data/${aid}/paquetes/${d.pk}/sesiones/${c.reg.id}`,undefined);
    gimLog(aid,{tipo:'borrado',txt:`${pk.cliente||'Cliente'} · ${ctTxt(c)}: se borró “${PT_ECORTO[c.reg.e]||c.reg.e}”`,pk:d.pk,prof:pk.profId});
    toast('Registro borrado'); ctVolver(d.from); render();
  },
  ctReagendar(d){ if(roDatos(curArea())||isProf()) return; ctReagendar(d.pk,d.c,d.from); },
  rgGuardar(){
    const aid=curArea(); if(!rgCtx||roDatos(aid)||isProf()) return;
    const {pkId,cid,from}=rgCtx, pk=getPath(`data/${aid}/paquetes/${pkId}`); if(!pk) return;
    const f=$('#rg_f').value, h=parseInt($('#rg_h').value,10), mot=$('#rg_mot').value.trim();
    const L=ptCitas(pk).map(ptLimpia), c=ptMapa(pk).ag.find(x=>x.id===cid), i=L.findIndex(x=>x.id===cid);
    if(!c||i<0){ toast('Esa sesión ya no está en la agenda'); return; }
    if(c.reg){ toast('Esa sesión ya tiene registro: no se puede reagendar'); return; }
    if(!f||isNaN(h)){ toast('Elige la nueva fecha y una hora libre'); return; }
    if(!ctLibre(f,h)){ toast('No se puede agendar en una fecha u hora que ya pasó'); return; }
    if(pk.fin&&f>pk.fin){ toast(`Queda después del vencimiento (${fmtCorta(pk.fin)}). Amplía el vencimiento en “Editar”`); return; }
    const o=rgOpciones(aid,pk,cid,f).find(x=>x.h===h);
    if(!o){ toast('Esa hora no está autorizada para personalizados del instructor'); return; }
    if(!o.ok){ toast(`Esa hora no está libre: ${o.por}`); return; }
    if(c.f===f&&+c.h===h){ toast('Es la misma fecha y hora'); return; }
    L[i]={...L[i],f,h,orig:L[i].orig||{f:c.f,h:+c.h},reag:(+L[i].reag||0)+1,por:gimQuien(),ts:Date.now()};
    setPath(`data/${aid}/paquetes/${pkId}/citas`,ptCitasMap(L));
    gimLog(aid,{tipo:'reagenda',txt:`${pk.cliente||'Cliente'}: ${ctTxt(c)} → ${ctTxt({f,h})}${mot?' · '+mot:''}`,pk:pkId,prof:pk.profId,aviso:true});
    rgCtx=null; toast('Sesión reagendada. El instructor recibe el aviso'); ctVolver(from); render();
  },
  ctCancelar(d){
    const aid=curArea(), pk=getPath(`data/${aid}/paquetes/${d.pk}`); if(!pk||roDatos(aid)||isProf()) return;
    const c=ptMapa(pk).ag.find(x=>x.id===d.c); if(!c) return;
    if(c.reg){ toast('Esa sesión ya tiene registro'); return; }
    if(!confirm(`¿Cancelar la sesión del ${ctTxt(c)}? No se descuenta: se repone al final, en el horario fijo del cliente.`)) return;
    if(!pk.citas) setPath(`data/${aid}/paquetes/${d.pk}/citas`,ptCitasMap(ptCitas(pk)));   // paquete anterior: se guarda su agenda
    const sid='s'+uid();
    setPath(`data/${aid}/paquetes/${d.pk}/sesiones/${sid}`,{id:sid,cita:c.id,f:c.f,h:hh(c.h),e:'cancelada por el cliente',ts:Date.now(),por:'dir',porNom:gimQuien()});
    const N=ptReponer(aid,d.pk);
    gimLog(aid,{tipo:'cancelacion',txt:`${pk.cliente||'Cliente'}: canceló el ${ctTxt(c)}${N.length?` · se repone el ${ctTxt(N[0])}`:' · no hubo lugar para reponerla: agéndala a mano'}`,pk:d.pk,prof:pk.profId,aviso:true});
    toast(N.length?`Cancelada. Se repone el ${ctTxt(N[0])}`:'Cancelada. No hubo lugar para reponerla'); ctVolver(d.from); render();
  },
  lgVisto(d){
    const aid=curArea(), l=getPath(`data/${aid}/gimlog/${d.id}`); if(!l||!isProf()||l.prof!==session.profId) return;
    setPath(`data/${aid}/gimlog/${d.id}/visto`,Date.now()); render();
  },
  lgVistoTodos(){
    if(!isProf()) return; const aid=curArea(), ts=Date.now();
    gimLogs(aid).filter(l=>l.aviso&&l.prof===session.profId&&!l.visto).forEach(l=>setPath(`data/${aid}/gimlog/${l.id}/visto`,ts));
    render(); toast('Avisos marcados como enterado');
  },
  lgFil(d){ ui.lgFil=d.f; ui.lgN=15; render(); },
  lgMas(){ ui.lgN=(ui.lgN||15)+20; render(); }
});
document.addEventListener('change',e=>{ if(e.target&&e.target.id==='rg_f') rgFillHoras(); });
