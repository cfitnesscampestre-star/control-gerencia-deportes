'use strict';
/* =====================================================================
   portal.js — lo que ve el profesor al entrar con su PIN:
   la clase que toca por horario y día, para pasar lista, y su horario.
   ===================================================================== */
const minutos = t => { const [h,m]=String(t||'').split(':').map(Number); return isNaN(h)?null:h*60+(m||0); };

function claseActual(gs,fecha){                       // clase en curso o la próxima de hoy
  if(fecha!==todayStr()) return null;
  const now=new Date(), m=now.getHours()*60+now.getMinutes();
  for(const g of gs){
    const s=minutos(g.hi), e=g.hf?minutos(g.hf):(s==null?null:s+60);
    if(s!=null&&e!=null&&m>=s&&m<=e) return {g,estado:'curso'};
  }
  for(const g of gs){ const s=minutos(g.hi); if(s!=null&&s>m) return {g,estado:'proxima'}; }
  return null;
}
function viewProfesor(){
  const a=getArea(session.area), p=getProf(session.area,session.profId);
  const srv=esServ(session.area), gim=esGim(session.area);
  const mant = ui.pTab==='mant' && typeof mantProfActivo==='function' && mantProfActivo();      // pestaña Mantenimiento (reportar equipo)
  if(ui.pTab==='mant'&&!mant) ui.pTab='hoy';
  const avisoMant = (!mant&&typeof mantAvisoProf==='function') ? mantAvisoProf() : '';
  const body = ui.rufier ? vRufier() : (typeof fzBanner==='function'?fzBanner():'') + metBanner() + (mant ? vMantProf() : avisoMant + (srv ? vServProf() : gim ? vGimProf() : ui.lista ? vLista() : (ui.pTab==='horario' ? vProfHorario() : vProfHoy())));
  return shell({title:esc(p.nombre),sub:`${srv?pfNom(session.area,0):gim?'Instructor':'Profesor'} · ${areaIco(a,{size:14})} ${esc(a.nombre)}`,body,back:(!mant&&!srv&&!gim&&ui.lista)?'listaBack':null,fs:(!mant&&!srv&&!gim&&!!ui.lista)||!!ui.rufier});
}

function vProfHoy(){
  const aid=session.area, pid=session.profId, fecha=ui.pFecha, hoy=fecha===todayStr();
  const gs=clasesDe(aid,pid).filter(g=>progEn(g,fecha)&&daClase(g,pid,fecha)).map(g=>gDia(g,fecha)).sort(byHora);
  const recs=Object.fromEntries(coll(aid,'asistencia').filter(r=>r.fecha===fecha).map(r=>[r.grupoId,r]));
  const hechas=gs.filter(g=>recs[g.id]).length;
  const act=claseActual(gs,fecha);
  const nav=`<div class="af-date">
    <button class="ibtn" data-act="pNav" data-n="-1" aria-label="Día anterior">${ic('back')}</button>
    <b>${esc(fmtLarga(fecha))}</b>
    <button class="ibtn" data-act="pNav" data-n="1" aria-label="Día siguiente">${ic('next')}</button>
    <button class="btn sm" data-act="pHoy">Hoy</button></div>`;
  let hero='';
  if(act){
    const g=act.g, n=rosterOf(g).length;
    hero=`<div class="hero">
      <div class="hero-t"><span>${act.estado==='curso'?'Clase en curso':'Próxima clase'}</span><b>${esc(g.nombre)}</b>
        <span>${esc(horaTxt(g))}${g.lugar?' · '+esc(g.lugar):''} · ${tipoGrupoDe(g)==='servicio'?'Servicio':plu(n,'alumno','alumnos')}</span></div>
      <div class="hero-bs">${n&&!esVinculada(aid)&&!fcId(g.id)
        ?`<button class="hero-b" data-act="openListaRapida" data-gid="${esc(g.id)}" data-fecha="${esc(fecha)}">${ic('bolt')} Pasar lista</button><button class="hero-b2" data-act="openLista" data-gid="${esc(g.id)}" data-fecha="${esc(fecha)}">Lista completa</button>`
        :`<button class="hero-b" data-act="openLista" data-gid="${esc(g.id)}" data-fecha="${esc(fecha)}">${tipoGrupoDe(g)==='servicio'?'Registrar asistentes':'Pasar lista'}</button>`}</div></div>`;
  }
  const atr=hoy?listasAtrasadas(aid,pid):[];
  return `
    ${atr.length?`<div class="card pf-atr"><div class="pf-atr-h"><b>${atr.length===1?'Te falta 1 lista':`Te faltan ${atr.length} listas`}</b><small>de los últimos días. Pásalas para que tu asistencia cuente.</small></div>
      ${atr.slice(0,5).map(x=>`<button class="pf-atr-r" data-act="${rosterOf(x.g).length?'openListaRapida':'openLista'}" data-gid="${esc(x.g.id)}" data-fecha="${esc(x.f)}"><span>${esc(fmtFecha(x.f))} · ${esc(x.g.hi||'')}</span><b>${esc(x.g.nombre)}</b><em>Pasar ${ic('next')}</em></button>`).join('')}
      ${atr.length>5?`<small class="mut">y ${atr.length-5} más: usa las flechas de fecha para llegar a ellas.</small>`:''}</div>`:''}
    <div class="sub">${hoy?'Estas son tus clases de hoy. La que va según el horario aparece arriba.':'Estás viendo otro día.'}</div>
    ${nav}
    <div class="kpis k3" style="grid-template-columns:repeat(2,1fr)">
      ${kpi('Clases del día',gs.length,'programadas para ti',{color:'var(--b3)'})}
      ${kpi('Listas pasadas',`${hechas}/${gs.length}`,gs.length&&hechas===gs.length?'Todo al día':'Faltan por pasar',{cls:gs.length&&hechas===gs.length?'ok':'',color:'var(--b1)'})}
    </div>
    ${hero?`<div class="h2">Ahora</div>${hero}`:''}
    <div class="h2">Mis clases</div>
    ${gs.length?gs.map(g=>{
      const r=recs[g.id], info=regInfo(r,g), n=rosterOf(g).length;
      const rapida=n&&!esVinculada(aid)&&!fcId(g.id);
      return `<div class="pcl${rapida?' con-rapida':''}"><button class="line" style="--ac:${areaColor(aid)}" data-act="openLista" data-gid="${esc(g.id)}" data-fecha="${esc(fecha)}">
        <div class="t">${esc(g.hi||'—')}</div>
        <div class="b"><b>${esc(g.nombre)}</b><small>${esc(g.lugar||'Sin lugar')} · ${plu(n,'alumno','alumnos')}${(()=>{ const otros=profsDeDia(g,wdIdx(fecha)).filter(x=>x!==pid).map(x=>(getProf(aid,x)||{}).nombre).filter(Boolean); return otros.length?' · con '+esc(otros.join(', ')):''; })()}</small></div>
        <div class="r">${r?`<span class="${info.cls}">${esc(info.txt)}${info.p!=null?'<br>'+info.p+'%':''}${r.porProf&&r.porProf!==pid&&r.porNom&&!r.omitida?`<br><small>lista de ${esc(r.porNom)}</small>`:''}</span>`:'<span class="warn">Pendiente</span>'}</div></button>
        ${rapida?`<button class="pcl-rapida" data-act="openListaRapida" data-gid="${esc(g.id)}" data-fecha="${esc(fecha)}" aria-label="Lista rápida de ${esc(g.nombre)}">${ic('bolt')} Lista rápida</button>`:''}</div>`;
    }).join(''):empty('No tienes clases programadas este día.')}`;
}

