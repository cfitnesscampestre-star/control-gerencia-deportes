'use strict';
/* =====================================================================
   reportes.js — reporte semanal para gerencia e incidencias del área
   (mismos campos que el Reporte Semanal Deportes de Fitness Control)
   ===================================================================== */
const REP_FIELDS = [
  {sec:'Objetivos'},
  {k:'objPrev',l:'Objetivo de la semana anterior',t:'ta'},
  {k:'cumplio',l:'¿Se cumplió?',t:'sel',o:['','Sí','Parcialmente','No']},
  {k:'porque',l:'¿Por qué?',t:'ta'},
  {k:'objProx',l:'Objetivo de la próxima semana',t:'ta'},
  {sec:'Alumnado'},
  {k:'alumTotal',l:'Total de alumnado',t:'num'},
  {k:'asistSem',l:'Asistencia semanal',t:'num'},
  {k:'nuevos',l:'Nuevos alumnos',t:'num'},
  {k:'edades',l:'Edades predominantes',t:'txt'},
  {sec:'Profesores'},
  {k:'profTotal',l:'Total de profesores',t:'num'},
  {k:'clasesTotal',l:'Total de clases',t:'num'},
  {k:'inasist',l:'Inasistencias semanales',t:'num'},
  {k:'profDest',l:'Profesor más destacado',t:'txt'},
  {k:'profMenos',l:'Profesor menos destacado',t:'txt'},
  {sec:'Competencias y logros'},
  {k:'competencias',l:'Competencias activas',t:'ta'},
  {k:'logros',l:'Logros semanales',t:'ta'},
  {sec:'Incidencias y apoyo'},
  {k:'incNota',l:'Incidencias generales de la semana',t:'ta',w:1},
  {k:'apoyo',l:'¿En qué te puede ayudar la gerencia deportiva?',t:'ta',w:1}
];

const REP_FIELDS_GIM = [
  {sec:'Objetivos'},
  {k:'objPrev',l:'Objetivo de la semana anterior',t:'ta'},
  {k:'cumplio',l:'¿Se cumplió?',t:'sel',o:['','Sí','Parcialmente','No']},
  {k:'porque',l:'¿Por qué?',t:'ta'},
  {k:'objProx',l:'Objetivo de la próxima semana',t:'ta'},
  {sec:'Aforo del gimnasio'},
  {k:'aforoProm',l:'Aforo promedio (% de la capacidad)',t:'num'},
  {k:'horaPico',l:'Hora pico',t:'txt'},
  {k:'pctMu',l:'Mujeres (% de las personas)',t:'num'},
  {k:'pctHo',l:'Hombres (% de las personas)',t:'num'},
  {k:'horasSat',l:'Horas saturadas (90% o más)',t:'num'},
  {k:'horasBajas',l:'Horas con baja ocupación (menos de 20%)',t:'num'},
  {sec:'Personalizados'},
  {k:'ptActivos',l:'Paquetes de personalizados activos',t:'num'},
  {k:'ptSesiones',l:'Sesiones realizadas en la semana',t:'num'},
  {k:'ptNuevos',l:'Personalizados nuevos',t:'num'},
  {k:'ptPorVencer',l:'Paquetes por vencer',t:'num'},
  {sec:'Instructores'},
  {k:'instTotal',l:'Total de instructores',t:'num'},
  {k:'profDest',l:'Instructor más destacado',t:'txt'},
  {k:'profMenos',l:'Instructor con más áreas de mejora',t:'txt'},
  {sec:'Logros'},
  {k:'logros',l:'Logros semanales',t:'ta'},
  {sec:'Incidencias y apoyo'},
  {k:'incNota',l:'Incidencias generales de la semana',t:'ta',w:1},
  {k:'apoyo',l:'¿En qué te puede ayudar la gerencia deportiva?',t:'ta',w:1}
];
const repFields = aid => esGim(aid) ? REP_FIELDS_GIM : REP_FIELDS;

