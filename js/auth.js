'use strict';
/* =====================================================================
   auth.js — acceso y sesión, por pasos y con la configuración guardada en el equipo.
   Primera vez en un teléfono:  1) ¿cómo vas a entrar? (Gerencia, Dirección, Profesor,
   Recepción o Metodología) → 2) tu disciplina (Dirección, Profesor) → 3) contraseña
   (el Profesor elige además su nombre y escribe su PIN).
   Al entrar con éxito, esa ruta se guarda en el equipo. Las siguientes veces la app
   abre directo en la última pantalla (por ejemplo “Dirección · Gimnasia”) y solo pide
   la contraseña: no se ven las demás opciones.
   · Quien dirige más de una disciplina (Dirección) ve “Cambiar de disciplina” y puede ir
     atrás para elegir otra; la última con la que entra queda como predeterminada.
   · Los demás accesos no tienen flecha para regresar. Para reconfigurar un equipo hay que
     mantener presionado el logo y escribir la contraseña de Gerencia.
   ===================================================================== */
const EQ_KEY = 'gd_equipo_v1';
const ROLES_LOGIN = [['ger','shield','Gerencia','Todas las áreas'],['dir','user','Dirección','Mi disciplina'],['prof','clip','Profesor','Pasar lista'],['rec','users','Recepción','Gimnasio'],['met','chart','Metodología','Aforos, eventos y pruebas']];
const ROL_NOMBRE = {ger:'Gerencia',dir:'Dirección',prof:'Profesor',rec:'Recepción',met:'Metodología'};
const loginUI = { rol:'', area:'', prof:'', err:'', paso:'rol', fijo:false, cfg:null };
let loginIniciado = false, lgPress = null;

const equipoCfg = () => {                                 // configuración guardada en este equipo (o el último acceso de versiones anteriores)
  for(const k of [EQ_KEY,LAST_KEY]){ try{ const c=JSON.parse(localStorage.getItem(k)); if(c&&['ger','dir','prof','rec','met'].includes(c.rol)) return c; }catch(e){} }
  return null;
};
function loginArranque(){
  loginIniciado=true; const c=equipoCfg(); loginUI.cfg=c; loginUI.fijo=!!c; loginUI.err='';
  if(!c){ Object.assign(loginUI,{rol:'',area:'',prof:'',paso:'rol'}); return; }
  loginUI.rol=c.rol; loginUI.area=c.area||''; loginUI.prof=c.prof||'';
  if(!['dir','prof','rec'].includes(c.rol)){ loginUI.area='all'; loginUI.paso='clave'; }
  else loginUI.paso=c.area?'clave':'area';
}
/* disciplinas que se pueden elegir según el acceso */
function loginAreasPara(rol){
  const as=areasList();
  if(rol==='rec') return as.filter(a=>esGim(a.id));
  if(rol==='prof') return as.filter(a=>!esVinculada(a.id)&&profesores(a.id).some(p=>p.activo!==false&&!p.sim&&p.pin));    // los de Fitness pasan lista en Fitness Control
  return as;
}
function loginGente(){                                    // personas que pueden entrar con PIN en la disciplina elegida
  const a=getArea(loginUI.area); if(!a) return [];
  if(loginUI.rol==='rec') return esGim(a.id)?recepcion(a.id).filter(r=>r.activo!==false&&r.pin):[];
  return esVinculada(a.id)?[]:profesores(a.id).filter(p=>p.activo!==false&&!p.sim&&p.pin);
}
function loginPuedeAtras(paso){
  if(paso==='rol') return false;
  if(!loginUI.fijo) return true;                          // configurando el equipo: se puede corregir
  return !!loginUI.cfg&&loginUI.cfg.rol==='dir'&&paso==='clave';       // equipo ya configurado: solo Dirección cambia de disciplina
}

