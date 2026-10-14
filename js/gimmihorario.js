'use strict';
/* =====================================================================
   gimmihorario.js — Gimnasio: “Mi horario” del instructor.
   El instructor (no la dirección) define en qué horas da personalizados, semana por semana:
   · toca una hora vacía para agregarla, o una de su horario para quitarla o bloquearla (comida, salida…);
   · no puede quitar ni bloquear una hora donde ya tiene socio: primero mueve la sesión;
   · “Copiar a la semana siguiente” sirve para recortar o repetir la próxima semana;
   · “Usar como horario fijo” deja esta semana como base para las semanas que no cambie.
   Recepción ve estas horas como libres u ocupadas (las bloqueadas salen ocupadas, sin motivo).
   Datos: profesores/<id>.horSem, .horPtH y .blq (ver gimhorario.js).
   ===================================================================== */
const MIH_SEMANAS = 8;                                       // hasta cuántas semanas adelante puede planear
const mihSem = () => { const hoy=mondayOf(todayStr()); let w=ui.mihSem||hoy; if(w<hoy) w=hoy; return w; };
const mihYo = () => getProf(session.area,session.profId)||{};
function mihCeldaInfo(aid,p,f,h){                          // estado de una hora para el instructor
  if(!ctLibre(f,h)) return {t:'pasada'};
  const ctx=mihCeldaInfo.ctx||(mihCeldaInfo.ctx=ghCtx(aid)), oc=ctx.occ[`${p.id}|${f}|${h}`];
  if(oc&&!oc.bloqueo) return {t:'socio',cli:oc.cliente||'Socio'};
  const b=ghBloqueo(p,f,h); if(b) return {t:'mio',motivo:b};
  return ghEnHorario(p,f,h)?{t:'libre'}:{t:'fuera'};
}
function vGimMiHorario(){
  const aid=session.area, p=mihYo(), wk=mihSem(), hoyW=mondayOf(todayStr()), gc=gimCfg(aid);
  mihCeldaInfo.ctx=ghCtx(aid);
  const dias=[0,1,2,3,4,5,6].filter(d=>gimDia(aid,d)), fechas=dias.map(d=>addDays(wk,d));
  const filas=[]; for(let h=gc.abre;h<gc.cierra;h++){
    filas.push(`<tr><th>${hh(h)}</th>${fechas.map(f=>{
      const dd=gimDia(aid,wdIdx(f)); if(!dd||h<dd.abre||h>=dd.cierra) return '<td><span class="gh-c off"></span></td>';
      const x=mihCeldaInfo(aid,p,f,h), a=`data-act="mihCelda" data-f="${f}" data-h="${h}"`;
      if(x.t==='pasada') return '<td><span class="gh-c off"></span></td>';
      if(x.t==='socio') return `<td><button class="gh-c yo" ${a} aria-label="${esc(x.cli)}"><small>${esc(String(x.cli).split(' ')[0])}</small></button></td>`;
      if(x.t==='mio') return `<td><button class="gh-c mio" ${a} aria-label="Bloqueada: ${esc(x.motivo)}"><b>Mío</b></button></td>`;
      if(x.t==='libre') return `<td><button class="gh-c ok" ${a} aria-label="Disponible"><b>✓</b></button></td>`;
      return `<td><button class="gh-c fh" ${a} aria-label="Fuera de tu horario">·</button></td>`;
    }).join('')}</tr>`);
  }
  const horas=fechas.reduce((n,f)=>n+ghHorasDia(p,f).filter(h=>ctLibre(f,h)).length,0);
  const ult=addDays(hoyW,7*(MIH_SEMANAS-1));
  mihCeldaInfo.ctx=null;
  return `<div class="h2">Mi horario de personalizados</div>
    <div class="sub">Tú decides en qué horas das personalizados, y puede ser distinto cada semana. Recepción ve tus horas libres para mandarte socios; las que bloqueas salen ocupadas.</div>
    <div class="calnav"><button class="ibtn" data-act="mihNav" data-n="-1" aria-label="Semana anterior"${wk<=hoyW?' disabled':''}>${ic('back')}</button><b>${esc(fmtCorta(wk))} – ${esc(fmtCorta(addDays(wk,6)))}${wk===hoyW?' · esta semana':''}</b><button class="ibtn" data-act="mihNav" data-n="1" aria-label="Semana siguiente"${wk>=ult?' disabled':''}>${ic('next')}</button></div>
    <div class="gh-wrap"><table class="gh-tb mih"><thead><tr><th></th>${fechas.map(f=>`<th class="${f===todayStr()?'hoy':''}">${DIAS[wdIdx(f)]}<small>${+f.slice(8,10)}</small></th>`).join('')}</tr></thead><tbody>${filas.join('')}</tbody></table></div>
    <div class="gh-leg"><span><i class="ok"></i>Disponible</span><span><i class="yo"></i>Con socio</span><span><i class="mio"></i>Mío (bloqueada)</span><span><i class="fh"></i>Fuera de tu horario</span></div>
    <div class="sub">${plu(horas,'hora disponible','horas disponibles')} esta semana. Toca una hora para agregarla, quitarla o bloquearla.</div>
    <div class="btns">${wk<ult?`<button class="btn" data-act="mihCopiar">Copiar a la semana siguiente</button>`:''}<button class="btn" data-act="mihFijo">Usar como horario fijo</button></div>`;
}
function mihGuardarDia(aid,pid,f,horas){                   // guarda el día f de esa semana
  setPath(`data/${aid}/profesores/${pid}/horSem/${mondayOf(f)}/d${wdIdx(f)}`,[...new Set(horas)].sort((a,b)=>a-b).join(','));
}
Object.assign(actions,{
  mihNav(d){ const hoy=mondayOf(todayStr()), ult=addDays(hoy,7*(MIH_SEMANAS-1)); let w=addDays(mihSem(),7*(+d.n)); if(w<hoy) w=hoy; if(w>ult) w=ult; ui.mihSem=w; render(); },
  mihCelda(d){
    const aid=session.area, p=mihYo(), f=d.f, h=+d.h; mihCeldaInfo.ctx=ghCtx(aid); const x=mihCeldaInfo(aid,p,f,h); mihCeldaInfo.ctx=null;
    const tit=`${DIAS_L[wdIdx(f)]} ${esc(fmtCorta(f))} · ${hh(h)}`, a=`data-f="${f}" data-h="${h}"`;
    let cuerpo='';
    if(x.t==='socio') cuerpo=`<div class="sub">Tienes a <b>${esc(x.cli)}</b> a esta hora. Para quitarla o bloquearla, primero mueve esa sesión desde tu agenda.</div>`;
    else if(x.t==='mio') cuerpo=`<div class="sub">Bloqueada: ${esc(x.motivo)}. Recepción la ve ocupada.</div><div class="btns"><button class="btn primary block" data-act="mihHacer" data-o="desbloq" ${a}>Desbloquear</button></div>`;
    else if(x.t==='libre') cuerpo=`<div class="btns"><button class="btn block" data-act="mihHacer" data-o="blq" data-m="Comida" ${a}>Bloquear: comida</button></div>
      <div class="btns"><button class="btn block" data-act="mihHacer" data-o="blq" data-m="Salida o asunto personal" ${a}>Bloquear: salida o asunto personal</button></div>
      <div class="btns"><button class="btn danger block" data-act="mihHacer" data-o="quitar" ${a}>Quitar de mi horario esta semana</button></div>`;
    else if(x.t==='fuera') cuerpo=`<div class="btns"><button class="btn primary block" data-act="mihHacer" data-o="agregar" ${a}>Agregar a mi horario esta semana</button></div>`;
    else return;
    openModal(`${mHead(tit)}${cuerpo}<div class="btns"><button class="btn" data-act="closeModal">Cerrar</button></div>`);
  },
  mihHacer(d){
    if(!isProf()) return;
    const aid=session.area, pid=session.profId, p=mihYo(), f=d.f, h=+d.h, k=`${f}_${pad(h)}`;
    if(!ctLibre(f,h)){ toast('Esa hora ya pasó'); return; }
    const oc=ghCtx(aid).occ[`${pid}|${f}|${h}`];
    if(d.o==='agregar'){ mihGuardarDia(aid,pid,f,ghHorasDia(p,f).concat(h)); toast('Agregada: recepción ya la ve disponible'); }
    else if(d.o==='quitar'){ if(oc&&!oc.bloqueo){ toast('Tienes un socio a esa hora'); return; } mihGuardarDia(aid,pid,f,ghHorasDia(p,f).filter(x=>x!==h)); toast('Quitada de tu horario esta semana'); }
    else if(d.o==='blq'){ if(oc&&!oc.bloqueo){ toast('Tienes un socio a esa hora'); return; } setPath(`data/${aid}/profesores/${pid}/blq/${k}`,d.m); toast('Bloqueada: recepción la ve ocupada'); }
    else if(d.o==='desbloq'){ setPath(`data/${aid}/profesores/${pid}/blq/${k}`,undefined); toast('Desbloqueada'); }
    closeModal(); render();
  },
  mihCopiar(){
    if(!isProf()) return;
    const aid=session.area, pid=session.profId, p=mihYo(), wk=mihSem(), sig=addDays(wk,7), occ=ghCtx(aid).occ; let resp=0;
    for(let d=0;d<7;d++){
      const fs=addDays(sig,d), nuevo=ghHorasDia(p,addDays(wk,d)).slice();
      ghHorasDia(p,fs).forEach(h=>{ const o=occ[`${pid}|${fs}|${h}`]; if(!nuevo.includes(h)&&o&&!o.bloqueo){ nuevo.push(h); resp++; } });   // no se quita una hora con socio
      mihGuardarDia(aid,pid,fs,nuevo);
    }
    ui.mihSem=sig; render(); toast(resp?`Copiado. Se respetaron ${plu(resp,'hora','horas')} donde ya tienes socio`:'Horario copiado a la semana siguiente');
  },
  mihFijo(){
    if(!isProf()) return;
    const aid=session.area, pid=session.profId, p=mihYo(), wk=mihSem(), base={};
    for(let d=0;d<7;d++) base['d'+d]=ghHorasDia(p,addDays(wk,d)).join(',');
    setPath(`data/${aid}/profesores/${pid}/horPtH`,base); render(); toast('Listo: este es tu horario fijo para las semanas que no cambies');
  }
});
