'use strict';
/* =====================================================================
   analisis.js — Comité directivo (solo gerencia).
   Información lista para presentar a la gerencia general, con filtros por
   período, área y por las preguntas que suele hacer un comité.
   Aforo = asistentes ÷ cupo de cada clase impartida, promediado.
   Semáforo: verde ≥ 75 % · amarillo 30–75 % · rojo < 30 %.
   ===================================================================== */
const AN_PER = [['dia','Día'],['7','7 días'],['30','30 días'],['90','3 meses'],['365','12 meses'],['all','Todo'],['custom','Otro']];
const AN_Q = [
  ['resumen','Resumen ejecutivo','Lo esencial en una pantalla'],
  ['ocupacion','¿Qué tan llenos estamos?','Ocupación por área y tendencia'],
  ['clases','¿Qué clases funcionan y cuáles no?','Ranking de grupos y sugerencias'],
  ['horarios','¿Cuándo se llena?','Ocupación por día y horario'],
  ['personas','¿A cuánta gente atendemos?','Alumnos, asistentes y sesiones'],
  ['profes','¿Cómo rinden los profesores?','Ranking y cumplimiento por profesor'],
  ['gimnasio','¿Cómo va el gimnasio?','Aforo por hora, mujeres y hombres, personalizados'],
  ['servicios','¿Cómo van Nutrición y Fisioterapia?','Servicios y horas por especialista, y canalizaciones'],
  ['cumple','¿Estamos cumpliendo?','Captura de aforos y reportes semanales'],
  ['incid','¿Qué incidencias hay?','Abiertas, gravedad y tipo'],
  ['eventos','¿Qué eventos hay?','Realizados y próximos'],
  ['apoyo','¿Qué necesitan de gerencia?','Solicitudes de apoyo de las áreas'],
  ['todo','Informe completo','Todo lo anterior, listo para imprimir']
];
const AN_BLOQUES = [[0,9,'06–09'],[9,12,'09–12'],[12,15,'12–15'],[15,18,'15–18'],[18,21,'18–21'],[21,24,'21–24']];
ui.an = ui.an || { per:'dia', dia:todayStr(), desde:'', hasta:'', area:'all', q:'resumen' };      // arranca en el día de hoy

const anMean = a => a.length ? a.reduce((s,x)=>s+x,0)/a.length : null;
const anR = x => x==null ? null : Math.round(x);
const anSum = (a,f) => a.reduce((s,x)=>s+f(x),0);
const anPct = p => p==null ? '—' : p+'%';
const anBloque = hi => { const h=parseInt(String(hi||'').split(':')[0],10); if(isNaN(h)) return -1; const i=AN_BLOQUES.findIndex(b=>h>=b[0]&&h<b[1]); return i<0?0:i; };
const anDiag = p => p==null?{t:'Sin datos',c:'mut'}:p>=75?{t:'Alto',c:'ok'}:p>=30?{t:'Medio',c:'warn'}:{t:'Bajo',c:'bad'};

/* ---------- período y filtros ---------- */
function anAids(){ return ui.an.area==='all' ? areasList().map(a=>a.id) : [ui.an.area]; }
function anFirstDate(){ let m=null; areasList().forEach(a=>coll(a.id,'asistencia').forEach(r=>{ if(!m||r.fecha<m) m=r.fecha; })); return m; }
function anRange(){
  const t=todayStr(), a=ui.an; let desde, hasta=t;
  if(a.per==='dia'){                                    // un solo día, comparado con el mismo día de la semana anterior
    const d=(a.dia&&a.dia<=t)?a.dia:t;
    return {desde:d,hasta:d,n:1,prev:{desde:addDays(d,-7),hasta:addDays(d,-7)}};
  }
  if(a.per==='custom'){ desde=a.desde||addDays(t,-29); hasta=a.hasta||t; if(desde>hasta){ const x=desde; desde=hasta; hasta=x; } }
  else if(a.per==='all') desde=anFirstDate()||addDays(t,-29);
  else desde=addDays(t,-(+a.per-1));
  const n=Math.round((parseYmd(hasta)-parseYmd(desde))/86400000)+1;
  return {desde,hasta,n,prev:a.per==='all'?null:{desde:addDays(desde,-n),hasta:addDays(desde,-1)}};
}
function anPeriodoTxt(r){
  if(r.desde===r.hasta) return `${r.desde===todayStr()?'Hoy · ':''}${fmtLarga(r.desde)} de ${r.desde.slice(0,4)}`;
  return `${fmtCorta(r.desde)} ${r.desde.slice(0,4)} al ${fmtCorta(r.hasta)} ${r.hasta.slice(0,4)}`;
}
function anCompTxt(r){                                  // " · comparado con …"
  if(!r.prev) return '';
  return r.prev.desde===r.prev.hasta?` · comparado con el ${fmtFecha(r.prev.desde)} (mismo día de la semana anterior)`:` · comparado con ${fmtCorta(r.prev.desde)} al ${fmtCorta(r.prev.hasta)}`;
}

