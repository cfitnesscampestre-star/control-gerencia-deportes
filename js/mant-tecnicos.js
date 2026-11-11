'use strict';
/* =====================================================================
   mant-tecnicos.js — Gerencia da de alta a los técnicos de Control Mantenimiento.
   Gerencia asigna a cada técnico su usuario y su PIN y se los entrega; el técnico entra con ellos a
   Control Mantenimiento (proyecto registro-mantenimiento-9854c, el mismo que lee mantenimiento.js).

   Cómo funciona (igual que las cuentas de profesores en cuentas.js):
     · Gerencia entra a la base de Mantenimiento con la cuenta gerencia@mantenimiento.club, que tiene la MISMA
       contraseña que Gerencia en esta app. Se crea una sola vez a mano en la consola (ver LEEME-parche24.txt);
       después la app entra sola cada vez que Gerencia entra, y si Gerencia cambia su contraseña, se cambia también ahí.
     · Alta o PIN nuevo: se crea una cuenta nueva en Firebase (con una segunda conexión, para no cerrar la sesión de
       Gerencia) con el correo interno <usuario>.<aleatorio>@mantenimiento.club y el PIN como contraseña. La cuenta
       anterior deja de servir. El PIN no se guarda en ningún lado: se muestra una vez para entregárselo al técnico.
     · En la base de Mantenimiento (solo Gerencia puede escribir ahí, ver reglas-firebase.txt de Control Mantenimiento):
         /cuentas/<usuario>  = { email, uid, nombre, activo, t }   el usuario que escribe el técnico → su cuenta
         /tecnicos/<uid>     = true                                 cuentas que pueden trabajar en Mantenimiento
   ===================================================================== */
const MT_ADM = 'gerencia@mantenimiento.club', MT_DOM = 'mantenimiento.club';
const mtAdm = { pend:null, estado:'', msg:'', entrando:false, datos:null, cargando:false, ocupado:false, escucha:false };
const mtUsuarioOk = u => /^[a-z0-9][a-z0-9_-]{1,29}$/.test(u);
const mtPinAzar = () => String(Math.floor(100000 + Math.random() * 900000));

function mtApp(){
  if(typeof mantConfig!=='function'||!mantConfig()||typeof firebase==='undefined'||!firebase.auth) return null;
  const app=firebase.apps.find(a=>a.name==='mant')||firebase.initializeApp(FIREBASE_CONFIG_MANT,'mant');
  if(!mtAdm.escucha){ mtAdm.escucha=true; app.auth().onAuthStateChanged(()=>{ mtAdm.datos=null; safeRender(); }); }
  return app;
}
const mtYo = () => { const a=mtApp(); return a&&a.auth().currentUser; };
const mtEsAdm = () => { const u=mtYo(); return !!u&&u.email===MT_ADM; };
const mtRef = p => p ? mtApp().database().ref(p) : mtApp().database().ref();

/* ---------- sesión de Gerencia en la base de Mantenimiento ---------- */
/* Al entrar Gerencia (cuentas.js → ctAlEntrar): se intenta entrar también a Mantenimiento con la misma contraseña.
   La contraseña solo vive en memoria hasta que se logra (sin internet se reintenta al volver la señal). */
