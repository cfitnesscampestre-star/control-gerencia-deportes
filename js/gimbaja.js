'use strict';
/* =====================================================================
   gimbaja.js — Gimnasio: baja de un instructor sin perder sus personalizados.
   Al eliminar a un instructor (o marcarlo como inactivo) que tiene personalizados pendientes,
   la dirección decide, paquete por paquete:
     · Pasarlo a otro instructor: sus sesiones futuras pasan al nuevo, que recibe el aviso.
       Si alguna choca con su agenda, se le avisa para que la reagende.
     · Cerrarlo: deja de ocupar horas y se conserva su historial (sesiones dadas, bitácora, reportes).
   Si la dirección no decide en ese momento, los paquetes quedan en “Requiere atención” como “por decidir”.
   ===================================================================== */
const ptDe = (aid,pid) => coll(aid,'paquetes').filter(x=>x.profId===pid&&!fcId(x.id));
const ptPendientesDe = (aid,pid) => ptDe(aid,pid).filter(ptVigente);
function ptHuerfanos(aid){                                   // paquetes vigentes de instructores eliminados o inactivos
  return coll(aid,'paquetes').filter(x=>ptVigente(x)&&!fcId(x.id)&&(()=>{ const p=getProf(aid,x.profId); return !p||p.activo===false; })());
}
const ptProfNom = (aid,x) => (getProf(aid,x.profId)||{}).nombre||x.profNom||'Instructor dado de baja';
function ptBajaModal(pid,modo){
  const aid=curArea(), p=getProf(aid,pid), L=ptPendientesDe(aid,pid), nom=p?p.nombre:(L[0]?ptProfNom(aid,L[0]):'Instructor');
  if(!L.length){ toast('No tiene personalizados pendientes'); return; }
  const otros=profesores(aid).filter(x=>x.activo!==false&&x.id!==pid);
  const titulo=modo==='eliminar'?`Eliminar a ${esc(nom)}`:`Personalizados de ${esc(nom)}`;
  openModal(`${mHead(titulo)}
    <div class="sub">${esc(nom.split(' ')[0])} tiene ${plu(L.length,'personalizado','personalizados')} con sesiones pendientes. Elige qué pasa con cada uno: nada se borra, el historial se conserva.</div>
    ${L.map(x=>{ const pend=Math.max(0,(+x.total||0)-ptReal(x)), M=ptMapa(x), fut=M.ag.filter(c=>!c.reg&&c.st!=='sin registrar').length;
      return `<div class="card pb"><b>${esc(x.cliente||'Cliente')}</b><small>${ptReal(x)} de ${+x.total||0} sesiones usadas · ${plu(pend,'pendiente','pendientes')}${fut?` · ${fut} agendadas`:''}</small>
        <label class="f"><span>¿Qué hacemos?</span><select class="pb-sel" data-pk="${esc(x.id)}">
          ${otros.map(o=>`<option value="${esc(o.id)}">Pasarlo a ${esc(o.nombre)}</option>`).join('')}
          <option value="__cerrar"${otros.length?'':' selected'}>Cerrar el paquete (se conserva el historial)</option></select></label></div>`; }).join('')}
    <div class="btns"><button class="btn" data-act="closeModal">${modo==='eliminar'?'Cancelar':'Decidir después'}</button>
      <button class="btn ${modo==='eliminar'?'danger':'primary'}" data-act="ptBajaAplicar" data-prof="${esc(pid)}" data-modo="${esc(modo||'')}">${modo==='eliminar'?`Aplicar y eliminar a ${esc(nom.split(' ')[0])}`:'Aplicar'}</button></div>`);
}
function ptReasignar(aid,x,nuevo){                           // pasa el paquete a otro instructor; devuelve cuántas sesiones chocan con su agenda
  const ctx=ghCtx(aid,x.id), now=ahoraKey(), antes=ptProfNom(aid,x);
  const choques=ptMapa(x).ag.filter(c=>!c.reg&&ctKey(c.f,c.h)>now&&ctx.occ[`${nuevo}|${c.f}|${c.h}`]).length;
  setPath(`data/${aid}/paquetes/${x.id}`,{...x,profId:nuevo,profNom:(getProf(aid,nuevo)||{}).nombre||'',reasignado:{de:x.profId,deNom:antes,ts:Date.now()}});
  gimLog(aid,{tipo:'reasigna',txt:`${x.cliente||'Cliente'}: se te asignó (antes con ${antes})${choques?` · ${plu(choques,'sesión choca','sesiones chocan')} con tu agenda: reagéndala${choques>1?'s':''}`:''}`,pk:x.id,prof:nuevo,aviso:true});
  return choques;
}
Object.assign(actions,{
  ptBajaAbrir(d){ ptBajaModal(d.prof,''); },
  ptBajaAplicar(d){
    const aid=curArea(); if(roDatos(aid)||isProf()||isRec()) return;
    const pid=d.prof, p=getProf(aid,pid), nom=p?p.nombre:'';
    let pasados=0, cerrados=0, choques=0;
    document.querySelectorAll('.pb-sel').forEach(sel=>{
      const x=getPath(`data/${aid}/paquetes/${sel.dataset.pk}`); if(!x) return;
      if(sel.value==='__cerrar'){
        setPath(`data/${aid}/paquetes/${x.id}`,{...x,cerrado:true,cerradoTs:Date.now(),profNom:x.profNom||nom});
        gimLog(aid,{tipo:'baja',txt:`${x.cliente||'Cliente'}: paquete cerrado por baja de ${nom||ptProfNom(aid,x)} (${ptReal(x)} de ${+x.total||0} sesiones usadas)`,pk:x.id,prof:pid});
        cerrados++;
      } else { choques+=ptReasignar(aid,x,sel.value); pasados++; }
    });
    if(d.modo==='eliminar'&&p){
      ptDe(aid,pid).forEach(x=>{ if(!x.profNom) setPath(`data/${aid}/paquetes/${x.id}/profNom`,nom); });     // su nombre se conserva en el historial
      setPath(`data/${aid}/profesores/${pid}`,undefined);
      if(typeof ctQuitar==='function') ctQuitar(ctClave({rol:'prof',area:aid,id:pid}));
    }
    closeModal(); render();
    toast(`${d.modo==='eliminar'?`Se eliminó a ${nom}. `:''}${pasados?`${plu(pasados,'paquete pasado','paquetes pasados')} a otro instructor`:''}${pasados&&cerrados?' · ':''}${cerrados?plu(cerrados,'paquete cerrado','paquetes cerrados'):''}${choques?` · ${plu(choques,'sesión choca','sesiones chocan')}: el instructor recibió el aviso`:''}`);
  }
});