/* ---------- cálculo ---------- */
function anAgg(gs){
  const lugares=anSum(gs,x=>x.lugares||0), asisL=anSum(gs,x=>x.cupo>0?x.asisTot:0);      // aforo = asistentes ÷ lugares disponibles
  const prog=anSum(gs,x=>x.prog), capOk=anSum(gs,x=>Math.min(x.cap,x.prog));
  const cf=gs.filter(x=>x.aforo!=null);
  return {
    grupos:gs.length, ses:anSum(gs,x=>x.ses), omit:anSum(gs,x=>x.omit), asisTot:anSum(gs,x=>x.asisTot),
    aforo:lugares>0?anR(asisL/lugares*100):null, lugares, asisL, prog, capOk, sinCaptura:Math.max(0,prog-capOk), cumple:prog?Math.round(capOk/prog*100):null,
    criticos:cf.filter(x=>x.aforo<30).length, medios:cf.filter(x=>x.aforo>=30&&x.aforo<75).length, altos:cf.filter(x=>x.aforo>=75).length, conAforo:cf.length,
    lista:anSum(gs,x=>x.lista), alumnos:anSum(gs,x=>inscritos(x.g)), faltas:anSum(gs,x=>x.faltas), subs:anSum(gs,x=>x.subs)
  };
}
function anCompute(aids,desde,hasta){
  const t=todayStr(), fin=hasta>t?t:hasta, days=[];
  for(let d=desde; d<=fin; d=addDays(d,1)) days.push({d,wd:wdIdx(d)});
  const out=[];
  aids.forEach(aid=>{
    const idx={}; coll(aid,'asistencia').forEach(r=>{ (idx[r.grupoId]=idx[r.grupoId]||[]).push(r); });
    grupos(aid).forEach(g=>{
      const all=idx[g.id]||[], recs=all.filter(r=>r.fecha>=desde&&r.fecha<=hasta), imp=recs.filter(r=>!r.omitida);
      const cupo=+g.cupo||0, ratios=cupo>0?imp.map(r=>(+r.asistentes||0)/cupo*100):[];
      const asisTot=anSum(imp,r=>+r.asistentes||0);
      const first=all.length?all.reduce((m,r)=>r.fecha<m?r.fecha:m,all[0].fecha):null;
      const ini=g.creado||first||t, dias=diasArr(g);
      const finG=g.fin||'9999-12-31';
      let prog=0; days.forEach(x=>{ if(x.d>=ini&&x.d<=finG&&dias.includes(x.wd)) prog++; });
      out.push({aid,g,cupo,lugares:cupo>0?cupo*imp.length:0,recs,imp,ratios,ses:imp.length,omit:recs.length-imp.length,asisTot,asisProm:imp.length?asisTot/imp.length:null,
        aforo:anR(anMean(ratios)),prog,cap:recs.length,lista:imp.filter(r=>r.lista).length,faltas:recs.filter(r=>r.falta).length,subs:imp.filter(r=>r.sup).length});
    });
  });
  return {gs:out,tot:anAgg(out),porArea:Object.fromEntries(aids.map(aid=>[aid,anAgg(out.filter(x=>x.aid===aid))]))};
}
function anData(){
  const r=anRange(), aids=anAids();
  const cur=anCompute(aids,r.desde,r.hasta), prev=r.prev?anCompute(aids,r.prev.desde,r.prev.hasta):null;
  return {r,aids,cur,prev};
}
function anTrend(cur,desde,hasta){
  const map={};
  cur.gs.forEach(x=>{ if(!(x.cupo>0)) return; x.imp.forEach(r=>{ const w=mondayOf(r.fecha), m=map[w]=map[w]||{a:0,l:0}; m.a+=+r.asistentes||0; m.l+=x.cupo; }); });
  const wks=[]; for(let w=mondayOf(desde); w<=hasta; w=addDays(w,7)) wks.push(w);
  return wks.slice(-26).map(w=>({w,y:map[w]&&map[w].l?anR(map[w].a/map[w].l*100):null}));
}
function anHeat(cur){
  const cells=AN_BLOQUES.map(()=>[0,1,2,3,4,5,6].map(()=>[]));
  cur.gs.forEach(x=>{ if(!(x.cupo>0)) return; const b=anBloque(x.g.hi); if(b<0) return;
    x.imp.forEach(r=>{ cells[b][wdIdx(r.fecha)].push((+r.asistentes||0)/x.cupo*100); }); });
  return cells;
}
function anProfes(cur){
  const map={};
  cur.gs.forEach(x=>{
    const key=x.g.profId?('p:'+x.g.profId):(x.g.prof?('n:'+x.g.prof):null); if(!key) return;
    const p=x.g.profId?getProf(x.aid,x.g.profId):null;
    const m=map[key]=map[key]||{nombre:p?p.nombre:x.g.prof,aid:x.aid,ratios:[],ses:0,asisTot:0,lugares:0,asisL:0,prog:0,cap:0,lista:0,grupos:0,faltas:0,subs:0};
    m.faltas+=x.faltas; m.subs+=x.subs; m.ratios.push(...x.ratios); m.ses+=x.ses; m.asisTot+=x.asisTot; m.lugares+=x.lugares||0; m.asisL+=x.cupo>0?x.asisTot:0; m.prog+=x.prog; m.cap+=Math.min(x.cap,x.prog); m.lista+=x.lista; m.grupos++;
  });
  return Object.values(map).map(m=>({...m,aforo:m.lugares>0?anR(m.asisL/m.lugares*100):null,cumple:m.prog?Math.round(m.cap/m.prog*100):null,pLista:m.ses?Math.round(m.lista/m.ses*100):null}));
}
function anReportes(aids,desde,hasta){
  const t=todayStr(), semActual=mondayOf(t), wks=[];
  for(let w=mondayOf(desde); w<=hasta&&w<=semActual; w=addDays(w,7)) wks.push(w);
  const cols=wks.slice(-6);
  const rows=aids.filter(aid=>!esServ(aid)).map(aid=>{
    const reps=areaData(aid).reportes||{};
    const cells=cols.map(w=>{ const r=reps[w]; return r?(r.entregado?'ok':'info'):(w===semActual?'mut':'bad'); });
    const esperados=wks.filter(w=>w<semActual).length, entregados=wks.filter(w=>w<semActual&&reps[w]&&reps[w].entregado).length;
    return {aid,cells,esperados,entregados};
  });
  return {cols,rows,esperados:anSum(rows,x=>x.esperados),entregados:anSum(rows,x=>x.entregados)};
}
function anIncid(aids,desde,hasta){
  const all=[]; aids.forEach(aid=>coll(aid,'incidencias').forEach(i=>all.push({aid,i})));
  const enPer=all.filter(x=>x.i.fecha>=desde&&x.i.fecha<=hasta), abiertas=all.filter(x=>x.i.estado!=='resuelta');
  return {all,enPer,abiertas,altas:abiertas.filter(x=>x.i.grav==='alta')};
}
function anEventos(aids,desde,hasta){
  const t=todayStr(), lim=addDays(t,30), all=[]; aids.forEach(aid=>coll(aid,'eventos').forEach(e=>all.push({aid,e})));
  return {
    enPer:all.filter(x=>x.e.fecha>=desde&&x.e.fecha<=hasta),
    proximos:all.filter(x=>x.e.fecha>=t&&x.e.fecha<=lim&&x.e.estado!=='cancelado').sort((a,b)=>a.e.fecha.localeCompare(b.e.fecha))
  };
}
function anApoyos(aids,desde,hasta){
  const out=[]; aids.forEach(aid=>Object.values(areaData(aid).reportes||{}).forEach(r=>{ if(String(r.apoyo||'').trim()&&r.semana>=mondayOf(desde)&&r.semana<=hasta) out.push({aid,r}); }));
  return out.sort((a,b)=>b.r.semana.localeCompare(a.r.semana));
}

