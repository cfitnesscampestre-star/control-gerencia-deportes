'use strict';
/* =====================================================================
   mantprof.js — pestaña "Mantenimiento" del portal del profesor de Gerencia.
   Es el mismo módulo que usan los instructores en Control Fitness: elegir el salón (o escanear el QR del equipo),
   buscar el equipo, elegir la falla y la urgencia, y enviar. "Mis reportes" muestra cómo va cada uno.

   Quién lo ve:  1) Gerencia deportiva activa Mantenimiento en el ÁREA (Ajustes → Mantenimiento por área).
                 2) La dirección lo activa en cada PROFESOR (Profesores → editar → Mantenimiento).
   Lee el catálogo (salones y equipos) y los reportes con la conexión de mantenimiento.js (mantRaw / mantDb).
   Escribe SOLO en la base de Control Mantenimiento, en:
     reportes/{clave nueva}                         (alta de un reporte)
     reportes/{id}=null + historial/{id}={...}      (cuando el profesor elimina un aviso ya resuelto)
   Cada reporte lleva origen:'gerencia' y areaId: así lo reconoce mantenimiento.js y lo manda a la dirección de esa área.
   ===================================================================== */
const MP_FALLAS = ['No enciende','Ruido extraño','Flojo o roto','Falta pieza'];
const MP_COLA = 'gd_mant_cola_v1';
const MP_WEB = 'https://cfitnesscampestre-star.github.io/control-mantenimiento/';      // las fotos de los equipos viven en el repositorio de Control Mantenimiento
const mp = { vista:'reportar', salonManual:null, salonQR:false, eligiendo:false, sel:null, todo:false, q:'', chips:[], texto:'', urg:'normal', forzar:false, enviando:false, scan:null };

if(typeof ICONS!=='undefined'){ ICONS.camara = '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'; }

/* ---------- ¿lo ve este profesor? ---------- */
function mantProfActivo(){
  if(!session||session.rol!=='prof'||fcId(session.profId)) return false;
  const p=getProf(session.area,session.profId);
  return !!(p&&p.mantenimiento&&typeof mantAplica==='function'&&mantAplica(session.area));
}
const NAV_PROF_MANT = {id:'mant',label:'Mantenimiento',ic:'llave'}, NAV_M_PROF_MANT = {id:'mant',label:'Manten.',ic:'llave',tabs:['mant']};
const navProfExtra = base => mantProfActivo() ? base.concat([NAV_PROF_MANT]) : base;
const navMProfExtra = base => mantProfActivo() ? base.concat([NAV_M_PROF_MANT]) : base;

/* ---------- utilidades ---------- */
const mpNorm = s => String(s==null?'':s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
const mpCompacto = s => mpNorm(s).replace(/[^a-z0-9]/g,'');
const mpTokens = s => mpNorm(s).split(/[^a-z0-9]+/).filter(t=>t&&t!=='salon'&&t!=='sala');
const mpSalones = () => mantRaw.salones||null;
const mpEquipos = () => mantRaw.equipos||null;
const mpCatalogoListo = () => !!(mpSalones()&&mpEquipos());
function mpHace(ms){
  const m=Math.floor(ms/60000);
  if(m<1) return 'hace un momento';
  if(m<60) return `hace ${m} min`;
  const h=Math.floor(m/60); if(h<48) return `hace ${h} h`;
  return `hace ${Math.floor(h/24)} d`;
}
const mpUrlFoto = f => (typeof f==='string'&&f.trim()) ? (/^(data:image|https?:)/.test(f)?f:MP_WEB+'img/equipos/'+encodeURIComponent(f.trim())) : null;
const mpLeerCola = () => { try{ return JSON.parse(localStorage.getItem(MP_COLA)||'[]'); }catch(e){ return []; } };
const mpGuardarCola = a => { try{ localStorage.setItem(MP_COLA,JSON.stringify(a)); }catch(e){} };
const mpTimeout = ms => new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),ms));

