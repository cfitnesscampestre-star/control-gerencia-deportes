'use strict';
/* =====================================================================
   dashboard.js — Resumen de gerencia, tarjetas por área e Inicio de un área
   ===================================================================== */
function areaNum(a,pa,s){                            // "709 de 1,369 lugares" (o el promedio de personas del gimnasio)
  if(esServ(a.id)){ const v=(pa&&pa.sv)||servStats(a.id,addDays(todayStr(),-29),todayStr()); return v.n?`${plu(v.n,'servicio atendido','servicios atendidos')} · ${svHm(v.min)}${v.util!=null?` · ocupación ${v.util}%`:''}`:'sin servicios registrados en el período'; }
  if(esGim(a.id)){ const g=pa&&pa.g; return g&&g.recs?`promedio ${Math.round(g.personasHora/g.recs)} de ${g.cap} personas`:'sin conteos en el período'; }
  const n=pa&&pa.lugares!=null?{asis:pa.asisL,lugares:pa.lugares}:{asis:s.aforoN.asis,lugares:s.aforoN.lugares};
  return n.lugares?numLugares(n.asis,n.lugares):'sin asistencia capturada';
}
function areaMini(a,pa){                            // tarjeta compacta: icono, nombre, % y barra
  const s=areaStats(a.id), af=pa?pa.aforo:s.aforo, cls=aforoCls(af);
  return `<button class="amini" data-act="openArea" data-id="${esc(a.id)}" style="--ac:${esc(a.color)}">
    <div class="am-h">${areaIco(a,{tile:true,size:19})}<b>${esc(a.nombre)}</b></div>
    <div class="am-b">${esServ(a.id)?`<div class="bar"><i class="ok" style="width:${pa&&pa.sv&&pa.sv.n?100:0}%"></i></div><em>${esc(svHm(pa&&pa.sv?pa.sv.min:0))}</em>`:`<div class="bar"><i class="${cls}" style="width:${Math.min(af||0,100)}%"></i></div><em class="${cls}">${af==null?'—':af+'%'}</em>`}</div>
    <div class="am-n">${esc(areaNum(a,pa,s))}</div>
  </button>`;
}
function areaCard(a,pa){                        // pa = datos del período (opcional): {aforo, d}
  const s=areaStats(a.id), af=pa?pa.aforo:s.aforo, cls=aforoCls(af), lbl=pa?anPerLabel():'30 días', gim=esGim(a.id), sv=esServ(a.id);
  const hoyG=gim?gimStats(a.id,todayStr(),todayStr()):null, PT=gim?ptTotales(a.id):null;
  return `<button class="acard" data-act="openArea" data-id="${esc(a.id)}" style="--ac:${esc(a.color)}">
    <div class="ac-h">${areaIco(a,{tile:true,size:22})}<b>${esc(a.nombre)}</b>${sv?'':repPill(s.reporte)}</div>
    <div class="ac-m">
      <div class="ac-p ${sv?'':cls}">${sv?esc(svHm(pa&&pa.sv?pa.sv.min:0)):(af==null?'—':af+'%')}<small>${sv?'de servicio':'aforo'}, ${esc(lbl)} ${pa&&!sv?anDeltaChip(pa.d):''}</small></div>
      <div class="ac-r"><div class="bar"><i class="${sv?'ok':cls}" style="width:${sv?(pa&&pa.sv&&pa.sv.n?100:0):Math.min(af||0,100)}%"></i></div>
        <div class="ac-n">${esc(areaNum(a,pa,s))}</div>
        <div class="ac-c">${sv?svChips(a.id,s):gim
          ?`<span>${plu(profCount(a.id),'instructor','instructores')}</span><span>${plu(PT.paquetes,'personalizado activo','personalizados activos')}</span><span class="${s.incAbiertas?'bad':''}">${plu(s.incAbiertas,'incidencia','incidencias')}</span>`
          :`<span>${plu(s.grupos,'grupo','grupos')}</span>${s.profes?`<span>${plu(s.profes,'profesor','profesores')}</span>`:''}<span>${plu(s.alumnos,'alumno','alumnos')}</span><span class="${s.incAbiertas?'bad':''}">${plu(s.incAbiertas,'incidencia','incidencias')}</span>`}</div></div>
    </div>
    <div class="ac-e">${ic('gauge')}<span>${sv?svHoyTxt(a.id,s):gim?(hoyG.recs?`Hoy: ${hoyG.recs} horas capturadas · mujeres ${hoyG.pctMu}% / hombres ${hoyG.pctHo}%`:'Hoy todavía no hay conteos por hora'):(s.hoyProg?`Hoy: ${s.hoyCap} de ${s.hoyProg} ${s.hoyProg===1?'clase con aforo capturado':'clases con aforo capturado'}`:'Hoy no hay clases programadas')}</span></div>
    ${s.proxEvento?`<div class="ac-e">${ic('flag')}<span>${esc(fmtFecha(s.proxEvento.fecha))} · ${esc(s.proxEvento.nombre)}</span></div>`:''}
  </button>`;
}
function resumenPeriodo(aids){                  // aforo por área en el período elegido, con cambio contra el período anterior
  const r=anRange(), cur=anCompute(aids,r.desde,r.hasta), prev=r.prev?anCompute(aids,r.prev.desde,r.prev.hasta):null;
  const por=Object.fromEntries(aids.map(id=>[id,{...cur.porArea[id],d:anDelta(cur.porArea[id].aforo,prev?prev.porArea[id].aforo:null)}]));
  aids.forEach(id=>{                                   // el Gimnasio se mide por hora, no por clases
    if(!esGim(id)) return;
    const g=gimStats(id,r.desde,r.hasta), gp=r.prev?gimStats(id,r.prev.desde,r.prev.hasta):null;
    por[id]={...por[id],gim:true,g,pt:ptTotales(id),aforo:g.aforo,d:gp?anDelta(g.aforo,gp.aforo):null,asisTot:g.visitas,ses:g.recs,grupos:0};
  });
  aids.forEach(id=>{                                   // Nutrición y Fisioterapia: consultas de la bitácora y cuadre con la agenda del club
    if(!esServ(id)) return;
    const v=servStats(id,r.desde,r.hasta), vp=r.prev?servStats(id,r.prev.desde,r.prev.hasta):null;
    por[id]={...por[id],serv:true,sv:v,aforo:null,d:null,asisTot:v.n,ses:0,grupos:0};
  });
  return {r,cur,prev,por};
}
function gAreasList(){
  const as=areasList(), P=resumenPeriodo(as.map(a=>a.id));
  return `<div class="sub">Elige un área para ver sus aforos, grupos, calendario, eventos y reportes.</div>
    <div class="an-f no-print">${anPeriodoHTML()}</div>
    ${as.length?`<div class="acards" style="margin-top:12px">${as.map(a=>areaCard(a,P.por[a.id])).join('')}</div>`:empty('No hay áreas. Agrégalas en Ajustes.')}`;
}

