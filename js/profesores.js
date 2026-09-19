'use strict';
/* =====================================================================
   profesores.js — la dirección de cada área da de alta a sus profesores:
   nombre, tipo, especialidades, foto y PIN de acceso. Sus clases se asignan
   en Grupos (cada grupo tiene un profesor, un horario y su lista de alumnos).
   ===================================================================== */
const TIPOS_PROF = ['Planta','Externo'];
let pfFotoData = '';

function avatarHTML(nombre,foto,size){
  const s=size||52;
  return foto ? `<span class="av" style="width:${s}px;height:${s}px"><img src="${esc(foto)}" alt=""></span>`
              : `<span class="av" style="width:${s}px;height:${s}px;font-size:${Math.round(s*.4)}px">${esc(iniciales(nombre))}</span>`;
}
function pCard(aid,p){
  const n=clasesDe(aid,p.id).length;
  return `<button class="pcard" data-act="openProfesor" data-id="${esc(p.id)}" style="--ac:${areaColor(aid)}">
    ${avatarHTML(p.nombre,p.foto,54)}
    <div class="pc-n"><b>${esc(p.nombre)}</b><small>${esc(p.especialidad||'Sin especialidad')}</small></div>
    <div class="pc-r">${pill(p.tipo||'Planta','ok')}${p.activo===false?pill('Inactivo','mut'):''}<small>${plu(n,'clase','clases')}</small></div>
  </button>`;
}
function vProfesores(aid){
  const ps=profesores(aid), ro=roDatos(aid);
  return `
    <div class="h2">${esGim(aid)?'Instructores':'Profesores'} ${ro?'':`<button class="btn sm primary" data-act="openProfesor">+ ${esGim(aid)?'Instructor':'Profesor'}</button>`}</div>
    ${vinculoBanner(aid)}
    ${gruposSwitch()}
    <div class="sub">${ro?'Profesores del área y sus clases.':(esGim(aid)?'Da de alta a los instructores del gimnasio. Sus personalizados se registran en la pestaña Personalizados.':'Da de alta a tus profesores y asígnales clases en Grupos. Con su PIN entran a pasar lista.')}</div>
    ${ps.length?`<div class="plist">${ps.map(p=>pCard(aid,p)).join('')}</div>`
      :empty(ro?'Esta área todavía no tiene '+(esGim(aid)?'instructores':'profesores')+' dados de alta.':'Aún no hay '+(esGim(aid)?'instructores. Da de alta al primero con “+ Instructor”.':'profesores. Da de alta al primero con “+ Profesor”.'))}`;
}