function incRow(i){
  const c=GRAV_CLS[i.grav]==='bad'?'var(--red)':GRAV_CLS[i.grav]==='warn'?'var(--amber)':'var(--blue)';
  return `<button class="line" style="--ac:${c}" data-act="openInc" data-id="${i.id}">
    <div class="t">${esc(fmtFecha(i.fecha))}</div>
    <div class="b"><b>${esc(i.tipo||'Incidencia')}</b><small>${esc(String(i.desc||'').slice(0,110))}</small></div>
    <div class="r">${pill(i.estado||'abierta',EST_INC_CLS[i.estado]||'bad')}</div></button>`;
}
function vReporte(aid){
  const sub=`<div class="chips"><button class="chip${ui.repTab==='semanal'?' on':''}" data-act="repTab" data-t="semanal">Reporte semanal</button><button class="chip${ui.repTab==='incidencias'?' on':''}" data-act="repTab" data-t="incidencias">Incidencias</button></div>`;
  return `<div class="h2">Reporte</div>${sub}${ui.repTab==='incidencias'?vIncidencias(aid):vSemanal(aid)}`;
}
function vSemanal(aid){
  const wk=ui.repWeek, ro=isRO();
  const rep=(areaData(aid).reportes||{})[wk]||{};
  const incs=coll(aid,'incidencias').filter(i=>i.fecha>=wk&&i.fecha<=addDays(wk,6)).sort(incSort);
  const estado=rep.entregado?pill('Entregado '+fmtCorta(String(rep.entregadoEn||wk).slice(0,10)),'ok'):rep.semana?pill('Borrador guardado','info'):pill('Sin capturar','warn');
  const nav=`<div class="calnav"><button class="ibtn" data-act="repNav" data-n="-1" aria-label="Semana anterior">${ic('back')}</button><b>Semana del ${esc(fmtCorta(wk))} al ${esc(fmtCorta(addDays(wk,6)))}</b><button class="ibtn" data-act="repNav" data-n="1" aria-label="Semana siguiente">${ic('next')}</button></div>`;
  let form='';
  if(ro){
    const filled=repFields(aid).filter(f=>f.k&&String(rep[f.k]==null?'':rep[f.k]).trim());
    form = filled.length ? `<div class="fgrid">${repFields(aid).map(f=>{
      if(f.sec) return `<div class="fsec">${esc(f.sec)}</div>`;
      const v=String(rep[f.k]==null?'':rep[f.k]).trim(); return v?`<div class="dl"><dt>${esc(f.l)}</dt><dd>${esc(v)}</dd></div>`:'';
    }).join('')}</div>` : empty('El director de área todavía no captura este reporte.');
  } else {
    form = `<div class="fgrid">${repFields(aid).map(f=>{
      if(f.sec) return `<div class="fsec">${esc(f.sec)}</div>`;
      const v=rep[f.k]==null?'':rep[f.k], id='r_'+f.k;
      const input = f.t==='ta' ? `<textarea id="${id}">${esc(v)}</textarea>`
        : f.t==='sel' ? `<select id="${id}">${f.o.map(o=>`<option value="${esc(o)}"${o===v?' selected':''}>${esc(o||'Selecciona')}</option>`).join('')}</select>`
        : `<input id="${id}" ${f.t==='num'?'type="number" inputmode="numeric" min="0"':'type="text"'} value="${esc(v)}">`;
      return `<label class="f${f.w?' wide':''}"><span>${esc(f.l)}</span>${input}</label>`;
    }).join('')}</div>
      <div class="btns"><button class="btn" data-act="repLoad">Cargar datos del sistema</button></div>
      <div class="btns"><button class="btn" data-act="repSave">${rep.entregado?'Guardar cambios':'Guardar borrador'}</button>
      ${rep.entregado?`<button class="btn" data-act="repReopen">Reabrir</button>`:`<button class="btn primary" data-act="repSend">Entregar a gerencia</button>`}</div>`;
  }
  return `${nav}<div class="btns no-print" style="margin-top:0"><button class="btn sm" data-act="repPrint">Imprimir / guardar PDF</button></div>
    <div class="card" style="margin-top:10px"><div class="row"><div><b>Estado del reporte</b><small>“Cargar datos del sistema” toma los grupos y la asistencia capturada</small></div>${estado}</div></div>
    ${form}
    <div class="h2 sm">Incidencias registradas esta semana (${incs.length})</div>
    ${incs.length?incs.map(incRow).join(''):empty('No hay incidencias registradas en esta semana.')}`;
}
function vIncidencias(aid){
  let list=coll(aid,'incidencias');
  if(ui.incFil==='abiertas') list=list.filter(i=>i.estado!=='resuelta').sort(incSort);
  else list.sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha)));
  return `
    <div class="h2 sm">Bitácora de incidencias ${isRO()?'':`<button class="btn sm primary" data-act="openInc">+ Incidencia</button>`}</div>
    <div class="chips">${[['abiertas','Abiertas'],['todas','Todas']].map(([id,l])=>`<button class="chip${ui.incFil===id?' on':''}" data-act="incFil" data-f="${id}">${l}</button>`).join('')}</div>
    ${list.length?list.map(incRow).join(''):empty(ui.incFil==='abiertas'?'Sin incidencias abiertas.':'Todavía no hay incidencias registradas.')}`;
}

