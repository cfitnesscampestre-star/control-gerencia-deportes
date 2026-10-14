'use strict';
/* =====================================================================
   vercomo.js — Gerencia: “Ver como…” (modo prueba).
   Ya con la sesión de Gerencia abierta, entra a la pantalla de cualquier Dirección (incluida el
   Área de la Salud), de Metodología, de una Recepción o de un profesor/instructor, sin cerrar
   sesión ni teclear otra contraseña. Arriba queda un aviso con “Volver a Gerencia”.
   No es una clave nueva: solo funciona después de entrar con la contraseña de Gerencia.
   Lo que se capture en modo prueba se guarda de verdad (a nombre de la persona que se está viendo).
   ===================================================================== */
const enPrueba = () => !!session&&!!session.gerOrigen;
const vcPuede = () => !!session&&session.rol==='ger';
function vcAbrir(paso,aid){
  if(!vcPuede()) return;
  const btn=(act,attrs,ico,txt,sub)=>`<button class="lg-area" data-act="${act}" ${attrs}>${ico}<b>${txt}${sub?`<small class="mut" style="display:block;font-weight:500">${sub}</small>`:''}</b>${ic('next')}</button>`;
  let cuerpo='';
  if(!paso){
    cuerpo=`<div class="sub">Entra a la pantalla de cualquier área sin cerrar tu sesión. Arriba verás un aviso para volver a Gerencia.</div>
      <div class="h2 sm">Dirección de área</div>
      <div class="lg-list">${areasVista().map(a=>btn('vcDir',`data-id="${esc(a.id)}"${a._grupo?' data-grupo="1"':''}`,areaIco(a,{tile:true,size:20}),esc(a.nombre))).join('')}</div>
      <div class="h2 sm">Otros accesos</div>
      <div class="lg-list">${btn('vcMet','',ic('chart'),'Metodología deportiva')}
        ${areasList().some(a=>esGim(a.id)&&recepcion(a.id).some(r=>r.activo!==false))?btn('vcPaso','data-p="rec"',ic('users'),'Recepción del gimnasio'):''}
        ${btn('vcPaso','data-p="prof"',ic('clip'),'Profesor, instructor o especialista','elige el área y la persona')}</div>`;
  } else if(paso==='rec'){
    const L=[]; areasList().filter(a=>esGim(a.id)).forEach(a=>recepcion(a.id).filter(r=>r.activo!==false).forEach(r=>L.push({a,r})));
    cuerpo=`<div class="lg-list">${L.map(x=>btn('vcRec',`data-aid="${esc(x.a.id)}" data-id="${esc(x.r.id)}"`,ic('user'),esc(x.r.nombre),esc(x.a.nombre))).join('')}</div>`;
  } else if(paso==='prof'&&!aid){
    const as=areasList().filter(a=>!esVinculada(a.id)&&profesores(a.id).some(p=>p.activo!==false));
    cuerpo=as.length?`<div class="sub">¿De qué área?</div><div class="lg-list">${as.map(a=>btn('vcPaso',`data-p="prof" data-aid="${esc(a.id)}"`,areaIco(a,{tile:true,size:20}),esc(a.nombre))).join('')}</div>`:empty('No hay profesores dados de alta.');
  } else {
    const ps=profesores(aid).filter(p=>p.activo!==false);
    cuerpo=`<div class="sub">${esc((getArea(aid)||{}).nombre||'')} · elige a la persona</div><div class="lg-list">${ps.map(p=>btn('vcProf',`data-aid="${esc(aid)}" data-id="${esc(p.id)}"`,ic('user'),esc(p.nombre))).join('')}</div>`;
  }
  openModal(`${mHead('Ver como… (modo prueba)')}${cuerpo}
    <div class="btns">${paso?`<button class="btn" data-act="vcPaso" data-p="${paso==='prof'&&aid?'prof':''}">Atrás</button>`:''}<button class="btn" data-act="closeModal">Cerrar</button></div>`);
}
function vcEntrar(nueva){
  if(!vcPuede()) return;
  const gerOrigen={gTab:ui.gTab,gArea:ui.gArea};
  session={...nueva,gerOrigen}; ui.lista=null; closeModal(); saveSession(); render(); top0();
}
function bannerPrueba(){
  if(!enPrueba()||(session.rol==='prof'&&session.dirOrigen)) return '';         // dentro de “Entrar como entrenador” manda el aviso de Dirección
  const s=session, a=s.area?getArea(s.area):null;
  const quien = s.rol==='met' ? 'Metodología deportiva'
    : s.rol==='dir' ? `Dirección · ${(Array.isArray(s.grupo)&&s.grupo.length>1&&typeof SV_GRUPO_NOM!=='undefined')?SV_GRUPO_NOM:(a||{}).nombre||''}`
    : s.rol==='rec' ? `Recepción · ${(getRec(s.area,s.recId)||{}).nombre||''}`
    : `${(getProf(s.area,s.profId)||{}).nombre||'Profesor'} · ${(a||{}).nombre||''}`;
  return `<div class="ent-ban prueba"><span>${ic('shield')} <b>Modo prueba</b> · estás viendo como <b>${esc(quien)}</b>. Lo que captures se guarda de verdad.</span><button class="btn sm primary" data-act="volverGer">Volver a Gerencia</button></div>`;
}
Object.assign(actions,{
  verComo(){ vcAbrir(''); },
  vcPaso(d){ vcAbrir(d.p||'',d.aid||''); },
  vcDir(d){ const G=d.grupo?svDirGrupo():null; vcEntrar(G?{rol:'dir',area:G[0],grupo:G}:{rol:'dir',area:d.id}); ui.aTab='inicio'; render(); },
  vcMet(){ vcEntrar({rol:'met',area:null}); ui.mt.tab='aforos'; ui.mt.aArea=null; ui.mt.eArea=null; ui.mt.pSel=null; ui.mt.nuevo=null; render(); },
  vcRec(d){ vcEntrar({rol:'rec',area:d.aid,recId:d.id}); ui.aTab='gimaforo'; ui.gaFecha=todayStr(); render(); },
  vcProf(d){ vcEntrar({rol:'prof',area:d.aid,profId:d.id}); ui.pTab='hoy'; ui.pFecha=todayStr(); render(); },
  volverGer(){
    if(!enPrueba()) return;
    const o=session.gerOrigen; if(typeof rfLimpiar==='function') rfLimpiar();
    session={rol:'ger',area:null}; ui.gTab=o.gTab||'resumen'; ui.gArea=o.gArea||null; ui.aTab='inicio'; ui.lista=null;
    closeModal(); saveSession(); render(); top0();
  }
});
