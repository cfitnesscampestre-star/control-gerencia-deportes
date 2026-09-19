'use strict';
/* =====================================================================
   auth.js — pantalla de acceso y sesión.
   Área (filtro) → Gerencia, Dirección o Profesor → contraseña o PIN.
   Al elegir Profesor aparece la lista de profesores dados de alta en esa área.
   ===================================================================== */
const loginUI = { rol:'ger', area:'all', prof:'', err:'' };
(function recordarUltimoAcceso(){
  try{
    const l=JSON.parse(localStorage.getItem(LAST_KEY));
    if(l){ loginUI.rol = ['ger','dir','prof'].includes(l.rol) ? l.rol : 'ger'; loginUI.area = l.area || 'all'; loginUI.prof = l.prof || ''; }
  }catch(e){}
})();

function loginProfHTML(){
  const a=loginUI.area==='all'?null:getArea(loginUI.area);
  const q='<p class="lg-q">Selecciona tu nombre:</p>';
  if(!a) return `${q}<div class="lg-note">Elige primero tu área en el filtro de arriba.</div>`;
  if(esVinculada(a.id)) return `${q}<div class="lg-note">Los profesores de ${esc(a.nombre)} pasan lista en Fitness Control.</div>`;
  const ps=profesores(a.id).filter(p=>p.activo!==false&&!p.sim&&p.pin);        // los profesores de simulación no tienen acceso
  if(!ps.length) return `${q}<div class="lg-note">${esc(a.nombre)} todavía no tiene profesores. La dirección del área debe darlos de alta.</div>`;
  if(!ps.some(p=>p.id===loginUI.prof)) loginUI.prof=ps.length===1?ps[0].id:'';
  return `${q}<div class="lg-select"><select id="loginProf" aria-label="Profesor"><option value="">Elige tu nombre…</option>${ps.map(p=>`<option value="${esc(p.id)}"${loginUI.prof===p.id?' selected':''}>${esc(p.nombre)}</option>`).join('')}</select>${ic('chev')}</div>`;
}
function refreshLogin(){                             // actualiza en su lugar, sin perder lo escrito
  const box=$('#loginProfBox'); if(!box) return;
  box.hidden = loginUI.rol!=='prof';
  if(loginUI.rol==='prof') box.innerHTML=loginProfHTML();
  const lbl=$('#pwLbl'), pw=$('#pw');
  if(lbl) lbl.textContent = loginUI.rol==='prof' ? 'PIN' : 'Contraseña';
  if(pw){ pw.placeholder = loginUI.rol==='prof' ? 'Ingresa tu PIN…' : 'Ingresa tu contraseña…'; pw.setAttribute('inputmode', loginUI.rol==='prof'?'numeric':'text'); }
}

function viewLogin(){
  const as=areasList();
  if(loginUI.area!=='all'&&!getArea(loginUI.area)) loginUI.area='all';
  const prof=loginUI.rol==='prof';
  return `
  <div class="login">
    <div class="login-card">
      <div class="lg-brand">
        <div class="lg-logo"><span class="lg-fb">${ic('shield')}</span><img src="img/logo.png" alt="Campestre" data-fallback></div>
        <div class="lg-title"><p>Club Campestre Aguascalientes</p><h1>Gerencia de Deportes</h1></div>
      </div>

      <p class="lg-q">Selecciona el área:</p>
      <div class="lg-select">
        <select id="loginArea" aria-label="Área">
          <option value="all"${loginUI.area==='all'?' selected':''}>Todas las áreas (resumen)</option>
          ${as.map(a=>`<option value="${esc(a.id)}"${loginUI.area===a.id?' selected':''}>${esc(a.nombre)}</option>`).join('')}
        </select>${ic('chev')}
      </div>

      <p class="lg-q">Selecciona tu acceso:</p>
      <div class="lg-roles">
        <button class="lg-role${loginUI.rol==='ger'?' on':''}" data-act="pickRol" data-rol="ger">${ic('shield')}<b>Gerencia</b><small>Todas las áreas</small></button>
        <button class="lg-role${loginUI.rol==='dir'?' on':''}" data-act="pickRol" data-rol="dir">${ic('user')}<b>Dirección</b><small>Mi área</small></button>
        <button class="lg-role${prof?' on':''}" data-act="pickRol" data-rol="prof">${ic('clip')}<b>Profesor</b><small>Pasar lista</small></button>
      </div>

      <div id="loginProfBox"${prof?'':' hidden'}>${prof?loginProfHTML():''}</div>

      <label class="lg-lbl" id="pwLbl" for="pw">${prof?'PIN':'Contraseña'}</label>
      <input id="pw" type="password" placeholder="${prof?'Ingresa tu PIN…':'Ingresa tu contraseña…'}" autocomplete="current-password"${prof?' inputmode="numeric"':''}>
      <div class="err" id="loginErr">${esc(loginUI.err)}</div>
      <button class="btn cta block" data-act="login">Entrar <span aria-hidden="true">→</span></button>
      <div class="lg-help">
        <p>Gerencia: resumen y consulta de todas las áreas</p>
        <p>Dirección: profesores, grupos, aforos y reportes de tu área</p>
        <p>Profesor: pasar lista de tus clases</p>
        ${simActiva()?'<p class="lg-sim">Modo simulación: se ven datos de ejemplo en todas las áreas</p>':''}
      </div>
    </div>
  </div>`;
}

