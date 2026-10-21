'use strict';
/* =====================================================================
   ajustes.js — Ajustes de gerencia: pendientes, áreas (con su ficha), accesos, respaldo y conexiones
   ===================================================================== */
/* La pestaña está ordenada por lo que se hace con más frecuencia:
     Pendientes (solo si hay algo) → Áreas (cada una abre su ficha) → Accesos → Respaldo y datos → Conexiones y este equipo (plegado).
   Todo lo de un área (nombre, contraseña de dirección, su cuenta, Mantenimiento, proporción de Fitness) vive en su ficha: ajFicha(). */
const ajFila = (t,s,der) => `<div class="row"><div><b>${t}</b>${s?`<small>${s}</small>`:''}</div>${der||''}</div>`;
const ajSw = (on,attrs,lbl) => `<button class="aj-sw${on?' on':''}" role="switch" aria-checked="${on}" aria-label="${esc(lbl)}" ${attrs}><i></i></button>`;
const ajGrupoDe = a => a._grupo ? svDirGrupo().map(getArea).filter(Boolean) : [a];
const ajClaveDir = a => typeof ctClave==='function' ? ctClave(a._grupo?{rol:'dir',grupo:svDirGrupo()}:{rol:'dir',area:a.id}) : '';
const ajDefault = () => {                               // contraseñas que siguen siendo las de fábrica
  const P=(state.cfg&&state.cfg.pass)||{}, L=[];
  if(P.ger===hashPass(DEF_PASS_GER)) L.push('Gerencia');
  if(P.met===hashPass(DEF_PASS_MET)) L.push('Metodología');
  areasVista().forEach(a=>{ if(ajGrupoDe(a).some(x=>(P.dir||{})[x.id]===hashPass(DEF_PASS_DIR))) L.push(a.nombre); });
  return L;
};
function ajPendientes(){
  const L=[], C=typeof ctResumen==='function'?ctResumen():null, n=respaldoDias(), def=ajDefault();
  if(C&&C.pend.length) L.push(ajFila(`${plu(C.pend.length,'cuenta por aprobar','cuentas por aprobar')}`,`${esc(C.pend.slice(0,3).join(', '))}${C.pend.length>3?'…':''}. Apruébalas solo si las esperabas.`,`<button class="btn sm primary" data-act="ajIr" data-id="aj-cuentas">Revisar</button>`));
  if(n==null||n>=7) L.push(ajFila('Respaldo pendiente',n==null?'Todavía no se ha descargado ningún respaldo.':`El último se descargó hace ${plu(n,'día','días')}.`,`<button class="btn sm primary" data-act="export">Descargar</button>`));
  if(def.length) L.push(ajFila(`${plu(def.length,'contraseña de fábrica','contraseñas de fábrica')}`,`${esc(def.slice(0,4).join(', '))}${def.length>4?'…':''}. Son públicas: cámbialas (las de cada dirección, en su área).`));
  if(FIREBASE_CONFIG.databaseURL&&LINKMETA.estado==='error') L.push(ajFila('Fitness Control no conecta',esc(LINKMETA.msg||''),`<button class="btn sm" data-act="ajIr" data-id="aj-conex">Ver</button>`));
  if(typeof mantMeta!=='undefined'&&mantMeta.estado==='error') L.push(ajFila('Control Mantenimiento no conecta',esc(mantMeta.msg||''),`<button class="btn sm" data-act="ajIr" data-id="aj-conex">Ver</button>`));
  return L.length?`<div class="h2">Pendientes <small class="aj-cnt">${plu(L.length,'cosa por hacer','cosas por hacer')}</small></div><div class="card aj-pend">${L.join('')}</div>`:'';
}
function ajAreaChips(a){
  const G=ajGrupoDe(a), C=typeof ctResumen==='function'?ctResumen():null;
  const np=G.reduce((s,x)=>s+profesores(x.id).filter(p=>p.activo!==false).length,0);
  const mant=G.some(x=>typeof mantAplica==='function'&&mantAplica(x.id));
  const k=ajClaveDir(a), cta=C&&C.listo?(C.tiene(k)?pill('Dirección con cuenta','ok'):C.pendiente(k)?pill('Dirección por aprobar','warn'):pill('Dirección sin cuenta','warn')):'';
  return `<span class="aj-chips">${pill(plu(np,'profesor','profesores'),'')}${pill(mant?'Mantenimiento':'Sin mantenimiento',mant?'info':'')}${cta}</span>`;
}
function gAjustes(){
  const nPend=pendientes(), eq=(typeof equipoCfg==='function')?equipoCfg():null;
  const nube=!FIREBASE_CONFIG.databaseURL?['Solo en este equipo: Firebase no está configurado.','Sin nube','mut']
    : online?[nPend?`Subiendo ${plu(nPend,'cambio','cambios')}…`:'Guardado en la nube ✔ · nada pendiente por subir',nPend?'Subiendo':'Al día',nPend?'warn':'ok']
    : [`Sin internet: se guarda en este equipo${nPend?` (${plu(nPend,'cambio','cambios')} por subir)`:''} y se sube al volver la señal.`,'Sin internet','warn'];
  const fc=!FIREBASE_CONFIG.databaseURL?'Sin Firebase':!fcAreaVinculada()?'Sin área vinculada':LINKMETA.estado==='ok'?'Conectado ✔':LINKMETA.estado==='error'?'Error':'Conectando…';
  const mn=typeof mantMeta==='undefined'?'':!mantConfig()?'Sin configurar':mantMeta.estado==='ok'?'Conectado ✔':mantMeta.estado==='error'?'Error':mantMeta.estado==='cache'?'Copia guardada':'Conectando…';
  const det=(id,t,s,body)=>`<details class="aj-det" data-aj="${id}"${ui.ajAbierto&&ui.ajAbierto[id]?' open':''}><summary class="card"><b>${t}</b><small>${s}</small></summary>${body}</details>`;
  return `<div class="aj">
    ${gSimulacionCard()}
    ${ajPendientes()}
    <div class="h2">Áreas <button class="btn sm primary aj-mas" data-act="areaNew">+ Área</button></div>
    <div class="card aj-areas">
      ${areasVista().map(a=>`<button class="aj-a" data-act="ajArea" data-id="${esc(a.id)}"${a._grupo?' data-grupo="1"':''}>
        <span class="aj-dot" style="background:${esc(a.color)}"></span>
        <span class="aj-t"><b>${areaIco(a,{size:18})} ${esc(a.nombre)}</b>${ajAreaChips(a)}</span>
        <span class="aj-go" aria-hidden="true">${ic('next')}</span></button>`).join('')||'<div class="sub">Sin áreas.</div>'}
    </div>
    <div class="h2">Accesos</div>
    <div class="card">
      ${ajFila('Contraseña de Gerencia','Acceso a todas las áreas','<button class="btn sm" data-act="pwGer">Cambiar</button>')}
      ${ajFila('Contraseña de Metodología','Aforos, eventos y pruebas de todas las áreas','<button class="btn sm" data-act="pwMet">Cambiar</button>')}
      ${ajFila('','La contraseña de cada dirección está en la ficha de su área.')}
    </div>
    ${typeof ctCard==='function'&&FIREBASE_CONFIG.databaseURL?`<div id="aj-cuentas" class="aj-sub">Cuentas de acceso</div>${ctCard()}`:''}
    <div class="h2">Respaldo y datos</div>
    <div class="card">
      ${ajFila('Nube',esc(nube[0]),pill(nube[1],nube[2]))}
      ${ajFila('Respaldo',esc(respaldoTxt()),'<button class="btn sm primary" data-act="export">Descargar</button>')}
      ${ajFila('Restaurar un respaldo','Reemplaza todos los datos con los de un archivo descargado antes. Primero se descarga una copia de lo actual.','<button class="btn sm" data-act="importPick">Importar</button><input type="file" id="imp_file" accept=".json,application/json" hidden>')}
      ${ajFila('Papelera',Object.keys(state.papelera||{}).length?plu(Object.keys(state.papelera).length,'grupo borrado','grupos borrados')+' · se conservan 30 días':'Aquí se guardan 30 días los grupos que se eliminen','<button class="btn sm" data-act="openPapelera">Abrir</button>')}
    </div>
    <div class="h2" id="aj-conex">Conexiones y este equipo</div>
    ${det('fc','Fitness Control',fc,gVinculoCard())}
    ${typeof mantCard==='function'?det('mant','Control Mantenimiento',mn,mantCard()):''}
    ${det('eq','Este equipo',`${esc(eq?(ROL_NOMBRE[eq.rol]||eq.rol):'Sin acceso recordado')} · tema ${temaActual()==='magenta'?'Magenta':'Campestre'}`,`<div class="card">
      ${ajFila('Acceso recordado',`${esc((()=>{ if(!eq) return 'Todavía no se ha guardado'; const a=getArea(eq.area); return (ROL_NOMBRE[eq.rol]||eq.rol)+(a?' · '+a.nombre:''); })())}. Al restablecer, este equipo vuelve a preguntar cómo se entra.`,'<button class="btn sm" data-act="eqReset">Restablecer</button>')}
      ${ajFila('Colores del sistema','Solo en este dispositivo',`<div class="seg"><button class="${temaActual()==='campestre'?'on':''}" data-act="tema" data-t="campestre">Campestre</button><button class="${temaActual()==='magenta'?'on':''}" data-act="tema" data-t="magenta">Magenta</button></div>`)}
    </div>`)}
  </div>`;
}
/* ficha de un área: todo lo que se configura de ella en un solo lugar */
function ajFicha(id,grupo){
  const base=grupo?areasVista().find(a=>a._grupo):getArea(id); if(!base) return;
  const G=ajGrupoDe(base), C=typeof ctResumen==='function'?ctResumen():null, k=ajClaveDir(base), sec=t=>`<div class="aj-sec">${t}</div>`;
  let cta='';
  if(C&&C.listo){
    const e=C.tiene(k), p=C.pendiente(k);
    cta=ajFila('Cuenta de acceso de la dirección',e?(e.t?`Activa desde el ${esc(fmtCorta(ymd(new Date(e.t))))}`:'Activa'):p?'Se creó al entrar y espera tu aprobación.':'Se crea sola cuando la dirección entre, o al cambiarle la contraseña aquí.',
      e?pill('Activa','ok'):p?`<button class="btn sm primary" data-act="ctAprobar" data-id="${esc(p)}">Aprobar</button>`:pill('Sin cuenta','warn'));
  }
  openModal(`${mHead(`${areaIco(base,{size:22})} ${esc(base.nombre)}`)}
    <div class="aj-ficha">
      ${sec(G.length>1?'Áreas':'Datos del área')}
      ${G.map(a=>ajFila(G.length>1?esc(a.nombre):'Nombre, ícono y color',`<span class="aj-col"><i style="background:${esc(a.color)}"></i>${esc(a.nombre)}</span>`,`<button class="btn sm" data-act="areaEdit" data-id="${esc(a.id)}">Editar</button>`)).join('')}
      ${sec('Dirección')}
      ${ajFila('Contraseña de dirección',G.length>1?'Una sola contraseña para las dos áreas':'La usa quien dirige el área para entrar',`<button class="btn sm" data-act="pwDir" data-id="${esc(G[0].id)}"${G.length>1?' data-grupo="1"':''}>Cambiar</button>`)}
      ${cta}
      ${typeof mantAplica==='function'&&mantConfig()?sec('Mantenimiento')+G.map(a=>esFitArea(a.id)
        ?ajFila(G.length>1?esc(a.nombre):'Usa Control Mantenimiento','Siempre activo: sus reportes salen de Fitness Control',pill('Activo','ok'))
        :ajFila(G.length>1?esc(a.nombre):'Usa Control Mantenimiento',a.mantenimiento?`La dirección ve los reportes de equipo · ${plu(profesores(a.id).filter(p=>p.mantenimiento).length,'profesor con el módulo','profesores con el módulo')}`:'La dirección vería los reportes de equipo y podría activarlo a cada profesor',
          ajSw(!!a.mantenimiento,`data-act="ajMant" data-id="${esc(a.id)}" data-v="${a.mantenimiento?'0':'1'}"${G.length>1?` data-g="1"`:''}`,'Mantenimiento en '+a.nombre))).join(''):''}
      ${G.some(a=>esFitArea(a.id))?sec('Clases fitness')+`<div class="row fit-prop"><div><b>Hombres y mujeres</b><small>Fitness Control no lo manda: se aplica <b>${fitHo()}%</b> hombres y <b>${100-fitHo()}%</b> mujeres.</small></div>
        <div class="fit-ctl"><input id="fit_ho" type="number" inputmode="numeric" min="0" max="100" value="${fitHo()}" aria-label="Porcentaje de hombres"><span>% H</span><button class="btn sm" data-act="fitHoGuardar">Guardar</button></div></div>`:''}
      <div class="btns"><button class="btn" data-act="closeModal">Cerrar</button></div>
    </div>`);
}
Object.assign(actions,{
  ajArea(d){ ajFicha(d.id,!!d.grupo); },
  ajMant(d){ actions.mantAreaSet(d); ajFicha(d.id,!!d.g); },
  ajIr(d){ const el=document.getElementById(d.id); if(!el) return; if(d.id==='aj-conex'){ ui.ajAbierto={...(ui.ajAbierto||{}),fc:true,mant:true}; render(); } (document.getElementById(d.id)||el).scrollIntoView({behavior:'smooth',block:'start'}); }
});
document.addEventListener('toggle',e=>{ const d=e.target; if(d&&d.dataset&&d.dataset.aj){ ui.ajAbierto={...(ui.ajAbierto||{}),[d.dataset.aj]:d.open}; } },true);
function openPw(kind,aid,grupo){
  const self=kind==='self'||kind==='ger';               // la propia: se pide la actual (también para cambiarla en su cuenta de Firebase)
  const label=kind==='ger'?'Gerencia':kind==='met'?'Metodología deportiva':`Dirección · ${esc(grupo?SV_GRUPO_NOM:(getArea(aid)||{}).nombre||'')}`;
  openModal(`${mHead('Cambiar contraseña')}
    <div class="sub">${label}</div>
    ${self?`<label class="f"><span>Contraseña actual</span><input id="pw_cur" type="password" autocomplete="current-password"></label>`:''}
    <label class="f"><span>Nueva contraseña (mínimo 6 caracteres)</span><input id="pw_new" type="password" autocomplete="new-password"></label>
    <label class="f"><span>Confirmar nueva contraseña</span><input id="pw_new2" type="password" autocomplete="new-password"></label>
    <div class="err" id="pw_err"></div>
    <div class="btns"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="savePw" data-kind="${kind}" data-id="${esc(aid||'')}"${grupo?' data-grupo="1"':''}>Guardar contraseña</button></div>`);
}
function openAreaForm(id){
  const a=id?getArea(id):{nombre:'',icono:'trofeo',color:COLORS[areasList().length%COLORS.length]};
  openModal(`${mHead(id?'Editar área':'Nueva área')}
    <label class="f"><span>Nombre del área</span><input id="a_nombre" value="${esc(a.nombre)}"></label>
    <div class="two">
      <label class="f"><span>Color de identificación</span><input id="a_color" type="color" value="${esc(a.color)}"></label>
    </div>
    <div class="f"><span class="lb">Ícono</span><input id="a_icono" type="hidden" value="${esc(iconKey(a))}"><div class="ico-pick" id="ico_pick">${AREA_ICON_LIST.map(k=>`<button type="button" class="ico-op${iconKey(a)===k?' on':''}" data-act="pickIco" data-k="${k}" title="${esc(AREA_ICONS[k].n)}" aria-label="${esc(AREA_ICONS[k].n)}">${areaSvg(k,24)}</button>`).join('')}</div></div>
    ${id?'':`<label class="f"><span>Tipo de área</span><select id="a_tipo"><option value="">Deportiva: grupos, clases y aforos por clase</option><option value="gimnasio">Gimnasio: aforo por hora (mujeres y hombres) y personalizados</option><option value="nutricion">Nutrición: bitácora de servicios y horarios</option><option value="fisioterapia">Fisioterapia: bitácora de servicios y horarios</option><option value="paramedico">Paramédicos: agenda citas de empleados a Fisioterapia</option></select></label>`}
    <div id="a_gim"${(a.tipo==='gimnasio')?'':' hidden'}>
      <div class="two">
        <label class="f"><span>Capacidad general de la sala (personas)</span><input id="a_cap" type="number" inputmode="numeric" min="1" value="${esc(a.cap||60)}"></label>
        <label class="f"><span>Permanencia promedio (horas)</span><input id="a_est" type="number" inputmode="decimal" step="0.25" min="0.5" value="${esc(a.estancia||1.25)}"></label>
      </div>
      <div class="f"><span class="lb">Horario y capacidad de cada día</span>
        <div class="gh">${DIAS.map((l,i)=>{ const D=(typeof gimDias==='function'&&a.tipo==='gimnasio')?gimDias(a.id)[i]:(a.horario?null:{abre:i===6?9:6,cierra:i===6?16:23}); const X=a.horario?(a.horario['d'+i]||{}):{}; const ab=D?D.abre:6, ci=D?D.cierra:23;
          return `<div class="gh-r${D?' on':''}"><label class="sv-d"><input type="checkbox" class="gh_on" value="${i}"${D?' checked':''}><span>${l}</span></label>
            <select class="gh_a" aria-label="Abre ${l}">${Array.from({length:24},(_,h)=>`<option value="${h}"${h===ab?' selected':''}>${h}:00</option>`).join('')}</select><em>a</em>
            <select class="gh_c" aria-label="Cierra ${l}">${Array.from({length:24},(_,k)=>k+1).map(h=>`<option value="${h}"${h===ci?' selected':''}>${h}:00</option>`).join('')}</select>
            <input class="gh_cap" type="number" inputmode="numeric" min="1" placeholder="${esc(a.cap||60)}" value="${esc(X.cap||'')}" aria-label="Capacidad ${l}"></div>`; }).join('')}</div>
        <button type="button" class="btn sm" data-act="ghCopiar">Copiar el primer día abierto a todos los demás</button>
        <small class="mut">Desmarca los días que cierra. La última columna es la capacidad máxima de ese día: déjala vacía para usar la general. Ponla solo si ese día de verdad admite menos gente (por ejemplo, el domingo).</small></div>
      <div class="sub">La permanencia sirve para estimar las visitas a partir de los conteos por hora.</div>
    </div>
    <label class="f"><span>Origen de los datos</span><select id="a_vinc"><option value="0"${a.vinculo?'':' selected'}>Se capturan en Gerencia</option><option value="1"${a.vinculo?' selected':''}>Vienen de Fitness Control (solo lectura)</option></select><small class="mut">Solo un área puede recibir los datos de Fitness Control: sus profesores, clases y aforos.</small></label>
    <label class="f" id="a_fcexcl_f"${a.vinculo?' hidden':''}><span class="sv-d" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="a_fcexcl"${a.fcExcluir?' checked':''}><span>No traer clases automáticas de Fitness Control a esta área</span></span></label>
    <small class="mut" id="a_fcexcl_s"${a.vinculo?' hidden':''}>Si una clase de Fitness Control coincide con el nombre de esta área (como "Gimnasia" con "Gimnasia rítmica"), normalmente aparece aquí de solo lectura y sin lista de alumnos. Actívalo para que esta área sea 100% manual: esas clases dejan de aparecer y puedes dar de alta tus propios grupos con su lista de alumnos para pasar lista aquí.</small>
    ${id?'':`<div class="sub">La contraseña inicial de dirección será “${DEF_PASS_DIR}”. Cámbiala en Ajustes.</div>`}
    <div class="btns"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="saveArea" data-id="${esc(id||'')}">Guardar área</button></div>
    ${id?`<div class="btns"><button class="btn danger" data-act="delArea" data-id="${esc(id)}">Eliminar área y sus datos</button></div>`:''}`);
}

