'use strict';
/* =====================================================================
   desglose.js — detalle de cada tarjeta de indicador.
   Al tocar una tarjeta (en el Resumen de gerencia o en el Comité) se abre
   una hoja con los números que la forman, por área y, dentro de cada área,
   por clase. Respeta el filtro de período (día, 7 días, 30 días, etc.).
   ===================================================================== */
const dgAhora = () => { const d=new Date(); return pad(d.getHours())+':'+pad(d.getMinutes()); };
function dgCtx(){
  const r=anRange(), comite=!!session&&session.rol==='ger'&&ui.gTab==='comite';
  const aids=comite?anAids():areasList().map(a=>a.id);
  return {r,aids,comite,cur:anCompute(aids,r.desde,r.hasta)};
}
const dgPer = r => anPeriodoTxt(r);
const dgN = n => (+n||0).toLocaleString('es-MX');
const dgSubClase = x => esc([x.g.hi,x.g.prof].filter(Boolean).join(' · '));
const dgChev = () => `<span class="dg-chev">${ic('next')}</span>`;

function dgHoja(titulo,ctx,resumen,cuerpo,nota){
  openModal(`${mHead(esc(titulo))}
    <div class="dg-per">${esc(dgPer(ctx.r))}${ctx.r.desde===ctx.r.hasta?'':` · ${ctx.r.n} días`}</div>
    ${resumen?`<div class="dg-sum">${resumen}</div>`:''}
    ${cuerpo||empty('No hay información para este período.')}
    ${nota?`<div class="an-cs" style="margin:10px 0 0">${nota}</div>`:''}
    <div class="btns"><button class="btn" data-act="closeModal">Cerrar</button></div>`);
}
const dgCaja = (valor,texto,cls) => `<div><b class="${cls||''}">${valor}</b><span>${texto}</span></div>`;
function dgArea(a,sub,der,filas){
  return `<details class="dg-a" style="--ac:${esc(a.color)}"><summary>${areaIco(a,{tile:true,size:18})}
    <div class="dg-t"><b>${esc(a.nombre)}</b><small>${sub}</small></div><div class="dg-v">${der}</div>${dgChev()}</summary>
    <div class="dg-rows">${filas||'<div class="dg-vacio">Sin grupos en esta área.</div>'}
      <button class="btn sm" data-act="dgVerArea" data-id="${esc(a.id)}">Ver ${esc(a.nombre)}</button></div></details>`;
}
function dgFila(nombre,sub,valor,detalle,pct){
  const cls=aforoCls(pct);
  return `<div class="dg-r"><div class="dg-rt"><b>${nombre}</b><small>${sub||''}</small></div><div class="dg-rv"><b>${valor}</b><small>${detalle||''}</small></div>
    ${pct!=null?`<div class="bar dg-bar"><i class="${cls}" style="width:${Math.min(pct,100)}%"></i></div>`:''}</div>`;
}
const dgPorArea = (ctx,soloGrupos) => ctx.aids.map(aid=>({a:getArea(aid),aid,gs:ctx.cur.gs.filter(x=>x.aid===aid),s:ctx.cur.porArea[aid]})).filter(x=>x.a&&(!soloGrupos||x.gs.length));

/* ---------- filas del gimnasio (personas por hora) ---------- */
function dgGimnasio(aid,r,orden){
  const a=getArea(aid), S=gimStats(aid,r.desde,r.hasta);
  if(!S.recs) return '';                                   // sin conteos en el período: no se muestra
  const prom=Math.round(S.personasHora/S.recs);
  const horas=S.porHora.slice().sort((x,y)=>orden==='aforo'?y.pct-x.pct:y.tP-x.tP)
    .map(x=>dgFila(hh(x.h),`${Math.round(x.muP)} mujeres · ${Math.round(x.hoP)} hombres`,`${Math.round(x.tP)} de ${S.cap}`,'personas',x.pct)).join('');
  return dgArea(a,`promedio ${prom} de ${S.cap} personas por hora · ${S.mu} mujeres y ${S.ho} hombres contados`,`<b class="${aforoCls(S.aforo)}">${anPct(S.aforo)}</b><small>${S.recs} ${S.recs===1?'hora':'horas'}</small>`,horas);
}

