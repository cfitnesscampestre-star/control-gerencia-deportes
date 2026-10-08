'use strict';
/* =====================================================================
   metodologia.js — acceso de METODOLOGÍA DEPORTIVA.
   Entra con su propia contraseña (botón "Metodología" del acceso) y ve:
     · Aforos   → filtro de fechas arriba y una tarjeta por disciplina.
                  Gimnasio: mujeres y hombres. Las demás: total de asistentes.
                  Al tocar una tarjeta: desglose de asistentes por profesor.
     · Eventos  → filtro de fechas, tarjeta por área con su número de eventos;
                  al tocarla, la lista; al tocar un evento, su ficha.
     · Pruebas  → aplica pruebas físicas a los profesores (hoy: Rufier).
                  Elige disciplinas y fechas y la prueba aparece sola en el
                  portal de cada profesor y del director de esas disciplinas,
                  que la aplican a sus alumnos (nombre escrito o lista de grupo).
   Es solo consulta: no modifica aforos ni eventos.
   Datos propios (en state.met):
     met/pruebas/<id>            → aplicación de una prueba
     met/rufier/<pruebaId>/<k>   → resultado de cada persona evaluada (k = área_nombre)
   ===================================================================== */
const isMet = () => !!session && session.rol==='met';
const metNum = n => (+n||0).toLocaleString('es-MX');
ui.mt = ui.mt || { tab:'aforos', per:'30', desde:'', hasta:'', aArea:null, eArea:null, pSel:null, nuevo:null };
const MT_PER = [['hoy','Hoy'],['7','7 días'],['30','30 días'],['90','3 meses'],['mes','Este mes'],['custom','Otro']];

/* ---------- período ---------- */
function mtRango(){
  const t=todayStr(), m=ui.mt; let desde, hasta=t;
  if(m.per==='hoy') desde=t;
  else if(m.per==='mes') desde=t.slice(0,8)+'01';
  else if(m.per==='custom'){ desde=m.desde||addDays(t,-29); hasta=m.hasta||t; if(desde>hasta){ const x=desde; desde=hasta; hasta=x; } }
  else desde=addDays(t,-(+m.per-1));
  return {desde,hasta};
}
const mtPerTxt = r => r.desde===r.hasta ? fmtLarga(r.desde) : `${fmtCorta(r.desde)} ${r.desde.slice(0,4)} al ${fmtCorta(r.hasta)} ${r.hasta.slice(0,4)}`;
function mtFiltro(){
  const r=mtRango(), n=dd(r.desde,r.hasta)+1, t=todayStr();
  const tit=n===1?fmtLarga(r.desde):`${fmtCorta(r.desde)} – ${fmtCorta(r.hasta)} ${r.hasta.slice(0,4)}`, sub=n===1?(r.desde===t?'Hoy':'Un solo día'):plu(n,'día','días');
  return `<div class="ch2-per no-print"><div class="ch2-pt"><b>${esc(tit)}</b><small>${esc(sub)}</small></div><button class="ch2-cal" data-act="mtCal" aria-label="Elegir las fechas">${ic('cal')}<span>Fechas</span></button></div>`;
}
/* calendario: elige entre qué fechas (en Eventos también se pueden elegir fechas futuras) */
function openMtCal(){
  const r=mtRango(), t=todayStr(), fut=ui.mt.tab==='eventos';
  const at=[['Hoy',0],['7 días',6],['30 días',29],['3 meses',89]].map(([l,n])=>`<button class="chip" data-act="mtRapido" data-n="${n}">${l}</button>`).join('');
  openModal(`${mHead('Elegir fechas')}
    <div class="chips" style="margin-bottom:10px">${at}<button class="chip" data-act="mtRapido" data-n="mes">Este mes</button>${fut?'<button class="chip" data-act="mtRapido" data-n="prox">Próximos 30 días</button>':''}</div>
    <div class="two"><label class="f"><span>Desde</span><input id="mtc_desde" type="date" ${fut?'':`max="${t}"`} value="${esc(r.desde)}"></label><label class="f"><span>Hasta</span><input id="mtc_hasta" type="date" ${fut?'':`max="${t}"`} value="${esc(r.hasta)}"></label></div>
    <div class="btns"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="mtAplicar">Aplicar</button></div>`);
}
function mtSetRango(d,h){
  const t=todayStr(), fut=ui.mt.tab==='eventos';
  if(!fut){ if(h>t) h=t; if(d>t) d=t; }
  if(d>h){ const x=d; d=h; h=x; }
  ui.mt.per='custom'; ui.mt.desde=d; ui.mt.hasta=h;
}
/* áreas que se muestran: las deportivas siempre; Nutrición, Fisioterapia y Paramédicos no son disciplinas */
const mtAreas = () => areasList().filter(a=>!esServ(a.id));

/* ---------- AFOROS ---------- */
function mtAforoDatos(aid,r){
  if(esGim(aid)){
    const S=gimStats(aid,r.desde,r.hasta);
    return {gim:true,S,mu:S.mu,ho:S.ho,tot:S.mu+S.ho};
  }
  const cur=anCompute([aid],r.desde,r.hasta), T=cur.porArea[aid];
  const tipos={servicio:0,academia:0,sesS:0,sesA:0};                       // asistentes por tipo de grupo
  const fit=esFitArea(aid);
  cur.gs.forEach(x=>{ const t=fit?'servicio':tipoGrupoDe(x.g); tipos[t]+=x.asisTot; tipos[t==='servicio'?'sesS':'sesA']+=x.ses; });   // en Fitness toda la asistencia es de servicio
  return {gim:false,cur,tot:T.asisTot,ses:T.ses,aforo:T.aforo,sx:areaSexo(aid,r.desde,r.hasta),tipos,fit};
}
function mtAforoCard(a,r){
  const D=mtAforoDatos(a.id,r);
  const cuerpo = D.gim
    ? `<div class="mt-split"><div><b>${metNum(D.mu)}</b><span>Mujeres</span></div><div><b>${metNum(D.ho)}</b><span>Hombres</span></div></div>
       <div class="mt-sub">${D.S.recs?`${metNum(D.tot)} personas contadas en ${plu(D.S.recs,'hora','horas')}`:'Sin conteos en este período'}</div>`
    : `${mtTipos(D)}
       ${mtSplitSx(D.sx)}
       <div class="mt-sub">${D.ses?`Total ${metNum(D.tot)} · ${plu(D.ses,'sesión','sesiones')}${D.aforo!=null?` · aforo ${D.aforo}%`:''}`:'Sin sesiones capturadas'}</div>`;
  return `<button class="acard mt-card" data-act="mtAforoArea" data-id="${esc(a.id)}" style="--ac:${esc(a.color)}">
    <div class="ac-h">${areaIco(a,{tile:true,size:22})}<b>${esc(a.nombre)}</b><span class="mt-go">${ic('next')}</span></div>${cuerpo}</button>`;
}
function vMetAforos(){
  const r=mtRango();
  if(ui.mt.aArea&&getArea(ui.mt.aArea)) return vMetAforoDetalle(ui.mt.aArea,r);
  const as=mtAreas(), cards=as.map(a=>({a,D:mtAforoDatos(a.id,r)}));
  const totAsis=cards.filter(x=>!x.D.gim).reduce((s,x)=>s+x.D.tot,0), gim=cards.find(x=>x.D.gim);
  return `<div class="sub">Aforo por disciplina en las fechas elegidas. Toca una tarjeta para ver el desglose por profesor.</div>
    ${mtFiltro()}
    <div class="kpis k3 mt-kpis">
      ${kpi('Asistentes','' + metNum(totAsis),'a clases',{color:'var(--b3)'})}
      ${kpi('Gimnasio',gim?metNum(gim.D.tot):'—','personas contadas',{color:'var(--b1)'})}
      ${kpi('Disciplinas',as.length,'en el club',{color:'var(--b2)'})}
    </div>
    <div class="acards" style="margin-top:14px">${as.map(a=>mtAforoCard(a,r)).join('')||empty('No hay áreas registradas.')}</div>`;
}
/* desglose de una disciplina por profesor */
function vMetAforoDetalle(aid,r){
  const a=getArea(aid), D=mtAforoDatos(aid,r);
  let cuerpo, resumen;
  if(D.gim){
    const S=D.S, pts=ptSesionesEn(aid,r.desde,r.hasta,'realizada'), porProf={};
    pts.forEach(({pk})=>{ const p=getProf(aid,pk.profId); const k=pk.profId||'?'; porProf[k]=porProf[k]||{n:(p&&p.nombre)||'Sin instructor',s:0}; porProf[k].s++; });
    const filasProf=Object.values(porProf).sort((x,y)=>y.s-x.s).map(x=>mtFila(esc(x.n),'',plu(x.s,'sesión','sesiones'),'de personalizado')).join('');
    const horas=S.porHora.map(x=>mtFila(hh(x.h),`${Math.round(x.muP)} mujeres · ${Math.round(x.hoP)} hombres`,`${Math.round(x.tP)}`,'personas en promedio')).join('');
    resumen=`<div class="mt-split"><div><b>${metNum(D.mu)}</b><span>Mujeres</span></div><div><b>${metNum(D.ho)}</b><span>Hombres</span></div></div>`;
    cuerpo=`<div class="h2 sm">Por instructor (personalizados realizados)</div>${filasProf||empty('Sin sesiones de personalizado realizadas en este período.')}
      <div class="h2 sm">Por hora (promedio de personas)</div>${horas||empty('Sin conteos por hora.')}`;
  } else {
    const filas={};
    D.cur.gs.forEach(x=>{
      const key=x.g.profId?('p:'+x.g.profId):(x.g.prof?('n:'+String(x.g.prof).trim().toLowerCase()):'sin');
      const p=x.g.profId?getProf(aid,x.g.profId):null;
      const m=filas[key]=filas[key]||{n:p?p.nombre:(x.g.prof||'Sin profesor asignado'),asis:0,ses:0,clases:[]};
      m.asis+=x.asisTot; m.ses+=x.ses; if(x.ses) m.clases.push(x);
    });
    const orden=Object.values(filas).filter(x=>x.ses||x.asis).sort((x,y)=>y.asis-x.asis);
    resumen=`<div class="mt-big"><b>${metNum(D.tot)}</b><span>asistentes en total</span></div>${mtTipos(D)}${mtSplitSx(D.sx)}`;
    const vista=ui.mt.vista==='clase'?'clase':'prof';
    const tipoTxt=g=>(esFitArea(aid)||tipoGrupoDe(g)==='servicio')?'Servicio':'Academia';
    /* por clase: se suman todos los asistentes de la misma clase, sin importar el profesor ni el horario */
    const cls={};
    D.cur.gs.forEach(x=>{
      const k=fcNorm(x.g.nombre)||'sin nombre', c=cls[k]=cls[k]||{n:x.g.nombre,asis:0,ses:0,profes:new Set(),filas:[]};
      c.asis+=x.asisTot; c.ses+=x.ses; if(x.ses||x.asisTot){ c.profes.add(x.g.profId?('p:'+x.g.profId):('n:'+String(x.g.prof||'').trim().toLowerCase())); c.filas.push(x); }
    });
    const porClase=Object.values(cls).filter(c=>c.ses||c.asis).sort((x,y)=>y.asis-x.asis||String(x.n).localeCompare(String(y.n),'es'));
    const bloqueClase=`<div class="h2 sm">Asistentes por clase</div>
      <div class="sub" style="margin:0 0 8px">Cada clase suma todos sus asistentes, sin importar el profesor ni el horario.</div>
      ${porClase.length>6?`<input id="mt_q" class="mt-q" type="search" placeholder="Buscar clase…" autocomplete="off">`:''}
      <div id="mt_clases">${porClase.length?porClase.map(c=>`<details class="dg-a" data-q="${esc(fcNorm(c.n))}" style="--ac:${esc(a.color)}"><summary><div class="dg-t"><b>${esc(c.n)}</b><small>${plu(c.ses,'sesión','sesiones')} · ${plu(c.profes.size,'profesor','profesores')}${c.ses?` · ${(c.asis/c.ses).toFixed(1)} por sesión`:''}</small></div><div class="dg-v"><b>${metNum(c.asis)}</b><small>asistentes</small></div><span class="dg-chev">${ic('next')}</span></summary>
        <div class="dg-rows">${c.filas.sort((x,y)=>y.asisTot-x.asisTot).map(x=>{ const p=x.g.profId?getProf(aid,x.g.profId):null; return mtFila(esc((p&&p.nombre)||x.g.prof||'Sin profesor asignado'),esc([tipoTxt(x.g),x.g.hi,(x.g.dias?diasArr(x.g).map(i=>DIAS[i]).join(' · '):'')].filter(Boolean).join(' · ')),metNum(x.asisTot),plu(x.ses,'sesión','sesiones')); }).join('')}</div></details>`).join(''):empty('No hay asistentes registrados en este período.')}</div>`;
    const toggle=`<div class="seg mt-seg"><button class="${vista==='prof'?'on':''}" data-act="mtVista" data-v="prof">Por profesor</button><button class="${vista==='clase'?'on':''}" data-act="mtVista" data-v="clase">Por clase</button></div>`;
    cuerpo=toggle+(vista==='clase'?bloqueClase:`<div class="h2 sm">Asistentes por profesor</div>${orden.length?orden.map(m=>
      `<details class="dg-a" style="--ac:${esc(a.color)}"><summary><div class="dg-t"><b>${esc(m.n)}</b><small>${plu(m.ses,'sesión','sesiones')}</small></div><div class="dg-v"><b>${metNum(m.asis)}</b><small>asistentes</small></div><span class="dg-chev">${ic('next')}</span></summary>
        <div class="dg-rows">${m.clases.sort((x,y)=>y.asisTot-x.asisTot).map(x=>mtFila(esc(x.g.nombre),esc([(esFitArea(aid)||tipoGrupoDe(x.g)==='servicio')?'Servicio':'Academia',x.g.hi,(x.g.dias?diasArr(x.g).map(i=>DIAS[i]).join(' · '):'')].filter(Boolean).join(' · ')),metNum(x.asisTot),plu(x.ses,'sesión','sesiones'))).join('')}</div></details>`).join('')
      :empty('No hay asistentes registrados en este período.')}`);
  }
  return `<div class="mt-back"><button class="btn sm" data-act="mtAforoVolver">${ic('back')} Regresar</button></div>
    <div class="h2">${areaIco(a,{size:22})} ${esc(a.nombre)}</div>
    <div class="mt-per">${esc(mtPerTxt(r))}</div>
    <div class="card mt-res">${resumen}</div>
    ${cuerpo}
    ${typeof peSeccionMet==='function'?peSeccionMet(aid):''}`;
}
/* mujeres / hombres de las clases (dato que manda Fitness Control); si el área no lo trae, no se muestra */
function mtSplitSx(sx){
  if(!sx||!sx.n||!sx.tot) return '';
  return `<div class="mt-split"><div><b>${metNum(sx.mu)}</b><span>Mujeres</span></div><div><b>${metNum(sx.ho)}</b><span>Hombres</span></div></div>`;
}
/* Asistentes por tipo de grupo: SERVICIO (gratuito, sin inscripción) y ACADEMIA (con costo e inscripción) */
function mtTipos(D){
  const T=D.tipos; if(!T) return '';
  const bloque=(l,n,s,c)=>`<div class="mt-tp ${c}"><b>${metNum(n)}</b><span>${l}</span><small>${s?plu(s,'sesión','sesiones'):'sin sesiones'}</small></div>`;
  const academia=!D.fit||T.academia>0;                                    // las clases fitness son de servicio: la academia solo sale si hay
  return `<div class="mt-tipos${academia?'':' uno'}">${bloque('Servicio · asistentes',T.servicio,T.sesS,'srv')}${academia?bloque('Academia · asistentes',T.academia,T.sesA,'aca'):''}</div>`;
}
function mtFila(titulo,sub,valor,detalle){
  return `<div class="dg-r"><div class="dg-rt"><b>${titulo}</b><small>${sub||''}</small></div><div class="dg-rv"><b>${valor}</b><small>${detalle||''}</small></div></div>`;
}

