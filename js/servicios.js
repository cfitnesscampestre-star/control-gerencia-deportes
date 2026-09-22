'use strict';
/* =====================================================================
   servicios.js — Nutrición y Fisioterapia: BITÁCORA CONTRA TURNO.

   Estas áreas no llevan agenda ni casos aquí (cada especialista tiene su
   propia agenda). El sistema solo muestra DATOS de lo que ellos reportan:

   1) DIRECCIÓN da de alta al especialista con su HORARIO (entrada y salida
      de cada día que trabaja) y su clave.
   2) ESPECIALISTA (entra con su clave) registra cada servicio: nombre del
      socio, servicio, HORA DE INICIO y HORA DE FIN, y si lo canalizó un área.
      Si la cita no se dio, la registra como “No se presentó” o “Canceló”
      para que ese hueco quede explicado. El sistema guarda a qué hora
      se capturó cada registro.
   3) DIRECCIÓN / GERENCIA ven, por día, semana o mes: servicios, horas de
      servicio, turno programado, ocupación del turno, TIEMPO MUERTO (y cuánto
      se debió a citas que no llegaron), y si la captura fue en el momento
      o al final del turno.

   Datos: data/<área>/bitacora/<id>
          {f, profId, paciente, servicio, estado, hi, hf, min, origen, ts}
          estado: atendido | no_asistio | cancelo
   Horario: profesores/<id>/horario = {0:{i:'06:00',f:'11:00'}, …}  (0 = lunes)
   PRIVACIDAD: solo nombre del socio y servicio. No se guardan diagnósticos.
   ===================================================================== */
const SERV = {
  nutricion:{
    nom:'Nutrición', esp:'Nutriólogo', espP:'Nutriólogos', unidad:'consulta', unidadP:'consultas',
    servicios:[
      {s:'Consulta',p:'consultas',min:45},
      {s:'InBody',p:'InBody',min:15},
      {s:'Plan de alimentación',p:'planes de alimentación',min:30},
      {s:'Plática o taller',p:'pláticas o talleres',min:60},
      {s:'Otro',u:'otro servicio',p:'otros servicios',min:30}
    ]
  },
  fisioterapia:{
    nom:'Fisioterapia', esp:'Fisioterapeuta', espP:'Fisioterapeutas', unidad:'sesión', unidadP:'sesiones',
    servicios:[
      {s:'Valoración',p:'valoraciones',min:40},
      {s:'Sesión de terapia',p:'sesiones de terapia',min:45},
      {s:'Electroterapia o ultrasonido',p:'sesiones de electroterapia o ultrasonido',min:30},
      {s:'Ejercicio terapéutico',p:'sesiones de ejercicio terapéutico',min:45},
      {s:'Vendaje',p:'vendajes',min:15},
      {s:'Masaje',p:'masajes',min:45},
      {s:'Otro',u:'otro servicio',p:'otros servicios',min:30}
    ]
  },
  paramedico:{
    nom:'Paramédicos', esp:'Paramédico', espP:'Paramédicos', unidad:'cita', unidadP:'citas',
    servicios:[
      {s:'Cita a Fisioterapia',p:'citas a Fisioterapia',min:45},
      {s:'Otro',u:'otro servicio',p:'otros servicios',min:30}
    ]
  }
};
const SV_UTIL = {ok:65, warn:45};                        // ocupación del turno: ≥65% justo · 45–64% revisar · <45% excesivo
const SV_TIEMPO_REAL = 30;                               // se considera captura “en el momento” si se guardó a los 30 min o menos de terminar
const SV_ESTADO = {atendido:'Se atendió', no_asistio:'No se presentó', cancelo:'Canceló', agendada:'Agendada · pendiente'};
const svUtilCls = u => u==null ? 'mut' : u>=SV_UTIL.ok ? 'ok' : u>=SV_UTIL.warn ? 'warn' : 'bad';
const esParamed = aid => (getArea(aid)||{}).tipo==='paramedico';
const fisioAreaId = () => { const a=areasList().find(a=>a.tipo==='fisioterapia'); return a?a.id:''; };

/* ---------- acceso a datos ---------- */
const esServ = aid => !!SERV[(getArea(aid)||{}).tipo];
const servDe = aid => SERV[(getArea(aid)||{}).tipo] || SERV.nutricion;
const servAreaIds = () => areasList().filter(a=>SERV[a.tipo]).map(a=>a.id);
const servMedidosIds = () => servAreaIds().filter(id=>!esParamed(id));         // Gerencia no mide el servicio de Paramédicos: se excluye de los agregados
const pfNom = (aid,pl) => esGim(aid) ? (pl?'Instructores':'Instructor') : esServ(aid) ? (pl?servDe(aid).espP:servDe(aid).esp) : (pl?'Profesores':'Profesor');
const bitacora = aid => coll(aid,'bitacora');
const dd = (a,b) => Math.round((parseYmd(b)-parseYmd(a))/86400000);
const svCap = s => s.charAt(0).toUpperCase()+s.slice(1);
const svSrv = (aid,label) => servDe(aid).servicios.find(x=>x.s===label) || {s:label,p:String(label).toLowerCase(),min:30};
const svOrigenTxt = v => (!v||v==='propia') ? 'Sin canalizar' : v==='medico' ? 'Médico externo' : (getArea(v)?'Desde '+getArea(v).nombre:'Otra área');
const svEsCanal = v => !!v && v!=='propia' && v!=='medico';
const svAtendido = x => !x.estado || x.estado==='atendido';
const svPendiente = x => x.estado==='agendada';           // cita agendada (por paramédicos) que el especialista todavía no resuelve
const svOcupado = x => svAtendido(x) || svPendiente(x);   // ocupa el horario (no es un hueco ni una cita caída)
const svHm = m => { m=Math.round(m||0); if(m<=0) return '0 min'; if(m<60) return m+' min'; const h=Math.floor(m/60), r=m%60; return r?`${h} h ${r} min`:`${h} h`; };
const svHmC = m => { m=Math.round(m||0); return m<60?m+'m':`${Math.floor(m/60)}h${m%60?String(m%60).padStart(2,'0'):''}`; };
const svLista = a => a.length<=1 ? (a[0]||'') : a.slice(0,-1).join(', ')+' y '+a[a.length-1];
ui.sv = ui.sv || { per:'mes', ref:todayStr() };
if(!ui.sv.per) ui.sv.per='mes'; if(!ui.sv.ref) ui.sv.ref=todayStr();

