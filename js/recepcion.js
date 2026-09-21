'use strict';
/* =====================================================================
   recepcion.js — Gimnasio: quién captura qué.

   · DIRECCIÓN del gimnasio: todo (aforo, personalizados, instructores,
     recepción). Da de alta a las recepcionistas y a los instructores, cada
     uno con su PIN.
   · RECEPCIÓN (entra con su PIN): solo dos cosas
       1) captura el aforo por hora (junto con la dirección)
       2) da de alta los personalizados y se los asigna a un instructor
     No ve instructores, eventos, reportes ni otras áreas.
   · INSTRUCTOR / ENTRENADOR (entra con su PIN): solo ve los personalizados
     que le asignaron y registra cada sesión que da de ellos.

   Datos: data/<área>/recepcion/<id>  {id, nombre, pin, activo}
   Sesión: {rol:'rec', area, recId}
   ===================================================================== */
const getRec = (aid,id) => getPath(`data/${aid}/recepcion/${id}`);
const recepcion = aid => coll(aid,'recepcion').sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre),'es'));
const isRec = () => !!session && session.rol==='rec';
const gimPor = () => isRec() ? ((getRec(session.area,session.recId)||{}).nombre||'Recepción') : (session&&session.rol==='dir'?'Dirección':'');

/* ---------- Dirección: recepcionistas ---------- */
function vGimRecepcion(aid){
  const ro=roDatos(aid), L=recepcion(aid);
  return `<div class="h2">Recepción ${ro?'':`<button class="btn sm primary" data-act="openRec">+ Recepcionista</button>`}</div>
    ${gruposSwitch()}
    <div class="sub">${ro?'Personal de recepción con acceso.':'Da de alta a las personas de recepción, cada una con su PIN.'} Ellas capturan el aforo por hora y dan de alta los personalizados, asignándolos a un instructor. No ven nada más.</div>
    ${L.length?`<div class="plist">${L.map(r=>`<button class="pcard" data-act="openRec" data-id="${esc(r.id)}" style="--ac:${areaColor(aid)}">${avatarHTML(r.nombre,'',54)}<div class="pc-n"><b>${esc(r.nombre)}</b><small>Recepción</small></div><div class="pc-r">${r.activo===false?pill('Inactiva','mut'):pill('Con acceso','ok')}</div></button>`).join('')}</div>`
      :empty(ro?'Todavía no hay personal de recepción dado de alta.':'Aún no hay recepcionistas. Da de alta a la primera con “+ Recepcionista”.')}`;
}
function openRec(id){
  const aid=curArea(), r=id?(getRec(aid,id)||{}):{}, ro=roDatos(aid), dis=ro?' disabled':'';
  openModal(`${mHead(id?(ro?'Recepcionista':'Editar recepcionista'):'Nueva recepcionista')}
    <label class="f"><span>Nombre completo</span><input id="rc_nombre" value="${esc(r.nombre)}"${dis}></label>
    <label class="f"><span>¿Activa?</span><select id="rc_activo"${dis}><option value="1"${r.activo===false?'':' selected'}>Sí</option><option value="0"${r.activo===false?' selected':''}>No</option></select></label>
    ${ro?'':`<div class="f"><span class="lb">PIN de acceso (4 a 6 dígitos)</span>
      <div class="pinrow"><input id="rc_pin" inputmode="numeric" maxlength="6" autocomplete="off" value="${esc(r.pin)}"><button class="btn sm" data-act="rcGenPin">Generar</button></div>
      <small class="mut">Con este PIN, junto con su nombre, entra a capturar el aforo y dar de alta personalizados.</small></div>`}
    ${ro?`<div class="btns"><button class="btn" data-act="closeModal">Cerrar</button></div>`:`
    <div class="btns"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="saveRec" data-id="${esc(id||'')}">Guardar</button></div>
    ${id?`<div class="btns"><button class="btn danger" data-act="delRec" data-id="${esc(id)}">Eliminar recepcionista</button></div>`:''}`}`);
}

/* ---------- pantalla de Recepción ---------- */
function viewRecepcion(){
  const aid=session.area, a=getArea(aid), r=getRec(aid,session.recId)||{};
  if(!['gimaforo','gimpt'].includes(ui.aTab)) ui.aTab='gimaforo';
  const body = ui.aTab==='gimpt' ? vGimPT(aid) : vGimAforo(aid);
  return shell({title:esc(r.nombre||'Recepción'),sub:`Recepción · ${areaIco(a,{size:14})} ${esc(a.nombre)}`,body});
}

