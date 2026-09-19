'use strict';
/* =====================================================================
   calendario.js — calendario mensual y semanal: grupos del día + eventos
   ===================================================================== */
function monthGrid(ref){
  const d=parseYmd(ref), y=d.getFullYear(), m=d.getMonth();
  const first=new Date(y,m,1), start=new Date(y,m,1-((first.getDay()+6)%7));
  const cells=[];
  for(let i=0;i<42;i++){ const c=new Date(start); c.setDate(start.getDate()+i); cells.push({s:ymd(c),out:c.getMonth()!==m,n:c.getDate()}); }
  if(cells.slice(35).every(c=>c.out)) cells.length=35;
  return cells;
}
function agenda(aid,d){
  const items=dayItems(aid,d);
  if(!items.length) return empty('Sin grupos ni eventos este día.');
  const recs=Object.fromEntries(coll(aid,'asistencia').filter(r=>r.fecha===d).map(r=>[r.grupoId,r]));
  return items.map(it=>{
    if(it.t==='e'){ const e=it.e; return `<button class="line ev" data-act="openEvento" data-id="${e.id}"><div class="t">${esc(e.hora||'Evento')}</div><div class="b"><b>${esc(e.nombre)}</b><small>${esc([e.tipo,e.lugar].filter(Boolean).join(' · '))}</small></div><div class="r">${pill(e.estado||'planificado',EST_EV_CLS[e.estado]||'info')}</div></button>`; }
    const g=it.g, info=regInfo(recs[g.id],g);
    return `<button class="line" style="--ac:${areaColor(aid)}" data-act="grupoDetail" data-id="${g.id}"><div class="t">${esc(horaTxt(g)||'—')}</div><div class="b"><b>${esc(g.nombre)}</b><small>${esc([g.prof,g.lugar].filter(Boolean).join(' · '))}</small></div><div class="r">${recs[g.id]?`<span class="${info.cls}">${esc(info.txt)}</span>`:''}</div></button>`;
  }).join('');
}
function vCalendario(aid){
  const today=todayStr(), ref=parseYmd(ui.calRef);
  let head, body;
  if(ui.calMode==='mes'){
    head=`${MESES[ref.getMonth()]} ${ref.getFullYear()}`;
    const evDays=new Set(coll(aid,'eventos').map(e=>e.fecha));
    const gs=grupos(aid);
    body=`<div class="calbox"><div class="cal">${DIAS.map(d=>`<div class="dh">${d}</div>`).join('')}${monthGrid(ui.calRef).map(c=>{
      const n=gs.filter(g=>diasArr(g).includes(wdIdx(c.s))).length;
      return `<button class="cd${c.out?' out':''}${c.s===today?' today':''}${c.s===ui.calSel?' sel':''}" data-act="calSel" data-d="${c.s}"><span class="n">${c.n}</span><span class="k">${n?n+' gpo':''}</span>${evDays.has(c.s)?'<i class="evd"></i>':''}</button>`;
    }).join('')}</div></div>
    <div class="h2 sm">${esc(fmtLarga(ui.calSel))}${isRO()?'':` <button class="btn sm" data-act="openEvento" data-fecha="${ui.calSel}">+ Evento</button>`}</div>
    ${agenda(aid,ui.calSel)}`;
  } else {
    const mon=mondayOf(ui.calRef);
    head=`${fmtCorta(mon)} – ${fmtCorta(addDays(mon,6))}`;
    body=[0,1,2,3,4,5,6].map(i=>{ const d=addDays(mon,i); return `<div class="h2 sm${d===today?' hoy':''}">${esc(fmtLarga(d))}</div>${agenda(aid,d)}`; }).join('');
  }
  return `
    <div class="h2">Calendario
      <div class="seg"><button data-act="calMode" data-m="mes" class="${ui.calMode==='mes'?'on':''}">Mes</button><button data-act="calMode" data-m="semana" class="${ui.calMode==='semana'?'on':''}">Semana</button></div></div>
    ${agendaSwitch()}
    <div class="calnav"><button class="ibtn" data-act="calNav" data-n="-1" aria-label="Anterior">${ic('back')}</button><b>${esc(head)}</b><button class="ibtn" data-act="calNav" data-n="1" aria-label="Siguiente">${ic('next')}</button><button class="btn sm" data-act="calToday">Hoy</button></div>
    ${body}`;
}

Object.assign(actions,{
  calMode(d){ ui.calMode=d.m; render(); },
  calNav(d){
    const n=+d.n;
    if(ui.calMode==='mes'){
      const r=parseYmd(ui.calRef), f=new Date(r.getFullYear(),r.getMonth()+n,1), now=new Date();
      ui.calRef=ymd(f); ui.calSel=(f.getFullYear()===now.getFullYear()&&f.getMonth()===now.getMonth())?todayStr():ymd(f);
    } else ui.calRef=addDays(ui.calRef,7*n);
    render();
  },
  calToday(){ ui.calRef=todayStr(); ui.calSel=todayStr(); render(); },
  calSel(d){ ui.calSel=d.d; if(parseYmd(d.d).getMonth()!==parseYmd(ui.calRef).getMonth()) ui.calRef=d.d; render(); }
});
