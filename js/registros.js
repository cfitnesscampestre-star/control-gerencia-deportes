'use strict';
/* =====================================================================
   registros.js — Grupos: horarios, cupo, lista de alumnos y detalle.
   (La captura diaria de aforos vive en aforos.js.)
   ===================================================================== */
function gCard(aid,g){
  const af=aforoGrupo(aid,g,addDays(todayStr(),-30)), cls=aforoCls(af);
  const dias=diasArr(g).map(i=>DIAS[i]).join(' · ');
  return `<button class="gcard" data-act="grupoDetail" data-id="${g.id}" style="--ac:${areaColor(aid)}">
    <div class="g1"><div><b>${esc(g.nombre)}</b><small>${esc(g.prof||'Sin profesor asignado')}</small></div>
      <span class="pill ${cls}">${af==null?'sin registros':af+'%'}</span></div>
    <div class="g2"><div class="bar"><i class="${cls}" style="width:${Math.min(af||0,100)}%"></i></div></div>
    <div class="g3"><span>${esc(dias||'Sin días')} ${esc(horaTxt(g))}</span>${g.lugar?`<span>${esc(g.lugar)}</span>`:''}<span>${inscritos(g)?inscritos(g)+' inscritos · ':''}cupo ${+g.cupo||'—'}</span></div>
  </button>`;
}
function vGrupos(aid){
  const roD=roDatos(aid);
  let gs=grupos(aid);
  const total=gs.length;
  if(ui.gDia>=0) gs=gs.filter(g=>diasArr(g).includes(ui.gDia));
  gs.sort((a,b)=>{ const da=diasArr(a)[0], db=diasArr(b)[0]; return ((da==null?9:da)-(db==null?9:db)) || byHora(a,b); });
  return `
    <div class="h2">Grupos ${roD?'':`<button class="btn sm primary" data-act="openGrupo">+ Grupo</button>`}</div>
    ${vinculoBanner(aid)}
    ${gruposSwitch()}
    <div class="sub">El porcentaje es el aforo: asistencia promedio contra el cupo, últimos 30 días.</div>
    <div class="chips">
      <button class="chip${ui.gDia<0?' on':''}" data-act="gDia" data-d="-1">Todos</button>
      ${DIAS.map((d,i)=>`<button class="chip${ui.gDia===i?' on':''}" data-act="gDia" data-d="${i}">${d}</button>`).join('')}
    </div>
    ${gs.length?`<div class="glist">${gs.map(g=>gCard(aid,g)).join('')}</div>`:empty(total?'Ningún grupo con clase ese día.':(roD?'Esta área todavía no registra grupos.':'Aún no hay grupos. Agrega el primero con “+ Grupo”.'))}`;
}