/* salón de Gerencia (texto del lugar de la clase) ↔ salón de Mantenimiento */
function mpMatchSalon(nombre){
  const S=mpSalones()||{}, arr=Object.keys(S).map(id=>({id,nombre:(S[id]||{}).nombre||''}));
  if(!arr.length||!nombre) return null;
  const nf=mpCompacto(nombre);
  let hit=arr.filter(s=>mpCompacto(s.nombre)===nf);
  if(hit.length===1) return hit[0];
  const A=mpTokens(nombre); if(!A.length) return null;
  hit=arr.filter(s=>{ const B=mpTokens(s.nombre); return B.length===A.length&&B.every(t=>A.includes(t)); });
  if(hit.length===1) return hit[0];
  hit=arr.filter(s=>{ const B=mpTokens(s.nombre); return B.length&&(A.every(t=>B.includes(t))||B.every(t=>A.includes(t))); });
  return hit.length===1?hit[0]:null;
}
/* clases de hoy del profesor (de 10 min antes del inicio hasta 60 min después, o hasta que termina) */
function mpClasesHoy(){
  const aid=session.area, pid=session.profId, fecha=todayStr();
  return clasesDe(aid,pid).filter(g=>progEn(g,fecha)&&daClase(g,pid,fecha)).map(g=>gDia(g,fecha)).sort(byHora);
}
function mpCtx(){
  const now=new Date(), m=now.getHours()*60+now.getMinutes();
  const g=mpClasesHoy().find(x=>{ const s=minutos(x.hi); if(s==null) return false; const e=x.hf?minutos(x.hf):null; return m>=s-10&&m<Math.max(s+60,e||0); })||null;
  const S=mpSalones()||{};
  let salonId=null, salonNombre=null, nota='';
  if(mp.salonManual&&S[mp.salonManual]){ salonId=mp.salonManual; salonNombre=S[salonId].nombre; }
  else if(g){
    const ms=g.lugar?mpMatchSalon(g.lugar):null;
    if(ms){ salonId=ms.id; salonNombre=ms.nombre; }
    else nota=g.lugar?`No encontré "${g.lugar}" en la lista de mantenimiento.`:`La clase ${g.nombre} no tiene lugar asignado.`;
  }
  return {g, clase:g?g.nombre:'Fuera de clase', hora:g?(g.hi||''):'', salonId, salonNombre, nota};
}
const mpTodos = () => Object.keys(mantRaw.reportes||{}).map(id=>Object.assign({id},mantRaw.reportes[id])).filter(r=>r&&r.estado);
const mpMios = () => mpTodos().filter(r=>r.origen==='gerencia'&&String(r.profId)===String(session.profId)&&r.areaId===session.area);
function mpAbierto(equipoId){                         // reporte abierto (no resuelto) de ese equipo, de cualquier profesor, o uno propio por enviar
  if(!equipoId) return null;
  const r=mpTodos().find(x=>String(x.equipoId)===String(equipoId)&&x.estado!=='resuelto');
  if(r) return r;
  const c=mpLeerCola().find(x=>x.rep&&String(x.rep.equipoId)===String(equipoId));
  return c?Object.assign({enCola:true},c.rep):null;
}

/* ---------- avisos: equipos en mantenimiento en los salones de las clases de hoy ---------- */
function mantAvisoProf(){
  if(!mantProfActivo()||!mpCatalogoListo()) return '';
  const now=new Date(), m=now.getHours()*60+now.getMinutes(), E=mpEquipos();
  const porSalon={};
  mpClasesHoy().filter(g=>{ const s=minutos(g.hi); return s!=null&&m<s+60; }).forEach(g=>{
    const ms=g.lugar?mpMatchSalon(g.lugar):null; if(!ms) return;
    (porSalon[ms.id]=porSalon[ms.id]||{nombre:ms.nombre,clases:[]}).clases.push(`${g.hi} ${g.nombre}`);
  });
  const abiertos=mpTodos().filter(r=>r.estado!=='resuelto');
  return Object.keys(porSalon).map(sid=>{
    const lista=abiertos.filter(r=>{ const eq=E[r.equipoId]; return String(eq&&eq.salonId!=null?eq.salonId:r.salonId)===String(sid); });
    if(!lista.length) return '';
    const nom=r=>(E[r.equipoId]&&E[r.equipoId].nombre)||'Equipo', fuera=lista.some(r=>r.urg==='fuera');
    const items=lista.slice(0,4).map(r=>`${esc(nom(r))} <em>(${r.urg==='fuera'?'fuera de servicio':r.estado==='atencion'?'en reparación':'reportado'})</em>`);
    if(lista.length>4) items.push(`y ${lista.length-4} más`);
    return `<div class="mp-av ${fuera?'fuera':'otro'}"><span>${fuera?'⛔':'🔧'}</span><div><b>${esc(porSalon[sid].nombre)} · ${esc(porSalon[sid].clases[0])}</b>${items.join(' · ')}</div></div>`;
  }).join('');
}

