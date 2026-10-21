'use strict';
/* =====================================================================
   cuentas.js — cuentas de Firebase por persona y por rol.
   Para la gente nada cambia: cada quien entra con la misma contraseña o PIN de siempre. Por dentro, al
   entrar, la app inicia sesión en Firebase con la cuenta de esa persona, así Firebase (y sus reglas)
   saben quién es. Los correos de las cuentas son internos y nadie tiene que saberlos.

   Claves:   ger · met · dir-<área> (o dir-nutricion-fisioterapia) · prof-<área>-<id> · rec-<área>-<id>
   Correos:  ger@cuentas.gd-campestre.app (se crea a mano en la consola de Firebase, ver LEEME-parche20.txt)
             <clave>.<aleatorio>@cuentas.gd-campestre.app (todas las demás)
   Contraseña de la cuenta = la contraseña o el PIN de siempre (los de menos de 6 caracteres se completan por dentro).

   En la base, fuera de los datos (no entra en los respaldos):
     gerencia_cuentas/emails/<clave>    = {email, uid, rol, area}      qué correo usa cada clave
     gerencia_cuentas/usuarios/<uid>    = {rol, key, area | areas, id} cuentas aprobadas (las reglas se basan en esto)
     gerencia_cuentas/pendientes/<uid>  = {key, email, rol, area, t}   cuentas que se crearon solas y esperan a Gerencia

   Cómo se crean:
     · Profesores y recepción: Gerencia las crea todas con un botón en Ajustes (sus PIN ya están en la base),
       y la dirección o Gerencia la vuelven a crear al cambiar un PIN.
     · Metodología y direcciones: sus contraseñas están guardadas revueltas, así que la cuenta se crea sola la
       primera vez que entran y queda "por aprobar" en Ajustes de Gerencia. Si Gerencia les cambia la
       contraseña, la cuenta nueva se crea en ese momento, ya aprobada.
     · Si algo falla (sin internet, Firebase sin "Correo y contraseña" activado), la app sigue funcionando
       como antes y lo vuelve a intentar la siguiente vez que esa persona entre.
   ===================================================================== */
const CT_DOM = 'cuentas.gd-campestre.app', CT_GER = 'ger@'+CT_DOM, CT_ROOT = 'gerencia_cuentas';
const ct = { pend:null, estado:'', aviso:'', datos:null, cargando:false, creando:false, entrando:false };
const ctPass = pw => { const s=String(pw==null?'':pw); return s.length>=6 ? s : s+'-gdcc'; };     // Firebase pide al menos 6 caracteres
const ctAuth = () => (typeof firebase!=='undefined'&&firebase.auth&&firebase.apps.some(a=>a.name==='[DEFAULT]')) ? firebase.auth() : null;
const ctListo = () => !!(FIREBASE_CONFIG.databaseURL&&fbDb&&online&&ctAuth());
const ctYo = () => { const au=ctAuth(); return au&&au.currentUser; };
const ctEsGer = () => { const u=ctYo(); return !!u&&u.email===CT_GER; };
const ctRef = p => fbDb.ref(`${CT_ROOT}/${p}`);
const ctLeer = async p => (await ctRef(p).once('value')).val();
const ctAzar = () => Math.random().toString(36).slice(2,8);
const ctEmailNuevo = key => `${key}.${ctAzar()}@${CT_DOM}`;
const ctErrCred = e => ['auth/wrong-password','auth/user-not-found','auth/invalid-credential','auth/invalid-login-credentials','auth/invalid-email'].includes(e&&e.code);
function ctFalla(e){
  const c=e&&e.code;
  if(c==='auth/operation-not-allowed') ct.aviso='En la consola de Firebase falta activar el acceso con “Correo electrónico/contraseña”.';
  else if(c==='auth/too-many-requests') ct.aviso='Firebase pidió esperar unos minutos por demasiados intentos.';
  console.warn('[Cuentas]',c||'',e&&e.message);
}

