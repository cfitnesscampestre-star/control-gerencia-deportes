'use strict';
/* =====================================================================
   app.js — marco de la app (barra superior, rutas), eventos globales y arranque.
   Se carga al final: los demás módulos ya registraron sus vistas y acciones.
   ===================================================================== */
function viewTopbar(title,sub,back){
  return `<header class="topbar">
    ${back?`<button class="ibtn" data-act="${back}" aria-label="Volver">${ic('back')}</button>`:''}
    <div class="tb-logo only-m"><span>C</span><img src="img/logo.png" alt="Club Campestre" data-fallback></div>
    <div class="tb-t"><b>${title}</b><small>${sub}</small>
      ${(c=>`<span class="cloud ${c.cls}"><i></i>${c.txt}</span>`)(cloudChip())}</div>
    <button class="ibtn only-m" data-act="logout" aria-label="Salir">${ic('logout')}</button>
  </header>`;
}
function shell({title,sub,body,back,fs}){
  return `<div class="app${fs?' fs':''}">${viewSidebar()}<div class="content">${viewTopbar(title,sub,back)}<main class="main">${body}</main></div>${viewBottomNav()}</div>`;
}
function render(){
  const app=$('#app');
  if(!session){ app.innerHTML=viewLogin(); return; }
  app.innerHTML = session.rol==='ger' ? viewGerencia() : session.rol==='dir' ? viewDireccion() : session.rol==='rec' ? viewRecepcion() : viewProfesor();
  if(typeof chAlFinal==='function') chAlFinal();
}

/* ----- contenido de un área (dirección edita, gerencia solo lee) ----- */
function areaTabs(){
  const T=esServ(ui.gArea)?svTabs(ui.gArea):esGim(ui.gArea)
    ?[['inicio','Resumen'],['gimaforo','Aforo por hora'],['gimpt','Personalizados'],['profesores','Instructores'],['recepcion','Recepción'],['eventos','Eventos'],['reporte','Reporte']]
    :[['inicio','Resumen'],['aforos','Aforos'],['grupos','Grupos'],['profesores','Profesores'],['calendario','Calendario'],['eventos','Eventos'],['reporte','Reporte']];
  return `<div class="chips">${T.map(([id,l])=>`<button class="chip${ui.aTab===id?' on':''}" data-act="aTab" data-tab="${id}">${l}</button>`).join('')}</div>`;
}
function areaBody(aid){
  const gim=esGim(aid), srv=esServ(aid);
  if(gim&&!['inicio','gimaforo','gimpt','profesores','recepcion','eventos','reporte'].includes(ui.aTab)) ui.aTab='inicio';
  if(srv&&!svTabs(aid).some(t=>t[0]===ui.aTab)) ui.aTab='inicio';
  if(!gim&&['gimaforo','gimpt'].includes(ui.aTab)) ui.aTab='inicio';
  switch(ui.aTab){
    case 'gimaforo': return vGimAforo(aid);
    case 'gimpt': return vGimPT(aid);
    case 'recepcion': return vGimRecepcion(aid);
    case 'aforos': return vAforos(aid);
    case 'grupos': return vGrupos(aid);
    case 'profesores': return vProfesores(aid);
    case 'calendario': return vCalendario(aid);
    case 'eventos': return vEventos(aid);
    case 'reporte': return vReporte(aid);
    default: return srv?vServInicio(aid):gim?vGimInicio(aid):vInicio(aid);
  }
}
function viewGerencia(){
  let body, title='Control Gerencia', sub='Gerencia de deportes · todas las áreas', back=null;
  if(ui.gTab==='resumen') body=gResumen();
  else if(ui.gTab==='comite'){ body=gComite(); title='Comité directivo'; sub='Informe para gerencia general'; }
  else if(ui.gTab==='ajustes') body=gAjustes();
  else if(ui.gArea&&getArea(ui.gArea)){
    const a=getArea(ui.gArea); title=`${areaIco(a,{size:22})} ${esc(a.nombre)}`; sub='Vista de gerencia · solo lectura'; back=ui.lista?'listaBack':'gBack';
    body=ui.lista?vLista():areaTabs()+areaBody(ui.gArea);
  } else body=gAreasList();
  return shell({title,sub,body,back,fs:!!ui.lista});
}
function viewDireccion(){
  const a=getArea(session.area);
  return shell({title:`${areaIco(a,{size:22})} ${esc(a.nombre)}`,sub:'Dirección de área',body:ui.lista?vLista():areaBody(session.area),back:ui.lista?'listaBack':null,fs:!!ui.lista});
}

Object.assign(actions,{
  gTab(d){ ui.gTab=d.tab; ui.lista=null; if(d.tab==='areas') ui.gArea=null; render(); top0(); },
  gBack(){ ui.gArea=null; ui.lista=null; render(); top0(); },
  openArea(d){ ui.gTab='areas'; ui.gArea=d.id; ui.aTab=d.tab||'inicio'; ui.repTab='semanal'; ui.lista=null; render(); top0(); },
  aTab(d){ ui.aTab=d.tab; ui.lista=null; render(); top0(); },
  closeModal(){ closeModal(); }
});

/* ----- eventos globales ----- */
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-act]'); if(!t) return;
  const fn=actions[t.dataset.act]; if(fn){ e.preventDefault(); fn(t.dataset,e); }
});
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!$('#modal').hidden) closeModal(); });
document.addEventListener('focusout',()=>{
  if(!pendingRender) return;
  setTimeout(()=>{
    const ae=document.activeElement, pw=$('#pw');
    if(!$('#modal').hidden||(ae&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName))||(!session&&pw&&pw.value)||afBusy()) return;
    pendingRender=false; render();
  },250);
});
$('#modal').addEventListener('click',e=>{ if(e.target.id==='modal') closeModal(); });
document.addEventListener('error',e=>{                                   // si falta una imagen, se muestra el texto de respaldo
  const t=e.target; if(t&&t.tagName==='IMG'&&t.hasAttribute('data-fallback')) t.style.display='none';
},true);
if(window.matchMedia){                                                   // al girar el equipo o cambiar el tamaño, cambia entre vista celular y computadora
  const mq=window.matchMedia('(min-width: 900px)');
  const onMq=()=>safeRender();
  mq.addEventListener ? mq.addEventListener('change',onMq) : mq.addListener&&mq.addListener(onMq);
}

/* ----- arranque ----- */
function boot(){
  aplicarTema();
  state=lsLoad(); ensureSeed(); lsSave(); validateSession();
  simIniciar();                                            // datos de ejemplo (solo si no hay base de datos conectada)
  if(window.FC_DEMO_RAW) fcAplicar(window.FC_DEMO_RAW);      // solo en la versión de demostración
  render();
  if(FIREBASE_CONFIG.databaseURL){ fcDesdeCache(); initFirebase(); }
  registrarSW();
}
/* Service worker: guarda la app en el equipo para que abra aunque no haya internet */
function registrarSW(){
  if(!('serviceWorker' in navigator) || location.protocol==='file:') return;
  navigator.serviceWorker.register('sw.js').catch(e=>console.warn('SW',e));
}
boot();