function openInc(id,aidIn){
  const aid=aidIn||curArea(), i=id?(getPath(`data/${aid}/incidencias/${id}`)||{}):{}, ro=isRO()||fcId(id), dis=ro?' disabled':'';
  openModal(`${mHead(id?(ro?'Incidencia':'Editar incidencia'):'Nueva incidencia')}
    <div class="two">
      <label class="f"><span>Fecha</span><input id="i_fecha" type="date" value="${esc(i.fecha||todayStr())}"${dis}></label>
      <label class="f"><span>Gravedad</span><select id="i_grav"${dis}>${opts(GRAV,i.grav||'media')}</select></label>
    </div>
    <label class="f"><span>Tipo</span><select id="i_tipo"${dis}>${opts(TIPOS_INC,i.tipo||TIPOS_INC[0])}</select></label>
    <label class="f"><span>¿Qué pasó?</span><textarea id="i_desc"${dis}>${esc(i.desc)}</textarea></label>
    <label class="f"><span>Acciones tomadas</span><textarea id="i_acc"${dis}>${esc(i.acciones)}</textarea></label>
    <label class="f"><span>Estado</span><select id="i_est"${dis}>${opts(EST_INC,i.estado||'abierta')}</select></label>
    ${ro?`<div class="btns"><button class="btn" data-act="closeModal">Cerrar</button></div>`:
    `<div class="btns"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="saveInc" data-id="${esc(id||'')}">Guardar incidencia</button></div>
     ${id?`<div class="btns"><button class="btn danger" data-act="delInc" data-id="${esc(id)}">Eliminar incidencia</button></div>`:''}`}`);
}

function readReport(){ const o={}; repFields(curArea()).forEach(f=>{ if(f.k) o[f.k]=(($('#r_'+f.k)||{}).value||'').trim(); }); return o; }
function persistReport(extra){
  const aid=curArea(), wk=ui.repWeek, prev=(areaData(aid).reportes||{})[wk]||{};
  setPath(`data/${aid}/reportes/${wk}`,{...prev,...readReport(),semana:wk,actualizado:new Date().toISOString(),...extra});
  render();
}

Object.assign(actions,{
  repTab(d){ ui.repTab=d.t; render(); },
  repNav(d){ ui.repWeek=addDays(ui.repWeek,7*(+d.n)); render(); },
  repLoad(){
    const aid=curArea(), wk=ui.repWeek, gs=grupos(aid);
    const recs=coll(aid,'asistencia').filter(r=>r.fecha>=wk&&r.fecha<=addDays(wk,6)&&!r.omitida);
    const set=(k,v)=>{ const el=$('#r_'+k); if(el) el.value=v; };
    if(esGim(aid)){
      const f2=addDays(wk,6), S=gimStats(aid,wk,f2), T=ptTotales(aid);
      set('aforoProm',S.aforo==null?'':S.aforo); set('horaPico',S.pico?hh(S.pico.h):''); set('pctMu',S.pctMu==null?'':S.pctMu); set('pctHo',S.pctHo==null?'':S.pctHo);
      set('horasSat',S.saturadas); set('horasBajas',S.bajas); set('ptActivos',T.paquetes); set('ptSesiones',ptSesionesEn(aid,wk,f2,'realizada').length);
      set('ptNuevos',coll(aid,'paquetes').filter(p=>p.inicio>=wk&&p.inicio<=f2).length); set('ptPorVencer',T.porVencer);
      set('instTotal',profesores(aid).filter(p=>p.activo!==false).length);
      toast('Datos cargados. Revísalos y guarda.'); return;
    }
    set('alumTotal',gs.reduce((s,g)=>s+inscritos(g),0));
    set('asistSem',recs.reduce((s,r)=>s+(+r.asistentes||0),0));
    set('profTotal',profesores(aid).filter(p=>p.activo!==false).length||new Set(gs.map(g=>String(g.prof||'').trim().toLowerCase()).filter(Boolean)).size);
    set('clasesTotal',gs.reduce((s,g)=>s+diasArr(g).length,0));
    toast('Datos cargados. Revísalos y guarda.');
  },
  repSave(){ persistReport({}); toast('Reporte guardado'); },
  repSend(){ persistReport({entregado:true,entregadoEn:new Date().toISOString()}); toast('Reporte entregado a gerencia'); },
  repReopen(){ persistReport({entregado:false,entregadoEn:''}); toast('Reporte reabierto'); },
  incFil(d){ ui.incFil=d.f; render(); },
  openInc(d){ openInc(d.id||''); },
  openIncFrom(d){ openInc(d.id,d.aid); },
  saveInc(d){
    const aid=curArea(), desc=$('#i_desc').value.trim();
    if(!desc){ toast('Describe qué pasó'); return; }
    if(!$('#i_fecha').value){ toast('Elige la fecha'); return; }
    const id=d.id||('i'+uid()), prev=d.id?(getPath(`data/${aid}/incidencias/${id}`)||{}):{};
    setPath(`data/${aid}/incidencias/${id}`,{...prev,id,fecha:$('#i_fecha').value,grav:$('#i_grav').value,tipo:$('#i_tipo').value,desc,acciones:$('#i_acc').value.trim(),estado:$('#i_est').value});
    closeModal(); render(); toast('Incidencia guardada');
  },
  delInc(d){ if(!confirm('¿Eliminar esta incidencia?')) return; setPath(`data/${curArea()}/incidencias/${d.id}`,undefined); closeModal(); render(); toast('Incidencia eliminada'); }
});
