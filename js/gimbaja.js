'use strict';
/* =====================================================================
   gimbaja.js — Gimnasio: baja de un instructor sin perder sus personalizados.
   Al eliminar a un instructor (o marcarlo como inactivo) que tiene personalizados pendientes,
   la dirección decide, paquete por paquete:
     · Pasarlo a otro instructor: sus sesiones futuras pasan al nuevo, que recibe el aviso.
       Si alguna choca con su agenda, se le avisa para que la reagende.
     · Cerrarlo: deja de ocupar horas y se conserva su historial (sesiones dadas, bitácora, reportes).
   Si la dirección no decide en ese momento, los paquetes quedan en “Requiere atención” como “por decidir”.
   Un paquete cerrado ya no tiene sesiones por dar ni “sin registrar”: solo conserva lo que sí se registró.
   Los paquetes que ya no tienen instructor (cerrados, completados o vencidos) se ven al final de Personalizados,
   en “De instructores que ya no están”: ahí la dirección puede borrarlos definitivamente (con sus movimientos
   de la bitácora), por ejemplo los registros de prueba.
   ===================================================================== */
const ptDe = (aid,pid) => coll(aid,'paquetes').filter(x=>x.profId===pid&&!fcId(x.id));
const ptPendientesDe = (aid,pid) => ptDe(aid,pid).filter(ptVigente);
function ptHuerfanos(aid){                                   // paquetes vigentes de instructores eliminados o inactivos
  return coll(aid,'paquetes').filter(x=>ptVigente(x)&&!fcId(x.id)&&(()=>{ const p=getProf(aid,x.profId); return !p||p.activo===false; })());
}
const ptProfNom = (aid,x) => (getProf(aid,x.profId)||{}).nombre||x.profNom||'Instructor dado de baja';
function ptSinInstructor(aid){                              // paquetes ya no vigentes de instructores eliminados (los vigentes están “por decidir”)
  return coll(aid,'paquetes').filter(x=>!fcId(x.id)&&!getProf(aid,x.profId)&&!ptVigente(x))
    .sort((a,b)=>(b.cerradoTs||0)-(a.cerradoTs||0)||String(b.fin||'').localeCompare(String(a.fin||'')));
}
const ptMovs = (aid,pkId) => coll(aid,'gimlog').filter(l=>l.pk===pkId);
function ptSinInstructorHTML(aid){
  const L=ptSinInstructor(aid); if(!L.length) return '';
  const puede=!roDatos(aid)&&!isProf()&&!isRec();
  return `<div class="h2 sm">De instructores que ya no están <span class="pill mut">${L.length}</span></div>
    <div class="sub">Personalizados que quedaron cerrados al dar de baja a su instructor. Ya no ocupan horas ni salen como pendientes; se guardan solo como historial. Si eran de prueba o ya no los necesitas, bórralos definitivamente.</div>
    ${L.map(x=>{ const est=ptEstado(x), n=ptMovs(aid,x.id).length;
      return `<div class="card pb-arch"><div class="row"><div><b>${esc(x.cliente||'Cliente')}</b>
        <small>${esc(ptProfNom(aid,x))} · ${ptReal(x)} de ${+x.total||0} sesiones usadas${x.cerradoTs?` · cerrado el ${esc(fmtTs(x.cerradoTs))}`:''}${n?` · ${plu(n,'movimiento','movimientos')} en la bitácora`:''}</small></div>${pill(est,PT_CLS[est])}</div>
        <div class="btns"><button class="btn sm" data-act="ptAgenda" data-id="${esc(x.id)}">Ver agenda</button>
          ${puede?`<button class="btn sm danger" data-act="ptPurgar" data-id="${esc(x.id)}">Borrar definitivamente</button>`:''}</div></div>`; }).join('')}`;
}
/* borra el paquete, sus sesiones y sus movimientos de la bitácora. Sin dejar rastro: es para limpiar datos de prueba o ya sin uso */
function ptPurgar(aid,x){
  ptMovs(aid,x.id).forEach(l=>setPath(`data/${aid}/gimlog/${l.id}`,undefined));
  setPath(`data/${aid}/paquetes/${x.id}`,undefined);
}
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
  ptPurgar(d){
    const aid=curArea(), x=getPath(`data/${aid}/paquetes/${d.id}`); if(!x||roDatos(aid)||isProf()||isRec()||fcId(x.id)) return;
    if(getProf(aid,x.profId)&&ptVigente(x)){ toast('Este personalizado sigue activo'); return; }
    const n=ptMovs(aid,x.id).length;
    if(!confirm(`¿Borrar definitivamente el personalizado de ${x.cliente||'este cliente'}?\n\nSe borran sus sesiones${n?` y sus ${n} movimientos de la bitácora`:''}. Ya no aparecerá en ningún lado y no se puede deshacer.`)) return;
    ptPurgar(aid,x); closeModal(); render(); toast('Personalizado borrado definitivamente');
  },
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
