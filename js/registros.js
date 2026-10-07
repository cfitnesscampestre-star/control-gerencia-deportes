'use strict';
/* =====================================================================
   registros.js — Grupos: horarios, cupo, lista de alumnos y detalle.
   (La captura diaria de aforos vive en aforos.js.)
   ===================================================================== */
function gCard(aid,g){
  const af=aforoGrupo(aid,g,addDays(todayStr(),-30)), cls=aforoCls(af);
  const dias=diasArr(g).map(i=>DIAS[i]).join(' · ');
  return `<button class="gcard" data-act="grupoDetail" data-id="${g.id}" style="--ac:${areaColor(aid)}">
    <div class="g1"><div><b>${esc(g.nombre)}</b><small>${esc(g.prof||'Sin profesor asignado')}${tipoGrupoDe(g)==='servicio'?' · Servicio':' · Academia'}</small></div>
      <span class="pill ${cls}">${af==null?'sin registros':af+'%'}</span></div>
    <div class="g2"><div class="bar"><i class="${cls}" style="width:${Math.min(af||0,100)}%"></i></div></div>
    <div class="g3"><span>${esc(dias||'Sin días')} ${esc(horaTxt(g))}</span>${g.lugar?`<span>${esc(g.lugar)}</span>`:''}<span>${(inscritos(g)&&tipoGrupoDe(g)!=='servicio')?inscritos(g)+' inscritos · ':''}cupo ${+g.cupo||'—'}</span></div>
  </button>`;
}
/* Inscritos y lugares disponibles de los grupos de academia de esta disciplina (los grupos de servicio no tienen inscripción) */
function gruposResumen(aid){
  if(esFitArea(aid)) return '';
  const gs=grupos(aid).filter(g=>tipoGrupoDe(g)==='academia'&&(+g.cupo||0)>0); if(!gs.length) return '';
  const ins=gs.reduce((n,g)=>n+inscritos(g),0), cupo=gs.reduce((n,g)=>n+(+g.cupo||0),0), disp=gs.reduce((n,g)=>n+Math.max(0,(+g.cupo||0)-inscritos(g)),0);
  return `<div class="kpis k3 g-resumen">${kpi('Inscritos',ins,'alumnos',{color:'var(--b3)'})}${kpi('Lugares',cupo,'cupo total',{color:'var(--b2)'})}${kpi('Disponibles',disp,'lugares libres',{cls:disp===0?'bad':'ok',color:'var(--b1)'})}</div>`;
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
    ${gruposResumen(aid)}
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
  const asig=new Set(profsDeGrupo(g));
  const ps=profesores(aid).filter(p=>p.activo!==false||asig.has(p.id));
  const legacy=(!profsDeGrupo(g).length&&g.prof)?g.prof:'';
  const selDia=i=>gid?profsDeDia(g,i):(pidPre?[pidPre]:[]);
  openModal(`${mHead(gid?'Editar grupo':'Nuevo grupo')}
    <label class="f"><span>Nombre del grupo</span><input id="g_nombre" value="${esc(g.nombre)}" placeholder="Ej. Infantil 6 a 8 años"></label>
    <label class="f"><span>Tipo de grupo</span><select id="g_tg"><option value="academia"${tipoGrupoDe(g)==='servicio'?'':' selected'}>Academia · con costo, inscripción y lista de alumnos</option><option value="servicio"${tipoGrupoDe(g)==='servicio'?' selected':''}>Servicio · gratuito, sin inscripción</option></select>
      <small class="mut" id="g_tg_h"></small></label>
    <div class="f"><span class="lb">Días de clase</span><div class="dchips">${DIAS.map((d,i)=>`<button type="button" class="dchip${dias.includes(i)?' on':''}" data-act="togDia">${d}</button>`).join('')}</div></div>
    <div class="f" id="g_pd_w"><span class="lb">Horario y profesor de cada día</span>
      <small class="mut">Cada día puede tener su propio horario. Si marcas a dos profesores, el grupo les aparece a los dos ese día y comparten la misma lista y asistencia.${legacy?` Profesor anterior sin ficha: ${esc(legacy)}.`:''}</small>
      ${DIAS.map((dn,i)=>{ const h=horaEn(g,i); return `<div class="pd-row" data-d="${i}"${dias.includes(i)?'':' hidden'}><b>${esc(DIAS_L[i])}</b>
        <div class="pd-hor"><input type="time" class="pd-hi" value="${esc(h.hi)}" aria-label="Inicio ${esc(DIAS_L[i])}"><span>a</span><input type="time" class="pd-hf" value="${esc(h.hf)}" aria-label="Término ${esc(DIAS_L[i])}"></div>
        ${ps.length?`<div class="dchips">${ps.map(p=>`<button type="button" class="pchip${selDia(i).includes(p.id)?' on':''}" data-act="togPd" data-p="${esc(p.id)}">${esc(p.nombre)}</button>`).join('')}</div>`:''}</div>`; }).join('')}
      ${ps.length?'':'<small class="mut">Aún no hay profesores. Da de alta profesores en la pestaña Profesores.</small>'}</div>
    <label class="f"><span>Lugar o espacio</span><input id="g_lugar" value="${esc(g.lugar)}" placeholder="Ej. Cancha 2, alberca, salón"></label>
    <div class="two">
      <label class="f"><span>Cupo máximo (aforo)</span><input id="g_cupo" type="number" inputmode="numeric" min="0" value="${esc(g.cupo)}"></label>
      <label class="f" id="g_insc_w"><span>Alumnos inscritos</span><input id="g_insc" type="number" inputmode="numeric" min="0" value="${esc(g.inscritos)}"></label>
    </div>
    <div class="two">
      <label class="f"><span>Tipo de clase (opcional)</span><input id="g_tipo" list="dl_tipo" value="${esc(g.tipo)}" placeholder="Ej. Cardio, Fuerza, Infantil"><datalist id="dl_tipo">${['Cardio','Fuerza','Mente y cuerpo','Baile','Funcional','Ciclismo indoor','Acuática','Infantil','Juvenil','Adultos','Competitivo'].map(x=>`<option value="${x}">`).join('')}</datalist></label>
      <label class="f"><span>Nivel (opcional)</span><input id="g_nivel" list="dl_nivel" value="${esc(g.nivel)}" placeholder="Ej. Principiante"><datalist id="dl_nivel">${['Principiante','Intermedio','Avanzado','Competitivo','Todos los niveles'].map(x=>`<option value="${x}">`).join('')}</datalist></label>
    </div>
    <div class="f" id="g_alum_w"><span class="lb">Lista de alumnos: nombre y edad. El profesor pasa lista con estos nombres y de ahí sale el aforo. Si la llenas, los inscritos se cuentan solos.</span>
      <div class="al-tabla" id="al_tabla"><div class="al-h"><span>Nombre</span><span>Edad</span><span></span></div>${[...rosterAlum(g),{n:'',e:null}].map(alRow).join('')}</div>
      <button type="button" class="btn sm" data-act="alAdd">+ Agregar alumno</button>
      <details class="al-pegar"><summary>Pegar varios a la vez</summary>
        <textarea id="al_pegar" placeholder="Un alumno por línea: nombre, edad&#10;Ana López, 9&#10;Luis Pérez, 11"></textarea>
        <button type="button" class="btn sm" data-act="alPegar">Agregar a la tabla</button></details></div>
    <div class="btns"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="saveGrupo" data-id="${esc(gid||'')}">Guardar grupo</button></div>`);
  tgToggle();
}
/* Grupo de servicio: no lleva inscripción ni lista de alumnos; el profesor registra cuántas personas asistieron */
function tgToggle(){
  const s=$('#g_tg'); if(!s) return; const srv=s.value==='servicio';
  ['g_insc_w','g_alum_w'].forEach(i=>{ const e=$('#'+i); if(e) e.style.display=srv?'none':''; });
  const h=$('#g_tg_h'); if(h) h.textContent=srv?'Entra cualquier socio que se acerque. El profesor registra el número de asistentes de cada clase.':'Lleva costo y lista de alumnos. El profesor pasa lista con esos nombres.';
}
document.addEventListener('change',e=>{ if(e.target.id==='g_tg') tgToggle(); });
function grupoDetail(gid){
  const aid=curArea(), g=getPath(`data/${aid}/grupos/${gid}`); if(!g) return;
  const ro=roDatos(aid)||fcId(gid), af=aforoGrupo(aid,g,addDays(todayStr(),-30)), roster=rosterOf(g);
  const recs=coll(aid,'asistencia').filter(r=>r.grupoId===gid).sort((a,b)=>b.fecha.localeCompare(a.fecha)).slice(0,10);
  openModal(`${mHead(esc(g.nombre))}
    <div class="sub">${esc(g.prof||'Sin profesor asignado')}${g.nivel?' · '+esc(g.nivel):''}</div>
    <div class="card">
      <div class="row"><div><b>Horario</b><small>${esc(diasArr(g).map(i=>DIAS_L[i]).join(', ')||'Sin días')} · ${esc(horaTxt(g)||'sin hora')}</small></div></div>
      <div class="row"><div><b>Lugar</b><small>${esc(g.lugar||'Sin lugar')}</small></div></div>
      <div class="row"><div><b>Tipo de grupo</b><small>${tipoGrupoDe(g)==='servicio'?'Servicio · gratuito, sin inscripción':'Academia · con costo e inscripción'}</small></div></div>
      <div class="row"><div><b>${tipoGrupoDe(g)==='servicio'?'Cupo':'Cupo e inscritos'}</b><small>Cupo ${+g.cupo||'—'}${tipoGrupoDe(g)==='servicio'?'':` · ${inscritos(g)} inscritos`}</small></div></div>
      <div class="row"><div><b>Aforo, 30 días</b><small class="${aforoCls(af)}">${af==null?'Sin registros de asistencia':af+'%'}</small></div></div>
    </div>
    <div class="h2 sm">Asistencia reciente</div>
    ${recs.length?recs.map(r=>{ const info=regInfo(r,g);
      return `<div class="line" style="--ac:${areaColor(aid)}"><div class="t">${esc(fmtFecha(r.fecha))}</div><div class="b"><b>${r.omitida?'No hubo clase':(+r.asistentes||0)+' asistentes'}</b></div>
        <div class="r"><span class="${info.cls}">${r.omitida||info.p==null?'':info.p+'%'}</span>${r.lista?` <button class="btn sm" data-act="openLista" data-gid="${esc(gid)}" data-fecha="${esc(r.fecha)}">Lista</button>`:''}${ro?'':` <button class="btn sm danger" data-act="delAsist" data-rid="${esc(r.id)}" data-gid="${esc(gid)}" aria-label="Borrar registro">${ic('x')}</button>`}</div></div>`; }).join(''):empty('Aún no hay asistencia registrada.')}
    ${roster.length?(()=>{ const ed=edadesOf(g), es=Object.values(ed); return `<div class="h2 sm">Lista de alumnos (${roster.length})</div>${es.length?`<div class="sub" style="margin:0 0 6px">Edad promedio ${(es.reduce((a,b)=>a+b,0)/es.length).toFixed(1)} años · de ${Math.min(...es)} a ${Math.max(...es)}${es.length<roster.length?` · ${roster.length-es.length} sin edad`:''}</div>`:''}<div class="card al-ver"><div class="al-h"><span>Nombre</span><span>Edad</span></div>${roster.map(n=>`<div class="al-vr"><span>${esc(n)}</span><span>${ed[n]!=null?ed[n]:'—'}</span></div>`).join('')}</div>`; })():''}
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
  togDia(d,e){
    const b=e.target.closest('.dchip'); b.classList.toggle('on');
    const i=DIAS.indexOf(b.textContent.trim()), row=document.querySelector(`.pd-row[data-d="${i}"]`); if(!row) return;
    row.hidden=!b.classList.contains('on');
    if(!row.hidden){                                              // día nuevo: copia horario y profesores de otro día ya elegido
      const o=[...document.querySelectorAll('.pd-row:not([hidden])')].find(r=>r!==row&&(r.querySelector('.pchip.on')||r.querySelector('.pd-hi').value));
      if(o){
        if(!row.querySelector('.pd-hi').value){ row.querySelector('.pd-hi').value=o.querySelector('.pd-hi').value; row.querySelector('.pd-hf').value=o.querySelector('.pd-hf').value; }
        if(!row.querySelector('.pchip.on')) o.querySelectorAll('.pchip.on').forEach(c=>{ const m=row.querySelector(`.pchip[data-p="${c.dataset.p}"]`); if(m) m.classList.add('on'); });
      }
    }
  },
  togPd(d,e){ e.target.closest('.pchip').classList.toggle('on'); },
  saveGrupo(d){
    const aid=curArea(), nombre=$('#g_nombre').value.trim();
    if(!nombre){ toast('Escribe el nombre del grupo'); return; }
    const id=d.id||('g'+uid()), prev=d.id?(getPath(`data/${aid}/grupos/${id}`)||{}):{};
    const tg=($('#g_tg')||{}).value==='servicio'?'servicio':'academia';
    if(tg==='servicio'&&(prev.alumnos||alSerializa())&&!confirm('Como grupo de servicio no lleva lista de alumnos: se quitará la lista que tiene. ¿Continuar?')) return;
    const profDia={}, cuenta={}, horDia={}, mins=t=>{ const [h,m]=String(t||'').split(':').map(Number); return isNaN(h)?null:h*60+(m||0); };
    document.querySelectorAll('.pd-row').forEach(r=>{
      if(r.hidden) return; const wd=+r.dataset.d;
      const hi=r.querySelector('.pd-hi').value, hf=r.querySelector('.pd-hf').value; if(hi||hf) horDia['d'+wd]=hi+'|'+hf;
      const ids=[...r.querySelectorAll('.pchip.on')].map(b=>b.dataset.p); if(!ids.length) return;
      profDia['d'+wd]=ids.join(','); ids.forEach(x=>{ cuenta[x]=(cuenta[x]||0)+1; });
    });
    /* Aviso: un profesor con dos grupos a la misma hora el mismo día */
    const choques=[];
    Object.keys(horDia).forEach(k=>{
      const wd=+k.slice(1), [hi,hf]=horDia[k].split('|'), s1=mins(hi); if(s1==null) return; const e1=hf?mins(hf):s1+60;
      (profDia[k]||'').split(',').filter(Boolean).forEach(pid=>{
        grupos(aid).filter(o=>o.id!==id&&profsDeDia(o,wd).includes(pid)&&diasArr(o).includes(wd)).forEach(o=>{
          const h=horaEn(o,wd), s2=mins(h.hi); if(s2==null) return; const e2=h.hf?mins(h.hf):s2+60;
          if(s1<e2&&s2<e1) choques.push(`${(getProf(aid,pid)||{}).nombre||'Profesor'} · ${DIAS_L[wd]} ${hi}${hf?'–'+hf:''} · ya tiene “${o.nombre}” ${h.hi}${h.hf?'–'+h.hf:''}`);
        });
      });
    });
    if(choques.length&&!confirm('Este horario se cruza con otro grupo del mismo profesor:\n\n'+[...new Set(choques)].join('\n')+'\n\n¿Guardar de todos modos?')) return;
    const hPrim=Object.values(horDia)[0]||'|', [hi0,hf0]=hPrim.split('|');
    const todos=Object.keys(cuenta).sort((a,b)=>cuenta[b]-cuenta[a]);       // el de más días queda como principal (profId)
    const profId=todos[0]||'', prof=todos.length?profNombresDe(aid,todos):(!profsDeGrupo(prev).length?(prev.prof||''):'');
    setPath(`data/${aid}/grupos/${id}`,{...prev,creado:prev.creado||todayStr(),id,nombre,prof,profId,profDia,
      dias:[...document.querySelectorAll('.dchip.on')].map(b=>DIAS.indexOf(b.textContent)).join(','),
      hi:hi0,hf:hf0,horDia,lugar:$('#g_lugar').value.trim(),
      tipoGrupo:tg,cupo:+$('#g_cupo').value||0,inscritos:tg==='servicio'?0:(+$('#g_insc').value||0),tipo:$('#g_tipo').value.trim(),nivel:$('#g_nivel').value.trim(),alumnos:tg==='servicio'?'':alSerializa()});
    closeModal(); render(); toast('Grupo guardado');
  },
  delGrupo(d){
    if(!confirm('¿Eliminar este grupo y todo su historial de asistencia?\n\nSe guarda 30 días en la papelera (Ajustes) por si necesitas recuperarlo.')) return;
    const aid=curArea(), g=getPath(`data/${aid}/grupos/${d.id}`), regs=coll(aid,'asistencia').filter(r=>r.grupoId===d.id);
    if(g) setPath(`papelera/${aid}_${d.id}`,{tipo:'grupo',aid,gid:d.id,nombre:g.nombre||'',borrado:new Date().toISOString(),grupo:clean(g),asistencia:Object.fromEntries(regs.map(r=>[r.id,clean(r)]))});
    regs.forEach(r=>setPath(`data/${aid}/asistencia/${r.id}`,undefined));
    setPath(`data/${aid}/grupos/${d.id}`,undefined);
    closeModal(); render(); toast('Grupo enviado a la papelera');
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

/* ---------- tabla de alumnos: nombre y edad ---------- */
function alRow(x){
  return `<div class="al-row"><input class="al-n" value="${esc(x.n)}" placeholder="Nombre del alumno" autocomplete="off"><input class="al-e" type="number" inputmode="numeric" min="1" max="109" value="${x.e==null?'':x.e}" placeholder="Edad"><button type="button" class="ibtn" data-act="alDel" aria-label="Quitar alumno">${ic('x')}</button></div>`;
}
function alSerializa(){                                   // tabla → texto guardado ("Nombre|edad" por línea)
  return [...document.querySelectorAll('#al_tabla .al-row')].map(r=>{
    const n=r.querySelector('.al-n').value.replace(/\|/g,'/').trim(), e=parseInt(r.querySelector('.al-e').value,10);
    return n?(e>0&&e<110?`${n}|${e}`:n):'';
  }).filter(Boolean).join('\n');
}
function alAgrega(n,e,enfoca){
  const t=$('#al_tabla'); if(!t) return;
  t.insertAdjacentHTML('beforeend',alRow({n:n||'',e:e||null}));
  if(enfoca){ const f=t.querySelectorAll('.al-row'); const x=f[f.length-1].querySelector('.al-n'); if(x) x.focus(); }
}
Object.assign(actions,{
  alAdd(){ alAgrega('',null,true); },
  alDel(d,e){ const r=e&&e.target.closest('.al-row'); if(r) r.remove(); },
  alPegar(){
    const ta=$('#al_pegar'); if(!ta) return;
    const lineas=ta.value.split('\n').map(s=>s.trim()).filter(Boolean); let n=0;
    lineas.forEach(l=>{
      const m=l.match(/^(.*?)[\t,;|]\s*(\d{1,3})\s*(?:años?)?\s*$/i);
      const nom=(m?m[1]:l).trim(); if(!nom) return;
      alAgrega(nom,m?+m[2]:null,false); n++;
    });
    // quita filas vacías intermedias dejando una al final
    document.querySelectorAll('#al_tabla .al-row').forEach((r,i,all)=>{ if(!r.querySelector('.al-n').value.trim()&&!r.querySelector('.al-e').value&&i<all.length-1&&n) r.remove(); });
    ta.value=''; if(n) toast(`${n} ${n===1?'alumno agregado':'alumnos agregados'}`);
  }
});
document.addEventListener('keydown',e=>{                 // Enter en la edad abre un renglón nuevo
  if(e.key==='Enter'&&e.target.classList&&e.target.classList.contains('al-e')){ e.preventDefault(); alAgrega('',null,true); }
});