/* clases del profesor de los últimos 7 días (sin hoy) que no tienen lista ni “no hubo clase” */
function listasAtrasadas(aid,pid){
  const t=todayStr(), hay=new Set(coll(aid,'asistencia').filter(r=>r.fecha>=addDays(t,-7)).map(r=>r.grupoId+'|'+r.fecha)), out=[];
  for(let k=7;k>=1;k--){
    const f=addDays(t,-k);
    clasesDe(aid,pid).filter(g=>progEn(g,f)&&daClase(g,pid,f)&&!(g.creado&&g.creado>f)&&!hay.has(g.id+'|'+f)).map(g=>gDia(g,f)).sort(byHora).forEach(g=>out.push({g,f}));
  }
  return out.reverse();                                    // la más reciente primero
}
function vProfHorario(){
  const aid=session.area, gs=clasesDe(aid,session.profId), hoy=wdIdx(todayStr());
  const dias=[0,1,2,3,4,5,6].map(i=>({i,gs:gs.filter(g=>diasArr(g).includes(i)&&profsDeDia(g,i).includes(session.profId)).map(g=>gDiaWd(g,i)).sort(byHora)}));
  return `<div class="h2">Mi horario</div>
    <div class="sub">Tus clases de la semana. El horario lo asigna la dirección de tu área.</div>
    ${gs.length?dias.map(d=>`<div class="h2 sm${d.i===hoy?' hoy':''}">${DIAS_L[d.i]}${d.i===hoy?' · hoy':''}</div>
      ${d.gs.length?d.gs.map(g=>`<div class="line" style="--ac:${areaColor(aid)}"><div class="t">${esc(horaTxt(g)||'—')}</div><div class="b"><b>${esc(g.nombre)}</b><small>${esc(g.lugar||'Sin lugar')} · ${plu(rosterOf(g).length,'alumno','alumnos')}</small></div></div>`).join(''):`<div class="sub">Sin clases</div>`}`).join('')
      :empty('Todavía no tienes clases asignadas. Pide a la dirección de tu área que te las asigne.')}`;
}

Object.assign(actions,{
  pTab(d){ ui.pTab=d.tab; ui.lista=null; render(); top0(); },
  pNav(d){ ui.pFecha=addDays(ui.pFecha,+d.n); render(); },
  pHoy(){ ui.pFecha=todayStr(); render(); }
});