/* ---------- EVENTOS ---------- */
function mtEventos(aid,r){ return coll(aid,'eventos').filter(e=>e.fecha>=r.desde&&e.fecha<=r.hasta).sort((a,b)=>a.fecha.localeCompare(b.fecha)); }
function vMetEventos(){
  const r=mtRango();
  if(ui.mt.eArea&&getArea(ui.mt.eArea)) return vMetEventosArea(ui.mt.eArea,r);
  const filas=areasList().map(a=>({a,evs:mtEventos(a.id,r)})).filter(x=>x.evs.length||!esServ(x.a.id));
  const total=filas.reduce((s,x)=>s+x.evs.length,0);
  return `<div class="sub">Eventos de cada área en las fechas elegidas. Toca un área para ver sus eventos.</div>
    ${mtFiltro()}
    <div class="btns no-print"><button class="btn primary" data-act="mtEvReporte" data-aid="all">${ic('doc')} Imprimir reporte de eventos (todas las áreas)</button></div>
    <div class="kpis k3 mt-kpis">
      ${kpi('Eventos',total,'en el período',{color:'var(--b3)'})}
      ${kpi('Realizados',filas.reduce((s,x)=>s+x.evs.filter(e=>e.estado==='realizado').length,0),'',{color:'var(--b1)'})}
      ${kpi('Por realizar',filas.reduce((s,x)=>s+x.evs.filter(e=>(e.estado||'planificado')==='planificado').length,0),'',{color:'var(--warn)'})}
    </div>
    <div class="acards" style="margin-top:14px">${filas.map(({a,evs})=>`<button class="acard mt-card" data-act="mtEvArea" data-id="${esc(a.id)}" style="--ac:${esc(a.color)}">
      <div class="ac-h">${areaIco(a,{tile:true,size:22})}<b>${esc(a.nombre)}</b><span class="mt-go">${ic('next')}</span></div>
      <div class="mt-big"><b>${evs.length}</b><span>${evs.length===1?'evento':'eventos'}</span></div></button>`).join('')}</div>`;
}
function vMetEventosArea(aid,r){
  const a=getArea(aid), evs=mtEventos(aid,r);
  return `<div class="mt-back"><button class="btn sm" data-act="mtEvVolver">${ic('back')} Regresar</button></div>
    <div class="h2">${areaIco(a,{size:22})} ${esc(a.nombre)}</div>
    <div class="mt-per">${esc(mtPerTxt(r))}</div>
    ${evs.length?`<div class="btns"><button class="btn primary" data-act="mtEvReporte" data-aid="${esc(aid)}">${ic('doc')} Imprimir reporte de ${esc(a.nombre)}</button></div>`:''}
    ${evs.length?`<div class="evlist">${evs.map(e=>{ const d=parseYmd(e.fecha); return `<button class="ev-c" data-act="mtEvento" data-aid="${esc(aid)}" data-id="${esc(e.id)}">
      <div class="ev-d"><b>${d.getDate()}</b><span>${MESES[d.getMonth()].slice(0,3)}</span></div>
      <div class="ev-i"><b>${esc(e.nombre)}</b><small>${esc([e.tipo,e.hora,e.lugar].filter(Boolean).join(' · '))}${e.participantes?' · '+(+e.participantes)+' participantes':''}${infTag(aid,e)}</small></div>
      ${pill(e.estado||'planificado',EST_EV_CLS[e.estado]||'info')}</button>`; }).join('')}</div>`
      :empty('No hay eventos de esta área en el período elegido.')}`;
}

/* =====================================================================
   PRUEBAS FÍSICAS
   ===================================================================== */
const RF_TIPOS = [{id:'rufier',nombre:'Prueba de Rufier',desc:'Resistencia cardiovascular: 30 sentadillas en 45 s y pulso en reposo, al esfuerzo y a la recuperación.'}];
const pruebasAll = () => Object.values((state.met&&state.met.pruebas)||{}).sort((a,b)=>(b.creado||0)-(a.creado||0));
const getPrueba = id => ((state.met&&state.met.pruebas)||{})[id]||null;
const rfResultados = pid => Object.values(((state.met&&state.met.rufier)||{})[pid]||{}).map(rfNorm);
/* estado de una aplicación: programada (aún no inicia), activa, finalizada */
function pruebaEstado(p){
  const t=todayStr();
  if(p.cerrada) return 'finalizada';
  if(p.fin&&t>p.fin) return 'finalizada';
  if(p.inicio&&t<p.inicio) return 'programada';
  return 'activa';
}
const PR_CLS = {activa:'ok',programada:'info',finalizada:'mut'};
/* La prueba se aplica a PERSONAS (alumnos o socios), no a los profesores:
   el profesor o el director la aplica a quien elija, escribiendo su nombre o
   tomándolo de la lista de alumnos de uno de sus grupos. */
