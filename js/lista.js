'use strict';
/* =====================================================================
   lista.js — pasar lista de una clase.
   Deslizar a la derecha = presente · a la izquierda = falta.
   Cada marca se guarda sola y actualiza el aforo de esa clase y fecha.
   ===================================================================== */
const lsRO = () => isRO() || esVinculada(curArea()) || !!(ui.lista&&fcId(ui.lista.gid));
function lsCtx(){
  const l=ui.lista; if(!l) return null;
  const aid=curArea(), g=getPath(`data/${aid}/grupos/${l.gid}`);
  return g?{aid,g,fecha:l.fecha}:null;
}
function lsState(aid,g,fecha){
  const rec=getPath(`data/${aid}/asistencia/${g.id}_${fecha}`)||null, roster=rosterOf(g);
  const pres=new Set(((rec&&rec.presentes)||[]).filter(n=>roster.includes(n)));
  const aus=new Set(((rec&&rec.ausentes)||[]).filter(n=>roster.includes(n)));
  const extras=rec?(roster.length?(rec.lista?(+rec.extras||0):0):(+rec.asistentes||0)):0;
  const notasAl=Object.fromEntries(((rec&&rec.notasAl)||[]).filter(x=>x&&roster.includes(x.n)&&x.t).map(x=>[x.n,x.t]));
  return {rec,roster,pres,aus,extras,notasAl,nota:rec?(rec.nota||''):'',omitida:!!(rec&&rec.omitida),manual:!!(rec&&!rec.lista&&!rec.omitida&&roster.length)};
}
function lsWrite(aid,g,fecha,s){
  const roster=s.roster, pres=roster.filter(n=>s.pres.has(n)), aus=roster.filter(n=>s.aus.has(n));
  const extras=Math.max(0,Math.round(+s.extras||0));
  const rec={id:`${g.id}_${fecha}`,grupoId:g.id,fecha,asistentes:s.omitida?0:pres.length+extras,presentes:pres,ausentes:aus,extras,
    lista:roster.length>0,nota:s.nota||'',notasAl:Object.entries(s.notasAl||{}).filter(([n,t])=>t&&roster.includes(n)).map(([n,t])=>({n,t})),porProf:isProf()?session.profId:'dir',actualizado:new Date().toISOString()};
  if(s.omitida) rec.omitida=true;
  setPath(`data/${aid}/asistencia/${rec.id}`,rec);
}
function lsApply(fn){                                   // lee, cambia, guarda y repinta sin redibujar
  const c=lsCtx(); if(!c||lsRO()) return;
  const s=lsState(c.aid,c.g,c.fecha);
  fn(s,c.g);
  if(s.omitida&&(s.pres.size||s.aus.size||s.extras)) s.omitida=false;
  lsWrite(c.aid,c.g,c.fecha,s); lsPaint();
}

