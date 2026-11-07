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

/* Hombres y mujeres de un registro de Fitness Control. Se aceptan conteos (hombres/mujeres, h/m…) o porcentajes
   (pct_h, % hombres, 30/70…), sueltos en el registro o dentro de un objeto "genero"/"sexo". Si solo viene uno de los
   dos, el otro es lo que falta para llegar al total. Devuelve {hom,muj} o null si el registro no trae ese dato. */
const FC_RE_H = /(hombre|varon|masculin|\bhom\b|^h$|^h[_ -]|[_ -]h$|\bh\b)/, FC_RE_M = /(mujer|femenin|\bmuj\b|\bfem\b|^m$|^m[_ -]|[_ -]m$|\bm\b)/, FC_RE_P = /(pct|porc|percent|%|proporcion)/;
function fcSexoClaves(r){                       // [{k, sexo:'h'|'m', pct:boolean, v:number}]
  const out=[]; if(!r||typeof r!=='object') return out;
  const mira=(k0,v,pre)=>{
    const kn=fcNorm(pre+k0);
    if(v&&typeof v==='object'&&!Array.isArray(v)){ if(/(genero|sexo|gender|sex)/.test(kn)) Object.entries(v).forEach(([a,b])=>mira(a,b,k0+'_')); return; }
    const num=parseFloat(String(v).replace('%','')); if(isNaN(num)||num<0) return;
    const h=FC_RE_H.test(kn), m=FC_RE_M.test(kn); if(h===m) return;
    out.push({k:pre+k0,sexo:h?'h':'m',pct:FC_RE_P.test(kn)||/%/.test(String(v)),v:num});
  };
  Object.entries(r).forEach(([k,v])=>mira(k,v,''));
  return out;
}
function fcSexo(r,n){
  const ks=fcSexoClaves(r); if(!ks.length) return null;
  const val=x=>x.pct?(n*(x.v<=1&&x.v>0&&!Number.isInteger(x.v)?x.v*100:x.v)/100):x.v;
  const H=ks.find(x=>x.sexo==='h'), M=ks.find(x=>x.sexo==='m');
  let h=H?val(H):null, m=M?val(M):null;
  if(h==null) h=Math.max(0,n-m); else if(m==null) m=Math.max(0,n-h);
  const t=h+m; if(!(t>0)||!(n>0)) return {hom:0,muj:0};
  h=Math.round(n*h/t); return {hom:h,muj:n-h};     // la proporción manda: siempre suma el total de asistentes
}

/* Vigencia de los horarios: Fitness Control guarda por instructor el historial "hv" = [{desde, slots}],
   donde cada versión rige desde su fecha hasta el día antes de la siguiente. Sin historial rige siempre. */
function fcFechaV(v){
  if(v==null||v==='') return '';
  if(typeof v==='number'&&v>1e11){ const d=new Date(v); return isNaN(d)?'':ymd(d); }
  const t=String(v).trim(); let m=t.match(/^(\d{4})-(\d{2})-(\d{2})/); if(m) return `${m[1]}-${m[2]}-${m[3]}`;
  m=t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m?`${m[3]}-${pad(+m[2])}-${pad(+m[1])}`:'';
}
/* ---------- conversión (función pura, se puede probar sin Firebase) ---------- */
/* Cada clase se manda al área cuyo nombre coincida con el nombre de la clase (igual que los eventos,
   ver fcAreaPorDeporte); si ninguna coincide, cae en el área vinculada (areaId). Así una instructora
   de Fitness Control puede aparecer en Gerencia repartida: sus clases de "Gimnasia rítmica" cuentan
   en el área Gimnasia y el resto en Fitness, sin tocar nada en Fitness Control. */