const normNom = n => String(n||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const rfKey = (aid,nombre) => `${aid}_${normNom(nombre).replace(/ /g,'')}`.slice(0,80);
const rfResultado = (pid,aid,nombre) => { const r=(((state.met&&state.met.rufier)||{})[pid]||{})[rfKey(aid,nombre)]; return r?rfNorm(r):null; };
const rfLista = (pid,aid) => rfResultados(pid).filter(r=>!aid||r.aid===aid).sort((a,b)=>String(b.fecha+(b.hora||'')).localeCompare(a.fecha+(a.hora||'')));
const rfMios = (pid,aid) => rfLista(pid,aid).filter(r=>r.aplicaId===(session.rol==='dir'?'dir':session.profId));

/* TEST DE RUFFIER-DICKSON (como lo define Metodología deportiva, Manual de consulta del profesor deportivo, 2.ª ed. 2023, págs. 8 y 9):
     P0 = pulsaciones por minuto (ppm) en reposo
     P1 = ppm al finalizar 30 flexiones y extensiones profundas de piernas en 45 s
     P2 = ppm transcurrido un minuto de acabadas las flexiones
     Índice = ((P0 + P1 + P2) − 200) ÷ 10
   Interpretación: 0 o menos = E · 0.1 a 5 = MB · 5.1 a 10 = B · 10.1 a 15 = R · más de 15 = M.
   Los pulsos se guardan en ppm (v:2). Los resultados de la primera versión (v1) guardaban conteos de 15 s: rfNorm los convierte. */
const rfNorm = r => (r&&r.v>=2) ? r : {...r, p0:(+r.p1||0)*4, p1:(+r.p2||0)*4, p2:(+r.p3||0)*4};
function rfIndice(p0,p1,p2){ return Math.round(p0+p1+p2-200)/10; }
function rfClasifica(ind){
  if(ind<=0) return {t:'Excelente',c:'ok',k:'E'};
  if(ind<=5) return {t:'Muy buena',c:'ok',k:'MB'};
  if(ind<=10) return {t:'Buena',c:'info',k:'B'};
  if(ind<=15) return {t:'Regular',c:'warn',k:'R'};
  return {t:'Mala',c:'bad',k:'M'};
}
/* Flexibilidad: referencia en cm por sexo y edad (tabla de captura de Metodología). Entre una década y otra se interpola. */
const RF_FLEX_EDADES = [10,20,30,40,50,60,70,80,90];
const RF_FLEX = {M:[10,14,15,16,22,23,27,28,34], F:[14,18,22,23,28,29,32,33,37]};
function rfFlexRef(sx,edad){
  const v=RF_FLEX[sx]; if(!v||!(edad>0)) return null;
  if(edad<=10) return v[0]; if(edad>=90) return v[8];
  const i=Math.floor(edad/10)-1, f=(edad-(i+1)*10)/10;
  return Math.round((v[i]+(v[i+1]-v[i])*f)*10)/10;
}
function rfFlexEval(r){                                        // {ref, dif, ok} o null si falta flexibilidad, sexo o edad
  if(!r||r.flex==null||r.flex==='') return null;
  const ref=rfFlexRef(r.sexo,+r.edad); if(ref==null) return null;
  const dif=Math.round((+r.flex-ref)*10)/10; return {ref,dif,ok:dif>=0};
}
/* Índice de masa corporal (tabla de captura de Metodología): IMC = peso (kg) ÷ talla (m)².
   La tabla trae "menor a 18.9" y "18.50 a 24.99" encimados; se usa 18.5 como corte del peso normal. */
const RF_IMC = [
  {min:40,  t:'Obesidad mórbida', k:'OM', c:'bad',  r:'Mayor a 40.0'},
  {min:35,  t:'Obesidad media',   k:'OM2',c:'bad',  r:'35.00 a 39.99'},
  {min:30,  t:'Obesidad leve',    k:'OL', c:'warn', r:'30.00 a 34.99'},
  {min:25,  t:'Sobrepeso',        k:'SP', c:'warn', r:'25.00 a 29.99'},
  {min:18.5,t:'Peso normal',      k:'N',  c:'ok',   r:'18.50 a 24.99'},
  {min:0,   t:'Peso bajo',        k:'PB', c:'info', r:'Menor a 18.5'}
];
function rfImc(peso,talla){                                     // {v, t, c} o null si falta peso o talla
  peso=+peso; talla=+talla; if(!(peso>0&&talla>0)) return null;
  const m=talla>3?talla/100:talla, v=peso/(m*m), cat=RF_IMC.find(x=>v>=x.min)||RF_IMC[RF_IMC.length-1];
  return {v:Math.round(v*10)/10, t:cat.t, c:cat.c, k:cat.k};
}
/* CALIFICACIÓN (0 a 10) — cada prueba da puntos según su nivel y la calificación final es el promedio de las tres:
     10 = excelente · 8 = muy buena · 7 = buena · 6 = regular  (por debajo de regular: 5 = deficiente)
   Ruffier: E=10 · MB=8 · B=7 · R=6 · M=5.
   IMC: peso normal=10 · sobrepeso=8 · peso bajo=7 · obesidad leve=6 · obesidad media o mórbida=5.
   Flexibilidad (centímetros contra la referencia de su sexo y edad): 110% o más=10 · 100 a 109%=8 · 85 a 99%=7 · 70 a 84%=6 · menos de 70%=5.
   Si falta una prueba (por ejemplo no se midió la flexibilidad), el promedio se hace con las que sí hay y se marca como parcial.
   Calificación final: 9 a 10 excelente · 8 a 8.9 muy buena · 7 a 7.9 buena · 6 a 6.9 regular · menos de 6 deficiente. */
const RF_PTS_NIVEL = {10:['Excelente','ok'],8:['Muy buena','ok'],7:['Buena','info'],6:['Regular','warn'],5:['Deficiente','bad']};
const RF_PTS_IMC = {N:10,SP:8,PB:7,OL:6,OM2:5,OM:5};
const RF_PTS_RUF = {E:10,MB:8,B:7,R:6,M:5};
const RF_NIV_FINAL = [[9,'Excelente','ok'],[8,'Muy buena','ok'],[7,'Buena','info'],[6,'Regular','warn'],[0,'Deficiente','bad']];
function rfPtsFlex(r){ const fx=rfFlexEval(r); if(!fx) return null; const pc=fx.ref>0?(+r.flex/fx.ref*100):100; return pc>=110?10:pc>=100?8:pc>=85?7:pc>=70?6:5; }
function rfCalif(r){
  const im=rfImc(r.peso,r.talla), c=rfClasifica(r.ind), pi=im?RF_PTS_IMC[im.k]:null, pf=rfPtsFlex(r), pr=RF_PTS_RUF[c.k];
  const a=[pi,pf,pr].filter(x=>x!=null), v=Math.round(a.reduce((x,y)=>x+y,0)/a.length*10)/10, n=RF_NIV_FINAL.find(x=>v>=x[0]);
  return {pi,pf,pr,v,t:n[1],c:n[2],n:a.length,parcial:a.length<3};
}
/* Evaluación final: junta IMC + flexibilidad + Ruffier y dice hacia dónde trabajar la condición física. */
function rfFinal(r){
  const im=rfImc(r.peso,r.talla), fx=rfFlexEval(r), c=rfClasifica(r.ind), tr=[], cortos=[], fo=[], av=[];
  if(im){
    if(im.k==='N') fo.push('peso adecuado para su talla');
    else if(im.k==='PB'){ tr.push('peso bajo: ganar masa muscular con apoyo de nutrición y fuerza progresiva'); cortos.push('Peso'); }
    else if(im.k==='SP'){ tr.push('sobrepeso: control de peso con ejercicio aeróbico regular y cuidado de la alimentación'); cortos.push('Peso'); }
    else if(im.k==='OL'){ tr.push('obesidad leve: plan de reducción de peso con ejercicio aeróbico de bajo impacto y orientación nutricional'); cortos.push('Peso'); }
    else { tr.push('obesidad '+(im.k==='OM'?'mórbida':'media')+': orientación nutricional y valoración médica; ejercicio de bajo impacto y progresivo'); cortos.push('Peso'); av.push('IMC muy elevado'); }
  }
  if(fx){
    if(fx.ok) fo.push('flexibilidad en o sobre la referencia');
    else { tr.push(`flexibilidad ${Math.abs(fx.dif)} cm por debajo de la referencia: estiramientos diarios y movilidad`); cortos.push('Flexibilidad'); }
  }
  if(c.k==='E'||c.k==='MB') fo.push('resistencia cardiovascular '+(c.k==='E'?'excelente':'muy buena'));
  else if(c.k==='B'){ fo.push('resistencia cardiovascular buena'); tr.push('seguir con trabajo aeróbico progresivo para pasar de buena a muy buena'); cortos.push('Resistencia (mantener)'); }
  else if(c.k==='R'){ tr.push('resistencia cardiovascular baja: acondicionamiento aeróbico gradual y reevaluar'); cortos.push('Resistencia'); }
  else { tr.push('resistencia cardiovascular mala: evitar cargas intensas, consultar al médico y empezar con aeróbico suave'); cortos.push('Resistencia'); av.push('índice Ruffier mayor a 15'); }
  if(r.p0>100) av.push('pulso en reposo arriba de 100 ppm');
  const falta=[!im&&'talla y peso',!fx&&'flexibilidad (o sexo y edad)'].filter(Boolean);
  const urgente = av.length>0, aMejorar = tr.filter(x=>!/^seguir con trabajo aeróbico/.test(x)).length;
  const nivel = urgente?'Requiere atención':aMejorar===0?'Favorable':aMejorar===1?'Un área por mejorar':'Varias áreas por mejorar';
  const nc = urgente?'bad':aMejorar===0?'ok':aMejorar===1?'info':'warn';
  const txt = (tr.length?'Trabajar: '+tr.join('; ')+'.':'Sin áreas prioritarias: mantener y progresar.')
    + (fo.length?' Fortalezas: '+fo.join('; ')+'.':'')
    + (av.length?' Atención: '+av.join('; ')+' (se sugiere valoración médica).':'')
    + (falta.length?' Faltan datos: '+falta.join(' y ')+'.':'');
  const cal=rfCalif(r);
  return {txt,tr,cortos,fo,av,nivel,nc,im,fx,c,cal};
}
const RF_CALIF_TABLA = [   // puntos, nivel, IMC, flexibilidad (% de la referencia), Ruffier
  [10,'Excelente','Peso normal','110% o más','E · índice 0 o menos'],
  [8,'Muy buena','Sobrepeso','100% a 109%','MB · 0.1 a 5'],
  [7,'Buena','Peso bajo','85% a 99%','B · 5.1 a 10'],
  [6,'Regular','Obesidad leve','70% a 84%','R · 10.1 a 15'],
  [5,'Deficiente','Obesidad media o mórbida','Menos de 70%','M · más de 15']
];
const RF_CALIF_NOTA = 'La calificación final (0 a 10) es el promedio de los puntos de IMC, flexibilidad y Ruffier: 9 a 10 excelente · 8 a 8.9 muy buena · 7 a 7.9 buena · 6 a 6.9 regular · menos de 6 deficiente. Si falta alguna prueba, se promedia con las que sí se hicieron y se marca como parcial.';
const rfRef = [['0 o menos','Excelente (E)'],['0.1 a 5','Muy buena (MB)'],['5.1 a 10','Buena (B)'],['10.1 a 15','Regular (R)'],['Más de 15','Mala (M)']];

/* ---------- pestaña Pruebas (metodólogo) ---------- */
function vMetPruebas(){
  if(ui.mt.rep) return vMetReporte();
  if(ui.mt.nuevo) return vMetNueva();
  if(ui.mt.pSel&&getPrueba(ui.mt.pSel)) return vMetPruebaDetalle(getPrueba(ui.mt.pSel));
  const ps=pruebasAll();
  return `<div class="sub">Aplica pruebas físicas a los profesores. Al comenzar una prueba, aparece en el portal de cada profesor y del director de las disciplinas que elijas.</div>
    <div class="h2">Pruebas disponibles</div>
    ${RF_TIPOS.map(t=>`<button class="line mt-prueba" style="--ac:var(--b3)" data-act="mtNueva" data-t="${t.id}"><div class="t">${ic('bolt')}</div><div class="b"><b>${esc(t.nombre)}</b><small>${esc(t.desc)}</small></div><div class="r">${ic('next')}</div></button>`).join('')}
    <div class="sub" style="margin-top:6px">Más pruebas se irán agregando aquí.</div>
    <div class="h2">Aplicaciones ${ps.length?`<button class="btn sm primary" data-act="mtRep" data-id="${esc(ps[0].id)}">Reporte de interpretación</button>`:''}</div>
    ${ps.length?ps.map(p=>{ const st=pruebaEstado(p), hechos=rfLista(p.id).length;
      return `<button class="line" style="--ac:${st==='activa'?'var(--ok)':st==='programada'?'var(--info)':'var(--mut)'}" data-act="mtPrueba" data-id="${esc(p.id)}">
        <div class="b"><b>${esc(p.nombre||'Prueba de Rufier')}</b><small>${esc((p.areas||[]).map(id=>(getArea(id)||{}).nombre).filter(Boolean).join(', ')||'Sin disciplinas')}<br>${esc(p.inicio?fmtCorta(p.inicio):'')}${p.fin?' al '+esc(fmtCorta(p.fin)):' · sin fecha de término'}</small></div>
        <div class="r">${pill(st,PR_CLS[st])}<small>${plu(hechos,'persona evaluada','personas evaluadas')}</small></div></button>`; }).join('')
      :empty('Todavía no has aplicado ninguna prueba. Elige la prueba de Rufier para comenzar.')}`;
}
function vMetNueva(){
  const n=ui.mt.nuevo, as=areasList().filter(a=>!esServ(a.id)||profesores(a.id).length);
  return `<div class="mt-back"><button class="btn sm" data-act="mtNuevaCancel">${ic('back')} Regresar</button></div>
    <div class="h2">Nueva aplicación · Prueba de Rufier</div>
    <div class="sub">Elige a qué disciplinas les aparece. Les saldrá a todos sus profesores, incluido el director.</div>
    <div class="card">
      <div class="f"><span class="lb">Disciplinas</span>
        <div class="chips mt-chips"><button class="chip${n.areas.length===as.length?' on':''}" data-act="mtNuevaTodas">Todas</button>
        ${as.map(a=>`<button class="chip${n.areas.includes(a.id)?' on':''}" data-act="mtNuevaArea" data-id="${esc(a.id)}">${esc(a.nombre)}</button>`).join('')}</div></div>
      <div class="two"><label class="f"><span>Comienza</span><input type="date" id="mn_ini" value="${esc(n.inicio)}"></label>
        <label class="f"><span>Termina (opcional)</span><input type="date" id="mn_fin" value="${esc(n.fin)}"></label></div>
      <small class="mut">Si no pones fecha de término, la prueba sigue abierta hasta que tú presiones “Finalizar”.</small>
      <div class="btns"><button class="btn cta block" data-act="mtNuevaIniciar">Comenzar prueba</button></div>
    </div>`;
}
function vMetPruebaDetalle(p){
  const st=pruebaEstado(p), todos=rfLista(p.id), inds=todos.map(r=>r.ind);
  const prom=inds.length?Math.round(inds.reduce((s,v)=>s+v,0)/inds.length*10)/10:null;
  const porArea=(p.areas||[]).map(aid=>{ const a=getArea(aid); if(!a) return '';
    const fs=rfLista(p.id,aid);
    return `<div class="h2 sm">${areaIco(a,{size:18})} ${esc(a.nombre)} · ${plu(fs.length,'persona','personas')}</div>`+
      (fs.length?fs.map(r=>{ const c=rfClasifica(r.ind);
        return `<div class="dg-r"><div class="dg-rt"><b>${esc(r.nombre)}</b><small>${esc([r.grupo,r.sexo==='M'?'Hombre':r.sexo==='F'?'Mujer':'',r.edad?r.edad+' años':'',`P0 ${r.p0} · P1 ${r.p1} · P2 ${r.p2} ppm`,fmtCorta(r.fecha),r.aplica?'Aplicó: '+r.aplica:''].filter(Boolean).join(' · '))}</small></div>
          <div class="dg-rv"><b>${r.ind.toFixed(1)}</b>${pill(c.k+' · '+c.t,c.c)}</div></div>`; }).join(''):`<div class="sub">Todavía sin personas evaluadas.</div>`); }).join('');
  return `<div class="mt-back"><button class="btn sm" data-act="mtPruebaVolver">${ic('back')} Regresar</button></div>
    <div class="h2">${esc(p.nombre||'Prueba de Rufier')} ${pill(st,PR_CLS[st])}</div>
    <div class="mt-per">${esc(p.inicio?fmtLarga(p.inicio):'')}${p.fin?' al '+esc(fmtLarga(p.fin)):' · sin fecha de término'}</div>
    <div class="kpis k3 mt-kpis">${kpi('Evaluados',todos.length,'personas',{color:'var(--b2)'})}${kpi('Índice promedio',prom==null?'—':prom.toFixed(1),prom==null?'':rfClasifica(prom).t,{color:'var(--b3)'})}${kpi('Disciplinas',(p.areas||[]).length,'',{color:'var(--b1)'})}</div>
    <div class="btns"><button class="btn cta" data-act="mtRep" data-id="${esc(p.id)}">Reporte de interpretación</button></div>
    <div class="btns">${st==='finalizada'?`<button class="btn" data-act="mtPruebaReabrir" data-id="${esc(p.id)}">Reabrir prueba</button>`:`<button class="btn primary" data-act="mtPruebaFin" data-id="${esc(p.id)}">Finalizar prueba</button>`}
</div>
    ${porArea}
    <div class="an-nota">Índice de Ruffier-Dickson = ((P0 + P1 + P2) − 200) ÷ 10, con P0 en reposo, P1 al finalizar la actividad y P2 un minuto después, todos en pulsaciones por minuto (ppm). Referencia: ${rfRef.map(x=>`${x[0]} = ${x[1]}`).join(' · ')}.</div>`;
}
/* ---------- aviso en el portal del profesor y del director ---------- */
function pruebasPara(aid,profId){                  // pruebas activas que le tocan a esta persona
  return pruebasAll().filter(p=>pruebaEstado(p)==='activa'&&(p.areas||[]).includes(aid));
}
function metBanner(){
  if(!session||!['prof','dir'].includes(session.rol)||ui.rufier) return '';
  const aid=session.area, ps=pruebasPara(aid);
  if(!ps.length) return '';
  return ps.map(p=>{
    const mios=rfMios(p.id,aid).length, area=rfLista(p.id,aid).length;
    return `<div class="mt-aviso"><div><b>${esc(p.nombre||'Prueba de Rufier')}</b><small>Metodología deportiva pide aplicar esta prueba${session.rol==='dir'?' en tu disciplina':' a tus alumnos'}. ${session.rol==='dir'?`Evaluados en tu área: ${area}.`:`Has evaluado: ${mios}.`}</small></div>
      <button class="btn primary" data-act="rfAbrir" data-id="${esc(p.id)}">Aplicar prueba</button></div>`;
  }).join('');
}
/* =====================================================================
   PRUEBA DE RUFIER CON CRONÓMETRO
   Secuencia: reposo 5 min → pulso en reposo (15 s) → 30 sentadillas en 45 s
   con metrónomo → pulso inmediato (15 s) → recuperación 30 s → pulso al
   minuto (15 s) → confirmar los tres conteos → resultado.
   Los conteos de pulso se hacen tocando la pantalla en cada latido
   (también se pueden escribir a mano al confirmar).
   ===================================================================== */
const RF = { REPOSO:300, CONTEO:15, PREP:3, SENT:45, REPS:30, REC:30 };
let rfTimer=null, rfAudio=null, rfLock=null;
const rfBusy = () => !!(ui.rufier && !['intro','fin'].includes(ui.rufier.fase));

function rfBeep(f,ms){
  try{
    rfAudio = rfAudio || new (window.AudioContext||window.webkitAudioContext)();
    if(rfAudio.state==='suspended') rfAudio.resume();
    const o=rfAudio.createOscillator(), g=rfAudio.createGain();
    o.frequency.value=f; o.type='sine'; g.gain.value=.25; o.connect(g); g.connect(rfAudio.destination);
    o.start(); o.stop(rfAudio.currentTime+ms/1000);
  }catch(e){}
  try{ if(navigator.vibrate) navigator.vibrate(Math.min(ms,120)); }catch(e){}
}
async function rfPantalla(on){                              // evita que el celular se apague durante la prueba
  try{
    if(on&&navigator.wakeLock&&!rfLock){ rfLock=await navigator.wakeLock.request('screen'); rfLock.addEventListener('release',()=>{ rfLock=null; }); }
    if(!on&&rfLock){ await rfLock.release(); rfLock=null; }
  }catch(e){}
}
function rfAbrir(pid){
  if(!getPrueba(pid)) return;
  ui.rufier={pid,q:null,fase:'intro',modo:'nombre',nombre:'',sexo:'',edad:'',talla:'',peso:'',flex:'',gid:'',alumno:'',p0:null,p1:null,p2:null,taps:0,manual:false};
  render(); top0();
}
/* grupos con lista de alumnos que esta persona puede usar (el director, todos los de su área) */
function rfGruposLista(){
  const aid=session.area;
  const gs=session.rol==='dir'?grupos(aid):clasesDe(aid,session.profId);
  return gs.filter(g=>rosterOf(g).length).sort(byHora);
}
const rfQuienNom = () => session.rol==='dir'?'Dirección':((getProf(session.area,session.profId)||{}).nombre||'Profesor');
/* fija a quién se le aplica; devuelve false si falta el nombre */
function rfFijaQuien(){
  const R=ui.rufier; if(!R) return false;
  if(R.q) return true;
  const nom=String(R.modo==='lista'?R.alumno:R.nombre).trim();
  if(!nom){ toast(R.modo==='lista'?'Elige a la persona de la lista':'Escribe el nombre de la persona'); return false; }
  if(R.sexo!=='M'&&R.sexo!=='F'){ toast('Elige el sexo de la persona (M o F)'); return false; }
  const g=R.modo==='lista'?grupos(session.area).find(x=>x.id===R.gid):null;
  const num=(v,min,max)=>{ const x=parseFloat(String(v).replace(',','.')); return (x>=min&&x<=max)?Math.round(x*10)/10:null; };
  const ed=parseInt(R.edad,10);
  R.q={aid:session.area,nombre:nom,sexo:R.sexo,edad:(ed>0&&ed<110)?ed:null,talla:num(R.talla,50,250),peso:num(R.peso,10,300),flex:num(R.flex,-30,80),gid:g?g.id:'',grupo:g?g.nombre:''};
  return true;
}
function rfLimpiar(){ clearInterval(rfTimer); rfTimer=null; rfPantalla(false); ui.rufier=null; }
function rfSalir(){ clearInterval(rfTimer); rfTimer=null; rfPantalla(false); ui.rufier=null; render(); top0(); }

/* arranca una fase cronometrada; al terminar llama a sigue() */
function rfFase(fase,seg,sigue){
  const R=ui.rufier; if(!R) return;
  clearInterval(rfTimer);
  R.fase=fase; R.fin=Date.now()+seg*1000; R.seg=seg; R.rep=0; R.taps=0; R.sigue=sigue;
  render();
  rfTimer=setInterval(rfTick,100);
  rfTick();
}
function rfTick(){
  const R=ui.rufier; if(!R||!R.fin) return;
  const resta=Math.max(0,R.fin-Date.now()), s=Math.ceil(resta/1000);
  if(R.fase==='sent'){                                      // metrónomo: una sentadilla cada 1.5 s
    const rep=Math.min(RF.REPS,Math.floor((R.seg*1000-resta)/1500)+1);
    if(rep!==R.rep&&resta>0){ R.rep=rep; rfBeep(rep%2?880:660,90); const e=$('#rf_rep'); if(e) e.textContent=rep; }
  } else if(R.fase==='prep'||(resta>0&&resta<=3000&&['reposo','rec'].includes(R.fase))){
    if(R.ult!==s){ R.ult=s; rfBeep(660,80); }
  }
  const t=$('#rf_t'); if(t) t.textContent=R.fase==='reposo'||R.fase==='rec'?rfMS(s):String(s);
  const b=$('#rf_bar'); if(b) b.style.width=Math.max(0,Math.min(100,(R.seg*1000-resta)/(R.seg*1000)*100))+'%';
  if(resta<=0){ clearInterval(rfTimer); rfTimer=null; rfBeep(1040,350); const f=R.sigue; R.fin=0; if(f) f(); }
}
const rfMS = s => `${Math.floor(s/60)}:${pad(s%60)}`;

/* encadena las fases */
function rfIrReposo(){ rfPantalla(true); rfFase('reposo',RF.REPOSO,rfIrP1Listo); }
function rfIrP1Listo(){ clearInterval(rfTimer); const R=ui.rufier; R.fase='p1listo'; R.fin=0; render(); }
function rfIrP1(){ rfFase('p1',RF.CONTEO,()=>{ const R=ui.rufier; R.p0=R.taps*4; R.fase='p1cap'; render(); }); }
function rfIrSentListo(){ clearInterval(rfTimer); const R=ui.rufier; R.fase='sentlisto'; R.fin=0; render(); }
function rfIrPrep(){ rfFase('prep',RF.PREP,()=>rfFase('sent',RF.SENT,()=>rfFase('p2',RF.CONTEO,()=>{ ui.rufier.p1=ui.rufier.taps*4;
  rfFase('rec',RF.REC,()=>rfFase('p3',RF.CONTEO,()=>{ const R=ui.rufier; R.p2=R.taps*4; R.fase='cap'; render(); })); }))); }
function rfGuardar(){
  const R=ui.rufier, p=getPrueba(R.pid);
  const g=id=>Math.round(+($('#'+id)||{}).value);
  const p0=g('rf_p0'), p1=g('rf_p1'), p2=g('rf_p2');
  if([p0,p1,p2].some(v=>!(v>=30&&v<=240))){ toast('Cada pulso (ppm) debe estar entre 30 y 240 pulsaciones por minuto'); return; }
  const ind=rfIndice(p0,p1,p2), now=new Date(), key=rfKey(R.q.aid,R.q.nombre), q=R.q;
  setPath(`met/rufier/${R.pid}/${key}`,{v:2,id:key,pruebaId:R.pid,aid:q.aid,nombre:q.nombre,sexo:q.sexo,edad:q.edad||null,talla:q.talla==null?null:q.talla,peso:q.peso==null?null:q.peso,flex:q.flex==null?null:q.flex,
    grupoId:q.gid||'',grupo:q.grupo||'',p0,p1,p2,ind,fecha:todayStr(),hora:pad(now.getHours())+':'+pad(now.getMinutes()),
    aplicaId:session.rol==='dir'?'dir':session.profId,aplica:rfQuienNom(),manual:!!R.manual});
  R.p0=p0; R.p1=p1; R.p2=p2; R.ind=ind; R.fase='fin'; rfPantalla(false); render(); top0();
}

function vRufier(){
  const R=ui.rufier, p=getPrueba(R.pid)||{}, f=R.fase, esDir=session.rol==='dir';
  const cab=(tit,sub)=>`<div class="rf-h"><b>${tit}</b>${sub?`<small>${sub}</small>`:''}</div>`;
  const salir=`<div class="rf-x"><button class="btn sm" data-act="rfSalir">${f==='fin'?'Cerrar':'Cancelar prueba'}</button></div>`;
  const reloj=(etq,instr,tipo)=>`<div class="rf-card ${tipo||''}"><div class="rf-etq">${etq}</div><div class="rf-t" id="rf_t">${f==='reposo'||f==='rec'?rfMS(Math.ceil(Math.max(0,R.fin-Date.now())/1000)):Math.ceil(Math.max(0,R.fin-Date.now())/1000)}</div>
    <div class="bar rf-bar"><i id="rf_bar" style="width:0"></i></div><div class="rf-i">${instr}</div></div>`;
  const ppm=(id,l,v)=>`<label class="f"><span>${l}</span><input id="${id}" type="number" inputmode="numeric" min="30" max="240" value="${v==null?'':v}" placeholder="ppm"></label>`;
  let cuerpo='';
  if(f==='intro'){
    const gs=rfGruposLista(), g=gs.find(x=>x.id===R.gid)||null, nombres=g?rosterOf(g):[];
    const modoBtn=(m,l)=>`<button class="${R.modo===m?'on':''}" data-act="rfModo" data-m="${m}">${l}</button>`;
    const quien = R.modo==='lista'
      ? (gs.length?`<label class="f"><span>Grupo</span><select id="rf_grupo"><option value="">Elige un grupo…</option>${gs.map(x=>`<option value="${esc(x.id)}"${x.id===R.gid?' selected':''}>${esc(x.nombre)}${x.hi?' · '+esc(x.hi):''}</option>`).join('')}</select></label>
          ${g?`<div class="rf-alumnos">${nombres.map((n,i)=>`<button class="rf-al${R.alumno===n?' on':''}" data-act="rfAlumno" data-i="${i}"><span>${esc(n)}</span>${rfResultado(R.pid,session.area,n)?'<em>✔ ya evaluado</em>':''}</button>`).join('')}</div>`:'<small class="mut">Elige el grupo para ver a sus alumnos.</small>'}`
        :`<div class="an-cs">Tus grupos todavía no tienen lista de alumnos. Escribe el nombre de la persona.</div>`)
      : `<label class="f"><span>Nombre y apellidos</span><input id="rf_nombre" value="${esc(R.nombre)}" placeholder="Nombre y apellidos" autocomplete="off"></label>`;
    const num=(id,l,v,ph,st)=>`<label class="f"><span>${l}</span><input id="${id}" type="number" inputmode="decimal" step="${st||1}" value="${esc(v)}" placeholder="${ph}"></label>`;
    const datos=`<div class="rf-datos"><label class="f"><span>Sexo</span><select id="rf_sexo"><option value="">Elige…</option><option value="M"${R.sexo==='M'?' selected':''}>M · Hombre</option><option value="F"${R.sexo==='F'?' selected':''}>F · Mujer</option></select></label>
      ${num('rf_edad','Edad (años)',R.edad,'Ej. 34')}${num('rf_talla','Talla (cm)',R.talla,'Ej. 170')}${num('rf_peso','Peso (kg)',R.peso,'Ej. 68',0.1)}${num('rf_flex','Flexibilidad (cm)',R.flex,'Ej. 15',0.5)}</div>`;
    const nomSel=String(R.modo==='lista'?R.alumno:R.nombre).trim(), yaHecho=nomSel?rfResultado(R.pid,session.area,nomSel):null;
    cuerpo=`${cab(esc(p.nombre||'Prueba de Rufier'),'Test de Ruffier-Dickson · mide la resistencia cardíaca al esfuerzo y la capacidad de recuperación')}
      <div class="h2 sm">¿A quién se le aplica?</div>
      <div class="seg" style="margin-bottom:10px">${modoBtn('nombre','Escribir nombre')}${modoBtn('lista','De mi lista de alumnos')}</div>
      <div class="card">${quien}${datos}<small class="mut">Talla, peso y flexibilidad son los datos de la tabla de captura de Metodología; si no los tienes, déjalos en blanco.</small></div>
      <div class="card rf-pasos"><b>Cómo se aplica</b><ol>
        <li><b>P0 · reposo.</b> La persona se sienta o acuesta y descansa <b>5 minutos</b> (el cronómetro los cuenta). Se miden sus pulsaciones por minuto (ppm): se cuentan 15 segundos y se multiplica por 4.</li>
        <li><b>Esfuerzo.</b> De pie, <b>30 flexiones y extensiones profundas de piernas en 45 segundos</b>, siguiendo el metrónomo.</li>
        <li><b>P1 · al finalizar.</b> De inmediato se miden sus ppm.</li>
        <li><b>P2 · un minuto después.</b> Transcurrido un minuto de acabadas las flexiones, se miden otra vez sus ppm.</li></ol>
        <small class="mut">Índice = ((P0 + P1 + P2) − 200) ÷ 10. Pon el volumen del celular y déjalo donde lo veas. Es un examen previo a la actividad deportiva: si la persona tiene algún malestar o una enfermedad que restrinja el esfuerzo, no debe hacer la prueba.</small></div>
      ${yaHecho?`<div class="an-cs">${esc(nomSel)} ya tiene un resultado en esta prueba (índice ${yaHecho.ind.toFixed(1)}). Si la repites, se reemplaza.</div>`:''}
      <div class="btns"><button class="btn cta block" data-act="rfComenzar">Comenzar con el reposo de 5 minutos</button></div>
      <div class="btns"><button class="btn block" data-act="rfSaltarReposo">Ya descansó: ir directo al primer conteo</button></div>
      <div class="btns"><button class="btn block" data-act="rfManual">Ya tengo los pulsos medidos: capturarlos sin cronómetro</button></div>${salir}`;
  } else if(f==='reposo'){
    cuerpo=`${cab('Reposo','Paso 1 de 6')}${reloj('Descansa sentado o acostado','Respira tranquilo. Al terminar empieza la medición de P0 (pulso en reposo).')}
      <div class="btns"><button class="btn block" data-act="rfSaltarReposo">Omitir el reposo</button></div>${salir}`;
  } else if(f==='p1listo'){
    cuerpo=`${cab('Pulso en reposo · P0','Paso 2 de 6')}<div class="rf-card"><div class="rf-i big">Busca el pulso (cuello o muñeca). Al presionar “Iniciar”, toca el círculo en cada latido durante 15 segundos.</div></div>
      <div class="btns"><button class="btn cta block" data-act="rfP1">Iniciar conteo de 15 s</button></div>${salir}`;
  } else if(['p1','p2','p3'].includes(f)){
    const n={p1:'Pulso en reposo · P0',p2:'Pulso al finalizar · P1',p3:'Pulso a 1 minuto · P2'}[f], paso={p1:'Paso 2 de 6',p2:'Paso 4 de 6',p3:'Paso 6 de 6'}[f];
    cuerpo=`${cab(n,paso)}${reloj('Toca en cada latido','Cuenta cada latido que sientas.','pulso')}
      <button class="rf-tap" data-act="rfTap" aria-label="Contar un latido"><span id="rf_taps">${R.taps}</span><small>latidos</small></button>${salir}`;
  } else if(f==='p1cap'){
    cuerpo=`${cab('Pulso en reposo · P0','Confirma el pulso')}<div class="card">${ppm('rf_p1c','Pulsaciones por minuto (ppm) en reposo',R.p0)}<small class="mut">Los 15 segundos contados × 4. Si lo mediste de otra forma, corrígelo aquí.</small></div>
      <div class="rf-card"><div class="rf-i big">Ahora, de pie: <b>30 flexiones y extensiones profundas de piernas en 45 segundos</b>. Al presionar “Listo” hay una cuenta de 3 segundos y empieza el metrónomo.</div></div>
      <div class="btns"><button class="btn cta block" data-act="rfSentListo">Listo: iniciar las flexiones</button></div>${salir}`;
  } else if(f==='prep'){
    cuerpo=`${cab('Prepárate','Flexiones de piernas')}${reloj('Empiezas en','De pie, con los pies al ancho de los hombros.','prep')}${salir}`;
  } else if(f==='sent'){
    cuerpo=`${cab('¡Flexiones!','Paso 3 de 6')}<div class="rf-card sent"><div class="rf-etq">Flexión profunda de piernas</div><div class="rf-rep"><b id="rf_rep">${R.rep||1}</b><span>/ ${RF.REPS}</span></div>
      <div class="rf-t chico" id="rf_t">${Math.ceil(Math.max(0,R.fin-Date.now())/1000)}</div><div class="bar rf-bar"><i id="rf_bar" style="width:0"></i></div>
      <div class="rf-i">Baja con cada sonido y sube en el siguiente. Al terminar, la medición de P1 empieza sola.</div></div>${salir}`;
  } else if(f==='rec'){
    cuerpo=`${cab('Recuperación','Paso 5 de 6')}${reloj('Descansa','Siéntate o acuéstate. Al cumplirse el minuto, la medición de P2 empieza sola.')}${salir}`;
  } else if(f==='cap'){
    cuerpo=`${cab(R.manual?'Captura de pulsos':'Confirma los pulsos',R.manual?esc(R.q.nombre):'Pulsaciones por minuto (ppm)')}<div class="card">
      ${ppm('rf_p0','P0 · ppm en reposo',R.p0)}${ppm('rf_p1','P1 · ppm al finalizar la actividad',R.p1)}${ppm('rf_p2','P2 · ppm después de un minuto de recuperación',R.p2)}
      <small class="mut">${R.manual?'Escribe los pulsos por minuto de la tabla de captura.':'Si el conteo táctil no fue exacto, corrígelo aquí.'}</small></div>
      <div class="btns"><button class="btn cta block" data-act="rfGuardar">Ver y guardar resultado</button></div>${salir}`;
  } else if(f==='fin'){
    const c=rfClasifica(R.ind), q=R.q, fx=rfFlexEval({flex:q.flex,sexo:q.sexo,edad:q.edad});
    cuerpo=`${cab('Resultado','Test de Ruffier-Dickson')}<div class="rf-card fin"><div class="rf-etq">${esc(q.nombre)}</div><div class="rf-ind ${c.c}">${R.ind.toFixed(1)}</div>${pill(`${c.k} · ${c.t}`,c.c)}
      <div class="rf-lpm"><span>P0 <b>${R.p0}</b></span><span>P1 <b>${R.p1}</b></span><span>P2 <b>${R.p2}</b></span><small>pulsaciones por minuto (ppm)</small></div>
      ${(q.talla!=null||q.peso!=null||q.flex!=null)?`<div class="rf-lpm">${q.talla!=null?`<span>Talla <b>${q.talla} cm</b></span>`:''}${q.peso!=null?`<span>Peso <b>${q.peso} kg</b></span>`:''}${q.flex!=null?`<span>Flexibilidad <b>${q.flex} cm</b></span>`:''}</div>`:''}
      ${fx?`<div class="rf-flex ${fx.ok?'ok':'warn'}">Flexibilidad: referencia para su sexo y edad ${fx.ref} cm · ${fx.ok?'en o sobre la referencia':`por debajo de la referencia (${fx.dif} cm)`}</div>`:''}</div>
      <div class="an-nota">Índice = ((P0 + P1 + P2) − 200) ÷ 10. ${rfRef.map(x=>`${x[0]}: ${x[1]}`).join(' · ')}. Metodología deportiva interpreta el resultado.</div>
      <div class="btns"><button class="btn block" data-act="rfOtro" data-id="${esc(R.pid)}">Aplicarla a otra persona</button></div>${salir}`;
  }
  return `<div class="rf">${cuerpo}</div>`;
}

/* =====================================================================
   VISTA DEL METODÓLOGO
   ===================================================================== */
function viewMetodologia(){
  const m=ui.mt;
  const body = m.tab==='eventos' ? vMetEventos() : m.tab==='pruebas' ? vMetPruebas() : m.tab==='reportes' ? vMetReportes() : vMetAforos();
  const titulo = {aforos:'Aforos',eventos:'Eventos',pruebas:'Pruebas físicas',reportes:'Reportes'}[m.tab]||'Aforos';
  return shell({title:'Metodología deportiva',sub:titulo+' · todas las disciplinas',body});
}

Object.assign(actions,{
  mtVista(d){ ui.mt.vista=d.v; render(); },
  mTab(d){ ui.mt.tab=d.tab; ui.mt.aArea=null; ui.mt.eArea=null; ui.mt.pSel=null; ui.mt.nuevo=null; ui.mt.rep=null; render(); top0(); },
  mtCal(){ openMtCal(); },
  mtRapido(d){ const t=todayStr(); if(d.n==='prox') mtSetRango(t,addDays(t,30)); else mtSetRango(d.n==='mes'?t.slice(0,8)+'01':addDays(t,-(+d.n)),t); closeModal(); render(); },
  mtAplicar(){ const a=($('#mtc_desde')||{}).value, b=($('#mtc_hasta')||{}).value; if(!a||!b){ toast('Elige las dos fechas'); return; } mtSetRango(a,b); closeModal(); render(); },
  mtPer(d){ ui.mt.per=d.p; if(d.p==='custom'&&!ui.mt.desde){ ui.mt.desde=addDays(todayStr(),-29); ui.mt.hasta=todayStr(); } render(); },
  mtAforoArea(d){ ui.mt.aArea=d.id; render(); top0(); },
  mtAforoVolver(){ ui.mt.aArea=null; render(); top0(); },
  mtEvArea(d){ ui.mt.eArea=d.id; render(); top0(); },
  mtEvVolver(){ ui.mt.eArea=null; render(); top0(); },
  mtEvento(d){ openEvento(d.id,'',d.aid); },
  /* pruebas (metodólogo) */
  mtNueva(){ ui.mt.nuevo={tipo:'rufier',areas:[],inicio:todayStr(),fin:''}; render(); top0(); },
  mtNuevaCancel(){ ui.mt.nuevo=null; render(); },
  mtNuevaArea(d){ const n=ui.mt.nuevo; mtLeerFechas(); n.areas=n.areas.includes(d.id)?n.areas.filter(x=>x!==d.id):[...n.areas,d.id]; render(); },
  mtNuevaTodas(){ const n=ui.mt.nuevo; mtLeerFechas(); const all=areasList().filter(a=>!esServ(a.id)||profesores(a.id).length).map(a=>a.id); n.areas=n.areas.length===all.length?[]:all; render(); },
  mtNuevaIniciar(){
    const n=ui.mt.nuevo; mtLeerFechas();
    if(!n.areas.length){ toast('Elige al menos una disciplina'); return; }
    if(!n.inicio){ toast('Pon la fecha en que comienza'); return; }
    if(n.fin&&n.fin<n.inicio){ toast('La fecha de término no puede ser anterior al inicio'); return; }
    const id='pr'+uid();
    setPath(`met/pruebas/${id}`,{id,tipo:'rufier',nombre:'Prueba de Rufier',areas:n.areas,inicio:n.inicio,fin:n.fin||'',cerrada:false,creado:Date.now()});
    ui.mt.nuevo=null; ui.mt.pSel=id; render(); top0(); toast('Prueba iniciada: ya aparece en los portales');
  },
  mtPrueba(d){ ui.mt.pSel=d.id; render(); top0(); },
  mtPruebaVolver(){ ui.mt.pSel=null; render(); top0(); },
  mtPruebaFin(d){ if(!confirm('¿Finalizar esta prueba? Dejará de aparecer a los profesores. Los resultados se conservan.')) return; setPath(`met/pruebas/${d.id}/cerrada`,true); render(); toast('Prueba finalizada'); },
  mtPruebaReabrir(d){
    const p=getPrueba(d.id); if(!p) return;
    const t=todayStr(); if(p.fin&&p.fin<t) setPath(`met/pruebas/${d.id}/fin`,'');
    setPath(`met/pruebas/${d.id}/cerrada`,false); render(); toast('Prueba reabierta');
  },
  mtPruebaDel(d){ if(!confirm('¿Eliminar esta aplicación y todos sus resultados?')) return; setPath(`met/rufier/${d.id}`,undefined); setPath(`met/pruebas/${d.id}`,undefined); ui.mt.pSel=null; render(); toast('Prueba eliminada'); },
  /* prueba de Rufier (profesor / director) */
  rfAbrir(d){ rfAbrir(d.id); },
  rfModo(d){ const R=ui.rufier; if(!R) return; rfLeerNombre(); R.modo=d.m; render(); },
  rfAlumno(d){ const R=ui.rufier; if(!R) return; const g=grupos(session.area).find(x=>x.id===R.gid); if(!g) return; R.alumno=rosterOf(g)[+d.i]||''; const ed=edadesOf(g)[R.alumno]; R.edad=ed==null?'':String(ed); render(); },
  rfSalir(){ rfSalir(); },
  rfComenzar(){ rfLeerNombre(); if(!rfFijaQuien()) return; rfBeep(660,60); rfIrReposo(); },
  rfSaltarReposo(){ rfLeerNombre(); if(!rfFijaQuien()) return; rfBeep(660,60); rfPantalla(true); clearInterval(rfTimer); rfTimer=null; rfIrP1Listo(); },
  rfP1(){ rfBeep(660,60); rfIrP1(); },
  rfTap(){ const R=ui.rufier; if(!R||!R.fin) return; R.taps++; const e=$('#rf_taps'); if(e) e.textContent=R.taps; try{ if(navigator.vibrate) navigator.vibrate(15); }catch(e){} },
  rfSentListo(){ const R=ui.rufier, v=Math.round(+($('#rf_p1c')||{}).value); if(v>=30&&v<=240) R.p0=v; rfBeep(660,60); rfIrPrep(); },
  rfManual(){ rfLeerNombre(); if(!rfFijaQuien()) return; const R=ui.rufier; R.manual=true; R.p0=R.p1=R.p2=null; R.fase='cap'; render(); top0(); },
  rfGuardar(){ rfGuardar(); },
  rfOtro(d){ rfAbrir(d.id); }
});
function mtLeerFechas(){ const n=ui.mt.nuevo; if(!n) return; const a=$('#mn_ini'), b=$('#mn_fin'); if(a) n.inicio=a.value; if(b) n.fin=b.value; }
function rfLeerNombre(){ const R=ui.rufier; if(!R) return; [['rf_nombre','nombre'],['rf_edad','edad'],['rf_talla','talla'],['rf_peso','peso'],['rf_flex','flex'],['rf_sexo','sexo']].forEach(([id,k])=>{ const e=$('#'+id); if(e) R[k]=e.value; }); }
document.addEventListener('input',e=>{ if(!ui.rufier) return; const m={rf_nombre:'nombre',rf_edad:'edad',rf_talla:'talla',rf_peso:'peso',rf_flex:'flex'}[e.target.id]; if(m) ui.rufier[m]=e.target.value; });
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.id==='mt_desde'||t.id==='mt_hasta'){ ui.mt.per='custom'; ui.mt.desde=($('#mt_desde')||{}).value; ui.mt.hasta=($('#mt_hasta')||{}).value; render(); }
  if(t.id==='rf_sexo'&&ui.rufier){ ui.rufier.sexo=t.value; }
  if(t.id==='rf_grupo'&&ui.rufier){ ui.rufier.gid=t.value; ui.rufier.alumno=''; render(); }
});


