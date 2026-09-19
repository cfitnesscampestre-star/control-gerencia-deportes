'use strict';
/* =====================================================================
   aforos.js — captura rápida de aforos por disciplina.
   Celular (< 900 px): una tarjeta grande por clase, con − / + para el pulgar.
   Computadora (≥ 900 px): tabla; Enter salta a la siguiente clase.
   Todo se guarda solo, unos instantes después de cada cambio.
   ===================================================================== */
const AF_TXT = {none:'Sin captura',saving:'Guardando…',saved:'Guardado ✔',skip:'No hubo clase'};
const afTimers = {};
const afPending = new Set();                        // capturas que aún no se guardan
const afBusy = () => afPending.size>0;

const afRecs = (aid,fecha) => Object.fromEntries(coll(aid,'asistencia').filter(r=>r.fecha===fecha).map(r=>[r.grupoId,r]));
function afList(aid,fecha){
  const all=grupos(aid), wd=wdIdx(fecha);
  return {
    total:all.length,
    prog:all.filter(g=>diasArr(g).includes(wd)).sort(byHora),
    otros:ui.afTodos?all.filter(g=>!diasArr(g).includes(wd)).sort(byHora):[]
  };
}
function afSummary(aid,fecha){
  const {prog}=afList(aid,fecha), recs=afRecs(aid,fecha);
  const gs=Object.fromEntries(grupos(aid).map(g=>[g.id,g]));
  const list=Object.values(recs).filter(r=>gs[r.grupoId]);
  const cap=prog.filter(g=>recs[g.id]).length;
  const vals=list.filter(r=>!r.omitida&&+gs[r.grupoId].cupo>0).map(r=>(+r.asistentes||0)/(+gs[r.grupoId].cupo)*100);
  const p=vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):null;
  const tot=list.filter(r=>!r.omitida).reduce((s,r)=>s+(+r.asistentes||0),0);
  return `<div class="kpis k3">
    ${kpi('Capturadas',`${cap}/${prog.length}`,'clases del día',{cls:prog.length&&cap===prog.length?'ok':''})}
    ${kpi('Aforo del día',p==null?'—':p+'%','promedio',{cls:aforoCls(p),color:'var(--b1)'})}
    ${kpi('Asistentes',tot,'en total',{color:'var(--b3)'})}</div>`;
}

/* ----- tarjeta (celular) ----- */
function afCard(g,r,ro,fecha){
  const info=regInfo(r,g), done=info.tipo==='ok', skip=info.tipo==='skip', cupo=+g.cupo||0, lista=!!(r&&r.lista&&done), nAl=rosterOf(g).length;
  const st=skip?'skip':done?'saved':'none', v=done?(+r.asistentes||0):'';
  let mid;
  if(lista){
    mid=`<div class="afc-lista"><b>${v}</b><span>de ${cupo||'—'} · ${(r.presentes||[]).length} presentes · ${(r.ausentes||[]).length} faltas</span></div>
      <div class="afc-q"><button class="primary" data-act="openLista" data-gid="${esc(g.id)}" data-fecha="${esc(fecha)}">${ro?'Ver lista':'Editar lista'}</button>${ro?'':`<button data-act="afOmit" data-gid="${esc(g.id)}">No hubo clase</button>`}</div>`;
  } else if(ro){
    mid=`<div class="afc-ro"><span>${skip?'No hubo clase':done?`${v} de ${cupo||'—'} asistentes`:'Sin captura'}</span></div>`;
  } else {
    mid=`<div class="afc-c">
      <button class="afc-b" data-act="afStep" data-gid="${esc(g.id)}" data-n="-1" aria-label="Uno menos">−</button>
      <div class="afc-v"><input class="af-input" type="number" inputmode="numeric" min="0" data-gid="${esc(g.id)}" value="${v}" placeholder="0" aria-label="Asistentes de ${esc(g.nombre)}"><span>de ${cupo||'—'}</span></div>
      <button class="afc-b" data-act="afStep" data-gid="${esc(g.id)}" data-n="1" aria-label="Uno más">+</button>
    </div>
    <div class="afc-q">
      <button data-act="afStep" data-gid="${esc(g.id)}" data-n="-5">−5</button>
      <button data-act="afStep" data-gid="${esc(g.id)}" data-n="5">+5</button>
      <button data-act="afFull" data-gid="${esc(g.id)}">Lleno</button>
      <button data-act="afOmit" data-gid="${esc(g.id)}" class="${skip?'on':''}">No hubo clase</button>
    </div>
    ${nAl?`<div class="afc-q"><button class="primary" data-act="openLista" data-gid="${esc(g.id)}" data-fecha="${esc(fecha)}">Pasar lista (${nAl} alumnos)</button></div>`:''}`;
  }
  return `<div class="af-row afc" data-gid="${esc(g.id)}" data-st="${st}">
    <div class="afc-h"><span class="afc-t">${esc(g.hi||'—')}</span>
      <div class="afc-n"><b>${esc(g.nombre)}</b><small>${esc([g.prof,g.lugar].filter(Boolean).join(' · ')||'Sin profesor')}</small></div>
      <span class="af-state">${AF_TXT[st]}</span></div>
    ${mid}
    <div class="afc-f"><div class="bar af-bar"><i class="${info.cls}" style="width:${Math.min(info.p||0,100)}%"></i></div><span class="af-pct ${info.cls}">${info.p==null?'—':info.p+'%'}</span></div>
  </div>`;
}