function fcAdapt(raw,areaId,areas){
  raw=raw||{};
  const insts=fcArr(raw.instructores), regs=fcArr(raw.registros).filter(r=>!(r&&r.ger_id)), sals=fcArr(raw.salones), evs=fcArr(raw.eventos);
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
  // 1) horario de cada instructor, con su historial de vigencias (hv: cada versión rige desde su fecha)
  insts.forEach(i=>{
    const vers=fcArr(i.hv).map(v=>({d:fcFechaV(v.desde)||'1970-01-01',s:fcArr(v.slots)})).sort((a,b)=>a.d.localeCompare(b.d));
    if(!vers.length){                                        // sin historial: el horario actual rige siempre
      fcArr(i.horario).forEach(h=>{
        const hora=fcHora(h.hora); if(!h.clase||!hora) return;
        const g=mk(i.id,h.clase,hora), d=fcDia(h.dia); if(d!=null) g._d.add(d); g._prog=true;
      });
      return;
    }
    vers.forEach((v,k)=>{
      const f=k+1<vers.length?addDays(vers[k+1].d,-1):'';
      v.s.forEach(h=>{
        const hora=fcHora(h.hora); if(!h.clase||!hora) return;
        const d=fcDia(h.dia); if(d==null) return;
        const g=mk(i.id,h.clase,hora); g._d.add(d); g._prog=true;
        const L=(g._dd=g._dd||{})[d]=g._dd[d]||[], u=L[L.length-1];
        if(u&&u.f&&addDays(u.f,1)===v.d) u.f=f; else L.push({d:v.d,f});
      });
    });
  });
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
    guardar(g,r,{asistentes:Math.max(0,parseInt(r.asistentes)||0),...(fcSexo(r,Math.max(0,parseInt(r.asistentes)||0))||{}),...(r.estado==='sub'?{sup:true,supId:r.suplente_id?'fc_p'+r.suplente_id:'',motivo:r.motivo_suplencia||''}:{})});
  });
  // 4) cierre de grupos: se calculan sus días y se reparten en el área que le tocó a cada clase
  const gruposPorArea={};
  Object.values(grupos).forEach(g=>{
    // Solo las clases que siguen en el horario vigente de Fitness Control se programan cada semana.
    // Las que solo aparecen en registros viejos ya no se “programan” (no salen de más ni quedan en cero);
    // su aforo histórico sigue contando en la fecha en que se capturó.
    g.dias=g._prog?[...g._d].sort().join(','):'';
    if(!g._prog&&g._last) g.fin=addDays(g._last,7);          // clase que ya no se imparte: no cuenta como “sin captura” después
    const aid=g._aid;
    g.vig=g._dd||null;
    if(g._dd){ const fs=Object.values(g._dd).flat(); if(fs.length&&fs.every(x=>x.f)) g.fin=fs.map(x=>x.f).sort().pop(); }   // ya no se imparte: no cuenta como “sin captura” después
    delete g._dd;
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
    meta:{sexoRegs:regs.filter(r=>fcSexo(r,parseInt(r.asistentes)||0)).length,sexoClaves:[...new Set([...regs,...insts,...sals].flatMap(x=>fcSexoClaves(x).map(c=>c.k)))].slice(0,12),campos:[...new Set(regs.slice(-300).flatMap(r=>Object.keys(r||{})))].slice(0,40),instructores:insts.length,registros:regs.length,grupos:Object.values(gruposPorArea).reduce((n,g)=>n+Object.keys(g).length,0),eventos:evs.length,ultimo}};
}

