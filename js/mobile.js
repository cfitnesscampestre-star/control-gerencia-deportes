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
const NAV_M_GIM = [
  {id:'inicio',label:'Inicio',ic:'home',tabs:['inicio']},
  {id:'gimaforo',label:'Aforo',ic:'gauge',tabs:['gimaforo']},
  {id:'gimpt',label:'Personal.',ic:'users',tabs:['gimpt']},
  {id:'profesores',label:'Equipo',ic:'clip',tabs:['profesores','recepcion','eventos']},
  {id:'reporte',label:'Reporte',ic:'doc',tabs:['reporte']}
];
const NAV_M_REC = [
  {id:'gimaforo',label:'Aforo',ic:'gauge',tabs:['gimaforo']},
  {id:'gimpt',label:'Personalizados',ic:'users',tabs:['gimpt']}
];
const NAV_M_SERV = [
  {id:'inicio',label:'Resumen',ic:'cal',tabs:['inicio']},
  {id:'profesores',label:'Equipo',ic:'clip',tabs:['profesores']}
];
const NAV_M_PROF = [
  {id:'hoy',label:'Hoy',ic:'clip',tabs:['hoy']},
  {id:'horario',label:'Horario',ic:'cal',tabs:['horario']}
];
const NAV_M_GER = [
  {id:'resumen',label:'Resumen',ic:'dash',tabs:['resumen']},
  {id:'comite',label:'Comité',ic:'chart',tabs:['comite']},
  {id:'reportes',label:'Reportes',ic:'doc',tabs:['reportes']},
  {id:'areas',label:'Áreas',ic:'areas',tabs:['areas']},
  {id:'ajustes',label:'Ajustes',ic:'gear',tabs:['ajustes']}
];

function viewBottomNav(){
  const ger=session.rol==='ger', prof=session.rol==='prof', rec=session.rol==='rec';
  if(prof&&(esServ(session.area)||esGim(session.area))) return '';            // el especialista solo tiene su bitácora: no hace falta barra inferior
  const items=ger?NAV_M_GER:prof?NAV_M_PROF:rec?NAV_M_REC:(esServ(session.area)?NAV_M_SERV:esGim(session.area)?NAV_M_GIM:NAV_M_DIR), cur=ger?ui.gTab:prof?ui.pTab:ui.aTab, act=ger?'gTab':prof?'pTab':'aTab';
  return `<nav class="bottomnav" aria-label="Navegación">${items.map(n=>
    `<button class="${n.tabs.includes(cur)?'on':''}" data-act="${act}" data-tab="${n.id}">${ic(n.ic)}<span>${n.label}</span></button>`).join('')}</nav>`;
}

/* En celular, Calendario y Eventos comparten la pestaña "Agenda". */
function gimSwitch(){                          // gimnasio: Instructores | Recepción | Eventos comparten la pestaña
  const b=(t,l)=>`<button class="${ui.aTab===t?'on':''}" data-act="aTab" data-tab="${t}">${l}</button>`;
  return `<div class="seg only-m" style="margin-top:6px">${b('profesores','Instructores')}${b('recepcion','Recepción')}${b('eventos','Eventos')}</div>`;
}
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