/* ----- pantalla ----- */
function lsRow(name,st,ro){
  const m=st.pres.has(name)?'p':st.aus.has(name)?'f':'';
  return `<div class="ls-row" data-name="${esc(name)}" data-m="${m}">
    <div class="ls-bg"><span class="bp">✔ Presente</span><span class="bf">Falta ✖</span></div>
    <div class="ls-card">
      <span class="ls-av">${esc(iniciales(name))}</span>
      <div class="ls-n"><b>${esc(name)}</b><span class="ls-st">${m==='p'?'Presente':m==='f'?'Falta':'Sin marcar'}</span>${st.notasAl&&st.notasAl[name]?`<span class="ls-na">${esc(st.notasAl[name])}</span>`:''}</div>
      ${ro?'':`<button class="ls-btn f" data-act="lsMark" data-m="f" aria-label="Falta">✖</button><button class="ls-btn p" data-act="lsMark" data-m="p" aria-label="Presente">✔</button>`}
    </div></div>`;
}
function vLista(){
  if(typeof lrEs==='function'&&lrEs()) return vListaRapida();
  const c=lsCtx(); if(!c){ ui.lista=null; return ''; }
  const {aid,g,fecha}=c, s=lsState(aid,g,fecha), ro=lsRO(), cupo=+g.cupo||0, tot=s.pres.size+s.extras;
  const p=cupo>0?Math.round(tot/cupo*100):null, cls=aforoCls(p);
  return `
    <div class="card ls-head">
      <div class="ls-t"><b>${esc(g.nombre)}</b><span>${esc(horaTxt(g)||'')}</span></div>
      <div class="ls-sub">${esc([g.prof,g.lugar,fmtLarga(fecha)].filter(Boolean).join(' · '))}</div>
      ${s.roster.length?`<div class="ls-cnt">
        <div class="cp"><b id="ls_p">${s.pres.size}</b><span>Presentes</span></div>
        <div class="cf"><b id="ls_f">${s.aus.size}</b><span>Faltas</span></div>
        <div class="cn"><b id="ls_n">${Math.max(0,s.roster.length-s.pres.size-s.aus.size)}</b><span>Sin marcar</span></div>
      </div>`:''}
      <div class="ls-af"><div class="bar"><i id="ls_bar" class="${cls}" style="width:${Math.min(p||0,100)}%"></i></div><span id="ls_pct" class="af-pct ${cls}">${p==null?'—':p+'%'}</span></div>
      <div class="ls-tot" id="ls_tot">${tot} asistentes${cupo?` de ${cupo} de cupo`:''} · este número es el aforo de la clase</div>
    </div>
    ${s.manual?`<div class="empty" style="margin-top:10px">Ya hay una captura manual de ${+s.rec.asistentes||0} asistentes. Al marcar la lista se reemplaza.</div>`:''}
    ${s.omitida?`<div class="empty ls-off" id="ls_off">Esta clase está marcada como “no hubo clase”. Marca a alguien o pulsa “Reabrir clase”.</div>`:''}
    ${s.roster.length?`
      ${ro?'':`<div class="ls-hint">Desliza → presente · Desliza ← falta</div>
      <div class="btns ls-bulk"><button class="btn sm primary" data-act="listaModo">${ic('bolt')} Lista rápida</button><button class="btn sm" data-act="lsAll" data-m="p">Todos presentes</button><button class="btn sm" data-act="lsAll" data-m="f">Los demás, falta</button></div>`}
      <div class="ls-list">${s.roster.map(n=>lsRow(n,s,ro)).join('')}</div>`
      :empty(ro?'Este grupo no tiene lista de alumnos.':'Este grupo todavía no tiene lista de alumnos. La dirección puede agregarla en Grupos. Mientras tanto captura el número de asistentes aquí abajo.')}
    <div class="card" style="margin-top:12px">
      <div class="f" style="margin-bottom:0"><span class="lb">${s.roster.length?'Invitados o personas que no están en la lista':'Asistentes'}</span>
        ${ro?`<div class="mono">${s.extras}</div>`:`<div class="stepper"><button class="ibtn" data-act="lsExtra" data-n="-1" aria-label="Uno menos">−</button><input id="ls_extras" type="number" inputmode="numeric" min="0" value="${s.extras}" readonly><button class="ibtn" data-act="lsExtra" data-n="1" aria-label="Uno más">+</button></div>`}</div>
    </div>
    ${ro?(s.nota?`<div class="card" style="margin-top:12px"><div class="dl"><dt>Nota</dt><dd>${esc(s.nota)}</dd></div></div>`:''):`
    <label class="f" style="margin-top:12px"><span>Nota rápida (opcional)</span><input id="ls_nota" value="${esc(s.nota)}" placeholder="Ej. Llegó tarde el grupo, cambio de salón…"></label>
    <div class="btns"><button class="btn${s.omitida?' primary':''}" id="ls_omit" data-act="lsOmit">${s.omitida?'Reabrir clase':'No hubo clase'}</button><button class="btn primary" data-act="listaBack">Listo</button></div>`}`;
}
function lsPaint(){
  const c=lsCtx(); if(!c) return;
  const s=lsState(c.aid,c.g,c.fecha), cupo=+c.g.cupo||0, tot=s.omitida?0:s.pres.size+s.extras;
  const p=cupo>0?Math.round(tot/cupo*100):null, cls=aforoCls(p);
  document.querySelectorAll('.ls-row').forEach(r=>{
    const n=r.dataset.name, m=s.pres.has(n)?'p':s.aus.has(n)?'f':'';
    r.dataset.m=m; r.querySelector('.ls-st').textContent=m==='p'?'Presente':m==='f'?'Falta':'Sin marcar';
  });
  const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
  set('ls_p',s.pres.size); set('ls_f',s.aus.size); set('ls_n',Math.max(0,s.roster.length-s.pres.size-s.aus.size));
  set('ls_pct',p==null?'—':p+'%'); set('ls_tot',`${tot} asistentes${cupo?` de ${cupo} de cupo`:''} · este número es el aforo de la clase`);
  const bar=document.getElementById('ls_bar'); if(bar){ bar.className=cls; bar.style.width=Math.min(p||0,100)+'%'; }
  const pc=document.getElementById('ls_pct'); if(pc) pc.className='af-pct '+cls;
  const ex=document.getElementById('ls_extras'); if(ex) ex.value=s.extras;
  const om=document.getElementById('ls_omit'); if(om){ om.textContent=s.omitida?'Reabrir clase':'No hubo clase'; om.classList.toggle('primary',s.omitida); }
  const off=document.getElementById('ls_off'); if(off&&!s.omitida) off.remove();
}