/* ---------- Gráfica: usuarios y efectividad por área ---------- */
function profCount(aid){                       // profesores dados de alta + nombres sueltos de grupos antiguos
  const reg=profesores(aid).filter(p=>p.activo!==false).length;
  const sueltos=new Set(grupos(aid).filter(g=>!g.profId&&g.prof).map(g=>String(g.prof).trim().toLowerCase()));
  return reg+sueltos.size;
}
function chartDetalle(P,id){
  const a=getArea(id), s=P.por[id], cls=aforoCls(s.aforo), gim=!!s.gim;
  return `<div class="ch-d" style="--ac:${esc(a.color)}">
    <div class="ch-dh"><b>${areaIco(a,{size:22})} ${esc(a.nombre)}</b><button class="btn sm" data-act="openArea" data-id="${esc(id)}">Ver área</button></div>
    <div class="ch-dg">
      <div><b>${gim?s.pt.paquetes:s.grupos}</b><span>${gim?(s.pt.paquetes===1?'Personalizado':'Personalizados'):(s.grupos===1?'Clase':'Clases')}</span></div>
      <div><b>${profCount(id)}</b><span>${gim?(profCount(id)===1?'Instructor':'Instructores'):(profCount(id)===1?'Profesor':'Profesores')}</span></div>
      <div><b>${s.asisTot.toLocaleString('es-MX')}</b><span>${gim?'Visitas':'Usuarios'}</span></div>
      <div><b class="${cls}">${anPct(s.aforo)}</b><span>Efectividad</span></div>
    </div>
    <div class="ch-ds">${anDeltaChip(s.d)||''} <b>${esc(areaNum(a,s,areaStats(id)))}</b> · ${gim
      ?`Visitas estimadas a partir de ${s.g.personasHora.toLocaleString('es-MX')} personas-hora · mujeres ${anPct(s.g.pctMu)} / hombres ${anPct(s.g.pctHo)}${s.g.pico?` · hora pico ${hh(s.g.pico.h)}`:''} · ${s.pt.realizadas} de ${s.pt.contratadas} sesiones de personalizado realizadas`
      :`${s.ses.toLocaleString('es-MX')} ${s.ses===1?'sesión impartida':'sesiones impartidas'}${s.alumnos?` · ${s.alumnos.toLocaleString('es-MX')} alumnos inscritos`:''}${s.cumple!=null?` · captura de aforo ${s.cumple}%`:''}`}</div>
  </div>`;
}
function gChart(P,as){
  const rows=as.map(a=>({a,s:P.por[a.id]})).filter(x=>x.s.grupos>0||(x.s.gim&&x.s.g.recs>0)).sort((x,y)=>y.s.asisTot-x.s.asisTot);
  const sinGrupos=as.length-rows.length, max=Math.max(1,...rows.map(x=>x.s.asisTot));
  const conA=rows.filter(x=>x.s.aforo!=null), T={asisTot:anSum(rows,x=>x.s.asisTot),aforo:conA.length?Math.round(anSum(conA,x=>x.s.aforo)/conA.length):null};
  const sel=rows.some(x=>x.a.id===ui.chartSel)?ui.chartSel:null;
  return `<div class="d-chart">
    <div class="h2">Usuarios y efectividad por área</div>
    <div class="card ch">
      <div class="ch-tot">
        <div><b>${T.asisTot.toLocaleString('es-MX')}</b><small>usuarios en el período, sumando las áreas</small></div>
        <div><b class="${aforoCls(T.aforo)}">${anPct(T.aforo)}</b><small>efectividad promedio</small></div>
      </div>
      ${rows.length?`<div class="ch-body">
        <div>
          ${sel?'':'<div class="an-cs ch-tip">Toca una barra para ver las clases, los profesores y los usuarios de esa disciplina.</div>'}
          <div class="ch-bars">${rows.map(({a,s})=>`<button class="ch-r${sel===a.id?' on':''}" data-act="chartSel" data-id="${esc(a.id)}" style="--ac:${esc(a.color)}" aria-pressed="${sel===a.id}">
            <span class="ch-n"><i class="an-dot" style="background:${esc(a.color)}"></i>${areaIco(a,{size:18})} ${esc(a.nombre)}</span>
            <span class="bar ch-b"><i class="${aforoCls(s.aforo)}" style="width:${Math.max(s.asisTot?3:0,Math.round(Math.sqrt(s.asisTot/max)*100))}%"></i></span>
            <span class="ch-v"><b>${s.asisTot.toLocaleString('es-MX')}</b><em class="${aforoCls(s.aforo)}">${anPct(s.aforo)}</em></span></button>${sel===a.id?`<div class="ch-inl">${chartDetalle(P,a.id)}</div>`:''}`).join('')}</div>
          <div class="an-leg"><span>Largo de la barra = usuarios (escala comprimida para que todas se vean)</span><span><i class="ok"></i>efectividad ≥ 75%</span><span><i class="warn"></i>30–75%</span><span><i class="bad"></i>&lt; 30%</span></div>
          ${sinGrupos?`<div class="an-cs" style="margin:8px 0 0">${sinGrupos} ${sinGrupos===1?'área sin grupos registrados no aparece':'áreas sin grupos registrados no aparecen'}.</div>`:''}
        </div>
        <div class="ch-side">${sel?chartDetalle(P,sel):'<div class="ch-d ch-hint">Toca una barra para ver las clases, los profesores y los usuarios de esa disciplina.</div>'}</div>
      </div>`:empty('Todavía no hay áreas con grupos registrados.')}
    </div>
  </div>`;
}
Object.assign(actions,{ chartSel(d){ ui.chartSel=ui.chartSel===d.id?null:d.id; render(); } });

