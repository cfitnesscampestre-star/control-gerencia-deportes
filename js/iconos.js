'use strict';
/* =====================================================================
   iconos.js — íconos de las áreas, todos del mismo estilo que la barra
   inferior: línea de 1.8 px, puntas redondeadas, sobre una cuadrícula de 24 px
   y sin relleno (toman el color del texto).
   Cada área guarda en  icono  la CLAVE del ícono (por ejemplo 'tenis').
   Las áreas anteriores, que guardaban un emoji, se reconocen solas.
   Para agregar un ícono nuevo: una línea más en AREA_ICONS.
   ===================================================================== */
const AREA_ICONS = {
  gimnasia:  {n:'Gimnasia',   d:'<circle cx="11" cy="4.6" r="1.9"/><path d="M11 7v6.2M11 13.2l-3.6 6.6M11 13.2l3.6 6.6M11 8.6L5.6 6.4M11 8.6l5.4-2.2"/><path d="M16.4 6.4c1.6-1.8 4.4-1.4 4.2.7-.2 2-3.2 1.4-2.8 3.6"/>'},
  pesas:     {n:'Gimnasio',   d:'<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>'},
  fitness:   {n:'Fitness',    d:'<path d="M8.7 10.2C6.4 11.4 5 13.1 5 15.3c0 2.6 1.6 4.4 3.6 4.4h6.8c2 0 3.6-1.8 3.6-4.4 0-2.2-1.4-3.9-3.7-5.1"/><path d="M8.7 10.2h6.6M9.2 10.2V7.9a2.8 2.8 0 0 1 5.6 0v2.3"/>'},
  tenis:     {n:'Tenis',      d:'<ellipse cx="9.4" cy="9.4" rx="4.3" ry="6.1" transform="rotate(-45 9.4 9.4)"/><path d="M13.7 13.7l6 6M6.7 6.9l5.2 5.2"/><circle cx="18.6" cy="5.4" r="1.7"/>'},
  futbol:    {n:'Fútbol',     d:'<circle cx="12" cy="12" r="9"/><path d="M12 8.3l3.4 2.5-1.3 4H9.9l-1.3-4z"/><path d="M12 8.3V3.2M15.4 10.8l4.3-1.7M14.1 14.8l2.8 3.9M9.9 14.8l-2.8 3.9M8.6 10.8L4.3 9.1"/>'},
  natacion:  {n:'Natación',   d:'<circle cx="17.3" cy="6.4" r="1.8"/><path d="M4.5 12.6l5.3-3.7 3.9 1.6 2.3-2.5M13.7 10.5l1.9 2.1"/><path d="M2.5 16.2c1.8 0 1.8-1.5 3.6-1.5s1.8 1.5 3.6 1.5 1.8-1.5 3.6-1.5 1.8 1.5 3.6 1.5 1.8-1.5 3.6-1.5M2.5 20.2c1.8 0 1.8-1.5 3.6-1.5s1.8 1.5 3.6 1.5 1.8-1.5 3.6-1.5 1.8 1.5 3.6 1.5 1.8-1.5 3.6-1.5"/>'},
  padel:     {n:'Pádel',      d:'<path d="M11.5 3a5.6 5.6 0 0 1 5.6 5.6c0 2.4-1.4 4.2-3.4 5.6H9.3c-2-1.4-3.4-3.2-3.4-5.6A5.6 5.6 0 0 1 11.5 3z"/><path d="M11.5 14.2V20M10.3 20h2.4"/><path d="M8.9 6.9h.01M11.5 6.9h.01M14.1 6.9h.01M10.2 9.7h.01M12.8 9.7h.01" stroke-width="1.7"/><circle cx="19" cy="18.6" r="1.7"/>'},
  taekwondo: {n:'Taekwondo',  d:'<circle cx="7.6" cy="4.8" r="1.8"/><path d="M8 7.4l1.7 5.4M9.7 12.8l9.6-4.2M9.7 12.8l-1 7.4M8.6 9.4l-3.6 2M8.9 9.5l3.9-1.2"/><path d="M20.4 5.4l1.1-1.1M21.2 8.6h1.3"/>'},
  squash:    {n:'Squash',     d:'<ellipse cx="9.2" cy="9.2" rx="3.6" ry="5.8" transform="rotate(-40 9.2 9.2)"/><path d="M12.4 12.9l7.3 7.3"/><circle cx="5.6" cy="19" r="1.7"/>'},
  basquet:   {n:'Básquetbol', d:'<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.4 5.4c2.6 2.4 2.6 10.8 0 13.2M18.6 5.4c-2.6 2.4-2.6 10.8 0 13.2"/>'},
  frontenis: {n:'Frontenis',  d:'<path d="M3 4v16"/><circle cx="8.2" cy="8.8" r="1.7"/><ellipse cx="15.2" cy="13.6" rx="3.3" ry="4.7" transform="rotate(-45 15.2 13.6)"/><path d="M17.7 16.1l3.2 3.2"/>'},
  voleibol:  {n:'Voleibol',   d:'<circle cx="12" cy="12" r="9"/><path d="M12 3c1.2 3.8 3.9 6.6 8.6 8M3.6 9.4c3.8-.4 7.5 1 9.6 4.6 1.1 2 1.5 4.3 1.2 6.7M4.5 16.6c1.5-3.4 4.2-5.3 7.6-5.2"/>'},
  yoga:      {n:'Yoga',       d:'<circle cx="12" cy="5" r="1.9"/><path d="M12 7.2v4.6M12 9.2c-2.6.2-4.4 1.6-5.2 4M12 9.2c2.6.2 4.4 1.6 5.2 4"/><path d="M3.5 18.4c3-.4 5-2.6 8.5-2.6s5.5 2.2 8.5 2.6M6.5 20.6c1.8-.6 3.4-1.2 5.5-1.2s3.7.6 5.5 1.2"/>'},
  ciclismo:  {n:'Ciclismo',   d:'<circle cx="6" cy="16" r="3.6"/><circle cx="18" cy="16" r="3.6"/><path d="M6 16l3.6-6.6h5.8L18 16M9.6 9.4L12.6 16H6M15.4 9.4l-.8-2.4h2.2M8.6 7.2h2.4"/>'},
  correr:    {n:'Atletismo',  d:'<circle cx="14.6" cy="4.6" r="1.9"/><path d="M13.4 7.8L11 12.6l3.6 2.2.6 5M12.6 9.4L9 10.4l-1.6 2.6M13.2 9.2l3.6 2.2 2.4-.6M11 12.6l-2.6 3.4-3.4.8"/>'},
  boxeo:     {n:'Boxeo',      d:'<path d="M6.5 11V7.6A3.6 3.6 0 0 1 10.1 4h4.3a4.2 4.2 0 0 1 4.2 4.2v3.1c0 1.6-.8 3-2.1 3.9V19H8.7v-4.2A4.5 4.5 0 0 1 6.5 11z"/><path d="M6.5 11c0-1.5 1-2.2 2.6-2.2h2.4M8.7 16.6h7.8"/>'},
  trofeo:    {n:'Trofeo',     d:'<path d="M7.5 4h9v5.2a4.5 4.5 0 0 1-9 0V4z"/><path d="M7.5 6H4.4v1.4a3.2 3.2 0 0 0 3.3 3.1M16.5 6h3.1v1.4a3.2 3.2 0 0 1-3.3 3.1M12 13.8V17.4M8.4 20h7.2M9.6 20l.6-2.6h3.6l.6 2.6"/>'}
};
const AREA_ICON_LIST = Object.keys(AREA_ICONS);
const EMOJI_A_ICONO = {'🤸':'gimnasia','🏋':'pesas','💪':'fitness','🎾':'tenis','⚽':'futbol','🏊':'natacion','🏓':'padel','🥋':'taekwondo','🏸':'squash','🏀':'basquet','🥎':'frontenis','🏐':'voleibol','🧘':'yoga','🚴':'ciclismo','🏃':'correr','🥊':'boxeo','🏆':'trofeo','🏅':'trofeo'};
const ICONO_POR_AREA = {gimnasia:'gimnasia',gimnasio:'pesas',fitness:'fitness',tenis:'tenis',futbol:'futbol',natacion:'natacion',padel:'padel',taekwondo:'taekwondo',squash:'squash',basquetbol:'basquet',frontenis:'frontenis'};

function iconKey(a){                                   // clave del ícono de un área (acepta emojis de versiones anteriores)
  const v=String((a&&a.icono)||'').replace(/[\uFE0F\u200D\u2640\u2642]/g,'').trim();
  if(AREA_ICONS[v]) return v;
  if(EMOJI_A_ICONO[v]) return EMOJI_A_ICONO[v];
  return ICONO_POR_AREA[a&&a.id]||'trofeo';
}
function areaSvg(key,size){
  const s=size||22;
  return `<svg class="aico-s" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(AREA_ICONS[key]||AREA_ICONS.trofeo).d}</svg>`;
}
/* areaIco(a)                    → ícono suelto, toma el color del texto
   areaIco(a,{tile:true,size:22}) → dentro de un cuadro suave con el color del área */
function areaIco(a,o){
  o=o||{}; const svg=areaSvg(iconKey(a),o.size||20);
  return o.tile ? `<span class="aico tile" style="--ac:${String((a&&a.color)||'#0f7a5a').replace(/[^#\w(),.% -]/g,'')}">${svg}</span>` : `<span class="aico">${svg}</span>`;
}
