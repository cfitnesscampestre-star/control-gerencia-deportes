'use strict';
/* =====================================================================
   mantenimiento.js — Control Mantenimiento → Gerencia (SOLO LECTURA)
   Lee en tiempo real la base de Control Mantenimiento (proyecto registro-mantenimiento) y la muestra
   en una pestaña "Mantenimiento" del área vinculada a Fitness Control, y en el resumen de gerencia:
     /reportes    reportes abiertos que mandan los instructores desde Control Fitness
     /equipos, /salones, /preventivo
   Gerencia NUNCA escribe en esa base. Los reportes los atiende el técnico en su app.
   Cada reporte se muestra SOLO en el área del instructor que lo mandó. Por ahora el único origen es Control Fitness:
   se reconoce porque el reporte trae origen:'fitness' o porque su profId es el número de instructor de Fitness Control.
   Los reportes de ejemplo o de prueba (profId de texto) y los que no son de Fitness no se muestran en Gerencia.
   Para sumar otras disciplinas más adelante, se agrega su origen en mantArea().
   ===================================================================== */
const MANT_NODOS = ['salones','equipos','reportes','preventivo'];
const MANT_CACHE = 'gd_mant_cache_v1';
const MANT_UMBRAL = { normal:24, urgente:4, fuera:2 };          // horas sin atender antes de ponerse en rojo (igual que la app de mantenimiento)
const MANT_URG = { normal:'Normal', urgente:'Urgente', fuera:'No se puede usar' };
let mantRaw = { salones:null, equipos:null, reportes:null, preventivo:null, historial:null }, mantMeta = { estado:'sin', msg:'' }, mantT = null;

if(typeof ICONS!=='undefined') ICONS.llave = '<path d="M14.5 6.5a4 4 0 0 0-5 5L4 17l3 3 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z"/>';
try{ const c=JSON.parse(localStorage.getItem(MANT_CACHE)||'null'); if(c&&c.raw){ mantRaw=Object.assign(mantRaw,c.raw); mantMeta={estado:'cache',msg:''}; } }catch(e){}

function mantConectar(db){
  if(mantMeta.estado!=='cache') mantMeta={estado:'conectando',msg:''};
  MANT_NODOS.forEach(k=>{
    db.ref(k).on('value',snap=>{
      mantRaw[k]=snap.val()||{}; mantMeta={estado:'ok',msg:''}; clearTimeout(mantT);
      mantT=setTimeout(()=>{ try{ localStorage.setItem(MANT_CACHE,JSON.stringify({ts:Date.now(),raw:mantRaw})); }catch(e){} safeRender(); },250);
    },err=>{ mantMeta={estado:'error',msg:(err&&err.message)||String(err)}; safeRender(); });
  });
  db.ref('historial').limitToLast(200).on('value',snap=>{            // reportes que el instructor ya cerró (para contar los atendidos)
    mantRaw.historial=snap.val()||{}; clearTimeout(mantT);
    mantT=setTimeout(()=>{ try{ localStorage.setItem(MANT_CACHE,JSON.stringify({ts:Date.now(),raw:mantRaw})); }catch(e){} safeRender(); },250);
  },()=>{});
}

/* ---------- datos ---------- */
const mantAplica = aid => !!aid && !!(typeof FIREBASE_CONFIG_MANT!=='undefined'&&FIREBASE_CONFIG_MANT.databaseURL) && typeof esFitArea==='function' && esFitArea(aid);
const mantArr = k => Object.keys(mantRaw[k]||{}).map(id=>Object.assign({id},mantRaw[k][id]));
const mantEq = id => Object.assign({nombre:'Equipo (eliminado)',salonId:''},(mantRaw.equipos||{})[id]||{});
const mantSalon = id => Object.assign({nombre:'—',area:''},(mantRaw.salones||{})[id]||{});
const mantVence = r => r.estado==='nuevo' && (Date.now()-r.creado)/36e5 > (MANT_UMBRAL[r.urg]||24);
/* ¿De qué área es un reporte? Hoy solo hay Fitness. Devuelve el id del área o null (no se muestra en Gerencia). */
const mantEsFitness = r => r.origen==='fitness' || (r.origen==null && /^\d+$/.test(String(r.profId==null?'':r.profId)));
function mantArea(r){ return mantEsFitness(r) && typeof fcAreaVinculada==='function' ? fcAreaVinculada() : null; }
const mantDe = (aid,r) => !!aid && mantArea(r)===aid;
const mantArrP = v => Array.isArray(v) ? v : v ? Object.values(v) : [];
function mantHace(ts){
  const m=Math.max(0,Math.round((Date.now()-ts)/6e4));
  if(m<60) return 'hace '+m+' min';
  const h=Math.round(m/60); if(h<48) return 'hace '+h+' h';
  return 'hace '+Math.round(h/24)+' días';
}
function mantStats(aid){
  const rs=mantAplica(aid)?mantArr('reportes').filter(r=>mantDe(aid,r)):[], pv=mantAplica(aid)?mantArr('preventivo'):[];
  const hoy=new Date(); hoy.setHours(0,0,0,0);
  const dias=p=>Math.round((p.proxima-hoy.getTime())/864e5);
  const compras=rs.filter(r=>(r.compra||r.cambio)&&r.estado!=='resuelto');
  const hace30=Date.now()-30*864e5;
  const cer=mantAplica(aid)?Object.keys(mantRaw.historial||{}).map(id=>mantRaw.historial[id]).filter(r=>mantDe(aid,r)&&(r.cerrado||0)>=hace30).length:0;
  return {
    rs, cer,
    rojos:rs.filter(mantVence),
    proceso:rs.filter(r=>r.estado!=='resuelto'&&!mantVence(r)),
    res:rs.filter(r=>r.estado==='resuelto'),
    ven:pv.filter(p=>dias(p)<0).sort((a,b)=>a.proxima-b.proxima), dias,
    posp:pv.reduce((n,p)=>n+mantArrP(p.posp).length,0),
    compras, total:compras.reduce((n,r)=>n+(parseFloat(r.costo)||0),0)
  };
}