/* ----- fila de tabla (computadora) ----- */
function afTr(g,r,ro,fecha){
  const info=regInfo(r,g), done=info.tipo==='ok', skip=info.tipo==='skip', cupo=+g.cupo||0, lista=!!(r&&r.lista&&done), nAl=rosterOf(g).length;
  const st=skip?'skip':done?'saved':'none', v=done?(+r.asistentes||0):'';
  const celda = lista ? `<span class="num"><b>${v}</b></span> <span class="pill info">lista</span>`
    : ro ? `<span class="num">${skip?'—':(v===''?'—':v)}</span>`
    : `<input class="af-input" type="number" inputmode="numeric" min="0" data-gid="${esc(g.id)}" value="${v}" aria-label="Asistentes de ${esc(g.nombre)}">`;
  const acts = ro ? (lista?`<div class="af-acts"><button class="btn sm" data-act="openLista" data-gid="${esc(g.id)}" data-fecha="${esc(fecha)}">Ver lista</button></div>`:'')
    : `<div class="af-acts">${lista?`<button class="btn sm primary" data-act="openLista" data-gid="${esc(g.id)}" data-fecha="${esc(fecha)}">Editar lista</button>`
        :`${nAl?`<button class="btn sm primary" data-act="openLista" data-gid="${esc(g.id)}" data-fecha="${esc(fecha)}">Pasar lista</button>`:''}<button class="btn sm" data-act="afFull" data-gid="${esc(g.id)}">Lleno</button>`}<button class="btn sm${skip?' primary':''}" data-act="afOmit" data-gid="${esc(g.id)}">No hubo clase</button></div>`;
  return `<tr class="af-row" data-gid="${esc(g.id)}" data-st="${st}">
    <td class="num">${esc(horaTxt(g)||'—')}</td>
    <td><b>${esc(g.nombre)}</b><small>${esc(g.nivel||'')}</small></td>
    <td>${esc(g.prof||'—')}</td>
    <td>${esc(g.lugar||'—')}</td>
    <td class="num">${cupo||'—'}</td>
    <td>${celda}</td>
    <td><div class="af-cell"><div class="bar af-bar"><i class="${info.cls}" style="width:${Math.min(info.p||0,100)}%"></i></div><span class="af-pct ${info.cls}">${info.p==null?'—':info.p+'%'}</span></div></td>
    <td><span class="af-state">${AF_TXT[st]}</span></td>
    <td>${acts}</td>
  </tr>`;
}

function vAforos(aid){
  const fecha=ui.afFecha, ro=roDatos(aid), desk=isDesktop();
  const {prog,otros,total}=afList(aid,fecha), recs=afRecs(aid,fecha);
  const nav=`<div class="af-date">
    <button class="ibtn" data-act="afNav" data-n="-1" aria-label="Día anterior">${ic('back')}</button>
    <b>${esc(fmtLarga(fecha))}</b>
    <button class="ibtn" data-act="afNav" data-n="1" aria-label="Día siguiente">${ic('next')}</button>
    <input class="only-d" type="date" id="af_date" value="${esc(fecha)}" aria-label="Elegir fecha">
    <button class="btn sm" data-act="afHoy">Hoy</button></div>`;
  const chips=total?`<div class="chips"><button class="chip${ui.afTodos?' on':''}" data-act="afTodos">${ui.afTodos?'Mostrando todos los grupos':'Mostrar todos los grupos'}</button></div>`:'';
  const lista=[...prog,...otros];
  let body;
  if(!total) body=empty(ro?'Esta área todavía no registra grupos.':'Primero crea tus grupos en la pestaña Grupos, con su cupo y horario.');
  else if(!lista.length) body=empty('No hay grupos programados este día. Activa “Mostrar todos los grupos” para capturar una clase extra.');
  else if(desk){
    body=`<div class="af-wrap"><table class="af-table"><thead><tr><th>Horario</th><th>Grupo</th><th>Profesor</th><th>Lugar</th><th>Cupo</th><th>Asistentes</th><th>Aforo</th><th>Estado</th><th></th></tr></thead>
      <tbody>${lista.map(g=>afTr(g,recs[g.id],ro||fcId(g.id),fecha)).join('')}</tbody></table></div>`;
  } else {
    body=prog.map(g=>afCard(g,recs[g.id],ro||fcId(g.id),fecha)).join('')
      + (otros.length?`<div class="h2 sm">Otros grupos</div>`+otros.map(g=>afCard(g,recs[g.id],ro||fcId(g.id),fecha)).join(''):'');
  }
  return `<div class="h2">Aforos</div>
    ${vinculoBanner(aid)}
    <div class="sub">${ro?'Consulta de aforos capturados por la dirección del área.':'Captura cuántas personas asistieron a cada clase. Se guarda solo.'}</div>
    ${nav}<div class="af-sum">${afSummary(aid,fecha)}</div>${chips}${body}`;
}

