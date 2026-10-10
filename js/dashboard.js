'use strict';
/* =====================================================================
   dashboard.js — Resumen de gerencia, tarjetas por área e Inicio de un área
   ===================================================================== */
function areaNum(a,pa,s){                            // "709 de 1,369 lugares" (o el promedio de personas del gimnasio)
  if(esParamed(a.id)){ const v=(pa&&pa.sv)||servStats(a.id,addDays(todayStr(),-29),todayStr()); return v.n||v.agendadas?`${plu(v.n,'cita agendada','citas agendadas')}${v.agendadas?` · ${plu(v.agendadas,'pendiente','pendientes')}`:''}`:'sin citas agendadas en el período'; }
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
  const rows=as.map(a=>({a,s:P.por[a.id]})).filter(x=>!x.s.serv&&x.s.asisTot>0).sort((x,y)=>y.s.asisTot-x.s.asisTot);
  const sinDatos=as.filter(a=>!P.por[a.id].serv&&!rows.some(x=>x.a.id===a.id)), max=Math.max(1,...rows.map(x=>x.s.asisTot));
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
          ${sinDatos.length?`<div class="an-cs" style="margin:8px 0 0">Sin asistencia en el período: ${esc(sinDatos.map(a=>a.nombre).join(', '))}.</div>`:''}
        </div>
        <div class="ch-side">${sel?chartDetalle(P,sel):'<div class="ch-d ch-hint">Toca una barra para ver las clases, los profesores y los usuarios de esa disciplina.</div>'}</div>
      </div>`:empty('Ninguna área tiene asistencia capturada en el período.')}
    </div>
  </div>`;
}
Object.assign(actions,{ chartSel(d){ ui.chartSel=ui.chartSel===d.id?null:d.id; render(); } });

