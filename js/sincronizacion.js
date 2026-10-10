'use strict';
/* =====================================================================
   sincronizacion.js — estado del trabajo sin internet y avisos de
   sincronización. Se abre tocando la nube (barra superior o menú).
   · Muestra si hay conexión, cuántos cambios faltan por subir y cuándo
     quedó todo guardado en la nube.
   · Si dos personas cambiaron el mismo dato mientras alguien trabajaba sin
     internet, se conserva lo que ya estaba guardado y lo otro queda aquí
     como aviso para decidir: "usar el mío" o "dejar el guardado".
   La lógica de la cola y de la mezcla está en core.js.
   ===================================================================== */
function syRutaTxt(p){
  const k=String(p).split('/');
  if(k[0]==='data'&&k[1]){
    const a=(getArea(k[1])||{}).nombre||k[1];
    const col={asistencia:'Asistencia',grupos:'Grupo',profesores:'Profesor',eventos:'Evento',incidencias:'Incidencia',accesos:'Aforo del gimnasio',bitacora:'Servicio',reportes:'Reporte semanal',recepcion:'Recepción',paquetes:'Personalizado',rutinas:'Rutina genérica',gimlog:'Bitácora del gimnasio'}[k[2]]||k[2]||'';
    const id=k[3]||''; let det=id;
    if(k[2]==='asistencia'&&id){ const gid=id.split('_')[0], g=getPath(`data/${k[1]}/grupos/${gid}`)||{}; det=`${g.nombre||'clase'} · ${id.split('_').slice(1).join(' ')}`; }
    else if(['grupos','profesores','eventos'].includes(k[2])&&id){ const o=getPath(`data/${k[1]}/${k[2]}/${id}`)||{}; det=o.nombre||id; }
    return [a,col,det,k.slice(4).join(' · ')].filter(Boolean).join(' · ');
  }
  if(k[0]==='met') return 'Metodología · '+k.slice(1).join(' · ');
  if(k[0]==='cfg') return 'Configuración · '+k.slice(1).join(' · ');
  return String(p);
}
function syValTxt(v){
  if(v===null||v===undefined) return '(vacío)';
  if(Array.isArray(v)) return v.length?v.join(', '):'(vacío)';
  if(typeof v==='object') return `${Object.keys(v).length} campos`;
  if(v===true) return 'Sí'; if(v===false) return 'No';
  return String(v);
}
function syUltima(){ try{ const t=+localStorage.getItem(SYNC_KEY); return t?new Date(t):null; }catch(e){ return null; } }
function openSync(){
  const n=pendientes(), ult=syUltima(), con=!!FIREBASE_CONFIG.databaseURL;
  const hh2=d=>`${pad(d.getHours())}:${pad(d.getMinutes())}`;
  openModal(`${mHead('Sincronización')}
    <div class="card">
      <div class="row"><div><b>Conexión</b><small>${!con?'Esta copia trabaja solo en este equipo.':online?'Conectado a la nube.':'Sin internet: todo lo que captures se guarda en este equipo y se sube solo cuando vuelva la señal.'}</small></div>${pill(!con?'Solo equipo':online?'Conectado':'Sin internet',!con?'mut':online?'ok':'warn')}</div>
      <div class="row"><div><b>Cambios por subir</b><small>${n?`${plu(n,'cambio espera','cambios esperan')} la conexión. No se pierden aunque cierres la app.`:'No hay nada pendiente.'}</small></div><b class="sy-n">${n}</b></div>
      <div class="row"><div><b>Último guardado completo en la nube</b><small>${ult?`${esc(fmtLarga(ymd(ult)))} · ${hh2(ult)}`:'Todavía no hay registro en este equipo.'}</small></div></div>
    </div>
    ${n?`<div class="h2 sm">Pendientes</div><div class="card">${outbox.slice(0,12).map(o=>`<div class="row"><div><small>${esc(syRutaTxt(o.p))}</small></div></div>`).join('')}${n>12?`<div class="row"><div><small>… y ${n-12} más</small></div></div>`:''}</div>`:''}
    ${con?`<div class="btns"><button class="btn primary block" data-act="syAhora"${online&&n?'':' disabled'}>Subir ahora</button></div>`:''}
    ${conflictos.length?`<div class="h2 sm">Avisos por revisar (${conflictos.length})</div>
      <div class="sub">Mientras trabajabas sin internet, otra persona ya había guardado estos datos. Se conservó lo guardado; si el tuyo es el correcto, usa “Usar el mío”.</div>
      ${conflictos.map(c=>`<div class="card sy-cf"><div class="sy-r">${esc(syRutaTxt(c.ruta))}</div>
        <div class="sy-v"><div><span>Lo tuyo</span><b>${esc(syValTxt(c.mio))}</b></div><div><span>Lo guardado</span><b>${esc(syValTxt(c.nube))}</b></div></div>
        <div class="btns"><button class="btn sm" data-act="syDejar" data-id="${esc(c.id)}">Dejar el guardado</button><button class="btn sm primary" data-act="syMio" data-id="${esc(c.id)}">Usar el mío</button></div></div>`).join('')}
      <div class="btns"><button class="btn" data-act="syTodos">Dejar lo guardado en todos</button></div>`:''}
    <div class="sub" style="margin-top:12px">Puedes trabajar sin internet (canchas, albercas, salones sin señal): pasar lista, capturar aforos y registrar servicios. Abre la app con internet al menos una vez al día para tener tus datos al día en el equipo.</div>
    <div class="btns"><button class="btn" data-act="closeModal">Cerrar</button></div>`);
}
Object.assign(actions,{
  syncInfo(){ openSync(); },
  syAhora(){ obFlush(); toast('Subiendo los cambios…'); setTimeout(()=>{ if($('#modal')&&!$('#modal').hidden) openSync(); },1200); },
  syDejar(d){ conflictos=conflictos.filter(c=>c.id!==d.id); cfSave(); openSync(); safeRender(); },
  syTodos(){ conflictos=[]; cfSave(); closeModal(); safeRender(); toast('Se dejó lo guardado en la nube'); },
  syMio(d){
    const c=conflictos.find(x=>x.id===d.id); if(!c) return;
    conflictos=conflictos.filter(x=>x.id!==d.id); cfSave();
    setPath(c.ruta,c.mio===null?undefined:c.mio,c.nube);   // se vuelve a subir lo tuyo, contra el valor guardado que se vio en el aviso
    openSync(); toast('Se subió lo tuyo');
  }
});