/* ---------- pantalla ---------- */
function mpEquipoHTML(e,solo){
  const S=mpSalones()||{}, sal=S[e.salonId]?S[e.salonId].nombre:'', uf=mpUrlFoto(e.foto);
  const foto=uf?`<img loading="lazy" src="${esc(uf)}" alt="" onerror="this.style.visibility='hidden'">`:'<div class="mp-ph">🏋</div>';
  const ab=mpAbierto(e.id);
  const marca=ab?`<small class="${ab.urg==='fuera'?'bad':'warn'}">${ab.urg==='fuera'?'⛔ Fuera de servicio':'⚠ Ya reportado'}</small>`:'';
  return `<button class="mp-eq" data-act="${solo?'mpNoop':'mpEq'}" data-id="${esc(e.id)}"${solo?' style="cursor:default;margin:0 0 6px"':''}>${foto}<span>${esc(e.nombre)}${mp.todo&&sal?`<small>${esc(sal)}</small>`:''}${marca}</span></button>`;
}
function mpListaHTML(ctx){
  const q=mpNorm(mp.q), E=mpEquipos()||{};
  const arr=Object.keys(E).map(id=>Object.assign({id},E[id])).filter(e=>e&&e.nombre)
    .filter(e=>mp.todo||(ctx.salonId!=null&&String(e.salonId)===String(ctx.salonId)))
    .filter(e=>!q||mpNorm(e.nombre).includes(q))
    .sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre),'es',{numeric:true}));
  return arr.length?arr.map(e=>mpEquipoHTML(e)).join(''):`<div class="empty">${mp.q?'Sin resultados para esa búsqueda.':'No hay equipos registrados en este salón.'}</div>`;
}
function mpBotonOk(ctx){
  return !mp.enviando&&!!mp.sel&&ctx.salonId!=null&&!!(mp.chips.length||mp.texto.trim())&&!(mpAbierto(mp.sel)&&!mp.forzar);
}
function mpReportar(){
  if(!mpCatalogoListo()) return '<div class="empty">Cargando equipos…</div>';
  const ctx=mpCtx(), cola=mpLeerCola(), E=mpEquipos();
  let h=mantAvisoProf();
  if(cola.length) h+=`<div class="mp-aviso">⏳ ${plu(cola.length,'reporte','reportes')} por enviar. Se enviará${cola.length>1?'n':''} solo al volver la señal.</div>`;
  if(navigator.onLine===false) h+='<div class="mp-aviso">📡 Sin internet. Puedes capturar el reporte: se enviará cuando vuelva la señal.</div>';
  if(ctx.salonId!=null&&!mp.eligiendo){
    h+=`<div class="card mp-ctx"><small class="mut">${ctx.g?'CLASE EN CURSO':'SALÓN ELEGIDO'}</small>
      <div class="mp-big">${ctx.g?esc(ctx.clase)+(ctx.hora?' · '+esc(ctx.hora):''):esc(ctx.salonNombre)}</div>
      ${ctx.g?`<div class="sub" style="margin:2px 0 0">📍 ${esc(ctx.salonNombre)}</div>`:''}
      <button class="mp-link" data-act="mpCambiarSalon">Cambiar salón</button></div>`;
  } else {
    const S=mpSalones(), sals=Object.keys(S).map(id=>({id,n:(S[id]||{}).nombre||id})).sort((a,b)=>a.n.localeCompare(b.n,'es'));
    return h+`<div class="card"><div class="mp-big">${ctx.g?esc(ctx.clase)+' · '+esc(ctx.hora):'No hay clase en curso'}</div>
      <div class="sub">${esc(ctx.nota)||'Elige el salón donde está el equipo.'}</div>
      <button class="mp-qr" data-act="mpQr">${ic('camara')} Escanear código QR del equipo</button>
      <div class="sub" style="text-align:center;margin:8px 0 0">o elige el salón:</div>
      <div class="chips" style="flex-wrap:wrap;overflow:visible">${sals.map(s=>`<button class="chip" data-act="mpSalon" data-id="${esc(s.id)}">${esc(s.n)}</button>`).join('')||'<span class="sub">Sin salones disponibles.</span>'}</div></div>`;
  }
  const eq=mp.sel&&E[mp.sel]?Object.assign({id:mp.sel},E[mp.sel]):null;
  h+='<div class="mp-lbl">1 · Equipo</div>';
  if(eq){
    h+=`<div class="card">${mpEquipoHTML(eq,true)}<button class="mp-link" data-act="mpCambiarEq">Cambiar equipo</button></div>`;
    const ab=mpAbierto(mp.sel);
    if(ab){
      const quien=ab.enCola?'tú (por enviar)':(ab.origen==='gerencia'&&String(ab.profId)===String(session.profId)?'ti':(ab.prof||'otro profesor'));
      const est=ab.enCola?'por enviar':(ab.estado==='atencion'?'ya lo está atendiendo mantenimiento':'mantenimiento aún no lo abre');
      h+=`<div class="mp-aviso mal"><b>⚠ Este equipo ya fue reportado</b><br>${esc(ab.desc||'')}<br><small>Por ${esc(quien)}${ab.creado?' · '+mpHace(Date.now()-ab.creado):''} · ${est}</small>
        ${mp.forzar?'':'<br><button class="mp-link" data-act="mpForzar">Es otra falla distinta, reportar de todos modos</button>'}</div>`;
    }
  } else {
    h+=`<button class="mp-qr" data-act="mpQr">${ic('camara')} Escanear código QR del equipo</button>
      <div class="sub" style="text-align:center;margin:6px 0 10px">o búscalo por nombre</div>
      <input id="mp_q" class="mp-in" type="search" placeholder="🔍 Buscar equipo…" value="${esc(mp.q)}" autocomplete="off" style="margin-bottom:10px">
      <div id="mp_lista">${mpListaHTML(ctx)}</div>
      <button class="mp-link" data-act="mpTodo">${mp.todo?`← Ver solo equipos de ${esc(ctx.salonNombre)}`:'Mi equipo no está en esta lista'}</button>`;
  }
  h+=`<div class="mp-lbl">2 · ¿Qué falla tiene?</div><div class="chips" style="flex-wrap:wrap;overflow:visible">${MP_FALLAS.map(f=>`<button class="chip${mp.chips.includes(f)?' on':''}" data-act="mpChip" data-id="${esc(f)}">${esc(f)}</button>`).join('')}</div>
    <textarea id="mp_txt" class="mp-in" rows="3" placeholder="Describe la falla (opcional si elegiste una arriba)">${esc(mp.texto)}</textarea>
    <div class="mp-lbl">3 · Urgencia</div>
    <div class="mp-urg">${['normal','urgente','fuera'].map(u=>`<button class="${u}${mp.urg===u?' on':''}" data-act="mpUrg" data-id="${u}">${MANT_URG[u]}</button>`).join('')}</div>
    <button id="mp_enviar" class="btn primary block mp-send" data-act="mpEnviar"${mpBotonOk(ctx)?'':' disabled'}>${mp.enviando?'Enviando…':'Enviar a mantenimiento'}</button>`;
  return h;
}
function mpMis(){
  const E=mpEquipos()||{}, S=mpSalones()||{};
  const nombreEq=id=>(E[id]&&E[id].nombre)||'Equipo', nombreSal=id=>(S[id]&&S[id].nombre)||'';
  let h='';
  mpLeerCola().filter(x=>String(x.rep.profId)===String(session.profId)).forEach(x=>{
    h+=`<div class="mp-rep cola"><div class="mp-rep-h"><b>${esc(nombreEq(x.rep.equipoId))}</b><span class="mp-tag warn">⏳ Por enviar</span></div><div class="sub" style="margin:2px 0 0">${esc(x.rep.desc)}</div></div>`;
  });
  mpMios().sort((a,b)=>(b.creado||0)-(a.creado||0)).forEach(r=>{
    const clase=r.estado==='nuevo'?'rojo':r.estado==='atencion'?'amar':'verde';
    const tag=r.estado==='nuevo'?'<span class="mp-tag bad">🔴 Sin abrir · esperando a mantenimiento</span>':r.estado==='atencion'?'<span class="mp-tag warn">🟡 En atención</span>':'<span class="mp-tag ok">🟢 Resuelto</span>';
    h+=`<div class="mp-rep ${clase}"><div class="mp-rep-h"><b>${esc(nombreEq(r.equipoId))}</b>${r.urg&&r.urg!=='normal'?`<span class="mp-tag ${r.urg==='fuera'?'bad':'warn'}">${esc(MANT_URG[r.urg])}</span>`:''}</div>
      <div class="mp-d">${esc(r.desc||'')}</div>
      <small>${esc(nombreSal(r.salonId))}${r.clase&&r.clase!=='Fuera de clase'?' · '+esc(r.clase):''} · ${mpHace(Date.now()-(r.creado||Date.now()))}</small>
      <div style="margin-top:6px">${tag}</div>
      ${(r.estado==='atencion'||r.estado==='resuelto')&&r.diag?`<div class="mp-diag"><b>Diagnóstico:</b> ${esc(r.diag)}</div>`:''}
      ${r.estado==='resuelto'?`<button class="btn sm" style="margin-top:10px" data-act="mpEliminar" data-id="${esc(r.id)}">Eliminar aviso</button>`:''}</div>`;
  });
  return h||'<div class="empty">No tienes reportes abiertos.<br>Cuando reportes un equipo aparecerá aquí.</div>';
}
function vMantProf(){
  if(!mantConfig()) return empty('Control Mantenimiento no está conectado.');
  const n=mpMios().filter(r=>r.estado==='resuelto').length;
  return `<div class="mantv mantp"><div class="seg" style="margin-bottom:12px">
      <button class="${mp.vista==='reportar'?'on':''}" data-act="mpVista" data-id="reportar">🔧 Reportar equipo</button>
      <button class="${mp.vista==='mis'?'on':''}" data-act="mpVista" data-id="mis">📋 Mis reportes${n?` <span class="mp-cnt">${n}</span>`:''}</button></div>
    ${mp.vista==='mis'?mpMis():mpReportar()}</div>`;
}