/* ---------- cuadre con Fitness Control ----------
   Cómo deben fluir los datos:
     · Clases fitness   → se registran en Fitness Control y Gerencia las lee (área Fitness).
     · Gimnasia rítmica → se registra SOLO en Gerencia (área Gimnasia) y Fitness Control la importa
                          (sus registros traen ger_id = id del aforo en Gerencia).
   Por eso debe cumplirse:  total del tablero de Fitness Control  =  Gerencia·Fitness + Gerencia·Gimnasia.
   fcCuadre (pura, igual que fcAdapt) reparte cada registro del período para explicar cualquier diferencia:
   LADO FITNESS (registros de Fitness Control sin ger_id)
     fitness    → Gerencia lo cuenta en Fitness
     excluidas  → clase de Gimnasia capturada directo en Fitness Control (no debería pasar): Gerencia no la cuenta
     sinHora    → sin hora (o 00:00): Gerencia no sabe a qué clase pertenece
     repetidos  → misma clase, instructor, hora y fecha dos veces: Gerencia cuenta solo el último
     otras      → el nombre de la clase coincide con otra área: se cuenta en esa tarjeta
     otroEstado → Gerencia lo cuenta pero Fitness Control no (estado distinto de ok/sub)
   LADO GIMNASIA (aforos de Gerencia ↔ registros importados en Fitness Control)
     igual      → mismo aforo y mismo número en los dos
     distinto   → importado, pero con otro número (coordinación lo corrigió en Fitness Control, o adoptó un registro suyo)
     soloGerAntes → aforo de Gerencia anterior al 6 oct 2026: Fitness Control no importa esas fechas
     soloGer    → aforo de Gerencia que no llegó a Fitness Control (profesora sin instructor con el mismo nombre,
                  o Fitness Control no se ha abierto con la sesión de coordinación desde que se capturó)
     soloFc     → registro importado que en Gerencia ya no existe o se marcó "no hubo clase" (Fitness Control no lo borra) */