/* ---------- lectura para el comité ---------- */
const mxn = n => '$'+Math.round(n).toLocaleString('es-MX');
const anDelta = (a,b) => (a==null||b==null)?null:a-b;
const anDeltaChip = (dl,unit='pts') => dl==null?'':dl===0?'<span class="an-d eq">sin cambio</span>':`<span class="an-d ${dl>0?'up':'dn'}">${dl>0?'▲ +':'▼ '}${dl} ${unit}</span>`;
const anConGrupos = d => d.aids.filter(id=>d.cur.porArea[id].grupos>0);
function anInsights(d){
  const {cur,prev,r,aids}=d, t=cur.tot, out=[];
  const dl=anDelta(t.aforo,prev?prev.tot.aforo:null);
  out.push({c:aforoCls(t.aforo),h:'Ocupación',x:t.aforo==null?'Todavía no hay asistencia capturada en el período.':`La ocupación promedio es de ${t.aforo}%${dl!=null?` (${dl>0?'+':''}${dl} pts contra el período anterior)`:''}. De ${t.conAforo} grupos con datos, ${t.altos} están en verde, ${t.medios} en amarillo y ${t.criticos} en rojo.`});
  if(aids.length>1){
    const ar=aids.map(a=>({a:getArea(a),v:cur.porArea[a].aforo})).filter(x=>x.v!=null&&x.a).sort((x,y)=>y.v-x.v);
    if(ar.length>1) out.push({c:'info',h:'Áreas',x:`Mejor ocupación: ${ar[0].a.nombre} (${ar[0].v}%). Más baja: ${ar[ar.length-1].a.nombre} (${ar[ar.length-1].v}%).`});
  }
  const conA=cur.gs.filter(x=>x.aforo!=null), crit=conA.filter(x=>x.aforo<30).sort((a,b)=>a.aforo-b.aforo), altos=conA.filter(x=>x.aforo>=75).sort((a,b)=>b.aforo-a.aforo);
  if(crit.length) out.push({c:'bad',h:'Grupos críticos',x:`${crit.length} por debajo de 30%: ${crit.slice(0,3).map(x=>`${x.g.nombre} (${getArea(x.aid).nombre}) ${x.aforo}%`).join(', ')}${crit.length>3?` y ${crit.length-3} más`:''}. Candidatos a cambio de horario, consolidación o cierre.`});
  if(altos.length) out.push({c:'ok',h:'Grupos destacados',x:`${altos.length} con 75% o más: ${altos.slice(0,3).map(x=>`${x.g.nombre} (${getArea(x.aid).nombre}) ${x.aforo}%`).join(', ')}. Evaluar ampliar cupo o abrir horario adicional.`});
  const hm=anHeat(cur), celdas=[]; hm.forEach((row,b)=>row.forEach((v,wd)=>{ if(v.length>=2) celdas.push({b,wd,v:anR(anMean(v))}); }));
  if(celdas.length>1){ celdas.sort((a,b)=>b.v-a.v); const m=celdas[0], p=celdas[celdas.length-1];
    out.push({c:'info',h:'Horarios',x:`Mejor franja: ${DIAS_L[m.wd]} de ${AN_BLOQUES[m.b][2].replace('–',' a ')} h (${m.v}%). Más baja: ${DIAS_L[p.wd]} de ${AN_BLOQUES[p.b][2].replace('–',' a ')} h (${p.v}%).`}); }
  out.push({c:t.cumple==null?'mut':t.cumple>=90?'ok':t.cumple>=70?'warn':'bad',h:'Cumplimiento',x:t.prog?`Se capturó el aforo del ${t.cumple}% de las clases programadas (${t.sinCaptura} sin captura). ${t.omit?`Hubo ${plu(t.omit,'clase marcada','clases marcadas')} como “no hubo clase”.`:'Ninguna clase se marcó como “no hubo clase”.'}`:'No hay clases programadas en el período.'});
  const gid=aids.find(esGim); if(gid){ const gi=gimInsights(gid,d); if(gi.length) out.push({c:gi[0].c,h:'Gimnasio',x:gi[0].x+(gi[1]?' '+gi[1].x:'')}); }
  aids.filter(esServ).forEach(id=>{                      // Nutrición y Fisioterapia: una línea por área
    const ar=getArea(id), sv=servStats(id,r.desde,r.hasta); if(!sv.n) return;
    out.push({c:sv.sinCap.length?'warn':'info',h:ar.nombre,x:`${plu(sv.n,'servicio registrado','servicios registrados')}, ${svHm(sv.min)} de servicio${sv.sinCap.length?` y ${plu(sv.sinCap.length,'día sin bitácora','días sin bitácora')}`:''}.`});
  });
  if(t.faltas||t.subs) out.push({c:t.faltas?'warn':'info',h:'Faltas y suplencias',x:`${plu(t.faltas,'falta de profesor','faltas de profesores')} y ${plu(t.subs,'clase cubierta','clases cubiertas')} por suplente en el período.`});
  const rp=anReportes(aids,r.desde,r.hasta);
  if(rp.esperados) out.push({c:rp.entregados===rp.esperados?'ok':rp.entregados/rp.esperados>=.7?'warn':'bad',h:'Reportes semanales',x:`${rp.entregados} de ${rp.esperados} reportes entregados a tiempo en el período.`});
  const inc=anIncid(aids,r.desde,r.hasta);
  out.push({c:inc.altas.length?'bad':inc.abiertas.length?'warn':'ok',h:'Incidencias',x:`${plu(inc.abiertas.length,'abierta','abiertas')}${inc.altas.length?`, ${inc.altas.length} de gravedad alta`:''}. Se registraron ${inc.enPer.length} en el período.`});
  const ap=anApoyos(aids,r.desde,r.hasta); if(ap.length) out.push({c:'info',h:'Apoyo a gerencia',x:`${ap.length} solicitud${ap.length===1?'':'es'} de apoyo en los reportes semanales.`});
  const ev=anEventos(aids,r.desde,r.hasta); out.push({c:'mut',h:'Eventos',x:`${plu(ev.enPer.filter(x=>x.e.estado==='realizado').length,'evento realizado','eventos realizados')} en el período; ${plu(ev.proximos.length,'programado','programados')} en los próximos 30 días.`});
  return out;
}

