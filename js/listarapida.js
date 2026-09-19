'use strict';
/* =====================================================================
   listarapida.js — "Lista rápida": pasar lista con una tarjeta por alumno.
   · Aparece el nombre del alumno y solo se desliza:
       → derecha = presente   ← izquierda = ausente   (igual que la lista completa)
   · También hay botones grandes, una nota rápida por alumno y un botón para volver
     al alumno anterior. Cada marca se guarda sola.
   · Al terminar la lista del grupo sale un resumen (con invitados) y se cierra.
   · Es opcional: la lista completa sigue existiendo y se puede cambiar de una a otra.
   Usa los mismos datos que la lista completa (lista.js): el aforo de la clase se
   actualiza igual.
   ===================================================================== */
const LR_UMBRAL = 90;
const lrEs = () => !!(ui.lista&&ui.lista.modo==='rapida');
const lrPrimero = s => { const i=s.roster.findIndex(n=>!s.pres.has(n)&&!s.aus.has(n)); return i<0?s.roster.length:i; };
const lrNombreActual = () => { const c=lsCtx(); if(!c) return null; const s=lsState(c.aid,c.g,c.fecha); return s.roster[ui.lista.i]||null; };
const lrNotaDe = (s,n) => { const pend=(ui.lista.nt||{})[n]; return pend!=null?pend:(s.notasAl[n]||''); };