/* ---------- clave de cada persona ---------- */
function ctClave(x){                                   // x = {rol, area, id, grupo}
  if(x.rol==='ger'||x.rol==='met') return x.rol;
  if(x.rol==='dir') return ('dir-'+(Array.isArray(x.grupo)&&x.grupo.length>1?x.grupo.join('-'):x.area)).toLowerCase();
  return `${x.rol}-${x.area}-${x.id}`.toLowerCase();
}
/* qué permite una clave (lo calcula Gerencia, nunca se toma de lo que manda el equipo) */
function ctPermisos(key){
  key=String(key);
  if(key==='met') return {rol:'met'};
  if(key.startsWith('dir-')){                          // los id de área pueden llevar guion (áreas creadas en Ajustes: "yoga-ab12")
    const G=typeof svDirGrupo==='function'?svDirGrupo():null, resto=key.slice(4);
    if(G&&key===('dir-'+G.join('-')).toLowerCase()) return {rol:'dir',areas:Object.fromEntries(G.map(a=>[a,true]))};
    const a=areasList().find(x=>x.id.toLowerCase()===resto);
    return a?{rol:'dir',areas:{[a.id]:true}}:null;
  }
  const rol=key.startsWith('prof-')?'prof':key.startsWith('rec-')?'rec':null; if(!rol) return null;
  const resto=key.slice(rol.length+1);
  for(const a of areasList().slice().sort((x,y)=>y.id.length-x.id.length)){   // el área cuyo id empieza la clave (la más larga primero)
    const pre=a.id.toLowerCase()+'-'; if(!resto.startsWith(pre)) continue;
    const L=rol==='prof'?coll(a.id,'profesores'):coll(a.id,'recepcion'), p=L.find(x=>String(x.id).toLowerCase()===resto.slice(pre.length));
    if(p) return {rol,area:a.id,id:p.id};
  }
  return null;
}
function ctNombre(key){
  const P=ctPermisos(key); if(key==='ger') return 'Gerencia'; if(!P) return key;
  if(P.rol==='met') return 'Metodología deportiva';
  if(P.rol==='dir'){ const as=Object.keys(P.areas); return 'Dirección · '+(as.length>1&&typeof SV_GRUPO_NOM!=='undefined'?SV_GRUPO_NOM:((getArea(as[0])||{}).nombre||as[0])); }
  const a=getArea(P.area)||{}, p=P.rol==='prof'?getProf(P.area,P.id):(typeof getRec==='function'?getRec(P.area,P.id):null);
  return `${(p&&p.nombre)||'(ya no está en la lista)'} · ${P.rol==='prof'?'profesor':'recepción'} · ${a.nombre||P.area}`;
}

/* ---------- al entrar ---------- */
/* Se llama después de validar la contraseña o el PIN en la pantalla de entrada. No detiene la entrada:
   si no hay internet se reintenta al volver la señal (la contraseña solo vive en memoria mientras tanto). */
function ctAlEntrar(x,pw){ ct.pend={key:ctClave(x),rol:x.rol,pw:String(pw)}; ctReintentar(); }
function ctReintentar(){ if(ct.pend&&ctListo()&&!ct.entrando){ const p=ct.pend; ctEntrar(p).then(ok=>{ if(ok&&ct.pend===p) ct.pend=null; }); } }
async function ctEntrar({key,rol,pw}){
  const au=ctAuth(); if(!au) return false;
  ct.entrando=true;
  try{
    const yo=au.currentUser;
    if(key==='ger'){
      if(yo&&yo.email===CT_GER) return ctListoEntrada('ok');
      try{ await au.signInWithEmailAndPassword(CT_GER,ctPass(pw)); return ctListoEntrada('ok'); }
      catch(e){ if(ctErrCred(e)){ ct.estado='sin-ger'; return true; } ctFalla(e); return false; }
    }
    const reg=await ctLeer(`emails/${key}`), email=reg&&reg.email;
    if(email){
      if(yo&&yo.email===email) return ctListoEntrada(await ctRevisar(key,rol));
      try{ await au.signInWithEmailAndPassword(email,ctPass(pw)); return ctListoEntrada(await ctRevisar(key,rol)); }
      catch(e){ if(!ctErrCred(e)){ ctFalla(e); return false; } }   // contraseña o PIN cambiado: se crea una cuenta nueva
    }
    if(yo&&yo.email&&yo.email.startsWith(key+'.')){                 // ya se había creado en este equipo y espera aprobación
      return ctListoEntrada(await ctRevisar(key,rol));
    }
    const nuevo=ctEmailNuevo(key), c=await au.createUserWithEmailAndPassword(nuevo,ctPass(pw));
    await ctRef(`pendientes/${c.user.uid}`).set({key,email:nuevo,rol,t:firebase.database.ServerValue.TIMESTAMP,disp:String(navigator.userAgent||'').slice(0,90)});
    return ctListoEntrada('pendiente');
  }catch(e){ ctFalla(e); return false; }
  finally{ ct.entrando=false; }
}
function ctListoEntrada(estado){ ct.estado=estado; safeRender(); return true; }
/* ¿la cuenta con la que se entró ya está aprobada? Si no, queda en la lista de Gerencia */
async function ctRevisar(key,rol){
  const u=ctYo(); if(!u) return '';
  if(await ctLeer(`usuarios/${u.uid}`)) return 'ok';
  if(!(await ctLeer(`pendientes/${u.uid}`))) await ctRef(`pendientes/${u.uid}`).set({key,email:u.email,rol,t:firebase.database.ServerValue.TIMESTAMP,disp:String(navigator.userAgent||'').slice(0,90)});
  return 'pendiente';
}
/* al salir: el equipo vuelve a una sesión anónima (lo justo para mostrar la pantalla de entrada) */
function ctAlSalir(){
  ct.pend=null; ct.estado='';
  const au=ctAuth(); if(!au||!online||!au.currentUser||au.currentUser.isAnonymous) return;
  au.signInAnonymously().catch(e=>console.warn('[Cuentas] sesión anónima',e&&e.message));
}
/* texto para la ventana de sincronización */
function ctEstadoTxt(){
  if(!FIREBASE_CONFIG.databaseURL) return '';
  const u=ctYo();
  if(ct.estado==='ok') return 'Cuenta activa: Firebase sabe quién está en este equipo.';
  if(ct.estado==='pendiente') return 'Cuenta creada: falta que Gerencia la apruebe en Ajustes.';
  if(ct.estado==='sin-ger') return 'Todavía no existe la cuenta de Gerencia en Firebase (ver LEEME-parche20.txt).';
  if(ct.pend) return 'La cuenta se activará cuando haya internet.';
  return u&&!u.isAnonymous?'Cuenta activa.':'Sin cuenta personal todavía.';
}