const temaActual = () => { try{ return localStorage.getItem('gd_tema')==='magenta'?'magenta':'campestre'; }catch(e){ return 'campestre'; } };
function aplicarTema(){
  const t=temaActual(); document.documentElement.dataset.tema=t;
  const m=document.querySelector('meta[name=theme-color]'); if(m) m.content=t==='magenta'?'#7a2b8f':'#0f7a5a';
}
document.addEventListener('change',e=>{ if(e.target.classList&&e.target.classList.contains('gh_on')){ const r=e.target.closest('.gh-r'); if(r) r.classList.toggle('on',e.target.checked); }
  if(e.target.id==='a_tipo'){ const g=$('#a_gim'); if(g) g.hidden=e.target.value!=='gimnasio'; }
  if(e.target.id==='a_vinc'){ const es1=e.target.value==='1'; const f=$('#a_fcexcl_f'), s=$('#a_fcexcl_s'); if(f) f.hidden=es1; if(s) s.hidden=es1; } });
Object.assign(actions,{
  pickIco(d){ $('#a_icono').value=d.k; document.querySelectorAll('.ico-op').forEach(b=>b.classList.toggle('on',b.dataset.k===d.k)); },
  tema(d){ try{ localStorage.setItem('gd_tema',d.t); }catch(e){} aplicarTema(); render(); },
  pwGer(){ openPw('ger'); },
  pwMet(){ openPw('met'); },
  pwDir(d){ openPw('dir',d.id,!!d.grupo); },
  pwSelf(){ openPw('self',session.area); },
  savePw(d){
    const err=m=>{ $('#pw_err').textContent=m; };
    const n1=$('#pw_new').value, n2=$('#pw_new2').value;
    const grupo=d.kind==='self'&&session&&Array.isArray(session.grupo)?session.grupo:(d.kind==='dir'&&d.grupo?svDirGrupo():null);
    const cur=($('#pw_cur')||{}).value||'';
    if(d.kind==='self' && !(grupo||[d.id]).some(id=>hashPass(cur)===state.cfg.pass.dir[id])) return err('La contraseña actual no coincide.');
    if(d.kind==='ger' && hashPass(cur)!==state.cfg.pass.ger) return err('La contraseña actual no coincide.');
    if(n1.length<6) return err('Usa al menos 6 caracteres.');
    if(n1!==n2) return err('Las dos contraseñas no coinciden.');
    if(grupo) grupo.forEach(id=>setPath(`cfg/pass/dir/${id}`,hashPass(n1)));          // Nutrición y Fisioterapia: una sola contraseña
    else setPath(d.kind==='ger'?'cfg/pass/ger':d.kind==='met'?'cfg/pass/met':`cfg/pass/dir/${d.id}`,hashPass(n1));
    if(typeof ctPassCambiada==='function') ctPassCambiada(d.kind,d.id,!!d.grupo,cur,n1);     // también en su cuenta de Firebase
    closeModal(); toast('Contraseña actualizada');
  },
  ghCopiar(){                                            // copia el horario del primer día abierto a los demás días abiertos
    const f=[...document.querySelectorAll('.gh-r')].filter(r=>r.querySelector('.gh_on').checked); if(f.length<2) return;
    const a=f[0].querySelector('.gh_a').value, c=f[0].querySelector('.gh_c').value, k=f[0].querySelector('.gh_cap').value;
    f.slice(1).forEach(r=>{ r.querySelector('.gh_a').value=a; r.querySelector('.gh_c').value=c; r.querySelector('.gh_cap').value=k; });
    toast('Horario copiado a los días abiertos');
  },
  areaNew(){ openAreaForm(''); },
  areaEdit(d){ openAreaForm(d.id); },
  saveArea(d){
    const nombre=$('#a_nombre').value.trim();
    if(!nombre){ toast('Escribe el nombre del área'); return; }
    const icono=$('#a_icono').value.trim()||'trofeo', color=$('#a_color').value;
    const vinculo=$('#a_vinc').value==='1'&&!(((getArea(d.id)||{}).tipo==='gimnasio')||(($('#a_tipo')||{}).value==='gimnasio')||SERV_TIPOS.includes((getArea(d.id)||{}).tipo)||SERV_TIPOS.includes(($('#a_tipo')||{}).value));
    const fcExcluir=!vinculo&&!!($('#a_fcexcl')&&$('#a_fcexcl').checked);
    const tipo=d.id?((getArea(d.id)||{}).tipo||''):(($('#a_tipo')||{}).value||'');
    let gim={};
    if(tipo==='gimnasio'){
      const horario={}; let err='';
      document.querySelectorAll('.gh-r').forEach(r=>{ const c=r.querySelector('.gh_on'); if(!c.checked) return;
        const ab=+r.querySelector('.gh_a').value, ci=+r.querySelector('.gh_c').value, cap=parseInt(r.querySelector('.gh_cap').value)||0;
        if(ci<=ab) err=`El cierre del ${DIAS[+c.value]} debe ser después de la apertura`;
        horario['d'+c.value]={a:ab,c:ci,cap:cap>0?cap:''}; });
      if(err){ toast(err); return; }
      const H=Object.values(horario); if(!H.length){ toast('Marca al menos un día en que abre el gimnasio'); return; }
      gim={tipo,cap:Math.max(1,parseInt($('#a_cap').value)||60),estancia:Math.max(.5,parseFloat($('#a_est').value)||1.25),horario,abre:Math.min(...H.map(x=>x.a)),cierra:Math.max(...H.map(x=>x.c))};
    }
    if(vinculo) areasList().forEach(x=>{ if(x.id!==d.id&&x.vinculo) setPath(`cfg/areas/${x.id}`,{...x,vinculo:false}); });
    if(d.id){ setPath(`cfg/areas/${d.id}`,{...getArea(d.id),nombre,icono,color,vinculo,fcExcluir,...gim}); }
    else {
      const id=slug(nombre)+'-'+uid().slice(-4), orden=areasList().reduce((m,a)=>Math.max(m,a.orden||0),0)+1;
      setPath(`cfg/areas/${id}`,{id,nombre,icono,color,orden,vinculo,fcExcluir,...gim,...(SERV_TIPOS.includes(tipo)?{tipo}:{})});
      setPath(`cfg/pass/dir/${id}`,hashPass(DEF_PASS_DIR));
    }
    closeModal(); render(); toast('Área guardada');
  },
  delArea(d){
    if(!confirm('¿Eliminar esta área con todos sus grupos, eventos y reportes? No se puede deshacer.')) return;
    setPath(`cfg/areas/${d.id}`,undefined); setPath(`cfg/pass/dir/${d.id}`,undefined); setPath(`data/${d.id}`,undefined);
    if(ui.gArea===d.id) ui.gArea=null;
    closeModal(); render(); toast('Área eliminada');
  },
  export(){ descargarRespaldo(); toast('Respaldo descargado'); render(); },
  importPick(){ const f=$('#imp_file'); if(f){ f.value=''; f.click(); } },
  openPapelera(){ papeleraPurga(); abrirPapelera(); },
  restPapelera(d){
    const it=(state.papelera||{})[d.id]; if(!it) return;
    if(getPath(`data/${it.aid}/grupos/${it.gid}`)&&!confirm('Ya existe un grupo con ese identificador. ¿Reemplazarlo con el de la papelera?')) return;
    setPath(`data/${it.aid}/grupos/${it.gid}`,it.grupo);
    Object.entries(it.asistencia||{}).forEach(([k,r])=>setPath(`data/${it.aid}/asistencia/${k}`,r));
    setPath(`papelera/${d.id}`,undefined);
    abrirPapelera(); render(); toast('Grupo restaurado con su historial');
  },
  delPapelera(d){ if(!confirm('¿Eliminar definitivamente? Ya no se podrá recuperar.')) return; setPath(`papelera/${d.id}`,undefined); abrirPapelera(); render(); }
});

