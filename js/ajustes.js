'use strict';
/* =====================================================================
   ajustes.js — Ajustes de gerencia: contraseñas, áreas y respaldo
   ===================================================================== */
function gAjustes(){
  const as=areasList();
  const nPend = pendientes();
  const nube = online ? 'Firebase conectado: los datos se sincronizan entre dispositivos.'+(nPend?` Subiendo ${nPend} cambio(s) pendientes.`:'')
    : FIREBASE_CONFIG.databaseURL ? `Sin internet: se guarda en este equipo${nPend?` (${nPend} cambio(s) por subir)`:''} y se sube solo al volver la señal.`
    : 'Firebase no está configurado: los datos viven solo en este equipo.';
  return `<div class="dash">
    <div class="d-att">
      ${gSimulacionCard()}
      <div class="h2">Fitness Control</div>
      ${gVinculoCard()}
      <div class="h2">Apariencia</div>
      <div class="card"><div class="row"><div><b>Colores del sistema</b><small>Solo en este dispositivo</small></div>
        <div class="seg"><button class="${temaActual()==='campestre'?'on':''}" data-act="tema" data-t="campestre">Campestre</button><button class="${temaActual()==='magenta'?'on':''}" data-act="tema" data-t="magenta">Magenta</button></div></div></div>
      <div class="h2">Contraseñas</div>
      <div class="card">
        <div class="row"><div><b>Gerencia</b><small>Acceso a todas las áreas</small></div><button class="btn sm" data-act="pwGer">Cambiar</button></div>
        ${as.map(a=>`<div class="row"><div><b>${areaIco(a,{size:18})} ${esc(a.nombre)}</b><small>Dirección del área</small></div><button class="btn sm" data-act="pwDir" data-id="${esc(a.id)}">Cambiar</button></div>`).join('')}
      </div>
    </div>
    <div class="d-ev">
      <div class="h2">Áreas <button class="btn sm primary" data-act="areaNew">+ Área</button></div>
      <div class="card">
        ${as.map(a=>`<div class="row"><div><b>${areaIco(a,{size:18})} ${esc(a.nombre)}</b><small style="color:${esc(a.color)}">Color de identificación</small></div><button class="btn sm" data-act="areaEdit" data-id="${esc(a.id)}">Editar</button></div>`).join('')||'<div class="sub">Sin áreas.</div>'}
      </div>
      <div class="h2">Datos</div>
      <div class="card">
        <div class="row"><div><b>Sincronización</b><small>${nube}</small></div></div>
        <div class="row"><div><b>Respaldo</b><small>Descarga todos los datos en un archivo</small></div><button class="btn sm" data-act="export">Exportar</button></div>
      </div>
    </div>
  </div>`;
}

function openPw(kind,aid){
  const self=kind==='self';
  const label=kind==='ger'?'Gerencia':`Dirección · ${esc((getArea(aid)||{}).nombre||'')}`;
  openModal(`${mHead('Cambiar contraseña')}
    <div class="sub">${label}</div>
    ${self?`<label class="f"><span>Contraseña actual</span><input id="pw_cur" type="password" autocomplete="current-password"></label>`:''}
    <label class="f"><span>Nueva contraseña (mínimo 4 caracteres)</span><input id="pw_new" type="password" autocomplete="new-password"></label>
    <label class="f"><span>Confirmar nueva contraseña</span><input id="pw_new2" type="password" autocomplete="new-password"></label>
    <div class="err" id="pw_err"></div>
    <div class="btns"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="savePw" data-kind="${kind}" data-id="${esc(aid||'')}">Guardar contraseña</button></div>`);
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
  pwDir(d){ openPw('dir',d.id); },
  pwSelf(){ openPw('self',session.area); },
  savePw(d){
    const err=m=>{ $('#pw_err').textContent=m; };
    const n1=$('#pw_new').value, n2=$('#pw_new2').value;
    if(d.kind==='self' && hashPass($('#pw_cur').value)!==state.cfg.pass.dir[d.id]) return err('La contraseña actual no coincide.');
    if(n1.length<4) return err('Usa al menos 4 caracteres.');
    if(n1!==n2) return err('Las dos contraseñas no coinciden.');
    setPath(d.kind==='ger'?'cfg/pass/ger':`cfg/pass/dir/${d.id}`,hashPass(n1));
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
  export(){
    const blob=new Blob([JSON.stringify({...state,vinculado_fitness_control:Object.fromEntries(Object.entries(LINK).map(([a,v])=>[a,{...v,profesores:Object.fromEntries(Object.entries(v.profesores||{}).map(([k,p])=>[k,{...p,foto:''}]))}]))},null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`gerencia-deportes-${todayStr()}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  }
});