/* ---------- pantalla del instructor: solo sus personalizados ---------- */
function gpfCard(aid,x){
  const real=ptReal(x), tot=+x.total||0, est=ptEstado(x), ses=ptSes(x).sort((a,b)=>(b.f+(b.h||'')).localeCompare(a.f+(a.h||''))).slice(0,4), pct=tot?Math.min(100,Math.round(real/tot*100)):0;
  return `<div class="card ptp"><div class="row"><div><b>${esc(x.cliente||'Cliente')}</b><small>${esc(fmtCorta(x.inicio))} al ${esc(fmtCorta(x.fin))}</small></div>${pill(est,PT_CLS[est])}</div>
    <div class="ptp-b"><div class="bar"><i class="${real>=tot?'info':aforoCls(pct)}" style="width:${pct}%"></i></div><b>${real}/${tot}</b></div>
    <small class="mut">${tot-real>0?plu(tot-real,'sesión pendiente','sesiones pendientes'):'Todas las sesiones entregadas'}</small>
    ${ses.length?`<div class="ptp-s">${ses.map(s=>`<span class="${s.e==='realizada'?'ok':'mut'}">${esc(fmtFecha(s.f))}${s.h?' '+esc(s.h):''} · ${esc(s.e==='realizada'?'realizada':s.e)}</span><button class="ptp-x" data-act="delSesion" data-pk="${esc(x.id)}" data-id="${esc(s.id)}" aria-label="Borrar sesión">${ic('x')}</button>`).join('')}</div>`:''}
    ${x.notas?`<small class="mut">${esc(x.notas)}</small>`:''}
    ${ptVigente(x)?`<div class="btns"><button class="btn primary block" data-act="openSesion" data-id="${esc(x.id)}">+ Registrar sesión</button></div>`:`<small class="mut">${est==='vencido'?'Este personalizado ya venció: consulta con recepción.':'Personalizado completado.'}</small>`}</div>`;
}
function vGimProf(){
  const aid=session.area, pid=session.profId, t=todayStr(), mes=t.slice(0,7);
  const pk=coll(aid,'paquetes').filter(x=>x.profId===pid).sort((a,b)=>(ptVigente(b)-ptVigente(a))||String(b.fin).localeCompare(String(a.fin)));
  const act=pk.filter(ptVigente), ant=pk.filter(x=>!ptVigente(x)).slice(0,6);
  const saldo=act.reduce((n,x)=>n+Math.max(0,(+x.total||0)-ptReal(x)),0);
  const sesMes=pk.reduce((n,x)=>n+ptSes(x).filter(s=>s.e==='realizada'&&String(s.f).startsWith(mes)).length,0);
  const sesHoy=pk.reduce((n,x)=>n+ptSes(x).filter(s=>s.e==='realizada'&&s.f===t).length,0);
  return `<div class="gpf">
    <div class="sub">Aquí ves los personalizados que recepción te asignó. Registra cada sesión que des.</div>
    <div class="kpis k3">${kpi('Por entregar',saldo,plu(act.length,'paquete activo','paquetes activos'),{cls:saldo?'warn':'ok',color:'var(--warn)'})}${kpi('Hoy',sesHoy,'sesiones realizadas',{color:'var(--b2)'})}${kpi('Este mes',sesMes,'sesiones realizadas',{color:'var(--b1)'})}</div>
    <div class="h2">Mis personalizados</div>
    ${act.length?act.map(x=>gpfCard(aid,x)).join(''):empty('Todavía no tienes personalizados asignados. Recepción los da de alta y te los asigna.')}
    ${ant.length?`<div class="h2 sm">Anteriores</div>${ant.map(x=>gpfCard(aid,x)).join('')}`:''}
  </div>`;
}

Object.assign(actions,{
  openRec(d){ openRec(d.id||''); },
  rcGenPin(){ $('#rc_pin').value=String(Math.floor(1000+Math.random()*9000)); },
  saveRec(d){
    const aid=curArea(); if(roDatos(aid)) return;
    const nombre=$('#rc_nombre').value.trim(), pin=$('#rc_pin').value.trim();
    if(!nombre){ toast('Escribe el nombre de la recepcionista'); return; }
    if(!/^\d{4,6}$/.test(pin)){ toast('El PIN debe tener de 4 a 6 dígitos'); return; }
    const id=d.id||('rc'+uid()), prev=d.id?(getRec(aid,id)||{}):{};
    setPath(`data/${aid}/recepcion/${id}`,{...prev,id,nombre,pin,activo:$('#rc_activo').value==='1'});
    closeModal(); render(); toast('Recepcionista guardada');
  },
  delRec(d){
    if(!confirm('¿Eliminar a esta recepcionista? Ya no podrá entrar. Lo que capturó se conserva.')) return;
    setPath(`data/${curArea()}/recepcion/${d.id}`,undefined); closeModal(); render(); toast('Recepcionista eliminada');
  }
});