/* Resumen de gerencia por excepciones: solo lo que necesita atención, agrupado y con el área a un toque. */
function gAtnChips(L,tab,rt){
  return `<div class="gx-ar">${L.map(x=>`<button class="gx-c" data-act="gAbrir" data-id="${esc(x.a.id)}" data-tab="${tab}"${rt?` data-rt="${rt}"`:''} style="--ac:${esc(x.a.color)}">${areaIco(x.a,{size:15})} ${esc(x.a.nombre)}${x.n!=null?` <b>${x.n}</b>`:''}</button>`).join('')}</div>`;
}
function gAtencion(as){
  const t=todayStr(), ayer=addDays(t,-1), wkP=addDays(mondayOf(t),-7), out=[];
  const it=(tono,titulo,cuerpo,n)=>out.push(`<div class="gx-it ${tono}"><div class="gx-h"><i></i><b>${titulo}</b>${n!=null?`<span class="pill ${tono}">${n}</span>`:''}</div>${cuerpo}</div>`);
  const clases=as.filter(a=>!esServ(a.id)&&!esGim(a.id)&&!esVinculada(a.id));
  const altas=[], otras=[];
  as.forEach(a=>{ const ab=coll(a.id,'incidencias').filter(i=>i.estado!=='resuelta'), h=ab.filter(i=>i.grav==='alta').length;
    if(h) altas.push({a,n:h}); if(ab.length-h) otras.push({a,n:ab.length-h}); });
  if(altas.length) it('bad','Incidencias de gravedad alta',gAtnChips(altas,'reporte','incidencias'),anSum(altas,x=>x.n));
  const apoyos=[]; as.forEach(a=>{ const r=Object.values(areaData(a.id).reportes||{}).filter(r=>r.semana>=wkP&&String(r.apoyo||'').trim()).sort((p,q)=>q.semana.localeCompare(p.semana))[0]; if(r) apoyos.push({a,r}); });
  if(apoyos.length) it('info','Te piden apoyo',apoyos.map(x=>`<button class="gx-ap" data-act="gAbrir" data-id="${esc(x.a.id)}" data-tab="reporte" style="--ac:${esc(x.a.color)}">${areaIco(x.a,{size:15})} <b>${esc(x.a.nombre)}:</b> ${esc(String(x.r.apoyo).slice(0,140))}</button>`).join(''),apoyos.length);
  const sinRep=as.filter(a=>!esServ(a.id)&&!((areaData(a.id).reportes||{})[wkP]||{}).entregado).map(a=>({a}));
  if(sinRep.length) it('warn',`Reportes de la semana pasada sin entregar <small>(del ${esc(fmtCorta(wkP))})</small>`,gAtnChips(sinRep,'reporte'),sinRep.length);
  const sinL=clases.map(a=>{ const hay=new Set(coll(a.id,'asistencia').filter(r=>r.fecha===ayer).map(r=>r.grupoId)); return {a,n:gruposDelDia(a.id,ayer).filter(g=>!hay.has(g.id)).length}; }).filter(x=>x.n);
  if(sinL.length) it('warn','Clases de ayer sin lista',gAtnChips(sinL,'inicio'),anSum(sinL,x=>x.n));
  const gimP=as.filter(a=>esGim(a.id)&&typeof gimAtencion==='function').map(a=>({a,n:gimAtencion(a.id).sinReg.length})).filter(x=>x.n);
  if(gimP.length) it('warn','Personalizados sin registrar',gAtnChips(gimP,'gimpt'),anSum(gimP,x=>x.n));
  if(otras.length) it('mut','Otras incidencias abiertas',gAtnChips(otras,'reporte','incidencias'),anSum(otras,x=>x.n));
  const sv=svAtencionGerencia();
  if(sv) out.push(`<div class="gx-it info"><div class="gx-h"><i></i><b>Nutrición y Fisioterapia</b></div>${sv}</div>`);
  return `<div class="g-atn"><div class="h2">Requiere tu atención${out.length?'':' <span class="pill ok">al día</span>'}</div>
    ${out.length?`<div class="gx-list">${out.join('')}</div>`:`<div class="card pend"><div class="pend-ok">✓ Todo en orden: reportes entregados, listas al día y sin incidencias graves.</div></div>`}</div>`;
}
Object.assign(actions,{ gAbrir(d){ actions.openArea(d); if(d.rt){ ui.repTab=d.rt; ui.incFil='abiertas'; render(); } } });
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
  const svAt=svAtencionGerencia(), mSum=typeof mantResumenGerencia==='function'?mantResumenGerencia():'';
  const evs=[];
  as.forEach(a=>areaStats(a.id).eventos.forEach(e=>evs.push({a,e})));
  evs.sort((x,y)=>(x.e.fecha+(x.e.hora||'')).localeCompare(y.e.fecha+(y.e.hora||'')));

  return `<div class="dash has-chart">
    <div class="d-kpis">
      <div class="sub">${esc(fmtLarga(t))}${hoyProg?` · Hoy: ${hoyCap} de ${hoyProg} clases con aforo capturado`:''}</div>
      <div class="an-f no-print">${anPeriodoHTML()}
        <div class="an-per">${esc(anPeriodoTxt(r))}${esc(anCompTxt(r))}</div></div>
      <div class="kpis g-kpis">
        ${kpi('Alumnos inscritos',alum,'En todas las áreas',{k:'alumnos',color:'var(--b2)'})}
        ${kpi('Asistentes a clases',T.asisTot.toLocaleString('es-MX'),anDeltaChip(dAs,'%')||`${T.ses} sesiones`,{k:'asistentes',color:'var(--b3)'})}
        ${kpi('Aforo de clases',anPct(T.aforo),`${anDeltaChip(dAf)||`Período: ${anPerLabel()}`}<span class="k-n">${T.lugares?numLugares(T.asisL,T.lugares):''}</span>`,{k:'aforo',cls:aforoCls(T.aforo),color:'var(--b1)'})}
        ${kpi('Captura de aforo',T.cumple==null?'—':T.cumple+'%',`${plu(T.sinCaptura,'clase','clases')} ${anHoyDia()?'por capturar o iniciar':'sin captura'}`,{k:'captura',cls:T.cumple==null?'':T.cumple>=90?'ok':T.cumple>=70?'warn':'bad',color:'var(--b4)'})}
        ${kpi('Reportes semanales',rp.esperados?`${rp.entregados}/${rp.esperados}`:`${entregSem}/${stG.length}`,rp.esperados?'entregados a tiempo':'entregados esta semana',{k:'reportes',cls:rp.esperados?(rp.entregados===rp.esperados?'ok':''):(entregSem===stG.length&&stG.length?'ok':''),color:'var(--warn)'})}
      </div>
      ${gAtencion(as)}
    </div>

    ${gChart(P,as)}

    <div class="d-areas">
      <div class="h2">Áreas y efectividad <button class="btn sm" data-act="gTab" data-tab="comite">Ver informe del comité</button></div>
      ${(()=>{ const con=as.filter(a=>P.por[a.id].aforo!=null||(P.por[a.id].sv&&P.por[a.id].sv.n)), sin=as.filter(a=>!con.includes(a));
        return as.length?`${con.length?`<div class="aminis">${con.sort((x,y)=>(P.por[y.id].aforo==null?-1:P.por[y.id].aforo)-(P.por[x.id].aforo==null?-1:P.por[x.id].aforo)).map(a=>areaMini(a,P.por[a.id])).join('')}</div>`:''}
          ${sin.length?`<div class="an-cs gx-sin">Sin datos en el período: ${sin.map(a=>`<button class="linkbtn" data-act="openArea" data-id="${esc(a.id)}">${esc(a.nombre)}</button>`).join(' ')}</div>`:''}`:empty('No hay áreas. Agrégalas en Ajustes.'); })()}
    </div>

    <div class="d-att">
      ${atn.length?`<details class="g-inc"><summary>Todas las incidencias abiertas (${atn.length})</summary>
        ${atn.map(x=>`<button class="line" style="--ac:${x.a.color}" data-act="openIncFrom" data-aid="${x.a.id}" data-id="${x.i.id}">
          <div class="t">${areaIco(x.a,{tile:true,size:20})}</div>
          <div class="b"><b>${esc(x.i.tipo||'Incidencia')} · ${esc(x.a.nombre)}</b><small>${esc((x.i.desc||'').slice(0,90))}</small></div>
          <div class="r">${pill(x.i.grav||'media',GRAV_CLS[x.i.grav]||'warn')}</div></button>`).join('')}</details>`:''}
      ${mSum}
    </div>

    <div class="d-ev">
      <div class="h2">Próximos eventos</div>
      ${evs.length?evs.slice(0,6).map(x=>`<button class="line ev" data-act="openArea" data-id="${x.a.id}" data-tab="eventos">
        <div class="t">${esc(evFin(x.e)>x.e.fecha?evFechaTxt(x.e):fmtFecha(x.e.fecha))}</div>
        <div class="b"><b>${esc(x.e.nombre)}</b><small>${areaIco(x.a,{size:13})} ${esc(x.a.nombre)}${x.e.lugar?' · '+esc(x.e.lugar):''}</small></div>
        <div class="r">${pill(x.e.estado||'planificado',EST_EV_CLS[x.e.estado]||'info')}</div></button>`).join(''):empty('Todavía no hay eventos próximos registrados.')}
    </div>
  </div>`;
}

