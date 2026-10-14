'use strict';
/* =====================================================================
   mobile.js — navegación inferior del celular y utilidades de la vista móvil
   ===================================================================== */
const NAV_M_DIR = [
  {id:'inicio',label:'Inicio',ic:'home',tabs:['inicio']},
  {id:'aforos',label:'Aforos',ic:'gauge',tabs:['aforos']},
  {id:'grupos',label:'Grupos',ic:'users',tabs:['grupos','profesores']},
  {id:'calendario',label:'Agenda',ic:'cal',tabs:['calendario','eventos']},
  {id:'reporte',label:'Reporte',ic:'doc',tabs:['reporte']}
];
const NAV_M_GIM = NAV_GIM;                            // mismas 4 secciones que en computadora (sidebar.js)
const NAV_M_REC = NAV_REC;
const NAV_M_SERV = [
  {id:'inicio',label:'Resumen',ic:'cal',tabs:['inicio']},
  {id:'profesores',label:'Equipo',ic:'clip',tabs:['profesores']},
  {id:'reporte',label:'Reporte',ic:'doc',tabs:['reporte']}
];
const NAV_M_PROF = [
  {id:'hoy',label:'Hoy',ic:'clip',tabs:['hoy']},
  {id:'horario',label:'Horario',ic:'cal',tabs:['horario']}
];
const NAV_M_PROF_GIM = NAV_PROF_GIM.map(n=>({...n,tabs:[n.id]}));
const NAV_M_PROF_SERV = [
  {id:'hoy',label:'Bitácora',ic:'clip',tabs:['hoy']}
];
const NAV_M_MET = [
  {id:'aforos',label:'Aforos',ic:'gauge',tabs:['aforos']},
  {id:'eventos',label:'Eventos',ic:'flag',tabs:['eventos']},
  {id:'pruebas',label:'Pruebas',ic:'clip',tabs:['pruebas']},
  {id:'reportes',label:'Reportes',ic:'doc',tabs:['reportes']}
];
const NAV_M_GER = [
  {id:'resumen',label:'Resumen',ic:'dash',tabs:['resumen']},
  {id:'comite',label:'Comité',ic:'chart',tabs:['comite']},
  {id:'reportes',label:'Reportes',ic:'doc',tabs:['reportes']},
  {id:'areas',label:'Áreas',ic:'areas',tabs:['areas']},
  {id:'ajustes',label:'Ajustes',ic:'gear',tabs:['ajustes']}
];

function viewBottomNav(){
  if(session.rol==='met') return `<nav class="bottomnav" aria-label="Navegación">${NAV_M_MET.map(n=>`<button class="${ui.mt.tab===n.id?'on':''}" data-act="mTab" data-tab="${n.id}">${ic(n.ic)}<span>${n.label}</span></button>`).join('')}</nav>`;
  const ger=session.rol==='ger', prof=session.rol==='prof', rec=session.rol==='rec';
  const mantP = prof && typeof mantProfActivo==='function' && mantProfActivo();
  if(prof&&esServ(session.area)&&!mantP) return '';            // el especialista solo tiene su bitácora: no hace falta barra inferior
  const items=ger?(typeof navMGer==='function'?navMGer():NAV_M_GER):prof?(typeof navMProfExtra==='function'?navMProfExtra:x=>x)(esServ(session.area)?NAV_M_PROF_SERV:esGim(session.area)?NAV_M_PROF_GIM:NAV_M_PROF):rec?NAV_M_REC:esGim(session.area)?NAV_M_GIM:(typeof navMDirExtra==='function'?navMDirExtra:x=>x)(esServ(session.area)?NAV_M_SERV.filter(n=>svTabs(session.area).some(t=>t[0]===n.id)):NAV_M_DIR), cur=ger?ui.gTab:prof?ui.pTab:ui.aTab, act=ger?'gTab':prof?'pTab':'aTab';
  return `<nav class="bottomnav" aria-label="Navegación">${items.map(n=>
    `<button class="${n.tabs.includes(cur)?'on':''}" data-act="${act}" data-tab="${n.id}">${ic(n.ic)}<span>${n.label}</span></button>`).join('')}</nav>`;
}

/* En celular, Calendario y Eventos comparten la pestaña "Agenda". */
function gimSwitch(){ return ''; }             // gimnasio: el sub-menú de cada sección es gimSub() (gimvistas.js), en celular y computadora
function gimPtSwitch(){ return ''; }
function agendaSwitch(){
  if(session.rol==='dir'&&esServ(curArea())) return servSwitch();
  if(session.rol==='dir'&&esGim(curArea())) return gimSwitch();
  if(session.rol!=='dir') return '';
  return `<div class="seg only-m" style="margin-top:6px"><button class="${ui.aTab==='calendario'?'on':''}" data-act="aTab" data-tab="calendario">Calendario</button><button class="${ui.aTab==='eventos'?'on':''}" data-act="aTab" data-tab="eventos">Eventos</button></div>`;
}

/* En celular, Grupos y Profesores comparten la pestaña "Grupos". */
function gruposSwitch(){
  if(session.rol==='dir'&&esServ(curArea())) return servSwitch();
  if(session.rol==='dir'&&esGim(curArea())) return gimSwitch();
  if(session.rol!=='dir') return '';
  return `<div class="seg only-m" style="margin-top:6px"><button class="${ui.aTab==='grupos'?'on':''}" data-act="aTab" data-tab="grupos">Grupos</button><button class="${ui.aTab==='profesores'?'on':''}" data-act="aTab" data-tab="profesores">Profesores</button></div>`;
}
