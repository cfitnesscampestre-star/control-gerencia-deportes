'use strict';
/* =====================================================================
   recepcion.js — Gimnasio: quién captura qué.

   · DIRECCIÓN del gimnasio: todo (aforo, personalizados, instructores,
     recepción). Da de alta a las recepcionistas y a los instructores, cada
     uno con su PIN.
   · RECEPCIÓN (entra con su PIN): solo estas cosas
       1) captura el aforo por hora (junto con la dirección)
       2) da de alta los personalizados y se los asigna a un instructor (con sus citas por fecha y hora)
       3) consulta el horario semanal de personalizados (horas libres u ocupadas)
       3b) reagenda o cancela una sesión cuando el cliente avisa: el instructor recibe el aviso
       4) solicita rutinas genéricas, que llegan al entrenador que sigue en la fila
     No ve instructores, eventos, reportes ni otras áreas.
   · INSTRUCTOR / ENTRENADOR (entra con su PIN): ve su agenda (hoy, sin registrar, próximos
     días), los avisos de cambios (marca “Enterado”) y registra cada sesión cuando ya pasó su hora.

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
  if(!['gimaforo','gimpt','gimhorario','gimrutinas'].includes(ui.aTab)) ui.aTab='gimaforo';
  const body = ui.aTab==='gimpt' ? vGimPT(aid) : ui.aTab==='gimhorario' ? vGimHorario(aid) : ui.aTab==='gimrutinas' ? vGimRutinas(aid) : vGimAforo(aid);
  return shell({title:esc(r.nombre||'Recepción'),sub:`Recepción · ${areaIco(a,{size:14})} ${esc(a.nombre)}`,body});
}

/* ---------- pantalla del instructor: su agenda y sus personalizados ---------- */
function vGimProf(){
  const aid=session.area, pid=session.profId, t=todayStr(), mes=t.slice(0,7), en7=addDays(t,7);
  const pk=coll(aid,'paquetes').filter(x=>x.profId===pid).sort((a,b)=>(ptVigente(b)-ptVigente(a))||String(b.fin).localeCompare(String(a.fin)));
  const act=pk.filter(ptVigente), ant=pk.filter(x=>!ptVigente(x)).slice(0,6), C=gimCitas(aid,pid);
  const saldo=act.reduce((n,x)=>n+Math.max(0,(+x.total||0)-ptReal(x)),0);
  const sinReg=C.filter(y=>y.c.st==='sin registrar').reverse(), hoy=C.filter(y=>y.c.f===t), prox=C.filter(y=>y.c.f>t&&y.c.f<=en7&&!y.c.reg);
  const sesMes=pk.reduce((n,x)=>n+ptSes(x).filter(s=>s.e==='realizada'&&String(s.f).startsWith(mes)).length,0);
  const dias=[...new Set(prox.map(y=>y.c.f))];
  return `<div class="gpf">
    ${gimAvisosProf(aid,pid)}
    ${gimRutProf()}
    <div class="sub">Tu agenda de personalizados. Cuando pase la hora de cada sesión, regístrala: realizada, no asistió o cancelada.</div>
    <div class="kpis k3">${kpi('Hoy',hoy.length,plu(hoy.filter(y=>y.c.reg).length,'registrada','registradas'),{color:'var(--b2)'})}${kpi('Por entregar',saldo,plu(act.length,'paquete activo','paquetes activos'),{cls:saldo?'warn':'ok',color:'var(--warn)'})}${kpi('Sin registrar',sinReg.length,`${sesMes} realizadas este mes`,{cls:sinReg.length?'bad':'ok',color:'var(--bad)'})}</div>
    ${sinReg.length?`<div class="h2">Sin registrar <span class="pill bad">${sinReg.length}</span></div><div class="sub">Ya pasaron y no tienen registro. La dirección las ve como pendientes.</div>${sinReg.map(y=>ctFila(aid,y.pk,y.c,{fecha:true})).join('')}`:''}
    <div class="h2">Hoy · ${esc(fmtLarga(t))}</div>
    ${hoy.length?hoy.map(y=>ctFila(aid,y.pk,y.c)).join(''):empty('Hoy no tienes sesiones agendadas.')}
    <div class="h2">Próximos 7 días</div>
    ${dias.length?dias.map(f=>`<div class="ct-dia">${esc(fmtLarga(f))}</div>${prox.filter(y=>y.c.f===f).map(y=>ctFila(aid,y.pk,y.c)).join('')}`).join(''):empty('No tienes sesiones agendadas en los próximos 7 días.')}
    <div class="h2">Mis personalizados</div>
    ${act.length?act.map(x=>ptPaqHTML(aid,x,{prof:true})).join(''):empty('Todavía no tienes personalizados asignados. Recepción los da de alta y te los asigna.')}
    ${ant.length?`<div class="h2 sm">Anteriores</div>${ant.map(x=>ptPaqHTML(aid,x,{prof:true})).join('')}`:''}
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
