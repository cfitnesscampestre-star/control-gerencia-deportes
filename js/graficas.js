'use strict';
/* =====================================================================
   graficas.js — "Aforo por periodo" en el Inicio de cada área.
   Barras verticales como la del Gimnasio, con filtros:
     Ver por:  Día · Semana · Mes · Clase · Tipo · Nivel · Profesor
               (Gimnasio: Día · Semana · Mes · Hora · Día de la semana)
     Medir:    Asistentes (total) o Aforo % (efectividad)
     Período:  el mismo filtro del Resumen (7 días, 30 días, 3 meses, 12 meses, Todo, Otro)
   El color de cada barra es el semáforo de efectividad; la más alta se marca como “Mejor”.
   ===================================================================== */
const CH_DIMS = [['dia','Día'],['semana','Semana'],['mes','Mes'],['clase','Clase'],['tipo','Tipo'],['nivel','Nivel'],['prof','Profesor']];
const CH_DIMS_GIM = [['dia','Día'],['semana','Semana'],['mes','Mes'],['hora','Hora'],['dsem','Día de la semana']];
const CH_TIEMPO = ['dia','semana','mes','dsem','hora'];
ui.ch = ui.ch || { dim:'dia', met:'asis', sel:null };

const chNorm = s => String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const chDimsDe = aid => esGim(aid) ? CH_DIMS_GIM : CH_DIMS;

/* ---------- casilleros de tiempo ---------- */
function chClave(dim,fecha){
  if(dim==='dia') return fecha;
  if(dim==='semana') return mondayOf(fecha);
  if(dim==='mes') return fecha.slice(0,7);
  if(dim==='dsem') return String(wdIdx(fecha));
  return null;
}
function chSlots(dim,desde,hasta){
  const t=todayStr(), fin=hasta>t?t:hasta, out=[];
  if(dim==='dsem') return ['0','1','2','3','4','5','6'];
  for(let d=desde; d<=fin; d=addDays(d,1)){ const k=chClave(dim,d); if(out[out.length-1]!==k&&!out.includes(k)) out.push(k); }
  return out;
}
function chEtiq(dim,k){
  if(dim==='dia'){ const dd=+k.slice(8,10); return {l:fmtFecha(k),s:String(dd),m:(dd===1)?MESES[+k.slice(5,7)-1].slice(0,3).toLowerCase():''}; }
  if(dim==='semana'){ const d=parseYmd(k); return {l:`Semana del ${fmtCorta(k)}`,s:`${d.getDate()}/${d.getMonth()+1}`,m:''}; }
  if(dim==='mes'){ const m=+k.slice(5,7)-1; return {l:`${MESES[m]} ${k.slice(0,4)}`,s:MESES[m].slice(0,3).toLowerCase(),m:m===0?k.slice(0,4):''}; }
  if(dim==='dsem') return {l:DIAS_L[+k],s:DIAS[+k],m:''};
  if(dim==='hora') return {l:`${pad(+k)}:00`,s:pad(+k),m:''};
  return {l:k,s:k,m:''};
}
const chMean = a => a.length ? Math.round(a.reduce((s,x)=>s+x,0)/a.length) : null;

