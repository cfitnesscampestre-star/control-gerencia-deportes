'use strict';
/* =====================================================================
   eventos.js — eventos del área (torneos, exhibiciones, cursos…)
   ===================================================================== */
function vEventos(aid){
  const t=todayStr(), all=coll(aid,'eventos'), yr=String(new Date().getFullYear());
  let list=all.slice();
  if(ui.evFil==='proximos') list=list.filter(e=>e.fecha>=t).sort((a,b)=>a.fecha.localeCompare(b.fecha));
  else if(ui.evFil==='pasados') list=list.filter(e=>e.fecha<t).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  else list.sort((a,b)=>b.fecha.localeCompare(a.fecha));
  return `
    <div class="h2">Eventos ${isRO()?'':`<button class="btn sm primary" data-act="openEvento">+ Evento</button>`}</div>
    ${agendaSwitch()}
    <div class="kpis k3">
      ${kpi('Este año',all.filter(e=>String(e.fecha).startsWith(yr)).length)}
      ${kpi('Próximos',all.filter(e=>e.fecha>=t&&e.estado!=='cancelado').length,'',{color:'var(--b3)'})}
      ${kpi('Realizados',all.filter(e=>e.estado==='realizado').length,'',{color:'var(--b1)'})}
    </div>
    <div class="chips">${[['proximos','Próximos'],['pasados','Pasados'],['todos','Todos']].map(([id,l])=>`<button class="chip${ui.evFil===id?' on':''}" data-act="evFil" data-f="${id}">${l}</button>`).join('')}</div>
    ${list.length?`<div class="evlist">${list.map(e=>{ const d=parseYmd(e.fecha); return `<button class="ev-c" data-act="openEvento" data-id="${e.id}">
      <div class="ev-d"><b>${d.getDate()}</b><span>${MESES[d.getMonth()].slice(0,3)}</span></div>
      <div class="ev-i"><b>${esc(e.nombre)}</b><small>${esc([e.tipo,e.hora,e.lugar].filter(Boolean).join(' · '))}${e.participantes?' · '+(+e.participantes)+' participantes':''}${e.fc?' · Fitness Control':''}</small></div>
      ${pill(e.estado||'planificado',EST_EV_CLS[e.estado]||'info')}</button>`; }).join('')}</div>`
      :empty(ui.evFil==='proximos'?(isRO()?'No hay eventos próximos.':'No hay eventos próximos. Registra el siguiente con “+ Evento”.'):'No hay eventos en esta lista.')}`;
}

function openEvento(id,fecha,aidIn){
  const aid=aidIn||curArea(), e=id?(getPath(`data/${aid}/eventos/${id}`)||{}):{}, ro=isRO()||fcId(id), dis=ro?' disabled':'';
  openModal(`${mHead(id?(ro?'Evento':'Editar evento'):'Nuevo evento')}
    <label class="f"><span>Nombre del evento</span><input id="e_nombre" value="${esc(e.nombre)}"${dis}></label>
    <div class="two">
      <label class="f"><span>Fecha</span><input id="e_fecha" type="date" value="${esc(e.fecha||fecha||todayStr())}"${dis}></label>
      <label class="f"><span>Hora</span><input id="e_hora" type="time" value="${esc(e.hora)}"${dis}></label>
    </div>
    <label class="f"><span>Lugar</span><input id="e_lugar" value="${esc(e.lugar)}"${dis}></label>
    <div class="two">
      <label class="f"><span>Tipo</span><select id="e_tipo"${dis}>${opts(TIPOS_EV,e.tipo||TIPOS_EV[0])}</select></label>
      <label class="f"><span>Estado</span><select id="e_estado"${dis}>${opts(EST_EV,e.estado||'planificado')}</select></label>
    </div>
    <label class="f"><span>Participantes</span><input id="e_part" type="number" inputmode="numeric" min="0" value="${esc(e.participantes)}"${dis}></label>
    <label class="f"><span>Notas y resultados</span><textarea id="e_notas"${dis}>${esc(e.notas)}</textarea></label>
    ${ro?`<div class="btns"><button class="btn" data-act="closeModal">Cerrar</button></div>`:
    `<div class="btns"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="saveEvento" data-id="${esc(id||'')}">Guardar evento</button></div>
     ${id?`<div class="btns"><button class="btn danger" data-act="delEvento" data-id="${esc(id)}">Eliminar evento</button></div>`:''}`}`);
}

Object.assign(actions,{
  evFil(d){ ui.evFil=d.f; render(); },
  openEvento(d){ openEvento(d.id||'',d.fecha||''); },
  saveEvento(d){
    const aid=curArea(), nombre=$('#e_nombre').value.trim(), fecha=$('#e_fecha').value;
    if(!nombre){ toast('Escribe el nombre del evento'); return; }
    if(!fecha){ toast('Elige la fecha del evento'); return; }
    const id=d.id||('e'+uid()), prev=d.id?(getPath(`data/${aid}/eventos/${id}`)||{}):{};
    setPath(`data/${aid}/eventos/${id}`,{...prev,id,nombre,fecha,hora:$('#e_hora').value,lugar:$('#e_lugar').value.trim(),tipo:$('#e_tipo').value,estado:$('#e_estado').value,participantes:+$('#e_part').value||0,notas:$('#e_notas').value});
    closeModal(); render(); toast('Evento guardado');
  },
  delEvento(d){ if(!confirm('¿Eliminar este evento?')) return; setPath(`data/${curArea()}/eventos/${d.id}`,undefined); closeModal(); render(); toast('Evento eliminado'); }
});