const FC_GER_DESDE = '2026-10-06';                           // igual que FECHA_DESDE en gimnasia-gerencia.js de Fitness Control
function fcCuadre(raw,desde,hasta,areaId,gimRecs){
  raw=raw||{};
  const regsAll=fcArr(raw.registros), enRango=r=>r&&r.fecha&&r.fecha>=desde&&r.fecha<=hasta;
  const esManual = r => r.tipo==='falta' || !fcHora(r.hora) || fcHora(r.hora)==='00:00';
  const excluida = a => !!(getArea(a)||{}).fcExcluir;
  const n = r => Math.max(0,parseInt(r.asistentes)||0);
  const gidDe = r => `fc_g${r.inst_id}_${fcNorm(r.clase).replace(/[^a-z0-9]/g,'')}_${fcHora(r.hora).replace(':','')}`;
  const B = () => ({regs:0,asis:0,clases:{},items:[]});
  const instN=Object.fromEntries(fcArr(raw.instructores).map(i=>[String(i.id),String(i.nombre||'')]));
  const item=(r,v,cl,extra)=>({fecha:r.fecha||'',hora:fcHora(r.hora)||'',clase:String(cl||r.clase||''),inst:instN[String(r.inst_id)]||'',asis:v,estado:r.estado||'',...(extra||{})});
  const out={fc:B(),fitness:B(),ger:B(),excluidas:B(),sinHora:B(),repetidos:B(),otroEstado:B(),otras:{},
    gim:{ger:B(),igual:B(),distinto:{regs:0,asisG:0,asisF:0,clases:{}},soloGerAntes:B(),soloGer:B(),soloFc:B()}};
  const suma=(b,r,v,cl,extra)=>{ v=v==null?n(r):v; b.regs++; b.asis+=v; if(b.items&&b.items.length<200) b.items.push(item(r,v,cl,extra)); const k=String(cl||r.clase||r.nombre||'Sin nombre'), c=b.clases[k]=b.clases[k]||{regs:0,asis:0}; c.regs++; c.asis+=v; };
  const bolsa={}, cand=[], gerFc={};
  regsAll.forEach(r=>{
    if(!enRango(r)) return;
    const fcCuenta = r.estado==='ok'||r.estado==='sub';
    if(fcCuenta) suma(out.fc,r);
    if(r.ger_id){ if(fcCuenta){ suma(out.ger,r); (gerFc[String(r.ger_id)]=gerFc[String(r.ger_id)]||[]).push(r); } return; }
    if(r.estado==='falta'||esManual(r)){ if(fcCuenta&&r.estado!=='falta') suma(out.sinHora,r); return; }
    const aid=fcAreaPorDeporte(r.clase,areaId)||areaId;
    if(excluida(aid)){ if(fcCuenta) suma(out.excluidas,r); return; }
    const id=`${gidDe(r)}_${r.fecha}`, prev=bolsa[id];
    if(!(prev&&(+prev.updatedAt||0)>(+r.updatedAt||0))) bolsa[id]=r;
    cand.push({r,id,aid,fcCuenta});
  });
  cand.forEach(({r,id,aid,fcCuenta})=>{
    if(bolsa[id]!==r){ if(fcCuenta) suma(out.repetidos,r,null,null,{queda:n(bolsa[id]),quedaEst:bolsa[id].estado||''}); return; }
    if(!fcCuenta){ if(aid===areaId) suma(out.otroEstado,r); return; }
    if(aid===areaId) suma(out.fitness,r); else suma(out.otras[aid]=out.otras[aid]||B(),r);
  });
  // lado Gimnasia: gimRecs = aforos de Gerencia que cuentan en su tarjeta [{id, fecha, asistentes, clase}]
  const G=out.gim, vistos=new Set();
  (gimRecs||[]).forEach(a=>{
    if(!enRango(a)) return;
    const v=n(a); suma(G.ger,a,v,a.clase);
    const fs=gerFc[String(a.id)];
    if(!fs){ suma(a.fecha<FC_GER_DESDE?G.soloGerAntes:G.soloGer,a,v,a.clase); return; }
    vistos.add(String(a.id));
    const vf=fs.reduce((t,r)=>t+n(r),0);
    if(vf===v&&fs.length===1) suma(G.igual,a,v,a.clase);
    else { const d=G.distinto; d.regs++; d.asisG+=v; d.asisF+=vf; const k=String(a.clase||'Sin nombre'), c=d.clases[k]=d.clases[k]||{regs:0,asis:0}; c.regs++; c.asis+=vf-v; }
  });
  Object.entries(gerFc).forEach(([k,fs])=>{ if(!vistos.has(k)) fs.forEach(r=>suma(G.soloFc,r)); });
  out.fitness.items=[]; out.fc.items=[]; out.ger.items=[]; G.ger.items=[]; G.igual.items=[];
  return out;
}
/* aforos de Gimnasia de Gerencia que suman en su tarjeta (mismo criterio que anCompute: grupo existente y clase impartida) */
function fcGimRecs(){
  const gid=(getArea('gimnasia')&&'gimnasia')||null; if(!gid) return null;
  const gs=Object.fromEntries(grupos(gid).map(g=>[g.id,g]));
  return coll(gid,'asistencia').filter(r=>r&&!r.omitida&&gs[r.grupoId]&&!r.fc).map(r=>({id:r.id,fecha:r.fecha,asistentes:r.asistentes,clase:gs[r.grupoId].nombre}));
}
/* pantalla del cuadre (se usa en Metodología → Fitness y en Ajustes → Fitness Control) */
function fcCuadreHtml(desde,hasta){
  const aid=fcAreaVinculada();
  if(!aid) return empty('Ninguna área está marcada como vinculada a Fitness Control.');
  let raw=(LINKMETA.estado==='ok'&&fcRaw&&fcRaw.registros)?fcRaw:null;
  if(!raw){
    const c=(()=>{ try{ return JSON.parse(localStorage.getItem(FC_CACHE)); }catch(e){ return null; } })();
    raw=c&&c.raw&&c.raw.registros?c.raw:null;
  }
  if(!raw) return empty('Todavía no llegan los registros de Fitness Control. Intenta de nuevo en unos segundos.');
  return fcCuadreTabla(fcCuadre(raw,desde,hasta,aid,fcGimRecs()),aid);
}
function fcCuadreTabla(C,aid){
  const N=x=>(+x||0).toLocaleString('es-MX'), nom=id=>{ const a=getArea(id); return a?a.nombre:id; };
  const sg=x=>(x>0?'+':x<0?'−':'')+N(Math.abs(x));
  const EST={ok:'impartida',sub:'suplencia',falta:'falta'};
  const fF=f=>{ try{ return fmtFecha(f); }catch(e){ return f; } };
  /* lista de registros, para encontrarlos y corregirlos en Registro Fitness */
  const regsTxt=b=>b.items.slice().sort((x,y)=>String(x.fecha).localeCompare(String(y.fecha))||String(x.hora).localeCompare(String(y.hora))).map(x=>
    `<div class="dg-r"><div class="dg-rt"><b>${esc(fF(x.fecha))}${x.hora?' · '+esc(x.hora):''} · ${esc(x.clase||'—')}</b><small>${esc([x.inst,EST[x.estado]||''].filter(Boolean).join(' · '))}${x.queda!=null?` · repetido: se cuenta el otro registro (${N(x.queda)} asistentes${x.quedaEst&&x.quedaEst!==x.estado?', '+esc(EST[x.quedaEst]||x.quedaEst):''})`:''}</small></div><div class="dg-rv"><b>${N(x.asis)}</b><small>asistentes</small></div></div>`).join('')
    +(b.regs>b.items.length?`<div class="dg-r"><div class="dg-rt"><small>… y ${N(b.regs-b.items.length)} más</small></div></div>`:'');
  const clasesTxt=(b,f)=>Object.entries(b.clases).sort((x,y)=>Math.abs(y[1].asis)-Math.abs(x[1].asis)).slice(0,8).map(([k,v])=>`${esc(k)} (${(f||N)(v.asis)})`).join(' · ');
  const fila=(t,expl,b,cls,val,f)=>b.regs?`<details class="dg-a"><summary><div class="dg-t"><b>${t}</b><small>${expl}</small></div><div class="dg-v"><b class="${cls||''}">${val!=null?val:N(b.asis)}</b><small>${plu(b.regs,'registro','registros')}</small></div><span class="dg-chev">${ic('next')}</span></summary>
      <div class="dg-rows">${(b.items&&b.items.length)?regsTxt(b):`<div class="dg-r"><div class="dg-rt"><small>${clasesTxt(b,f)||'—'}</small></div></div>`}</div></details>`:'';
  const G=C.gim, gimNom=nom('gimnasia')||'Gimnasia';
  const otrasAsis=Object.values(C.otras).reduce((s,b)=>s+b.asis,0);
  // tres renglones: clases fitness SIN gimnasia, gimnasia rítmica y total (positivo = Fitness Control tiene de más)
  const fitFc ={a:C.fc.asis-C.ger.asis-C.excluidas.asis, s:C.fc.regs-C.ger.regs-C.excluidas.regs};
  const fitGer={a:C.fitness.asis+C.otroEstado.asis,       s:C.fitness.regs+C.otroEstado.regs};
  const gimFc ={a:C.ger.asis+C.excluidas.asis,            s:C.ger.regs+C.excluidas.regs};
  const gimGer={a:G.ger.asis,                             s:G.ger.regs};
  const totFc ={a:fitFc.a+gimFc.a, s:fitFc.s+gimFc.s}, totGer={a:fitGer.a+gimGer.a, s:fitGer.s+gimGer.s};
  const renglon=(t,f,g,fuerte)=>{ const d=f.a-g.a; return `<tr${fuerte?' class="fcq-tot"':''}><th>${t}</th><td>${N(f.a)}<small>${plu(f.s,'registro','registros')}</small></td><td>${N(g.a)}<small>${plu(g.s,'sesión','sesiones')}</small></td><td class="${d?'bad':'ok'}">${d?sg(d):'✔'}</td></tr>`; };
  const otras=Object.entries(C.otras).map(([id,b])=>fila(`Contadas en ${esc(nom(id))}`,(getArea(id)||{}).tipo==='gimnasio'?'El nombre de la clase coincide con esta área; Gimnasio solo muestra el conteo por hora, así que no salen en ninguna tarjeta de clases.':'El nombre de la clase coincide con esta área: se suman en su tarjeta, no en Fitness.',b,'bad')).join('');
  return `<div class="card mt-res fcq"><table class="fcq-t"><thead><tr><th></th><th>Registro Fitness</th><th>Gerencia</th><th>Diferencia</th></tr></thead><tbody>
      ${renglon('Clases fitness <small>sin gimnasia</small>',fitFc,fitGer)}
      ${renglon(`Gimnasia rítmica`,gimFc,gimGer)}
      ${renglon('Total',totFc,totGer,true)}</tbody></table>
      <div class="mt-sub">Asistentes. Registro Fitness = su tablero; Gerencia = tarjetas ${esc(nom(aid))} + ${esc(gimNom)} de Metodología.</div></div>
    <div class="h2 sm">Clases fitness, sin gimnasia (se registran en Registro Fitness)</div>
    ${fila(`Iguales en las dos apps`,`Registros de Registro Fitness que Gerencia cuenta en ${esc(nom(aid))}.`,C.fitness)}
    ${fila('Registros sin hora','Fitness Control los suma, pero Gerencia no sabe a qué clase pertenecen (sin hora o 00:00).',C.sinHora,'bad')}
    ${fila('Registros repetidos','La misma clase, instructor, hora y fecha aparece dos veces en Registro Fitness: suma las dos; Gerencia solo una. Hay que borrar el repetido en Registro Fitness (toca para ver cuáles).',C.repetidos,'bad')}
    ${otras}
    ${fila('Solo los cuenta Gerencia','Registros con un estado distinto de "impartida" o "suplencia": Gerencia los suma, Fitness Control no.',C.otroEstado,'bad')}
    <div class="h2 sm">Gimnasia rítmica (se registra en Gerencia)</div>
    ${G.ger.regs||C.ger.regs||C.excluidas.regs?'':empty('Sin aforos de gimnasia en este período.')}
    ${fila('Gimnasia capturada en Registro Fitness',`Clases cuyo nombre coincide con ${esc(gimNom)} capturadas directo en Registro Fitness, no en Gerencia. Registro Fitness las suma; Gerencia no, porque la gimnasia solo se registra en Gerencia. Hay que borrarlas en Registro Fitness (o capturarlas en Gerencia si faltan ahí).`,C.excluidas,'bad')}
    ${fila('Iguales en las dos apps','Aforos de Gerencia que Fitness Control importó con el mismo número.',G.igual)}
    ${fila('Importados con otro número','En Fitness Control el número es distinto al de Gerencia: coordinación lo corrigió ahí, o ya existía un registro suyo a esa hora. Se ve en Fitness Control → observaciones de Gimnasia ("Autorizar el de Gerencia").',G.distinto,'bad',sg(G.distinto.asisF-G.distinto.asisG),sg)}
    ${fila('Antes del 6 de octubre','Fitness Control solo importa los aforos de Gimnasia desde el 6 oct 2026: estos están en Gerencia pero no en Fitness Control.',G.soloGerAntes,'bad')}
    ${fila('No llegaron a Fitness Control','Están en Gerencia pero no en Fitness Control: la profesora no tiene un instructor con el mismo nombre en Fitness Control, o Fitness Control no se ha abierto con la sesión de coordinación desde que se capturaron.',G.soloGer,'bad')}
    ${fila('Ya no están en Gerencia','Fitness Control los importó, pero en Gerencia se borraron o se marcaron "no hubo clase". Fitness Control no los quita solo.',G.soloFc,'bad')}`;
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
  if(typeof fcCacheOff!=='undefined'&&fcCacheOff) return;   // no cabe junto con la copia de Gerencia: Gerencia tiene prioridad
  try{
    const c={...raw};
    if(c.instructores) c.instructores=fcArr(c.instructores).map(({foto,pin,PIN,pinHash,...r})=>r);  // sin fotos ni PIN
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
  FC_PARTES.forEach(k=>fcEscuchar(db,k));
}
function fcEscuchar(db,k){
  db.ref(`${FC_NODO}/${k}`).on('value',snap=>{
    fcRaw[k]=snap.val(); fcRecv[k]=true; clearTimeout(fcT);
    fcT=setTimeout(()=>{ if(fcRecv.instructores&&fcRecv.registros){ fcAplicar(fcRaw); fcGuardarCache(fcRaw); } },300);
  },err=>{
    LINKMETA={estado:'error',msg:(err&&err.message)||String(err),n:{},ts:0};
    safeRender();
    // Un listener rechazado (p. ej. la sesión en Fitness aún no estaba lista) no se reintenta solo
    setTimeout(()=>{ (typeof fcSesion==='function'?fcSesion(db.app):Promise.resolve()).then(()=>fcEscuchar(db,k)); },15000);
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
    ${m.estado==='ok'?`<div class="row"><div><b>Hombres y mujeres</b><small>${m.n.sexoRegs?`Los registros de Fitness Control traen el dato en ${(m.n.sexoRegs).toLocaleString('es-MX')} casos${m.n.sexoClaves&&m.n.sexoClaves.length?' (campos: '+esc(m.n.sexoClaves.join(', '))+')':''}; en los demás se aplica la proporción de abajo.`:'Fitness Control no manda hombres y mujeres por clase: se aplica la proporción de abajo.'}</small></div></div>`:''}
    <div class="row"><div><small>La proporción de hombres y mujeres de las clases fitness se ajusta en la ficha del área (Ajustes → Áreas).</small></div></div>
    ${m.estado==='ok'?`<div class="row"><div><b>Cuadre con Fitness Control</b><small>Compara el total del tablero de Fitness Control con Fitness + Gimnasia de Gerencia y explica cualquier diferencia.</small></div><button class="btn sm" data-act="fcCuadreAbrir">Ver cuadre</button></div>`:''}
    ${m.estado==='error'?`<div class="row"><div><b>No se pudo leer</b><small>${esc(m.msg)}. Revisa las reglas de Firebase (LEEME-vinculo.txt).</small></div></div>`:''}
    ${!cfg?`<div class="row"><div><small>Pon <b>CONECTAR_FIREBASE = true</b> en <b>js/config.js</b> para conectar la base de datos y activar el vínculo.</small></div></div>`:''}
    <div class="row"><div><small>Gerencia solo lee. Nunca escribe en Fitness Control y no copia los PIN de los instructores.</small></div></div>
    ${propios&&m.estado==='ok'?`<div class="row"><div><b>Datos manuales duplicados</b><small>Esta área tiene ${propios} registros capturados a mano en Gerencia que ya vienen de Fitness Control.</small></div><button class="btn sm danger" data-act="fcLimpiar">Quitar</button></div>`:''}
  </div>`;
}
function fcCuadreModal(){
  const t=todayStr(), d=ui.fcCq||{desde:t.slice(0,8)+'01',hasta:t};
  openModal(`${mHead('Cuadre con Fitness Control')}
    <div class="two"><label class="f"><span>Desde</span><input id="fcq_desde" type="date" max="${t}" value="${esc(d.desde)}"></label><label class="f"><span>Hasta</span><input id="fcq_hasta" type="date" max="${t}" value="${esc(d.hasta)}"></label></div>
    <div class="btns" style="margin-bottom:10px"><button class="btn primary" data-act="fcCuadreAbrir" data-leer="1">Calcular</button></div>
    ${fcCuadreHtml(d.desde,d.hasta)}
    <div class="btns"><button class="btn" data-act="closeModal">Cerrar</button></div>`);
}
Object.assign(actions,{
  fcCuadreAbrir(d){
    if(d&&d.leer){
      let a=($('#fcq_desde')||{}).value, b=($('#fcq_hasta')||{}).value;
      if(a&&b){ if(a>b){ const x=a; a=b; b=x; } ui.fcCq={desde:a,hasta:b}; }
    }
    fcCuadreModal();
  },
  fitHoGuardar(){
    const v=Math.round(+(($('#fit_ho')||{}).value)); if(isNaN(v)||v<0||v>100){ toast('Escribe un porcentaje de hombres entre 0 y 100'); return; }
    setPath('cfg/fitHo',v); render(); toast(`Proporción guardada: ${v}% hombres · ${100-v}% mujeres`);
  },
  fcLimpiar(){
    const aid=fcAreaVinculada(); if(!aid) return;
    if(!confirm('¿Quitar los profesores, grupos y asistencia capturados a mano en esta área? Los que vienen de Fitness Control no se tocan.')) return;
    ['profesores','grupos','asistencia'].forEach(k=>setPath(`data/${aid}/${k}`,undefined));
    render(); toast('Datos manuales quitados');
  }
});