/* ---------- asistentes y aforo ---------- */
function dgAsistencia(ctx,modo){
  const filas=dgPorArea(ctx,true).filter(x=>x.s.ses>0||x.gs.length).sort((x,y)=>modo==='aforo'?((y.s.aforo==null?-1:y.s.aforo)-(x.s.aforo==null?-1:x.s.aforo)):(y.s.asisTot-x.s.asisTot));
  const T=ctx.cur.tot, gims=ctx.aids.filter(esGim);
  const cuerpo=filas.map(({a,gs,s})=>{
    const orden=gs.slice().sort((x,y)=>modo==='aforo'?((y.aforo==null?-1:y.aforo)-(x.aforo==null?-1:x.aforo)):(y.asisTot-x.asisTot));
    const rows=orden.map(x=>x.ses
      ?dgFila(esc(x.g.nombre),dgSubClase(x),x.lugares?`${dgN(x.asisTot)} de ${dgN(x.lugares)}`:dgN(x.asisTot),`${plu(x.ses,'sesión','sesiones')}${x.aforo!=null?` · ${x.aforo}%`:''}`,x.aforo)
      :dgFila(esc(x.g.nombre),dgSubClase(x),'—','sin sesiones capturadas',null)).join('');
    return dgArea(a,s.lugares?numLugares(s.asisL,s.lugares):`${dgN(s.asisTot)} asistentes`,
      modo==='aforo'?`<b class="${aforoCls(s.aforo)}">${anPct(s.aforo)}</b><small>${plu(s.ses,'sesión','sesiones')}</small>`:`<b>${dgN(s.asisTot)}</b><small>${anPct(s.aforo)} de aforo</small>`,rows);
  }).join('')+gims.map(aid=>dgGimnasio(aid,ctx.r,modo)).join('')+ctx.aids.filter(esServ).map(aid=>dgServicio(aid,ctx.r,modo)).join('');
  const resumen=dgCaja(dgN(T.asisTot),'asistentes a clases')+dgCaja(T.lugares?dgN(T.lugares):'—','lugares disponibles')+dgCaja(anPct(T.aforo),'aforo',aforoCls(T.aforo));
  dgHoja(modo==='aforo'?'Aforo por área y por clase':'Asistentes por área y por clase',ctx,resumen,cuerpo,
    modo==='aforo'?'Aforo = asistentes ÷ lugares disponibles (el cupo de cada clase impartida). Ordenado de mayor a menor aforo.':'Ordenado de mayor a menor número de asistentes. Toca un área para ver sus clases.');
}

/* ---------- alumnos inscritos ---------- */
function dgAlumnos(ctx){
  const filas=dgPorArea(ctx,true).map(x=>({...x,n:anSum(x.gs,g=>inscritos(g.g))})).sort((x,y)=>y.n-x.n), tot=anSum(filas,x=>x.n);
  const cuerpo=filas.map(({a,gs,n})=>dgArea(a,plu(gs.length,'grupo','grupos'),`<b>${dgN(n)}</b><small>alumnos</small>`,
    gs.slice().sort((x,y)=>inscritos(y.g)-inscritos(x.g)).map(x=>dgFila(esc(x.g.nombre),dgSubClase(x),dgN(inscritos(x.g)),x.cupo?`de cupo ${x.cupo}`:'',x.cupo?Math.round(inscritos(x.g)/x.cupo*100):null)).join(''))).join('');
  dgHoja('Alumnos inscritos por área y grupo',ctx,dgCaja(dgN(tot),'alumnos inscritos')+dgCaja(filas.length,'áreas con grupos')+dgCaja(anSum(filas,x=>x.gs.length),'grupos'),cuerpo,
    ctx.aids.some(esGim)?'El Gimnasio no tiene inscripciones: se controla por aforo por hora.':'');
}