/* ---------- enviar (con cola sin internet) ---------- */
let mpVaciando=false;
async function mpVaciarCola(){
  if(mpVaciando||!mpLeerCola().length||navigator.onLine===false||!mantDb) return 0;
  mpVaciando=true; let n=0;
  try{
    for(const it of mpLeerCola()){
      let cola=mpLeerCola(); const i=cola.findIndex(x=>x.local===it.local); if(i<0) continue;
      if(!cola[i].key){ cola[i].key=mantDb.ref('reportes').push().key; mpGuardarCola(cola); }
      const ref=mantDb.ref('reportes/'+cola[i].key);
      await Promise.race([ref.transaction(cur=>(cur===null?it.rep:undefined),undefined,false),mpTimeout(10000)]);   // solo escribe si la clave aún no existe
      mpGuardarCola(mpLeerCola().filter(x=>x.local!==it.local)); n++;
    }
  }catch(e){ console.warn('[Mant] cola pendiente:',e&&e.message); }
  mpVaciando=false; return n;
}
async function mpEnviar(){
  if(mp.enviando) return;
  const ctx=mpCtx(), E=mpEquipos()||{}, eq=mp.sel?E[mp.sel]:null, p=getProf(session.area,session.profId);
  const desc=[mp.chips.join(', '),mp.texto.trim()].filter(Boolean).join('. ');
  if(!p||!eq||ctx.salonId==null||!desc||(mpAbierto(mp.sel)&&!mp.forzar)) return;
  mp.enviando=true;
  const rep={ equipoId:mp.sel, desc, urg:mp.urg, profId:p.id, prof:p.nombre, area:(getArea(session.area)||{}).nombre||'', areaId:session.area,
    clase:ctx.clase, salonId:ctx.salonId, otroLugar:String(eq.salonId)!==String(ctx.salonId), creado:Date.now(), estado:'nuevo',
    tipos:mp.chips.slice(), origen:'gerencia' };
  const cola=mpLeerCola(); cola.push({local:'l'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),key:null,rep}); mpGuardarCola(cola);   // primero local; luego se intenta enviar
  mp.sel=null; mp.chips=[]; mp.texto=''; mp.urg='normal'; mp.q=''; mp.todo=false; mp.forzar=false;
  if(mp.salonQR){ mp.salonManual=null; mp.salonQR=false; }
  const n=await mpVaciarCola();
  mp.enviando=false; mp.vista='mis';
  toast(n?'Reporte enviado a mantenimiento':'Sin señal: el reporte se enviará al volver la conexión');
  render();
}
async function mpEliminar(id){
  const r=(mantRaw.reportes||{})[id];
  if(!r||r.estado!=='resuelto'||!mantDb) return;
  if(navigator.onLine===false){ toast('Necesitas conexión para eliminar el aviso'); return; }
  if(!(await confirmar('¿Eliminar este aviso?\nQuedará guardado en el historial de mantenimiento.'))) return;
  try{
    const upd={}; upd['reportes/'+id]=null; upd['historial/'+id]=Object.assign({},r,{cerrado:Date.now()});
    await Promise.race([mantDb.ref().update(upd),mpTimeout(10000)]);
    toast('Aviso eliminado');
  }catch(e){ toast('No se pudo eliminar. Intenta de nuevo.'); }
}