/* ---------- componentes de gráfica ---------- */
function anBars(rows,o){
  o=o||{}; const max=o.max||(o.pct?100:Math.max(1,...rows.map(x=>x.val||0)));
  return `<div class="an-bars">${rows.map(x=>{ const cls=o.pct?aforoCls(x.val):'br'; const w=x.val==null?0:Math.min(100,x.val/max*100);
    return `<div class="an-br"><div class="an-bl"><b>${x.color?`<i class="an-dot" style="background:${esc(x.color)}"></i>`:''}${esc(x.label)}</b>${x.sub?`<small>${esc(x.sub)}</small>`:''}</div>
      <div class="bar"><i class="${cls}" style="width:${w}%"></i></div>
      <div class="an-bv ${o.pct?aforoCls(x.val):''}">${o.pct?anPct(x.val):(x.val==null?'—':x.val)}${x.extra||''}</div></div>`; }).join('')}</div>`;
}
function anLine(serie){
  const W=320,H=150,pl=30,pr=8,pt=10,pb=22, iw=W-pl-pr, ih=H-pt-pb;
  const P=serie.map((s,i)=>({...s,x:pl+(serie.length>1?i/(serie.length-1):.5)*iw,y:s.y==null?null:pt+ih*(1-Math.min(100,s.y)/100)}));
  const yy=v=>pt+ih*(1-v/100), ok=P.filter(p=>p.y!=null);
  const path=ok.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area=ok.length>1?`${path} L${ok[ok.length-1].x.toFixed(1)} ${yy(0)} L${ok[0].x.toFixed(1)} ${yy(0)} Z`:'';
  const lab=[0,Math.floor((P.length-1)/2),P.length-1].filter((v,i,a)=>a.indexOf(v)===i&&P[v]);
  return `<svg class="an-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tendencia semanal del aforo">
    <defs><linearGradient id="anG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" style="stop-color:var(--b1)"/><stop offset=".5" style="stop-color:var(--b2)"/><stop offset="1" style="stop-color:var(--b3)"/></linearGradient>
      <linearGradient id="anA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--b2)" stop-opacity=".22"/><stop offset="1" style="stop-color:var(--b2)" stop-opacity="0"/></linearGradient></defs>
    ${[0,50,100].map(v=>`<line x1="${pl}" x2="${W-pr}" y1="${yy(v)}" y2="${yy(v)}" class="g0"/><text x="${pl-5}" y="${yy(v)+3}" text-anchor="end">${v}%</text>`).join('')}
    <line x1="${pl}" x2="${W-pr}" y1="${yy(75)}" y2="${yy(75)}" class="g75"/><line x1="${pl}" x2="${W-pr}" y1="${yy(30)}" y2="${yy(30)}" class="g30"/>
    ${area?`<path d="${area}" fill="url(#anA)"/>`:''}
    ${path?`<path d="${path}" fill="none" stroke="url(#anG)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`:''}
    ${ok.map(p=>`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.2" class="pt"><title>Semana del ${esc(fmtCorta(p.w))}: ${p.y}%</title></circle>`).join('')}
    ${lab.map(v=>`<text x="${P[v].x.toFixed(1)}" y="${H-6}" text-anchor="${v===0?'start':v===P.length-1?'end':'middle'}">${esc(fmtCorta(P[v].w))}</text>`).join('')}
  </svg>`;
}
function anHeatHTML(cells){
  return `<div class="an-hm"><div class="an-hh"></div>${DIAS.map(x=>`<div class="an-hh">${x}</div>`).join('')}
    ${AN_BLOQUES.map((b,i)=>`<div class="an-hl">${b[2]}</div>${cells[i].map(v=>{ const p=v.length?anR(anMean(v)):null;
      return `<div class="an-c ${p==null?'':aforoCls(p)}" title="${p==null?'Sin clases':`${p}% · ${v.length} sesiones`}">${p==null?'':`<span>${p}<small>%</small></span>`}</div>`; }).join('')}`).join('')}</div>
    <div class="an-leg"><span><i class="ok"></i>≥ 75%</span><span><i class="warn"></i>30–75%</span><span><i class="bad"></i>&lt; 30%</span><span><i class="mt"></i>sin clases</span></div>`;
}
function anRankRow(x,i,prevMap){
  const dg=anDiag(x.aforo), pv=prevMap&&prevMap[x.g.id], dl=pv!=null&&x.aforo!=null?x.aforo-pv:null, a=getArea(x.aid);
  return `<div class="an-rk"><span class="rk">${i+1}</span><div class="rk-b"><b>${esc(x.g.nombre)}</b>
    <small>${areaIco(a,{size:13})} ${esc(a.nombre)}${x.g.prof?' · '+esc(x.g.prof):''} · ${esc(diasArr(x.g).map(k=>DIAS[k]).join(' '))} ${esc(x.g.hi||'')} · cupo ${x.cupo||'—'}</small>
    <div class="bar"><i class="${aforoCls(x.aforo)}" style="width:${Math.min(x.aforo||0,100)}%"></i></div></div>
    <div class="rk-v"><b class="${aforoCls(x.aforo)}">${anPct(x.aforo)}</b><small>${x.asisProm==null?'—':x.asisProm.toFixed(1)} asis. · ${x.ses} ses.</small>${pill(dg.t,dg.c)}${anDeltaChip(dl)}</div></div>`;
}
function anSugerencia(x,pv){
  const dl=pv!=null&&x.aforo!=null?x.aforo-pv:null, tend=dl!=null&&dl<=-10?` Va a la baja (${dl} pts contra el período anterior).`:'';
  if(x.aforo==null) return null;
  if(x.aforo<30) return {c:'bad',x:`Aforo bajo (${x.aforo}%). Evaluar cambio de horario, consolidar con otro grupo o campaña de difusión.${tend}`};
  if(x.aforo<75) return x.aforo>=60?{c:'warn',x:`Con un pequeño empuje puede llegar a 75%: reforzar difusión o ajustar el horario.${tend}`}:{c:'warn',x:`Ocupación media (${x.aforo}%). Revisar horario y promoción.${tend}`};
  return {c:'ok',x:`Clase con buen rendimiento. Evaluar ampliar cupo o abrir un horario adicional.${tend}`};
}

/* ---------- paneles (una por pregunta) ---------- */
function anKpis(d){
  const t=d.cur.tot, p=d.prev?d.prev.tot:null, inc=anIncid(d.aids,d.r.desde,d.r.hasta);
  const dAf=anDelta(t.aforo,p?p.aforo:null), dAs=p&&p.asisTot?Math.round((t.asisTot-p.asisTot)/p.asisTot*100):null;
  return `<div class="kpis an-kpis">
    ${kpi('Aforo promedio',anPct(t.aforo),`${anDeltaChip(dAf)||'Sin período previo'}<span class="k-n">${t.lugares?numLugares(t.asisL,t.lugares):''}</span>`,{k:'aforo',cls:aforoCls(t.aforo),color:'var(--b1)'})}
    ${kpi('Asistentes',t.asisTot.toLocaleString('es-MX'),`${anDeltaChip(dAs,'%')||'en el período'}`,{k:'asistentes',color:'var(--b2)'})}
    ${kpi('Sesiones impartidas',t.ses.toLocaleString('es-MX'),`${t.omit} sin clase`,{k:'sesiones',color:'var(--b3)'})}
    ${kpi('Grupos en rojo',`${t.criticos}`,`de ${t.conAforo} con datos`,{k:'rojo',cls:t.criticos?'bad':'ok',color:'var(--bad)'})}
    ${kpi('Captura de aforo',t.cumple==null?'—':t.cumple+'%',`${plu(t.sinCaptura,'clase','clases')} ${anHoyDia()?'por capturar o iniciar':'sin captura'}`,{k:'captura',cls:t.cumple==null?'':t.cumple>=90?'ok':t.cumple>=70?'warn':'bad',color:'var(--b4)'})}
    ${kpi('Incidencias abiertas',inc.abiertas.length,`${inc.altas.length} de gravedad alta`,{k:'incid',cls:inc.altas.length?'bad':'',color:'var(--warn)'})}
  </div>`;
}
function pResumen(d){
  const ins=anInsights(d);
  return `${anKpis(d)}
    <div class="h2 sm">Lectura para el comité</div>
    <div class="an-ins">${ins.map(x=>`<div class="an-i ${x.c}"><b>${esc(x.h)}</b><span>${esc(x.x)}</span></div>`).join('')}</div>`;
}
function pOcupacion(d){
  const {cur,prev,aids}=d, tr=anTrend(cur,d.r.desde,d.r.hasta);
  let rows;
  if(aids.length>1){
    rows=anConGrupos(d).map(id=>{ const a=getArea(id), s=cur.porArea[id], pv=prev?prev.porArea[id].aforo:null, dl=anDelta(s.aforo,pv);
      return {label:a.nombre,sub:`${s.lugares?numLugares(s.asisL,s.lugares)+' · ':''}${s.ses} ses. · ${s.grupos} grupos`,val:s.aforo,color:a.color,extra:dl==null?'':` ${anDeltaChip(dl)}`}; }).sort((x,y)=>(y.val==null?-1:y.val)-(x.val==null?-1:x.val));
  } else {
    rows=cur.gs.map(x=>({label:x.g.nombre,sub:`${x.lugares?numLugares(x.cupo>0?x.asisTot:0,x.lugares)+' · ':''}${x.ses} ses.`,val:x.aforo})).sort((x,y)=>(y.val==null?-1:y.val)-(x.val==null?-1:x.val));
  }
  return `<div class="card"><div class="an-ct">${aids.length>1?'Ocupación por área':'Ocupación por grupo'}</div><div class="an-cs">% de aforo promedio · verde ≥ 75% · amarillo 30–75% · rojo &lt; 30%</div>
      ${rows.length?anBars(rows,{pct:true}):empty('Sin datos en el período.')}</div>
    <div class="card"><div class="an-ct">Tendencia semanal</div><div class="an-cs">Aforo promedio por semana${prev?' · el cambio se compara contra el período anterior de igual duración':''}</div>
      ${tr.some(x=>x.y!=null)?anLine(tr):empty('Aún no hay semanas con asistencia capturada.')}</div>`;
}
function pClases(d){
  const {cur,prev}=d, pm=prev?Object.fromEntries(prev.gs.filter(x=>x.aforo!=null).map(x=>[x.g.id,x.aforo])):null;
  const conA=cur.gs.filter(x=>x.aforo!=null).sort((a,b)=>b.aforo-a.aforo), sin=cur.gs.filter(x=>x.aforo==null);
  const sug=conA.map(x=>({x,s:anSugerencia(x,pm&&pm[x.g.id])})).filter(o=>o.s&&(o.x.aforo<75)).sort((a,b)=>a.x.aforo-b.x.aforo);
  const dest=conA.filter(x=>x.aforo>=75);
  return `<div class="card"><div class="an-ct">Ranking de grupos</div><div class="an-cs">${conA.length} grupos con asistencia capturada · de mayor a menor aforo</div>
      ${conA.length?`<div class="an-rks">${conA.map((x,i)=>anRankRow(x,i,pm)).join('')}</div>`:empty('Sin asistencia capturada en el período.')}
      ${sin.length?`<div class="an-cs" style="margin-top:12px">Sin registros en el período (${sin.length}): ${esc(sin.slice(0,8).map(x=>x.g.nombre).join(', '))}${sin.length>8?'…':''}</div>`:''}</div>
    ${sug.length||dest.length?`<div class="card"><div class="an-ct">Sugerencias de modificación</div><div class="an-cs">Generadas con las reglas del semáforo; la decisión final es del comité</div>
      <div class="an-ins">${sug.slice(0,12).map(o=>`<div class="an-i ${o.s.c}"><b>${esc(o.x.g.nombre)} · ${esc(getArea(o.x.aid).nombre)} · ${o.x.aforo}%</b><span>${esc(o.s.x)}</span></div>`).join('')}
      ${dest.slice(0,6).map(x=>{ const s=anSugerencia(x,pm&&pm[x.g.id]); return `<div class="an-i ok"><b>${esc(x.g.nombre)} · ${esc(getArea(x.aid).nombre)} · ${x.aforo}%</b><span>${esc(s.x)}</span></div>`; }).join('')}</div></div>`:''}`;
}
function pHorarios(d){
  const cells=anHeat(d.cur), hay=cells.some(r=>r.some(c=>c.length));
  return `<div class="card"><div class="an-ct">Ocupación por día y horario</div><div class="an-cs">% de aforo promedio según la hora de inicio de la clase · pasa el dedo o el cursor para ver las sesiones</div>
    ${hay?anHeatHTML(cells):empty('Sin asistencia capturada en el período.')}</div>`;
}
function pPersonas(d){
  const {cur,aids}=d, t=cur.tot, porDia=[0,1,2,3,4,5,6].map(()=>0);
  cur.gs.forEach(x=>x.imp.forEach(r=>{ porDia[wdIdx(r.fecha)]+=(+r.asistentes||0); }));
  return `<div class="kpis an-kpis">
      ${kpi('Alumnos inscritos',t.alumnos.toLocaleString('es-MX'),'según las listas de grupos',{color:'var(--b2)'})}
      ${kpi('Asistentes',t.asisTot.toLocaleString('es-MX'),'entradas en el período',{k:'asistentes',color:'var(--b1)'})}
      ${kpi('Asistencia por sesión',t.ses?(t.asisTot/t.ses).toFixed(1):'—','promedio',{color:'var(--b3)'})}</div>
    <div class="card" style="margin-top:12px"><div class="an-ct">Por área</div><div class="an-scroll"><table class="an-t"><thead><tr><th>Área</th><th>Grupos</th><th>Alumnos</th><th>Sesiones</th><th>Asistentes</th><th>Por sesión</th><th>Aforo</th></tr></thead><tbody>
      ${anConGrupos(d).map(id=>{ const a=getArea(id), s=cur.porArea[id]; return `<tr><td><i class="an-dot" style="background:${esc(a.color)}"></i>${esc(a.nombre)}</td><td>${s.grupos}</td><td>${s.alumnos}</td><td>${s.ses}</td><td>${s.asisTot}</td><td>${s.ses?(s.asisTot/s.ses).toFixed(1):'—'}</td><td class="${aforoCls(s.aforo)}"><b>${anPct(s.aforo)}</b></td></tr>`; }).join('')}
      <tr class="tot"><td>Total</td><td>${t.grupos}</td><td>${t.alumnos}</td><td>${t.ses}</td><td>${t.asisTot}</td><td>${t.ses?(t.asisTot/t.ses).toFixed(1):'—'}</td><td class="${aforoCls(t.aforo)}"><b>${anPct(t.aforo)}</b></td></tr></tbody></table></div></div>
    <div class="card"><div class="an-ct">Asistentes por día de la semana</div>${anBars(porDia.map((v,i)=>({label:DIAS_L[i],val:v})))}</div>`;
}
function pProfes(d){
  const ps=anProfes(d.cur).filter(p=>p.aforo!=null).sort((a,b)=>b.aforo-a.aforo);
  const sinCap=anProfes(d.cur).filter(p=>p.cumple!=null&&p.cumple<80).sort((a,b)=>a.cumple-b.cumple);
  return `<div class="card"><div class="an-ct">Ranking de profesores</div><div class="an-cs">Aforo promedio de sus clases impartidas · ${ps.length} con asistencia capturada</div>
      ${ps.length?`<div class="an-rks">${ps.map((p,i)=>`<div class="an-rk"><span class="rk">${i+1}</span><div class="rk-b"><b>${esc(p.nombre)}</b><small>${areaIco(getArea(p.aid),{size:13})} ${esc(getArea(p.aid).nombre)} · ${p.grupos} ${p.grupos===1?'grupo':'grupos'}${p.faltas||p.subs?` · ${plu(p.faltas,'falta','faltas')} · ${plu(p.subs,'suplencia','suplencias')}`:` · lista pasada ${p.pLista==null?'—':p.pLista+'%'}`}</small>
        <div class="bar"><i class="${aforoCls(p.aforo)}" style="width:${Math.min(p.aforo,100)}%"></i></div></div>
        <div class="rk-v"><b class="${aforoCls(p.aforo)}">${p.aforo}%</b><small>${p.asisTot} asist. · ${p.ses} clases</small></div></div>`).join('')}</div>`:empty('Sin asistencia capturada por profesor en el período.')}</div>
    ${sinCap.length?`<div class="card"><div class="an-ct">Alertas de captura</div><div class="an-cs">Profesores con menos de 80% de sus clases capturadas</div>
      <div class="an-ins">${sinCap.slice(0,10).map(p=>`<div class="an-i ${p.cumple<50?'bad':'warn'}"><b>${esc(p.nombre)} · ${p.cumple}%</b><span>${p.cap} de ${p.prog} clases programadas con asistencia capturada.</span></div>`).join('')}</div></div>`:''}`;
}
function pCumple(d){
  const t=d.cur.tot, rp=anReportes(anConGrupos(d),d.r.desde,d.r.hasta);
  return `<div class="kpis an-kpis">
      ${kpi('Captura de aforo',t.cumple==null?'—':t.cumple+'%',`${t.capOk} de ${t.prog} clases`,{k:'captura',cls:t.cumple==null?'':t.cumple>=90?'ok':t.cumple>=70?'warn':'bad',color:'var(--b2)'})}
      ${kpi('Clases sin captura',t.sinCaptura,'programadas y sin asistencia',{cls:t.sinCaptura?'warn':'ok',color:'var(--warn)'})}
      ${kpi('Con lista de alumnos',t.ses?Math.round(t.lista/t.ses*100)+'%':'—',`${t.lista} de ${t.ses} clases`,{color:'var(--b3)'})}</div>
    <div class="card" style="margin-top:12px"><div class="an-ct">Captura por área</div><div class="an-cs">Clases programadas contra clases con asistencia registrada</div>
      ${anBars(anConGrupos(d).map(id=>{ const a=getArea(id), s=d.cur.porArea[id]; return {label:a.nombre,sub:`${s.capOk} de ${s.prog} clases`,val:s.cumple,color:a.color}; }),{pct:true})}</div>
    <div class="card"><div class="an-ct">Reportes semanales</div><div class="an-cs">${rp.esperados?`${rp.entregados} de ${rp.esperados} entregados a tiempo · `:''}últimas semanas del período</div>
      ${rp.cols.length?`<div class="an-scroll"><table class="an-t an-rp"><thead><tr><th>Área</th>${rp.cols.map(w=>`<th>${esc(fmtCorta(w))}</th>`).join('')}<th>Entregados</th></tr></thead><tbody>
        ${rp.rows.map(x=>`<tr><td><i class="an-dot" style="background:${esc(areaColor(x.aid))}"></i>${esc(getArea(x.aid).nombre)}</td>${x.cells.map(c=>`<td><i class="an-st ${c}" title="${c==='ok'?'Entregado':c==='info'?'Borrador':c==='mut'?'Semana en curso':'Pendiente'}"></i></td>`).join('')}<td>${x.entregados}/${x.esperados}</td></tr>`).join('')}</tbody></table></div>
        <div class="an-leg"><span><i class="ok"></i>entregado</span><span><i class="info"></i>borrador</span><span><i class="bad"></i>pendiente</span><span><i class="mt"></i>en curso</span></div>`:empty('El período no incluye semanas completas.')}</div>`;
}
function pIncid(d){
  const inc=anIncid(d.aids,d.r.desde,d.r.hasta), tipos={};
  inc.enPer.forEach(x=>{ const k=x.i.tipo||'Otro'; tipos[k]=(tipos[k]||0)+1; });
  const cnt=g=>inc.abiertas.filter(x=>x.i.grav===g).length;
  return `<div class="kpis an-kpis">
      ${kpi('Abiertas',inc.abiertas.length,'sin resolver',{cls:inc.abiertas.length?'warn':'ok',color:'var(--warn)'})}
      ${kpi('Gravedad alta',cnt('alta'),`${cnt('media')} media · ${cnt('baja')} baja`,{cls:cnt('alta')?'bad':'ok',color:'var(--bad)'})}
      ${kpi('En el período',inc.enPer.length,`${inc.enPer.filter(x=>x.i.estado==='resuelta').length} resueltas`,{color:'var(--b3)'})}</div>
    <div class="card" style="margin-top:12px"><div class="an-ct">Por tipo</div>${Object.keys(tipos).length?anBars(Object.entries(tipos).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({label:k,val:v}))):empty('Sin incidencias en el período.')}</div>
    <div class="h2 sm">Abiertas por atender</div>
    ${inc.abiertas.length?inc.abiertas.sort((a,b)=>incSort(a.i,b.i)).slice(0,12).map(x=>`<button class="line" style="--ac:${x.i.grav==='alta'?'var(--bad)':x.i.grav==='media'?'var(--warn)':'var(--b3)'}" data-act="openIncFrom" data-aid="${esc(x.aid)}" data-id="${esc(x.i.id)}">
      <div class="t">${areaIco(getArea(x.aid),{tile:true,size:20})}</div><div class="b"><b>${esc(x.i.tipo||'Incidencia')} · ${esc(getArea(x.aid).nombre)}</b><small>${esc(String(x.i.desc||'').slice(0,100))}</small></div><div class="r">${pill(x.i.grav||'media',GRAV_CLS[x.i.grav]||'warn')}</div></button>`).join(''):empty('No hay incidencias abiertas.')}`;
}
function pEventos(d){
  const ev=anEventos(d.aids,d.r.desde,d.r.hasta), real=ev.enPer.filter(x=>x.e.estado==='realizado');
  const fila=x=>{ const a=getArea(x.aid); return `<button class="line ev" data-act="openArea" data-id="${esc(x.aid)}" data-tab="eventos"><div class="t">${esc(fmtFecha(x.e.fecha))}</div><div class="b"><b>${esc(x.e.nombre)}</b><small>${areaIco(a,{size:13})} ${esc(a.nombre)}${x.e.lugar?' · '+esc(x.e.lugar):''}${x.e.participantes?' · '+(+x.e.participantes)+' participantes':''}</small></div><div class="r">${pill(x.e.estado||'planificado',EST_EV_CLS[x.e.estado]||'info')}</div></button>`; };
  return `<div class="kpis an-kpis">
      ${kpi('Realizados',real.length,'en el período',{color:'var(--b2)'})}
      ${kpi('Participantes',anSum(real,x=>+x.e.participantes||0).toLocaleString('es-MX'),'en eventos realizados',{color:'var(--b1)'})}
      ${kpi('Próximos 30 días',ev.proximos.length,'programados',{color:'var(--b3)'})}</div>
    ${real.some(x=>x.e.presupuesto||x.e.costoReal)?`<div class="kpis an-kpis" style="margin-top:12px">${kpi('Presupuesto',mxn(anSum(real,x=>+x.e.presupuesto||0)),'eventos realizados',{color:'var(--b2)'})}${kpi('Costo real',mxn(anSum(real,x=>+x.e.costoReal||0)),(()=>{ const p=anSum(real,x=>+x.e.presupuesto||0), c=anSum(real,x=>+x.e.costoReal||0); return p?`${c<=p?'dentro':'por encima'} del presupuesto (${Math.round(c/p*100)}%)`:''; })(),{cls:anSum(real,x=>+x.e.costoReal||0)>anSum(real,x=>+x.e.presupuesto||0)?'bad':'ok',color:'var(--warn)'})}${kpi('Calificación',(()=>{ const c=real.map(x=>+x.e.calificacion||0).filter(Boolean); return c.length?(c.reduce((a,b)=>a+b,0)/c.length).toFixed(1)+' / 5':'—'; })(),'promedio de los eventos',{color:'var(--b4)'})}</div>`:''}
    <div class="h2 sm">Próximos 30 días</div>${ev.proximos.length?ev.proximos.map(fila).join(''):empty('No hay eventos programados.')}
    <div class="h2 sm">Realizados en el período</div>${real.length?real.sort((a,b)=>b.e.fecha.localeCompare(a.e.fecha)).slice(0,10).map(fila).join(''):empty('No hubo eventos realizados en el período.')}`;
}
function pApoyo(d){
  const ap=anApoyos(d.aids,d.r.desde,d.r.hasta);
  return `<div class="an-cs" style="margin-bottom:8px">Lo que las direcciones de área piden a gerencia en su reporte semanal</div>
    ${ap.length?ap.map(x=>{ const a=getArea(x.aid); return `<button class="line" style="--ac:${esc(a.color)}" data-act="openArea" data-id="${esc(x.aid)}" data-tab="reporte"><div class="t">${areaIco(a,{tile:true,size:20})}</div><div class="b"><b>${esc(a.nombre)} · semana del ${esc(fmtCorta(x.r.semana))}</b><small style="white-space:normal">${esc(x.r.apoyo)}</small></div></button>`; }).join(''):empty('Ninguna dirección pidió apoyo en el período.')}`;
}
/* ---------- Gimnasio ---------- */
function gimHeatHTML(S,horas){
  return `<div class="an-hm gm-hm"><div class="an-hh"></div>${DIAS.map(x=>`<div class="an-hh">${x}</div>`).join('')}
    ${horas.map(h=>`<div class="an-hl">${pad(h)} h</div>${[0,1,2,3,4,5,6].map(dw=>{ const c=S.heat[dw+'_'+h], p=c?Math.round(c.t/c.cap*100):null;
      return `<div class="an-c ${p==null?'':aforoCls(p)}" title="${p==null?'Sin conteos':`${p}% de la capacidad · ${c.n} conteos`}">${p==null?'':p}</div>`; }).join('')}`).join('')}</div>
    <div class="an-leg"><span><i class="ok"></i>≥ 75%</span><span><i class="warn"></i>30–75%</span><span><i class="bad"></i>&lt; 30%</span><span><i class="mt"></i>sin conteos</span><span>Valores = % de la capacidad</span></div>`;
}
function gimInsights(gid,d){
  const S=gimStats(gid,d.r.desde,d.r.hasta), out=[]; if(!S.recs) return out;
  const t=ptTotales(gid), ses=ptSesionesEn(gid,d.r.desde,d.r.hasta,'realizada'), pctH=Object.fromEntries(S.porHora.map(x=>[x.h,x.pct]));
  out.push({c:aforoCls(S.aforo),h:'Aforo',x:`El aforo promedio es de ${S.aforo}% de la capacidad (${S.cap} personas). Hora pico: ${S.pico?`${hh(S.pico.h)} con ${Math.round(S.pico.tP)} personas (${S.pico.pct}%)`:'—'}. ${S.saturadas?`${plu(S.saturadas,'hora','horas')} llegaron a ${GIM_SAT}% o más.`:`Ninguna hora llegó a ${GIM_SAT}%.`}`});
  out.push({c:'info',h:'Mujeres y hombres',x:`Del total de personas contadas, ${S.pctMu}% fueron mujeres y ${S.pctHo}% hombres.`});
  const bajas=S.porHora.filter(x=>x.pct<20).sort((a,b)=>a.pct-b.pct).slice(0,3);
  if(bajas.length) out.push({c:'warn',h:'Horas con baja ocupación',x:`${bajas.map(x=>`${hh(x.h)} (${x.pct}%)`).join(', ')}. Son buen momento para promover personalizados y clases guiadas.`});
  if(ses.length){ const pico=ses.filter(x=>x.s.h&&(pctH[parseInt(x.s.h)]||0)>=75).length; out.push({c:'info',h:'Personalizados',x:`${plu(ses.length,'sesión realizada','sesiones realizadas')} en el período; ${Math.round(pico/ses.length*100)}% se dieron en horas de alta ocupación (75% o más).`}); }
  if(t.porVencer||t.vencidos) out.push({c:t.vencidos?'bad':'warn',h:'Vencimientos',x:`${plu(t.porVencer,'paquete por vencer','paquetes por vencer')} en 7 días y ${plu(t.vencidos,'paquete vencido con sesiones sin usar','paquetes vencidos con sesiones sin usar')}.`});
  return out;
}
function pGimnasio(d){
  const gid=d.aids.find(esGim); if(!gid) return empty('El gimnasio no está dentro del filtro de área. Elige “Todas las áreas” o “Gimnasio”.');
  const S=gimStats(gid,d.r.desde,d.r.hasta), Sp=d.r.prev?gimStats(gid,d.r.prev.desde,d.r.prev.hasta):null, horas=gimHoras(gid), T=ptTotales(gid), fila=ptResumen(gid).filter(x=>x.mios.length);
  const ses=ptSesionesEn(gid,d.r.desde,d.r.hasta,'realizada'), dAf=anDelta(S.aforo,Sp?Sp.aforo:null);
  if(!S.recs&&!fila.length) return empty('Todavía no hay conteos por hora ni personalizados en el período.');
  return `<div class="kpis an-kpis">
      ${kpi('Aforo promedio',anPct(S.aforo),anDeltaChip(dAf)||`de ${S.cap} personas`,{cls:aforoCls(S.aforo),color:'var(--b1)'})}
      ${kpi('Hora pico',S.pico?hh(S.pico.h):'—',S.pico?`${Math.round(S.pico.tP)} personas · ${S.pico.pct}%`:'',{color:'var(--warn)'})}
      ${kpi('Horas saturadas',S.saturadas,`desde ${GIM_SAT}% de la capacidad`,{cls:S.saturadas?'warn':'ok',color:'var(--bad)'})}
      ${kpi('Mujeres / hombres',S.pctMu==null?'—':`${S.pctMu}% / ${S.pctHo}%`,'del total contado',{color:'var(--b3)'})}
      ${kpi('Visitas estimadas',S.visitas.toLocaleString('es-MX'),`${S.personasHora.toLocaleString('es-MX')} personas-hora`,{color:'var(--b2)'})}
      ${kpi('Personalizados',`${T.realizadas}/${T.contratadas}`,`sesiones realizadas · ${ses.length} en el período`,{color:'var(--b4)'})}</div>
    <div class="h2 sm">Lectura del gimnasio</div><div class="an-ins">${gimInsights(gid,d).map(x=>`<div class="an-i ${x.c}"><b>${esc(x.h)}</b><span>${esc(x.x)}</span></div>`).join('')}</div>
    <div class="card" style="margin-top:12px"><div class="an-ct">Aforo por hora</div><div class="an-cs">Promedio de personas por hora del día, separado en mujeres y hombres</div>${gimBarras(S.porHora.map(x=>({h:x.h,mu:x.muP,ho:x.hoP})),S.cap,160)}</div>
    <div class="card"><div class="an-ct">Mujeres y hombres por hora</div><div class="an-cs">Personas promedio en la sala a cada hora</div>
      <div class="an-scroll"><table class="an-t"><thead><tr><th>Hora</th><th>Mujeres</th><th>Hombres</th><th>Total</th><th>% de la capacidad</th></tr></thead><tbody>
      ${S.porHora.map(x=>`<tr><td>${hh(x.h)}</td><td>${x.muP.toFixed(1)}</td><td>${x.hoP.toFixed(1)}</td><td><b>${x.tP.toFixed(1)}</b></td><td class="${aforoCls(x.pct)}"><b>${x.pct}%</b></td></tr>`).join('')}</tbody></table></div></div>
    <div class="card"><div class="an-ct">Mapa de calor por día y hora</div><div class="an-cs">Qué tan llena está la sala según el día de la semana y la hora</div>${gimHeatHTML(S,horas)}</div>
    <div class="card"><div class="an-ct">Personalizados por instructor</div><div class="an-cs">Sesiones contratadas, realizadas y por entregar en paquetes vigentes</div>
      ${fila.length?`<div class="an-scroll"><table class="an-t"><thead><tr><th>Instructor</th><th>Paquetes</th><th>Contratadas</th><th>Realizadas</th><th>Pendientes</th><th>Avance</th><th>Por vencer</th><th>En el período</th></tr></thead><tbody>
      ${fila.map(x=>{ const pct=x.contratadas?Math.round(x.realizadas/x.contratadas*100):0, enP=ses.filter(y=>y.pk.profId===x.p.id).length; return `<tr><td>${esc(x.p.nombre)}</td><td>${x.act.length}</td><td>${x.contratadas}</td><td>${x.realizadas}</td><td>${x.saldo}</td><td class="${aforoCls(pct)}"><b>${pct}%</b></td><td class="${x.porVencer?'warn':''}">${x.porVencer}</td><td>${enP}</td></tr>`; }).join('')}
      <tr class="tot"><td>Total</td><td>${T.paquetes}</td><td>${T.contratadas}</td><td>${T.realizadas}</td><td>${T.saldo}</td><td>${T.contratadas?Math.round(T.realizadas/T.contratadas*100):0}%</td><td>${T.porVencer}</td><td>${ses.length}</td></tr></tbody></table></div>`:empty('Todavía no hay personalizados contratados.')}</div>`;
}
const AN_PANELES = {resumen:pResumen,ocupacion:pOcupacion,clases:pClases,horarios:pHorarios,personas:pPersonas,profes:pProfes,gimnasio:pGimnasio,servicios:pServicios,cumple:pCumple,incid:pIncid,eventos:pEventos,apoyo:pApoyo};

/* ---------- vista ---------- */
const anHoyDia = () => ui.an.per==='dia'&&(ui.an.dia||todayStr())===todayStr();
const anPerLabel = () => ui.an.per==='dia'?(ui.an.dia===todayStr()||!ui.an.dia?'hoy':fmtCorta(ui.an.dia)):({'7':'7 días','30':'30 días','90':'3 meses','365':'12 meses','all':'histórico','custom':'período'})[ui.an.per]||'período';
function anDiaHTML(){                            // navegación día por día
  const t=todayStr(), d=(ui.an.dia&&ui.an.dia<=t)?ui.an.dia:t, esHoy=d===t;
  return `<div class="an-dia"><button class="ibtn" data-act="anDia" data-n="-1" aria-label="Día anterior">${ic('back')}</button>
    <div class="an-dia-t"><b>${esc(fmtLarga(d))}</b><small>${esHoy?'Hoy':`${DIAS_L[wdIdx(d)]}, ${d.slice(0,4)}`}</small></div>
    <button class="ibtn" data-act="anDia" data-n="1" aria-label="Día siguiente"${esHoy?' disabled':''}>${ic('next')}</button>
    ${esHoy?'':'<button class="btn sm" data-act="anDiaHoy">Hoy</button>'}
    <input class="only-d" type="date" id="an_dia" value="${esc(d)}" max="${esc(t)}" aria-label="Elegir día"></div>`;
}
function anPeriodoHTML(){                      // chips de período (y fechas si es “Otro”); se comparte con Resumen
  const a=ui.an;
  return `<div class="chips">${AN_PER.map(([id,l])=>`<button class="chip${a.per===id?' on':''}" data-act="anPer" data-p="${id}">${l}</button>`).join('')}</div>
    ${a.per==='dia'?anDiaHTML():''}
    ${a.per==='custom'?`<div class="two an-dates"><label class="f"><span>Desde</span><input type="date" id="an_desde" value="${esc(a.desde||addDays(todayStr(),-29))}"></label><label class="f"><span>Hasta</span><input type="date" id="an_hasta" value="${esc(a.hasta||todayStr())}"></label></div>`:''}`;
}
function anFiltros(){
  const a=ui.an;
  return `<div class="an-f no-print">
    ${anPeriodoHTML()}
    <div class="an-row"><label class="f"><span>Área</span><select id="an_area"><option value="all"${a.area==='all'?' selected':''}>Todas las áreas</option>${areasList().map(x=>`<option value="${esc(x.id)}"${a.area===x.id?' selected':''}>${esc(x.nombre)}</option>`).join('')}</select></label>
      <div class="an-acts"><button class="btn sm" data-act="anPrint">Imprimir / PDF</button><button class="btn sm" data-act="anCopy">Copiar resumen</button><button class="btn sm" data-act="anCsv">Descargar CSV</button></div></div>
    <div class="an-qh">Pregunta del comité</div>
    <div class="chips an-q">${AN_Q.map(([id,l])=>`<button class="chip${a.q===id?' on':''}" data-act="anQ" data-q="${id}">${l}</button>`).join('')}</div>
  </div>`;
}
function anCuerpo(d){                          // secciones + nota (sirve para pantalla y para imprimir)
  const q=ui.an.q;
  const qs = q==='todo' ? AN_Q.filter(x=>x[0]!=='todo'&&(x[0]!=='gimnasio'||d.aids.some(esGim))&&(x[0]!=='servicios'||d.aids.some(esServ))).map(x=>x[0]) : [q];
  return `${qs.map(id=>{ const meta=AN_Q.find(x=>x[0]===id); return `<section class="an-p"><div class="h2">${esc(meta[1])}</div>${AN_PANELES[id](d)}</section>`; }).join('')}
    <div class="an-nota">Aforo = asistentes ÷ cupo de cada clase impartida, promediado. Semáforo: verde ≥ 75%, amarillo 30–75%, rojo &lt; 30%. La captura de aforo compara las clases programadas contra las que tienen asistencia registrada. En el gimnasio, el aforo es el número de personas en la sala contra su capacidad y las visitas se estiman con la permanencia promedio. Los cambios se comparan contra el período anterior de igual duración.</div>`;
}
function gComite(){
  const d=anData(), area=ui.an.area==='all'?'Todas las áreas':getArea(ui.an.area).nombre;
  return `${anFiltros()}
    <div class="an-head"><div><b>Informe para comité directivo</b><small>${esc(area)} · ${esc(anPeriodoTxt(d.r))}${esc(anCompTxt(d.r))}</small></div><small class="an-gen">Generado el ${esc(fmtLarga(todayStr()))}</small></div>
    ${anCuerpo(d)}`;
}

/* ---------- copiar, CSV, imprimir ---------- */
function anTexto(d){
  const area=ui.an.area==='all'?'Todas las áreas':getArea(ui.an.area).nombre;
  return [`INFORME PARA COMITÉ DIRECTIVO — Club Campestre Aguascalientes`,`${area} · ${anPeriodoTxt(d.r)}`,'',
    ...anInsights(d).map(x=>`• ${x.h}: ${x.x}`),'',`Generado el ${fmtLarga(todayStr())}`].join('\n');
}
function anDescargar(nombre,texto,tipo){
  const blob=new Blob(['\ufeff'+texto],{type:tipo}), a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}
function anCsv(d){
  const q=v=>`"${String(v==null?'':v).replace(/"/g,'""')}"`;
  const pm=d.prev?Object.fromEntries(d.prev.gs.filter(x=>x.aforo!=null).map(x=>[x.g.id,x.aforo])):{};
  const filas=[['Área','Grupo','Profesor','Días','Hora','Cupo','Sesiones','Asistentes','Asistencia promedio','Aforo %','Diagnóstico','Aforo % período anterior','Clases programadas','Clases con captura','Captura %']];
  d.cur.gs.forEach(x=>filas.push([getArea(x.aid).nombre,x.g.nombre,x.g.prof||'',diasArr(x.g).map(k=>DIAS[k]).join(' '),x.g.hi||'',x.cupo,x.ses,x.asisTot,x.asisProm==null?'':x.asisProm.toFixed(1),x.aforo==null?'':x.aforo,anDiag(x.aforo).t,pm[x.g.id]==null?'':pm[x.g.id],x.prog,Math.min(x.cap,x.prog),x.prog?Math.round(Math.min(x.cap,x.prog)/x.prog*100):'']));
  return filas.map(f=>f.map(q).join(',')).join('\r\n');
}
Object.assign(actions,{
  anPer(d){ if(d.p==='dia'&&ui.an.per!=='dia') ui.an.dia=todayStr(); ui.an.per=d.p; render(); },
  anDia(d){ const t=todayStr(), n=addDays(ui.an.dia||t,+d.n); if(n>t) return; ui.an.dia=n; render(); },
  anDiaHoy(){ ui.an.dia=todayStr(); render(); },
  anQ(d){ ui.an.q=d.q; render(); top0(); },
  anCopy(){
    const txt=anTexto(anData());
    if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(()=>toast('Resumen copiado'),()=>toast('No se pudo copiar'));
    else { const ta=document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); toast('Resumen copiado'); }catch(e){ toast('No se pudo copiar'); } ta.remove(); }
  },
  anCsv(){ anDescargar(`comite-${todayStr()}.csv`,anCsv(anData()),'text/csv;charset=utf-8'); toast('CSV descargado'); }
});
document.addEventListener('change',e=>{
  const id=e.target.id;
  if(id==='an_area'){ ui.an.area=e.target.value; render(); }
  else if(id==='an_dia'){ const t=todayStr(); if(e.target.value){ ui.an.dia=e.target.value>t?t:e.target.value; render(); } }
  else if(id==='an_desde'){ ui.an.desde=e.target.value; render(); }
  else if(id==='an_hasta'){ ui.an.hasta=e.target.value; render(); }
});
