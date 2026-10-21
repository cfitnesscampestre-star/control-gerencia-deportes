'use strict';
/* =====================================================================
   recepcion.js — Gimnasio: quién captura qué.

   · DIRECCIÓN del gimnasio: todo (aforo, personalizados, instructores,
     recepción). Da de alta a las recepcionistas y a los instructores, cada
     uno con su PIN.
   · RECEPCIÓN (entra con su PIN): solo estas cosas
       1) captura el aforo por hora (junto con la dirección)
       2) consulta el horario semanal de personalizados (horas libres u ocupadas)
       3) manda una SOLICITUD al instructor libre: “Fulano solicita clases” (sin teléfonos: el
          instructor pasa a recepción). Los personalizados los registra el instructor (gimpersonal.js)
       4) solicita rutinas genéricas, que llegan al entrenador que sigue en la fila
     No ve instructores, eventos, reportes ni otras áreas.
   · INSTRUCTOR / ENTRENADOR (entra con su PIN): atiende las solicitudes de recepción, registra y
     agenda sus personalizados, ve su agenda (hoy, sin registrar, próximos días) y registra cada sesión.

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
    <div class="sub">${ro?'Personal de recepción con acceso.':'Da de alta a las personas de recepción, cada una con su PIN.'} Capturan el aforo por hora, ven el horario de personalizados y mandan solicitudes a los instructores. No registran personalizados ni ven nada más.</div>
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
  if(!['gimaforo','gimhorario','gimavisos','gimrutinas'].includes(ui.aTab)) ui.aTab='gimaforo';
  const body = ui.aTab==='gimhorario' ? vGimHorario(aid) : ui.aTab==='gimavisos' ? vGimAvisosRec(aid) : ui.aTab==='gimrutinas' ? vGimRutinas(aid) : vGimAforo(aid);
  return shell({title:esc(r.nombre||'Recepción'),sub:`Recepción · ${areaIco(a,{size:14})} ${esc(a.nombre)}`,body});
}

/* ---------- pantalla del instructor: “Por hacer” (su agenda de la semana, socios y horario están en gimvistas.js) ---------- */
function vGimProf(){
  const aid=session.area, pid=session.profId, t=todayStr(), mes=t.slice(0,7);
  const pk=coll(aid,'paquetes').filter(x=>x.profId===pid), act=pk.filter(ptVigente), C=gimCitas(aid,pid);
  const saldo=act.reduce((n,x)=>n+Math.max(0,(+x.total||0)-ptReal(x)),0);
  const sinReg=C.filter(y=>y.c.st==='sin registrar').reverse(), hoy=C.filter(y=>y.c.f===t);
  const sesMes=pk.reduce((n,x)=>n+ptSes(x).filter(s=>s.e==='realizada'&&String(s.f).startsWith(mes)).length,0);
  const nSol=solPendientes(aid,pid).length, nRut=rutinas(aid).filter(r=>r.profId===pid&&rutEst(r)==='pendiente').length;
  const nAv=gimLogs(aid).filter(l=>l.aviso&&l.prof===pid&&!l.visto).length, nTot=nSol+nRut+sinReg.length+nAv;
  const ahora=hoy.filter(y=>!y.c.reg&&ctKey(y.c.f,y.c.h)<=ahoraKey()).pop();      // la sesión que acaba de empezar: registro en un toque
  const sinRegL=sinReg.filter(y=>y!==ahora);                  // la de “Ahora” ya tiene sus botones arriba
  const reg=(y,e,l,c)=>`<button class="btn sm${c?' '+c:''}" data-act="ctRegistrar" data-pk="${esc(y.pk.id)}" data-c="${esc(y.c.id)}" data-e="${e}">${l}</button>`;
  return `<div class="gpf">
    ${ahora?`<div class="h2">Ahora</div><div class="hero gpf-ahora"><div class="hero-t"><span>${ahora.c.st==='en curso'?'Sesión en curso':'Sesión de hoy sin registrar'}</span><b>${esc(ahora.pk.cliente||'Cliente')}</b><span>${hh(ahora.c.h)} · sesión ${ptReal(ahora.pk)+1} de ${+ahora.pk.total||0}</span></div>
        <div class="hero-bs"><button class="hero-b" data-act="ctRegistrar" data-pk="${esc(ahora.pk.id)}" data-c="${esc(ahora.c.id)}" data-e="realizada">✓ Realizada</button>
        <button class="hero-b2" data-act="ctRegistrar" data-pk="${esc(ahora.pk.id)}" data-c="${esc(ahora.c.id)}" data-e="falta">No asistió</button>
        <button class="hero-b2" data-act="ctVer" data-pk="${esc(ahora.pk.id)}" data-c="${esc(ahora.c.id)}" data-from="">Otro…</button></div></div>`:''}
    <div class="kpis k3">${kpi('Hoy',hoy.length,plu(hoy.filter(y=>y.c.reg).length,'registrada','registradas'),{color:'var(--b2)'})}${kpi('Por entregar',saldo,plu(act.length,'paquete activo','paquetes activos'),{cls:saldo?'warn':'ok',color:'var(--warn)'})}${kpi('Sin registrar',sinReg.length,`${sesMes} realizadas este mes`,{cls:sinReg.length?'bad':'ok',color:'var(--bad)'})}</div>
    <div class="h2">Por hacer ${nTot?`<span class="pill warn">${nTot}</span>`:''}</div>
    ${nTot?'<div class="sub">Solicitudes de recepción, rutinas, sesiones sin registrar y cambios en tus personalizados. Todo lo pendiente está aquí.</div>':empty('Nada pendiente. Cuando recepción te mande un socio o una rutina, aparece aquí.')}
    ${gimSolProf(aid,pid)}
    ${gimRutProf()}
    ${sinRegL.length?`<div class="h2">Sesiones sin registrar <span class="pill bad">${sinRegL.length}</span></div><div class="sub">Ya pasaron y no tienen registro. La dirección las ve como pendientes.</div>
      ${sinRegL.map(y=>`<div class="gpf-sr">${ctFila(aid,y.pk,y.c,{fecha:true})}<div class="btns">${reg(y,'realizada','✓ Realizada','primary')}${reg(y,'falta','No asistió')}<button class="btn sm" data-act="ctVer" data-pk="${esc(y.pk.id)}" data-c="${esc(y.c.id)}" data-from="">Otro…</button></div></div>`).join('')}`:''}
    ${gimAvisosProf(aid,pid)}
    <div class="h2">Hoy · ${esc(fmtLarga(t))}</div>
    ${hoy.length?hoy.map(y=>ctFila(aid,y.pk,y.c)).join(''):empty('Hoy no tienes sesiones agendadas.')}
    <div class="btns"><button class="btn" data-act="pTab" data-tab="agenda">Ver mi semana</button><button class="btn primary" data-act="openPT">+ Nuevo personalizado</button></div>
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
    if(typeof ctPersonaGuardada==='function') ctPersonaGuardada('rec',aid,id,pin,prev.pin,$('#rc_activo').value==='1');   // su cuenta de Firebase (ver cuentas.js)
    closeModal(); render(); toast('Recepcionista guardada');
  },
  delRec(d){
    if(!confirm('¿Eliminar a esta recepcionista? Ya no podrá entrar. Lo que capturó se conserva.')) return;
    setPath(`data/${curArea()}/recepcion/${d.id}`,undefined); if(typeof ctQuitar==='function') ctQuitar(ctClave({rol:'rec',area:curArea(),id:d.id})); closeModal(); render(); toast('Recepcionista eliminada');
  }
});
