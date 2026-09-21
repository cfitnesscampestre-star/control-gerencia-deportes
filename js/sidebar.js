'use strict';
/* =====================================================================
   sidebar.js — menú lateral de la vista de computadora (900 px o más)
   ===================================================================== */
const NAV_DIR = [
  {id:'inicio',label:'Inicio',ic:'home'},
  {id:'aforos',label:'Aforos',ic:'gauge'},
  {id:'grupos',label:'Grupos',ic:'users'},
  {id:'profesores',label:'Profesores',ic:'clip'},
  {id:'calendario',label:'Calendario',ic:'cal'},
  {id:'eventos',label:'Eventos',ic:'flag'},
  {id:'reporte',label:'Reporte',ic:'doc'}
];
const NAV_GIM = [
  {id:'inicio',label:'Inicio',ic:'home'},
  {id:'gimaforo',label:'Aforo por hora',ic:'gauge'},
  {id:'gimpt',label:'Personalizados',ic:'users'},
  {id:'profesores',label:'Instructores',ic:'clip'},
  {id:'eventos',label:'Eventos',ic:'flag'},
  {id:'reporte',label:'Reporte',ic:'doc'}
];
const NAV_SERV = [
  {id:'inicio',label:'Resumen',ic:'cal'},
  {id:'profesores',label:'Especialistas',ic:'clip'}
];
const NAV_PROF_SERV = [
  {id:'hoy',label:'Mi bitácora',ic:'clip'}
];
const NAV_PROF = [
  {id:'hoy',label:'Hoy',ic:'clip'},
  {id:'horario',label:'Mi horario',ic:'cal'}
];
const NAV_GER = [
  {id:'resumen',label:'Resumen',ic:'dash'},
  {id:'comite',label:'Comité',ic:'chart'},
  {id:'areas',label:'Áreas',ic:'areas'},
  {id:'ajustes',label:'Ajustes',ic:'gear'}
];

function viewSidebar(){
  const ger=session.rol==='ger', prof=session.rol==='prof';
  const a=ger?null:getArea(session.area);
  const pr=prof?getProf(session.area,session.profId):null;
  const nav = ger
    ? NAV_GER.map(n=>`<button class="${ui.gTab===n.id&&!(n.id==='areas'&&ui.gArea)?'on':''}" data-act="gTab" data-tab="${n.id}">${ic(n.ic)}<span>${n.label}</span></button>`).join('')
    : prof ? (esServ(session.area)?NAV_PROF_SERV:NAV_PROF).map(n=>`<button class="${ui.pTab===n.id?'on':''}" data-act="pTab" data-tab="${n.id}">${ic(n.ic)}<span>${n.label}</span></button>`).join('')
    : (esServ(session.area)?NAV_SERV:esGim(session.area)?NAV_GIM:NAV_DIR).map(n=>`<button class="${ui.aTab===n.id?'on':''}" data-act="aTab" data-tab="${n.id}">${ic(n.ic)}<span>${n.label}</span></button>`).join('');
  const areas = ger ? `<div class="sb-sec">Áreas</div><nav class="sb-nav sb-areas">${areasList().map(x=>
    `<button class="${ui.gTab==='areas'&&ui.gArea===x.id?'on':''}" data-act="openArea" data-id="${esc(x.id)}"><i class="sb-dot" style="background:${esc(x.color)}"></i><span>${esc(x.nombre)}</span></button>`).join('')}</nav>` : '';
  return `<aside class="sidebar">
    <div class="sb-brand">
      <div class="sb-logo"><span>C</span><img src="img/logo.png" alt="Club Campestre Aguascalientes" data-fallback></div>
      <div><b>${ger?'Control Gerencia':esc(a.nombre)}</b>
      <small>${ger?'Gerencia de deportes':prof?(esServ(session.area)?'Portal del especialista':'Portal del profesor'):'Dirección de área'}</small></div>
    </div>
    <nav class="sb-nav">${nav}</nav>
    ${areas}
    <div class="sb-foot">
      <div class="sb-user"><b>${ger?'Gerencia':prof?(esServ(session.area)?pfNom(session.area,0):'Profesor'):'Dirección'}</b>${ger?'Todas las áreas':prof?esc(pr.nombre):areaIco(a,{size:15})+' '+esc(a.nombre)}</div>
      <div class="cloud ${simActiva()?'sim':online?'on':''}"><i></i>${simActiva()?'Datos de simulación':online?'Guardado en la nube ✔':'Solo en este equipo'}</div>
      <button class="btn sm block" data-act="logout">${ic('logout')} Salir</button>
    </div>
  </aside>`;
}