function gResumen(){
  const t=todayStr(), as=areasList(), aids=as.map(a=>a.id);
  const P=resumenPeriodo(aids), T=P.cur.tot, r=P.r;
  const st=as.map(a=>({a,s:areaStats(a.id)}));
  const inc=st.reduce((n,x)=>n+x.s.incAbiertas,0);
  const stG=st.filter(x=>!esServ(x.a.id));                 // Nutrición y Fisioterapia cuentan casos y citas, no alumnos ni clases
  const alum=stG.reduce((n,x)=>n+x.s.alumnos,0);
  const hoyProg=stG.reduce((n,x)=>n+x.s.hoyProg,0), hoyCap=stG.reduce((n,x)=>n+x.s.hoyCap,0);
  const dAf=anDelta(T.aforo,P.prev?P.prev.tot.aforo:null);
  const dAs=P.prev&&P.prev.tot.asisTot?Math.round((T.asisTot-P.prev.tot.asisTot)/P.prev.tot.asisTot*100):null;
  const rp=anReportes(aids,r.desde,r.hasta), entregSem=stG.filter(x=>x.s.reporte==='entregado').length;

  const atn=[];
  as.forEach(a=>coll(a.id,'incidencias').filter(i=>i.estado!=='resuelta').forEach(i=>atn.push({a,i})));
  atn.sort((x,y)=>incSort(x.i,y.i));
  const apoyos=[], minWk=addDays(mondayOf(t),-7);
  as.forEach(a=>{
    Object.values(areaData(a.id).reportes||{}).filter(r=>r.semana>=minWk&&String(r.apoyo||'').trim()).sort((p,q)=>q.semana.localeCompare(p.semana)).slice(0,1).forEach(r=>apoyos.push({a,r}));
  });
  const svAt=svAtencionGerencia();
  const evs=[];
  as.forEach(a=>areaStats(a.id).eventos.forEach(e=>evs.push({a,e})));
  evs.sort((x,y)=>(x.e.fecha+(x.e.hora||'')).localeCompare(y.e.fecha+(y.e.hora||'')));

  return `<div class="dash has-chart">
    <div class="d-kpis">
      <div class="sub">${esc(fmtLarga(t))}${hoyProg?` · Hoy: ${hoyCap} de ${hoyProg} clases con aforo capturado`:''}</div>
      <div class="an-f no-print">${anPeriodoHTML()}
        <div class="an-per">${esc(anPeriodoTxt(r))}${esc(anCompTxt(r))}</div></div>
      <div class="kpis an-kpis" style="margin-top:12px">
        ${kpi('Alumnos inscritos',alum,'En todas las áreas',{k:'alumnos',color:'var(--b2)'})}
        ${kpi('Asistentes a clases',T.asisTot.toLocaleString('es-MX'),anDeltaChip(dAs,'%')||`${T.ses} sesiones`,{k:'asistentes',color:'var(--b3)'})}
        ${kpi('Aforo de clases',anPct(T.aforo),`${anDeltaChip(dAf)||`Período: ${anPerLabel()}`}<span class="k-n">${T.lugares?numLugares(T.asisL,T.lugares):''}</span>`,{k:'aforo',cls:aforoCls(T.aforo),color:'var(--b1)'})}
        ${kpi('Captura de aforo',T.cumple==null?'—':T.cumple+'%',`${plu(T.sinCaptura,'clase','clases')} ${anHoyDia()?'por capturar o iniciar':'sin captura'}`,{k:'captura',cls:T.cumple==null?'':T.cumple>=90?'ok':T.cumple>=70?'warn':'bad',color:'var(--b4)'})}
        ${kpi('Incidencias abiertas',inc,inc?'Requieren seguimiento':'Todo en orden',{k:'incid',cls:inc?'bad':'',color:'var(--bad)'})}
        ${kpi('Reportes semanales',rp.esperados?`${rp.entregados}/${rp.esperados}`:`${entregSem}/${stG.length}`,rp.esperados?'entregados a tiempo':'entregados esta semana',{k:'reportes',cls:rp.esperados?(rp.entregados===rp.esperados?'ok':''):(entregSem===stG.length&&stG.length?'ok':''),color:'var(--warn)'})}
        ${svKpisResumen()}
      </div>
    </div>

    ${gChart(P,as)}

    <div class="d-areas">
      <div class="h2">Áreas y efectividad <button class="btn sm" data-act="gTab" data-tab="comite">Ver informe del comité</button></div>
      ${as.length?`<div class="aminis">${as.slice().sort((x,y)=>((P.por[y.id].aforo==null?-1:P.por[y.id].aforo)-(P.por[x.id].aforo==null?-1:P.por[x.id].aforo))).map(a=>areaMini(a,P.por[a.id])).join('')}</div>`:empty('No hay áreas. Agrégalas en Ajustes.')}
    </div>

    <div class="d-att">
      <div class="h2">Notificaciones de atención requerida</div>
      ${(atn.length||apoyos.length||svAt)?`
        ${svAt}
        ${atn.slice(0,6).map(x=>`<button class="line" style="--ac:${x.a.color}" data-act="openIncFrom" data-aid="${x.a.id}" data-id="${x.i.id}">
          <div class="t">${areaIco(x.a,{tile:true,size:20})}</div>
          <div class="b"><b>${esc(x.i.tipo||'Incidencia')} · ${esc(x.a.nombre)}</b><small>${esc((x.i.desc||'').slice(0,90))}</small></div>
          <div class="r">${pill(x.i.grav||'media',GRAV_CLS[x.i.grav]||'warn')}</div></button>`).join('')}
        ${apoyos.map(x=>`<button class="line" style="--ac:${x.a.color}" data-act="openArea" data-id="${x.a.id}" data-tab="reporte">
          <div class="t">${areaIco(x.a,{tile:true,size:20})}</div>
          <div class="b"><b>Apoyo solicitado · ${esc(x.a.nombre)}</b><small>${esc(String(x.r.apoyo).slice(0,100))}</small></div>
          <div class="r">${pill('gerencia','info')}</div></button>`).join('')}
        ${atn.length>6?`<div class="sub">y ${atn.length-6} incidencias abiertas más, en cada área.</div>`:''}
      `:empty('Nada pendiente: sin incidencias abiertas ni solicitudes a gerencia.')}
    </div>

    <div class="d-ev">
      <div class="h2">Próximos eventos</div>
      ${evs.length?evs.slice(0,6).map(x=>`<button class="line ev" data-act="openArea" data-id="${x.a.id}" data-tab="eventos">
        <div class="t">${esc(fmtFecha(x.e.fecha))}</div>
        <div class="b"><b>${esc(x.e.nombre)}</b><small>${areaIco(x.a,{size:13})} ${esc(x.a.nombre)}${x.e.lugar?' · '+esc(x.e.lugar):''}</small></div>
        <div class="r">${pill(x.e.estado||'planificado',EST_EV_CLS[x.e.estado]||'info')}</div></button>`).join(''):empty('Todavía no hay eventos próximos registrados.')}
    </div>
  </div>`;
}