/* =====================================================================
   REPORTES PARA IMPRIMIR (con membrete de Campestre, vía imprimirDoc)
   · Pruebas: reporte de interpretación, por disciplina o en conjunto.
   · Eventos: ficha de cada evento y reporte por área o en conjunto.
   Cada reporte trae sus PARÁMETROS DE INTERPRETACIÓN. Los rangos de los
   eventos son una propuesta de trabajo: se ajustan aquí (EV_CAL / EV_COSTO).
   ===================================================================== */
const mtProm = a => a.length ? a.reduce((s,x)=>s+x,0)/a.length : null;
const mtR1 = x => x==null ? null : Math.round(x*10)/10;
const RF_CATS = ['Excelente','Muy buena','Buena','Regular','Mala'];
const RF_CAT_CLS = {Excelente:'ok','Muy buena':'ok',Buena:'info',Regular:'warn',Mala:'bad'};
const RF_LETRA = {Excelente:'E','Muy buena':'MB',Buena:'B',Regular:'R',Mala:'M'};
const EDAD_GR = [['Menos de 12',0,11],['12 a 17',12,17],['18 a 35',18,35],['36 a 50',36,50],['Más de 50',51,200]];
const RF_PARAMS = [
  ['0 o menos','Excelente','Rendimiento cardiovascular excelente (nivel de atleta).','Mantener el plan y reevaluar en 3 meses.'],
  ['0.1 a 5','Muy buena','Muy buena adaptación al esfuerzo.','Seguir con el entrenamiento y progresar la intensidad con cuidado.'],
  ['5.1 a 10','Buena','Condición física buena o aceptable.','Trabajo aeróbico progresivo; reevaluar en 6 a 8 semanas.'],
  ['10.1 a 15','Regular','Capacidad cardiovascular insuficiente o baja.','Plan de acondicionamiento gradual y seguimiento más cercano.'],
  ['Más de 15','Mala','Estado físico malo; se sugiere consultar.','Evitar cargas intensas hasta una valoración médica.']
];
function mtBarras(rows){                          // rows: [{label,sub,val,txt,cls,max}]
  const max=Math.max(1,...rows.map(x=>x.val||0));
  return `<div class="an-bars">${rows.map(x=>`<div class="an-br"><div class="an-bl"><b>${esc(x.label)}</b>${x.sub?`<small>${esc(x.sub)}</small>`:''}</div>
    <div class="bar"><i class="${x.cls||'br'}" style="width:${x.val==null?0:Math.min(100,x.val/(x.max||max)*100)}%"></i></div>
    <div class="an-bv ${x.cls||''}">${esc(x.txt!=null?x.txt:x.val)}</div></div>`).join('')}</div>`;
}
const mtTabla = (cols,filas,o) => `<table class="doc-tabla"><thead><tr>${cols.map(c=>`<th${c.n?' class="n"':''}>${esc(c.t)}</th>`).join('')}</tr></thead><tbody>${filas.map(f=>`<tr${f.tot?' class="tot"':''}>${f.c.map((v,i)=>`<td${cols[i].n?' class="n"':''}>${v}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const mtLect = items => `<div class="card"><ul class="mt-lect">${items.map(x=>`<li>${x}</li>`).join('')}</ul></div>`;

/* ----- Prueba de Rufier: reporte de interpretación ----- */
const ordenRes = res => res.slice().sort((a,b)=>String(a.aid).localeCompare(String(b.aid))||a.nombre.localeCompare(b.nombre,'es'));
function rfReporteHTML(pid,aid){
  const p=getPrueba(pid); if(!p) return '<div class="empty">No se encontró la prueba.</div>';
  const todo=aid&&aid!=='all'?aid:null, res=rfLista(pid,todo), n=res.length;
  const params=`<div class="h2">Parámetros para interpretar</div>
    ${mtTabla([{t:'Índice'},{t:'Categoría'},{t:'Qué significa'},{t:'Qué hacer'}],RF_PARAMS.map(x=>({c:[`<b>${x[0]}</b>`,pill(x[1],RF_CAT_CLS[x[1]]),esc(x[2]),esc(x[3])]})))}
    <div class="h2">Cómo se califica (0 a 10)</div>
    ${mtTabla([{t:'Puntos',n:1},{t:'Nivel'},{t:'IMC'},{t:'Flexibilidad (% de la referencia)'},{t:'Ruffier'}],RF_CALIF_TABLA.map(x=>({c:[`<b>${x[0]}</b>`,pill(x[1],RF_PTS_NIVEL[x[0]][1]),esc(x[2]),esc(x[3]),esc(x[4])]})))}
    <p class="mt-p">${esc(RF_CALIF_NOTA)}</p>
    <div class="h2">Ponderación del índice de masa corporal (IMC)</div>
    ${mtTabla([{t:'IMC'},{t:'Evaluación'}],RF_IMC.slice().reverse().map(x=>({c:[`<b>${x.r}</b>`,pill(x.t,x.c)]})))}
    <div class="h2">Flexibilidad: referencia en cm por edad</div>
    ${mtTabla([{t:'Edad (años)'},...RF_FLEX_EDADES.map(e=>({t:String(e),n:1}))],[{c:['<b>Varones</b>',...RF_FLEX.M]},{c:['<b>Mujeres</b>',...RF_FLEX.F]}])}
    <div class="card"><b>Cómo se calcula</b><p class="mt-p">Índice de Ruffier-Dickson = ((P0 + P1 + P2) − 200) ÷ 10. P0 son las pulsaciones por minuto (ppm) en reposo, P1 las ppm al finalizar 30 flexiones y extensiones profundas de piernas en 45 segundos y P2 las ppm transcurrido un minuto de acabadas las flexiones. Entre más bajo el índice, mejor la condición. Claves de la tabla de captura: E excelente · MB muy buena · B buena · R regular · M mala.</p>
      <b>Para leerlo bien</b><ul class="mt-lect"><li>Es una prueba de tamizaje de la resistencia cardiovascular: orienta, no diagnostica.</li>
      <li>Los rangos son de referencia para adultos. En niños y adolescentes conviene comparar contra su propio grupo y contra su resultado anterior.</li>
      <li>Lo más útil es repetir la prueba en las mismas condiciones y comparar a la misma persona con el tiempo.</li>
      <li>Un pulso en reposo (P0) arriba de 100 ppm se marca para revisión (criterio adicional del sistema).</li>
      <li>IMC = peso (kg) ÷ talla (m)². Es un indicador general: no distingue músculo de grasa, así que en deportistas con mucha masa muscular puede salir alto.</li>
      <li>Evaluación final: junta IMC, flexibilidad y Ruffier de cada persona y señala hacia dónde trabajar su condición física.</li>
      <li>Flexibilidad: se compara con la referencia en cm por sexo y edad de la tabla de captura (varones de 10 cm a los 10 años hasta 34 cm a los 90; mujeres de 14 a 37 cm).</li></ul>
      <p class="mt-p" style="font-size:10.5px">Fuente: Manual de consulta del profesor deportivo, Club Campestre Ags. Mtro. Alido Rigal Borroto, Lic. Yandi Rafael Morales Montiel (segunda edición 2023), págs. 8 y 9.</p></div>`;
  if(!n) return `<div class="empty">Todavía no hay personas evaluadas${todo?' en '+esc((getArea(todo)||{}).nombre):''} en esta prueba.</div>${params}`;
  const prom=mtProm(res.map(r=>r.ind)), cat=rfClasifica(prom), conteo=RF_CATS.map(c=>({c,n:res.filter(r=>rfClasifica(r.ind).t===c).length}));
  const buenos=conteo[0].n+conteo[1].n+conteo[2].n, reg=conteo[3].n, atn=conteo[4].n, pc=x=>Math.round(x/n*100);
  const areas=(p.areas||[]).filter(a=>!todo||a===todo).map(a=>({a,r:res.filter(x=>x.aid===a)})).filter(x=>x.r.length);
  const conEdad=res.filter(r=>r.edad>0), grEdad=EDAD_GR.map(([l,a,b])=>({l,r:conEdad.filter(x=>x.edad>=a&&x.edad<=b)})).filter(x=>x.r.length);
  const alertas=res.filter(r=>r.ind>15||r.p0>100).sort((a,b)=>b.ind-a.ind);
  const conFlex=res.map(r=>({r,f:rfFlexEval(r)})).filter(x=>x.f), flexOk=conFlex.filter(x=>x.f.ok).length;
  const lect=[`De <b>${plu(n,'persona evaluada','personas evaluadas')}</b>, el índice promedio es <b>${mtR1(prom).toFixed(1)}</b> (${esc(cat.t.toLowerCase())}).`,
    `<b>${pc(buenos)}%</b> tiene condición buena o mejor (E, MB o B), <b>${pc(reg)}%</b> regular (R) y <b>${pc(atn)}%</b> mala (M)${atn?': se sugiere consultar':''}.`];
  if(conFlex.length) lect.push(`Flexibilidad: <b>${Math.round(flexOk/conFlex.length*100)}%</b> de las ${conFlex.length} personas medidas está en o sobre la referencia para su sexo y edad.`);
  const conImc=res.map(r=>rfImc(r.peso,r.talla)).filter(Boolean);
  if(conImc.length){ const sp=conImc.filter(i=>['SP','OL','OM2','OM'].includes(i.k)).length, pb=conImc.filter(i=>i.k==='PB').length, nr=conImc.filter(i=>i.k==='N').length;
    lect.push(`IMC (${plu(conImc.length,'persona medida','personas medidas')}): promedio <b>${mtR1(mtProm(conImc.map(i=>i.v))).toFixed(1)}</b>; <b>${Math.round(nr/conImc.length*100)}%</b> en peso normal, <b>${Math.round(sp/conImc.length*100)}%</b> con sobrepeso u obesidad${pb?` y <b>${Math.round(pb/conImc.length*100)}%</b> con peso bajo`:''}.`); }
  const finales=res.map(r=>rfFinal(r)), nAt=finales.filter(f=>f.nc==='bad').length, nFav=finales.filter(f=>f.nc==='ok').length;
  const cuenta={}; finales.forEach(f=>f.cortos.filter(k=>!/mantener/.test(k)).forEach(kk=>{ cuenta[kk]=(cuenta[kk]||0)+1; }));
  const prio=Object.entries(cuenta).sort((a,b)=>b[1]-a[1]).filter(x=>x[1]>0);
  if(prio.length) lect.push(`Hacia dónde trabajar: lo que más se repite es <b>${esc(prio[0][0].toLowerCase())}</b> (${plu(prio[0][1],'persona','personas')})${prio[1]?`, seguido de <b>${esc(prio[1][0].toLowerCase())}</b> (${prio[1][1]})`:''}${prio[2]?` y <b>${esc(prio[2][0].toLowerCase())}</b> (${prio[2][1]})`:''}. Calificación promedio: <b>${mtR1(mtProm(finales.map(f=>f.cal.v))).toFixed(1)} de 10</b> (${esc(RF_NIV_FINAL.find(x=>mtProm(finales.map(f=>f.cal.v))>=x[0])[1].toLowerCase())})${nAt?`; requieren atención: <b>${nAt}</b>`:''}.`);
  if(areas.length>1){ const o=areas.map(x=>({n:(getArea(x.a)||{}).nombre,v:mtProm(x.r.map(y=>y.ind))})).sort((a,b)=>a.v-b.v); lect.push(`Mejor promedio: <b>${esc(o[0].n)}</b> (${mtR1(o[0].v).toFixed(1)}). Más alto, con mayor margen de mejora: <b>${esc(o[o.length-1].n)}</b> (${mtR1(o[o.length-1].v).toFixed(1)}).`); }
  if(grEdad.length>1){ const o=grEdad.map(x=>({l:x.l,v:mtProm(x.r.map(y=>y.ind))})).sort((a,b)=>a.v-b.v); lect.push(`Por edad, el grupo con mejor respuesta es <b>${esc(o[0].l)} años</b> (${mtR1(o[0].v).toFixed(1)}) y el de menor, <b>${esc(o[o.length-1].l)} años</b> (${mtR1(o[o.length-1].v).toFixed(1)}).`); }
  if(alertas.length) lect.push(`<b>${plu(alertas.length,'persona para revisar','personas para revisar')}</b>: índice mayor a 15 (clave M) o pulso en reposo arriba de 100 ppm (ver la lista más abajo).`);
  const nSinEdad=n-conEdad.length; if(nSinEdad) lect.push(`${plu(nSinEdad,'persona no tiene','personas no tienen')} edad registrada; no entran en la gráfica por edad.`);
  return `<div class="kpis an-kpis">${kpi('Personas evaluadas',n,esc(todo?(getArea(todo)||{}).nombre:plu(areas.length,'disciplina','disciplinas')),{color:'var(--b2)'})}${kpi('Índice promedio',mtR1(prom).toFixed(1),esc(cat.t),{cls:cat.c,color:'var(--b3)'})}${kpi('Buena o mejor',pc(buenos)+'%',`${buenos} de ${n}`,{cls:pc(buenos)>=50?'ok':'warn',color:'var(--b1)'})}</div>
    <div class="h2">Lectura de los resultados</div>${mtLect(lect)}
    <div class="h2">Personas por categoría</div>
    <div class="card">${mtBarras(conteo.map(x=>({label:x.c,sub:'',val:x.n,txt:`${x.n} · ${pc(x.n)}%`,cls:RF_CAT_CLS[x.c],max:n})))}</div>
    ${conImc.length?`<div class="h2">Personas por categoría de IMC</div><div class="card">${mtBarras(RF_IMC.slice().reverse().map(x=>{ const k=conImc.filter(i=>i.k===x.k).length; return {label:x.t,sub:x.r,val:k,txt:`${k} · ${Math.round(k/conImc.length*100)}%`,cls:x.c,max:conImc.length}; }))}</div>`:''}
    ${areas.length>1?`<div class="h2">Índice promedio por disciplina</div><div class="card">${mtBarras(areas.map(x=>{ const v=mtProm(x.r.map(y=>y.ind)); return {label:(getArea(x.a)||{}).nombre,sub:plu(x.r.length,'persona','personas'),val:Math.max(0,v),max:20,txt:mtR1(v).toFixed(1),cls:rfClasifica(v).c}; }))}<div class="an-cs" style="margin-top:6px">Entre más corta la barra, mejor la condición (0 o menos es lo ideal).</div></div>`:''}
    ${grEdad.length?`<div class="h2">Índice promedio por edad</div><div class="card">${mtBarras(grEdad.map(x=>{ const v=mtProm(x.r.map(y=>y.ind)); return {label:x.l+' años',sub:plu(x.r.length,'persona','personas'),val:Math.max(0,v),max:20,txt:mtR1(v).toFixed(1),cls:rfClasifica(v).c}; }))}</div>`:''}
    <div class="h2">Pulso promedio en cada etapa</div>
    <div class="card">${mtBarras([['En reposo (P0)',res.map(r=>r.p0)],['Al finalizar la actividad (P1)',res.map(r=>r.p1)],['Un minuto después (P2)',res.map(r=>r.p2)]].map(([l,a])=>({label:l,val:mtProm(a),max:200,txt:Math.round(mtProm(a))+' ppm',cls:'br'})))}</div>
    ${alertas.length?`<div class="h2">Para revisión</div>${mtTabla([{t:'Persona'},{t:'Disciplina'},{t:'Índice',n:1},{t:'P0 en reposo',n:1},{t:'Motivo'}],alertas.map(r=>({c:[esc(r.nombre),esc((getArea(r.aid)||{}).nombre||''),r.ind.toFixed(1),r.p0,esc([r.ind>15?'Índice mayor a 15 (M)':'',r.p0>100?'Pulso en reposo alto':''].filter(Boolean).join(' · '))]})))}`:''}
    ${params}
    <div class="h2">Detalle de las personas evaluadas</div>
    ${mtTabla([{t:'Persona'},{t:'Disciplina / grupo'},{t:'Sexo'},{t:'Edad',n:1},{t:'Talla',n:1},{t:'Peso',n:1},{t:'IMC',n:1},{t:'Eval. IMC'},{t:'Flex. (cm)',n:1},{t:'Eval. flex.'},{t:'P0',n:1},{t:'P1',n:1},{t:'P2',n:1},{t:'Índice',n:1},{t:'Eval.'},{t:'Calif.',n:1}],
      ordenRes(res).map(r=>{ const fx=rfFlexEval(r), c=rfClasifica(r.ind), im=rfImc(r.peso,r.talla);
        return {c:[esc(r.nombre),esc([(getArea(r.aid)||{}).nombre,r.grupo].filter(Boolean).join(' · ')),r.sexo||'—',r.edad||'—',r.talla==null?'—':r.talla,r.peso==null?'—':r.peso,im?im.v.toFixed(1):'—',im?pill(im.t,im.c):'—',r.flex==null?'—':r.flex,fx?pill(fx.ok?'Cumple':`−${Math.abs(fx.dif)} cm`,fx.ok?'ok':'warn'):'—',r.p0,r.p1,r.p2,`<b>${r.ind.toFixed(1)}</b>`,pill(c.k,c.c),`<b>${rfCalif(r).v.toFixed(1)}</b>`]}; }))}
    <div class="h2">Evaluación final: hacia dónde trabajar</div>
    ${mtTabla([{t:'Persona'},{t:'Disciplina'},{t:'IMC',n:1},{t:'Flex.',n:1},{t:'Ruffier',n:1},{t:'Calificación'},{t:'Interpretación y recomendación'}],
      ordenRes(res).map(r=>{ const f=rfFinal(r), k=f.cal; return {c:[esc(r.nombre),esc((getArea(r.aid)||{}).nombre||''),k.pi==null?'—':k.pi,k.pf==null?'—':k.pf,k.pr,pill(`${k.v.toFixed(1)} · ${k.t}${k.parcial?' (parcial)':''}`,k.c),esc(f.txt)]}; }))}
    <p class="mt-p" style="font-size:10px">Puntos por prueba: 10 excelente · 8 muy buena · 7 buena · 6 regular · 5 deficiente. Calificación = promedio de las tres pruebas (parcial si falta alguna).</p>
    <p class="mt-p" style="font-size:10px">P0, P1 y P2 en pulsaciones por minuto (ppm). Flexibilidad: «Cumple» si está en o sobre la referencia para su sexo y edad; si no, cuántos cm le faltan. IMC = peso ÷ talla². Aplicación del ${esc(fmtCorta(p.inicio||todayStr()))}${p.fin?' al '+esc(fmtCorta(p.fin)):''}.</p>
    <div class="doc-firmas"><div>Metodología deportiva</div><div>Gerencia deportiva</div></div>`;
}
function vMetReporte(){
  const R=ui.mt.rep, ps=pruebasAll(), p=getPrueba(R.pid)||ps[0]; if(!p){ ui.mt.rep=null; return vMetPruebas(); }
  R.pid=p.id;
  const areasP=(p.areas||[]).map(a=>getArea(a)).filter(Boolean);
  if(R.area!=='all'&&!areasP.some(a=>a.id===R.area)) R.area='all';
  return `<div class="mt-back"><button class="btn sm" data-act="mtRepVolver">${ic('back')} Regresar</button></div>
    <div class="h2">Reporte de interpretación</div>
    <div class="an-f no-print"><div class="an-row">
      <label class="f"><span>Aplicación</span><select id="mr_prueba">${ps.map(x=>`<option value="${esc(x.id)}"${x.id===p.id?' selected':''}>${esc(x.nombre||'Prueba de Rufier')} · ${esc(fmtCorta(x.inicio||todayStr()))}${x.fin?' al '+esc(fmtCorta(x.fin)):''}</option>`).join('')}</select></label>
      <label class="f"><span>Disciplina</span><select id="mr_area"><option value="all"${R.area==='all'?' selected':''}>Todas (en conjunto)</option>${areasP.map(a=>`<option value="${esc(a.id)}"${R.area===a.id?' selected':''}>${esc(a.nombre)}</option>`).join('')}</select></label>
    </div><div class="btns"><button class="btn primary" data-act="mtRepPrint">${ic('doc')} Imprimir interpretación</button></div>
      <div class="btns"><button class="btn" data-act="mtRepTabla" data-b="0">Tabla de captura con resultados</button><button class="btn" data-act="mtRepTabla" data-b="1">Tabla de captura en blanco</button></div>
      <div class="btns"><button class="btn primary" data-act="mtRepXlsx">${ic('doc')} Exportar a Excel</button></div>
      <div class="btns"><button class="btn" data-act="mtRepInfo">Hoja informativa del test</button></div></div>
    <div class="rep-pantalla">${rfReporteHTML(p.id,R.area)}</div>`;
}

/* ----- Eventos: ficha y reporte ----- */
const EV_CAL = [[4.5,'Excelente','ok'],[4,'Buena','ok'],[3,'Regular','warn'],[0.1,'Deficiente','bad']];       // calificación sobre 5
const evCal = c => { c=+c||0; if(!c) return null; const x=EV_CAL.find(r=>c>=r[0]); return x?{t:x[1],c:x[2]}:{t:'Deficiente',c:'bad'}; };
const evCosto = (pres,costo) => { pres=+pres||0; costo=+costo||0; if(!pres||!costo) return null; const p=Math.round(costo/pres*100); return p<=100?{p,t:'Dentro del presupuesto',c:'ok'}:p<=110?{p,t:'Exceso moderado',c:'warn'}:{p,t:'Excedido',c:'bad'}; };
const EV_PARAMS = [
  ['Calificación del evento (sobre 5)','4.5 o más: excelente · 4.0 a 4.4: buena · 3.0 a 3.9: regular · menos de 3: deficiente'],
  ['Costo real contra presupuesto','100% o menos: dentro del presupuesto · 101% a 110%: exceso moderado · más de 110%: excedido'],
  ['Costo por participante','Costo real ÷ participantes. Sirve para comparar eventos parecidos entre sí; no tiene un valor bueno o malo por sí solo'],
  ['Cumplimiento de eventos','Eventos realizados ÷ (realizados + cancelados + pospuestos). Los planificados a futuro no cuentan']
];
const evParamsHTML = () => `<div class="h2">Parámetros para interpretar</div>${mtTabla([{t:'Indicador'},{t:'Cómo se interpreta'}],EV_PARAMS.map(x=>({c:[`<b>${esc(x[0])}</b>`,esc(x[1])]})))}
  <p class="mt-p" style="font-size:10px">Rangos de referencia de trabajo; se pueden ajustar con Metodología deportiva.</p>`;

function evFichaHTML(aid,e){
  const a=getArea(aid)||{nombre:''}, cal=evCal(e.calificacion), co=evCosto(e.presupuesto,e.costoReal), pp=(+e.participantes>0&&+e.costoReal>0)?Math.round(e.costoReal/e.participantes):null;
  const lect=[];
  if(co) lect.push(`El costo real fue <b>${co.p}%</b> del presupuesto: <b>${esc(co.t.toLowerCase())}</b>.`);
  if(cal) lect.push(`La calificación del evento fue <b>${(+e.calificacion).toFixed(1)} de 5</b>: <b>${esc(cal.t.toLowerCase())}</b>.`);
  if(pp) lect.push(`Costo por participante: <b>${mxn(pp)}</b>.`);
  if(!lect.length) lect.push('Este evento todavía no tiene presupuesto, costo real o calificación capturados.');
  return `${mtTabla([{t:'Dato'},{t:'Detalle'}],[
      {c:['<b>Evento</b>',esc(e.nombre)]},{c:['<b>Área</b>',esc(a.nombre)]},{c:['<b>Fecha y hora</b>',esc(fmtLarga(e.fecha))+(e.hora?' · '+esc(e.hora):'')]},
      {c:['<b>Lugar</b>',esc(e.lugar||'—')]},{c:['<b>Tipo</b>',esc([e.tipo,e.categoria].filter(Boolean).join(' · ')||'—')]},{c:['<b>Estado</b>',esc(e.estado||'planificado')]},
      {c:['<b>Participantes</b>',e.participantes?metNum(e.participantes):'—']},
      {c:['<b>Presupuesto</b>',e.presupuesto?mxn(e.presupuesto):'—']},{c:['<b>Costo real</b>',e.costoReal?mxn(e.costoReal):'—']},
      {c:['<b>Calificación</b>',cal?`${(+e.calificacion).toFixed(1)} / 5 · ${esc(cal.t)}`:'—']}])}
    <div class="h2">Lectura del evento</div>${mtLect(lect)}
    ${String(e.notas||'').trim()?`<div class="h2">Notas y resultados</div><div class="card"><p class="mt-p" style="white-space:pre-wrap">${esc(e.notas)}</p></div>`:''}
    ${evParamsHTML()}
    <div class="doc-firmas"><div>Dirección del área</div><div>Metodología deportiva</div></div>`;
}
function evReporteHTML(aids,desde,hasta){
  const all=[]; aids.forEach(aid=>mtEventos(aid,{desde,hasta}).forEach(e=>all.push({aid,e})));
  all.sort((a,b)=>a.e.fecha.localeCompare(b.e.fecha));
  if(!all.length) return `<div class="empty">No hay eventos en el período elegido.</div>${evParamsHTML()}`;
  const n=all.length, est=k=>all.filter(x=>(x.e.estado||'planificado')===k).length, real=all.filter(x=>x.e.estado==='realizado');
  const part=real.reduce((s,x)=>s+(+x.e.participantes||0),0), conP=real.filter(x=>+x.e.presupuesto>0&&+x.e.costoReal>0);
  const pres=conP.reduce((s,x)=>s+(+x.e.presupuesto),0), cost=conP.reduce((s,x)=>s+(+x.e.costoReal),0), co=evCosto(pres,cost);
  const cals=real.map(x=>+x.e.calificacion).filter(v=>v>0), cp=cals.length?mtProm(cals):null, calC=cp?evCal(cp):null;
  const cerr=est('realizado')+est('cancelado')+est('pospuesto'), cumpl=cerr?Math.round(est('realizado')/cerr*100):null;
  const porArea=aids.map(aid=>({a:getArea(aid),x:all.filter(y=>y.aid===aid)})).filter(z=>z.a&&z.x.length).sort((p,q)=>q.x.length-p.x.length);
  const lect=[`En el período hay <b>${plu(n,'evento','eventos')}</b> en ${plu(porArea.length,'área','áreas')}: ${est('realizado')} realizados, ${est('planificado')} por realizar${est('cancelado')?`, ${est('cancelado')} cancelados`:''}${est('pospuesto')?` y ${est('pospuesto')} pospuestos`:''}.`];
  if(cumpl!=null) lect.push(`Cumplimiento de eventos: <b>${cumpl}%</b> de los que ya debían suceder se realizaron.`);
  if(real.length) lect.push(`Los eventos realizados reunieron a <b>${metNum(part)}</b> participantes.`);
  if(co) lect.push(`El costo real fue <b>${co.p}%</b> del presupuesto (${mxn(cost)} contra ${mxn(pres)}): <b>${esc(co.t.toLowerCase())}</b>.`);
  if(calC) lect.push(`Calificación promedio de los eventos realizados: <b>${cp.toFixed(1)} de 5</b> (${esc(calC.t.toLowerCase())}).`);
  const infs=all.map(x=>({x,I:getInforme(x.aid,x.e.id)})).filter(y=>y.I).map(y=>({...y,T:infTot(y.I)}));
  const iS=infs.reduce((s,y)=>({cm:s.cm+y.T.cm,cf:s.cf+y.T.cf,fm:s.fm+y.T.fm,ff:s.ff+y.T.ff,tot:s.tot+y.T.tot}),{cm:0,cf:0,fm:0,ff:0,tot:0});
  if(infs.length) lect.push(`Según los informes de las direcciones (${plu(infs.length,'evento','eventos')}), participaron <b>${metNum(iS.tot)}</b> personas: ${metNum(iS.cm+iS.cf)} del club y ${metNum(iS.fm+iS.ff)} foráneas; ${metNum(iS.cf+iS.ff)} mujeres y ${metNum(iS.cm+iS.fm)} hombres.`);
  const sinInf=all.filter(x=>evTerminado(x.e)&&!getInforme(x.aid,x.e.id)).length;
  if(sinInf) lect.push(`<b>${plu(sinInf,'evento terminado sin informe','eventos terminados sin informe')}</b> de la dirección.`);
  const top=porArea[0]; if(porArea.length>1) lect.push(`El área con más eventos es <b>${esc(top.a.nombre)}</b> (${top.x.length}).`);
  return `<div class="kpis an-kpis">${kpi('Eventos',n,`${est('realizado')} realizados`,{color:'var(--b3)'})}${kpi('Participantes',metNum(part),'en eventos realizados',{color:'var(--b2)'})}${kpi('Calificación',cp?cp.toFixed(1)+' / 5':'—',calC?calC.t:'sin calificaciones',{cls:calC?calC.c:'',color:'var(--b1)'})}</div>
    ${pres?`<div class="kpis an-kpis" style="margin-top:8px">${kpi('Presupuesto',mxn(pres),'eventos realizados',{color:'var(--b2)'})}${kpi('Costo real',mxn(cost),'eventos realizados',{color:'var(--warn)'})}${kpi('Contra presupuesto',co.p+'%',co.t,{cls:co.c,color:'var(--b3)'})}</div>`:''}
    <div class="h2">Lectura de los resultados</div>${mtLect(lect)}
    <div class="h2">Eventos por estado</div><div class="card">${mtBarras([['Realizados','realizado','ok'],['Por realizar','planificado','info'],['Pospuestos','pospuesto','warn'],['Cancelados','cancelado','bad']].map(([l,k,c])=>({label:l,val:est(k),txt:`${est(k)} · ${Math.round(est(k)/n*100)}%`,cls:c,max:n})))}</div>
    ${porArea.length>1?`<div class="h2">Eventos por área</div><div class="card">${mtBarras(porArea.map(z=>({label:z.a.nombre,sub:`${z.x.filter(y=>y.e.estado==='realizado').length} realizados`,val:z.x.length,txt:String(z.x.length),cls:'br'})))}</div>
      <div class="h2">Participantes por área (eventos realizados)</div><div class="card">${mtBarras(porArea.map(z=>({label:z.a.nombre,val:z.x.filter(y=>y.e.estado==='realizado').reduce((s,y)=>s+(+y.e.participantes||0),0),cls:'br'})).filter(r=>r.val>0))||''}</div>`:''}
    ${infs.length?`<div class="h2">Participantes según los informes de las direcciones</div>${mtTabla([{t:'Evento'},{t:'Área'},{t:'Club M',n:1},{t:'Club F',n:1},{t:'Foráneos M',n:1},{t:'Foráneos F',n:1},{t:'Total',n:1}],[...infs.map(y=>({c:[esc(y.x.e.nombre),esc((getArea(y.x.aid)||{}).nombre||''),y.T.cm,y.T.cf,y.T.fm,y.T.ff,`<b>${y.T.tot}</b>`]})),{tot:1,c:['Total','',iS.cm,iS.cf,iS.fm,iS.ff,iS.tot]}])}`:''}
    ${conP.length?`<div class="h2">Costo contra presupuesto por evento</div><div class="card">${mtBarras(conP.map(x=>{ const c=evCosto(x.e.presupuesto,x.e.costoReal); return {label:x.e.nombre,sub:(getArea(x.aid)||{}).nombre,val:c.p,max:Math.max(130,...conP.map(y=>evCosto(y.e.presupuesto,y.e.costoReal).p)),txt:c.p+'%',cls:c.c}; }))}<div class="an-cs" style="margin-top:6px">100% es gastar justo lo presupuestado.</div></div>`:''}
    ${evParamsHTML()}
    <div class="h2">Detalle de los eventos</div>
    ${mtTabla([{t:'Fecha'},{t:'Área'},{t:'Evento'},{t:'Estado'},{t:'Part.',n:1},{t:'Presupuesto',n:1},{t:'Costo real',n:1},{t:'Calif.',n:1}],all.map(x=>({c:[esc(fmtCorta(x.e.fecha)),esc((getArea(x.aid)||{}).nombre||''),esc(x.e.nombre),esc(x.e.estado||'planificado'),x.e.participantes||'—',x.e.presupuesto?mxn(x.e.presupuesto):'—',x.e.costoReal?mxn(x.e.costoReal):'—',+x.e.calificacion?(+x.e.calificacion).toFixed(1):'—']})))}
    <div class="doc-firmas"><div>Metodología deportiva</div><div>Gerencia deportiva</div></div>`;
}

Object.assign(actions,{
  mtRep(d){ ui.mt.rep={pid:d.id,area:'all'}; render(); top0(); },
  mtRepVolver(){ ui.mt.rep=null; render(); top0(); },
  mtRepPrint(){
    const R=ui.mt.rep, p=getPrueba(R&&R.pid); if(!p) return;
    imprimirDoc({titulo:'Interpretación · '+(p.nombre||'Prueba de Rufier'),sub:`${R.area==='all'?'Todas las disciplinas':(getArea(R.area)||{}).nombre} · aplicación del ${fmtCorta(p.inicio||todayStr())}${p.fin?' al '+fmtCorta(p.fin):''}`,html:rfReporteHTML(p.id,R.area)});
  },
  mtEvReporte(d){
    const r=mtRango(), aids=d.aid==='all'?areasList().map(a=>a.id):[d.aid];
    imprimirDoc({titulo:'Reporte de eventos'+(d.aid==='all'?'':' · '+(getArea(d.aid)||{}).nombre),sub:`${d.aid==='all'?'Todas las áreas':(getArea(d.aid)||{}).nombre} · ${mtPerTxt(r)}`,html:evReporteHTML(aids,r.desde,r.hasta)});
  },
  mtEvPrint(d){
    const e=getPath(`data/${d.aid}/eventos/${d.id}`); if(!e) return;
    closeModal();
    imprimirDoc({titulo:'Ficha del evento · '+e.nombre,sub:`${(getArea(d.aid)||{}).nombre} · ${fmtLarga(e.fecha)}`,html:evFichaHTML(d.aid,e)});
  }
});
document.addEventListener('change',e=>{
  const t=e.target; if(!ui.mt||!ui.mt.rep) return;
  if(t.id==='mr_prueba'){ ui.mt.rep.pid=t.value; ui.mt.rep.area='all'; render(); }
  if(t.id==='mr_area'){ ui.mt.rep.area=t.value; render(); }
});


/* =====================================================================
   INFORME DE EVENTO REALIZADO (para Metodología)
   La dirección de cada área lo captura cuando el evento ya terminó; el
   evento en sí (agenda y organización) sigue siendo de Gerencia. El informe
   es SOLO de Metodología: Gerencia nunca lo ve. Se guarda aparte del evento
   (met/informes/<área>__<evento>) para que también sirva con los eventos
   que llegan de Fitness Control, que son de solo lectura.
   Formato del papel: deporte, evento, lugar, fecha, inicio y final;
   desglose de participantes del club y foráneos (M, F, T); impacto social;
   total general; resultados (nombre, sexo, categoría, modalidad, lugar) y
   observaciones.
   ===================================================================== */
const INF_FIRMA = {nombre:'MTRO. ALIDO RIGAL BORROTO', cargo:'Área técnica metodológica'};
const infKey = (aid,eid) => `${aid}__${String(eid).replace(/[.#$\/\[\]]/g,'_')}`;
const getInforme = (aid,eid) => ((state.met&&state.met.informes)||{})[infKey(aid,eid)]||null;
const infRes = i => Array.isArray(i&&i.resultados) ? i.resultados : Object.values((i&&i.resultados)||{});
const infTot = i => { const cm=+i.clubM||0, cf=+i.clubF||0, fm=+i.forM||0, ff=+i.forF||0; return {cm,cf,ct:cm+cf,fm,ff,ft:fm+ff,tot:cm+cf+fm+ff}; };
/* ¿El evento ya terminó? Pasó su fecha (o, si es hoy, ya pasó su hora de inicio) o se marcó como realizado */
const evTerminado = e => {
  if(!e||e.estado==='cancelado'||e.estado==='pospuesto') return false;
  if(e.estado==='realizado') return true;
  const t=todayStr(); if(e.fecha<t) return true; if(e.fecha>t) return false;
  const h=String(e.hora||'').match(/^(\d{1,2}):(\d{2})/); if(!h) return false;
  const n=new Date(); return n.getHours()*60+n.getMinutes()>=(+h[1])*60+(+h[2]);
};
/* Recordatorio en rojo para la dirección: evento terminado sin informe. Solo se avisa de los últimos INF_VENTANA días
   (los eventos más viejos se pueden capturar desde su ficha, pero no llenan la pantalla de alertas). */
const INF_VENTANA = 45;
const infPendiente = (aid,e) => !!session && session.rol==='dir' && !e.sim && evTerminado(e) && !getInforme(aid,e.id) && e.fecha>=addDays(todayStr(),-INF_VENTANA);
const infPendientes = aid => coll(aid,'eventos').filter(e=>infPendiente(aid,e)).sort((a,b)=>a.fecha.localeCompare(b.fecha));
const infRojo = (aid,e) => infPendiente(aid,e)
  ? `<button class="inf-rojo" data-act="infAbrir" data-aid="${esc(aid)}" data-id="${esc(e.id)}"><i></i><span><b>Informe de Metodología pendiente</b><small>El evento ya terminó. Captura participantes y resultados.</small></span><em>Capturar</em></button>` : '';
function infBannerPend(aid){
  if(!session||session.rol!=='dir') return '';
  const n=infPendientes(aid).length; if(!n) return '';
  return `<button class="inf-ban" data-act="aTab" data-tab="calendario"><i></i><span><b>${plu(n,'informe de evento pendiente','informes de eventos pendientes')}</b> para Metodología. Toca para verlos en la Agenda.</span>${ic('next')}</button>`;
}
const infTag = (aid,e) => { if(!evTerminado(e)) return ''; const i=getInforme(aid,e.id); return i?' · Informe entregado':(session&&session.rol==='dir'?'':' · Sin informe'); };

function infResRow(x){
  x=x||{};
  return `<div class="ir-row"><div class="ir-top"><input class="ir-n" value="${esc(x.n||'')}" placeholder="Nombre y apellidos" autocomplete="off"><button type="button" class="ibtn" data-act="infDel" aria-label="Quitar">${ic('x')}</button></div>
    <div class="ir-grid"><select class="ir-s"><option value="">Sexo</option><option value="M"${x.sx==='M'?' selected':''}>M</option><option value="F"${x.sx==='F'?' selected':''}>F</option></select>
      <input class="ir-c" value="${esc(x.cat||'')}" placeholder="Categoría"><input class="ir-m" value="${esc(x.mod||'')}" placeholder="Modalidad"><input class="ir-l" value="${esc(x.lug||'')}" placeholder="Lugar (1°, 2°…)"></div></div>`;
}
/* ----- captura (director) ----- */
function openInforme(aid,eid){
  const e=getPath(`data/${aid}/eventos/${eid}`); if(!e) return;
  const a=getArea(aid)||{nombre:''}, I=getInforme(aid,eid)||{}, res=infRes(I), T=infTot(I);
  const num=(id,l,v)=>`<label class="f"><span>${l}</span><input id="${id}" class="inf-n" type="number" inputmode="numeric" min="0" value="${v?esc(v):''}" placeholder="0"></label>`;
  openModal(`${mHead('Informe del evento')}
    <div class="sub">Este informe es para <b>Metodología deportiva</b>. Gerencia no lo ve.</div>
    <div class="card"><div class="dl"><dt>Deporte</dt><dd>${esc(e.deporte||a.nombre)}</dd></div>
      <div class="dl"><dt>Evento</dt><dd>${esc(e.nombre)}</dd></div>
      <div class="dl"><dt>Lugar y fecha</dt><dd>${esc([e.lugar,fmtLarga(e.fecha)].filter(Boolean).join(' · '))}</dd></div></div>
    <div class="two"><label class="f"><span>Inicio</span><input id="inf_ini" type="time" value="${esc(I.ini||e.hora||'')}"></label>
      <label class="f"><span>Final</span><input id="inf_fin" type="time" value="${esc(I.fin||'')}"></label></div>
    <div class="h2 sm">Participantes del club</div>
    <div class="three">${num('inf_cm','M · hombres',I.clubM)}${num('inf_cf','F · mujeres',I.clubF)}<div class="f"><span>T · total</span><div class="inf-t" id="inf_ct">${T.ct}</div></div></div>
    <div class="h2 sm">Participantes foráneos</div>
    <div class="three">${num('inf_fm','M · hombres',I.forM)}${num('inf_ff','F · mujeres',I.forF)}<div class="f"><span>T · total</span><div class="inf-t" id="inf_ft">${T.ft}</div></div></div>
    <div class="inf-gen">Total general de participantes <b id="inf_tot">${T.tot}</b></div>
    <label class="f"><span>Alcance del evento</span><select id="inf_alc"><option value="">—</option><option value="local"${I.alcance==='local'?' selected':''}>Del club o local</option><option value="nacional"${I.alcance==='nacional'?' selected':''}>Nacional</option><option value="internacional"${I.alcance==='internacional'?' selected':''}>Internacional</option></select></label>
    <label class="f"><span>Impacto social</span><input id="inf_imp" value="${esc(I.impacto||'')}" placeholder="Ej. 300 asistentes, transmisión, escuelas invitadas…" autocomplete="off"></label>
    <div class="h2 sm">Resultados</div>
    <div class="ir-lista" id="ir_lista">${(res.length?res:[{}]).map(infResRow).join('')}</div>
    <button type="button" class="btn sm" data-act="infAdd">+ Agregar resultado</button>
    <label class="f" style="margin-top:12px"><span>Observaciones</span><textarea id="inf_obs" rows="4" placeholder="Cómo salió el evento, incidencias, aprendizajes, pendientes…">${esc(I.obs||'')}</textarea></label>
    ${I.ts?`<div class="sub">Última actualización: ${esc(fmtLarga(I.act||todayStr()))}${I.por?' · '+esc(I.por):''}</div>`:''}
    <div class="btns"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="infSave" data-aid="${esc(aid)}" data-id="${esc(eid)}">Guardar informe</button></div>`);
}
function infLeeTot(){
  const g=id=>Math.max(0,Math.round(+(($('#'+id)||{}).value)||0));
  const cm=g('inf_cm'), cf=g('inf_cf'), fm=g('inf_fm'), ff=g('inf_ff');
  const s=(id,v)=>{ const e=$('#'+id); if(e) e.textContent=v; };
  s('inf_ct',cm+cf); s('inf_ft',fm+ff); s('inf_tot',cm+cf+fm+ff);
}
document.addEventListener('input',e=>{ if(e.target.classList&&e.target.classList.contains('inf-n')) infLeeTot(); });

/* ----- consulta e impresión (Metodología) ----- */
function infDocHTML(aid,eid){
  const e=getPath(`data/${aid}/eventos/${eid}`)||{}, I=getInforme(aid,eid)||{}, a=getArea(aid)||{nombre:''}, T=infTot(I), res=infRes(I);
  const cel=(t,v)=>`<td><span class="inf-l">${t}</span> ${esc(v||'')}</td>`;
  return `<div class="inf-doc">
    <div class="inf-dep"><b>DEPORTE:</b> ${esc(e.deporte||a.nombre)}</div>
    <table class="inf-tb"><tr>${cel('NOMBRE DEL EVENTO:',e.nombre)}${cel('LUGAR:',e.lugar)}</tr></table>
    <table class="inf-tb"><tr>${cel('FECHA DEL EVENTO:',fmtLarga(e.fecha))}${cel('INICIO:',I.ini||e.hora)}${cel('FINAL:',I.fin)}</tr></table>
    <div class="inf-h">DESGLOSE</div>
    <div class="inf-fila"><table class="inf-tb inf-des"><tr><th colspan="3">PARTICIPANTES DEL CLUB</th><th colspan="3">PARTICIPANTES FORÁNEOS</th></tr>
      <tr><th>M</th><th>F</th><th>T</th><th>M</th><th>F</th><th>T</th></tr>
      <tr><td>${T.cm}</td><td>${T.cf}</td><td><b>${T.ct}</b></td><td>${T.fm}</td><td>${T.ff}</td><td><b>${T.ft}</b></td></tr></table>
      <div class="inf-imp"><div class="inf-l">IMPACTO SOCIAL</div><div class="inf-caja">${esc(I.impacto||'')}</div></div></div>
    <div class="inf-h">DESGLOSE</div>
    <div class="inf-tg"><b>TOTAL GENERAL DE PARTICIPANTES:</b> ${T.tot}</div>
    <div class="inf-h">Resultados</div>
    <table class="inf-tb inf-res"><thead><tr><th style="width:38%">NOMBRE Y APELLIDOS</th><th>SEXO</th><th>CATEGORÍA</th><th>MODALIDAD</th><th>LUGAR</th></tr></thead><tbody>
      ${res.length?res.map(r=>`<tr><td>${esc(r.n||'')}</td><td>${esc(r.sx||'')}</td><td>${esc(r.cat||'')}</td><td>${esc(r.mod||'')}</td><td>${esc(r.lug||'')}</td></tr>`).join(''):'<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>'}</tbody></table>
    <div class="inf-h">Observaciones:</div><div class="inf-obs">${esc(I.obs||'')||'&nbsp;'}</div>
    <div class="inf-firma"><b>${esc(INF_FIRMA.nombre)}</b><br>${esc(INF_FIRMA.cargo.toUpperCase())}</div></div>`;
}
function infVerModal(aid,eid){
  const e=getPath(`data/${aid}/eventos/${eid}`); if(!e) return;
  const I=getInforme(aid,eid);
  openModal(`${mHead('Informe del evento')}
    ${I?`<div class="rep-pantalla inf-pv">${infDocHTML(aid,eid)}</div>
      <div class="sub">Entregado por la dirección de ${esc((getArea(aid)||{}).nombre||'')}${I.act?' · '+esc(fmtLarga(I.act)):''}.</div>
      <div class="btns"><button class="btn" data-act="closeModal">Cerrar</button><button class="btn primary" data-act="infPrint" data-aid="${esc(aid)}" data-id="${esc(eid)}">Imprimir informe</button></div>`
    :`<div class="empty">La dirección de ${esc((getArea(aid)||{}).nombre||'')} todavía no entrega el informe de este evento.</div><div class="btns"><button class="btn" data-act="closeModal">Cerrar</button></div>`}`);
}
Object.assign(actions,{
  infAbrir(d){ closeModal(); openInforme(d.aid,d.id); },
  infVer(d){ closeModal(); infVerModal(d.aid,d.id); },
  infAdd(){ const l=$('#ir_lista'); if(!l) return; l.insertAdjacentHTML('beforeend',infResRow()); const f=l.querySelectorAll('.ir-n'); f[f.length-1].focus(); },
  infDel(d,e){ const r=e&&e.target.closest('.ir-row'); if(r) r.remove(); },
  infSave(d){
    const ev=getPath(`data/${d.aid}/eventos/${d.id}`); if(!ev) return;
    const g=id=>Math.max(0,Math.round(+(($('#'+id)||{}).value)||0)), v=id=>String((($('#'+id)||{}).value)||'').trim();
    const resultados=[...document.querySelectorAll('#ir_lista .ir-row')].map(r=>({n:r.querySelector('.ir-n').value.trim(),sx:r.querySelector('.ir-s').value,cat:r.querySelector('.ir-c').value.trim(),mod:r.querySelector('.ir-m').value.trim(),lug:r.querySelector('.ir-l').value.trim()})).filter(x=>x.n||x.cat||x.mod||x.lug);
    const I={clubM:g('inf_cm'),clubF:g('inf_cf'),forM:g('inf_fm'),forF:g('inf_ff')}, T=infTot(I);
    if(!T.tot&&!resultados.length&&!v('inf_obs')){ toast('Captura al menos los participantes, los resultados o las observaciones'); return; }
    const key=infKey(d.aid,d.id), prev=getInforme(d.aid,d.id)||{};
    setPath(`met/informes/${key}`,{...prev,id:key,aid:d.aid,eid:d.id,...I,ini:v('inf_ini'),fin:v('inf_fin'),alcance:v('inf_alc'),impacto:v('inf_imp').slice(0,200),resultados,obs:v('inf_obs'),act:todayStr(),ts:Date.now(),
      por:session.rol==='dir'?`Dirección de ${(getArea(d.aid)||{}).nombre||''}`:''});
    if(!fcId(d.id)&&!(+ev.participantes>0)&&T.tot) setPath(`data/${d.aid}/eventos/${d.id}/participantes`,T.tot);   // el evento toma el total exacto si no tenía número
    closeModal(); render(); toast('Informe guardado: ya lo ve Metodología');
  },
  infPrint(d){
    const e=getPath(`data/${d.aid}/eventos/${d.id}`); if(!e) return; closeModal();
    imprimirDoc({titulo:'Informe de eventos realizados',sub:`${(getArea(d.aid)||{}).nombre||''} · ${e.nombre}`,html:infDocHTML(d.aid,d.id)});
  }
});

document.addEventListener('input',e=>{
  if(e.target.id!=='mt_q') return;
  const q=fcNorm(e.target.value);
  document.querySelectorAll('#mt_clases details[data-q]').forEach(d=>{ d.style.display=(!q||d.dataset.q.includes(q))?'':'none'; });
});


/* =====================================================================
   FORMATOS DE METODOLOGÍA PARA LA PRUEBA DE RUFFIER-DICKSON
   · Tabla de captura (carta horizontal): la hoja que se llena a mano o que sale ya con los resultados,
     una por deporte, con la leyenda de evaluación (E, MB, B, R, M) y las referencias de flexibilidad.
   · Hoja informativa: el texto del test tal como lo redactó Metodología.
   ===================================================================== */
const RF_BIBLIO = 'Bibliografía. Manual de consulta del profesor deportivo, Club Campestre Ags. Mtro. Alido Rigal Borroto, Lic. Yandi Rafael Morales Montiel (Segunda edición 2023). (Pág. 8 y 9)';
function rfTablaHTML(p,area,blanco){
  const areas=(p.areas||[]).filter(a=>area==='all'||a===area).map(a=>getArea(a)).filter(Boolean);
  const vacia='<td></td>'.repeat(13);
  const flexTb=(t,v)=>`<table class="fm-t rf-mini"><tr><th>${t}</th>${RF_FLEX_EDADES.map(e=>`<th>${e}</th>`).join('')}</tr><tr><td class="l">Cm.</td>${v.map(x=>`<td class="c">${x}</td>`).join('')}</tr></table>`;
  const leyenda=`<div class="rf-leyenda"><table class="fm-t rf-mini"><tr><th colspan="2">EVALUACIÓN (RUFFIER)</th></tr>${[['E','0 o menos'],['MB','0.1 a 5'],['B','5.1 a 10'],['R','10.1 a 15'],['M','+ DE 15']].map(([k,v])=>`<tr><td class="c b">${k}</td><td class="c">${v}</td></tr>`).join('')}</table>
    <table class="fm-t rf-mini"><tr><th colspan="2">PONDERACIÓN (I. M. C.)</th></tr>${RF_IMC.slice().reverse().map(x=>`<tr><td class="c">${x.r}</td><td class="c">${x.t.toLowerCase()}</td></tr>`).join('')}</table>
    <table class="fm-t rf-mini"><tr><th>PTS</th><th>CALIFICACIÓN</th></tr>${RF_CALIF_TABLA.map(x=>`<tr><td class="c b">${x[0]}</td><td class="c">${x[1].toLowerCase()}</td></tr>`).join('')}</table>
    <div class="rf-lado"><div class="rf-dep"><b>FÓRMULAS:</b> Ruffier = (P0 + P1 + P2) − 200 ÷ 10 · IMC = peso (kg) ÷ talla (m)²</div>${flexTb('FLEX. VARONES',RF_FLEX.M)}${flexTb('FLEX. MUJERES',RF_FLEX.F)}</div></div>`;
  return areas.map((a,ix)=>{
    const rs=blanco?[]:rfLista(p.id,a.id).slice().sort((x,y)=>String(x.nombre).localeCompare(String(y.nombre),'es')), n=Math.max(blanco?20:12,rs.length);
    const filas=Array.from({length:n},(_,i)=>{ const r=rs[i];
      if(!r) return `<tr><td class="c">${i+1}</td>${vacia}</tr>`;
      const c=rfClasifica(r.ind), im=rfImc(r.peso,r.talla), fx=rfFlexEval(r), f=rfFinal(r);
      return `<tr><td class="c">${i+1}</td><td class="l">${esc(r.nombre)}</td><td class="c">${esc(r.sexo||'')}</td><td class="c">${r.edad||''}</td><td class="c">${r.talla==null?'':r.talla}</td><td class="c">${r.peso==null?'':r.peso}</td><td class="c">${im?im.v.toFixed(1)+'<br>'+esc(im.t.toLowerCase()):''}</td><td class="c">${r.flex==null?'':r.flex}</td><td class="c">${fx?(fx.ok?'Cumple':'−'+Math.abs(fx.dif)+' cm'):''}</td><td class="c">${r.p0}</td><td class="c">${r.p1}</td><td class="c">${r.p2}</td><td class="c b">${r.ind.toFixed(1)} · ${c.k}</td><td class="l" style="font-size:8px"><b>${f.cal.v.toFixed(1)}</b> ${esc(f.cal.t)}${f.cal.parcial?' (parcial)':''}${f.cortos.length?'<br>Trabajar: '+esc(f.cortos.join(', ').toLowerCase()):''}</td></tr>`; }).join('');
    return `<div${ix?' style="break-before:page;margin-top:0"':''}><div class="rf-dep"><b>DEPORTES:</b> ${esc(a.nombre)}</div>
      <table class="fm-t rf-t"><thead><tr><th rowspan="2" style="width:3%">#</th><th rowspan="2" style="width:19%">NOMBRES Y APELLIDOS</th><th colspan="5">ÍNDICE DE MASA CORPORAL</th><th colspan="2">FLEXIBILIDAD</th><th colspan="4">TEST RUFFIER – DICKSON</th><th rowspan="2" style="width:17%">CALIFICACIÓN FINAL (0–10)</th></tr>
      <tr><th style="width:4%">SEXO</th><th style="width:4%">EDAD</th><th style="width:5%">TALLA</th><th style="width:5%">PESO</th><th style="width:9%">IMC / EVAL.</th><th style="width:6%">FLEXIBI.</th><th style="width:7%">EVAL.</th><th style="width:5%">P0 REPOSO</th><th style="width:6%">P1 DESPUÉS DE LA ACT.</th><th style="width:7%">P2 A UN MINUTO</th><th style="width:7%">ÍNDICE / EVAL.</th></tr></thead><tbody>${filas}</tbody></table>${leyenda}</div>`;
  }).join('');
}
/* ---------- exportar a Excel (con formato) ---------- */
function rfExcel(p,area){
  const areas=(p.areas||[]).filter(a=>area==='all'||a===area).map(a=>getArea(a)).filter(Boolean);
  const periodo=`Aplicación del ${fmtCorta(p.inicio||todayStr())}${p.fin?' al '+fmtCorta(p.fin):''}`;
  const ENC=['#','Nombres y apellidos','Sexo','Edad','Talla (cm)','Peso (kg)','IMC','Eval. IMC','Flexibilidad (cm)','Referencia (cm)','Diferencia (cm)','Eval. flexibilidad','P0 reposo (ppm)','P1 después de la actividad (ppm)','P2 a un minuto (ppm)','Índice Ruffier','Eval. Ruffier','Puntos IMC','Puntos flexibilidad','Puntos Ruffier','Calificación final (0–10)','Nivel','Interpretación y recomendación'];
  const ANCH=[5,30,7,7,10,10,8,16,13,12,12,16,11,15,13,10,17,10,12,10,14,14,70];
  const hojaCaptura=(nombre,titulo,rs,conArea)=>{
    const enc=conArea?[ENC[0],'Disciplina',...ENC.slice(1)]:ENC, an=conArea?[ANCH[0],20,...ANCH.slice(1)]:ANCH, d=conArea?1:0, N=enc.length;
    const grupo=(ini,fin,t)=>({ini:ini+d,fin:fin+d,t});
    const cGr=Array(N).fill(''); [grupo(2,7,'ÍNDICE DE MASA CORPORAL'),grupo(8,11,'FLEXIBILIDAD'),grupo(12,16,'TEST RUFFIER – DICKSON'),grupo(17,22,'CALIFICACIÓN FINAL')].forEach(g=>{ cGr[g.ini]={v:g.t,s:'encG'}; for(let i=g.ini+1;i<=g.fin;i++) cGr[i]={v:'',s:'encG'}; });
    const colL=i=>{ let t='';i++; while(i>0){ const m=(i-1)%26; t=String.fromCharCode(65+m)+t; i=Math.floor((i-1)/26);} return t; };
    const merges=[`A1:${colL(N-1)}1`,`A2:${colL(N-1)}2`,...[[2,7],[8,11],[12,16],[17,22]].map(([x,y])=>`${colL(x+d)}4:${colL(y+d)}4`)];
    const filas=[[{v:titulo,s:'titulo'}],[{v:`${periodo} · Club Campestre Aguascalientes · Metodología deportiva`,s:'nota'}],[],cGr.map(x=>x===''?{v:'',s:'encG'}:x),enc.map(t=>({v:t,s:'enc'}))];
    filas[4].alto=42;
    rs.forEach((r,i)=>{
      const c=rfClasifica(r.ind), im=rfImc(r.peso,r.talla), fx=rfFlexEval(r), f=rfFinal(r), fk=f.cal;
      const fila=[{v:i+1,s:'ent'}];
      if(conArea) fila.push({v:(getArea(r.aid)||{}).nombre||'',s:'txt'});
      fila.push({v:r.nombre,s:'txt'},{v:r.sexo||'',s:'ctr'},r.edad?{v:+r.edad,s:'ent'}:{v:'',s:'ctr'},
        r.talla==null?{v:'',s:'ctr'}:{v:+r.talla,s:'num1'}, r.peso==null?{v:'',s:'ctr'}:{v:+r.peso,s:'num1'},
        im?{v:im.v,s:'num1'}:{v:'',s:'ctr'}, im?{v:im.t,s:im.c}:{v:'',s:'ctr'},
        (r.flex==null||r.flex==='')?{v:'',s:'ctr'}:{v:+r.flex,s:'num1'}, fx?{v:fx.ref,s:'num1'}:{v:'',s:'ctr'}, fx?{v:fx.dif,s:'num1'}:{v:'',s:'ctr'}, fx?{v:fx.ok?'Cumple':'Por debajo',s:fx.ok?'ok':'warn'}:{v:'',s:'ctr'},
        {v:r.p0,s:'ent'},{v:r.p1,s:'ent'},{v:r.p2,s:'ent'},{v:r.ind,s:'num1'},{v:`${c.k} · ${c.t}`,s:c.c},
        fk.pi==null?{v:'',s:'ctr'}:{v:fk.pi,s:'ent'},fk.pf==null?{v:'',s:'ctr'}:{v:fk.pf,s:'ent'},{v:fk.pr,s:'ent'},{v:fk.v,s:fk.c},{v:fk.t+(fk.parcial?' (parcial)':''),s:fk.c},{v:f.txt,s:'txt'});
      fila.alto=Math.max(30,Math.ceil(f.txt.length/80)*13+4);
      filas.push(fila);
    });
    const ultima=5+rs.length;
    return {nombre,cols:an,filas,combinar:merges,congelar:`${colL(2+d)}6`,filtro:rs.length?`A5:${colL(N-1)}${ultima}`:null};
  };
  const hojas=[];
  /* Resumen */
  const todos=areas.flatMap(a=>rfLista(p.id,a.id)), nT=todos.length;
  const cnt=(arr,f)=>arr.filter(f).length;
  const resumen=[[{v:'Test de Ruffier – Dickson · Resumen',s:'titulo'}],[{v:`${periodo} · ${area==='all'?'Todas las disciplinas':(getArea(area)||{}).nombre}`,s:'nota'}],[],
    [{v:'Disciplina',s:'enc'},{v:'Evaluados',s:'enc'},{v:'Índice promedio',s:'enc'},{v:'E',s:'enc'},{v:'MB',s:'enc'},{v:'B',s:'enc'},{v:'R',s:'enc'},{v:'M',s:'enc'},{v:'IMC promedio',s:'enc'},{v:'Con sobrepeso u obesidad',s:'enc'},{v:'Flexibilidad: cumplen',s:'enc'},{v:'Calificación promedio (0–10)',s:'enc'},{v:'Requieren atención',s:'enc'}]];
  resumen[3].alto=42;
  const filaRes=(nom,rs,s)=>{ const ims=rs.map(r=>rfImc(r.peso,r.talla)).filter(Boolean), fxs=rs.map(rfFlexEval).filter(Boolean), fin=rs.map(rfFinal);
    return [{v:nom,s:s||'neg'},{v:rs.length,s:s||'ent'},rs.length?{v:Math.round(mtProm(rs.map(r=>r.ind))*10)/10,s:s||'num1'}:{v:'',s:s||'ctr'},
      ...['E','MB','B','R','M'].map(k=>({v:cnt(rs,r=>rfClasifica(r.ind).k===k),s:s||'ent'})),
      ims.length?{v:Math.round(mtProm(ims.map(i=>i.v))*10)/10,s:s||'num1'}:{v:'',s:s||'ctr'},{v:cnt(ims,i=>['SP','OL','OM2','OM'].includes(i.k)),s:s||'ent'},
      {v:fxs.length?`${cnt(fxs,f=>f.ok)} de ${fxs.length}`:'',s:s||'ctr'},fin.length?{v:Math.round(mtProm(fin.map(f=>f.cal.v))*10)/10,s:s||'num1'}:{v:'',s:s||'ctr'},{v:cnt(fin,f=>f.nc==='bad'),s:s||'ent'}]; };
  areas.forEach(a=>{ const rs=rfLista(p.id,a.id); if(rs.length) resumen.push(filaRes(a.nombre,rs)); });
  if(nT&&areas.length>1) resumen.push(filaRes('TOTAL',todos,'tot'));
  resumen.push([],[{v:'Hacia dónde trabajar (veces que se repite)',s:'sub'}]);
  const cuenta={}; todos.map(rfFinal).forEach(f=>f.cortos.filter(k=>!/mantener/.test(k)).forEach(kk=>{ cuenta[kk]=(cuenta[kk]||0)+1; }));
  Object.entries(cuenta).sort((x,y)=>y[1]-x[1]).forEach(([k,v])=>resumen.push([{v:k,s:'neg'},{v:v,s:'ent'},{v:nT?Math.round(v/nT*100)+'%':'',s:'ctr'}]));
  if(!Object.keys(cuenta).length) resumen.push([{v:'Todavía no hay personas evaluadas.',s:'nota'}]);
  hojas.push({nombre:'Resumen',cols:[28,11,11,6,6,6,6,6,11,15,15,15,13],filas:resumen,combinar:['A1:M1','A2:M2'],congelar:null});
  if(areas.length>1) hojas.push(hojaCaptura('Todas las disciplinas','Test de Ruffier – Dickson · Todas las disciplinas',ordenRes(todos),true));
  areas.forEach(a=>hojas.push(hojaCaptura(a.nombre,'Test de Ruffier – Dickson · '+a.nombre,rfLista(p.id,a.id).slice().sort((x,y)=>String(x.nombre).localeCompare(String(y.nombre),'es')),false)));
  /* Ponderaciones */
  const pon=[[{v:'Ponderaciones y fórmulas',s:'titulo'}],[],
    [{v:'Índice de Ruffier = (P0 + P1 + P2) − 200 ÷ 10',s:'sub'}],
    [{v:'Evaluación',s:'enc'},{v:'Índice',s:'enc'},{v:'Significado',s:'enc'}],
    ...RF_PARAMS.map(x=>[{v:RF_LETRA[x[1]]+' · '+x[1],s:RF_CAT_CLS[x[1]]},{v:x[0],s:'ctr'},{v:x[2],s:'txt'}]),[],
    [{v:'Calificación (0 a 10): cómo se obtiene',s:'sub'}],
    [{v:'Puntos',s:'enc'},{v:'Nivel',s:'enc'},{v:'IMC',s:'enc'},{v:'Flexibilidad (% de la referencia)',s:'enc'},{v:'Ruffier',s:'enc'}],
    ...RF_CALIF_TABLA.map(x=>[{v:x[0],s:RF_PTS_NIVEL[x[0]][1]},{v:x[1],s:RF_PTS_NIVEL[x[0]][1]},{v:x[2],s:'txt'},{v:x[3],s:'txt'},{v:x[4],s:'txt'}]),
    [{v:RF_CALIF_NOTA,s:'nota'}],[],
    [{v:'Índice de masa corporal = peso (kg) ÷ talla (m)²',s:'sub'}],
    [{v:'Evaluación',s:'enc'},{v:'IMC',s:'enc'}],
    ...RF_IMC.slice().reverse().map(x=>[{v:x.t,s:x.c},{v:x.r,s:'ctr'}]),[],
    [{v:'Flexibilidad: referencia en cm por edad',s:'sub'}],
    [{v:'Edad (años)',s:'enc'},...RF_FLEX_EDADES.map(e=>({v:e,s:'enc'}))],
    [{v:'Varones',s:'neg'},...RF_FLEX.M.map(v=>({v,s:'ent'}))],
    [{v:'Mujeres',s:'neg'},...RF_FLEX.F.map(v=>({v,s:'ent'}))],
    [{v:'Entre una década y otra la referencia se calcula proporcionalmente.',s:'nota'}],[],
    [{v:RF_BIBLIO,s:'nota'}]];
  const iN=pon.findIndex(r=>r[0]&&r[0].v===RF_CALIF_NOTA); if(iN>=0) pon[iN].alto=44;
  hojas.push({nombre:'Ponderaciones',cols:[26,14,48,28,22,8,8,8,8],filas:pon,combinar:['A1:I1',`A${pon.findIndex(r=>r[0]&&r[0].v===RF_CALIF_NOTA)+1}:E${pon.findIndex(r=>r[0]&&r[0].v===RF_CALIF_NOTA)+1}`],congelar:null});
  return hojas;
}
function rfInfoHTML(){
  return `<div class="rf-info">
    <h3>Evaluación Médica Deportiva · Test de terreno sin aparatos</h3>
    <p>Examen médico previo a actividad deportiva tiene por objeto promover una actividad segura para todos los deportistas, proteger su salud y garantizar la seguridad a todos los individuos que participan en competencias organizadas. Así como la detección de cualquier enfermedad subyacente que pudiese restringir la participación el deportista.</p>
    <p><b>Propuesta prueba sin aparatos.</b></p>
    <h3>TEST DE RUFFIER – DICKSON</h3>
    <p>El Test de Ruffier-Dickson es un test basado en una fórmula que sirve para obtener un coeficiente que nos da una valoración acerca de nuestro “estado de forma”. Este coeficiente mide la resistencia cardíaca al esfuerzo y la capacidad de recuperación cardíaca (ambas relacionadas con la actividad física).</p>
    <p>Dicho coeficiente se obtiene mediante la realización de 30 flexiones profundas de piernas en un tiempo de 45″.</p>
    <p>El test de Ruffier es una prueba muy sencilla para comprobar la respuesta cardiaca al esfuerzo.</p>
    <p><b>Instrucciones para elaborar el cálculo:</b></p>
    <ul><li>(P0) ppm (pulsaciones por minuto) en reposo.</li>
      <li>(P1) ppm (pulsaciones por minuto) al finalizar el siguiente ejercicio: de pie, realizar 30 flexiones y extensiones profundas de piernas en un tiempo de 45″.</li>
      <li>(P2) ppm (pulsaciones por minuto) transcurrido un minuto de acabadas las flexiones.</li></ul>
    <p><b>Fórmula del Índice de Ruffier</b></p><p>El cálculo utiliza la siguiente operación básica: Índice = ((P0 + P1 + P2) − 200) ÷ 10</p>
    <p><b>Interpretación de los resultados</b></p>
    <ul><li>0 o menos: rendimiento cardiovascular excelente (nivel de atleta).</li><li>0.1 a 5: muy buena adaptación al esfuerzo.</li><li>5.1 a 10: condición física buena o aceptable.</li><li>10.1 a 15: capacidad cardiovascular insuficiente o baja.</li><li>Más de 15: estado físico malo; se sugiere consultar.</li></ul>
    <p>${esc(RF_BIBLIO)}</p>
    <p>Referencias internet bajada el 28/09/2026 https://enfaf.com/calculadora/calculadoratestruffier/</p></div>`;
}
Object.assign(actions,{
  mtRepTabla(d){
    const R=ui.mt.rep, p=getPrueba(R&&R.pid); if(!p) return;
    imprimirFormato({titulo:'TEST DE RUFFIER – DICKSON DEPORTES: TABLA DE CAPTURA',cuerpo:rfTablaHTML(p,R.area,d.b==='1'),notas:[esc(RF_BIBLIO)]});
  },
  mtRepXlsx(){
    const R=ui.mt.rep, p=getPrueba(R&&R.pid); if(!p) return;
    if(!rfLista(p.id,R.area==='all'?null:R.area).length){ toast('Todavía no hay personas evaluadas para exportar'); return; }
    const nom=R.area==='all'?'todas':normNom((getArea(R.area)||{}).nombre).replace(/ /g,'-');
    try{ xlsxDescargar(`ruffier-${nom}-${todayStr()}.xlsx`,rfExcel(p,R.area)); toast('Excel descargado'); }catch(e){ console.error(e); toast('No se pudo crear el Excel'); }
  },
  mtRepInfo(){ imprimirFormato({titulo:'Test de Ruffier – Dickson',vertical:true,cuerpo:rfInfoHTML()}); }
});
