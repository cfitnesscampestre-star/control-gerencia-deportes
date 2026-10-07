'use strict';
/* =====================================================================
   core.js — configuración, utilidades, almacenamiento (equipo + Firebase),
   acceso a datos y métricas. Todo lo demás depende de este archivo.
   ===================================================================== */

/* ---------- CONFIGURACIÓN ----------
   La conexión con Firebase está en js/config.js. */
const DB_ROOT = 'gerencia_deportes';
const LS_KEY = 'gd_state_v1', SS_KEY = 'gd_session_v1', LAST_KEY = 'gd_last_login_v1';
const THEME_VER = 4;                                   // sube si cambia la paleta de colores por área
const DEF_PASS_GER = 'gerencia2026', DEF_PASS_DIR = 'direccion2026', DEF_PASS_MET = 'metodologia2026';
const COLORS = ['#0f7a5a','#0a6fbd','#5fb336','#2aaed6','#0e8f8f','#d98a00','#e0562f','#5b5bd6','#c2187a','#7a2b8f','#3b82c4','#8a5cf5'];
const DEFAULT_AREAS = [
  {id:'gimnasia',nombre:'Gimnasia',icono:'gimnasia'},
  {id:'gimnasio',nombre:'Gimnasio',icono:'pesas',tipo:'gimnasio',cap:60,abre:6,cierra:23,estancia:1.25,horario:{d0:{a:6,c:23},d1:{a:6,c:23},d2:{a:6,c:23},d3:{a:6,c:23},d4:{a:6,c:23},d5:{a:6,c:23},d6:{a:9,c:16}}},
  {id:'fitness',nombre:'Fitness',icono:'fitness',vinculo:true},
  {id:'tenis',nombre:'Tenis',icono:'tenis'},
  {id:'futbol',nombre:'Fútbol',icono:'futbol'},
  {id:'natacion',nombre:'Natación',icono:'natacion'},
  {id:'padel',nombre:'Pádel',icono:'padel'},
  {id:'taekwondo',nombre:'Taekwondo',icono:'taekwondo'},
  {id:'squash',nombre:'Squash',icono:'squash'},
  {id:'basquetbol',nombre:'Básquetbol',icono:'basquet'},
  {id:'frontenis',nombre:'Frontenis',icono:'frontenis'},
  {id:'nutricion',nombre:'Nutrición',icono:'nutricion',tipo:'nutricion'},
  {id:'fisioterapia',nombre:'Fisioterapia',icono:'fisio',tipo:'fisioterapia'},
  {id:'paramedicos',nombre:'Paramédicos',icono:'cruz',tipo:'paramedico'}
];
const SERV_TIPOS = ['nutricion','fisioterapia','paramedico']; // áreas de servicio con cita (ver js/servicios.js)
const DIAS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const DIAS_L = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const TIPOS_EV = ['Torneo','Exhibición','Clínica o curso','Evento social','Competencia externa','Jornada de salud','Otro'];
const EST_EV = ['planificado','realizado','cancelado','pospuesto'];
const EST_EV_CLS = {planificado:'info',realizado:'ok',cancelado:'mut',pospuesto:'warn'};
const TIPOS_INC = ['Lesión o accidente','Disciplina','Instalaciones','Personal o instructor','Queja de socio','Material o equipo','Otro'];
const GRAV = ['baja','media','alta'];
const GRAV_CLS = {baja:'info',media:'warn',alta:'bad'};
const EST_INC = ['abierta','en seguimiento','resuelta'];
const EST_INC_CLS = {'abierta':'bad','en seguimiento':'warn','resuelta':'ok'};