function openProfesor(pid){
  const aid=curArea(), p=pid?(getProf(aid,pid)||{}):{}, ro=roDatos(aid)||fcId(pid), dis=ro?' disabled':'';
  pfFotoData=p.foto||'';
  const clases=pid?clasesDe(aid,pid).sort((a,b)=>((diasArr(a)[0]==null?9:diasArr(a)[0])-(diasArr(b)[0]==null?9:diasArr(b)[0]))||byHora(a,b)):[];
  openModal(`${mHead(pid?(ro?'Profesor':'Editar profesor'):'Nuevo profesor')}
    <div class="pf-foto"><span id="pf_prev">${avatarHTML(p.nombre,pfFotoData,84)}</span>
      ${ro?'':`<div class="pf-fbtn"><input id="pf_file" type="file" accept="image/*" hidden>
        <button class="btn sm" data-act="pfPick">Subir foto</button>
        <button class="btn sm danger" data-act="pfQuitar">Quitar</button></div>`}</div>
    <label class="f"><span>Nombre completo</span><input id="pf_nombre" value="${esc(p.nombre)}"${dis}></label>
    <div class="two">
      <label class="f"><span>Tipo</span><select id="pf_tipo"${dis}>${opts(TIPOS_PROF,p.tipo||'Planta')}</select></label>
      <label class="f"><span>¿Activo?</span><select id="pf_activo"${dis}><option value="1"${p.activo===false?'':' selected'}>Sí</option><option value="0"${p.activo===false?' selected':''}>No</option></select></label>
    </div>
    <label class="f"><span>Especialidades</span><input id="pf_esp" value="${esc(p.especialidad)}" placeholder="Ej. Pilates, CrossFit"${dis}></label>
    ${(ro||esGim(aid))?'':`<div class="f"><span class="lb">PIN de acceso (4 a 6 dígitos)</span>
      <div class="pinrow"><input id="pf_pin" inputmode="numeric" maxlength="6" autocomplete="off" value="${esc(p.pin)}"><button class="btn sm" data-act="pfGenPin">Generar</button></div>
      <small class="mut">El profesor usa este PIN, junto con su nombre, para entrar y pasar lista.</small></div>`}
    ${pid?`<div class="h2 sm">Clases asignadas (${clases.length})</div>
      ${clases.length?clases.map(g=>`<div class="line" style="--ac:${areaColor(aid)}"><div class="t">${esc(g.hi||'—')}</div><div class="b"><b>${esc(g.nombre)}</b><small>${esc(diasArr(g).map(i=>DIAS[i]).join(' · ')||'Sin días')}${g.lugar?' · '+esc(g.lugar):''}</small></div><div class="r">${rosterOf(g).length} alumnos</div></div>`).join(''):empty('Todavía no tiene clases asignadas.')}`:''}
    ${ro?`<div class="btns"><button class="btn" data-act="closeModal">Cerrar</button></div>`:`
    ${(pid&&!esGim(aid))?`<div class="btns"><button class="btn" data-act="asignarClase" data-id="${esc(pid)}">+ Asignar una clase</button></div>`:''}
    <div class="btns"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="saveProfesor" data-id="${esc(pid||'')}">Guardar profesor</button></div>
    ${pid?`<div class="btns"><button class="btn danger" data-act="delProfesor" data-id="${esc(pid)}">Eliminar profesor</button></div>`:''}`}`);
}
function pfLoadFile(file){
  const rd=new FileReader();
  rd.onload=()=>{ const img=new Image(); img.onload=()=>{
    const S=200, c=document.createElement('canvas'); c.width=c.height=S;
    const m=Math.min(img.width,img.height), sx=(img.width-m)/2, sy=(img.height-m)/2;
    c.getContext('2d').drawImage(img,sx,sy,m,m,0,0,S,S);
    pfFotoData=c.toDataURL('image/jpeg',.8);
    const pv=$('#pf_prev'); if(pv) pv.innerHTML=avatarHTML(($('#pf_nombre')||{}).value,pfFotoData,84);
  }; img.src=rd.result; };
  rd.readAsDataURL(file);
}
document.addEventListener('change',e=>{ if(e.target.id==='pf_file'&&e.target.files&&e.target.files[0]) pfLoadFile(e.target.files[0]); });

Object.assign(actions,{
  openProfesor(d){ openProfesor(d.id||''); },
  pfPick(){ const f=$('#pf_file'); if(f) f.click(); },
  pfQuitar(){ pfFotoData=''; const pv=$('#pf_prev'); if(pv) pv.innerHTML=avatarHTML(($('#pf_nombre')||{}).value,'',84); },
  pfGenPin(){ $('#pf_pin').value=String(Math.floor(1000+Math.random()*9000)); },
  asignarClase(d){ closeModal(); openGrupo('',d.id); },
  saveProfesor(d){
    const aid=curArea(), nombre=$('#pf_nombre').value.trim(), pin=($('#pf_pin')||{value:''}).value.trim();
    if(!nombre){ toast('Escribe el nombre del profesor'); return; }
    if(!esGim(aid)&&!/^\d{4,6}$/.test(pin)){ toast('El PIN debe tener de 4 a 6 dígitos'); return; }
    const id=d.id||('p'+uid()), prev=d.id?(getProf(aid,id)||{}):{};
    setPath(`data/${aid}/profesores/${id}`,{...prev,id,nombre,pin,tipo:$('#pf_tipo').value,activo:$('#pf_activo').value==='1',especialidad:$('#pf_esp').value.trim(),foto:pfFotoData||''});
    if(prev.nombre&&prev.nombre!==nombre) clasesDe(aid,id).forEach(g=>setPath(`data/${aid}/grupos/${g.id}/prof`,nombre));
    closeModal(); render(); toast('Profesor guardado');
  },
  delProfesor(d){
    if(!confirm('¿Eliminar este profesor? Sus clases quedan sin profesor asignado.')) return;
    const aid=curArea();
    clasesDe(aid,d.id).forEach(g=>setPath(`data/${aid}/grupos/${g.id}/profId`,''));
    setPath(`data/${aid}/profesores/${d.id}`,undefined);
    closeModal(); render(); toast('Profesor eliminado');
  }
});