function lrCabecera(g,s,i,N){
  const marc=s.pres.size+s.aus.size, p=N?Math.round(marc/N*100):0;
  return `<div class="lr-head">
    <div class="lr-t"><b>${esc(g.nombre)}</b><span>${esc(horaTxt(g)||'')}</span></div>
    <div class="lr-prog"><span>${i<N?`Alumno ${i+1} de ${N}`:'Lista terminada'}</span>
      <span class="lr-c"><i class="p">✔ ${s.pres.size}</i><i class="f">✖ ${s.aus.size}</i><i class="n">${Math.max(0,N-marc)} sin marcar</i></span></div>
    <div class="bar lr-bar"><i class="ok" style="width:${p}%"></i></div></div>`;
}
function lrPuntos(s,i){
  return `<div class="lr-dots" role="list">${s.roster.map((n,k)=>{
    const m=s.pres.has(n)?'p':s.aus.has(n)?'f':'n';
    return `<button class="lr-dot m-${m}${k===i?' cur':''}" data-act="lrIr" data-i="${k}" aria-label="${esc(n)}: ${m==='p'?'presente':m==='f'?'ausente':'sin marcar'}"></button>`; }).join('')}</div>`;
}
function lrTarjeta(s,i,ro){
  const n=s.roster[i], m=s.pres.has(n)?'p':s.aus.has(n)?'f':'';
  return `<div class="lr-stage"><div class="lr-card" data-name="${esc(n)}" data-m="${m}">
      <span class="lr-tag p">✔ PRESENTE</span><span class="lr-tag f">AUSENTE ✖</span>
      <span class="lr-av">${esc(iniciales(n))}</span>
      <h2 class="lr-nombre">${esc(n)}</h2>
      <div class="lr-est ${m}">${m==='p'?'Presente':m==='f'?'Ausente':'Sin marcar'}</div>
      <label class="lr-nota"><span>Nota rápida (opcional)</span><input id="lr_nota" value="${esc(lrNotaDe(s,n))}" placeholder="Ej. Llegó tarde, lesión leve…" autocomplete="off"></label>
    </div></div>
    <div class="lr-hint">Desliza → presente · Desliza ← ausente</div>
    <div class="lr-btns"><button class="lr-b f" data-act="lrMark" data-m="f"><b>✖</b> Ausente</button><button class="lr-b p" data-act="lrMark" data-m="p"><b>✔</b> Presente</button></div>
    <div class="lr-nav"><button class="btn sm" data-act="lrIr" data-n="-1"${i===0?' disabled':''}>‹ Anterior</button><button class="btn sm" data-act="lrIr" data-n="1">Saltar ›</button><button class="btn sm" data-act="listaModo">Lista completa</button></div>`;
}
function lrFin(g,s,N){
  const cupo=+g.cupo||0, tot=s.pres.size+s.extras, p=cupo>0?Math.round(tot/cupo*100):null, sin=s.roster.filter(n=>!s.pres.has(n)&&!s.aus.has(n));
  return `<div class="card lr-fin">
      <div class="lr-ok">${sin.length?'!':'✔'}</div>
      <h2>${sin.length?'Faltan alumnos por marcar':'Lista completa'}</h2>
      <div class="lr-res"><div class="cp"><b>${s.pres.size}</b><span>Presentes</span></div><div class="cf"><b>${s.aus.size}</b><span>Ausentes</span></div><div class="cn"><b>${sin.length}</b><span>Sin marcar</span></div></div>
      ${sin.length?`<div class="lr-sin">${sin.map(n=>`<button class="chip" data-act="lrIr" data-i="${s.roster.indexOf(n)}">${esc(n)}</button>`).join('')}</div>`:''}
      <div class="f" style="margin:14px 0 0"><span class="lb">Invitados o personas que no están en la lista</span>
        <div class="stepper"><button class="ibtn" data-act="lrExtra" data-n="-1" aria-label="Uno menos">−</button><input type="number" value="${s.extras}" readonly><button class="ibtn" data-act="lrExtra" data-n="1" aria-label="Uno más">+</button></div></div>
      <div class="lr-tot"><b class="${aforoCls(p)}">${tot}</b> asistentes${cupo?` de ${cupo} de cupo · <b class="${aforoCls(p)}">${p}%</b>`:''}<br><small>Este número es el aforo de la clase.</small></div>
      <div class="btns"><button class="btn" data-act="lrIr" data-i="0">Revisar desde el inicio</button><button class="btn primary" data-act="listaBack">Terminar</button></div>
    </div>`;
}
function lrInner(aid,g,fecha,s,i,ro){
  const N=s.roster.length;
  return `${lrCabecera(g,s,i,N)}${i<N?lrTarjeta(s,i,ro):lrFin(g,s,N)}${lrPuntos(s,i)}`;
}
function vListaRapida(){
  const c=lsCtx(); if(!c){ ui.lista=null; return ''; }
  const {aid,g,fecha}=c, s=lsState(aid,g,fecha), ro=lsRO(), N=s.roster.length;
  if(!N||ro) return `<div class="card ls-head"><div class="ls-t"><b>${esc(g.nombre)}</b><span>${esc(horaTxt(g)||'')}</span></div></div>${empty(ro?'Esta lista es de solo lectura.':'Este grupo todavía no tiene lista de alumnos. La dirección puede agregarla en Grupos.')}<div class="btns"><button class="btn primary" data-act="listaBack">Volver</button>${N?'':'<button class="btn" data-act="listaModo">Capturar el número</button>'}</div>`;
  ui.lista.nt=ui.lista.nt||{};
  ui.lista.i=Math.min(Math.max(0,ui.lista.i==null?lrPrimero(s):ui.lista.i),N);
  return `<div class="lr" id="lr">${lrInner(aid,g,fecha,s,ui.lista.i,ro)}</div>`;
}
function lrPintar(){
  const c=lsCtx(), el=document.getElementById('lr'); if(!c||!el) return;
  const s=lsState(c.aid,c.g,c.fecha); ui.lista.i=Math.min(Math.max(0,ui.lista.i),s.roster.length);
  el.innerHTML=lrInner(c.aid,c.g,c.fecha,s,ui.lista.i,lsRO());
  const card=el.querySelector('.lr-card'); if(card){ card.classList.add('entra'); }
}
function lrMarcar(m,dx){
  const nombre=lrNombreActual(); if(!nombre||lsRO()) return;
  const card=document.querySelector('.lr-card');
  const listo=()=>{
    lsApply(s=>{ s.pres.delete(nombre); s.aus.delete(nombre); (m==='p'?s.pres:s.aus).add(nombre);
      Object.entries(ui.lista.nt||{}).forEach(([n,t])=>{ if(t) s.notasAl[n]=t; else delete s.notasAl[n]; }); ui.lista.nt={}; });
    ui.lista.i++; lrPintar();
  };
  if(navigator.vibrate) try{ navigator.vibrate(14); }catch(_){}
  if(card){ const dir=m==='p'?1:-1; card.style.transition='transform .22s ease,opacity .22s'; card.style.transform=`translateX(${dir*130}%) rotate(${dir*16}deg)`; card.style.opacity='0'; setTimeout(listo,190); }
  else listo();
}