function doLogin(){
  const sel=$('#loginArea'); if(sel) loginUI.area=sel.value;
  const ps=$('#loginProf'); if(ps) loginUI.prof=ps.value;
  const pw=($('#pw')||{}).value||'';
  const fail=m=>{ loginUI.err=m; $('#loginErr').textContent=m; };
  if(loginUI.rol==='ger'){
    if(hashPass(pw)!==state.cfg.pass.ger) return fail('Contraseña de gerencia incorrecta.');
    session={rol:'ger',area:null};
    if(loginUI.area!=='all'&&getArea(loginUI.area)){ ui.gTab='areas'; ui.gArea=loginUI.area; ui.aTab='inicio'; }
    else { ui.gTab='resumen'; ui.gArea=null; }
  } else if(loginUI.rol==='dir'){
    if(loginUI.area==='all'||!getArea(loginUI.area)) return fail('Elige arriba el área a la que entras como dirección.');
    if(hashPass(pw)!==state.cfg.pass.dir[loginUI.area]) return fail('Contraseña de dirección incorrecta.');
    session={rol:'dir',area:loginUI.area}; ui.aTab='inicio';
  } else {
    if(loginUI.area==='all'||!getArea(loginUI.area)) return fail('Elige arriba tu área.');
    const p=getProf(loginUI.area,loginUI.prof);
    if(!p||p.activo===false) return fail('Elige tu nombre en la lista.');
    if(String(pw).trim()!==String(p.pin)) return fail('PIN incorrecto.');
    session={rol:'prof',area:loginUI.area,profId:p.id}; ui.pTab='hoy'; ui.pFecha=todayStr();
  }
  try{ localStorage.setItem(LAST_KEY,JSON.stringify({rol:loginUI.rol,area:loginUI.area,prof:loginUI.prof})); }catch(e){}
  loginUI.err=''; ui.repTab='semanal'; ui.afFecha=todayStr(); ui.gaFecha=todayStr(); ui.afTodos=false; ui.lista=null;
  saveSession(); render(); top0();
}

Object.assign(actions,{
  pickRol(d){
    loginUI.rol=d.rol; loginUI.err=''; $('#loginErr').textContent='';
    document.querySelectorAll('.lg-role').forEach(b=>b.classList.toggle('on',b.dataset.rol===d.rol));
    refreshLogin();
  },
  login(){ doLogin(); },
  logout(){ session=null; ui.lista=null; saveSession(); closeModal(); render(); top0(); }
});

document.addEventListener('change',e=>{
  if(e.target.id==='loginArea'){ loginUI.area=e.target.value; loginUI.prof=''; loginUI.err=''; const el=$('#loginErr'); if(el) el.textContent=''; refreshLogin(); }
  if(e.target.id==='loginProf'){ loginUI.prof=e.target.value; loginUI.err=''; const el=$('#loginErr'); if(el) el.textContent=''; }
});
document.addEventListener('keydown',e=>{ if(e.key==='Enter'&&e.target.id==='pw') doLogin(); });