/* ---------- datos: áreas con clases ---------- */
function chClases(aid,dim,R){
  const gs=anCompute([aid],R.desde,R.hasta).gs, map={};
  const bucket=(k,l)=>map[k]=map[k]||{k,l,asis:0,ses:0,ratios:[],lug:0,asisL:0,grupos:new Set()};
  gs.forEach(x=>{
    x.imp.forEach(r=>{
      let k,l;
      if(CH_TIEMPO.includes(dim)){ k=chClave(dim,r.fecha); l=null; }
      else if(dim==='clase'){ k=chNorm(x.g.nombre); l=x.g.nombre; }
      else if(dim==='tipo'){ k=chNorm(x.g.tipo)||'sin tipo'; l=x.g.tipo||'Sin tipo'; }
      else if(dim==='nivel'){ k=chNorm(x.g.nivel)||'sin nivel'; l=x.g.nivel||'Sin nivel'; }
      else { k=chNorm(x.g.prof)||'sin profesor'; l=x.g.prof||'Sin profesor'; }
      const b=bucket(k,l), n=+r.asistentes||0;
      b.asis+=n; b.ses++; b.grupos.add(x.g.id); if(x.cupo>0){ b.ratios.push(n/x.cupo*100); b.lug+=x.cupo; b.asisL+=n; }
    });
  });
  let items;
  if(CH_TIEMPO.includes(dim)) items=chSlots(dim,R.desde,R.hasta).map(k=>{ const b=map[k]||{k,asis:0,ses:0,ratios:[],lug:0,asisL:0,grupos:new Set()}; return {...b,...chEtiq(dim,k)}; });
  else items=Object.values(map).map(b=>({...b,s:b.l})).sort((x,y)=>y.asis-x.asis);
  items.forEach(b=>{ b.aforo=b.lug>0?Math.round(b.asisL/b.lug*100):null; b.ng=b.grupos.size; delete b.grupos; });
  const lugT=items.reduce((s,b)=>s+b.lug,0), asisLT=items.reduce((s,b)=>s+b.asisL,0);
  return {items,total:items.reduce((s,b)=>s+b.asis,0),ses:items.reduce((s,b)=>s+b.ses,0),aforo:lugT>0?Math.round(asisLT/lugT*100):null,numTxt:lugT?numLugares(asisLT,lugT):'',gym:false,sinAtributo:(dim==='tipo'||dim==='nivel')&&items.length===1&&/^sin /.test(items[0].k)};
}

/* ---------- datos: gimnasio (personas por hora, mujeres y hombres) ---------- */
function chGim(aid,dim,R){
  const cap=gimCfg(aid).cap, recs=coll(aid,'accesos').filter(r=>r.fecha>=R.desde&&r.fecha<=R.hasta), map={};
  recs.forEach(r=>{
    const k=dim==='hora'?String(+r.hora):chClave(dim,r.fecha);
    const b=map[k]=map[k]||{k,mu:0,ho:0,ses:0,ratios:[]};
    const mu=+r.mu||0, ho=+r.ho||0; b.mu+=mu; b.ho+=ho; b.ses++; b.ratios.push((mu+ho)/cap*100);
  });
  const promedia=(dim==='hora'||dim==='dsem');                    // por hora del día y por día de la semana: promedio por hora contada
  const claves=dim==='hora'?gimHoras(aid).map(String):chSlots(dim,R.desde,R.hasta);
  const items=claves.map(k=>{
    const b=map[k]||{k,mu:0,ho:0,ses:0,ratios:[]}, n=promedia&&b.ses?b.ses:1;
    const mu=b.mu/n, ho=b.ho/n;
    return {k,...chEtiq(dim,k),mu,ho,asis:mu+ho,ses:b.ses,aforo:chMean(b.ratios),ratios:b.ratios,ng:0};
  });
  const todos=[].concat(...items.map(b=>b.ratios)), pers=items.reduce((s,b)=>s+(promedia?b.asis*b.ses:b.asis),0);
  return {items,total:Math.round(pers),ses:recs.length,aforo:chMean(todos),numTxt:recs.length?`promedio ${Math.round(pers/(recs.length))} de ${cap} personas`:'',gym:true,cap,promedia};
}