Object.assign(actions,{
  openListaRapida(d){
    const fecha=d.fecha||(isProf()?ui.pFecha:ui.afFecha)||todayStr();
    closeModal(); ui.lista={gid:d.gid,fecha,modo:'rapida',i:null,nt:{}}; render(); top0();
  },
  listaModo(){ if(!ui.lista) return; ui.lista={gid:ui.lista.gid,fecha:ui.lista.fecha,modo:lrEs()?undefined:'rapida',i:null,nt:{}}; render(); top0(); },
  lrMark(d){ lrMarcar(d.m); },
  lrIr(d){
    const c=lsCtx(); if(!c) return; const N=rosterOf(c.g).length;
    ui.lista.i=d.i!=null?+d.i:ui.lista.i+(+d.n); ui.lista.i=Math.min(Math.max(0,ui.lista.i),N); lrPintar();
  },
  lrExtra(d){ lsApply(s=>{ s.extras=Math.max(0,s.extras+(+d.n)); }); lrPintar(); }
});

/* nota rápida: se guarda con la marca; si el alumno ya está marcado, se guarda al momento */
let lrTimer=null;
document.addEventListener('input',e=>{
  if(e.target.id!=='lr_nota'||!lrEs()) return;
  const n=lrNombreActual(); if(!n) return;
  const t=e.target.value.trim(); (ui.lista.nt=ui.lista.nt||{})[n]=t;
  clearTimeout(lrTimer);
  lrTimer=setTimeout(()=>{
    const c=lsCtx(); if(!c||lsRO()) return; const s=lsState(c.aid,c.g,c.fecha);
    if(s.pres.has(n)||s.aus.has(n)){ lsApply(x=>{ if(t) x.notasAl[n]=t; else delete x.notasAl[n]; }); if(ui.lista.nt) delete ui.lista.nt[n]; }
  },500);
});

/* deslizar la tarjeta: derecha = presente, izquierda = ausente */
let lrSw=null;
document.addEventListener('pointerdown',e=>{
  const card=e.target.closest&&e.target.closest('.lr-card');
  if(!card||!lrEs()||e.target.closest('input,button,label')||lsRO()) return;
  lrSw={card,x:e.clientX,y:e.clientY,dx:0,drag:false,id:e.pointerId};
});
document.addEventListener('pointermove',e=>{
  if(!lrSw) return;
  const dx=e.clientX-lrSw.x, dy=e.clientY-lrSw.y;
  if(!lrSw.drag){
    if(Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)*1.2){ lrSw.drag=true; lrSw.card.style.transition='none'; try{ lrSw.card.setPointerCapture(lrSw.id); }catch(_){} }
    else if(Math.abs(dy)>10){ lrSw=null; return; }
  }
  if(lrSw.drag){
    lrSw.dx=dx; lrSw.card.style.transform=`translateX(${dx}px) rotate(${dx/16}deg)`;
    lrSw.card.dataset.sw=dx>0?'p':'f'; lrSw.card.style.setProperty('--sw',Math.min(1,Math.abs(dx)/LR_UMBRAL));
  }
});
function lrSwFin(){
  if(!lrSw) return; const {card,dx,drag}=lrSw; lrSw=null; if(!drag) return;
  if(Math.abs(dx)>=LR_UMBRAL){ lrMarcar(dx>0?'p':'f'); return; }
  card.style.transition='transform .2s ease'; card.style.transform=''; delete card.dataset.sw; card.style.removeProperty('--sw');
}
document.addEventListener('pointerup',lrSwFin);
document.addEventListener('pointercancel',lrSwFin);

/* teclado (computadora): → presente, ← ausente, retroceso = alumno anterior */
document.addEventListener('keydown',e=>{
  if(!lrEs()||/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement||{}).tagName||'')||$('#modal')&&!$('#modal').hidden) return;
  if(e.key==='ArrowRight'){ e.preventDefault(); lrMarcar('p'); }
  else if(e.key==='ArrowLeft'){ e.preventDefault(); lrMarcar('f'); }
  else if(e.key==='Backspace'||e.key==='ArrowUp'){ e.preventDefault(); actions.lrIr({n:-1}); }
});