/* ---------- captura de aforo ---------- */
function dgCaptura(ctx){
  const r=ctx.r, hoy=todayStr(), ahora=dgAhora(), un=r.desde===r.hasta;
  const estado=x=>{ const falta=Math.max(0,x.prog-Math.min(x.cap,x.prog));
    if(un){ if(!x.prog) return null; if(!falta) return {t:'Capturada',c:'ok'}; return (r.desde===hoy&&x.g.hi&&x.g.hi>ahora)?{t:'Por iniciar',c:'mut'}:{t:r.desde===hoy?'Por capturar':'Sin captura',c:'bad'}; }
    return x.prog?{t:`${Math.min(x.cap,x.prog)} de ${x.prog}`,c:falta?(falta>=x.prog/2?'bad':'warn'):'ok',falta}:null; };
  const filas=dgPorArea(ctx,true).map(x=>{ const it=x.gs.map(g=>({g,e:estado(g)})).filter(y=>y.e); return {...x,it}; }).filter(x=>x.it.length)
    .sort((x,y)=>(y.it.filter(z=>z.e.c==='bad').length-x.it.filter(z=>z.e.c==='bad').length)||x.a.nombre.localeCompare(y.a.nombre));
  const cuerpo=filas.map(({a,it,s})=>{
    const ok=it.filter(z=>z.e.c==='ok').length, falt=it.length-ok;
    const rows=it.slice().sort((x,y)=>(x.e.c==='ok')-(y.e.c==='ok')).map(z=>`<div class="dg-r"><div class="dg-rt"><b>${esc(z.g.g.nombre)}</b><small>${dgSubClase(z.g)}</small></div><div class="dg-rv">${pill(z.e.t,z.e.c)}</div></div>`).join('');
    return dgArea(a,un?`${ok} de ${it.length} clases capturadas`:`${s.capOk} de ${s.prog} sesiones capturadas`,`<b class="${falt?'bad':'ok'}">${falt||'✔'}</b><small>${falt?(falt===1?'pendiente':'pendientes'):'al día'}</small>`,rows);
  }).join('');
  const T=ctx.cur.tot, todos=filas.flatMap(x=>x.it), pend=todos.filter(z=>z.e.c==='bad').length, aun=todos.filter(z=>z.e.t==='Por iniciar').length;
  const hoyUn=un&&r.desde===hoy, falt=hoyUn?pend:T.sinCaptura;
  dgHoja('Captura de aforo por área y clase',ctx,dgCaja(T.cumple==null?'—':T.cumple+'%','de captura',T.cumple==null?'':T.cumple>=90?'ok':T.cumple>=70?'warn':'bad')+dgCaja(dgN(T.capOk),'capturadas')+dgCaja(dgN(falt),hoyUn?`por capturar${aun?` · ${aun} por iniciar`:''}`:'sin captura',falt?'bad':'ok'),cuerpo,
    un&&r.desde===hoy?'“Por iniciar” son clases de hoy que todavía no empiezan; no cuentan como faltantes hasta que pasen.':'');
}

/* ---------- sesiones (Comité) ---------- */
function dgSesiones(ctx){
  const T=ctx.cur.tot, filas=dgPorArea(ctx,true).sort((x,y)=>y.s.ses-x.s.ses);
  const cuerpo=filas.map(({a,gs,s})=>dgArea(a,`${s.omit?plu(s.omit,'clase sin impartir','clases sin impartir')+' · ':''}${plu(s.grupos,'grupo','grupos')}`,`<b>${dgN(s.ses)}</b><small>impartidas</small>`,
    gs.slice().sort((x,y)=>y.ses-x.ses).map(x=>dgFila(esc(x.g.nombre),dgSubClase(x),plu(x.ses,'sesión','sesiones'),`${x.omit?`${x.omit} sin clase`:''}${x.faltas?` · ${plu(x.faltas,'falta','faltas')}`:''}${x.subs?` · ${plu(x.subs,'suplencia','suplencias')}`:''}`.replace(/^ · /,''),null)).join(''))).join('');
  dgHoja('Sesiones impartidas por área y clase',ctx,dgCaja(dgN(T.ses),'impartidas')+dgCaja(dgN(T.omit),'sin clase',T.omit?'warn':'')+dgCaja(dgN(T.faltas),'faltas de profesor',T.faltas?'bad':''),cuerpo);
}

/* ---------- grupos en rojo (Comité) ---------- */
function dgRojo(ctx){
  const rojos=ctx.cur.gs.filter(x=>x.aforo!=null&&x.aforo<30).sort((x,y)=>x.aforo-y.aforo);
  const cuerpo=rojos.map(x=>{ const a=getArea(x.aid); return `<div class="dg-a plano" style="--ac:${esc(a.color)}"><div class="dg-cab">${areaIco(a,{tile:true,size:18})}<div class="dg-t"><b>${esc(x.g.nombre)}</b><small>${esc(a.nombre)} · ${dgSubClase(x)}</small></div><div class="dg-v"><b class="bad">${x.aforo}%</b><small>${dgN(x.asisTot)} de ${dgN(x.lugares)}</small></div></div>
      <div class="dg-rows"><div class="bar dg-bar"><i class="bad" style="width:${x.aforo}%"></i></div><button class="btn sm" data-act="dgVerArea" data-id="${esc(x.aid)}">Ver ${esc(a.nombre)}</button></div></div>`; }).join('');
  dgHoja('Grupos en rojo',ctx,dgCaja(rojos.length,'grupos con aforo < 30%',rojos.length?'bad':'ok')+dgCaja(ctx.cur.tot.conAforo,'grupos con datos')+dgCaja(anPct(ctx.cur.tot.aforo),'aforo general',aforoCls(ctx.cur.tot.aforo)),cuerpo||empty('Ningún grupo está en rojo en este período.'));
}