function pasoRol(){
  return `<p class="lg-q">¿Cómo vas a entrar?</p>
    <div class="lg-roles">${ROLES_LOGIN.map(([id,ico,n,s])=>`<button class="lg-role" data-act="loginRol" data-rol="${id}">${ic(ico)}<b>${n}</b><small>${s}</small></button>`).join('')}</div>`;
}
function pasoArea(){
  const as=loginAreasPara(loginUI.rol);
  return `<div class="lg-ruta"><b>${ROL_NOMBRE[loginUI.rol]||''}</b></div>
    <p class="lg-q">Selecciona tu disciplina:</p>
    ${as.length?`<div class="lg-list">${as.map(a=>`<button class="lg-area" data-act="loginArea" data-id="${esc(a.id)}" style="--ac:${esc(a.color)}">${areaIco(a,{tile:true,size:22})}<b>${esc(a.nombre)}</b>${ic('next')}</button>`).join('')}</div>`
      :`<div class="lg-note">${loginUI.rol==='prof'?'Todavía no hay profesores con PIN. La dirección de cada disciplina debe darlos de alta.':'No hay disciplinas disponibles.'}</div>`}`;
}
function pasoClave(){
  const rol=loginUI.rol, a=getArea(loginUI.area), pin=['prof','rec'].includes(rol);
  let quien='';
  if(pin){
    const gente=loginGente(), actual=gente.find(x=>x.id===loginUI.prof);
    if(!actual&&loginUI.prof) loginUI.prof='';
    if(a&&esVinculada(a.id)) quien=`<div class="lg-note">Los profesores de ${esc(a.nombre)} pasan lista en Fitness Control.</div>`;
    else if(!gente.length) quien=`<div class="lg-note">${a?esc(a.nombre)+' todavía no tiene '+(rol==='rec'?'personal de recepción':'profesores')+'. La dirección debe darlos de alta.':'Elige primero tu disciplina.'}</div>`;
    else if(actual&&(loginUI.fijo||gente.length===1)) quien=`<div class="lg-nombre">${ic('user')}<b>${esc(actual.nombre)}</b></div>`;
    else{
      if(!actual) loginUI.prof=gente.length===1?gente[0].id:'';
      quien=`<p class="lg-q">Selecciona tu nombre:</p><div class="lg-select"><select id="loginProf" aria-label="Nombre">${'<option value="">Elige tu nombre…</option>'}${gente.map(x=>`<option value="${esc(x.id)}"${loginUI.prof===x.id?' selected':''}>${esc(x.nombre)}</option>`).join('')}</select>${ic('chev')}</div>`;
    }
  }
  return `<div class="lg-ruta"><b>${ROL_NOMBRE[rol]||''}</b>${a?`<span class="lg-sep">·</span><span class="lg-disc">${areaIco(a,{size:18})} ${esc(a.nombre)}</span>`:''}</div>
    ${quien}
    <label class="lg-lbl" id="pwLbl" for="pw">${pin?'PIN':'Contraseña'}</label>
    <input id="pw" type="password" placeholder="${pin?'Ingresa tu PIN…':'Ingresa tu contraseña…'}" autocomplete="current-password"${pin?' inputmode="numeric"':''}>
    <div class="err" id="loginErr">${esc(loginUI.err)}</div>
    <button class="btn cta block" data-act="login">Entrar <span aria-hidden="true">→</span></button>
    ${loginUI.fijo?'<p class="lg-help">Este equipo recuerda tu acceso. <button class="linkbtn" data-act="loginReset">Cambiar el acceso de este equipo</button><br><small>(también: mantén presionado el logo)</small></p>':''}`;
}
function viewLogin(){
  if(!loginIniciado) loginArranque();
  const necesitaArea=['dir','prof','rec'].includes(loginUI.rol);
  let p=loginUI.paso;
  if(!loginUI.rol) p='rol';
  else if(p==='clave'&&necesitaArea&&!getArea(loginUI.area)) p='area';
  const atras=loginPuedeAtras(p);
  return `
  <div class="login">
    <div class="login-card">
      ${atras?`<button class="lg-back" data-act="loginAtras">${ic('back')} ${loginUI.fijo?'Cambiar de disciplina':'Atrás'}</button>`:''}
      <div class="lg-brand">
        <div class="lg-logo"><span class="lg-fb">${ic('shield')}</span><img src="img/logo.png" alt="Campestre" data-fallback></div>
        <div class="lg-title"><p>Club Campestre Aguascalientes</p><h1>Gerencia de Deportes</h1></div>
      </div>
      ${p==='rol'?pasoRol():p==='area'?pasoArea():pasoClave()}
      ${simActiva()?'<div class="lg-help"><p class="lg-sim">Modo simulación: se ven datos de ejemplo en todas las áreas</p></div>':''}
    </div>
  </div>`;
}
function loginFoco(){ setTimeout(()=>{ const pw=$('#pw'); if(pw) pw.focus(); },60); }