/* ---------- Inicio de un área ---------- */
/* ---------- Inicio de un área: análisis de aforo arriba, tres cifras y avisos ---------- */
function pendRow(tono,titulo,sub,btn){
  return `<div class="pend-row ${tono}"><i></i><div><b>${titulo}</b>${sub?`<small>${sub}</small>`:''}</div>${btn||''}</div>`;
}
/* Pendientes de la dirección: lo que hay que hacer hoy, primero. Sin pendientes: “Todo al día”. */
function dirPendientes(aid){
  const t=todayStr(), ayer=addDays(t,-1), ro=isRO(), s=areaStats(aid), rows=[], d=new Date(), nowM=d.getHours()*60+d.getMinutes();
  const ir=(tab,txt,fecha)=>ro?'':`<button class="btn sm" data-act="pendIr" data-tab="${tab}"${fecha?` data-f="${fecha}"`:''}>${txt}</button>`;
  const nomG=g=>`${g.hi?g.hi+' ':''}${g.nombre}${(g.profId&&getProf(aid,g.profId))?' ('+getProf(aid,g.profId).nombre.split(' ')[0]+')':g.prof?' ('+String(g.prof).split(' ')[0]+')':''}`;
  const lista=(L,n)=>esc(L.slice(0,n).join(' · '))+(L.length>n?` y ${L.length-n} más`:'');
  if(esGim(aid)){
    const hAct=d.getHours(), cap=new Set(gimSerie(aid,t).map(x=>x.h)), falt=gimHoras(aid,t).filter(h=>h<hAct&&!cap.has(h));
    if(falt.length) rows.push(pendRow('warn',`${plu(falt.length,'hora','horas')} de hoy sin conteo de aforo`,lista(falt.map(hh),5),ir('gimaforo','Capturar')));
    if(typeof gimAtencion==='function'){
      const A=gimAtencion(aid);
      if(A.sinReg.length) rows.push(pendRow('bad',`${plu(A.sinReg.length,'sesión de personalizado','sesiones de personalizado')} sin registrar`,lista([...new Set(A.sinReg.map(y=>(getProf(aid,y.pk.profId)||{}).nombre).filter(Boolean))],3),ir('gimpt','Ver')));
      if(A.sinVer.length) rows.push(pendRow('info',`${plu(A.sinVer.length,'aviso','avisos')} sin ver por los instructores`,'Cambios de recepción que el instructor no ha marcado como enterado',ir('gimpt','Ver')));
      if(A.sinAg.length) rows.push(pendRow('bad',`${plu(A.sinAg.length,'personalizado','personalizados')} con sesiones sin fecha`,lista(A.sinAg.map(y=>y.x.cliente||'Cliente'),3),ir('gimpt','Ver')));
    }
  } else if(!esVinculada(aid)&&!esServ(aid)){
    const sinLista=(f,soloEmpezadas)=>{ const hay=new Set(coll(aid,'asistencia').filter(r=>r.fecha===f).map(r=>r.grupoId));
      return gruposDelDia(aid,f).filter(g=>!hay.has(g.id)&&(!soloEmpezadas||(minutos(g.hi)!=null&&minutos(g.hi)+15<=nowM))).sort(byHora); };
    const A=sinLista(ayer,false), H=sinLista(t,true);
    if(A.length) rows.push(pendRow('bad',`${plu(A.length,'clase','clases')} de ayer sin lista`,lista(A.map(nomG),3),ir('aforos','Capturar',ayer)));
    if(H.length) rows.push(pendRow('warn',`${plu(H.length,'clase','clases')} de hoy ya empezaron y no tienen lista`,lista(H.map(nomG),3),ir('aforos','Capturar',t)));
  }
  if(!esServ(aid)){
    const reps=areaData(aid).reportes||{}, wk=mondayOf(t), pas=reps[addDays(wk,-7)];
    if(!(pas&&pas.entregado)) rows.push(pendRow('bad','Reporte de la semana pasada sin entregar',`Semana del ${esc(fmtCorta(addDays(wk,-7)))} · los números ya están, solo falta tu parte`,ro?'':`<button class="btn sm" data-act="pendRep" data-w="${addDays(wk,-7)}">Abrir</button>`));
    else if(s.reporte!=='entregado'&&wdIdx(t)>=4) rows.push(pendRow(s.reporte==='borrador'?'info':'warn',`Reporte de esta semana ${s.reporte==='borrador'?'en borrador':'sin capturar'}`,`Semana del ${esc(fmtCorta(wk))}`,ro?'':`<button class="btn sm" data-act="pendRep" data-w="${wk}">Abrir</button>`));
  }
  if(s.incAbiertas){ const alt=coll(aid,'incidencias').filter(i=>i.estado!=='resuelta'&&i.grav==='alta').length;
    rows.push(pendRow(alt?'bad':'warn',`${plu(s.incAbiertas,'incidencia abierta','incidencias abiertas')}`,alt?`${alt} de gravedad alta`:'Dales seguimiento o ciérralas',ro?'':`<button class="btn sm" data-act="pendInc">Ver</button>`)); }
  return `<div class="d-pend"><div class="h2">Pendientes de hoy${rows.length?` <span class="pill warn">${rows.length}</span>`:''}</div>
    <div class="card pend">${rows.length?rows.join(''):`<div class="pend-ok">✓ Todo al día: listas, reporte e incidencias sin pendientes.</div>`}</div></div>`;
}
Object.assign(actions,{
  pendIr(d){ if(d.f){ ui.afFecha=d.f; } ui.aTab=d.tab; render(); top0(); },
  pendRep(d){ ui.aTab='reporte'; ui.repTab='semanal'; ui.repWeek=d.w; render(); top0(); },
  pendInc(){ ui.aTab='reporte'; ui.repTab='incidencias'; ui.incFil='abiertas'; render(); top0(); }
});
function vInicio(aid){
  const s=areaStats(aid), t=todayStr(), ro=isRO();
  const recs=coll(aid,'asistencia').filter(r=>r.fecha===t&&!r.omitida);
  const asisHoy=recs.reduce((n,r)=>n+(+r.asistentes||0),0);
  const puedeCapturar=!ro&&!esVinculada(aid), sinCap=Math.max(0,s.hoyProg-s.hoyCap);
  const capVal=s.hoyProg?`${s.hoyCap}/${s.hoyProg}`:'—';
  const capCap=!s.hoyProg?'Sin clases hoy':(sinCap?`faltan ${sinCap}`:'todas capturadas');
  const capCls=s.hoyProg?(sinCap?'warn':'ok'):'';
  const tileCap=puedeCapturar
    ? `<button class="kpi kpi-btn" data-act="aTab" data-tab="aforos" style="--kc:var(--b2)" aria-label="Clases capturadas hoy: ir a capturar aforos"><span class="k-l">Clases capturadas</span><b class="${capCls}">${capVal}</b><em class="k-c">${capCap}</em><span class="k-go" aria-hidden="true">${ic('next')}</span></button>`
    : kpi('Clases capturadas',capVal,capCap,{cls:capCls,color:'var(--b2)'});
  const pend=[];
  return `<div class="dash limpio">
    ${dirPendientes(aid)}

    <div class="d-kpis">
      <div class="kpis k3">
        ${kpi('Aforo',s.aforo==null?'—':s.aforo+'%','Promedio 30 días',{cls:aforoCls(s.aforo),color:'var(--b1)'})}
        ${kpi('Asistentes hoy',asisHoy,s.hoyProg?(s.hoyCap===1?'en 1 clase capturada':`en ${s.hoyCap} clases capturadas`):'Sin clases hoy',{color:'var(--b3)'})}
        ${tileCap}
      </div>
    </div>

    <div class="d-avisos">${vinculoBanner(aid)}${typeof infBannerPend==='function'?infBannerPend(aid):''}</div>

    <div class="d-chart" style="margin-top:18px"><div class="h2">Análisis de aforo <button class="btn sm${ui.chRev?'':' primary'}" data-act="chRev" aria-expanded="${!!ui.chRev}">${ui.chRev?'Ocultar':'Revisar'}</button></div>${chCard(aid,true)}</div>

    ${(pend.length||s.proxEvento)?`<div class="d-side">
      ${pend.length?`<div class="d-blk"><div class="h2">Para atender</div><div class="card pend">${pend.join('')}</div></div>`:''}
      ${s.proxEvento?`<div class="d-blk"><div class="h2">Próximo evento</div>
        <button class="ev-c" data-act="openEvento" data-id="${s.proxEvento.id}">
          <div class="ev-d"><b>${parseYmd(s.proxEvento.fecha).getDate()}</b><span>${MESES[parseYmd(s.proxEvento.fecha).getMonth()].slice(0,3)}</span></div>
          <div class="ev-i"><b>${esc(s.proxEvento.nombre)}</b><small>${esc([s.proxEvento.hora,s.proxEvento.lugar].filter(Boolean).join(' · ')||'Sin hora ni lugar')}</small></div>
          ${pill(s.proxEvento.estado||'planificado',EST_EV_CLS[s.proxEvento.estado]||'info')}</button></div>`:''}
    </div>`:''}

    ${ro?'':`<div class="d-cuenta"><button class="linkbtn" data-act="pwSelf">Cambiar contraseña de dirección</button></div>`}
  </div>`;
}