function openGrupo(gid,pidPre){
  if(esVinculada(curArea())){ toast('Los grupos de esta área se administran en Fitness Control'); return; }
  const aid=curArea(), g=gid?(getPath(`data/${aid}/grupos/${gid}`)||{}):{}, dias=diasArr(g);
  const ps=profesores(aid).filter(p=>p.activo!==false||p.id===g.profId), cur=g.profId||pidPre||'';
  const legacy=(!g.profId&&g.prof)?g.prof:'';
  openModal(`${mHead(gid?'Editar grupo':'Nuevo grupo')}
    <label class="f"><span>Nombre del grupo</span><input id="g_nombre" value="${esc(g.nombre)}" placeholder="Ej. Infantil 6 a 8 años"></label>
    <label class="f"><span>Profesor</span><select id="g_profId"><option value="">Sin asignar</option>${legacy?`<option value="__legacy" selected>${esc(legacy)} (sin ficha)</option>`:''}${ps.map(p=>`<option value="${esc(p.id)}"${cur===p.id?' selected':''}>${esc(p.nombre)}</option>`).join('')}</select>${ps.length?'':'<small class="mut">Aún no hay profesores. Da de alta profesores en la pestaña Profesores.</small>'}</label>
    <div class="f"><span class="lb">Días de clase</span><div class="dchips">${DIAS.map((d,i)=>`<button type="button" class="dchip${dias.includes(i)?' on':''}" data-act="togDia">${d}</button>`).join('')}</div></div>
    <div class="two">
      <label class="f"><span>Hora de inicio</span><input id="g_hi" type="time" value="${esc(g.hi)}"></label>
      <label class="f"><span>Hora de término</span><input id="g_hf" type="time" value="${esc(g.hf)}"></label>
    </div>
    <label class="f"><span>Lugar o espacio</span><input id="g_lugar" value="${esc(g.lugar)}" placeholder="Ej. Cancha 2, alberca, salón"></label>
    <div class="two">
      <label class="f"><span>Cupo máximo (aforo)</span><input id="g_cupo" type="number" inputmode="numeric" min="0" value="${esc(g.cupo)}"></label>
      <label class="f"><span>Alumnos inscritos</span><input id="g_insc" type="number" inputmode="numeric" min="0" value="${esc(g.inscritos)}"></label>
    </div>
    <div class="two">
      <label class="f"><span>Tipo de clase (opcional)</span><input id="g_tipo" list="dl_tipo" value="${esc(g.tipo)}" placeholder="Ej. Cardio, Fuerza, Infantil"><datalist id="dl_tipo">${['Cardio','Fuerza','Mente y cuerpo','Baile','Funcional','Ciclismo indoor','Acuática','Infantil','Juvenil','Adultos','Competitivo'].map(x=>`<option value="${x}">`).join('')}</datalist></label>
      <label class="f"><span>Nivel (opcional)</span><input id="g_nivel" list="dl_nivel" value="${esc(g.nivel)}" placeholder="Ej. Principiante"><datalist id="dl_nivel">${['Principiante','Intermedio','Avanzado','Competitivo','Todos los niveles'].map(x=>`<option value="${x}">`).join('')}</datalist></label>
    </div>
    <label class="f"><span>Lista de alumnos, uno por línea. El profesor pasa lista con estos nombres y de ahí sale el aforo. Si la llenas, los inscritos se cuentan solos.</span><textarea id="g_alum" style="min-height:130px">${esc(g.alumnos)}</textarea></label>
    <div class="btns"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="saveGrupo" data-id="${esc(gid||'')}">Guardar grupo</button></div>`);
}
function grupoDetail(gid){
  const aid=curArea(), g=getPath(`data/${aid}/grupos/${gid}`); if(!g) return;
  const ro=roDatos(aid)||fcId(gid), af=aforoGrupo(aid,g,addDays(todayStr(),-30)), roster=rosterOf(g);
  const recs=coll(aid,'asistencia').filter(r=>r.grupoId===gid).sort((a,b)=>b.fecha.localeCompare(a.fecha)).slice(0,10);
  openModal(`${mHead(esc(g.nombre))}
    <div class="sub">${esc(g.prof||'Sin profesor asignado')}${g.nivel?' · '+esc(g.nivel):''}</div>
    <div class="card">
      <div class="row"><div><b>Horario</b><small>${esc(diasArr(g).map(i=>DIAS_L[i]).join(', ')||'Sin días')} · ${esc(horaTxt(g)||'sin hora')}</small></div></div>
      <div class="row"><div><b>Lugar</b><small>${esc(g.lugar||'Sin lugar')}</small></div></div>
      <div class="row"><div><b>Cupo e inscritos</b><small>Cupo ${+g.cupo||'—'} · ${inscritos(g)} inscritos</small></div></div>
      <div class="row"><div><b>Aforo, 30 días</b><small class="${aforoCls(af)}">${af==null?'Sin registros de asistencia':af+'%'}</small></div></div>
    </div>
    <div class="h2 sm">Asistencia reciente</div>
    ${recs.length?recs.map(r=>{ const info=regInfo(r,g);
      return `<div class="line" style="--ac:${areaColor(aid)}"><div class="t">${esc(fmtFecha(r.fecha))}</div><div class="b"><b>${r.omitida?'No hubo clase':(+r.asistentes||0)+' asistentes'}</b></div>
        <div class="r"><span class="${info.cls}">${r.omitida||info.p==null?'':info.p+'%'}</span>${r.lista?` <button class="btn sm" data-act="openLista" data-gid="${esc(gid)}" data-fecha="${esc(r.fecha)}">Lista</button>`:''}${ro?'':` <button class="btn sm danger" data-act="delAsist" data-rid="${esc(r.id)}" data-gid="${esc(gid)}" aria-label="Borrar registro">${ic('x')}</button>`}</div></div>`; }).join(''):empty('Aún no hay asistencia registrada.')}
    ${roster.length?`<div class="h2 sm">Lista de alumnos (${roster.length})</div><div class="card">${roster.map(n=>`<div class="row"><div>${esc(n)}</div></div>`).join('')}</div>`:''}
    ${ro?`<div class="btns"><button class="btn" data-act="closeModal">Cerrar</button></div>`:`
    ${roster.length?`<div class="btns"><button class="btn primary" data-act="openLista" data-gid="${esc(gid)}" data-fecha="${todayStr()}">Pasar lista de hoy</button></div>`:''}
    <div class="btns"><button class="btn" data-act="openAsist" data-id="${esc(gid)}">Registrar asistencia de otra fecha</button></div>
    <div class="btns"><button class="btn" data-act="openGrupo" data-id="${esc(gid)}">Editar</button><button class="btn danger" data-act="delGrupo" data-id="${esc(gid)}">Eliminar</button></div>`}`);
}

