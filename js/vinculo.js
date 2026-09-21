'use strict';
/* =====================================================================
   vinculo.js — Fitness Control → Gerencia (SOLO LECTURA)
   Lee en tiempo real el nodo "fitness" de la misma base de Firebase:
     instructores, registros (asistencia), salones y eventos
   y los convierte a los datos de Gerencia: profesores, grupos (clases),
   asistencia (aforo) y eventos.
   Gerencia NUNCA escribe en "fitness": Fitness Control reescribe ese nodo
   completo cada vez que guarda, así que cualquier cosa ajena se perdería.
   Los PIN de los instructores no se copian.
   ===================================================================== */
const FC_NODO = 'fitness';
const FC_PARTES = ['instructores','registros','salones','eventos'];
const FC_DIA = {lunes:0,martes:1,miercoles:2,jueves:3,viernes:4,sabado:5,domingo:6};
let fcRaw = {}, fcRecv = {}, fcT = null;

const fcNorm = s => String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const fcArr = v => v==null ? [] : Array.isArray(v) ? v.filter(x=>x!=null) : Object.values(v).filter(x=>x!=null);
const fcHora = h => { const m=String(h||'').match(/(\d{1,2}):(\d{2})/); return m?pad(+m[1])+':'+m[2]:''; };
const fcDia = d => { const k=fcNorm(d); return FC_DIA[k]!=null?FC_DIA[k]:null; };
const fcAreaVinculada = () => { const a=areasList().find(x=>x.vinculo); return a?a.id:null; };
function fcAreaPorDeporte(dep,fallback){
  const d=fcNorm(dep); if(!d) return fallback;
  const as=areasList(), n=x=>fcNorm(x.nombre);
  const a=as.find(x=>n(x)===d)||as.find(x=>n(x)&&(d.includes(n(x))));
  return a?a.id:fallback;
}

/* ---------- conversión (función pura, se puede probar sin Firebase) ---------- */
/* Cada clase se manda al área cuyo nombre coincida con el nombre de la clase (igual que los eventos,
   ver fcAreaPorDeporte); si ninguna coincide, cae en el área vinculada (areaId). Así una instructora
   de Fitness Control puede aparecer en Gerencia repartida: sus clases de "Gimnasia rítmica" cuentan
   en el área Gimnasia y el resto en Fitness, sin tocar nada en Fitness Control. */