function doLogin(){
  const sel=$('#loginArea'); if(sel) loginUI.area=sel.value;
  const ps=$('#loginProf'); if(ps) loginUI.prof=ps.value;
  const pw=($('#pw')||{}).value||'';
  const fail=m=>{ loginUI.err=m; const e=$('#loginErr'); if(e) e.textContent=m; };
  if(loginUI.rol==='ger'){
    if(hashPass(pw)!==state.cfg.pass.ger) return fail('Contraseña de gerencia incorrecta.');
    session={rol:'ger',area:null};
    if(loginUI.area!=='all'&&getArea(loginUI.area)){ ui.gTab='areas'; ui.gArea=loginUI.area; ui.aTab='inicio'; }
    else { ui.gTab='resumen'; ui.gArea=null; }
  } else if(loginUI.rol==='met'){
    if(hashPass(pw)!==state.cfg.pass.met) return fail('Contraseña de metodología incorrecta.');
    session={rol:'met',area:null}; ui.mt.tab='aforos'; ui.mt.aArea=null; ui.mt.eArea=null; ui.mt.pSel=null; ui.mt.nuevo=null;
  } else if(loginUI.rol==='dir'){
    if(loginUI.area==='all'||!getArea(loginUI.area)) return fail('Elige la disciplina a la que entras como dirección.');
    if(hashPass(pw)!==state.cfg.pass.dir[loginUI.area]) return fail('Contraseña de dirección incorrecta.');
    session={rol:'dir',area:loginUI.area}; ui.aTab='inicio';
  } else if(loginUI.rol==='rec'){
    if(loginUI.area==='all'||!getArea(loginUI.area)||!esGim(loginUI.area)) return fail('Elige el área del gimnasio.');
    const r=getRec(loginUI.area,loginUI.prof);
    if(!r||r.activo===false) return fail('Elige tu nombre en la lista.');
    if(String(pw).trim()!==String(r.pin)) return fail('PIN incorrecto.');
    session={rol:'rec',area:loginUI.area,recId:r.id}; ui.aTab='gimaforo';
  } else {
    if(loginUI.area==='all'||!getArea(loginUI.area)) return fail('Elige tu disciplina.');
    const p=getProf(loginUI.area,loginUI.prof);
    if(!p||p.activo===false) return fail('Elige tu nombre en la lista.');
    if(String(pw).trim()!==String(p.pin)) return fail('PIN incorrecto.');
    session={rol:'prof',area:loginUI.area,profId:p.id}; ui.pTab='hoy'; ui.pFecha=todayStr();
  }
  try{                                                    // la ruta con la que se entró queda como predeterminada en este equipo
    const c={rol:loginUI.rol,area:loginUI.area,prof:loginUI.prof};
    localStorage.setItem(EQ_KEY,JSON.stringify(c)); localStorage.setItem(LAST_KEY,JSON.stringify(c));
    loginUI.cfg=c; loginUI.fijo=true;
  }catch(e){}
  loginUI.err=''; ui.repTab='semanal'; ui.afFecha=todayStr(); ui.gaFecha=todayStr(); ui.afTodos=false; ui.lista=null;
  saveSession(); render(); top0();
}