function mtAdmEntrar(pw){ mtAdm.pend=String(pw); mtReintentar(); }
function mtReintentar(){
  if(!mtAdm.pend||mtAdm.entrando||!online) return;
  const app=mtApp(); if(!app) return;
  if(mtEsAdm()){ mtAdm.pend=null; mtAdm.estado='ok'; return; }
  mtConectar(mtAdm.pend).then(ok=>{ if(ok) mtAdm.pend=null; });
}
async function mtConectar(pw){
  const app=mtApp(); if(!app) return false;
  mtAdm.entrando=true;
  try{
    await app.auth().signInWithEmailAndPassword(MT_ADM,ctPass(pw));
    mtAdm.estado='ok'; mtAdm.msg=''; return true;
  }catch(e){
    if(ctErrCred(e)){ mtAdm.estado='sin-cuenta'; return true; }     // no existe o tiene otra contraseña: no tiene caso reintentar
    mtAdm.estado='error'; mtAdm.msg=(e&&(e.code||e.message))||String(e); return false;
  }finally{ mtAdm.entrando=false; mtAdm.datos=null; safeRender(); }
}
function mtAdmSalir(){
  mtAdm.pend=null; mtAdm.estado=''; mtAdm.datos=null;
  if(mtEsAdm()) mtApp().auth().signOut().catch(()=>{});
}
/* Gerencia cambió su contraseña en Ajustes: también en su cuenta de Mantenimiento */
async function mtAdmPassCambiada(actual,nueva){
  const app=mtApp(); if(!app) return;
  try{
    if(!mtEsAdm()) await app.auth().signInWithEmailAndPassword(MT_ADM,ctPass(actual));
    const u=app.auth().currentUser;
    await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(MT_ADM,ctPass(actual)));
    await u.updatePassword(ctPass(nueva));
  }catch(e){
    if(ctErrCred(e)) return;                                     // todavía no existe la cuenta de Mantenimiento: nada que cambiar
    console.warn('[Técnicos]',e&&(e.code||e.message));
    toast('La contraseña de Gerencia cambió, pero no en Control Mantenimiento. Cámbiala también en su consola de Firebase (gerencia@mantenimiento.club).');
  }
}

/* ---------- datos ---------- */
async function mtCargar(){
  if(mtAdm.cargando||!mtEsAdm()) return;
  mtAdm.cargando=true;
  try{ mtAdm.datos={cuentas:(await mtRef('cuentas').once('value')).val()||{}}; }
  catch(e){ mtAdm.datos={error:(e&&e.message)||String(e)}; }
  mtAdm.cargando=false; safeRender();
}
/* crea la cuenta en Firebase con una segunda conexión (la sesión de Gerencia no se toca) */
async function mtCrearCuenta(usuario,pin){
  const app2=firebase.apps.find(a=>a.name==='mantalta')||firebase.initializeApp(FIREBASE_CONFIG_MANT,'mantalta'), au2=app2.auth();
  await au2.setPersistence(firebase.auth.Auth.Persistence.NONE);
  const email=`${usuario}.${ctAzar()}@${MT_DOM}`, c=await au2.createUserWithEmailAndPassword(email,pin), uid=c.user.uid;
  await au2.signOut();
  return {email,uid};
}
/* alta, PIN nuevo o reactivar: queda la cuenta nueva como la del usuario y la anterior deja de servir */
async function mtAsignar(usuario,nombre,pin){
  const prev=(await mtRef('cuentas/'+usuario).once('value')).val();
  const {email,uid}=await mtCrearCuenta(usuario,pin), upd={};
  upd['tecnicos/'+uid]=true;
  if(prev&&prev.uid&&prev.uid!==uid) upd['tecnicos/'+prev.uid]=null;
  upd['cuentas/'+usuario]={email,uid,nombre,activo:true,t:firebase.database.ServerValue.TIMESTAMP};
  await mtRef('').update(upd);
}
function mtErrTxt(e){
  const c=e&&e.code;
  if(c==='auth/weak-password') return 'El PIN debe tener al menos 6 caracteres.';
  if(c==='auth/operation-not-allowed'||c==='auth/admin-restricted-operation') return 'En la consola de Firebase de Mantenimiento está desactivada la creación de cuentas (Authentication → Configuración → Acciones de usuario → "Habilitar creación").';
  if(c==='auth/too-many-requests') return 'Firebase pidió esperar unos minutos por demasiados intentos.';
  if(c==='auth/network-request-failed') return 'Sin internet.';
  if(/permission/i.test((e&&e.message)||'')) return 'La base de Mantenimiento no dejó guardar: revisa que las reglas nuevas estén publicadas (reglas-firebase.txt de Control Mantenimiento).';
  return (e&&(e.message||c))||String(e);
}