/* ---------- respaldo: descarga, recordatorio, restauración y papelera ---------- */
function descargarRespaldo(pref){
  const datos={...state,vinculado_fitness_control:Object.fromEntries(Object.entries(LINK).map(([a,v])=>[a,{...v,profesores:Object.fromEntries(Object.entries(v.profesores||{}).map(([k,p])=>[k,{...p,foto:''}]))}]))};
  const blob=new Blob([JSON.stringify(datos,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`${pref||'gerencia-deportes'}-${todayStr()}.json`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  if(!pref) setPath('cfg/ultRespaldo',new Date().toISOString());
}
const respaldoDias = () => { const u=state.cfg&&state.cfg.ultRespaldo; if(!u) return null; const t=Date.parse(u); return isNaN(t)?null:Math.floor((Date.now()-t)/864e5); };
const respaldoTxt = () => { const n=respaldoDias(); return n==null?'Todavía no se ha descargado ningún respaldo':n===0?'Último respaldo: hoy':`Último respaldo: hace ${plu(n,'día','días')}`; };
function respaldoAviso(){
  const n=respaldoDias(); if(n!=null&&n<7) return '';
  return `<div class="ls-aviso" style="margin:0 0 12px"><b>${n==null?'Aún no hay un respaldo descargado':'Respaldo pendiente: último hace '+plu(n,'día','días')}</b><span>Descárgalo y guárdalo en tu Drive o envíalo a tu correo.</span><div><button class="btn sm primary" data-act="export">Descargar respaldo ahora</button></div></div>`;
}
function papeleraPurga(){
  Object.entries(state.papelera||{}).forEach(([k,it])=>{ if(!it||!it.borrado||Date.now()-Date.parse(it.borrado)>30*864e5) setPath(`papelera/${k}`,undefined); });
}
function abrirPapelera(){
  const its=Object.entries(state.papelera||{}).sort((a,b)=>String(b[1].borrado).localeCompare(String(a[1].borrado)));
  openModal(`${mHead('Papelera')}
    <div class="sub">Lo que se elimina se conserva 30 días. Después se borra solo.</div>
    ${its.length?`<div class="card">${its.map(([k,it])=>{ const a=getArea(it.aid); const dias=Math.max(0,30-Math.floor((Date.now()-Date.parse(it.borrado))/864e5));
      return `<div class="row"><div><b>${esc(it.nombre||'Grupo')}</b><small>${esc(a?a.nombre:'')} · ${plu(Object.keys(it.asistencia||{}).length,'registro de asistencia','registros de asistencia')} · se borra en ${plu(dias,'día','días')}</small></div><div class="btns" style="margin:0"><button class="btn sm primary" data-act="restPapelera" data-id="${esc(k)}">Restaurar</button><button class="btn sm danger" data-act="delPapelera" data-id="${esc(k)}">Quitar</button></div></div>`; }).join('')}</div>`:'<div class="empty">La papelera está vacía.</div>'}
    <div class="btns"><button class="btn" data-act="closeModal">Cerrar</button></div>`);
}
document.addEventListener('change',e=>{
  if(!e.target||e.target.id!=='imp_file'||!e.target.files||!e.target.files[0]) return;
  const f=e.target.files[0], rd=new FileReader();
  rd.onerror=()=>toast('No se pudo leer el archivo');
  rd.onload=()=>{
    let obj; try{ obj=JSON.parse(rd.result); }catch(err){ toast('El archivo no es un respaldo válido'); return; }
    if(!obj||typeof obj!=='object'||!obj.cfg||!obj.cfg.areas||!obj.cfg.pass){ toast('Ese archivo no parece un respaldo de Control Gerencia'); return; }
    delete obj.vinculado_fitness_control;
    if(FIREBASE_CONFIG.databaseURL&&(!online||!fbRef)){ toast('Necesitas internet para restaurar un respaldo'); return; }
    const areas=Object.keys(obj.cfg.areas).length, d=obj.data||{};
    const gr=Object.values(d).reduce((n,x)=>n+Object.keys((x&&x.grupos)||{}).length,0), as=Object.values(d).reduce((n,x)=>n+Object.keys((x&&x.asistencia)||{}).length,0);
    if(!confirm(`Restaurar “${f.name}”\n\n${areas} áreas · ${gr} grupos · ${as} registros de asistencia\n\nEsto REEMPLAZA todos los datos actuales (de todos los dispositivos). Primero se descargará una copia de lo actual.\n\n¿Continuar?`)) return;
    descargarRespaldo('antes-de-restaurar');
    const nuevo=clean(obj);
    const fin=()=>{ state=nuevo; outbox=[]; obSave(); lsSave(); render(); toast('Respaldo restaurado'); };
    if(fbRef) fbRef.set(nuevo).then(fin).catch(()=>toast('No se pudo restaurar: revisa tu conexión')); else fin();
  };
  rd.readAsText(f);
});