/* ----- captura y guardado automático ----- */
const afRow = gid => document.querySelector(`.af-row[data-gid="${gid}"]`);
function afPaint(gid,val,st){                       // actualiza la fila en pantalla sin redibujar todo
  const g=getPath(`data/${curArea()}/grupos/${gid}`)||{}, cupo=+g.cupo||0;
  const p=(val!=null&&cupo>0)?Math.round(val/cupo*100):null, cls=aforoCls(p);
  document.querySelectorAll(`.af-row[data-gid="${gid}"]`).forEach(row=>{
    row.dataset.st=st;
    const pc=row.querySelector('.af-pct'); if(pc){ pc.textContent=p==null?'—':p+'%'; pc.className='af-pct '+cls; }
    const bi=row.querySelector('.af-bar i'); if(bi){ bi.className=cls; bi.style.width=Math.min(p||0,100)+'%'; }
    const s=row.querySelector('.af-state'); if(s) s.textContent=AF_TXT[st]||'';
    const ob=row.querySelector('[data-act=afOmit]'); if(ob) ob.classList.toggle('on',st==='skip');
  });
}
function afUpdateSum(){ const el=$('.af-sum'); if(el) el.innerHTML=afSummary(curArea(),ui.afFecha); }
function afCommit(aid,gid,fecha,val){
  const id=`${gid}_${fecha}`;
  afPending.delete(gid);
  setPath(`data/${aid}/asistencia/${id}`,{id,grupoId:gid,fecha,asistentes:Math.max(0,Math.round(+val||0))});
  if(aid===curArea()&&fecha===ui.afFecha){ afPaint(gid,val,'saved'); afUpdateSum(); }
  if(pendingRender&&!afBusy()){ pendingRender=false; safeRender(); }
}
function afQueue(gid,val,delay){
  clearTimeout(afTimers[gid]);
  const aid=curArea(), fecha=ui.afFecha;
  afPending.add(gid);
  afTimers[gid]=setTimeout(()=>afCommit(aid,gid,fecha,val),delay);
}
function afSetValue(gid,val,delay){
  val=Math.max(0,Math.round(+val||0));
  const row=afRow(gid), inp=row&&row.querySelector('.af-input'); if(inp) inp.value=val;
  afPaint(gid,val,'saving'); afQueue(gid,val,delay==null?350:delay);
}

Object.assign(actions,{
  afNav(d){ ui.afFecha=addDays(ui.afFecha,+d.n); render(); },
  afHoy(){ ui.afFecha=todayStr(); render(); },
  afTodos(){ ui.afTodos=!ui.afTodos; render(); },
  afStep(d){
    const row=afRow(d.gid), inp=row&&row.querySelector('.af-input'); if(!inp) return;
    afSetValue(d.gid,(inp.value===''?0:+inp.value)+(+d.n));
  },
  afFull(d){
    const g=getPath(`data/${curArea()}/grupos/${d.gid}`)||{};
    const rec=getPath(`data/${curArea()}/asistencia/${d.gid}_${ui.afFecha}`);
    if(rec&&rec.lista){ toast('Esta clase tiene lista de asistencia: edítala con “Editar lista”'); return; }
    if(!(+g.cupo>0)){ toast('Este grupo no tiene cupo definido'); return; }
    afSetValue(d.gid,+g.cupo,150);
  },
  afOmit(d){
    const aid=curArea(), fecha=ui.afFecha, id=`${d.gid}_${fecha}`, rec=getPath(`data/${aid}/asistencia/${id}`);
    clearTimeout(afTimers[d.gid]); afPending.delete(d.gid);
    const row=afRow(d.gid), inp=row&&row.querySelector('.af-input'); if(inp) inp.value='';
    if(rec&&rec.omitida){ setPath(`data/${aid}/asistencia/${id}`,undefined); afPaint(d.gid,null,'none'); }
    else { setPath(`data/${aid}/asistencia/${id}`,{id,grupoId:d.gid,fecha,asistentes:0,omitida:true}); afPaint(d.gid,null,'skip'); }
    afUpdateSum();
  }
});

document.addEventListener('input',e=>{
  const t=e.target; if(!t.classList||!t.classList.contains('af-input')) return;
  if(t.value===''){ afPaint(t.dataset.gid,null,'none'); return; }
  afPaint(t.dataset.gid,+t.value,'saving'); afQueue(t.dataset.gid,+t.value,700);
});
document.addEventListener('change',e=>{
  if(e.target.id==='af_date'&&e.target.value){ ui.afFecha=e.target.value; render(); }
});
document.addEventListener('keydown',e=>{                       // Enter salta a la siguiente clase (tabla)
  const t=e.target; if(e.key!=='Enter'||!t.classList||!t.classList.contains('af-input')) return;
  e.preventDefault();
  const all=[...document.querySelectorAll('.af-input')], nx=all[all.indexOf(t)+1]||t;
  nx.focus(); if(nx.select) nx.select();
});