/* ---------- Ajustes de Gerencia ---------- */
function mtCard(){
  if(typeof mantConfig!=='function'||!mantConfig()||!(session&&session.rol==='ger')) return '';
  const app=mtApp();
  if(!app) return `<div class="card">${ajFila('Conexión con Mantenimiento','Se conecta cuando haya internet.')}</div>`;
  if(mtAdm.pend) mtReintentar();
  if(!mtEsAdm()){
    const txt=mtAdm.entrando?'Conectando…'
      :mtAdm.estado==='sin-cuenta'?`Falta la cuenta de Gerencia en Control Mantenimiento, o tiene otra contraseña. Créala en su consola de Firebase con el correo <b>${MT_ADM}</b> y tu misma contraseña de Gerencia (ver LEEME-parche24.txt).`
      :mtAdm.estado==='error'?'No se pudo conectar: '+esc(mtAdm.msg)
      :'Escribe tu contraseña de Gerencia para administrar los usuarios de los técnicos.';
    return `<div class="card">${ajFila('Conexión con Mantenimiento',txt,pill('Sin conectar','warn'))}
      <div class="row"><label class="f" style="flex:1;margin:0"><span>Contraseña de Gerencia</span><input id="mt_pw" type="password" autocomplete="current-password"></label>
      <button class="btn sm primary" data-act="mtConectar"${mtAdm.entrando?' disabled':''}>Conectar</button></div></div>`;
  }
  if(!mtAdm.datos){ mtCargar(); return `<div class="card">${ajFila('Técnicos','Revisando…')}</div>`; }
  if(mtAdm.datos.error) return `<div class="card">${ajFila('Técnicos','No se pudieron leer: '+esc(mtAdm.datos.error),'<button class="btn sm" data-act="mtRecargar">Reintentar</button>')}</div>`;
  const L=Object.entries(mtAdm.datos.cuentas).map(([u,x])=>Object.assign({usuario:u},x)).sort((a,b)=>(b.activo!==false)-(a.activo!==false)||String(a.nombre).localeCompare(String(b.nombre),'es'));
  return `<div class="card">
    ${ajFila('Usuarios de los técnicos','Cada técnico entra a Control Mantenimiento con el usuario y el PIN que le asignes aquí.',`<button class="btn sm primary" data-act="mtNuevo"${mtAdm.ocupado?' disabled':''}>+ Técnico</button>`)}
    ${L.length?L.map(x=>ajFila(`${esc(x.nombre||x.usuario)}`,`Usuario: <b>${esc(x.usuario)}</b>${x.t?' · desde el '+esc(new Date(x.t).toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'})):''}`,
      x.activo===false
        ?`<span class="btns">${pill('Desactivado','')}<button class="btn sm" data-act="mtPin" data-u="${esc(x.usuario)}"${mtAdm.ocupado?' disabled':''}>Reactivar</button></span>`
        :`<span class="btns"><button class="btn sm" data-act="mtPin" data-u="${esc(x.usuario)}"${mtAdm.ocupado?' disabled':''}>PIN nuevo</button><button class="btn sm danger" data-act="mtBaja" data-u="${esc(x.usuario)}"${mtAdm.ocupado?' disabled':''}>Desactivar</button></span>`)).join('')
      :ajFila('','Todavía no has dado de alta ningún técnico.')}
  </div>`;
}
function mtForm(o){                                  // o = {usuario, nombre, nuevo}
  openModal(`${mHead(o.nuevo?'Nuevo técnico':o.reactivar?'Reactivar técnico':'PIN nuevo')}
    <div class="sub">${o.nuevo?'El técnico entra a Control Mantenimiento con este usuario y este PIN. Anótalos para entregárselos.':`El PIN anterior de <b>${esc(o.usuario)}</b> deja de servir en cuanto guardes.`}</div>
    <label class="f"><span>Usuario (sin espacios ni acentos)</span><input id="mt_u" autocapitalize="none" autocorrect="off" spellcheck="false" value="${esc(o.usuario||'')}"${o.nuevo?'':' readonly'} placeholder="Ej. tecnico"></label>
    <label class="f"><span>Nombre del técnico</span><input id="mt_n" value="${esc(o.nombre||'')}" placeholder="Ej. Juan Pérez" autocomplete="off"></label>
    <label class="f"><span>PIN (mínimo 6 caracteres)</span><input id="mt_p" inputmode="numeric" autocomplete="off" value="${mtPinAzar()}"></label>
    <div class="btns"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="mtGuardar" data-nuevo="${o.nuevo?'1':''}">Guardar</button></div>`);
}
function mtEntrega(usuario,nombre,pin){
  openModal(`${mHead('Datos para el técnico')}
    <div class="sub">Entrégale estos datos a <b>${esc(nombre)}</b>. Por seguridad el PIN no se guarda: si se le olvida, asígnale uno nuevo.</div>
    <div class="card">${ajFila('Usuario',`<b style="font-size:20px">${esc(usuario)}</b>`)}${ajFila('PIN',`<b style="font-size:20px;letter-spacing:.08em">${esc(pin)}</b>`)}</div>
    <div class="sub">Entra en Control Mantenimiento: <b>cfitnesscampestre-star.github.io/control-mantenimiento</b></div>
    <div class="btns"><button class="btn" data-act="mtCopiar" data-t="${esc(`Control Mantenimiento\nUsuario: ${usuario}\nPIN: ${pin}`)}">Copiar</button><button class="btn primary" data-act="closeModal">Listo</button></div>`);
}
Object.assign(actions,{
  async mtConectar(){
    const pw=($('#mt_pw')||{}).value||''; if(!pw){ toast('Escribe tu contraseña de Gerencia'); return; }
    mtAdm.estado=''; render();
    await mtConectar(pw);
    if(mtAdm.estado==='sin-cuenta') toast('No se pudo entrar a Control Mantenimiento con esa contraseña');
  },
  mtRecargar(){ mtAdm.datos=null; render(); },
  mtNuevo(){ if(mtEsAdm()) mtForm({nuevo:true}); },
  mtPin(d){
    const x=mtAdm.datos&&mtAdm.datos.cuentas&&mtAdm.datos.cuentas[d.u]; if(!x||!mtEsAdm()) return;
    mtForm({usuario:d.u,nombre:x.nombre,reactivar:x.activo===false});
  },
  async mtGuardar(d){
    if(!mtEsAdm()||mtAdm.ocupado) return;
    const u=(($('#mt_u')||{}).value||'').trim().toLowerCase(), n=(($('#mt_n')||{}).value||'').trim(), p=(($('#mt_p')||{}).value||'').trim();
    if(!mtUsuarioOk(u)){ toast('Usuario: de 2 a 30 letras minúsculas o números, sin espacios ni acentos (se permiten - y _)'); return; }
    if(!n){ toast('Escribe el nombre del técnico'); return; }
    if(p.length<6){ toast('El PIN debe tener al menos 6 caracteres'); return; }
    mtAdm.ocupado=true; const b=document.querySelector('[data-act="mtGuardar"]'); if(b){ b.disabled=true; b.textContent='Guardando…'; }
    try{
      if(d.nuevo){
        const ya=(await mtRef('cuentas/'+u).once('value')).val();
        if(ya&&ya.activo!==false){ toast(`Ya existe el usuario “${u}” (${ya.nombre||''}). Usa “PIN nuevo” en su renglón.`); if(b){ b.disabled=false; b.textContent='Guardar'; } return; }
      }
      await mtAsignar(u,n,p);
      mtAdm.datos=null; mtEntrega(u,n,p);
    }catch(e){ console.warn('[Técnicos]',e); toast('No se pudo guardar: '+mtErrTxt(e)); if(b){ b.disabled=false; b.textContent='Guardar'; } }
    finally{ mtAdm.ocupado=false; }
  },
  async mtBaja(d){
    const x=mtAdm.datos&&mtAdm.datos.cuentas&&mtAdm.datos.cuentas[d.u]; if(!x||!mtEsAdm()) return;
    if(!confirmar(`¿Desactivar a ${x.nombre||d.u}? Ya no podrá entrar a Control Mantenimiento. Para que vuelva, usa “Reactivar” y asígnale un PIN.`)) return;
    const upd={}; upd['cuentas/'+d.u+'/activo']=false; if(x.uid) upd['tecnicos/'+x.uid]=null;
    try{ await mtRef('').update(upd); toast('Técnico desactivado'); }catch(e){ toast('No se pudo desactivar: '+mtErrTxt(e)); }
    mtAdm.datos=null; render();
  },
  mtCopiar(d){
    const t=d.t||'';
    (navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(t):Promise.reject()).then(()=>toast('Copiado'),()=>toast('No se pudo copiar: anótalos a mano'));
  }
});