/* ---------- crear cuentas para otros (Gerencia, o la dirección para sus profesores) ---------- */
/* Usa una segunda conexión para no cerrar la sesión de quien la crea */
async function ctCrearPara(key,pw){
  const P=ctPermisos(key); if(!P) throw new Error('Clave desconocida: '+key);
  const app2=firebase.apps.find(a=>a.name==='alta')||firebase.initializeApp(FIREBASE_CONFIG,'alta'), au2=app2.auth();
  await au2.setPersistence(firebase.auth.Auth.Persistence.NONE);
  const email=ctEmailNuevo(key), c=await au2.createUserWithEmailAndPassword(email,ctPass(pw)), uid=c.user.uid;
  await au2.signOut();
  await ctRegistrar(key,email,uid);
}
/* deja la cuenta como la oficial de esa clave (y quita la anterior, si había) */
async function ctRegistrar(key,email,uid){
  const P=ctPermisos(key); if(!P) throw new Error('Clave desconocida: '+key);
  const prev=await ctLeer(`emails/${key}`), yo=ctYo(), upd={};
  upd[`usuarios/${uid}`]={...P,key,t:firebase.database.ServerValue.TIMESTAMP,por:yo?yo.uid:''};
  upd[`emails/${key}`]={email,uid,rol:P.rol,area:P.area||'',t:firebase.database.ServerValue.TIMESTAMP};
  if(prev&&prev.uid&&prev.uid!==uid) upd[`usuarios/${prev.uid}`]=null;
  await fbDb.ref(CT_ROOT).update(upd);
  if(ct.datos) ct.datos=null;
}
/* quita el acceso de una clave (profesor o recepción dado de baja) */
async function ctQuitar(key){
  if(!ctListo()) return;
  try{
    const prev=await ctLeer(`emails/${key}`); if(!prev) return;
    const upd={[`emails/${key}`]:null}; if(prev.uid) upd[`usuarios/${prev.uid}`]=null;
    await fbDb.ref(CT_ROOT).update(upd); ct.datos=null;
  }catch(e){ ctFalla(e); }
}
/* se guardó un profesor o una recepcionista: si cambió el PIN, se crea su cuenta nueva; si se desactivó, se quita */
function ctPersonaGuardada(rol,aid,id,pin,pinAntes,activo){
  if(!FIREBASE_CONFIG.databaseURL||!(session&&['ger','dir'].includes(session.rol))) return;
  const key=ctClave({rol,area:aid,id});
  if(!activo){ ctQuitar(key); return; }
  if(!ctListo()||String(pin)===String(pinAntes||'')) return;
  ctCrearPara(key,pin).catch(e=>ctFalla(e));               // si no se puede, se crea sola la próxima vez que esa persona entre
}
/* se cambió una contraseña en Ajustes */
async function ctPassCambiada(kind,aid,grupo,actual,nueva){
  if(!ctListo()) return;
  try{
    if(kind==='ger'||kind==='self'){                        // la propia: se cambia en la cuenta con la que se está dentro
      const u=ctYo(); if(!u||u.isAnonymous) return;
      const cred=firebase.auth.EmailAuthProvider.credential(u.email,ctPass(actual));
      await u.reauthenticateWithCredential(cred); await u.updatePassword(ctPass(nueva));
      return;
    }
    if(!ctEsGer()) return;                                  // Gerencia cambia la de Metodología o una dirección: cuenta nueva, ya aprobada
    const key=kind==='met'?'met':ctClave({rol:'dir',area:aid,grupo:grupo?svDirGrupo():null});
    await ctCrearPara(key,nueva);
  }catch(e){ ctFalla(e); toast('La contraseña cambió en la app, pero no en su cuenta de Firebase: se ajustará la próxima vez que esa persona entre'); }
}