Object.assign(actions,{
  openLista(d){
    const fecha=d.fecha||(isProf()?ui.pFecha:ui.afFecha)||todayStr();
    closeModal(); ui.lista={gid:d.gid,fecha}; render(); top0();
  },
  listaBack(){ ui.lista=null; render(); top0(); },
  lsMark(d,e){
    const row=e.target.closest('.ls-row'); if(!row) return;
    const name=row.dataset.name; let m=d.m; if(row.dataset.m===m) m='';
    lsApply(s=>{ s.pres.delete(name); s.aus.delete(name); if(m==='p') s.pres.add(name); else if(m==='f') s.aus.add(name); });
  },
  lsAll(d){
    lsApply(s=>{ s.roster.forEach(n=>{ if(!s.pres.has(n)&&!s.aus.has(n)) (d.m==='p'?s.pres:s.aus).add(n); }); });
    toast(d.m==='p'?'Todos presentes':'Los demás quedaron con falta');
  },
  lsExtra(d){ lsApply(s=>{ s.extras=Math.max(0,s.extras+(+d.n)); }); },
  lsOmit(){
    const c=lsCtx(); if(!c||lsRO()) return;
    const s=lsState(c.aid,c.g,c.fecha);
    if(s.omitida){ setPath(`data/${c.aid}/asistencia/${c.g.id}_${c.fecha}`,undefined); toast('Clase reabierta'); }
    else { s.pres.clear(); s.aus.clear(); s.extras=0; s.omitida=true; lsWrite(c.aid,c.g,c.fecha,s); toast('Marcada como “no hubo clase”'); }
    render();
  }
});
document.addEventListener('change',e=>{
  if(e.target.id==='ls_nota') lsApply(s=>{ s.nota=e.target.value.trim(); });
});

/* ----- deslizar: derecha = presente, izquierda = falta ----- */
let lsSw=null;
const LS_UMBRAL=80;
document.addEventListener('pointerdown',e=>{
  const card=e.target.closest&&e.target.closest('.ls-card');
  if(!card||e.target.closest('button')||lsRO()||!ui.lista) return;
  lsSw={card,row:card.parentElement,x:e.clientX,y:e.clientY,dx:0,drag:false,id:e.pointerId};
});
document.addEventListener('pointermove',e=>{
  if(!lsSw) return;
  const dx=e.clientX-lsSw.x, dy=e.clientY-lsSw.y;
  if(!lsSw.drag){
    if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)*1.4){ lsSw.drag=true; lsSw.card.classList.remove('snap'); try{ lsSw.card.setPointerCapture(lsSw.id); }catch(_){} }
    else if(Math.abs(dy)>10){ lsSw=null; return; }
  }
  if(lsSw.drag){
    lsSw.dx=dx; lsSw.card.style.transform=`translateX(${dx}px)`;
    lsSw.row.dataset.sw=dx>0?'p':'f'; lsSw.row.style.setProperty('--sw',Math.min(1,Math.abs(dx)/LS_UMBRAL));
  }
});
function lsSwEnd(){
  if(!lsSw) return;
  const {card,row,dx,drag}=lsSw; lsSw=null;
  if(!drag) return;
  card.classList.add('snap'); card.style.transform=''; delete row.dataset.sw; row.style.removeProperty('--sw');
  if(Math.abs(dx)>=LS_UMBRAL){
    const name=row.dataset.name, m=dx>0?'p':'f';
    lsApply(s=>{ s.pres.delete(name); s.aus.delete(name); if(m==='p') s.pres.add(name); else s.aus.add(name); });
    if(navigator.vibrate) try{ navigator.vibrate(12); }catch(_){}
  }
}
document.addEventListener('pointerup',lsSwEnd);
document.addEventListener('pointercancel',lsSwEnd);