/* ---------- horas del día ---------- */
const svMin = t => { const [h,m]=String(t||'').split(':').map(Number); return (isNaN(h)||isNaN(m))?null:h*60+m; };
const svHHMM = m => `${String(Math.floor(m/60)%24).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
const svH12 = m => { const h=Math.floor(m/60)%24, mm=m%60; return `${h%12||12}:${String(mm).padStart(2,'0')} ${h<12?'am':'pm'}`; };
const svRangoTxt = (a,b) => { const x=svH12(a), y=svH12(b); return x.slice(-2)===y.slice(-2) ? `${x.slice(0,-3)}–${y}` : `${x}–${y}`; };
const svHoraTs = ts => { const d=new Date(ts); return svH12(d.getHours()*60+d.getMinutes()); };
const svIv = x => { const a=svMin(x.hi), b=svMin(x.hf); return (a==null||b==null||b<=a)?null:[a,b]; };
const svDur = x => { const v=svIv(x); return v?v[1]-v[0]:(+x.min||0); };
function svRetraso(x){                                   // minutos entre que terminó el servicio y se guardó el registro
  if(!x.ts||!x.hf||!x.f) return null; const fin=new Date(`${x.f}T${x.hf}:00`).getTime(); return isNaN(fin)?null:Math.round((x.ts-fin)/60000);
}

/* ---------- horario del especialista (admite doble turno: i/f y, si hay, i2/f2) ---------- */
const svHor = p => (p&&p.horario&&typeof p.horario==='object')?p.horario:null;
const spDias = p => svHor(p) ? Object.keys(svHor(p)).filter(k=>svHor(p)[k]).map(Number) : [];
function svTurnosDia(p,f){                                // uno o dos turnos del día, ordenados por hora de inicio
  const h=svHor(p)&&svHor(p)[wdIdx(f)]; if(!h) return [];
  const out=[], a1=svMin(h.i), b1=svMin(h.f); if(a1!=null&&b1!=null&&b1>a1) out.push([a1,b1]);
  const a2=svMin(h.i2), b2=svMin(h.f2); if(a2!=null&&b2!=null&&b2>a2) out.push([a2,b2]);
  return out.sort((x,y)=>x[0]-y[0]);
}
function svTurnoDia(p,f){ const t=svTurnosDia(p,f); return t.length?t[0]:null; } // primer turno del día (uso rápido)
function svTurnoDiaTxt(p,f){ const t=svTurnosDia(p,f); return t.length?t.map(w=>svRangoTxt(w[0],w[1])).join(' y '):''; }
function svHorarioTxt(p){
  const H=svHor(p); if(!H||!Object.keys(H).length) return 'Sin horario';
  const txtDia = h => [h.i&&h.f?svRangoTxt(svMin(h.i),svMin(h.f)):'', h.i2&&h.f2?svRangoTxt(svMin(h.i2),svMin(h.f2)):''].filter(Boolean).join(' y ');
  const runs=[]; for(let i=0;i<7;i++){ const h=H[i]; if(!h) continue; const k=txtDia(h); if(!k) continue; const l=runs[runs.length-1];
    if(l&&l.k===k&&l.b===i-1) l.b=i; else runs.push({a:i,b:i,k}); }
  return runs.map(r=>`${DIAS[r.a]}${r.b>r.a?'–'+DIAS[r.b]:''} ${r.k}`).join(' · ');
}

/* ---------- intervalos (para el tiempo muerto) ---------- */
function svUnion(iv){ const s=iv.filter(x=>x[1]>x[0]).sort((a,b)=>a[0]-b[0]), out=[]; s.forEach(x=>{ const l=out[out.length-1]; if(l&&x[0]<=l[1]) l[1]=Math.max(l[1],x[1]); else out.push([x[0],x[1]]); }); return out; }
const svLen = iv => iv.reduce((s,x)=>s+(x[1]-x[0]),0);
const svClip = (iv,a,b) => iv.map(x=>[Math.max(x[0],a),Math.min(x[1],b)]).filter(x=>x[1]>x[0]);
function svHuecos(win,ocupado){ const out=[]; let c=win[0]; svClip(ocupado,win[0],win[1]).forEach(x=>{ if(x[0]>c) out.push([c,x[0]]); c=Math.max(c,x[1]); }); if(c<win[1]) out.push([c,win[1]]); return out; }

/* Turno de un especialista en un día contra lo que registró:
   turno, minutos en servicio dentro del turno, tiempo muerto (y cuánto por citas que no llegaron), tiempo fuera de horario */
function svDiaProf(aid,p,f,regs){
  const att=regs.filter(svOcupado), per=regs.filter(x=>!svOcupado(x));  // "ocupado" = atendido o cita agendada pendiente (no es hueco)
  const uA=svUnion(att.map(svIv).filter(Boolean)), uP=svUnion(per.map(svIv).filter(Boolean));
  const r={att,per,turno:0,enTurno:0,fuera:0,idle:0,perdida:0,libre:0,win:null,wins:[],blocks:[]};
  if(!regs.length||f>todayStr()||!svHor(p)) return r;
  const wins0=svTurnosDia(p,f);
  if(!wins0.length){ r.fuera=svLen(uA); return r; }        // vino en un día sin turno
  let wins=wins0.map(w=>w.slice());
  if(f===todayStr()){ const n=new Date(), now=n.getHours()*60+n.getMinutes(); wins=wins.filter(w=>now>w[0]).map(w=>[w[0],Math.min(w[1],now)]); }
  if(!wins.length) return r;
  r.wins=wins; r.win=[wins[0][0],wins[wins.length-1][1]];
  wins.forEach(win=>{
    const dentro=svClip(uA,win[0],win[1]), huecos=svHuecos(win,uA), perd=[];
    huecos.forEach(h=>svClip(uP,h[0],h[1]).forEach(x=>perd.push(x)));
    const idleMin=svLen(huecos), perdMin=svLen(perd);
    r.turno+=win[1]-win[0]; r.enTurno+=svLen(dentro); r.idle+=idleMin; r.perdida+=perdMin; r.libre+=idleMin-perdMin;
    r.blocks.push(...dentro.map(x=>({a:x[0],b:x[1],t:'att'})),...perd.map(x=>({a:x[0],b:x[1],t:'perd'})));
  });
  r.fuera=svLen(uA)-wins0.reduce((s,w)=>s+svLen(svClip(uA,w[0],w[1])),0);
  return r;
}

/* ---------- métricas de un período (de un especialista o de toda el área) ---------- */
function svAgrupa(aid,regs){
  const m={}; regs.forEach(x=>{ const k=x.servicio||'Otro', o=m[k]=m[k]||{k,n:0,min:0}; o.n++; o.min+=svDur(x); });
  const orden=servDe(aid).servicios.map(x=>x.s);
  return Object.values(m).sort((a,b)=>{ const i=orden.indexOf(a.k), j=orden.indexOf(b.k); return (i<0?99:i)-(j<0?99:j)||b.n-a.n; });
}
function svAgrupa2(regs,f){ const m={}; regs.forEach(x=>{ const k=f(x); m[k]=(m[k]||0)+1; }); return Object.keys(m).map(k=>({k,n:m[k]})).sort((a,b)=>b.n-a.n); }
function svPrimera(pid,B){ let m=''; B.forEach(x=>{ if(x.profId===pid&&(!m||x.f<m)) m=x.f; }); return m; }
function servStats(aid,desde,hasta,pid,B){
  const t=todayStr(), fin=(hasta>t&&desde<=t)?t:hasta; B=B||bitacora(aid);  // solo recorta a "hoy" si el rango empieza ya (no una consulta totalmente futura, como una cita agendada)
  const todas=B.filter(x=>x.f>=desde&&x.f<=fin&&(!pid||x.profId===pid)), regs=todas.filter(svAtendido),
    per=todas.filter(x=>x.estado==='no_asistio'||x.estado==='cancelo'), pend=todas.filter(svPendiente);
  const min=regs.reduce((s,x)=>s+svDur(x),0), grupos={};
  todas.forEach(x=>{ const k=x.f+'|'+x.profId; (grupos[k]=grupos[k]||[]).push(x); });
  const T={turno:0,enTurno:0,fuera:0,idle:0,perdida:0,libre:0};
  Object.keys(grupos).forEach(k=>{ const [f,id]=k.split('|'), d=svDiaProf(aid,getProf(aid,id),f,grupos[k]); Object.keys(T).forEach(c=>T[c]+=d[c]); });
  const conReg=new Set(Object.keys(grupos)), sinCap=[];
  profesores(aid).filter(p=>p.activo!==false&&(!pid||p.id===pid)).forEach(p=>{
    const prim=svPrimera(p.id,B); if(!prim) return;      // antes de su primer registro no se le exige bitácora
    for(let d=desde>prim?desde:prim; d<fin; d=addDays(d,1)){ if(spDias(p).includes(wdIdx(d))&&!conReg.has(d+'|'+p.id)) sinCap.push({f:d,profId:p.id}); }
  });
  const rt=todas.map(svRetraso).filter(x=>x!=null), rtOk=rt.filter(x=>x<=SV_TIEMPO_REAL).length;
  const dias=new Set(regs.map(x=>x.f)).size;
  return {n:regs.length,min,regs,todas,dias,promMin:regs.length?Math.round(min/regs.length):null,minDia:dias?Math.round(min/dias):null,
    noLlego:per.length,noShow:per.filter(x=>x.estado==='no_asistio').length,cancel:per.filter(x=>x.estado==='cancelo').length,
    ...T,util:T.turno?Math.round(T.enTurno/T.turno*100):null,
    rt:{n:rt.length,pct:rt.length?Math.round(rtOk/rt.length*100):null,prom:rt.length?Math.round(rt.reduce((s,x)=>s+Math.max(0,x),0)/rt.length):null},
    sinCap,porServ:svAgrupa(aid,regs),porOrigen:svAgrupa2(regs,x=>x.origen||'propia'),canal:regs.filter(x=>svEsCanal(x.origen)).length,
    pend,agendadas:pend.length,canalPend:pend.filter(x=>svEsCanal(x.origen)).length};
}
const svRegsRecientes = (aid,pid) => { const t=todayStr(); return bitacora(aid).filter(x=>x.profId===pid&&svAtendido(x)&&x.f>=addDays(t,-29)&&x.f<=t).length; };
function servAreaStats(aid){ const t=todayStr(), h=bitacora(aid).filter(x=>x.f===t&&svAtendido(x)); return {alumnos:0,hoyProg:0,hoyCap:0,svHoy:h.length,svHoyMin:h.reduce((s,x)=>s+svDur(x),0)}; }

const spRango = (per,ref) => {
  if(per==='dia') return {desde:ref,hasta:ref,txt:fmtLarga(ref)};
  if(per==='semana'){ const l=mondayOf(ref), d=addDays(l,6); return {desde:l,hasta:d,txt:`Semana del ${fmtCorta(l)} al ${fmtCorta(d)}`}; }
  const r=svRangoMes(ref.slice(0,7)); return {...r,txt:svMesTxt(ref.slice(0,7))};
};
const svRango = spRango;
const svMesTxt = mes => { const [y,m]=mes.split('-').map(Number); return `${MESES[m-1]} ${y}`; };
const svMesMas = (mes,n) => { const [y,m]=mes.split('-').map(Number), d=new Date(y,m-1+n,1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
function svRangoMes(mes){ const [y,m]=mes.split('-').map(Number); return {desde:`${mes}-01`, hasta:`${mes}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`}; }

/* “Ana hizo 34 h de servicio de nutrición, que incluye 20 consultas y 8 InBody.” */
function svFrase(aid,s,nombre){
  const S=servDe(aid), sujeto=nombre?`${esc(nombre)} hizo`:'Hizo';
  if(!s.n) return `${nombre?esc(nombre)+': s':'S'}in servicios atendidos en el período.`;
  return `${sujeto} <b>${svHm(s.min)}</b> de servicio de ${esc(S.nom.toLowerCase())}, que incluye ${svLista(s.porServ.map(x=>`<b>${x.n}</b> ${esc(x.n===1?(svSrv(aid,x.k).u||svSrv(aid,x.k).s.toLowerCase()):svSrv(aid,x.k).p)}`.replace(/ inbody\b/i,' InBody')))}.`;
}
/* “Turno 25 h · ocupación 68% · tiempo muerto 8 h (3 h por citas que no llegaron y 5 h sin cita)” */
function svTurnoHTML(s){
  if(!s.turno) return `<span class="mut">${s.todas&&s.todas.length?'Sin turno para comparar: falta el horario de ese día.':'Sin registros para comparar con el turno.'}</span>`;
  return `Turno <b>${svHm(s.turno)}</b> · en servicio <b>${svHm(s.enTurno)}</b> · ocupación <b class="sv-u-${svUtilCls(s.util)}">${s.util}%</b> · tiempo muerto <b>${svHm(s.idle)}</b>${s.perdida?` (${svHm(s.perdida)} por citas que no llegaron y ${svHm(s.libre)} sin cita)`:''}`;
}
const svUtilEtiqueta = u => u==null?'':u>=SV_UTIL.ok?'justo':u>=SV_UTIL.warn?'revisar':'excesivo';

/* ---------- piezas de pantalla ---------- */
function svAviso(aid){
  return `<div class="sv-priv">${ic('shield')}<span>Solo se lleva el <b>control de la actividad</b>: nombre del socio, servicio y horario. No captures diagnósticos ni datos clínicos: el expediente lo lleva ${esc(servDe(aid).esp.toLowerCase())} por separado.</span></div>`;
}
const svTabs = aid => [['inicio','Resumen'],['profesores',pfNom(aid,1)]];
const servSwitch = () => '';
function svKpis(aid,s){
  const S=servDe(aid), a=S.servicios[0], b=S.servicios[1], ga=s.porServ.find(x=>x.k===a.s)||{n:0,min:0}, gb=s.porServ.find(x=>x.k===b.s)||{n:0,min:0};
  return `<div class="kpis an-kpis">
    ${kpi('Servicios atendidos',s.n.toLocaleString('es-MX'),s.dias?`en ${plu(s.dias,'día','días')} con registro`:'sin registros en el período',{color:'var(--b2)'})}
    ${kpi('Tiempo de servicio',svHm(s.min),s.minDia?`${svHm(s.minDia)} por día con registro`:'horas dedicadas',{color:'var(--b3)'})}
    ${kpi(svCap(a.p),ga.n,ga.n?svHm(ga.min):'sin registros',{color:'var(--b1)'})}
    ${kpi(svCap(b.p),gb.n,gb.n?svHm(gb.min):'sin registros',{color:'var(--b4)'})}
    ${kpi('Turno programado',s.turno?svHm(s.turno):'—',s.turno?'según el horario de cada uno':'falta capturar horarios',{color:'var(--b1)'})}
    ${kpi('Ocupación del turno',s.util==null?'—':s.util+'%',s.util==null?'necesita horario y registros':svUtilEtiqueta(s.util),{cls:svUtilCls(s.util),color:'var(--b2)'})}
    ${kpi('Tiempo muerto',s.turno?svHm(s.idle):'—',s.turno?(s.perdida?`${svHm(s.perdida)} por citas que no llegaron`:'sin citas caídas'):'',{cls:s.turno&&s.idle&&s.util<SV_UTIL.warn?'bad':'',color:'var(--warn)'})}
    ${kpi('Citas que no llegaron',s.noLlego,s.noLlego?`${s.noShow} no se presentaron · ${s.cancel} cancelaron`:'sin inasistencias',{cls:s.noLlego?'warn':'ok',color:'var(--bad)'})}
  </div>`;
}
function svPeriodoBar(){
  const {per,ref}=ui.sv, R=svRango(per,ref);
  return `<div class="sv-per no-print">
    <div class="chips">${[['dia','Día'],['semana','Semana'],['mes','Mes']].map(([k,l])=>`<button class="chip${per===k?' on':''}" data-act="svPer" data-p="${k}">${l}</button>`).join('')}</div>
    <div class="af-date"><button class="ibtn" data-act="svNav" data-n="-1" aria-label="Anterior">${ic('back')}</button><b>${esc(R.txt)}</b><button class="ibtn" data-act="svNav" data-n="1" aria-label="Siguiente">${ic('next')}</button><button class="btn sm" data-act="svRefHoy">Hoy</button></div></div>`;
}
function svLinea(d){                                     // barra del turno: verde = servicio, ámbar = cita que no llegó, gris = tiempo muerto
  if(!d||!d.win) return '';
  const [a,b]=d.win, W=b-a, pos=x=>((x-a)/W*100).toFixed(2);
  return `<div class="sv-tl"><div class="sv-tl-b">${d.blocks.map(k=>`<i class="${k.t}" style="left:${pos(k.a)}%;width:${((k.b-k.a)/W*100).toFixed(2)}%"></i>`).join('')}</div>
    <div class="sv-tl-e"><span>${svH12(a)}</span><span class="sv-tl-k"><i class="att"></i>servicio <i class="perd"></i>no llegó <i class="idle"></i>libre</span><span>${svH12(b)}</span></div></div>`;
}
function svTarjetasEsp(aid,R){
  const B=bitacora(aid), ref=ui.sv.ref, rd=svRango('dia',ref), rs=svRango('semana',ref), rm=svRango('mes',ref);
  const ids=new Set(profesores(aid).filter(p=>p.activo!==false).map(p=>p.id)); B.forEach(x=>{ if(x.f>=R.desde&&x.f<=R.hasta) ids.add(x.profId); });
  const L=[...ids].map(id=>({id,p:getProf(aid,id)})).sort((a,b)=>String((a.p||{}).nombre).localeCompare(String((b.p||{}).nombre),'es'));
  if(!L.length) return empty(`Todavía no hay ${esc(servDe(aid).espP.toLowerCase())} dados de alta.`);
  return L.map(({id,p})=>{
    const s=servStats(aid,R.desde,R.hasta,id,B), d=servStats(aid,rd.desde,rd.hasta,id,B).n, w=servStats(aid,rs.desde,rs.hasta,id,B).n, m=servStats(aid,rm.desde,rm.hasta,id,B).n;
    const filasServ=s.n?s.porServ.map(x=>`<tr><td>${esc(x.n===1?(svSrv(aid,x.k).u||svSrv(aid,x.k).s.toLowerCase()):svSrv(aid,x.k).p)}</td><td>${x.n}</td></tr>`).join(''):`<tr><td colspan="2" class="mut">Sin servicios atendidos en el período.</td></tr>`;
    const filasTurno=!s.turno?`<tr><td colspan="2" class="mut">${s.todas&&s.todas.length?'Sin turno para comparar: falta el horario de ese día.':'Sin registros para comparar con el turno.'}</td></tr>`
      :`<tr><td>Turno</td><td>${esc(svHm(s.turno))}</td></tr><tr><td>En servicio</td><td>${esc(svHm(s.enTurno))}</td></tr><tr><td>Ocupación</td><td class="sv-u-${svUtilCls(s.util)}">${s.util}%</td></tr><tr><td>Tiempo muerto</td><td>${esc(svHm(s.idle))}</td></tr>${s.perdida?`<tr><td colspan="2" class="mut sv-tbl-note">${esc(svHm(s.perdida))} por citas que no llegaron y ${esc(svHm(s.libre))} sin cita</td></tr>`:''}`;
    return `<div class="sv-esp"><div class="sv-esp-h"><b>${esc(p?p.nombre:'Especialista dado de baja')}</b><span class="sv-hm">${esc(svHm(s.min))}</span></div>
      ${p?`<div class="sv-hor-t">${esc(svHorarioTxt(p))}</div>`:''}
      <table class="sv-tbl"><tbody>
        ${filasServ}
        ${filasTurno}
        <tr><td>Hoy</td><td>${d}</td></tr><tr><td>Esta semana</td><td>${w}</td></tr><tr><td>Este mes</td><td>${m}</td></tr>
        ${s.rt.pct!=null?`<tr><td>Registrado en el momento</td><td>${s.rt.pct}%</td></tr>`:''}
      </tbody></table></div>`;
  }).join('');
}
function svDiaInfo(aid,f,B){
  B=B||bitacora(aid);
  const t=todayStr(), w=wdIdx(f), s=servStats(aid,f,f,'',B);
  let est;
  if(s.todas.length) est='hay';                         // hay algo agendado o registrado ese día, sea pasado, hoy o futuro
  else if(f>t) est='fut';
  else if(profesores(aid).some(p=>p.activo!==false&&spDias(p).includes(w)&&svPrimera(p.id,B)&&svPrimera(p.id,B)<=f)) est='sin';
  else est='off';
  return {f,est,n:s.n,min:s.min,util:s.util,noLlego:s.noLlego,agendadas:s.agendadas};
}
function svCalendario(aid){
  const par=esParamed(aid), mes=ui.sv.ref.slice(0,7), [y,m]=mes.split('-').map(Number), nd=new Date(y,m,0).getDate(), off=wdIdx(`${mes}-01`), t=todayStr(), B=bitacora(aid), cel=[];
  for(let i=0;i<off;i++) cel.push('<i class="sv-cal-x"></i>');
  for(let d=1; d<=nd; d++){
    const f=`${mes}-${String(d).padStart(2,'0')}`, di=svDiaInfo(aid,f,B), tot=di.n+di.agendadas, uCls=(!par&&di.est==='hay'&&di.util!=null)?' u-'+svUtilCls(di.util):'';
    const badge=di.est!=='hay'?'':(di.agendadas?`<small class="mut">${di.agendadas} pend.</small>`:(par?'':`<small>${di.util!=null?di.util+'%':svHmC(di.min)}</small>`));
    cel.push(`<button class="sv-cal-d ${di.est}${uCls}${f===t?' hoy':''}" data-act="svDia" data-f="${f}" aria-label="${esc(fmtLarga(f))}: ${plu(tot,'servicio','servicios')}"><span class="n">${d}</span><b>${tot||(di.est==='hay'?'0':'')}</b>${badge}</button>`);
  }
  return `<div class="sv-cal">
    <div class="sv-cal-h"><button class="ibtn" data-act="svMes" data-n="-1" aria-label="Mes anterior">${ic('back')}</button><b>${esc(svMesTxt(mes))}</b><button class="ibtn" data-act="svMes" data-n="1" aria-label="Mes siguiente">${ic('next')}</button></div>
    <div class="sv-cal-g">${DIAS.map(l=>`<span class="sv-cal-w">${l.slice(0,2)}</span>`).join('')}${cel.join('')}</div>
    <div class="sv-leg">${par?'<span><i class="hay"></i>día con citas agendadas</span>':`<span><i class="u-ok"></i>ocupación ≥ ${SV_UTIL.ok}% (justo)</span><span><i class="u-warn"></i>${SV_UTIL.warn}–${SV_UTIL.ok-1}% (revisar)</span><span><i class="u-bad"></i>&lt; ${SV_UTIL.warn}% (tiempo muerto excesivo)</span><span><i class="sin"></i>día de turno sin bitácora</span>`}</div>
    <div class="sub">${par?'Toca un día para ver las citas agendadas.':`El número grande son los servicios del día y abajo la ocupación del turno. Toca un día para ver lo que dio cada ${esc(servDe(aid).esp.toLowerCase())}.`}</div>
  </div>`;
}
function vServInicio(aid){
  const S=servDe(aid), nProf=profesores(aid).filter(p=>p.activo!==false).length;
  const sinH=profesores(aid).filter(p=>p.activo!==false&&!spDias(p).length);
  const medir=!esParamed(aid);                          // Gerencia no mide el servicio de Paramédicos: solo agendan citas a Fisioterapia
  return `<div class="sv">
    <div class="sub">${esc(fmtLarga(todayStr()))} · ${plu(nProf,S.esp.toLowerCase(),S.espP.toLowerCase())}</div>
    ${nProf?'':empty(`Da de alta a los ${esc(S.espP.toLowerCase())} en la pestaña “${esc(S.espP)}”, con su horario y su clave.`)}
    ${svPendientesBanner(aid)}
    ${medir&&sinH.length?`<div class="sv-warn">${ic('bolt')}<span>Falta el horario de ${esc(sinH.map(p=>p.nombre).join(', '))}: sin él no se puede medir el tiempo muerto.</span></div>`:''}
    <div class="h2">Calendario <small class="mut">toca un día para ver el detalle</small></div>
    ${svCalendario(aid)}
    ${medir?`<div class="btns no-print"><button class="btn" data-act="svVerTarjetas" data-aid="${esc(aid)}">Ver detalle por ${esc(S.esp.toLowerCase())}</button></div>`:''}
    ${(getArea(aid)||{}).tipo==='fisioterapia'?svBloqueosPanel(aid):''}
  </div>`;
}
/* ---------- descripción ligera de actividad por profesional (siempre visible bajo el calendario) ---------- */
function svPendientesBanner(aid){                        // aviso para Dirección y Gerencia: citas de Paramédicos aún sin resolver
  const P=bitacora(aid).filter(svPendiente); if(!P.length) return '';
  const prox=P.slice().sort((a,b)=>a.f.localeCompare(b.f)||(svMin(a.hi)||0)-(svMin(b.hi)||0))[0];
  return `<button class="sv-alert sv-alert-btn" data-act="svPendientesModal" data-aid="${esc(aid)}">${ic('bolt')}<span>${plu(P.length,'cita agendada por Paramédicos pendiente de confirmar','citas agendadas por Paramédicos pendientes de confirmar')}${prox?` · la más próxima: ${esc(fmtLarga(prox.f))} ${esc(svRangoTxt(svMin(prox.hi),svMin(prox.hf)))}`:''} · toca para ver el detalle</span></button>`;
}
function svPendientesModal(aid){
  const P=bitacora(aid).filter(svPendiente).sort((a,b)=>a.f.localeCompare(b.f)||(svMin(a.hi)||0)-(svMin(b.hi)||0));
  openModal(`${mHead('Citas pendientes por confirmar')}
    ${P.length?P.map(r=>{ const p=getProf(aid,r.profId); return `<div class="line"><div class="t">${ic('bolt')}</div><div class="b"><b>${esc(fmtLarga(r.f))} · ${esc(svRangoTxt(svMin(r.hi),svMin(r.hf)))}</b><small>${esc(r.paciente)} con ${esc(p?p.nombre:'—')}${r.motivo?' · '+esc(r.motivo):''}</small></div></div>`; }).join(''):empty('No hay citas pendientes.')}
    <div class="btns"><button class="btn" data-act="closeModal">Cerrar</button></div>`);
}
/* ---------- detalle (dashboard + tarjetas por especialista): solo se abre si hace falta ---------- */
function svPeriodoBarModal(aid){
  const {per,ref}=ui.sv, R=svRango(per,ref);
  return `<div class="sv-per no-print">
    <div class="chips">${[['dia','Día'],['semana','Semana'],['mes','Mes']].map(([k,l])=>`<button class="chip${per===k?' on':''}" data-act="svModalPer" data-aid="${esc(aid)}" data-p="${k}">${l}</button>`).join('')}</div>
    <div class="af-date"><button class="ibtn" data-act="svModalNav" data-aid="${esc(aid)}" data-n="-1" aria-label="Anterior">${ic('back')}</button><b>${esc(R.txt)}</b><button class="ibtn" data-act="svModalNav" data-aid="${esc(aid)}" data-n="1" aria-label="Siguiente">${ic('next')}</button><button class="btn sm" data-act="svModalHoy" data-aid="${esc(aid)}">Hoy</button></div></div>`;
}
function svParamedRankTxt(aid,s){
  if((getArea(aid)||{}).tipo!=='fisioterapia') return '';
  const parAid=areasList().find(a=>a.tipo==='paramedico'); if(!parAid) return '';
  const regs=s.todas.filter(x=>x.origen===parAid.id); if(!regs.length) return '';
  const porFisio={}; regs.forEach(x=>{ porFisio[x.profId]=(porFisio[x.profId]||0)+1; });
  const rank=Object.entries(porFisio).sort((a,b)=>b[1]-a[1]).map(([id,n])=>`${esc((getProf(aid,id)||{}).nombre||'—')} (${n})`);
  return `<div class="sub">Citas de Paramédicos por ${esc(servDe(aid).esp.toLowerCase())}: ${rank.join(' · ')}</div>`;
}
function svDetalleModal(aid){
  const {per,ref}=ui.sv, R=svRango(per,ref), s=servStats(aid,R.desde,R.hasta);
  openModal(`${mHead('Detalle por '+servDe(aid).esp.toLowerCase())}
    ${svPeriodoBarModal(aid)}
    ${svKpis(aid,s)}
    ${svParamedRankTxt(aid,s)}
    <div class="h2 sm">Por ${esc(servDe(aid).esp.toLowerCase())} <small class="mut">${esc(R.txt)}</small></div>
    ${svTarjetasEsp(aid,R)}
    <div class="btns"><button class="btn" data-act="closeModal">Cerrar</button><button class="btn primary no-print" data-act="svPrintReporte">Imprimir reporte</button></div>`);
}

/* ---------- Gerencia: horarios reservados para atención a personal (bloqueo con motivo, solo Gerencia edita) ---------- */
const svBloqueos = aid => coll(aid,'bloqueos');
const svBloqueoTxt = b => `${(b.dias||[]).map(i=>DIAS[i]).join(', ')||'—'} ${svRangoTxt(svMin(b.hi),svMin(b.hf))}`;
function svBloqueoActivo(aid,profId,fecha,hi,hf){         // ¿ese horario está reservado para empleados? (para avisar, no para impedir)
  if(hi==null||hf==null||!fecha) return null;
  const w=wdIdx(fecha);
  return svBloqueos(aid).find(b=>(b.dias||[]).includes(w)&&(!b.profId||b.profId===profId)&&svMin(b.hi)!=null&&svMin(b.hf)!=null&&svMin(b.hi)<hf&&hi<svMin(b.hf))||null;
}
function svBloqueosPanel(aid){
  if(session.rol!=='ger') return '';
  const bs=svBloqueos(aid);
  return `<div class="h2">Horarios reservados para personal <button class="btn sm primary" data-act="openBloqueo" data-aid="${esc(aid)}">+ Reservar horario</button></div>
    <div class="sub">Bloques de horario reservados para atender empleados del club, con su motivo. Solo Gerencia los edita.</div>
    ${bs.length?bs.map(b=>`<button class="line" data-act="openBloqueo" data-aid="${esc(aid)}" data-id="${esc(b.id)}"><div class="t">${ic('bolt')}</div><div class="b"><b>${esc(svBloqueoTxt(b))}</b><small>${esc(b.motivo||'Sin motivo anotado')} · ${b.profId?esc((getProf(aid,b.profId)||{}).nombre||'—'):'Todos'}</small></div></button>`).join(''):empty('Todavía no hay horarios reservados.')}`;
}
function openBloqueoModal(aid,id){
  const b=id?(getPath(`data/${aid}/bloqueos/${id}`)||{}):{}, ps=profesores(aid).filter(p=>p.activo!==false);
  openModal(`${mHead(id?'Editar horario reservado':'Reservar horario para personal')}
    <label class="f"><span>${esc(servDe(aid).esp)} (opcional)</span><select id="bl_prof"><option value="">Todos</option>${ps.map(p=>`<option value="${esc(p.id)}"${p.id===b.profId?' selected':''}>${esc(p.nombre)}</option>`).join('')}</select></label>
    <div class="f"><span class="lb">Días</span><div class="sv-dias">${DIAS.map((l,i)=>`<label class="sv-d"><input type="checkbox" class="bl_dia" value="${i}"${(b.dias||[]).includes(i)?' checked':''}><span>${l}</span></label>`).join('')}</div></div>
    <div class="two">
      <label class="f"><span>Hora de inicio</span><input id="bl_hi" type="time" step="300" value="${esc(b.hi||'16:00')}"></label>
      <label class="f"><span>Hora de fin</span><input id="bl_hf" type="time" step="300" value="${esc(b.hf||'18:00')}"></label></div>
    <label class="f"><span>Motivo</span><input id="bl_mot" value="${esc(b.motivo||'')}" placeholder="Ej. atención a empleados del club"></label>
    <div class="btns"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="saveBloqueo" data-aid="${esc(aid)}" data-id="${esc(id||'')}">Guardar</button></div>
    ${id?`<div class="btns"><button class="btn danger" data-act="delBloqueo" data-aid="${esc(aid)}" data-id="${esc(id)}">Desbloquear (eliminar)</button></div>`:''}`);
}

/* ---------- un renglón de la bitácora ---------- */
function svLineaReg(aid,r,i,edit){
  const ok=svAtendido(r), pend=svPendiente(r), iv=svIv(r), rt=svRetraso(r), tag=edit?'button':'div';
  const hora=iv?svRangoTxt(iv[0],iv[1]):svHm(r.min), tarde=(rt!=null&&rt>60)?`<span class="sv-late">capturado ${esc(svHm(rt))} después</span>`:'';
  return `<${tag} class="line sv-l${ok?'':pend?' sv-pend':' sv-no'}"${edit?` data-act="svReg" data-id="${esc(r.id)}" style="--ac:${areaColor(aid)}"`:''}><div class="t">${i+1}</div><div class="b"><b>${esc(r.paciente)}</b>
    <small>${ok?'':`<span class="sv-tag${pend?' sv-tag-pend':''}">${esc(SV_ESTADO[r.estado]||'No llegó')}</span> `}${esc(hora)} · ${esc(r.servicio||'')}${(ok||pend)?' · '+esc(svOrigenTxt(r.origen)):''}${pend&&r.motivo?' · '+esc(r.motivo):''}</small>
    ${r.ts?`<small class="mut">Registrado a las ${esc(svHoraTs(r.ts))} ${tarde}</small>`:''}</div></${tag}>`;
}

/* ---------- detalle de un día: un tarjetón por especialista ---------- */
function svDiaModal(f){
  const aid=curArea(), B=bitacora(aid), regs=B.filter(x=>x.f===f);
  const ids=new Set(profesores(aid).filter(p=>p.activo!==false).map(p=>p.id)); regs.forEach(x=>ids.add(x.profId));
  const filas=[...ids].map(id=>({id,p:getProf(aid,id),regs:regs.filter(x=>x.profId===id).sort((a,b)=>(svMin(a.hi)||0)-(svMin(b.hi)||0)||(a.ts||0)-(b.ts||0))})).filter(x=>x.p||x.regs.length)
    .sort((a,b)=>String((a.p||{}).nombre).localeCompare(String((b.p||{}).nombre),'es'));
  const tot=servStats(aid,f,f,'',B);
  const cards=filas.map(x=>{
    const s=servStats(aid,f,f,x.id,B), d=svDiaProf(aid,x.p,f,x.regs), twTxt=svTurnoDiaTxt(x.p,f);
    return `<div class="sv-card"><div class="sv-esp-h"><b>${esc(x.p?x.p.nombre:'Especialista dado de baja')}</b><span class="sv-hm">${esc(svHm(s.min))}</span></div>
      <div class="sv-hor-t">${twTxt?`Turno ${esc(twTxt)}`:(x.p&&spDias(x.p).length?'Ese día no tenía turno':'Sin horario')}</div>
      <div class="sv-esp-t">${svFrase(aid,s)}</div>
      ${x.regs.length||d.win?`<div class="sv-esp-t">${svTurnoHTML(s)}</div>${svLinea(d)}`:''}
      ${x.regs.map((r,i)=>svLineaReg(aid,r,i,false)).join('')||'<div class="sub">Sin registros este día.</div>'}</div>`;
  }).join('');
  openModal(`${mHead(esc(fmtLarga(f)))}
    ${regs.length?`<div class="sub">${plu(tot.n,'servicio atendido','servicios atendidos')} · ${esc(svHm(tot.min))}${tot.noLlego?` · ${plu(tot.noLlego,'cita que no llegó','citas que no llegaron')}`:''}</div>`:''}
    ${cards||empty('Todavía no hay especialistas dados de alta.')}
    <div class="btns"><button class="btn" data-act="closeModal">Cerrar</button></div>`);
}

/* ---------- pantalla del especialista ---------- */
function vServProf(){
  const aid=session.area, pid=session.profId, S=servDe(aid), f=ui.pFecha, t=todayStr(), hoy=f===t, B=bitacora(aid), p=getProf(aid,pid)||{};
  const L=B.filter(x=>x.f===f&&x.profId===pid).sort((a,b)=>(svMin(a.hi)||0)-(svMin(b.hi)||0)||(a.ts||0)-(b.ts||0));
  const d=servStats(aid,f,f,pid,B), rs=svRango('semana',f), w=servStats(aid,rs.desde,rs.hasta,pid,B), rm=svRango('mes',f), m=servStats(aid,rm.desde,rm.hasta,pid,B);
  const twTxt=svTurnoDiaTxt(p,f), dp=svDiaProf(aid,p,f,L), pendHoy=L.filter(svPendiente);
  return `<div class="sv">
    <div class="sub">${hoy?(esParamed(aid)?'Agenda las citas de empleados a Fisioterapia con su hora de inicio y de fin.':'Registra cada servicio con su hora de inicio y de fin. Tu agenda la llevas por separado.'):'Estás viendo otro día.'}</div>
    ${pendHoy.length?`<div class="sv-alert">${ic('bolt')}<span>${plu(pendHoy.length,'cita agendada por Paramédicos pendiente de confirmar','citas agendadas por Paramédicos pendientes de confirmar')} este día: marca si se presentó, si no llegó o si canceló.</span></div>`:''}
    <div class="af-date">
      <button class="ibtn" data-act="svPNav" data-n="-1" aria-label="Día anterior">${ic('back')}</button>
      <b>${esc(fmtLarga(f))}</b>
      <button class="ibtn" data-act="svPNav" data-n="1" aria-label="Día siguiente"${f>=t?' disabled':''}>${ic('next')}</button>
      <button class="btn sm" data-act="svPHoy">Hoy</button></div>
    <div class="sv-hor-t">${twTxt?`Tu turno: <b>${esc(twTxt)}</b>`:(spDias(p).length?'Este día no tienes turno.':'Todavía no tienes horario capturado.')}</div>
    <div class="kpis k3">${kpi('El día',d.n,svHm(d.min),{color:'var(--b2)'})}${kpi('La semana',w.n,svHm(w.min),{color:'var(--b3)'})}${kpi('El mes',m.n,svHm(m.min),{color:'var(--b1)'})}</div>
    <div class="btns"><button class="btn primary block" data-act="svReg">+ ${esParamed(aid)?'Agendar cita a Fisioterapia':'Registrar servicio'}</button></div>
    ${dp.win?`<div class="sv-esp-t">${svTurnoHTML(d)}</div>${svLinea(dp)}`:''}
    <div class="h2">${esParamed(aid)?'Citas agendadas hoy':'Mi bitácora del día'}</div>
    ${L.length?L.map((r,i)=>svLineaReg(aid,r,i,true)).join(''):empty(esParamed(aid)?'Todavía no agendas citas este día.':'Todavía no registras servicios este día.')}
    ${svAviso(aid)}
  </div>`;
}
function svOrigenOpts(aid,sel){
  const o=[['propia','No, sin canalización'],['medico','Médico externo'],...areasList().filter(a=>a.id!==aid&&!SERV[a.tipo]).map(a=>[a.id,'Canalizado desde '+a.nombre])];
  return o.map(([v,l])=>`<option value="${esc(v)}"${v===sel?' selected':''}>${esc(l)}</option>`).join('');
}
function openReg(id){
  const aid=session.area, pid=session.profId, S=servDe(aid), f=ui.pFecha, p=getProf(aid,pid)||{}, mis=bitacora(aid).filter(x=>x.profId===pid);
  const r=id?(getPath(`data/${aid}/bitacora/${id}`)||{}):{}, fecha=r.f||f, dia=mis.filter(x=>x.f===fecha&&x.id!==id);
  const locked=r.creadoPor==='paramedico', dis=locked?' disabled':'';
  const srv=r.servicio||S.servicios[0].s, durSug=svSrv(aid,srv).min;
  let hi=r.hi, hf=r.hf;
  if(!hi){                                              // sugerencia: empieza donde terminó el servicio anterior (o al inicio del turno)
    const ult=dia.map(x=>svMin(x.hf)).filter(x=>x!=null).sort((a,b)=>b-a)[0], tw=svTurnoDia(p,fecha);
    hi=svHHMM(ult!=null?ult:(tw?tw[0]:9*60)); hf=svHHMM(svMin(hi)+durSug);
  }
  const est=(!r.estado||r.estado==='agendada')?'atendido':r.estado, nombres=[...new Set(mis.map(x=>x.paciente))].sort((a,b)=>a.localeCompare(b,'es')).slice(0,400);
  const num=id?mis.filter(x=>x.f===fecha).sort((a,b)=>(svMin(a.hi)||0)-(svMin(b.hi)||0)).findIndex(x=>x.id===id)+1:dia.length+1;
  const parNom=locked?esc((getArea(r.origen)||{}).nombre||'Paramédicos'):'';
  openModal(`${mHead(id?'Editar registro':'Nuevo registro')}
    <div class="sub">${esc(fmtLarga(fecha))} · <b>Servicio ${num}</b>${locked?` · <span class="sv-tag sv-tag-pend">Agendada por ${parNom}</span>`:''}</div>
    <label class="f"><span>Nombre del ${esParamed(aid)?'empleado':'socio'}</span><input id="rg_nom" list="rg_dl" value="${esc(r.paciente)}" autocomplete="off" autocapitalize="words" placeholder="Nombre y apellido"${dis}><datalist id="rg_dl">${nombres.map(n=>`<option value="${esc(n)}">`).join('')}</datalist></label>
    <label class="f"><span>¿Qué pasó con la cita?</span><select id="rg_est">${Object.keys(SV_ESTADO).filter(k=>k!=='agendada').map(k=>`<option value="${k}"${k===est?' selected':''}>${SV_ESTADO[k]}</option>`).join('')}</select></label>
    <label class="f"><span>Servicio</span><select id="rg_srv"${dis}>${(S.servicios.some(x=>x.s===srv)?S.servicios:[...S.servicios,{s:srv}]).map(x=>`<option value="${esc(x.s)}"${x.s===srv?' selected':''}>${esc(x.s)}</option>`).join('')}</select></label>
    ${locked&&r.motivo?`<label class="f"><span>Motivo</span><input value="${esc(r.motivo)}" disabled></label>`:''}
    <div class="two">
      <label class="f"><span id="rg_hi_l">Hora de inicio</span><input id="rg_hi" type="time" step="300" value="${esc(hi)}"${dis}></label>
      <label class="f"><span id="rg_hf_l">Hora de fin</span><input id="rg_hf" type="time" step="300" value="${esc(hf)}" data-dur="${svMin(hf)-svMin(hi)}"></label></div>
    <input type="hidden" id="rg_meta" data-fecha="${esc(fecha)}" data-aid="${esc(aid)}" data-pid="${esc(pid)}" data-locked="${locked?'1':''}">
    <div id="rg_bloqueo_note"></div>
    <div class="sv-dur"><span id="rg_dur"></span>${fecha===todayStr()?`<button type="button" class="btn sm" data-act="svAhora">Terminé ahora</button>`:''}</div>
    <label class="f" id="rg_ori_w"><span>¿Lo canalizó alguna área?</span>${locked?`<input value="${parNom}" disabled><input type="hidden" id="rg_ori" value="${esc(r.origen)}">`:`<select id="rg_ori">${svOrigenOpts(aid,r.origen||'propia')}</select>`}</label>
    ${svAviso(aid)}
    <div class="btns"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="saveReg" data-id="${esc(id||'')}">Guardar</button></div>
    ${id?`<div class="btns"><button class="btn danger" data-act="delReg" data-id="${esc(id)}">Eliminar registro</button></div>`:`<div class="btns"><button class="btn" data-act="saveReg" data-id="" data-otra="1">Guardar y registrar otro</button></div>`}`);
  svRegRefresh();
  setTimeout(()=>{ const i=$('#rg_nom'); if(i&&!id&&!locked) i.focus(); },60);
}
function svRegRefresh(){                                 // duración calculada y campos según el estado de la cita
  const hi=svMin(($('#rg_hi')||{}).value), hf=svMin(($('#rg_hf')||{}).value), out=$('#rg_dur'), est=($('#rg_est')||{}).value;
  if(out) out.innerHTML=(hi!=null&&hf!=null&&hf>hi)?`Duración: <b>${svHm(hf-hi)}</b>`:'<span class="sv-late">La hora de fin debe ser después de la de inicio</span>';
  const w=$('#rg_ori_w'); if(w) w.style.display=est==='atendido'?'':'none';
  const a=$('#rg_hi_l'), b=$('#rg_hf_l'); if(a) a.textContent=est==='atendido'?'Hora de inicio':'Hora de inicio de la cita'; if(b) b.textContent=est==='atendido'?'Hora de fin':'Hora de fin de la cita';
  const bn=$('#rg_bloqueo_note'), meta=$('#rg_meta');
  if(bn){
    bn.innerHTML='';
    if(meta&&!meta.dataset.locked&&(getArea(meta.dataset.aid)||{}).tipo==='fisioterapia'&&hi!=null&&hf!=null){
      const bl=svBloqueoActivo(meta.dataset.aid,meta.dataset.pid,meta.dataset.fecha,hi,hf);
      if(bl) bn.innerHTML=`<div class="sv-alert">${ic('bolt')}<span>Este horario está reservado solo para empleados (${esc(svBloqueoTxt(bl))})${bl.motivo?': '+esc(bl.motivo):''}.</span></div>`;
    }
  }
}
document.addEventListener('change',e=>{
  const id=e.target.id;
  if(id==='rg_srv'){ const hf=$('#rg_hf'), hi=svMin($('#rg_hi').value); if(hf&&!hf.dataset.manual&&hi!=null){ const d=svSrv(session.area,e.target.value).min; hf.value=svHHMM(hi+d); hf.dataset.dur=d; } svRegRefresh(); }
  else if(id==='rg_est'||id==='rg_hi'||id==='rg_hf') svRegRefresh();
});
document.addEventListener('input',e=>{
  const id=e.target.id, hf=$('#rg_hf'), hi=$('#rg_hi');
  if(id==='rg_hf'){ e.target.dataset.manual='1'; const a=svMin(hi.value), b=svMin(e.target.value); if(a!=null&&b!=null&&b>a) e.target.dataset.dur=b-a; svRegRefresh(); }
  else if(id==='rg_hi'&&hf&&!hf.dataset.manual){ const a=svMin(e.target.value), d=+hf.dataset.dur||30; if(a!=null) hf.value=svHHMM(a+d); svRegRefresh(); }
  else if(id==='rg_hi') svRegRefresh();
});
const svFechaHora = (f,hhmm) => new Date(`${f}T${hhmm}:00`).getTime();

/* ---------- Paramédicos: agendar una cita de empleado a Fisioterapia (bloquea el horario del fisioterapeuta) ---------- */
function ctFisiosDisponibles(fisioAid,fecha,hi,hf){        // solo los fisioterapeutas que están en turno ese horario (si ninguno calza, se muestran todos)
  const all=profesores(fisioAid).filter(p=>p.activo!==false);
  if(!fecha||hi==null||hf==null) return {list:all,filtrado:false};
  const dispo=all.filter(p=>svTurnosDia(p,fecha).some(w=>w[0]<=hi&&hf<=w[1]));
  return dispo.length?{list:dispo,filtrado:true}:{list:all,filtrado:false};
}
function ctFisOptsHTML(fisioAid,fecha,hi,hf,sel){
  const {list,filtrado}=ctFisiosDisponibles(fisioAid,fecha,hi,hf);
  const opts=list.map(p=>`<option value="${esc(p.id)}"${p.id===sel?' selected':''}>${esc(p.nombre)}</option>`).join('');
  return {html:opts,filtrado,ids:new Set(list.map(p=>p.id))};
}
function ctFisRefresh(){
  const fisioAid=fisioAreaId(), sel=$('#ct_fis'); if(!sel) return;
  const fecha=$('#ct_f').value, hi=svMin($('#ct_hi').value), hf=svMin($('#ct_hf').value);
  const cur=sel.value, {html,filtrado,ids}=ctFisOptsHTML(fisioAid,fecha,hi,hf,cur);
  sel.innerHTML=html; if(ids.has(cur)) sel.value=cur;
  const note=$('#ct_fis_note'); if(note) note.textContent=filtrado?'Solo se muestran los que tienen turno en ese horario.':'Ninguno tiene turno justo en ese horario; se muestran todos.';
}
function openCita(id){
  const paramAid=session.area, pid=session.profId, fisioAid=fisioAreaId();
  if(!fisioAid){ toast('Todavía no existe el área de Fisioterapia'); return; }
  const own=id?(getPath(`data/${paramAid}/bitacora/${id}`)||{}):{};
  const citaId=own.citaId||'', cita=citaId?(getPath(`data/${fisioAid}/bitacora/${citaId}`)||null):null;
  if(id&&cita&&!svPendiente(cita)){                     // fisioterapia ya la resolvió: ya no se edita desde aquí
    openModal(`${mHead('Cita ya atendida')}
      <div class="sub">${esc(fmtLarga(own.f))} · ${esc((getProf(fisioAid,own.fisioId)||{}).nombre||'')}</div>
      <p><b>${esc(own.paciente)}</b><br><small class="mut">${esc(svRangoTxt(svMin(own.hi),svMin(own.hf)))}</small></p>
      <p>Fisioterapia ya registró el resultado: <b>${esc(SV_ESTADO[cita.estado]||SV_ESTADO.atendido)}</b>. Esta cita ya no se puede editar desde Paramédicos.</p>
      <div class="btns"><button class="btn" data-act="closeModal">Cerrar</button></div>`);
    return;
  }
  const todosFisios=profesores(fisioAid).filter(p=>p.activo!==false);
  if(!todosFisios.length){ toast('Todavía no hay fisioterapeutas dados de alta en Fisioterapia'); return; }
  const f=own.f||ui.pFecha, fisioId=own.fisioId||todosFisios[0].id, hi=own.hi||'16:00', hf=own.hf||'16:45';
  const mis=bitacora(paramAid).filter(x=>x.profId===pid), nombres=[...new Set(mis.map(x=>x.paciente))].sort((a,b)=>a.localeCompare(b,'es')).slice(0,400);
  const {html:fisOpts,filtrado}=ctFisOptsHTML(fisioAid,f,svMin(hi),svMin(hf),fisioId);
  openModal(`${mHead(id?'Editar cita':'Agendar cita a Fisioterapia')}
    <label class="f"><span>Nombre del empleado</span><input id="ct_emp" list="ct_dl" value="${esc(own.paciente||'')}" autocomplete="off" autocapitalize="words" placeholder="Nombre y apellido"><datalist id="ct_dl">${nombres.map(n=>`<option value="${esc(n)}">`).join('')}</datalist></label>
    <label class="f"><span>Fecha</span><input id="ct_f" type="date" value="${esc(f)}" min="${esc(todayStr())}"></label>
    <div class="two">
      <label class="f"><span>Hora de inicio</span><input id="ct_hi" type="time" step="300" value="${esc(hi)}"></label>
      <label class="f"><span>Hora de fin</span><input id="ct_hf" type="time" step="300" value="${esc(hf)}"></label></div>
    <label class="f"><span>Fisioterapeuta</span><select id="ct_fis">${fisOpts}</select><small id="ct_fis_note" class="mut">${filtrado?'Solo se muestran los que tienen turno en ese horario.':'Ninguno tiene turno justo en ese horario; se muestran todos.'}</small></label>
    <label class="f"><span>Motivo</span><input id="ct_mot" value="${esc(own.motivo||'')}" placeholder="Ej. lesión en el trabajo, canalización médica"></label>
    <div class="sub">En cuanto agendes, ese horario queda bloqueado en la agenda del fisioterapeuta y le aparece como pendiente por confirmar.</div>
    <div class="btns"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="guardarCita" data-id="${esc(id||'')}" data-citaid="${esc(citaId||'')}">${id?'Guardar cambios':'Agendar cita'}</button></div>
    ${id?`<div class="btns"><button class="btn danger" data-act="cancelarCita" data-id="${esc(id)}" data-citaid="${esc(citaId||'')}">Cancelar cita</button></div>`:''}`);
  setTimeout(()=>{ const i=$('#ct_emp'); if(i&&!id) i.focus(); },60);
}
document.addEventListener('change',e=>{ if(['ct_f','ct_hi','ct_hf'].includes(e.target.id)) ctFisRefresh(); });

/* ---------- impresión: reporte del período ---------- */
function svReporteDoc(aid,R){
  const S=servDe(aid), B=bitacora(aid), s=servStats(aid,R.desde,R.hasta,'',B);
  const ids=new Set(profesores(aid).filter(p=>p.activo!==false).map(p=>p.id)); s.todas.forEach(x=>ids.add(x.profId));
  const L=[...ids].map(id=>({id,p:getProf(aid,id)})).sort((a,b)=>String((a.p||{}).nombre).localeCompare(String((b.p||{}).nombre),'es'));
  const bloques=L.map(({id,p})=>{
    const e=servStats(aid,R.desde,R.hasta,id,B), nom=p?p.nombre:'Especialista dado de baja';
    return `<div class="sv-rp"><div class="h2 sm">${esc(nom)}${p?` <small class="mut">${esc(svHorarioTxt(p))}</small>`:''}</div><p>${svFrase(aid,e,nom)}</p><p>${svTurnoHTML(e)}</p>
      ${e.rt.pct!=null?`<p>Registro en el momento (a los ${SV_TIEMPO_REAL} min o menos de terminar): <b>${e.rt.pct}%</b>${e.rt.prom?`; retraso promedio de captura ${esc(svHm(e.rt.prom))}`:''}.</p>`:''}
      ${e.n?`<table class="doc-tabla"><thead><tr><th>Servicio</th><th>Cantidad</th><th>Tiempo</th></tr></thead><tbody>${e.porServ.map(x=>`<tr><td>${esc(x.k)}</td><td>${x.n}</td><td>${esc(svHm(x.min))}</td></tr>`).join('')}<tr><td><b>Total</b></td><td><b>${e.n}</b></td><td><b>${esc(svHm(e.min))}</b></td></tr></tbody></table>`:''}</div>`;
  }).join('');
  const dias=[]; for(let f=R.desde; f<=R.hasta&&f<=todayStr(); f=addDays(f,1)){ L.forEach(({id,p})=>{ const e=servStats(aid,f,f,id,B); if(e.todas.length) dias.push({f,p,e}); }); }
  const det=s.todas.slice().sort((a,b)=>a.f.localeCompare(b.f)||(svMin(a.hi)||0)-(svMin(b.hi)||0));
  return `${svKpis(aid,s)}${bloques||empty('Sin especialistas.')}
    ${R.desde!==R.hasta&&dias.length?`<div class="h2 sm">Resumen por día</div><table class="doc-tabla"><thead><tr><th>Fecha</th><th>${esc(S.esp)}</th><th>Turno</th><th>Servicios</th><th>En servicio</th><th>Ocupación</th><th>Tiempo muerto</th><th>No llegaron</th></tr></thead><tbody>
    ${dias.map(({f,p,e})=>`<tr><td>${esc(fmtFecha(f))}</td><td>${esc(p?p.nombre:'—')}</td><td>${e.turno?esc(svHm(e.turno)):'—'}</td><td>${e.n}</td><td>${esc(svHm(e.min))}</td><td class="${svUtilCls(e.util)}">${e.util==null?'—':e.util+'%'}</td><td>${e.turno?esc(svHm(e.idle)):'—'}</td><td>${e.noLlego}</td></tr>`).join('')}</tbody></table>`:''}
    ${det.length?`<div class="h2 sm">Detalle de registros</div><table class="doc-tabla"><thead><tr><th>Fecha</th><th>${esc(S.esp)}</th><th>Horario</th><th>Socio</th><th>Servicio</th><th>Estado</th><th>Registrado</th></tr></thead><tbody>
    ${det.map(x=>{ const iv=svIv(x), p=getProf(aid,x.profId); return `<tr><td>${esc(fmtFecha(x.f))}</td><td>${esc(p?p.nombre:'—')}</td><td>${iv?esc(svRangoTxt(iv[0],iv[1])):esc(svHm(x.min))}</td><td>${esc(x.paciente)}</td><td>${esc(x.servicio||'')}</td><td>${esc(SV_ESTADO[x.estado]||SV_ESTADO.atendido)}</td><td>${x.ts?esc(svHoraTs(x.ts)):'—'}</td></tr>`; }).join('')}</tbody></table>`:''}
    <div class="doc-firmas"><div>${esc(S.esp)}</div><div>Dirección del área</div></div>`;
}

/* ---------- acciones ---------- */
Object.assign(actions,{
  svPer(d){ ui.sv.per=d.p; render(); },
  svNav(d){
    const n=+d.n, {per,ref}=ui.sv;
    ui.sv.ref = per==='dia' ? addDays(ref,n) : per==='semana' ? addDays(ref,7*n) : (()=>{ const m=svMesMas(ref.slice(0,7),n); return m===todayStr().slice(0,7)?todayStr():m+'-01'; })();
    render();
  },
  svRefHoy(){ ui.sv.ref=todayStr(); render(); },
  svMes(d){ const m=svMesMas(ui.sv.ref.slice(0,7),+d.n); ui.sv.ref=m===todayStr().slice(0,7)?todayStr():m+'-01'; render(); },
  svDia(d){ svDiaModal(d.f); },
  svVerTarjetas(d){ svDetalleModal(d.aid); },
  svPendientesModal(d){ svPendientesModal(d.aid); },
  svModalPer(d){ ui.sv.per=d.p; svDetalleModal(d.aid); },
  svModalNav(d){
    const n=+d.n, {per,ref}=ui.sv;
    ui.sv.ref = per==='dia' ? addDays(ref,n) : per==='semana' ? addDays(ref,7*n) : (()=>{ const m=svMesMas(ref.slice(0,7),n); return m===todayStr().slice(0,7)?todayStr():m+'-01'; })();
    svDetalleModal(d.aid);
  },
  svModalHoy(d){ ui.sv.ref=todayStr(); svDetalleModal(d.aid); },
  svPNav(d){ const n=addDays(ui.pFecha,+d.n); if(n>todayStr()) return; ui.pFecha=n; render(); },
  svPHoy(){ ui.pFecha=todayStr(); render(); },
  svReg(d){
    const aid=session.area;
    if(roDatos(aid)) return;
    if(esParamed(aid)){ openCita(d.id||''); return; }
    openReg(d.id||'');
  },
  guardarCita(d){
    const paramAid=session.area, pid=session.profId, fisioAid=fisioAreaId();
    const fisioId=$('#ct_fis').value, emp=($('#ct_emp').value||'').trim().replace(/\s+/g,' '), fecha=$('#ct_f').value;
    const hi=svMin($('#ct_hi').value), hf=svMin($('#ct_hf').value), motivo=($('#ct_mot').value||'').trim();
    if(!emp){ toast('Escribe el nombre del empleado'); return; }
    if(!fecha){ toast('Elige la fecha'); return; }
    if(hi==null||hf==null){ toast('Anota la hora de inicio y la de fin'); return; }
    if(hf<=hi){ toast('La hora de fin debe ser después de la de inicio'); return; }
    if(hf-hi>240){ toast('Una cita no puede durar más de 4 horas'); return; }
    const citaId=d.citaid||('b'+uid());
    const choque=bitacora(fisioAid).find(x=>x.profId===fisioId&&x.f===fecha&&x.id!==citaId&&x.estado!=='no_asistio'&&x.estado!=='cancelo'&&svIv(x)&&hi<svIv(x)[1]&&svIv(x)[0]<hf);
    if(choque){ toast(`Ese horario ya está ocupado (${choque.paciente} ${svRangoTxt(svIv(choque)[0],svIv(choque)[1])}). Elige otra hora.`); return; }
    setPath(`data/${fisioAid}/bitacora/${citaId}`,{id:citaId,f:fecha,profId:fisioId,paciente:emp,servicio:'Cita de empleado',estado:'agendada',hi:svHHMM(hi),hf:svHHMM(hf),min:hf-hi,origen:paramAid,motivo,creadoPor:'paramedico',paramProfId:pid,ts:Date.now()});
    const ownId=d.id||('b'+uid());
    setPath(`data/${paramAid}/bitacora/${ownId}`,{id:ownId,f:fecha,profId:pid,paciente:emp,servicio:'Cita a Fisioterapia',estado:'atendido',hi:svHHMM(hi),hf:svHHMM(hf),min:hf-hi,origen:'propia',motivo,citaId,fisioAid,fisioId,ts:Date.now()});
    closeModal(); render(); toast(d.id?'Cita actualizada':'Cita agendada');
  },
  cancelarCita(d){
    if(!confirm('¿Cancelar esta cita? El horario del fisioterapeuta queda libre.')) return;
    const paramAid=session.area, fisioAid=fisioAreaId();
    if(d.citaid) setPath(`data/${fisioAid}/bitacora/${d.citaid}/estado`,'cancelo');
    setPath(`data/${paramAid}/bitacora/${d.id}`,undefined);
    closeModal(); render(); toast('Cita cancelada');
  },
  openBloqueo(d){ if(session.rol!=='ger') return; openBloqueoModal(d.aid,d.id||''); },
  saveBloqueo(d){
    if(session.rol!=='ger') return;
    const dias=[...document.querySelectorAll('.bl_dia')].filter(c=>c.checked).map(c=>+c.value);
    const hi=$('#bl_hi').value, hf=$('#bl_hf').value, motivo=($('#bl_mot').value||'').trim(), profId=$('#bl_prof').value;
    if(!dias.length){ toast('Marca al menos un día'); return; }
    if(svMin(hi)==null||svMin(hf)==null||svMin(hf)<=svMin(hi)){ toast('La hora de fin debe ser después de la de inicio'); return; }
    const id=d.id||('bl'+uid());
    setPath(`data/${d.aid}/bloqueos/${id}`,{id,profId,dias,hi,hf,motivo});
    closeModal(); render(); toast('Horario reservado guardado');
  },
  delBloqueo(d){
    if(session.rol!=='ger') return;
    if(!confirm('¿Quitar este horario reservado?')) return;
    setPath(`data/${d.aid}/bloqueos/${d.id}`,undefined); closeModal(); render(); toast('Horario liberado');
  },
  svAhora(){                                             // “Terminé ahora”: la hora de fin es la actual (redondeada a 5 min)
    const n=new Date(), m=n.getHours()*60+n.getMinutes(), fin=m-(m%5), hf=$('#rg_hf'), hi=$('#rg_hi'); if(!hf||!hi) return;
    hf.value=svHHMM(fin); hf.dataset.manual='1';
    if(!hi.dataset.manual){ const d=+hf.dataset.dur||30; hi.value=svHHMM(Math.max(0,fin-d)); }
    const a=svMin(hi.value); if(a!=null&&fin>a) hf.dataset.dur=fin-a;
    svRegRefresh();
  },
  saveReg(d){
    const aid=session.area, pid=session.profId, fecha=d.id?((getPath(`data/${aid}/bitacora/${d.id}`)||{}).f||ui.pFecha):ui.pFecha;
    const nom=($('#rg_nom').value||'').trim().replace(/\s+/g,' '), hi=svMin($('#rg_hi').value), hf=svMin($('#rg_hf').value), est=$('#rg_est').value;
    if(!nom){ toast('Escribe el nombre del socio'); return; }
    if(hi==null||hf==null){ toast('Anota la hora de inicio y la de fin'); return; }
    if(hf<=hi){ toast('La hora de fin debe ser después de la de inicio'); return; }
    if(hf-hi>480){ toast('Un servicio no puede durar más de 8 horas'); return; }
    const prev=d.id?(getPath(`data/${aid}/bitacora/${d.id}`)||{}):{};
    if(d.id&&prev.profId&&prev.profId!==pid) return;
    const locked=prev.creadoPor==='paramedico';
    const choque=bitacora(aid).find(x=>x.profId===pid&&x.f===fecha&&x.id!==d.id&&svIv(x)&&hi<svIv(x)[1]&&svIv(x)[0]<hf);
    if(choque&&!confirm(`Este horario se empalma con el de ${choque.paciente} (${svRangoTxt(svIv(choque)[0],svIv(choque)[1])}). ¿Guardar de todos modos?`)) return;
    const id=d.id||('b'+uid());
    const origen=locked?$('#rg_ori').value:(est==='atendido'?$('#rg_ori').value:'propia');  // una cita de Paramédicos conserva su origen aunque no se haya presentado
    setPath(`data/${aid}/bitacora/${id}`,{...prev,id,f:fecha,profId:pid,paciente:nom,servicio:$('#rg_srv').value,estado:est,hi:svHHMM(hi),hf:svHHMM(hf),min:hf-hi,origen,ts:prev.estado==='agendada'?Date.now():(prev.ts||Date.now())});
    closeModal(); render(); toast('Registro guardado');
    if(d.otra) openReg('');
  },
  delReg(d){
    const aid=session.area, prev=getPath(`data/${aid}/bitacora/${d.id}`); if(!prev||prev.profId!==session.profId) return;
    if(!confirm('¿Eliminar este registro?')) return;
    setPath(`data/${aid}/bitacora/${d.id}`,undefined); closeModal(); render(); toast('Registro eliminado');
  },
  svCopiarHorario(){                                     // copia el horario (con su 2° turno, si tiene) del primer día marcado a los demás días marcados
    const filas=[...document.querySelectorAll('.sv-hr')].filter(r=>r.querySelector('.pf_dia').checked); if(filas.length<2) return;
    const base=filas[0], i=base.querySelector('.pf_hi').value, f=base.querySelector('.pf_hf').value;
    const c2=base.querySelector('.pf_dia2'), on2=c2&&c2.checked, i2=base.querySelector('.pf_hi2').value, f2=base.querySelector('.pf_hf2').value;
    filas.slice(1).forEach(r=>{
      r.querySelector('.pf_hi').value=i; r.querySelector('.pf_hf').value=f;
      const rc2=r.querySelector('.pf_dia2'), rr2=r.querySelector('.sv-hr2');
      if(rc2){ rc2.checked=on2; if(rr2) rr2.classList.toggle('on',on2); }
      if(on2){ r.querySelector('.pf_hi2').value=i2; r.querySelector('.pf_hf2').value=f2; }
    });
    toast('Horario copiado a los días marcados');
  },
  svPrintReporte(){ const aid=curArea()||ui.gArea, R=svRango(ui.sv.per,ui.sv.ref); imprimirDoc({titulo:'Reporte de actividad · '+getArea(aid).nombre,sub:R.txt,html:svReporteDoc(aid,R)}); },
  svPrintInforme(){ const aid=curArea()||ui.gArea, R=anRange(); imprimirDoc({titulo:'Informe del servicio · '+getArea(aid).nombre,sub:`${anPeriodoTxt(R)}${anCompTxt(R)}`,html:svPanel(aid,R)}); },
  svAbrir(d){ actions.openArea({id:d.id,tab:'inicio'}); }
});
document.addEventListener('change',e=>{
  if(e.target.classList&&e.target.classList.contains('pf_dia')){ const r=e.target.closest('.sv-hr'); if(r) r.classList.toggle('on',e.target.checked); }
  if(e.target.classList&&e.target.classList.contains('pf_dia2')){ const r=e.target.closest('.sv-hr2'); if(r) r.classList.toggle('on',e.target.checked); }
});

/* ---------- formulario de especialistas: horario de cada día (lo llama profesores.js) ---------- */
function svProfCampos(aid,p,ro){
  const H=svHor(p)||{}, dis=ro?' disabled':'';
  return `<div class="f"><span class="lb">Horario de trabajo</span>
    <div class="sv-hor">${DIAS.map((l,i)=>{ const h=H[i], t2=!!(h&&h.i2&&h.f2); return `<div class="sv-hr${h?' on':''}">
      <div class="sv-hr1"><label class="sv-d"><input type="checkbox" class="pf_dia" value="${i}"${h?' checked':''}${dis}><span>${l}</span></label>
      <input type="time" class="pf_hi" step="300" value="${esc(h?h.i:'09:00')}"${dis}><em>a</em><input type="time" class="pf_hf" step="300" value="${esc(h?h.f:'17:00')}"${dis}></div>
      <div class="sv-hr2${t2?' on':''}"><label class="sv-d"><input type="checkbox" class="pf_dia2" value="${i}"${t2?' checked':''}${dis}><span>2° turno</span></label>
      <input type="time" class="pf_hi2" step="300" value="${esc(h&&h.i2?h.i2:'16:00')}"${dis}><em>a</em><input type="time" class="pf_hf2" step="300" value="${esc(h&&h.f2?h.f2:'18:00')}"${dis}></div></div>`; }).join('')}</div>
    ${ro?'':'<button type="button" class="btn sm" data-act="svCopiarHorario">Copiar el primer día marcado a los demás marcados</button>'}
    <small class="mut">Marca los días que trabaja y anota su hora de entrada y de salida. Si tiene doble turno (por ejemplo 6:00–11:00 y 16:00–18:00), marca también “2° turno” de ese día. Con esto se compara lo que registra contra su turno para calcular el tiempo muerto.</small></div>`;
}
function svProfLeer(aid){
  if(!esServ(aid)) return {};
  const horario={};
  document.querySelectorAll('.sv-hr').forEach(r=>{
    const c=r.querySelector('.pf_dia'); if(!c.checked) return;
    const h={i:r.querySelector('.pf_hi').value,f:r.querySelector('.pf_hf').value};
    const c2=r.querySelector('.pf_dia2'); if(c2&&c2.checked){ h.i2=r.querySelector('.pf_hi2').value; h.f2=r.querySelector('.pf_hf2').value; }
    horario[c.value]=h;
  });
  return {horario};
}
function svProfError(aid){
  if(!esServ(aid)) return '';
  const filas=[...document.querySelectorAll('.sv-hr')].filter(r=>r.querySelector('.pf_dia').checked);
  if(!filas.length) return 'Marca al menos un día de trabajo y su horario';
  for(const r of filas){
    const a=svMin(r.querySelector('.pf_hi').value), b=svMin(r.querySelector('.pf_hf').value), d=DIAS[+r.querySelector('.pf_dia').value];
    if(a==null||b==null) return `Anota la hora de entrada y de salida del ${d}`;
    if(b<=a) return `La salida del ${d} debe ser después de la entrada`;
    const c2=r.querySelector('.pf_dia2');
    if(c2&&c2.checked){
      const a2=svMin(r.querySelector('.pf_hi2').value), b2=svMin(r.querySelector('.pf_hf2').value);
      if(a2==null||b2==null) return `Anota el 2° turno completo del ${d} o desmárcalo`;
      if(b2<=a2) return `La salida del 2° turno del ${d} debe ser después de su entrada`;
      if(a2<b) return `El 2° turno del ${d} debe empezar después de que termina el primero`;
    }
  }
  return '';
}

/* ---------- comité: panel de cada área y del informe imprimible ---------- */
function svInsights(aid,s,sp,B){
  const S=servDe(aid), out=[];
  if(!s.n&&!s.noLlego&&!s.agendadas) return [{c:'info',h:'Sin registros',x:`No hay ${S.unidadP} ni otros servicios registrados en el período.`}];
  const dl=sp&&sp.n?` (${s.n-sp.n>=0?'+':''}${s.n-sp.n} contra el período anterior)`:'';
  out.push({c:'info',h:'Actividad',x:`${plu(s.n,'servicio atendido','servicios atendidos')} y ${svHm(s.min)} de servicio en ${plu(s.dias,'día','días')} con registro${dl}.${s.promMin?` Promedio de ${svHm(s.promMin)} por servicio.`:''}`});
  if(s.turno){
    out.push({c:svUtilCls(s.util),h:'Ocupación del turno',x:`${s.util}% (${svUtilEtiqueta(s.util)}): de ${svHm(s.turno)} de turno, ${svHm(s.enTurno)} fueron de servicio y ${svHm(s.idle)} de tiempo muerto${s.perdida?` (${svHm(s.perdida)} por citas que no llegaron y ${svHm(s.libre)} sin cita)`:''}.`});
    const ps=profesores(aid).filter(p=>p.activo!==false).map(p=>({p,e:servStats(aid,s.desdeR,s.hastaR,p.id,B)})).filter(x=>x.e.turno);
    if(ps.length>1){ ps.sort((a,b)=>a.e.util-b.e.util); const lo=ps[0], hi=ps[ps.length-1]; out.push({c:'info',h:'Entre especialistas',x:`La ocupación más baja es la de ${lo.p.nombre} (${lo.e.util}%) y la más alta la de ${hi.p.nombre} (${hi.e.util}%).`}); }
  } else out.push({c:'warn',h:'Sin horario para comparar',x:'Falta el horario de los especialistas o registros en días de turno; sin eso no se mide el tiempo muerto.'});
  if(s.noLlego) out.push({c:'warn',h:'Citas que no llegaron',x:`${s.noShow} no se presentaron y ${s.cancel} se cancelaron${s.perdida?`; dejaron ${svHm(s.perdida)} de turno sin servicio`:''}.`});
  if(s.fuera>0) out.push({c:'info',h:'Fuera de horario',x:`${svHm(s.fuera)} de servicio se dieron fuera del turno programado.`});
  if(s.rt.pct!=null) out.push({c:s.rt.pct>=70?'ok':'warn',h:'Hora de registro',x:`${s.rt.pct}% de los registros se guardó a los ${SV_TIEMPO_REAL} minutos o menos de terminar el servicio${s.rt.pct<100&&s.rt.prom?`; en promedio se captura ${svHm(s.rt.prom)} después`:''}.`});
  if(s.canal){ const c=s.porOrigen.filter(x=>svEsCanal(x.k))[0]; out.push({c:'info',h:'Canalizaciones',x:`${s.canal} de ${s.n} servicios (${Math.round(s.canal/s.n*100)}%) llegaron canalizados desde otras áreas${c?`; la que más: ${svOrigenTxt(c.k).replace('Desde ','')} (${c.n})`:''}.`}); }
  if(s.agendadas) out.push({c:'info',h:'Citas pendientes por confirmar',x:`${plu(s.agendadas,'cita agendada está','citas agendadas están')} todavía sin marcar si se atendió, no llegó o se canceló.`});
  const parAid=areasList().find(a=>a.tipo==='paramedico'), parRegs=parAid?s.todas.filter(x=>x.origen===parAid.id):[];
  if(parRegs.length){
    const porFisio={}; parRegs.forEach(x=>{ porFisio[x.profId]=(porFisio[x.profId]||0)+1; });
    const top=Object.entries(porFisio).sort((a,b)=>b[1]-a[1])[0], topNom=top&&(getProf(aid,top[0])||{}).nombre;
    out.push({c:'info',h:'Citas de empleados por Paramédicos',x:`${plu(parRegs.length,'cita de empleado fue canalizada','citas de empleados fueron canalizadas')} por Paramédicos hacia Fisioterapia en el período${topNom?`; ${topNom} es quien más recibió (${top[1]})`:''}.`});
  }
  if(s.sinCap.length) out.push({c:'warn',h:'Días sin bitácora',x:`${plu(s.sinCap.length,'día de turno quedó','días de turno quedaron')} sin registros.`});
  return out;
}
function svTablaEsp(aid,r){
  const ps=profesores(aid).filter(p=>p.activo!==false); if(!ps.length) return empty('Da de alta a los especialistas para ver su actividad.');
  const B=bitacora(aid), S=servDe(aid);
  return `<div class="card"><div class="an-scroll"><table class="an-t"><thead><tr><th>${esc(S.esp)}</th><th>Servicios</th><th>En servicio</th><th>Turno</th><th>Ocupación</th><th>Tiempo muerto</th><th>No llegaron</th><th>Registro en el momento</th></tr></thead><tbody>
    ${ps.map(p=>{ const s=servStats(aid,r.desde,r.hasta,p.id,B); return `<tr><td>${esc(p.nombre)}</td><td><b>${s.n}</b></td><td>${esc(svHm(s.min))}</td><td>${s.turno?esc(svHm(s.turno)):'—'}</td><td class="${svUtilCls(s.util)}"><b>${s.util==null?'—':s.util+'%'}</b></td><td>${s.turno?esc(svHm(s.idle)):'—'}</td><td class="${s.noLlego?'warn':''}">${s.noLlego}</td><td class="${s.rt.pct!=null&&s.rt.pct<70?'warn':''}">${s.rt.pct==null?'—':s.rt.pct+'%'}</td></tr>`; }).join('')}</tbody></table></div></div>`;
}
function svPanel(aid,r){
  const a=getArea(aid), S=servDe(aid), B=bitacora(aid), s=servStats(aid,r.desde,r.hasta,'',B), sp=r.prev?servStats(aid,r.prev.desde,r.prev.hasta,'',B):null;
  if(!s.todas.length) return `<div class="card">${empty(`${esc(a.nombre)} todavía no tiene servicios registrados en el período.`)}</div>`;
  s.desdeR=r.desde; s.hastaR=r.hasta;
  const ps=profesores(aid).filter(p=>p.activo!==false);
  if(esParamed(aid)){                                    // Gerencia no mide el servicio de Paramédicos: solo el conteo de citas
    return `<div class="sv-pan"><div class="h2 sm">${areaIco(a,{size:20})} ${esc(a.nombre)}</div>
      <div class="kpis">${kpi('Citas agendadas',s.n,'',{color:'var(--b2)'})}${kpi('Pendientes por confirmar',s.agendadas,'',{color:'var(--b1)'})}</div>
      ${ps.map(p=>{ const e=servStats(aid,r.desde,r.hasta,p.id,B); return (e.n||e.agendadas)?`<div class="sv-esp"><div class="sv-esp-h"><b>${esc(p.nombre)}</b><span class="sv-hm">${plu(e.n,'cita agendada','citas agendadas')}</span></div></div>`:''; }).join('')}
      <div class="an-nota">Gerencia no mide el servicio de Paramédicos: solo se muestra cuántas citas de empleados agendaron hacia Fisioterapia.</div></div>`;
  }
  return `<div class="sv-pan"><div class="h2 sm">${areaIco(a,{size:20})} ${esc(a.nombre)}</div>
    ${svKpis(aid,s)}
    <div class="h2 sm">Lectura de ${esc(a.nombre)}</div><div class="an-ins">${svInsights(aid,s,sp,B).map(x=>`<div class="an-i ${x.c}"><b>${esc(x.h)}</b><span>${esc(x.x)}</span></div>`).join('')}</div>
    <div class="h2 sm">Por ${esc(S.esp.toLowerCase())}</div>${svTablaEsp(aid,r)}
    ${ps.map(p=>{ const e=servStats(aid,r.desde,r.hasta,p.id,B); return e.todas.length?`<div class="sv-esp"><div class="sv-esp-h"><b>${esc(p.nombre)}</b><span class="sv-hm">${esc(svHm(e.min))}</span></div><div class="sv-hor-t">${esc(svHorarioTxt(p))}</div><div class="sv-esp-t">${svFrase(aid,e)}</div><div class="sv-esp-t">${svTurnoHTML(e)}</div></div>`:''; }).join('')}
    ${s.n?`<div class="card"><div class="an-ct">Tiempo por servicio</div><div class="an-cs">Horas dedicadas según la bitácora</div>${anBars(s.porServ.map(x=>({label:x.k,val:Math.round(x.min/6)/10,extra:' h',sub:plu(x.n,'servicio','servicios')})))}</div>
    <div class="card"><div class="an-ct">Canalización</div><div class="an-cs">De dónde vinieron los servicios</div>${anBars(s.porOrigen.map(x=>({label:svOrigenTxt(x.k),val:x.n})))}</div>`:''}
  </div>`;
}
function pServicios(d){
  const ids=d.aids.filter(esServ);
  if(!ids.length) return empty('Nutrición, Fisioterapia y Paramédicos no están dentro del filtro de área. Elige “Todas las áreas” o el área que quieras.');
  return ids.map(id=>svPanel(id,d.r)).join('')+`<div class="an-nota">Todo sale de lo que cada especialista registra en su bitácora (socio, servicio, hora de inicio y fin, y a qué hora lo capturó) comparado con el horario de su turno. Tiempo muerto = turno − tiempo en servicio; se separa lo que corresponde a citas que no se presentaron o se cancelaron. Ocupación ≥ ${SV_UTIL.ok}% se considera justa, ${SV_UTIL.warn}–${SV_UTIL.ok-1}% por revisar y menor a ${SV_UTIL.warn}% excesiva. La agenda de cada uno es independiente y no se toca. No se guardan diagnósticos.</div>`;
}

/* ---------- integración con las pantallas generales de gerencia ---------- */
function svChips(aid,s){
  const S=servDe(aid), v=servStats(aid,addDays(todayStr(),-29),todayStr());
  if(esParamed(aid)) return `<span>${plu(s.profes,S.esp.toLowerCase(),S.espP.toLowerCase())}</span><span>${plu(v.n,'cita agendada','citas agendadas')} en 30 días</span>${v.agendadas?`<span class="warn">${plu(v.agendadas,'pendiente por confirmar','pendientes por confirmar')}</span>`:''}`;
  return `<span>${plu(s.profes,S.esp.toLowerCase(),S.espP.toLowerCase())}</span><span>${plu(v.n,'servicio','servicios')} en 30 días</span>${v.util!=null?`<span class="${svUtilCls(v.util)}">ocupación ${v.util}%</span>`:''}${v.sinCap.length?`<span class="warn">${plu(v.sinCap.length,'día sin bitácora','días sin bitácora')}</span>`:''}`;
}
const svHoyTxt = (aid,s) => s.svHoy ? `Hoy: ${plu(s.svHoy,'servicio atendido','servicios atendidos')} · ${svHm(s.svHoyMin)}` : 'Hoy todavía no hay servicios registrados';
function svKpisResumen(){                               // dos tarjetas más en el Resumen de gerencia
  const ids=servMedidosIds(); if(!ids.length) return '';
  const r=anRange(), S=ids.map(id=>servStats(id,r.desde,r.hasta)), n=anSum(S,x=>x.n), min=anSum(S,x=>x.min), tur=anSum(S,x=>x.turno), en=anSum(S,x=>x.enTurno), idle=anSum(S,x=>x.idle), util=tur?Math.round(en/tur*100):null;
  return `${kpi('Servicios de salud',n.toLocaleString('es-MX'),`${svHm(min)} · ${esc(ids.map(id=>getArea(id).nombre).join(' y '))}`,{color:'var(--b3)'})}
        ${kpi('Ocupación de turnos de salud',util==null?'—':util+'%',util==null?'sin horarios o registros':`${svHm(idle)} de tiempo muerto`,{cls:svUtilCls(util),color:'var(--b1)'})}`;
}
function svAtencionGerencia(){                          // renglones para “Notificaciones de atención requerida”
  const t=todayStr(), desde=addDays(t,-29);
  return servMedidosIds().map(id=>{
    const a=getArea(id), s=servStats(id,desde,t), partes=[];
    if(s.sinCap.length) partes.push(plu(s.sinCap.length,'día de turno sin bitácora','días de turno sin bitácora'));
    if(s.util!=null&&s.util<SV_UTIL.warn) partes.push(`ocupación del turno ${s.util}% (${svHm(s.idle)} de tiempo muerto)`);
    if(!partes.length) return '';
    const grave=s.util!=null&&s.util<SV_UTIL.warn;
    return `<button class="line" style="--ac:${esc(a.color)}" data-act="svAbrir" data-id="${esc(id)}"><div class="t">${areaIco(a,{tile:true,size:20})}</div><div class="b"><b>${esc(a.nombre)} · por revisar (30 días)</b><small>${esc(partes.join(' · '))}</small></div><div class="r">${pill(grave?'atender':'revisar',grave?'bad':'warn')}</div></button>`;
  }).join('');
}
const dgServicio = () => '';                            // Nutrición y Fisioterapia no tienen asistencia por clase

/* ---------- datos de simulación (los llama simulacion.js) ---------- */
SIM_EVENTOS.nutricion=[['Plática: alimentación para deportistas',-14,'realizado',40,3000,2800,5],['Jornada de valoración de composición corporal',10,'planificado',60,5000]];
SIM_EVENTOS.fisioterapia=[['Cobertura médica del torneo interno de tenis',-9,'realizado',80,2500,2300,5],['Clínica de prevención de lesiones',16,'planificado',35,4000]];
SIM_INCIDENCIAS.nutricion=[['Material o equipo','media','El InBody da lecturas inconsistentes; se pidió calibración.','en seguimiento',-3],['Queja de socio','baja','Un socio pidió más horarios por la tarde.','resuelta',-10]];
SIM_INCIDENCIAS.fisioterapia=[['Material o equipo','alta','El equipo de electroterapia dejó de encender.','abierta',-1],['Personal o instructor','media','Cancelación de último minuto de un especialista.','en seguimiento',-5]];
SIM_APOYOS.nutricion='Autorizar recordatorios por mensaje para reducir inasistencias.';
SIM_APOYOS.fisioterapia='Reparar el equipo de electroterapia antes del lunes.';
function simServicio(a,ai,D,profs,rnd,t,nombreAlumno){
  const fis=a.tipo==='fisioterapia', par=a.tipo==='paramedico', S=SERV[a.tipo], rn=(x,y)=>x+Math.floor(rnd()*(y-x+1));
  D.bitacora={};
  const espec=fis?['Rehabilitación deportiva','Terapia manual','Ortopédica']:par?['Atención a empleados','Primeros auxilios']:['Nutrición deportiva','Control de peso'];
  const turnos=fis?[{dias:[0,1,2,3,4],i:'07:00',f:'13:00'},{dias:[0,1,2,3,4],i:'13:00',f:'19:00'},{dias:[1,3,5],i:'09:00',f:'15:00'}]
                  :par?[{dias:[0,1,2,3,4],i:'08:00',f:'14:00'},{dias:[0,1,2,3,4],i:'14:00',f:'20:00'}]
                  :[{dias:[0,1,2,3,4],i:'06:00',f:'11:00'},{dias:[0,1,2,3,4],i:'11:00',f:'16:00'}];
  profs.forEach((pid,i)=>{ const p=D.profesores[pid], h=turnos[i%turnos.length]; p.especialidad=espec[i%espec.length]; p.horario=Object.fromEntries(h.dias.map(d=>[d,{i:h.i,f:h.f}])); });
  const dep=areasList().filter(x=>!SERV[x.tipo]).map(x=>x.id);
  const pool=(fis?['futbol','tenis','gimnasia','basquetbol','padel','gimnasio','taekwondo']:['gimnasio','fitness','gimnasia','futbol','natacion','tenis']).filter(x=>dep.includes(x));
  const origen=()=>{ const r=rnd(); if(r<.55||!pool.length) return 'propia'; if(r<.63) return 'medico'; return pool[Math.floor(rnd()*pool.length)]; };
  const pesos=fis?[.10,.42,.16,.14,.06,.08,.04]:par?[.85,.15]:[.55,.28,.08,.04,.05];
  const elige=()=>{ let r=rnd(), i=0; while(i<pesos.length-1&&r>pesos[i]){ r-=pesos[i]; i++; } return S.servicios[i]||S.servicios[0]; };
  const pacientes=Array.from({length:fis?70:par?30:55},(_,i)=>nombreAlumno(ai*61+i*13+7));
  const ahora=new Date(), nowMin=ahora.getHours()*60+ahora.getMinutes();
  for(let off=75; off>=0; off--){
    const f=addDays(t,-off), w=wdIdx(f);
    profs.forEach((pid,pi)=>{
      const h=turnos[pi%turnos.length]; if(!h.dias.includes(w)) return;
      if(off===9&&pi===0) return;                                                    // un día sin bitácora
      const ini=svMin(h.i), fin=svMin(h.f), lote=((ai+pi+off)%5===0), pHueco=pi===1?.6:.15;
      let cur=ini+rn(0,3)*5, k=0;
      while(true){
        const sv=elige(), dur=Math.max(10,sv.min+rn(-2,2)*5); if(cur+dur>fin+(rnd()<.08?15:0)) break;
        if(off===0&&cur+dur>nowMin) break;
        const r=rnd(), est=r<.07?'no_asistio':r<.11?'cancelo':'atendido', id=`sim_b${ai}_${off}_${pi}_${k++}`;
        const tsFin=parseYmd(f).getTime()+(cur+dur)*60000, tsLote=parseYmd(f).getTime()+(fin+rn(0,45))*60000;
        D.bitacora[id]={id,f,profId:pid,paciente:pacientes[rn(0,pacientes.length-1)],servicio:sv.s,estado:est,hi:svHHMM(cur),hf:svHHMM(cur+dur),min:dur,
          origen:est==='atendido'?origen():'propia',ts:lote?tsLote:tsFin+rn(1,14)*60000,sim:true};
        cur+=dur+(rnd()<pHueco?rn(2,10)*5:rn(0,2)*5);
      }
    });
  }
}