/* ---------- Ajustes de Gerencia: estado de las cuentas ---------- */
function ctPersonas(){                                 // profesores y recepción que deben tener cuenta
  const L=[];
  areasList().forEach(a=>{
    if(esVinculada(a.id)) return;                       // los de Fitness entran en Fitness Control
    profesores(a.id).filter(p=>p.activo!==false&&p.pin&&!fcId(p.id)).forEach(p=>L.push({key:ctClave({rol:'prof',area:a.id,id:p.id}),pin:p.pin}));
    if(typeof recepcion==='function'&&esGim(a.id)) recepcion(a.id).filter(r=>r.activo!==false&&r.pin).forEach(r=>L.push({key:ctClave({rol:'rec',area:a.id,id:r.id}),pin:r.pin}));
  });
  return L;
}
function ctClavesJefes(){
  const G=typeof svDirGrupo==='function'?svDirGrupo():null;
  return ['met',...areasList().filter(a=>!(G&&G.includes(a.id))).map(a=>ctClave({rol:'dir',area:a.id})),...(G?[ctClave({rol:'dir',grupo:G})]:[])];
}
async function ctCargar(){
  if(ct.cargando||!ctListo()) return;
  ct.cargando=true;
  try{ const [emails,pend]=await Promise.all([ctLeer('emails'),ctLeer('pendientes')]); ct.datos={emails:emails||{},pend:pend||{}}; }
  catch(e){ ct.datos={error:(e&&e.message)||String(e)}; }
  ct.cargando=false; safeRender();
}
function ctCard(){
  if(!FIREBASE_CONFIG.databaseURL) return '';
  const fila=(t,s,btn)=>`<div class="row"><div><b>${t}</b><small>${s}</small></div>${btn||''}</div>`;
  const ger=ctEsGer();
  let h=fila('Cuenta de Gerencia',ger?'Activa en este equipo.':ct.estado==='sin-ger'?'No existe todavía en Firebase: créala en la consola (ver LEEME-parche20.txt) y vuelve a entrar.':'Este equipo no ha entrado con la cuenta de Gerencia. Sal y vuelve a entrar con internet.',pill(ger?'Activa':'Pendiente',ger?'ok':'warn'));
  if(ct.aviso) h+=`<div class="sub bad">${esc(ct.aviso)}</div>`;
  if(ct.fallas&&ct.fallas.length) h+=`<div class="sub bad">No se pudieron crear:<br>${ct.fallas.slice(0,10).map(esc).join('<br>')}</div>`;
  if(!ger) return `<div class="card">${h}</div>`;
  if(!ctListo()) return `<div class="card">${h}${fila('Cuentas del equipo de trabajo','Se revisan cuando haya internet.')}</div>`;
  if(!ct.datos){ ctCargar(); return `<div class="card">${h}${fila('Cuentas del equipo de trabajo','Revisando…')}</div>`; }
  if(ct.datos.error) return `<div class="card">${h}${fila('Cuentas del equipo de trabajo','No se pudieron leer: '+esc(ct.datos.error),`<button class="btn sm" data-act="ctRecargar">Reintentar</button>`)}</div>`;
  const E=ct.datos.emails, pend=Object.entries(ct.datos.pend).sort((a,b)=>(b[1].t||0)-(a[1].t||0));
  const pers=ctPersonas(), faltan=pers.filter(x=>!E[x.key]), jefes=ctClavesJefes(), jefesSin=jefes.filter(k=>!E[k]);
  if(pend.length) h+=`<div class="sub" style="margin-top:10px"><b>Por aprobar.</b> Cuentas que se crearon al entrar. Aprueba solo las que esperas (por ejemplo, justo después de que esa persona entró).</div>`+
    pend.map(([uid,p])=>fila(esc(ctNombre(p.key)),`${p.t?esc(new Date(p.t).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'})):''}${p.disp?' · '+esc(p.disp.replace(/^Mozilla\/5\.0 \(([^)]*)\).*/,'$1')):''}${E[p.key]?' · reemplaza la cuenta anterior':''}`,
      ctPermisos(p.key)?`<div class="btns"><button class="btn sm primary" data-act="ctAprobar" data-id="${esc(uid)}">Aprobar</button><button class="btn sm" data-act="ctDescartar" data-id="${esc(uid)}">Descartar</button></div>`:`<button class="btn sm" data-act="ctDescartar" data-id="${esc(uid)}">Descartar</button>`)).join('');
  h+=fila('Metodología y direcciones',jefesSin.length?`${jefes.length-jefesSin.length} de ${jefes.length} con cuenta. Las demás se crean solas cuando esa persona entre (luego apruébalas aquí), o al cambiarles la contraseña.`:`Las ${jefes.length} tienen cuenta.`,pill(`${jefes.length-jefesSin.length}/${jefes.length}`,jefesSin.length?'warn':'ok'));
  h+=fila('Profesores y recepción',faltan.length?`${pers.length-faltan.length} de ${pers.length} con cuenta. Se crean con el PIN que ya tienen.`:`Los ${pers.length} tienen cuenta.`,
    faltan.length?`<button class="btn sm primary" data-act="ctCrearFaltan"${ct.creando?' disabled':''}>${ct.creando?'Creando…':`Crear ${faltan.length}`}</button>`:pill('Listo','ok'));
  return `<div class="card">${h}</div>`;
}
Object.assign(actions,{
  ctRecargar(){ ct.datos=null; ct.aviso=''; render(); },
  async ctAprobar(d){
    if(!ctEsGer()) return;
    try{
      const p=await ctLeer(`pendientes/${d.id}`); if(!p||!ctPermisos(p.key)){ toast('Esa solicitud ya no existe'); ct.datos=null; render(); return; }
      await ctRegistrar(p.key,p.email,d.id);
      const todas=(await ctLeer('pendientes'))||{}, upd={};
      Object.entries(todas).forEach(([u,x])=>{ if(x&&x.key===p.key) upd[u]=null; });      // las demás solicitudes de la misma persona ya no sirven
      await ctRef('pendientes').update(upd);
      toast('Cuenta aprobada: '+ctNombre(p.key));
    }catch(e){ ctFalla(e); toast('No se pudo aprobar: '+((e&&e.message)||e)); }
    ct.datos=null; render();
  },
  async ctDescartar(d){
    if(!ctEsGer()) return;
    if(!confirm('¿Descartar esta solicitud? Si era de alguien del equipo, se volverá a crear la próxima vez que entre.')) return;
    try{ await ctRef(`pendientes/${d.id}`).remove(); }catch(e){ ctFalla(e); }
    ct.datos=null; render();
  },
  async ctCrearFaltan(){
    if(!ctEsGer()||ct.creando||!ct.datos||!ct.datos.emails) return;
    const faltan=ctPersonas().filter(x=>!ct.datos.emails[x.key]);
    ct.creando=true; ct.fallas=[]; render(); let n=0;
    for(const x of faltan){
      try{ await ctCrearPara(x.key,x.pin); n++; }
      catch(e){ ctFalla(e); ct.fallas.push(`${ctNombre(x.key)}: ${(e&&(e.code||e.message))||e}`); if(['auth/too-many-requests','auth/operation-not-allowed','auth/network-request-failed'].includes(e&&e.code)) break; }
    }
    ct.creando=false; ct.datos=null;
    toast(n===faltan.length?`${plu(n,'cuenta creada','cuentas creadas')}`:`${n} de ${faltan.length} cuentas creadas${ct.aviso?': '+ct.aviso:''}`);
    render();
  }
});