/* ---------- vistas ---------- */
function mantPillRep(r){
  return r.estado==='resuelto'?pill('Resuelto','ok'):mantVence(r)?pill('Sin atender','bad'):r.estado==='atencion'?pill('En atención','warn'):pill('Nuevo','info');
}
function mantRepRow(r){
  const e=mantEq(r.equipoId), s=mantSalon(e.salonId);
  const sm=[];
  sm.push(`${esc(s.nombre)} · ${esc(r.prof||'Instructor')}${r.clase?' · '+esc(r.clase):''} · ${mantHace(r.creado)}`);
  if(r.otroLugar) sm.push('<b>Reportado desde otro salón</b>');
  if(r.diag) sm.push(`<b>Diagnóstico:</b> ${esc(r.diag)}`);
  if(r.compra||r.cambio) sm.push(`${r.compra?'Requiere compra':''}${r.compra&&r.cambio?' · ':''}${r.cambio?'Requiere cambio':''}${r.costo?' · estimado $'+esc(r.costo):''}`);
  return `<div class="card"><div class="row" style="align-items:flex-start;gap:10px"><div style="min-width:0;flex:1"><b>${esc(e.nombre)}</b><small>${esc(r.desc||'')}</small>${sm.map(t=>`<small>${t}</small>`).join('')}</div>
    <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;flex:none">${mantPillRep(r)}${r.urg&&r.urg!=='normal'?pill(MANT_URG[r.urg]||r.urg,'warn'):''}</div></div></div>`;
}
function mantOrden(a,b){ const k=r=>mantVence(r)?0:r.estado==='nuevo'?1:r.estado==='atencion'?2:3; return k(a)-k(b)||a.creado-b.creado; }
function mantBanner(){
  const m=mantMeta, ok=m.estado==='ok';
  return `<div class="vinc ${ok?'':'off'}"><b>${ok?'Datos de Control Mantenimiento':m.estado==='error'?'No se pudo leer Control Mantenimiento':m.estado==='cache'?'Copia guardada de Control Mantenimiento':'Conectando con Control Mantenimiento…'}</b>
    <span>${ok?'Solo lectura · se actualiza solo. Los reportes los mandan los instructores desde Control Fitness y los atiende el técnico.':m.estado==='error'?esc(m.msg):m.estado==='cache'?'Se muestra lo último que se recibió en este equipo.':'Un momento…'}</span></div>`;
}
function vMantenimiento(aid){
  if(!mantAplica(aid)) return empty('Mantenimiento solo está conectado con el área de Fitness por ahora.');
  const S=mantStats(aid), rs=S.rs.filter(r=>r.estado!=='resuelto').sort(mantOrden);
  return `<div class="dash limpio">${mantBanner()}
    <div class="kpis k3">
      ${kpi('En rojo',S.rojos.length,'sin atender a tiempo',{cls:S.rojos.length?'bad':'ok',color:'var(--bad)'})}
      ${kpi('En proceso',S.proceso.length,'nuevos o en atención',{color:'var(--b2)'})}
      ${kpi('Por cerrar',S.res.length,'resueltos, el instructor los quita',{cls:'ok',color:'var(--b1)'})}
    </div>
    <div class="kpis k3">
      ${kpi('Preventivos vencidos',S.ven.length,S.ven.length?'revisión atrasada':'al corriente',{cls:S.ven.length?'bad':'ok',color:'var(--bad)'})}
      ${kpi('Pospuestos',S.posp,'veces que se movió una revisión',{color:'var(--b3)'})}
      ${kpi('Compras o cambios',S.compras.length,S.total?'estimado $'+S.total.toLocaleString('es-MX'):'por autorizar',{color:'var(--b2)'})}
    </div>
    <div class="h2">Reportes abiertos</div>
    ${rs.length?rs.map(mantRepRow).join(''):empty('No hay reportes abiertos. Todo en orden.')}
    <div class="h2">Resueltos, por cerrar</div>
    ${S.res.length?S.res.map(mantRepRow).join(''):empty('No hay reportes resueltos esperando cierre.')}
    <div class="h2">Preventivos vencidos</div>
    ${S.ven.length?S.ven.map(p=>{ const n=-S.dias(p); return `<div class="card"><div class="row" style="align-items:flex-start;gap:10px"><div style="min-width:0;flex:1"><b>${esc(p.titulo||'Revisión')}</b>${p.detalle?`<small>${esc(p.detalle)}</small>`:''}${p.salonId?`<small>${esc(mantSalon(p.salonId).nombre)}</small>`:''}<small>Venció hace ${n} ${n===1?'día':'días'}</small></div>${pill('Vencido','bad')}</div></div>`; }).join(''):empty('Todo el preventivo va al corriente.')}
  </div>`;
}
/* Resumen general para gerencia: cuántos reportes hay sin atender, en proceso y atendidos, y por área. */
function mantResumenGerencia(){
  const aids=(typeof areasList==='function'?areasList().map(a=>a.id):[]).filter(mantAplica); if(!aids.length) return '';
  const st=aids.map(aid=>({aid,a:getArea(aid),S:mantStats(aid)}));
  const sum=f=>st.reduce((n,x)=>n+f(x.S),0);
  const rojos=sum(S=>S.rojos.length), proc=sum(S=>S.proceso.length), res=sum(S=>S.res.length), cer=sum(S=>S.cer), ven=sum(S=>S.ven.length), comp=sum(S=>S.compras.length);
  return `<div class="h2">Mantenimiento</div>
    <div class="kpis k3">
      ${kpi('Sin atender',rojos,rojos?'problemas en rojo':'sin problemas',{cls:rojos?'bad':'ok',color:'var(--bad)'})}
      ${kpi('En proceso',proc,'nuevos o en atención',{color:'var(--b2)'})}
      ${kpi('Atendidos',res+cer,`${res} por cerrar · ${cer} cerrados en 30 días`,{cls:'ok',color:'var(--b1)'})}
    </div>
    ${st.map(x=>`<button class="line" style="--ac:${x.a.color}" data-act="openArea" data-id="${esc(x.aid)}" data-tab="mantenimiento">
      <div class="t">${ic('llave')}</div>
      <div class="b"><b>${esc(x.a.nombre)}</b><small>${plu(x.S.rojos.length,'reporte en rojo','reportes en rojo')} · ${plu(x.S.ven.length,'preventivo vencido','preventivos vencidos')} · ${plu(x.S.compras.length,'compra pendiente','compras pendientes')}</small></div>
      <div class="r">${x.S.rojos.length||x.S.ven.length?pill('atención','bad'):pill('al día','ok')}</div></button>`).join('')}`;
}
/* Tarjeta de estado en Ajustes */
function mantCard(){
  const cfg=!!(typeof FIREBASE_CONFIG_MANT!=='undefined'&&FIREBASE_CONFIG_MANT.databaseURL), m=mantMeta;
  const est=!cfg?['mut','Sin configurar']:m.estado==='ok'?['ok','Conectado']:m.estado==='error'?['bad','Error']:m.estado==='cache'?['warn','Copia guardada']:['warn','Conectando…'];
  return `<div class="card">
    <div class="row"><div><b>Control Mantenimiento</b><small>Solo lectura · reportes de equipo y preventivo de Fitness</small></div>${pill(est[1],est[0])}</div>
    ${m.estado==='ok'||m.estado==='cache'?`<div class="row"><div><b>Datos recibidos</b><small>${plu(mantArr('reportes').length,'reporte abierto','reportes abiertos')} · ${plu(mantArr('equipos').length,'equipo','equipos')} · ${plu(mantArr('preventivo').length,'revisión de preventivo','revisiones de preventivo')}</small></div></div>`:''}
    ${m.estado==='error'?`<div class="row"><div><b>No se pudo leer</b><small>${esc(m.msg)}. Revisa las reglas de Firebase del proyecto de mantenimiento.</small></div></div>`:''}
    <div class="row"><div><small>Gerencia solo lee. Nunca escribe en la base de Control Mantenimiento.</small></div></div>
  </div>`;
}
/* Menús: la pestaña "Mantenimiento" solo existe en el área vinculada a Fitness */
function navDir(){ return mantAplica(session&&session.area)?NAV_DIR.concat([{id:'mantenimiento',label:'Mantenimiento',ic:'llave'}]):NAV_DIR; }
function navMDir(){ return mantAplica(session&&session.area)?NAV_M_DIR.concat([{id:'mantenimiento',label:'Manten.',ic:'llave',tabs:['mantenimiento']}]):NAV_M_DIR; }