/* ---------- Inicio de un área ---------- */
function vInicio(aid){
  const s=areaStats(aid), t=todayStr(), wd=wdIdx(t), ro=isRO();
  const hoy=grupos(aid).filter(g=>diasArr(g).includes(wd)).sort(byHora);
  const recs=Object.fromEntries(coll(aid,'asistencia').filter(r=>r.fecha===t).map(r=>[r.grupoId,r]));
  const inc=coll(aid,'incidencias').filter(i=>i.estado!=='resuelta').sort(incSort).slice(0,3);
  const pct=s.hoyProg?Math.round(s.hoyCap/s.hoyProg*100):0;
  return `<div class="dash has-chart">
    <div class="d-kpis">
      ${vinculoBanner(aid)}
      <div class="sub">${esc(fmtLarga(t))}</div>
      <div class="kpis">
        ${kpi('Grupos activos',s.grupos,'Con horario registrado')}
        ${kpi('Alumnos inscritos',s.alumnos,'En todos los grupos',{k:'alumnos',color:'var(--b3)'})}
        ${kpi('Aforo promedio',s.aforo==null?'—':s.aforo+'%','Últimos 30 días',{cls:aforoCls(s.aforo),color:'var(--b1)'})}
        ${kpi('Incidencias abiertas',s.incAbiertas,s.incAbiertas?'Requieren seguimiento':'Todo en orden',{k:'incid',cls:s.incAbiertas?'bad':'',color:'var(--bad)'})}
      </div>
    </div>

    ${chSeccion(aid)}

    <div class="d-hoy">
      <div class="h2">Hoy</div>
      <div class="hero">
        <div class="hero-t"><b>${s.hoyProg?`${s.hoyCap} de ${s.hoyProg}`:'Sin clases'}</b><span>${s.hoyProg?'clases con aforo capturado':'programadas para hoy'}</span>
          ${s.hoyProg?`<div class="bar hero-bar"><i class="ok" style="width:${pct}%"></i></div>`:''}</div>
        ${(ro||esVinculada(aid))?'':`<button class="hero-b" data-act="aTab" data-tab="aforos">Capturar aforos</button>`}
      </div>
      ${hoy.length?hoy.map(g=>{
        const r=recs[g.id], info=regInfo(r,g);
        return `<div class="line" style="--ac:${areaColor(aid)}">
          <div class="t">${esc(g.hi||'—')}</div>
          <div class="b"><b>${esc(g.nombre)}</b><small>${esc(g.prof||'Sin profesor')}${g.lugar?' · '+esc(g.lugar):''}</small></div>
          <div class="r">${r?`<span class="${info.cls}">${esc(info.txt)}${info.p!=null?'<br>'+info.p+'%':''}</span>`:'<span class="mut">sin captura</span>'}</div></div>`;
      }).join(''):empty('Hoy no hay grupos programados.')}
    </div>

    <div class="d-side">
      <div class="h2">Reporte de la semana</div>
      <div class="card"><div class="row"><div><b>Semana del ${esc(fmtCorta(mondayOf(t)))}</b><small>${s.reporte==='entregado'?'Ya está entregado a gerencia':s.reporte==='borrador'?'Guardado como borrador':'Todavía no se captura'}${s.ultimoReporte&&s.reporte!=='entregado'?' · último entregado: semana del '+esc(fmtCorta(s.ultimoReporte)):''}</small></div>
        ${repPill(s.reporte)}</div>
        ${ro?'':`<div class="btns"><button class="btn" data-act="aTab" data-tab="reporte">Abrir reporte semanal</button></div>`}</div>
      <div class="h2">Próximo evento</div>
      ${s.proxEvento?`<button class="ev-c" data-act="openEvento" data-id="${s.proxEvento.id}">
        <div class="ev-d"><b>${parseYmd(s.proxEvento.fecha).getDate()}</b><span>${MESES[parseYmd(s.proxEvento.fecha).getMonth()].slice(0,3)}</span></div>
        <div class="ev-i"><b>${esc(s.proxEvento.nombre)}</b><small>${esc([s.proxEvento.hora,s.proxEvento.lugar].filter(Boolean).join(' · ')||'Sin hora ni lugar')}</small></div>
        ${pill(s.proxEvento.estado||'planificado',EST_EV_CLS[s.proxEvento.estado]||'info')}</button>`:empty('No hay eventos próximos.')}
      <div class="h2">Incidencias abiertas</div>
      ${inc.length?inc.map(incRow).join(''):empty('Sin incidencias abiertas.')}
      ${ro?'':`<div class="btns"><button class="btn sm" data-act="pwSelf">Cambiar contraseña de dirección</button></div>`}
    </div>
  </div>`;
}
