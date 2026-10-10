'use strict';
/* =====================================================================
   carrusel.js — tarjetas de indicadores en carrusel (Resumen de Gerencia).
   · Una sola fila que se desliza sola hacia la derecha cada pocos segundos
     y vuelve al inicio al llegar al final.
   · Flechas para pasar a la anterior o a la siguiente a su propio ritmo,
     puntos para ir a una tarjeta y deslizar con el dedo.
   · Se detiene al tocarlo o al pasar el cursor, y retoma unos segundos
     después. No se mueve solo si la pantalla está oculta, si hay una
     ventana abierta o si el equipo pide reducir animaciones.
   · La tarjeta en la que estás se conserva aunque la pantalla se actualice.
   ===================================================================== */
ui.car = ui.car || {i:0,pausa:0};
const CAR_MS = 3500, CAR_PAUSA = 9000, CAR_AUTO = false;            // sin avance automático: se lee mejor (flechas y dedo siguen)
let carHover = false;
const carReducido = () => !!(typeof window!=='undefined'&&window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const carHTML = (id,tarjetas) => `<div class="car" data-car="${esc(id)}">
  <div class="car-track" tabindex="0" role="region" aria-label="Indicadores principales">${tarjetas}</div>
  <div class="car-foot"><button class="car-nav prev" data-act="carPrev" aria-label="Tarjeta anterior">${ic('back')}</button><div class="car-dots"></div><button class="car-nav next" data-act="carNext" aria-label="Tarjeta siguiente">${ic('next')}</button></div></div>`;
function carDatos(tr){                                  // cuántas posiciones tiene y cuánto mide cada paso
  const k=tr.children; if(!k.length) return null;
  const gap=parseFloat(getComputedStyle(tr).columnGap)||0, paso=k[0].getBoundingClientRect().width+gap;
  if(!(paso>0)) return null;
  return {n:k.length,paso,max:Math.max(0,Math.round((tr.scrollWidth-tr.clientWidth)/paso))};
}
function carPuntos(tr){                                 // pinta los puntos y recuerda en qué tarjeta va
  const d=carDatos(tr), cont=tr.parentNode.querySelector('.car-dots'); if(!d||!cont) return;
  const cur=Math.min(d.max,Math.round(tr.scrollLeft/d.paso));
  if(cont.children.length!==d.max+1) cont.innerHTML=Array.from({length:d.max+1},(_,k)=>`<button data-act="carPunto" data-i="${k}" aria-label="Ir a la tarjeta ${k+1}"></button>`).join('');
  [...cont.children].forEach((b,k)=>b.classList.toggle('on',k===cur));
  ui.car.i=cur;
}
function carIr(tr,i,suave){
  const d=carDatos(tr); if(!d) return;
  i=Math.max(0,Math.min(d.max,i));
  if(suave===false){ tr.style.scrollBehavior='auto'; tr.scrollLeft=i*d.paso; tr.style.scrollBehavior=''; carPuntos(tr); }
  else tr.scrollTo({left:i*d.paso,behavior:'smooth'});
  ui.car.i=i;
}
const carPausa = () => { ui.car.pausa=Date.now()+CAR_PAUSA; };
function carMueve(dir){                                 // dir: +1 siguiente, −1 anterior; da la vuelta en los extremos
  const tr=document.querySelector('.car-track'); if(!tr) return;
  const d=carDatos(tr); if(!d||!d.max) return;
  const cur=Math.round(tr.scrollLeft/d.paso);
  carIr(tr,dir>0?(cur>=d.max?0:cur+1):(cur<=0?d.max:cur-1));
}
function carInit(){                                     // después de cada pintado: vuelve a la tarjeta en la que estaba
  const tr=document.querySelector('.car-track'); if(!tr) return;
  carIr(tr,ui.car.i||0,false);
}
Object.assign(actions,{
  carPrev(){ carPausa(); carMueve(-1); },
  carNext(){ carPausa(); carMueve(1); },
  carPunto(d){ carPausa(); const tr=document.querySelector('.car-track'); if(tr) carIr(tr,+d.i); }
});
if(typeof document!=='undefined'){
  document.addEventListener('scroll',e=>{ const t=e.target; if(t&&t.classList&&t.classList.contains('car-track')) carPuntos(t); },true);
  ['pointerdown','touchstart','wheel','keydown'].forEach(ev=>document.addEventListener(ev,e=>{ if(e.target.closest&&e.target.closest('.car')) carPausa(); },{passive:true,capture:true}));
  document.addEventListener('mouseover',e=>{ carHover=!!(e.target.closest&&e.target.closest('.car')); });
  window.addEventListener('resize',()=>{ const tr=document.querySelector('.car-track'); if(tr) carPuntos(tr); });
  setInterval(()=>{
    if(!CAR_AUTO||document.hidden||carHover||carReducido()||Date.now()<ui.car.pausa) return;
    const m=document.getElementById('modal'); if((m&&!m.hidden)||document.getElementById('confirmDlg')) return;
    carMueve(1);
  },CAR_MS);
}