/* ---------- barras ---------- */
function chBarras(D,met,dim,sel){
  const items=D.items, n=items.length;
  const val=b=>met==='pct'?b.aforo:(b.asis!=null&&b.ses?b.asis:null);
  const vals=items.map(val).filter(v=>v!=null);
  if(!vals.length) return empty('No hay asistencia capturada en este período.');
  const cat=!CH_TIEMPO.includes(dim), bw=cat?46:(dim==='dia'?24:38);
  const max=met==='pct'?Math.max(100,...vals):Math.max(1,...vals,(D.gym&&D.promedia&&met!=='pct')?D.cap:0);
  const best=Math.max(...vals), mostrarV=n<=14||bw>=38;
  const alto=cat?280:176;
  const cols=items.map(b=>{
    const v=val(b), h=v==null?0:Math.max(2,v/max*100), cls=aforoCls(b.aforo);
    const barra=(D.gym&&met!=='pct')
      ? `<i class="mu" style="height:${Math.min(100,b.mu/max*100)}%"></i><i class="ho" style="height:${Math.min(100,b.ho/max*100)}%"></i>`
      : `<i class="${cls}" style="height:${Math.min(100,h)}%"></i>`;
    const esBest=v!=null&&v===best&&vals.length>1;
    const num=v==null?'':(met==='pct'?v+'%':Math.round(v).toLocaleString('es-MX'));
    return `<button class="ch2-c${sel===b.k?' on':''}${esBest?' best':''}" data-act="ch2Sel" data-k="${esc(b.k)}" title="${esc(b.l||'')}${v!=null?' · '+esc(num):''}${!D.gym&&b.lug?' · '+esc(numLugares(b.asisL,b.lug)):''}" style="flex:1 1 ${bw}px">
      <span class="ch2-v">${mostrarV?esc(num):''}</span>
      <span class="ch2-s">${barra}</span>
      ${cat?`<span class="ch2-l rot">${esc(String(b.s).length>18?String(b.s).slice(0,17)+'…':b.s)}</span>`:`<span class="ch2-l">${esc(b.s)}${b.m?`<em>${esc(b.m)}</em>`:''}</span>`}
      ${esBest?'<span class="ch2-b">Mejor</span>':''}
    </button>`;
  }).join('');
  const lineaCap=(D.gym&&D.promedia&&met!=='pct')?`<i class="ch2-cap" style="bottom:${Math.min(100,D.cap/max*100)}%"><em>Capacidad ${D.cap}</em></i>`:'';
  return `<div class="ch2-scroll" data-fin="${cat?0:1}"><div class="ch2-plot" style="height:${alto}px;min-width:${Math.max(0,n*(bw+4))}px">${lineaCap}<div class="ch2-cols">${cols}</div></div></div>`;
}
function chDetalle(D,met,sel){
  const b=D.items.find(x=>x.k===sel); if(!b) return '<div class="ch2-det ch2-tip">Toca una barra para ver su detalle.</div>';
  if(!b.ses) return `<div class="ch2-det"><b>${esc(b.l||b.s)}</b><span>Sin asistencia capturada.</span></div>`;
  const nom=b.l||b.s;
  if(D.gym) return `<div class="ch2-det"><b>${esc(nom)}</b><span>${D.promedia?'Promedio por hora contada: ':''}<i class="mu"></i>${Math.round(b.mu||0)} mujeres · <i class="ho"></i>${Math.round(b.ho||0)} hombres · ${Math.round(b.asis)} personas${D.promedia?'':' (suma de horas)'} · aforo ${anPct(b.aforo)} · ${plu(b.ses,'hora contada','horas contadas')}</span></div>`;
  return `<div class="ch2-det"><b>${esc(nom)}</b><span>${b.asis.toLocaleString('es-MX')} asistentes${b.lug?` de ${b.lug.toLocaleString('es-MX')} lugares`:''} · aforo <em class="${aforoCls(b.aforo)}">${anPct(b.aforo)}</em> · ${plu(b.ses,'sesión','sesiones')}${b.ng>1?` · ${b.ng} grupos`:''}</span></div>`;
}