/* ---------- utilidades ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const pad = n => String(n).padStart(2,'0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseYmd = s => { const [y,m,d]=String(s).split('-').map(Number); return new Date(y,(m||1)-1,d||1); };
const todayStr = () => ymd(new Date());
const addDays = (s,n) => { const d=parseYmd(s); d.setDate(d.getDate()+n); return ymd(d); };
const wdIdx = s => (parseYmd(s).getDay()+6)%7;            // 0 = lunes
const mondayOf = s => addDays(s,-wdIdx(s));
const fmtCorta = s => { const d=parseYmd(s); return `${d.getDate()} ${MESES[d.getMonth()].slice(0,3).toLowerCase()}`; };
const fmtFecha = s => `${DIAS[wdIdx(s)]} ${fmtCorta(s)}`;
const fmtLarga = s => { const d=parseYmd(s); return `${DIAS_L[wdIdx(s)]} ${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()}`; };
const clean = o => JSON.parse(JSON.stringify(o));
const top0 = () => window.scrollTo(0,0);
const isDesktop = () => !!(window.matchMedia && window.matchMedia('(min-width: 900px)').matches);
const slug = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,18)||'area';
function hashPass(str){ // ofuscación local (no es criptografía fuerte): igual que Fitness Control, la validación ocurre en el navegador
  let h1=0xdeadbeef^7,h2=0x41c6ce57^7; str='gd:'+str;
  for(let i=0,ch;i<str.length;i++){ch=str.charCodeAt(i);h1=Math.imul(h1^ch,2654435761);h2=Math.imul(h2^ch,1597334677);}
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
  h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
  return (4294967296*(2097151&h2)+(h1>>>0)).toString(36);
}

/* ---------- iconos ---------- */
const ICONS = {
  dash:'<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  areas:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  home:'<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.8 0 4.5 1.9 4.5 5"/>',
  cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  flag:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  doc:'<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  gauge:'<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-6"/><path d="M12 6v1.5M6 9l1.1 1.1M18 9l-1.1 1.1"/>',
  back:'<path d="M15 5l-7 7 7 7"/>',
  next:'<path d="M9 5l7 7-7 7"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>',
  chev:'<path d="M6 9l6 6 6-6"/>',
  shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  clip:'<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9zM9 14l2 2 4-4"/>',
  chart:'<path d="M4 20V11M10 20V4M16 20v-7M22 20H2"/>',
  logout:'<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/>',
  bolt:'<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'
};
const ic = n => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]||''}</svg>`;

/* ---------- registro de acciones (cada módulo agrega las suyas) ---------- */
const actions = {};

/* ---------- estado y almacenamiento ---------- */
let state = {};
let LINK = {};                                   // datos de Fitness Control (solo lectura, no se guardan)
let SIM = {};                                    // datos de simulación (solo lectura, no se guardan)
let LINKMETA = {estado:'off',msg:'',n:{},ts:0};
const fcId = id => /^(fc_|sim_)/.test(String(id==null?'':id));   // dato vinculado o de simulación: solo lectura
const ovl = (aid,k) => { const a=SIM[aid]&&SIM[aid][k], b=LINK[aid]&&LINK[aid][k]; return a||b?{...(a||{}),...(b||{})}:null; };
const esVinculada = aid => !!((FIREBASE_CONFIG.databaseURL||(typeof window!=='undefined'&&window.FC_DEMO))&&(getArea(aid)||{}).vinculo);
const roDatos = aid => isRO() || esVinculada(aid);
let fbRef = null, online = false, pendingRender = false;
let session = null;
try{ session = JSON.parse(sessionStorage.getItem(SS_KEY)); }catch(e){ session = null; }
const saveSession = () => { try{ session ? sessionStorage.setItem(SS_KEY,JSON.stringify(session)) : sessionStorage.removeItem(SS_KEY); }catch(e){} };
const lsLoad = () => { try{ return JSON.parse(localStorage.getItem(LS_KEY))||{}; }catch(e){ return {}; } };
const lsSave = () => { try{ localStorage.setItem(LS_KEY,JSON.stringify(state)); }catch(e){ if(typeof memFalla==='function') memFalla(); } };
const getPath = p => {
  const ks=p.split('/'), v=ks.reduce((o,k)=>o==null?undefined:o[k],state);
  if(v!==undefined) return v;
  if(ks[0]==='data'&&ks.length>=4){ const L=ovl(ks[1],ks[2]); if(L) return ks.slice(3).reduce((o,k)=>o==null?undefined:o[k],L); }
  return v;
};

function setPath(p,val,baseForzada){           // val === undefined → borrar · baseForzada: solo para “usar el mío” (ver sincronizacion.js)
  if(/^data\/[^/]+\/(profesores|grupos|asistencia|eventos|incidencias)\/(fc_|sim_)/.test(p)){ toast(/\/sim_/.test(p)?'Es un dato de simulación: solo lectura':'Ese dato viene de Fitness Control y es de solo lectura'); return; }
  const baseAntes = FIREBASE_CONFIG.databaseURL ? (baseForzada!==undefined ? baseForzada : baseDe(p)) : null;      // cómo estaba en la nube ANTES de este cambio
  const keys=p.split('/'); let o=state;
  for(let i=0;i<keys.length-1;i++){ if(typeof o[keys[i]]!=='object'||o[keys[i]]===null) o[keys[i]]={}; o=o[keys[i]]; }
  const last=keys[keys.length-1];
  if(val===undefined) delete o[last]; else o[last]=val;
  lsSave();
  if(FIREBASE_CONFIG.databaseURL){ obPush(p,val,baseAntes); obFlush(); }
}

/* ---------- TRABAJO SIN INTERNET: COLA DE CAMBIOS PENDIENTES ----------
   Cada cambio se guarda primero en el equipo y en esta cola. La cola vive en localStorage,
   así que sobrevive aunque se cierre la app o se apague el celular sin señal.
   Cuando vuelve la conexión, los cambios se suben en orden y se van quitando de la cola.

   CUIDADO CON LOS DATOS (nada se pisa en silencio): cada cambio pendiente recuerda cómo estaba ese dato
   en la nube cuando se hizo (base). Al subirlo se compara con lo que hay en la nube AHORA:
     · nadie lo tocó           → se sube lo nuestro;
     · otra persona cambió OTRO campo del mismo registro → se juntan los dos cambios;
     · otra persona cambió EL MISMO campo con otro valor → se conserva lo que ya estaba en la nube,
       y lo nuestro queda guardado en "avisos de sincronización" para decidir (usar el mío / dejar el guardado).
   Subir dos veces el mismo cambio no duplica nada: se guarda en la misma ruta, con el mismo id. */
const OB_KEY = 'gd_outbox_v1', CF_KEY = 'gd_conflictos_v1', SYNC_KEY = 'gd_lastsync_v1';
let outbox = (()=>{ try{ return JSON.parse(localStorage.getItem(OB_KEY))||[]; }catch(e){ return []; } })();
let conflictos = (()=>{ try{ return JSON.parse(localStorage.getItem(CF_KEY))||[]; }catch(e){ return []; } })();
let obEnviando = false, srvState = null, memLlena = false, memAviso = 0;
function memFalla(){ memLlena=true; if(Date.now()-memAviso>60000){ memAviso=Date.now(); try{ toast('La memoria de este equipo está llena: conéctate a internet para subir los cambios'); }catch(e){} } }
const obSave = () => { try{ localStorage.setItem(OB_KEY,JSON.stringify(outbox)); memLlena=false; }catch(e){ memFalla(); } };
const cfSave = () => { try{ localStorage.setItem(CF_KEY,JSON.stringify(conflictos)); }catch(e){ memFalla(); } };
const pendientes = () => outbox.length;
const getIn = (o,p) => String(p).split('/').reduce((x,k)=>x==null?undefined:x[k],o);
function setIn(o,rel,val){                                 // pone (o quita, si val es null) un valor dentro de o, en la ruta relativa rel
  const ks=rel.split('/'); if(o===null||typeof o!=='object'||Array.isArray(o)) o={};
  let x=o;
  for(let i=0;i<ks.length-1;i++){ if(x[ks[i]]===null||typeof x[ks[i]]!=='object') x[ks[i]]={}; x=x[ks[i]]; }
  if(val===null||val===undefined) delete x[ks[ks.length-1]]; else x[ks[ks.length-1]]=val;
  return o;
}
/* cómo estaba ese dato en la nube la última vez que se vio */
function baseDe(p){
  if(srvState){ const b=getIn(srvState,p); return b===undefined?null:clean(b); }
  // la app se abrió sin internet: se usa la copia del equipo, quitando los cambios pendientes que están dentro de esta ruta
  let b=getIn(state,p); b=b===undefined?null:clean(b);
  outbox.filter(o=>o.p.startsWith(p+'/')).forEach(o=>{ b=setIn(b,o.p.slice(p.length+1),o.base===undefined?null:clean(o.base)); });
  return b;
}
function obPush(p,val,baseAntes){
  const v=val===undefined?null:clean(val), t=Date.now();
  const anc=outbox.find(o=>p.startsWith(o.p+'/'));         // ya hay un cambio pendiente que contiene a este: se junta con él
  if(anc){ anc.v=setIn(anc.v,p.slice(anc.p.length+1),v); anc.t=t; obSave(); return; }
  const igual=outbox.find(o=>o.p===p);
  const base=igual?igual.base:baseAntes;                   // si ya había uno pendiente en esta ruta, se conserva la base original
  outbox=outbox.filter(o=>o.p!==p && !o.p.startsWith(p+'/'));
  outbox.push({id:uid(),p,v,base:base===undefined?null:base,t});
  obSave();
}
function obAplicarLocal(){                          // vuelve a poner encima los cambios que aún no llegan a la nube
  outbox.forEach(o=>{
    const keys=o.p.split('/'); let x=state;
    for(let i=0;i<keys.length-1;i++){ if(typeof x[keys[i]]!=='object'||x[keys[i]]===null) x[keys[i]]={}; x=x[keys[i]]; }
    const last=keys[keys.length-1];
    if(o.v===null) delete x[last]; else x[last]=clean(o.v);
  });
}
const jeq = (a,b) => JSON.stringify(a===undefined?null:a)===JSON.stringify(b===undefined?null:b);
const esObj = x => x!==null && typeof x==='object' && !Array.isArray(x);
/* mezcla de tres: base (cómo estaba), ours (lo que hicimos), cur (lo que hay ahora en la nube) */
function merge3(base,ours,cur,ruta,confl){
  if(jeq(ours,cur)) return cur === undefined ? null : cur;
  if(jeq(cur,base)) return ours;                          // nadie lo tocó
  if(jeq(ours,base)) return cur === undefined ? null : cur;                          // nosotros no lo cambiamos
  if(esObj(ours)&&esObj(cur)&&(esObj(base)||base==null)){
    const b=esObj(base)?base:{}, out={...cur};
    new Set([...Object.keys(ours),...Object.keys(cur),...Object.keys(b)]).forEach(k=>{
      const m=merge3(b[k],ours[k],cur[k],ruta+'/'+k,confl);
      if(m===null||m===undefined) delete out[k]; else out[k]=m;
    });
    return Object.keys(out).length?out:null;
  }
  confl.push({ruta,mio:ours===undefined?null:ours,nube:cur===undefined?null:cur});   // los dos cambiaron lo mismo: gana lo que ya estaba en la nube
  return cur === undefined ? null : cur;
}
function cfRegistra(confl){
  confl.forEach(c=>conflictos.push({id:uid(),ruta:c.ruta,mio:c.mio,nube:c.nube,t:Date.now()}));
  cfSave();
  try{ toast(`Otra persona ya había guardado ${confl.length===1?'ese dato':'esos datos'}: se conservó lo guardado. Toca la nube para revisar.`); }catch(e){}
}
function obFlush(){
  if(!fbRef||!online||obEnviando||!outbox.length) return;
  obEnviando=true;
  const lote=outbox.slice();
  Promise.all(lote.map(o=>{
    let confl=[];
    return fbRef.child(o.p).transaction(cur=>{
      confl=[];
      const c=cur===undefined?null:cur, m=merge3(o.base,o.v,c,o.p,confl);
      return jeq(m,c)?undefined:m;                         // si ya está igual, no escribe
    },undefined,false).then(()=>{
      outbox=outbox.filter(x=>x.id!==o.id); obSave();
      if(confl.length) cfRegistra(confl);
    });
  })).then(()=>{ if(!outbox.length){ try{ localStorage.setItem(SYNC_KEY,String(Date.now())); }catch(e){} } })
    .catch(e=>{ console.warn('No se pudo subir un cambio',e); toast('Un cambio no se pudo subir: se reintentará'); })
    .finally(()=>{ obEnviando=false; safeRender(); if(outbox.length&&online) setTimeout(obFlush,4000); });
}
/* texto del indicador de nube (barra superior y menú lateral) */
function cloudChip(){
  if(simActiva()) return {cls:'sim',txt:'Datos de simulación'};
  const n=pendientes(), c=conflictos.length, rev=c?` · ${c} por revisar`:'';
  if(memLlena) return {cls:'bad',txt:'Memoria llena: sube los cambios'};
  if(!FIREBASE_CONFIG.databaseURL) return {cls:'',txt:'Solo en este equipo'};
  if(online) return n?{cls:'on',txt:`Subiendo ${n} cambio${n>1?'s':''}…${rev}`}:{cls:c?'warn':'on',txt:`Guardado en la nube ✔${rev}`};
  return {cls:c?'warn':'',txt:(n?`Sin internet · ${n} por subir`:'Sin internet · guardando en el equipo')+rev};
}

function ensureSeed(){
  let ch=false;
  if(!state.cfg){ state.cfg={}; ch=true; }
  if(!state.cfg.areas){
    state.cfg.areas={};
    DEFAULT_AREAS.forEach((a,i)=>{ state.cfg.areas[a.id]={...a,orden:i,color:COLORS[i%COLORS.length]}; });
    state.cfg.gimAdd=true; state.cfg.servAdd=true; ch=true;
  }
  if(!state.cfg.gimAdd){                                  // configuraciones anteriores: se agrega el área Gimnasio una sola vez
    state.cfg.gimAdd=true; ch=true;
    if(!Object.values(state.cfg.areas).some(a=>a.tipo==='gimnasio')){
      const orden=Math.max(0,...Object.values(state.cfg.areas).map(a=>a.orden||0))+1;
      state.cfg.areas.gimnasio={id:'gimnasio',nombre:'Gimnasio',icono:'pesas',tipo:'gimnasio',cap:60,abre:6,cierra:23,estancia:1.25,horario:{d0:{a:6,c:23},d1:{a:6,c:23},d2:{a:6,c:23},d3:{a:6,c:23},d4:{a:6,c:23},d5:{a:6,c:23},d6:{a:9,c:16}},orden,color:COLORS[Object.keys(state.cfg.areas).length%COLORS.length]};
    }
  }
  if(!state.cfg.servAdd){                                 // configuraciones anteriores: se agregan Nutrición y Fisioterapia una sola vez
    state.cfg.servAdd=true; ch=true;
    DEFAULT_AREAS.filter(x=>SERV_TIPOS.includes(x.tipo)).forEach(x=>{
      if(Object.values(state.cfg.areas).some(a=>a.tipo===x.tipo)) return;
      const orden=Math.max(0,...Object.values(state.cfg.areas).map(a=>a.orden||0))+1;
      state.cfg.areas[x.id]={...x,orden,color:COLORS[Object.keys(state.cfg.areas).length%COLORS.length]};
    });
  }
  if(!state.cfg.paramedAdd){                              // configuraciones anteriores: se agrega Paramédicos una sola vez
    state.cfg.paramedAdd=true; ch=true;
    if(!Object.values(state.cfg.areas).some(a=>a.tipo==='paramedico')){
      const x=DEFAULT_AREAS.find(a=>a.tipo==='paramedico'), orden=Math.max(0,...Object.values(state.cfg.areas).map(a=>a.orden||0))+1;
      state.cfg.areas[x.id]={...x,orden,color:COLORS[Object.keys(state.cfg.areas).length%COLORS.length]};
    }
  }
  if(state.cfg.ver!==THEME_VER){                       // paleta nueva del tema claro
    areasList().forEach((a,i)=>{ state.cfg.areas[a.id].color=COLORS[i%COLORS.length]; });
    state.cfg.ver=THEME_VER; ch=true;
  }
  Object.values(state.cfg.areas).forEach(a=>{ if(a.id==='fitness'&&a.vinculo===undefined){ a.vinculo=true; ch=true; } });
  if(!state.cfg.gimExclAdd){                              // una sola vez: Gimnasia deja de recibir clases automáticas de Fitness Control
    state.cfg.gimExclAdd=true; ch=true;
    if(state.cfg.areas.gimnasia&&state.cfg.areas.gimnasia.fcExcluir===undefined) state.cfg.areas.gimnasia.fcExcluir=true;
  }
  if(!state.cfg.pass){ state.cfg.pass={}; ch=true; }
  if(!state.cfg.pass.ger){ state.cfg.pass.ger=hashPass(DEF_PASS_GER); ch=true; }
  if(!state.cfg.pass.met){ state.cfg.pass.met=hashPass(DEF_PASS_MET); ch=true; }
  if(!state.cfg.pass.dir){ state.cfg.pass.dir={}; ch=true; }
  Object.keys(state.cfg.areas).forEach(id=>{ if(!state.cfg.pass.dir[id]){ state.cfg.pass.dir[id]=hashPass(DEF_PASS_DIR); ch=true; } });
  return ch;
}

const loadScript = src => new Promise((ok,ko)=>{ const s=document.createElement('script'); s.src=src; s.onload=ok; s.onerror=()=>{ s.remove(); ko(new Error('No cargó '+src)); }; document.head.appendChild(s); });
let fbIniciado = false;
async function initFirebase(){
  if(fbIniciado) return;
  try{
    if(typeof firebase==='undefined'||!firebase.database){
      await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
      await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js');
    }
    fbIniciado=true;
    if(!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);              // app de Gerencia (por defecto)
    const db=firebase.database();
    db.ref('.info/connected').on('value',s=>{ online=!!s.val(); if(online) obFlush(); safeRender(); });
    if(typeof fcConectar==='function'){                                            // segunda app: solo lectura de Fitness Control
      const appFC = firebase.apps.find(a=>a.name==='fitness') || firebase.initializeApp(FIREBASE_CONFIG_FITNESS,'fitness');
      fcConectar(appFC.database());
    }
    const ref=db.ref(DB_ROOT);
    let first=true;
    ref.on('value',snap=>{
      const v=snap.val();
      if(first){
        first=false; fbRef=ref;
        if(v===null){                                        // nube vacía: sube lo que hay en este equipo
          ensureSeed(); ref.set(clean(state)); outbox=[]; obSave(); lsSave(); safeRender(); return;
        }
      }
      srvState=v?clean(v):{};                               // cómo está la nube (para saber si alguien más cambió algo mientras trabajábamos sin internet)
      state=v||{};
      obAplicarLocal();                                      // lo capturado sin internet no se pierde al llegar la nube
      if(ensureSeed()) ref.child('cfg').set(clean(state.cfg));
      lsSave(); validateSession(); safeRender(); obFlush();
    },err=>{ console.warn(err); toast('No se pudo leer Firebase: usando la copia de este equipo'); });
  }catch(e){
    // sin internet al abrir: la app sigue con la copia del equipo y se conecta cuando vuelva la señal
    console.warn('Firebase no disponible todavía',e);
  }
}
if(typeof window!=='undefined'){
  window.addEventListener('online',()=>{ if(FIREBASE_CONFIG.databaseURL&&!fbIniciado) initFirebase(); else obFlush(); });
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'&&FIREBASE_CONFIG.databaseURL){ if(!fbIniciado) initFirebase(); else obFlush(); } });
  setInterval(()=>{ if(!FIREBASE_CONFIG.databaseURL) return; if(!fbIniciado) initFirebase(); else if(outbox.length&&online) obFlush(); },20000);   // reintento automático
}

/* ---------- acceso a datos ---------- */
const areasList = () => Object.values((state.cfg&&state.cfg.areas)||{}).sort((a,b)=>(a.orden||0)-(b.orden||0));
const getArea = id => (state.cfg&&state.cfg.areas&&state.cfg.areas[id])||null;
const LINK_KEYS = ['profesores','grupos','asistencia','eventos','incidencias','reportes'];
/* Orden de prioridad: simulación < datos capturados en Gerencia < datos vinculados de Fitness Control */
const mezcla = (aid,k) => { const n=((state.data&&state.data[aid])||{})[k]||{}, s=SIM[aid]&&SIM[aid][k], l=LINK[aid]&&LINK[aid][k]; return (s||l)?{...(s||{}),...n,...(l||{})}:n; };
const areaData = aid => {
  const n=(state.data&&state.data[aid])||{}; if(!SIM[aid]&&!LINK[aid]) return n;
  const o={...n}; LINK_KEYS.forEach(k=>{ o[k]=mezcla(aid,k); }); return o;
};
const coll = (aid,k) => Object.values(mezcla(aid,k));
const grupos = aid => coll(aid,'grupos');
const profesores = aid => coll(aid,'profesores').sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre),'es'));
const getProf = (aid,id) => mezcla(aid,'profesores')[id]||null;
/* Profesores por día: un grupo puede tener varios profesores y cambiar según el día.
   g.profDia = {d0:'idA,idB', d2:'idB'} (d0 = lunes). Si no existe, rige g.profId para todos los días (grupos viejos). */
const pdActivo = g => !!(g&&g.profDia&&typeof g.profDia==='object'&&Object.keys(g.profDia).length);
const profsDeDia = (g,wd) => pdActivo(g) ? String(g.profDia['d'+wd]||'').split(',').filter(Boolean) : (g&&g.profId?[g.profId]:[]);
const profsDeGrupo = g => { if(!pdActivo(g)) return g&&g.profId?[g.profId]:[]; const s=new Set(); Object.values(g.profDia).forEach(v=>String(v).split(',').filter(Boolean).forEach(x=>s.add(x))); return [...s]; };
const daClase = (g,pid,fecha) => profsDeDia(g,wdIdx(fecha)).includes(pid);
const profNombresDe = (aid,ids,fallback) => { const n=ids.map(i=>(getProf(aid,i)||{}).nombre).filter(Boolean); return n.length?n.join(' / '):(fallback||''); };
/* Horario por día: g.horDia = {d1:'16:00|17:30'} (d0 = lunes). Los días sin dato usan g.hi / g.hf. */
const horaEn = (g,wd) => { const v=g&&g.horDia&&g.horDia['d'+wd]; if(v){ const [a,b]=String(v).split('|'); return {hi:a||'',hf:b||''}; } return {hi:(g&&g.hi)||'',hf:(g&&g.hf)||''}; };
const gDiaWd = (g,wd) => { if(!g||!g.horDia) return g; const h=horaEn(g,wd); return (h.hi===(g.hi||'')&&h.hf===(g.hf||''))?g:{...g,hi:h.hi,hf:h.hf}; };
const gDia = (g,fecha) => gDiaWd(g,wdIdx(fecha));            // el mismo grupo con el horario que tiene ese día
const clasesDe = (aid,pid) => grupos(aid).filter(g=>profsDeGrupo(g).includes(pid));
const iniciales = n => String(n||'').split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?';
/* ¿Esta clase se imparte en esa fecha? Día de la semana + vigencia (desde qué fecha rige el horario en Fitness Control) */
const progEn = (g,fecha) => { const wd=wdIdx(fecha); if(!diasArr(g).includes(wd)) return false;
  const v=g.vig&&g.vig[wd]; return !v||v.some(x=>(!x.d||fecha>=x.d)&&(!x.f||fecha<=x.f)); };
const diasArr = g => String(g.dias||'').split(',').filter(x=>x!=='').map(Number);
/* Lista de alumnos: una línea por alumno, "Nombre" o "Nombre|edad". rosterOf devuelve solo los nombres
   (con ellos se pasa lista), así que las listas viejas sin edad siguen funcionando igual. */
const alumParse = l => { const i=l.lastIndexOf('|'); if(i<0) return {n:l,e:null}; const n=l.slice(0,i).trim(), e=parseInt(l.slice(i+1),10); return {n:n||l,e:(e>0&&e<110)?e:null}; };
const rosterAlum = g => String(g.alumnos||'').split('\n').map(s=>s.trim()).filter(Boolean).map(alumParse);
const rosterOf = g => rosterAlum(g).map(x=>x.n);
/* Tipo de grupo: ACADEMIA (con costo, inscripción y lista de alumnos) o SERVICIO (gratuito, sin inscripción: entra quien se acerca
   y el profesor cuenta cuántos asistieron). Los grupos viejos son academia; las clases que llegan de Fitness Control, servicio. */
const tipoGrupoDe = g => (g&&g.tipoGrupo) || (g&&g.fc ? 'servicio' : 'academia');
const esFitArea = aid => !!(getArea(aid)||{}).vinculo;                           // el área de clases fitness (vinculada a Fitness Control)
const fitHo = () => { const v=(state.cfg||{}).fitHo, n=(v==null||v==='')?30:+v; return Math.max(0,Math.min(100,isNaN(n)?30:n)); };   // % de hombres en clases fitness (el resto, mujeres)
const edadesOf = g => Object.fromEntries(rosterAlum(g).filter(x=>x.e!=null).map(x=>[x.n,x.e]));
const inscritos = g => rosterOf(g).length || (+g.inscritos||0);
const horaTxt = g => (g.hi||'')+(g.hf?'–'+g.hf:'');
const aforoCls = p => p==null?'mut':p>=75?'ok':p>=30?'warn':'bad';
const areaColor = aid => (getArea(aid)||{}).color||COLORS[0];
const byHora = (a,b) => (a.hi||'99:99').localeCompare(b.hi||'99:99') || String(a.nombre).localeCompare(String(b.nombre));
const GR = {alta:0,media:1,baja:2};
const incSort = (a,b) => ((GR[a.grav]!=null?GR[a.grav]:1)-(GR[b.grav]!=null?GR[b.grav]:1)) || String(b.fecha).localeCompare(String(a.fecha));

/* Un registro de asistencia = {id, grupoId, fecha, asistentes, omitida?}. "omitida" = no hubo clase (no cuenta en el aforo). */
function regInfo(r,g){
  if(!r) return {tipo:'none',p:null,txt:'',cls:'mut'};
  if(r.omitida) return {tipo:'skip',p:null,txt:'Sin clase',cls:'mut'};
  const cupo=+g.cupo||0, n=+r.asistentes||0, p=cupo>0?Math.round(n/cupo*100):null;
  return {tipo:'ok',p,txt:`${n}/${cupo||'—'}`,cls:aforoCls(p)};
}
function aforoGrupo(aid,g,desde){
  const recs=coll(aid,'asistencia').filter(r=>r.grupoId===g.id&&r.fecha>=desde&&!r.omitida);
  if(!recs.length||!(+g.cupo>0)) return null;
  return Math.round(recs.reduce((s,r)=>s+(+r.asistentes||0),0)/recs.length/(+g.cupo)*100);
}
/* Mujeres y hombres que reportan las clases de un área (hoy solo Fitness, desde Fitness Control) */
function areaSexo(aid,desde,hasta){
  let mu=0, ho=0, n=0, sin=0, prop=false;
  const fit=esFitArea(aid);
  coll(aid,'asistencia').forEach(r=>{
    if(r.omitida||r.fecha<desde||r.fecha>hasta) return;
    if(r.hom!=null||r.muj!=null){ mu+=+r.muj||0; ho+=+r.hom||0; n++; }                 // el registro ya trae hombres y mujeres
    else if(fit&&+r.asistentes>0){ sin+=+r.asistentes; n++; }                              // clases fitness sin ese dato: se aplica la proporción definida
  });
  if(sin){ const h=Math.round(sin*fitHo()/100); ho+=h; mu+=sin-h; prop=true; }
  return {mu,ho,n,prop,tot:mu+ho,pctMu:mu+ho?Math.round(mu/(mu+ho)*100):null,pctHo:mu+ho?Math.round(ho/(mu+ho)*100):null};
}
function aforoAreaN(aid,desde){                       // aforo = asistentes ÷ lugares disponibles, con los números que lo forman
  const gs=Object.fromEntries(grupos(aid).map(g=>[g.id,g]));
  let asis=0, lugares=0;
  coll(aid,'asistencia').filter(r=>r.fecha>=desde&&!r.omitida&&gs[r.grupoId]&&+gs[r.grupoId].cupo>0).forEach(r=>{ asis+=+r.asistentes||0; lugares+=+gs[r.grupoId].cupo; });
  return {pct:lugares?Math.round(asis/lugares*100):null,asis,lugares};
}
function aforoArea(aid,desde){ return aforoAreaN(aid,desde).pct; }
const numLugares = (asis,lug) => `${(+asis||0).toLocaleString('es-MX')} de ${(+lug||0).toLocaleString('es-MX')} lugares`;
/* Clases de un día: las programadas ese día de la semana + las que tienen aforo capturado en esa fecha
   (igual que la lista del día en Fitness Control). */
function gruposDelDia(aid,fecha){
  const conReg=new Set(coll(aid,'asistencia').filter(r=>r.fecha===fecha).map(r=>r.grupoId));
  return grupos(aid).filter(g=>progEn(g,fecha)||conReg.has(g.id)).map(g=>gDia(g,fecha));
}
function areaStats(aid){
  const t=todayStr(), gs=grupos(aid), wk=mondayOf(t), wd=wdIdx(t);
  const evs=coll(aid,'eventos').filter(e=>e.fecha>=t&&e.estado!=='cancelado').sort((a,b)=>(a.fecha+(a.hora||'')).localeCompare(b.fecha+(b.hora||'')));
  const reps=areaData(aid).reportes||{};
  const rep=reps[wk];
  const ult=Object.values(reps).filter(r=>r.entregado).sort((a,b)=>b.semana.localeCompare(a.semana))[0];
  const prog=gruposDelDia(aid,t);
  const hoyRecs=new Set(coll(aid,'asistencia').filter(r=>r.fecha===t).map(r=>r.grupoId));
  const R={
    grupos:gs.length, alumnos:gs.reduce((s,g)=>s+inscritos(g),0), aforo:aforoArea(aid,addDays(t,-30)), aforoN:aforoAreaN(aid,addDays(t,-30)),
    incAbiertas:coll(aid,'incidencias').filter(i=>i.estado!=='resuelta').length,
    proxEvento:evs[0]||null, eventos:evs, reporte:rep?(rep.entregado?'entregado':'borrador'):'pendiente', ultimoReporte:ult?ult.semana:null,
    profes:profesores(aid).filter(p=>p.activo!==false).length,
    hoyProg:prog.length, hoyCap:prog.filter(g=>hoyRecs.has(g.id)).length
  };
  if(typeof esServ==='function'&&esServ(aid)) Object.assign(R,servAreaStats(aid));      // Nutrición y Fisioterapia: citas y casos en lugar de grupos
  return R;
}
function dayItems(aid,d){
  const wd=wdIdx(d);
  const cls=grupos(aid).filter(g=>progEn(g,d)).map(g=>gDia(g,d)).map(g=>({t:'g',hora:g.hi||'',g}));
  const evs=coll(aid,'eventos').filter(e=>e.fecha===d).map(e=>({t:'e',hora:e.hora||'',e}));
  return [...evs,...cls].sort((a,b)=>(a.hora||'99:99').localeCompare(b.hora||'99:99'));
}

/* ---------- interfaz: estado, aviso, ventana emergente ---------- */
const ui = {
  gTab:'resumen', gArea:null, aTab:'inicio', gDia:-1,
  calMode:'mes', calRef:todayStr(), calSel:todayStr(), evFil:'proximos',
  repTab:'semanal', repWeek:mondayOf(todayStr()), incFil:'abiertas',
  afFecha:todayStr(), afTodos:false,
  pTab:'hoy', pFecha:todayStr(), lista:null,
  chartSel:null, gaFecha:todayStr()
};
const isRO = () => !!session && (session.rol==='ger'||session.rol==='met');
const isProf = () => !!session && session.rol==='prof';
const curArea = () => session ? (session.rol==='ger' ? ui.gArea : session.area) : null;

let toastT=null;
/* ---------- CONFIRMACIONES PROPIAS ----------
   El confirm() del navegador no funciona dentro de apps incrustadas o en ventanas sin permiso para diálogos
   (devuelve “no” sin mostrar nada: el botón parece muerto). Por eso confirm() se reemplaza por una ventana de la app.
   Funciona así: la acción que pide confirmar se interrumpe, se muestra la ventana y, si se acepta, la MISMA acción se
   vuelve a ejecutar ya confirmada. (Todas las confirmaciones de la app están al inicio de su acción, antes de cambiar nada.) */
let accionActual = null, confirmOk = false;
const confirmNativo = (typeof window!=='undefined'&&window.confirm) ? window.confirm.bind(window) : (()=>true);
function confirmar(msg){
  if(confirmOk){ confirmOk=false; return true; }
  const a=accionActual; if(!a) return confirmNativo(msg);          // fuera de un toque (pruebas, código interno): confirm normal
  mostrarConfirmar(msg,()=>{ confirmOk=true; accionActual=a; try{ a.fn(a.d,a.e); }finally{ confirmOk=false; accionActual=null; } });
  return false;
}
function cerrarConfirmar(){ const d=document.getElementById('confirmDlg'); if(d) d.remove(); }
function mostrarConfirmar(msg,ok){
  cerrarConfirmar();
  const peligro=/elimin|quitar|borrar|cancelar esta cita/i.test(msg), d=document.createElement('div');
  d.id='confirmDlg'; d.className='cf-ov'; d.setAttribute('role','alertdialog'); d.setAttribute('aria-modal','true');
  d.innerHTML=`<div class="cf-box"><p>${esc(msg)}</p><div class="btns"><button class="btn" data-cf="no">Cancelar</button><button class="btn ${peligro?'danger':'primary'}" data-cf="si">Aceptar</button></div></div>`;
  d.addEventListener('click',ev=>{
    ev.stopPropagation(); const b=ev.target.closest('[data-cf]');
    if(ev.target===d||(b&&b.dataset.cf==='no')) cerrarConfirmar();
    else if(b&&b.dataset.cf==='si'){ cerrarConfirmar(); ok(); }
  });
  document.body.appendChild(d); const b=d.querySelector('[data-cf="no"]'); if(b) b.focus();
}
if(typeof window!=='undefined'){ window.confirm=confirmar; document.addEventListener('keydown',e=>{ if(e.key==='Escape') cerrarConfirmar(); }); }
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),2300); }
function openModal(html){ const m=$('#modal'); m.innerHTML=`<div class="sheet" role="dialog" aria-modal="true">${html}</div>`; m.hidden=false; document.body.style.overflow='hidden'; }
function closeModal(){ const m=$('#modal'); m.hidden=true; m.innerHTML=''; document.body.style.overflow=''; if(pendingRender){ pendingRender=false; render(); } }
const mHead = t => `<div class="sh-h"><b>${t}</b><button class="ibtn" data-act="closeModal" aria-label="Cerrar">${ic('x')}</button></div>`;
const opts = (arr,sel) => arr.map(o=>`<option value="${esc(o)}"${o===sel?' selected':''}>${esc(o)}</option>`).join('');
function safeRender(){                          // no redibuja mientras se escribe o hay una ventana abierta
  const ae=document.activeElement;
  const typing=ae&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName);
  const pw=$('#pw');
  if(!$('#modal').hidden || typing || (!session&&pw&&pw.value) || (typeof afBusy==='function'&&afBusy()) || (typeof rfBusy==='function'&&rfBusy())){ pendingRender=true; return; }
  render();
}
function validateSession(){
  if(session&&session.rol!=='ger'&&session.rol!=='met'&&!getArea(session.area)){ session=null; saveSession(); }
  if(session&&session.rol==='prof'&&!getProf(session.area,session.profId)){ session=null; saveSession(); }
  if(session&&session.rol==='rec'&&!getRec(session.area,session.recId)){ session=null; saveSession(); }
  if(ui.gArea&&!getArea(ui.gArea)) ui.gArea=null;
}

/* ---------- componentes pequeños ---------- */
const kpi = (label,value,cap='',o={}) => {
  const cuerpo=`<span class="k-l">${label}</span><b class="${o.cls||''}">${value}</b>${cap?`<em class="k-c">${cap}</em>`:''}`;
  return o.k ? `<button class="kpi kpi-btn" data-act="openKpi" data-k="${o.k}" style="--kc:${o.color||'var(--g)'}" aria-label="${esc(String(label).replace(/<[^>]*>/g,''))}: ver el detalle">${cuerpo}<span class="k-go" aria-hidden="true">${ic('next')}</span></button>`
              : `<div class="kpi" style="--kc:${o.color||'var(--g)'}">${cuerpo}</div>`;
};
const pill = (txt,cls) => `<span class="pill ${cls}">${esc(txt)}</span>`;
const plu = (n,s,p) => `${n} ${n===1?s:p}`;
const empty = txt => `<div class="empty">${txt}</div>`;
const repPill = s => s==='entregado' ? pill('Reporte entregado','ok') : s==='borrador' ? pill('Reporte en borrador','info') : pill('Reporte pendiente','warn');