Object.assign(actions,{
  loginRol(d){
    loginUI.rol=d.rol; loginUI.err=''; loginUI.prof='';
    if(['ger','met'].includes(d.rol)){ loginUI.area='all'; loginUI.paso='clave'; }
    else if(d.rol==='rec'){ const g=loginAreasPara('rec'); loginUI.area=g.length===1?g[0].id:''; loginUI.paso=g.length===1?'clave':'area'; }
    else { loginUI.area=''; loginUI.paso='area'; }
    render(); if(loginUI.paso==='clave') loginFoco();
  },
  loginArea(d){ loginUI.area=d.id; loginUI.prof=''; loginUI.err=''; loginUI.paso='clave'; render(); loginFoco(); },
  loginAtras(){
    const p=loginUI.paso; if(!loginPuedeAtras(p)) return; loginUI.err='';
    if(p==='clave') loginUI.paso=(['dir','prof'].includes(loginUI.rol)||(loginUI.rol==='rec'&&loginAreasPara('rec').length>1))?'area':'rol';
    else loginUI.paso='rol';
    render();
  },
  loginReset(){
    openModal(`${mHead('Cambiar la configuración de este equipo')}
      <div class="sub">Este equipo recuerda cómo entras. Para empezar de nuevo, escribe la contraseña de Gerencia.</div>
      <label class="f"><span>Contraseña de Gerencia</span><input id="lgr_pw" type="password" autocomplete="off"></label>
      <div class="btns"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="loginResetOk">Cambiar</button></div>`);
  },
  loginResetOk(){
    if(hashPass(($('#lgr_pw')||{}).value||'')!==state.cfg.pass.ger){ toast('Contraseña de Gerencia incorrecta'); return; }
    try{ localStorage.removeItem(EQ_KEY); localStorage.removeItem(LAST_KEY); }catch(e){}
    Object.assign(loginUI,{rol:'',area:'',prof:'',paso:'rol',err:'',fijo:false,cfg:null}); loginIniciado=true;
    closeModal(); render(); toast('Equipo restablecido: elige cómo vas a entrar');
  },
  eqReset(){                                             // desde Ajustes de Gerencia: ya hay sesión, no se pide la contraseña otra vez
    if(!session||session.rol!=='ger') return;
    if(!confirm('¿Restablecer el acceso de este equipo? Se cerrará la sesión y volverá a preguntar cómo se entra.')) return;
    try{ localStorage.removeItem(EQ_KEY); localStorage.removeItem(LAST_KEY); }catch(e){}
    Object.assign(loginUI,{rol:'',area:'',prof:'',paso:'rol',err:'',fijo:false,cfg:null});
    if(typeof rfLimpiar==='function') rfLimpiar(); session=null; ui.lista=null; loginIniciado=true; saveSession(); closeModal(); render(); top0(); toast('Equipo restablecido: elige cómo vas a entrar');
  },
  login(){ doLogin(); },
  logout(){ if(typeof rfLimpiar==='function') rfLimpiar(); session=null; ui.lista=null; loginIniciado=false; saveSession(); closeModal(); render(); top0(); }
});

document.addEventListener('change',e=>{
  if(e.target.id==='loginProf'){ loginUI.prof=e.target.value; loginUI.err=''; const el=$('#loginErr'); if(el) el.textContent=''; }
});
document.addEventListener('keydown',e=>{ if(e.key==='Enter'&&e.target.id==='pw') doLogin(); });
/* mantener presionado el logo (≈1.3 s): reconfigurar el equipo */
document.addEventListener('pointerdown',e=>{ if(!session&&e.target.closest&&e.target.closest('.lg-logo')){ clearTimeout(lgPress); lgPress=setTimeout(()=>{ if(!session) actions.loginReset(); },1300); } });
['pointerup','pointercancel','pointerleave'].forEach(ev=>document.addEventListener(ev,()=>clearTimeout(lgPress)));
document.addEventListener('contextmenu',e=>{ if(e.target.closest&&e.target.closest('.lg-logo')) e.preventDefault(); });      // el toque largo no abre el menú de imagen del navegador