function fcAdapt(raw,areaId,areas){
  raw=raw||{};
  const insts=fcArr(raw.instructores), regs=fcArr(raw.registros), sals=fcArr(raw.salones), evs=fcArr(raw.eventos);
  const instPorId=Object.fromEntries(insts.map(i=>[String(i.id),i]));
  const TIPO_SALON={salon:'Salón general',spinning:'Ciclismo indoor',yoga:'Mente y cuerpo',funcional:'Funcional',cardio:'Cardio',piscina:'Acuática',exterior:'Exterior',multiusos:'Multiusos'};
  const capDe=clase=>{ const s=sals.find(x=>fcArr(x.clases).some(c=>fcNorm(c)===fcNorm(clase))); return s?{cap:+s.cap||20,salon:s.nombre||'',tipo:TIPO_SALON[s.tipo]||''}:{cap:20,salon:'',tipo:''}; };
  const grupos={}, eventos={};
  const profIdsPorArea={};                                    // aid -> Set de ids de instructor (fc_pID) con al menos una clase ahí

  const gid=(iid,clase,hora)=>`fc_g${iid}_${fcNorm(clase).replace(/[^a-z0-9]/g,'')}_${hora.replace(':','')}`;
  const excluida = a => !!(getArea(a)||{}).fcExcluir;
  const mk=(iid,clase,hora)=>{
    const id=gid(iid,clase,hora);
    if(grupos[id]) return grupos[id];
    const c=capDe(clase), inst=instPorId[String(iid)];
    const aid=(areas&&fcAreaPorDeporte(clase,areaId))||areaId;
    const g={id,nombre:String(clase),prof:inst?String(inst.nombre):'',profId:inst?'fc_p'+iid:'',dias:'',hi:hora,hf:'',lugar:c.salon,tipo:c.tipo,cupo:c.cap,inscritos:0,alumnos:'',fc:true,_d:new Set(),_prog:false,_last:'',_capF:'',_aid:aid};
    if(excluida(aid)) return g;                                // esta área es 100% manual: no se guarda ni se cuenta en ningún lado
    grupos[id]=g;
    (profIdsPorArea[aid]=profIdsPorArea[aid]||new Set()).add(g.profId);
    return g;
  };
  // 1) horario vigente de cada instructor
  insts.forEach(i=>fcArr(i.horario).forEach(h=>{
    const hora=fcHora(h.hora); if(!h.clase||!hora) return;
    const g=mk(i.id,h.clase,hora), d=fcDia(h.dia); if(d!=null) g._d.add(d); g._prog=true;
  }));
  // 2) clases que tienen registros aunque ya no estén en el horario
  const esManual = r => r.tipo==='falta' || !fcHora(r.hora) || fcHora(r.hora)==='00:00';
  regs.forEach(r=>{
    if(!r.fecha||esManual(r)) return;
    const g=mk(r.inst_id,r.clase,fcHora(r.hora)), d=fcDia(r.dia);
    if(!g._prog&&d!=null) g._d.add(d);
    if(r.fecha>g._last) g._last=r.fecha;
    if(r.estado!=='falta'&&+r.cap>0&&r.fecha>=g._capF){ g.cupo=+r.cap; g._capF=r.fecha; }
  });
  // 3) asistencia (se guarda junto con el grupo, en el área que le tocó a esa clase)
  const asisPorArea={};
  const guardar=(g,r,extra)=>{
    const bolsa=(asisPorArea[g._aid]=asisPorArea[g._aid]||{});
    const id=`${g.id}_${r.fecha}`, prev=bolsa[id];
    if(prev&&(+prev.updatedAt||0)>(+r.updatedAt||0)) return;
    bolsa[id]={id,grupoId:g.id,fecha:r.fecha,asistentes:0,fc:true,updatedAt:+r.updatedAt||0,...extra};
  };
  const buscarManual=r=>{
    const pid='fc_p'+r.inst_id, cl=fcNorm(r.clase), d=fcDia(r.dia);
    const gs=Object.values(grupos).filter(g=>g.profId===pid&&fcNorm(g.nombre)===cl);
    return gs.find(g=>g._d.has(d))||gs[0]||null;
  };
  let ultimo='';
  regs.forEach(r=>{
    if(!r.fecha) return;
    if(r.fecha>ultimo) ultimo=r.fecha;
    if(r.estado==='falta'){
      const g=esManual(r)?buscarManual(r):grupos[gid(r.inst_id,r.clase,fcHora(r.hora))];
      if(g) guardar(g,r,{omitida:true,falta:true,motivo:r.motivo_falta||r.motivo_suplencia||r.tipo_falta||''});
      return;
    }
    if(esManual(r)) return;
    const g=grupos[gid(r.inst_id,r.clase,fcHora(r.hora))]; if(!g) return;
    guardar(g,r,{asistentes:Math.max(0,parseInt(r.asistentes)||0),...(r.estado==='sub'?{sup:true,supId:r.suplente_id?'fc_p'+r.suplente_id:'',motivo:r.motivo_suplencia||''}:{})});
  });
  // 4) cierre de grupos: se calculan sus días y se reparten en el área que le tocó a cada clase
  const gruposPorArea={};
  Object.values(grupos).forEach(g=>{
    g.dias=[...g._d].sort().join(',');
    if(!g._prog&&g._last) g.fin=addDays(g._last,7);          // clase que ya no se imparte: no cuenta como “sin captura” después
    const aid=g._aid;
    delete g._d; delete g._prog; delete g._last; delete g._capF; delete g._aid;
    (gruposPorArea[aid]=gruposPorArea[aid]||{})[g.id]=g;
  });
  // profesores: cada área ve solo a quien de verdad tiene clases ahí (una instructora puede aparecer
  // en dos áreas a la vez si imparte, por ejemplo, tanto Fitness como Gimnasia)
  const profesoresPorArea={};
  Object.keys(profIdsPorArea).forEach(aid=>{
    const bolsa=(profesoresPorArea[aid]={});
    profIdsPorArea[aid].forEach(pid=>{
      const iid=String(pid).replace(/^fc_p/,''), i=instPorId[iid]; if(!i) return;
      bolsa[pid]={id:pid,nombre:String(i.nombre||'Sin nombre'),tipo:i.tipo||'Planta',activo:i.activo!==false,especialidad:i.esp||'',foto:i.foto||'',fc:true};
    });
  });
  // 5) eventos (Fitness Control los maneja por deporte)
  evs.forEach(e=>{
    if(!e.fecha||!e.nombre) return;
    const aid=(areas&&fcAreaPorDeporte(e.deporte,areaId))||areaId;
    if(excluida(aid)) return;                                 // área 100% manual: tampoco recibe eventos automáticos
    const id='fc_'+String(e.id).replace(/[.#$/\[\]]/g,'_');
    (eventos[aid]=eventos[aid]||{})[id]={id,nombre:String(e.nombre),fecha:e.fecha,hora:e.horaIni||'',lugar:e.lugar||'',
      tipo:'Torneo',estado:['planificado','realizado','cancelado','pospuesto'].includes(e.estado)?e.estado:'planificado',
      participantes:parseInt(e.participantes)||0,presupuesto:+e.presupuesto||0,costoReal:+e.costoReal||0,calificacion:+e.calificacion||0,
      deporte:e.deporte||'',categoria:e.categoria||'',notas:[e.observaciones,e.mejoras].filter(Boolean).join('\n'),fc:true};
  });
  return {profesoresPorArea,gruposPorArea,asisPorArea,eventos,
    meta:{instructores:insts.length,registros:regs.length,grupos:Object.values(gruposPorArea).reduce((n,g)=>n+Object.keys(g).length,0),eventos:evs.length,ultimo}};
}

/* ---------- aplicar y conectar ---------- */
function fcAplicar(raw){
  const aid=fcAreaVinculada();
  if(!aid){ LINK={}; LINKMETA={estado:'sin-area',msg:'Ninguna área está marcada como vinculada.',n:{},ts:Date.now()}; safeRender(); return; }
  const A=fcAdapt(raw,aid,true), L={};
  const areasConDatos=new Set([aid,...Object.keys(A.gruposPorArea),...Object.keys(A.eventos)]);
  areasConDatos.forEach(a=>{
    L[a]={profesores:A.profesoresPorArea[a]||{},grupos:A.gruposPorArea[a]||{},asistencia:A.asisPorArea[a]||{},eventos:A.eventos[a]||{}};
  });
  LINK=L; LINKMETA={estado:'ok',msg:'',n:A.meta,ts:Date.now(),demo:!!(typeof window!=='undefined'&&window.FC_DEMO)};
  safeRender();
}
/* Copia de Fitness Control en el equipo: el área Fitness se ve aunque no haya internet */
const FC_CACHE = 'gd_fc_cache_v1';
function fcGuardarCache(raw){
  try{
    const c={...raw};
    if(c.instructores) c.instructores=fcArr(c.instructores).map(({foto,pin,PIN,...r})=>r);  // sin fotos ni PIN
    localStorage.setItem(FC_CACHE,JSON.stringify({ts:Date.now(),raw:c}));
  }catch(e){ console.warn('Copia de Fitness Control demasiado grande para el equipo',e); }
}
function fcDesdeCache(){
  try{
    const c=JSON.parse(localStorage.getItem(FC_CACHE)); if(!c||!c.raw) return;
    fcAplicar(c.raw); LINKMETA.cache=c.ts;
  }catch(e){}
}
function fcConectar(db){
  if(LINKMETA.estado!=='ok') LINKMETA={estado:'conectando',msg:'',n:{},ts:0};
  FC_PARTES.forEach(k=>{
    db.ref(`${FC_NODO}/${k}`).on('value',snap=>{
      fcRaw[k]=snap.val(); fcRecv[k]=true; clearTimeout(fcT);
      fcT=setTimeout(()=>{ if(fcRecv.instructores&&fcRecv.registros){ fcAplicar(fcRaw); fcGuardarCache(fcRaw); } },300);
    },err=>{
      LINKMETA={estado:'error',msg:(err&&err.message)||String(err),n:{},ts:0};
      safeRender();
    });
  });
}

/* ---------- avisos y panel de estado ---------- */
/* Una clase de Fitness Control puede caer en un área distinta a la vinculada (ver fcAdapt: se manda
   al área cuyo nombre coincida con el nombre de la clase, p. ej. "Gimnasia rítmica" → área Gimnasia).
   Esa área secundaria no queda 100% vinculada (su director sigue capturando lo suyo aparte), pero sí
   recibe profesores/grupos/aforo de solo lectura, así que se avisa igual. */
const tieneVinculoSecundario = aid => aid!==fcAreaVinculada() && !!(LINK[aid]&&(Object.keys(LINK[aid].grupos||{}).length||Object.keys(LINK[aid].profesores||{}).length));
function vinculoBanner(aid){
  if(esVinculada(aid)){
    const m=LINKMETA, ok=m.estado==='ok';
    return `<div class="vinc ${ok?'':'off'}"><b>${ok?'Datos vinculados desde Fitness Control':m.estado==='error'?'No se pudo leer Fitness Control':'Conectando con Fitness Control…'}</b>
      <span>${ok&&m.cache&&!online?`Sin internet · última copia guardada (${esc(fmtFecha(ymd(new Date(m.cache))))})`:ok?`Solo lectura · se actualizan solos${m.n.ultimo?' · último registro '+esc(fmtFecha(m.n.ultimo)):''}`:esc(m.msg||'Los profesores, grupos y aforos de esta área se capturan en Fitness Control.')}</span></div>`;
  }
  if(tieneVinculoSecundario(aid)){
    const n=Object.keys(LINK[aid].grupos||{}).length;
    return `<div class="vinc"><b>Algunas clases vienen de Fitness Control</b>
      <span>${n} clase${n===1?'':'s'} y sus profesores se leen de Fitness Control (solo lectura, se actualizan solos). El resto de esta área se captura aquí.</span></div>`;
  }
  return '';
}
function gVinculoCard(){
  const m=LINKMETA, aid=fcAreaVinculada(), a=aid?getArea(aid):null;
  const cfg=!!(FIREBASE_CONFIG.databaseURL||(typeof window!=='undefined'&&window.FC_DEMO));
  const est=!cfg?['mut','Sin Firebase']:!a?['warn','Sin área vinculada']:m.estado==='ok'?['ok',m.demo?'Demostración':'Conectado']:m.estado==='error'?['bad','Error']:['warn','Conectando…'];
  const propios=a?['profesores','grupos','asistencia'].reduce((n,k)=>n+Object.keys(((state.data||{})[aid]||{})[k]||{}).length,0):0;
  return `<div class="card">
    <div class="row"><div><b>Fitness Control</b><small>${a?`Área vinculada: ${areaIco(a,{size:14})} ${esc(a.nombre)}`:'Marca el área en Ajustes → Áreas → Editar'}</small></div>${pill(est[1],est[0])}</div>
    ${m.estado==='ok'?`<div class="row"><div><b>Datos recibidos</b><small>${m.n.instructores} instructores · ${m.n.grupos} clases · ${(m.n.registros||0).toLocaleString('es-MX')} registros de asistencia · ${m.n.eventos} eventos${m.n.ultimo?' · último '+esc(fmtFecha(m.n.ultimo)):''}</small></div></div>`:''}
    ${m.estado==='error'?`<div class="row"><div><b>No se pudo leer</b><small>${esc(m.msg)}. Revisa las reglas de Firebase (LEEME-vinculo.txt).</small></div></div>`:''}
    ${!cfg?`<div class="row"><div><small>Pon <b>CONECTAR_FIREBASE = true</b> en <b>js/config.js</b> para conectar la base de datos y activar el vínculo.</small></div></div>`:''}
    <div class="row"><div><small>Gerencia solo lee. Nunca escribe en Fitness Control y no copia los PIN de los instructores.</small></div></div>
    ${propios&&m.estado==='ok'?`<div class="row"><div><b>Datos manuales duplicados</b><small>Esta área tiene ${propios} registros capturados a mano en Gerencia que ya vienen de Fitness Control.</small></div><button class="btn sm danger" data-act="fcLimpiar">Quitar</button></div>`:''}
  </div>`;
}
Object.assign(actions,{
  fcLimpiar(){
    const aid=fcAreaVinculada(); if(!aid) return;
    if(!confirm('¿Quitar los profesores, grupos y asistencia capturados a mano en esta área? Los que vienen de Fitness Control no se tocan.')) return;
    ['profesores','grupos','asistencia'].forEach(k=>setPath(`data/${aid}/${k}`,undefined));
    render(); toast('Datos manuales quitados');
  }
});