/* ---------- tarjeta completa ---------- */
function chCard(aid){
  const gym=esGim(aid), dims=chDimsDe(aid), R=anRange();
  let dim=dims.some(d=>d[0]===ui.ch.dim)?ui.ch.dim:'dia', met=ui.ch.met==='pct'?'pct':'asis', nota='';
  if(dim==='dia'&&R.n>92){ dim='semana'; nota='Para más de 3 meses se agrupa por semana.'; }
  if(R.n===1&&['dia','semana','mes','dsem'].includes(dim)){ dim=gym?'hora':'clase'; nota=gym?'Con un solo día se muestra hora por hora.':'Con un solo día se muestra por clase.'; }
  const D=gym?chGim(aid,dim,R):chClases(aid,dim,R);
  const val=b=>met==='pct'?b.aforo:(b.ses?b.asis:null);
  if(!CH_TIEMPO.includes(dim)) D.items.sort((x,y)=>(val(y)==null?-1:val(y))-(val(x)==null?-1:val(x)));      // categorías: de mayor a menor según lo que se mide
  const conDato=D.items.filter(b=>val(b)!=null);
  const mejor=conDato.length>1?conDato.reduce((a,b)=>val(b)>val(a)?b:a):null, menor=conDato.length>1?conDato.reduce((a,b)=>val(b)<val(a)?b:a):null;
  const fmt=v=>met==='pct'?v+'%':Math.round(v).toLocaleString('es-MX');
  const nom=b=>{ const x=dim==='semana'?'sem '+b.s:(dim==='hora'?b.s+':00':(b.l||b.s)); return x.length>13?x.slice(0,12)+'…':x; };
  const sel=D.items.some(b=>b.k===ui.ch.sel)?ui.ch.sel:null;
  const unidad=gym?(D.promedia?'personas por hora':'personas-hora'):'asistentes';
  return `<div class="card ch2">
    <div class="ch2-f no-print">
      <div class="ch2-fl">Ver por</div>
      <div class="chips">${dims.map(([id,l])=>`<button class="chip${dim===id?' on':''}" data-act="ch2Dim" data-d="${id}">${l}</button>`).join('')}</div>
      <div class="ch2-fl">Medir</div>
      <div class="seg"><button class="${met==='asis'?'on':''}" data-act="ch2Met" data-m="asis">${gym?'Personas':'Asistentes'}</button><button class="${met==='pct'?'on':''}" data-act="ch2Met" data-m="pct">Aforo %</button></div>
      <div class="ch2-fl">Período</div>
      <div>${anPeriodoHTML()}</div>
    </div>
    <div class="ch2-kp">
      <div><b>${D.total.toLocaleString('es-MX')}</b><span>${gym?'personas-hora':unidad} en el período</span></div>
      <div><b class="${aforoCls(D.aforo)}">${anPct(D.aforo)}</b><span>aforo promedio${D.numTxt?` · ${esc(D.numTxt)}`:''}</span></div>
      <div><b class="ok">${mejor?esc(nom(mejor)):'—'}</b><span>${mejor?'mejor · '+fmt(val(mejor)):'mejor'}</span></div>
      <div><b class="bad">${menor?esc(nom(menor)):'—'}</b><span>${menor?'menor · '+fmt(val(menor)):'menor'}</span></div>
    </div>
    ${D.sinAtributo?`<div class="ch2-aviso">Ningún grupo tiene ${dim==='tipo'?'tipo':'nivel'} asignado. Puedes ponerlo al editar cada grupo, en Grupos.</div>`:''}
    ${nota?`<div class="ch2-aviso">${nota}</div>`:''}
    ${chBarras(D,met,dim,sel)}
    <div class="an-leg ch2-leg">${gym&&met!=='pct'?'<span><i class="mu"></i>Mujeres</span><span><i class="ho"></i>Hombres</span>':'<span><i class="ok"></i>aforo ≥ 75%</span><span><i class="warn"></i>30–75%</span><span><i class="bad"></i>&lt; 30%</span>'}<span>Altura = ${met==='pct'?'aforo %':unidad}</span></div>
    ${chDetalle(D,met,sel)}
    ${gym&&!D.promedia&&met!=='pct'?'<div class="an-cs" style="margin:6px 0 0">En día, semana y mes se suman los conteos de cada hora (personas-hora); no son visitas distintas.</div>':''}
  </div>`;
}
function chSeccion(aid){ return `<div class="d-chart"><div class="h2">Aforo por período</div>${chCard(aid)}</div>`; }

Object.assign(actions,{
  ch2Dim(d){ ui.ch.dim=d.d; ui.ch.sel=null; render(); },
  ch2Met(d){ ui.ch.met=d.m; render(); },
  ch2Sel(d){ const sc=$('.ch2-scroll'), sl=sc?sc.scrollLeft:0; ui.ch.sel=ui.ch.sel===d.k?null:d.k; render(); const n=$('.ch2-scroll'); if(n) n.scrollLeft=sl; }
});

/* al dibujar, las gráficas de tiempo se muestran desde lo más reciente */
function chAlFinal(){ document.querySelectorAll('.ch2-scroll[data-fin="1"]').forEach(e=>{ e.scrollLeft=e.scrollWidth; }); }