/* ----- asistencia de una fecha cualquiera (para el día de hoy usa la pestaña Aforos) ----- */
function openAsist(gid,fecha){
  const aid=curArea(), g=getPath(`data/${aid}/grupos/${gid}`); if(!g) return;
  fecha=fecha||todayStr();
  const r=getPath(`data/${aid}/asistencia/${gid}_${fecha}`);
  openModal(`${mHead('Registrar asistencia')}
    <div class="sub">${esc(g.nombre)} · cupo ${+g.cupo||'sin definir'}</div>
    <label class="f"><span>Fecha de la clase</span><input id="as_f" type="date" value="${esc(fecha)}"></label>
    <div class="f"><span class="lb">Asistentes</span>
      <div class="stepper"><button class="ibtn" data-act="asStep" data-n="-1" aria-label="Menos">−</button>
      <input id="as_n" type="number" inputmode="numeric" min="0" value="${r&&!r.omitida?+r.asistentes:''}" data-gid="${esc(gid)}" data-cupo="${+g.cupo||0}">
      <button class="ibtn" data-act="asStep" data-n="1" aria-label="Más">+</button></div></div>
    <div class="pv" id="as_pv"></div>
    <div class="btns"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="saveAsist" data-id="${esc(gid)}">Guardar asistencia</button></div>`);
  asPv();
}
function asPv(){
  const n=$('#as_n'); if(!n) return;
  const cupo=+n.dataset.cupo||0, v=+n.value||0, p=cupo>0?Math.round(v/cupo*100):null;
  $('#as_pv').innerHTML = n.value===''?'' : p==null ? '<small class="mut">Este grupo no tiene cupo definido, no se puede calcular el aforo.</small>'
    : `<div class="bar"><i class="${aforoCls(p)}" style="width:${Math.min(p,100)}%"></i></div><small class="${aforoCls(p)}">${p}% del aforo (${v} de ${cupo})</small>`;
}
function asDate(){
  const n=$('#as_n'), aid=curArea(); if(!n) return;
  const r=getPath(`data/${aid}/asistencia/${n.dataset.gid}_${$('#as_f').value}`);
  n.value=r&&!r.omitida?+r.asistentes:''; asPv();
}
document.addEventListener('input',e=>{ if(e.target.id==='as_n') asPv(); });
document.addEventListener('change',e=>{ if(e.target.id==='as_f') asDate(); });

Object.assign(actions,{
  gDia(d){ ui.gDia=+d.d; render(); },
  openGrupo(d){ if(!isRO()&&!isProf()) openGrupo(d.id||'',d.pid||''); },
  grupoDetail(d){ grupoDetail(d.id); },
  togDia(d,e){ e.target.closest('.dchip').classList.toggle('on'); },
  saveGrupo(d){
    const aid=curArea(), nombre=$('#g_nombre').value.trim();
    if(!nombre){ toast('Escribe el nombre del grupo'); return; }
    const id=d.id||('g'+uid()), prev=d.id?(getPath(`data/${aid}/grupos/${id}`)||{}):{};
    const sel=$('#g_profId').value; let profId='', prof='';
    if(sel==='__legacy') prof=prev.prof||''; else if(sel){ const pr=getProf(aid,sel); profId=sel; prof=pr?pr.nombre:''; }
    setPath(`data/${aid}/grupos/${id}`,{...prev,creado:prev.creado||todayStr(),id,nombre,prof,profId,
      dias:[...document.querySelectorAll('.dchip.on')].map(b=>DIAS.indexOf(b.textContent)).join(','),
      hi:$('#g_hi').value,hf:$('#g_hf').value,lugar:$('#g_lugar').value.trim(),
      cupo:+$('#g_cupo').value||0,inscritos:+$('#g_insc').value||0,tipo:$('#g_tipo').value.trim(),nivel:$('#g_nivel').value.trim(),alumnos:$('#g_alum').value});
    closeModal(); render(); toast('Grupo guardado');
  },
  delGrupo(d){
    if(!confirm('¿Eliminar este grupo y todo su historial de asistencia?')) return;
    const aid=curArea();
    coll(aid,'asistencia').filter(r=>r.grupoId===d.id).forEach(r=>setPath(`data/${aid}/asistencia/${r.id}`,undefined));
    setPath(`data/${aid}/grupos/${d.id}`,undefined);
    closeModal(); render(); toast('Grupo eliminado');
  },
  openAsist(d){ openAsist(d.id); },
  asStep(d){ const i=$('#as_n'); i.value=Math.max(0,(+i.value||0)+(+d.n)); asPv(); },
  saveAsist(d){
    const aid=curArea(), fecha=$('#as_f').value, n=$('#as_n').value;
    if(!fecha){ toast('Elige la fecha de la clase'); return; }
    if(n===''){ toast('Captura cuántos asistieron'); return; }
    const id=`${d.id}_${fecha}`;
    setPath(`data/${aid}/asistencia/${id}`,{id,grupoId:d.id,fecha,asistentes:Math.max(0,+n||0)});
    closeModal(); render(); toast('Asistencia guardada');
  },
  delAsist(d){ setPath(`data/${curArea()}/asistencia/${d.rid}`,undefined); render(); grupoDetail(d.gid); toast('Registro borrado'); }
});