/* ---------- incidencias abiertas ---------- */
function dgIncid(ctx){
  const I=anIncid(ctx.aids,ctx.r.desde,ctx.r.hasta), ab=I.abiertas.slice().sort((x,y)=>incSort(x.i,y.i));
  const cuerpo=ab.map(x=>{ const a=getArea(x.aid); return `<button class="line" style="--ac:${x.i.grav==='alta'?'var(--bad)':x.i.grav==='media'?'var(--warn)':'var(--info)'}" data-act="dgIncid" data-aid="${esc(x.aid)}" data-id="${esc(x.i.id)}">
      <div class="t">${areaIco(a,{tile:true,size:20})}</div><div class="b"><b>${esc(x.i.tipo||'Incidencia')} · ${esc(a.nombre)}</b><small>${esc(fmtFecha(x.i.fecha))} · ${esc(String(x.i.desc||'').slice(0,110))}</small></div><div class="r">${pill(x.i.grav||'media',GRAV_CLS[x.i.grav]||'warn')}</div></button>`; }).join('');
  dgHoja('Incidencias abiertas',ctx,dgCaja(ab.length,'abiertas',ab.length?'bad':'ok')+dgCaja(I.altas.length,'de gravedad alta',I.altas.length?'bad':'')+dgCaja(dgN(I.enPer.length),'registradas en el período'),cuerpo||empty('No hay incidencias abiertas.'),'Las abiertas se cuentan sin importar el período; toca una para ver su detalle.');
}

/* ---------- reportes semanales ---------- */
function dgReportes(ctx){
  const wk=mondayOf(ctx.r.hasta), semAct=mondayOf(todayStr());
  const filas=ctx.aids.map(aid=>{ const a=getArea(aid), rep=(areaData(aid).reportes||{})[wk];
    const est=rep?(rep.entregado?['Entregado','ok']:['Borrador','info']):(wk===semAct?['Pendiente','mut']:['No entregado','bad']);
    return {a,rep,est}; }).filter(x=>x.a);
  const cuerpo=filas.sort((x,y)=>(y.est[1]==='bad')-(x.est[1]==='bad')||x.a.nombre.localeCompare(y.a.nombre)).map(({a,rep,est})=>
    `<button class="line" style="--ac:${esc(a.color)}" data-act="dgReporte" data-id="${esc(a.id)}"><div class="t">${areaIco(a,{tile:true,size:20})}</div>
      <div class="b"><b>${esc(a.nombre)}</b><small>${rep&&rep.entregado?`Entregado el ${esc(fmtCorta(String(rep.entregadoEn||wk).slice(0,10)))}`:'Todavía sin entregar'}${rep&&String(rep.apoyo||'').trim()?` · Pide apoyo: ${esc(String(rep.apoyo).slice(0,70))}`:''}</small></div><div class="r">${pill(est[0],est[1])}</div></button>`).join('');
  const ok=filas.filter(x=>x.est[1]==='ok').length;
  dgHoja('Reportes semanales por área',ctx,dgCaja(`${ok}/${filas.length}`,'entregados',ok===filas.length?'ok':'')+dgCaja(fmtCorta(wk),'semana del')+dgCaja(filas.filter(x=>x.rep&&String(x.rep.apoyo||'').trim()).length,'piden apoyo'),cuerpo,'Muestra la semana del día elegido. Toca un área para abrir su reporte.');
}

const DG_HOJAS = {alumnos:dgAlumnos,asistentes:c=>dgAsistencia(c,'asis'),aforo:c=>dgAsistencia(c,'aforo'),captura:dgCaptura,sesiones:dgSesiones,rojo:dgRojo,incid:dgIncid,reportes:dgReportes};
Object.assign(actions,{
  openKpi(d){ const f=DG_HOJAS[d.k]; if(f) f(dgCtx()); },
  dgVerArea(d){ closeModal(); actions.openArea({id:d.id}); },
  dgReporte(d){ closeModal(); actions.openArea({id:d.id,tab:'reporte'}); },
  dgIncid(d){ openInc(d.id,d.aid); }
});