/* ---------- escáner de código QR (el QR trae ...?eq=<id del equipo>) ---------- */
function mpIdDesdeQR(txt){
  txt=String(txt||'').trim();
  let m=txt.match(/[?&]eq=([^&#\s]+)/); if(m){ try{ return decodeURIComponent(m[1]); }catch(e){ return m[1]; } }
  m=txt.match(/^CMEQ:(.+)$/i); return m?m[1].trim():null;
}
function mpCargarJsQR(){
  return new Promise((res,rej)=>{ if(window.jsQR){ res(); return; } const s=document.createElement('script'); s.src='js/jsqr.min.js'; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
}
function mpElegirPorQR(id){
  const E=mpEquipos()||{}, eq=E[id]; if(!eq) return false;
  mp.vista='reportar'; mp.sel=id; mp.forzar=false; mp.q=''; mp.todo=false;
  if(eq.salonId!=null&&(mpSalones()||{})[eq.salonId]){ mp.salonManual=eq.salonId; mp.salonQR=true; mp.eligiendo=false; }
  render(); toast('Equipo: '+eq.nombre); return true;
}
function mpCerrarEscaner(){
  const s=mp.scan; if(!s) return;
  s.vivo=false; clearTimeout(s.t);
  try{ s.stream&&s.stream.getTracks().forEach(t=>t.stop()); }catch(e){}
  try{ s.ov&&s.ov.remove(); }catch(e){}
  mp.scan=null;
}
async function mpAbrirEscaner(){
  if(!mpCatalogoListo()){ toast('Aún no se descarga la lista de equipos. Intenta en un momento.'); return; }
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){ toast('Este navegador no permite usar la cámara. Busca el equipo por nombre.'); return; }
  mpCerrarEscaner();
  const ov=document.createElement('div'); ov.id='mp-qr-ov';
  ov.innerHTML='<video autoplay muted playsinline></video><div class="mp-qr-guia"></div><div class="mp-qr-pie"><div id="mp-qr-msg">Apunta al código QR del equipo</div><button type="button" id="mp-qr-x">Cancelar</button></div>';
  document.body.appendChild(ov);
  mp.scan={ov,vivo:true,stream:null,t:null};
  ov.querySelector('#mp-qr-x').addEventListener('click',mpCerrarEscaner);
  const msg=t=>{ const m=document.getElementById('mp-qr-msg'); if(m) m.textContent=t; };
  let stream;
  try{ stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false}); }
  catch(e){ mpCerrarEscaner(); toast('No se pudo abrir la cámara. Revisa el permiso o busca el equipo por nombre.'); return; }
  if(!mp.scan){ stream.getTracks().forEach(t=>t.stop()); return; }
  mp.scan.stream=stream;
  const video=ov.querySelector('video'); video.srcObject=stream;
  try{ await video.play(); }catch(e){}
  let det=null;
  try{ if('BarcodeDetector' in window) det=new BarcodeDetector({formats:['qr_code']}); }catch(e){ det=null; }
  if(!det){ try{ await mpCargarJsQR(); }catch(e){ mpCerrarEscaner(); toast('No se pudo preparar el lector. Busca el equipo por nombre.'); return; } }
  const cv=document.createElement('canvas'), cx=cv.getContext('2d',{willReadFrequently:true});
  const tick=async()=>{
    if(!mp.scan||!mp.scan.vivo) return;
    let txt=null;
    try{
      if(video.readyState>=2&&video.videoWidth){
        if(det){ const r=await det.detect(video); if(r&&r.length) txt=r[0].rawValue; }
        else if(window.jsQR){
          const k=Math.min(1,640/video.videoWidth);
          cv.width=Math.round(video.videoWidth*k); cv.height=Math.round(video.videoHeight*k);
          cx.drawImage(video,0,0,cv.width,cv.height);
          const im=cx.getImageData(0,0,cv.width,cv.height), q=window.jsQR(im.data,im.width,im.height,{inversionAttempts:'dontInvert'});
          if(q) txt=q.data;
        }
      }
    }catch(e){ /* un cuadro sin lectura: se sigue */ }
    if(txt){
      const id=mpIdDesdeQR(txt);
      if(!id) msg('Ese código no es de un equipo del club');
      else if(!(mpEquipos()||{})[id]) msg('No encontré ese equipo en la lista. Búscalo por nombre.');
      else{ mpCerrarEscaner(); try{ navigator.vibrate&&navigator.vibrate(60); }catch(e){} mpElegirPorQR(id); return; }
    }
    mp.scan.t=setTimeout(tick,220);
  };
  tick();
}

/* ---------- acciones ---------- */
Object.assign(actions,{
  mpNoop(){},
  mpVista(d){ mp.vista=d.id; render(); },
  mpEq(d){ mp.sel=d.id; mp.forzar=false; render(); },
  mpCambiarEq(){ mp.sel=null; mp.forzar=false; if(mp.salonQR){ mp.salonManual=null; mp.salonQR=false; } render(); },
  mpTodo(){ mp.todo=!mp.todo; mp.q=''; render(); },
  mpCambiarSalon(){ mp.eligiendo=true; mp.sel=null; mp.todo=false; mp.q=''; render(); },
  mpSalon(d){ mp.salonQR=false; mp.salonManual=d.id; mp.eligiendo=false; mp.sel=null; mp.todo=false; mp.q=''; render(); },
  mpChip(d){ mp.chips=mp.chips.includes(d.id)?mp.chips.filter(c=>c!==d.id):mp.chips.concat(d.id); render(); },
  mpUrg(d){ mp.urg=d.id; render(); },
  mpForzar(){ mp.forzar=true; render(); },
  mpEnviar(){ mpEnviar(); },
  mpQr(){ mpAbrirEscaner(); },
  mpEliminar(d){ mpEliminar(d.id); }
});
document.addEventListener('input',e=>{
  if(e.target.id==='mp_q'){ mp.q=e.target.value; const l=document.getElementById('mp_lista'); if(l) l.innerHTML=mpListaHTML(mpCtx()); }
  else if(e.target.id==='mp_txt'){ mp.texto=e.target.value; const b=document.getElementById('mp_enviar'); if(b) b.disabled=!mpBotonOk(mpCtx()); }
});
window.addEventListener('online',()=>{ mpVaciarCola().then(n=>{ if(n&&mantProfActivo()) safeRender(); }); });
setInterval(()=>{ if(mpLeerCola().length) mpVaciarCola().then(n=>{ if(n&&mantProfActivo()) safeRender(); }); },60000);
