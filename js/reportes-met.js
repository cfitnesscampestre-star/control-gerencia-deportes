'use strict';
/* =====================================================================
   reportes-met.js — reportes formales que pide Metodología deportiva.
   El metodólogo elige el reporte y la fecha, y el sistema lo arma solo
   con lo que ya está capturado (eventos, informes de las direcciones y
   la ficha de formación de cada entrenador). Se ve en pantalla y se
   imprime en hoja carta horizontal con el formato del club.
     1) Resumen anual de eventos realizados: por deporte, eventos
        planificados contra realizados, participantes del club y foráneos
        (M, F, T), eventos nacionales e internacionales e impacto social.
     2) Formato de la fuerza técnica: por deporte, cada entrenador con su
        nivel escolar (licenciatura, maestría, otras carreras,
        certificaciones) y su experiencia laboral.
   Datos propios:
     met/plan/<año>/<área>    → eventos planificados del año (opcional)
     met/formacion/<profId>   → ficha de formación del entrenador
   ===================================================================== */
const FM_CODIGO = {codigo:'PA-PPS-DEP-R11', revision:'00', fecha:'--', retener:'Al cambio'};   // código del formato de la fuerza técnica
const FM_CLUB = 'CLUB CAMPESTRE DE AGUASCALIENTES A.C';
ui.rp = ui.rp || {rep:null, anio:String(new Date().getFullYear()), desde:'', hasta:'', area:'all'};
const rpNum = n => (+n||0);

/* ---------- ficha de formación del entrenador ---------- */
const getFz = pid => ((state.met&&state.met.formacion)||{})[pid]||null;
const fzCompleta = f => !!f && !!(f.lic||f.maes||f.otras||f.cert||f.desde||f.nada);
const fzAnios = f => { const d=parseInt(f&&f.desde,10); return (d>1950&&d<=new Date().getFullYear())?new Date().getFullYear()-d:null; };
const esDeporteArea = aid => !esServ(aid);
function fzLista(aid){ return profesores(aid).filter(p=>p.activo!==false&&!p.sim); }
function fzLinea(aid){                         // aviso para la dirección en su lista de profesores
  if(!session||session.rol!=='dir'||esServ(aid)) return '';
  const ps=fzLista(aid); if(!ps.length) return '';
  const ok=ps.filter(p=>fzCompleta(getFz(p.id))).length;
  return `<div class="fz-linea ${ok===ps.length?'ok':''}">${ic('clip')}<span>Formación y experiencia capturadas: <b>${ok} de ${ps.length}</b>. Se pide para el formato de la fuerza técnica de Metodología. Abre cada profesor para completarla.</span></div>`;
}
function fzBanner(){                           // el profesor completa su ficha una sola vez
  if(!session||session.rol!=='prof'||esServ(session.area)||ui.rufier||ui.fzOculto) return '';
  if(fzCompleta(getFz(session.profId))) return '';
  return `<div class="mt-aviso"><div><b>Completa tu formación y experiencia</b><small>Una sola vez: estudios, certificaciones y desde cuándo das clases. Metodología la usa para sus reportes y ya no tendrás que entregarla aparte.</small></div>
    <button class="btn primary" data-act="fzAbrir" data-aid="${esc(session.area)}" data-id="${esc(session.profId)}">Completar</button></div>`;
}
function fzBtn(aid,pid){                       // botón dentro de la ficha del profesor (dirección)
  if(!session||session.rol!=='dir'||esServ(aid)||!pid) return '';
  const f=getFz(pid);
  return `<div class="btns"><button class="btn${fzCompleta(f)?'':' primary'}" data-act="fzAbrir" data-aid="${esc(aid)}" data-id="${esc(pid)}">${fzCompleta(f)?'Formación y experiencia':'Capturar formación y experiencia'}</button></div>`;
}
function openFormacion(aid,pid){
  const p=getProf(aid,pid)||{}, f=getFz(pid)||{}, anio=new Date().getFullYear();
  openModal(`${mHead('Formación y experiencia')}
    <div class="sub"><b>${esc(p.nombre||'Entrenador')}</b> · ${esc((getArea(aid)||{}).nombre||'')}</div>
    <div class="sub">Se captura una sola vez. Los años de experiencia se actualizan solos cada año.</div>
    <label class="f"><span>Licenciatura (carrera)</span><input id="fz_lic" value="${esc(f.lic||'')}" placeholder="Ej. Cultura física y deporte" autocomplete="off"></label>
    <label class="f"><span>Maestría</span><input id="fz_maes" value="${esc(f.maes||'')}" placeholder="Ej. Alto rendimiento deportivo" autocomplete="off"></label>
    <label class="f"><span>Otras carreras</span><input id="fz_otras" value="${esc(f.otras||'')}" placeholder="Ej. Técnico en entrenamiento" autocomplete="off"></label>
    <label class="f"><span>Certificaciones en deportes</span><input id="fz_cert" value="${esc(f.cert||'')}" placeholder="Ej. ITF nivel 1, NSCA-CPT (separa con comas)" autocomplete="off"></label>
    <label class="f"><span>Año en que empezó a trabajar como entrenador</span><input id="fz_desde" type="number" inputmode="numeric" min="1950" max="${anio}" value="${esc(f.desde||'')}" placeholder="Ej. 2012"><small class="mut">Años de experiencia: <b id="fz_anios">${fzAnios(f)==null?'—':fzAnios(f)}</b></small></label>
    <label class="fz-nada"><input type="checkbox" id="fz_nada"${f.nada?' checked':''}> No tiene estudios ni certificaciones que reportar (dejar en blanco a propósito)</label>
    <div class="btns"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="fzGuardar" data-aid="${esc(aid)}" data-id="${esc(pid)}">Guardar</button></div>`);
}
document.addEventListener('input',e=>{ if(e.target.id==='fz_desde'){ const a=fzAnios({desde:e.target.value}), s=$('#fz_anios'); if(s) s.textContent=a==null?'—':a; } });

/* ---------- datos del resumen anual ---------- */
function rpAnio(){ return rpNum(ui.rp.anio)||new Date().getFullYear(); }
function rpRango(){
  const y=rpAnio(), r=ui.rp;
  const desde=r.desde||`${y}-01-01`, hasta=r.hasta||`${y}-12-31`;
  return desde<=hasta?{desde,hasta}:{desde:hasta,hasta:desde};
}
const rpAnioCompleto = r => r.desde===`${r.desde.slice(0,4)}-01-01` && r.hasta===`${r.desde.slice(0,4)}-12-31`;
const planDe = (anio,aid) => { const v=(((state.met&&state.met.plan)||{})[anio]||{})[aid]; return v==null||v===''?null:rpNum(v); };
function anualDatos(r){
  const anio=r.desde.slice(0,4), rows=[], tot={plan:0,real:0,cm:0,cf:0,fm:0,ff:0,nac:0,int:0};
  let sinInforme=0, planAuto=0;
  areasList().filter(a=>esDeporteArea(a.id)).sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre),'es')).forEach(a=>{
    const evs=coll(a.id,'eventos').filter(e=>e.fecha>=r.desde&&e.fecha<=r.hasta);
    const agend=evs.filter(e=>e.estado!=='cancelado'), reales=evs.filter(e=>e.estado==='realizado');
    const pm=rpAnioCompleto(r)?planDe(anio,a.id):null, plan=pm!=null?pm:agend.length; if(pm==null&&agend.length) planAuto++;
    const row={a,plan,planManual:pm!=null,real:reales.length,cm:0,cf:0,fm:0,ff:0,nac:0,int:0,impacto:[]};
    reales.forEach(e=>{
      const I=getInforme(a.id,e.id); if(!I){ sinInforme++; return; }
      const T=infTot(I); row.cm+=T.cm; row.cf+=T.cf; row.fm+=T.fm; row.ff+=T.ff;
      if(I.alcance==='nacional') row.nac++; else if(I.alcance==='internacional') row.int++;
      if(String(I.impacto||'').trim()) row.impacto.push(String(I.impacto).trim());
    });
    ['plan','real','cm','cf','fm','ff','nac','int'].forEach(k=>tot[k]+=row[k]);
    rows.push(row);
  });
  return {rows,tot,sinInforme,planAuto,anio};
}
function anualTabla(D,o){
  o=o||{}; const z=v=>v?v:'', T=D.tot;
  const fila=(x,i)=>{
    const pc=x.plan?Math.round(x.real/x.plan*100)+'%':'', imp=x.impacto.join('; '), impc=imp.length>90?imp.slice(0,88)+'…':imp;
    return `<tr><td class="c">${i+1}</td><td class="l">${esc(x.a.nombre)}</td><td class="c">${x.plan||''}${x.planManual?'':(x.plan&&o.pantalla?'<sup>*</sup>':'')}</td><td class="c">${(x.plan||x.real)?x.real:''}</td><td class="c">${pc}</td>
      <td class="c">${z(x.cm)}</td><td class="c">${z(x.cf)}</td><td class="c b">${z(x.cm+x.cf)}</td><td class="c">${z(x.fm)}</td><td class="c">${z(x.ff)}</td><td class="c b">${z(x.fm+x.ff)}</td>
      <td class="c">${z(x.nac)}</td><td class="c">${z(x.int)}</td><td class="c b">${z(x.nac+x.int)}</td><td class="l s" title="${esc(imp)}">${esc(impc)}</td></tr>`;
  };
  const pct=T.plan?Math.round(T.real/T.plan*100)+'%':'';
  return `<table class="fm-t"><thead>
    <tr><th rowspan="2" class="c">#</th><th rowspan="2">DEPORTES</th><th colspan="3">EVENTOS</th><th colspan="3">PART. DEL CLUB</th><th colspan="3">PART. FORÁNEOS</th><th colspan="3">TIPOS DE EVENTOS<br><span class="sm">Nacional · Internacional</span></th><th rowspan="2">IMPACTO SOCIAL</th></tr>
    <tr><th>PLAN</th><th>REAL</th><th>%</th><th>M</th><th>F</th><th>T</th><th>M</th><th>F</th><th>T</th><th>NACIO-<br>NAL</th><th>INTER-<br>NAC.</th><th>T</th></tr></thead>
    <tbody>${D.rows.map(fila).join('')}
    <tr class="tot"><td></td><td class="l">TOTAL</td><td class="c">${T.plan}</td><td class="c">${T.real}</td><td class="c">${pct}</td><td class="c">${T.cm}</td><td class="c">${T.cf}</td><td class="c">${T.cm+T.cf}</td><td class="c">${T.fm}</td><td class="c">${T.ff}</td><td class="c">${T.fm+T.ff}</td><td class="c">${T.nac}</td><td class="c">${T.int}</td><td class="c">${T.nac+T.int}</td><td></td></tr></tbody></table>`;
}
const anualTitulo = r => rpAnioCompleto(r) ? `RESUMEN DE EVENTOS REALIZADOS CLUB CAMPESTRE ${r.desde.slice(0,4)}` : `RESUMEN DE EVENTOS REALIZADOS CLUB CAMPESTRE · ${fmtCorta(r.desde)} ${r.desde.slice(0,4)} al ${fmtCorta(r.hasta)} ${r.hasta.slice(0,4)}`;
function anualNotas(D,r){
  const n=[];
  n.push(`<b>PLAN</b> son los eventos planificados del año${rpAnioCompleto(r)?' (el plan anual que captura Metodología; donde no se ha capturado, se cuentan los eventos agendados en el sistema, marcados con *)':' (eventos agendados en el sistema en el período)'}. <b>REAL</b> son los eventos marcados como realizados.`);
  n.push(`Los participantes, el alcance (nacional o internacional) y el impacto social salen de los <b>informes que entrega cada dirección</b> al terminar el evento.`);
  if(D.sinInforme) n.push(`<b>${plu(D.sinInforme,'evento realizado todavía no tiene','eventos realizados todavía no tienen')} informe</b> de su dirección; sus participantes no suman en este resumen.`);
  return n;
}

/* ---------- datos de la fuerza técnica ---------- */
function fuerzaDatos(areaSel){
  const grupos=[];
  areasList().filter(a=>esDeporteArea(a.id)&&(areaSel==='all'||a.id===areaSel)).sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre),'es')).forEach(a=>{
    const ps=fzLista(a.id); if(!ps.length) return;
    grupos.push({a,filas:ps.map(p=>({p,f:getFz(p.id)}))});
  });
  grupos.forEach(g=>{ const ys=g.filas.map(x=>fzAnios(x.f)).filter(v=>v!=null); g.prom=ys.length?Math.round(ys.reduce((s,v)=>s+v,0)/ys.length*10)/10:null; });
  const todos=grupos.flatMap(g=>g.filas), ys=todos.map(x=>fzAnios(x.f)).filter(v=>v!=null);
  return {grupos,total:todos.length,capturados:todos.filter(x=>fzCompleta(x.f)).length,prom:ys.length?Math.round(ys.reduce((s,v)=>s+v,0)/ys.length*10)/10:null};
}
function fuerzaTabla(D,o){
  o=o||{}; let n=0;
  const cuerpo=D.grupos.map(g=>g.filas.map((x,i)=>{
    n++; const f=x.f||{}, an=fzAnios(x.f), sin=!fzCompleta(x.f);
    const click=o.pantalla?` data-act="fzAbrir" data-aid="${esc(g.a.id)}" data-id="${esc(x.p.id)}" class="fz-fila"`:'';
    return `<tr${click}><td class="c">${n}</td><td class="l">${esc(x.p.nombre)}${sin&&o.pantalla?' <span class="fz-pend">sin capturar</span>':''}</td>${i===0?`<td class="l" rowspan="${g.filas.length}">${esc(g.a.nombre)}</td>`:''}
      <td class="c">${f.lic?'✓':''}${f.lic&&o.pantalla?`<div class="sm">${esc(f.lic)}</div>`:''}</td><td class="c">${f.maes?'✓':''}${f.maes&&o.pantalla?`<div class="sm">${esc(f.maes)}</div>`:''}</td>
      <td class="l s">${esc(f.otras||'')}</td><td class="l s">${esc(f.cert||'')}</td><td class="c">${an==null?'':an}</td>${i===0?`<td class="c b" rowspan="${g.filas.length}">${g.prom==null?'':g.prom}</td>`:''}</tr>`;
  }).join('')).join('');
  return `<table class="fm-t"><thead>
    <tr><th rowspan="2" class="c">No</th><th rowspan="2">NOMBRES Y APELLIDOS</th><th rowspan="2">PROFESORES<br>POR DEPORTES</th><th colspan="4">NIVEL ESCOLAR</th><th colspan="2">EXPERIENCIA<br>LABORAL</th></tr>
    <tr><th>LICENCIADOS</th><th>MAESTROS</th><th>OTRAS<br>CARRERAS</th><th>CERTIFICACIÓN<br>EN DEPORTES</th><th>AÑOS</th><th>PROMEDIO</th></tr></thead>
    <tbody>${cuerpo||'<tr><td colspan="9" class="c">No hay entrenadores dados de alta.</td></tr>'}
    <tr class="tot"><td colspan="7" class="l">TOTAL: ${D.total} entrenadores${D.capturados<D.total?` · ${D.capturados} con formación capturada`:''}</td><td class="c"></td><td class="c b">${D.prom==null?'':D.prom}</td></tr></tbody></table>`;
}

/* ---------- impresión en hoja carta horizontal con el formato del club ---------- */
const FM_CSS = `
@page{size:letter landscape;margin:9mm}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{margin:0;padding:0;background:#fff;color:#10222b;font:10.5px/1.35 Arial,Helvetica,sans-serif}
.fm-cab{display:flex;align-items:stretch;border:1px solid #444;margin-bottom:8px}
.fm-cab>div{padding:6px 10px;display:flex;align-items:center}
.fm-logo{width:26%;border-right:1px solid #444}.fm-logo img{height:44px;max-width:100%;object-fit:contain}
.fm-tit{flex:1;justify-content:center;text-align:center;font-weight:700;font-size:13px;letter-spacing:.02em}
.fm-cod{width:28%;border-left:1px solid #444;padding:0!important;display:block!important}
.fm-cod table{width:100%;height:100%;border-collapse:collapse;font-size:9.5px}
.fm-cod td{border-bottom:1px solid #444;padding:2px 6px}.fm-cod tr:last-child td{border-bottom:0}.fm-cod td:first-child{font-weight:700;width:44%;border-right:1px solid #444}
.fm-club{display:flex;align-items:center;gap:14px;margin:4px 0 2px}
.fm-club img{height:38px}.fm-club b{flex:1;text-align:center;font-size:14px}
.fm-sub{font-weight:700;font-size:14px;margin:8px 0 6px}
.fm-t{width:100%;border-collapse:collapse;table-layout:auto}
.fm-t th,.fm-t td{border:1px solid #444;padding:3px 5px;vertical-align:middle}
.fm-t th{font-size:9px;text-align:center;font-weight:700;background:#f4f4f2;line-height:1.2}
.fm-t td.c{text-align:center}.fm-t td.l{text-align:left}.fm-t td.b{font-weight:700}
.fm-t .s{font-size:9px}.fm-t .sm{font-size:8px;font-weight:400}
.fm-t tr.tot td{font-weight:700;background:#f4f4f2}
.fm-t tr{break-inside:avoid}
.fm-notas{margin-top:8px;font-size:9px;color:#334a54}.fm-notas p{margin:2px 0}
.fm-firma{margin-top:30px;text-align:center;font-size:10px}
.fm-club.c{justify-content:center}.fm-club.c b{flex:none;text-align:center;font-weight:400;font-size:12px}
.fm-sub.c{text-align:center;font-weight:400;font-size:12px;margin:6px 24px 10px}
.pe-dat{margin:6px 0;font-size:12px}.pe-dat b{margin-right:6px}
.pe-tb th,.pe-tb td{font-size:11px}.pe-tb td.l{padding:4px 6px}
.pe-res{margin:8px 0 0;font-size:12px;text-align:right}
.pe-dos{display:flex;gap:30px;margin-top:16px}.pe-dos>div{flex:1}.pe-dos h4{margin:0 0 6px;font-size:12px}.pe-dos p{margin:3px 0;font-size:11.5px}
.pe-h{margin:18px 0 4px;font-size:12px}
.pe-obs{min-height:120px;border:1px solid #444;padding:8px;white-space:pre-wrap;font-size:11.5px}
.pe-firmas{display:flex;gap:50px;margin-top:56px}.pe-firmas div{flex:1;border-top:1px solid #444;text-align:center;padding-top:4px;font-size:11px}.pe-firmas small{color:#334a54}
.pe-ger{text-align:center;margin-top:28px;font-size:12px}
.pe-pct-t{font-size:9.5px;color:#334a54}
.rf-dep{margin:4px 0 8px;font-size:12px}
.rf-t th{font-size:8.5px}.rf-t td{height:21px}
.rf-leyenda{display:flex;gap:18px;align-items:flex-start;margin-top:12px;break-inside:avoid}
.rf-mini{width:auto;font-size:10px}.rf-mini th,.rf-mini td{padding:2px 8px}
.rf-lado{flex:1}.rf-lado .rf-mini{display:table;width:100%;margin-bottom:6px}
.rf-info h3{margin:14px 0 6px;font-size:13px}.rf-info p{margin:5px 0;font-size:11px;text-align:justify}.rf-info ul{margin:4px 0 4px 18px;padding:0;font-size:11px}.rf-info li{margin:3px 0}
`;
function fmDoc(o){
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(o.titulo)}</title><style>${FM_CSS}</style>${o.vertical?'<style>@page{size:letter portrait;margin:11mm 13mm}</style>':''}</head><body>${o.html}</body></html>`;
}
const fmCabecera = o => o.codigo
  ? (K=>`<div class="fm-cab"><div class="fm-logo"><img src="img/logo.png" alt=""></div><div class="fm-tit">${esc(o.titulo)}</div>
      <div class="fm-cod"><table><tr><td>CÓDIGO</td><td>${esc(K.codigo)}</td></tr><tr><td>REVISIÓN:</td><td>${esc(K.revision)}</td></tr><tr><td>FECHA DE REV:</td><td>${esc(K.fecha)}</td></tr><tr><td>RETENER POR:</td><td>${esc(K.retener)}</td></tr></table></div></div>
     ${o.centrar?`<div class="fm-club c"><b>${esc(FM_CLUB)}</b></div><div class="fm-sub c">${esc(o.sub||'')}</div>`:`<div class="fm-club"><img src="img/logo.png" alt=""><b>${esc(FM_CLUB)}</b></div><div class="fm-sub">${esc(o.sub||'')}</div>`}`)((typeof o.codigo==='object')?o.codigo:FM_CODIGO)
  : `<div class="fm-club"><img src="img/logo.png" alt=""><b style="text-align:left">${esc(o.titulo)}</b></div>`;
let fmActual = null, fmDim = {w:1056,h:816};
function imprimirFormato(o){
  const html=fmDoc({titulo:o.titulo,vertical:o.vertical,html:fmCabecera(o)+o.cuerpo+(o.notas?`<div class="fm-notas">${o.notas.map(n=>`<p>${n}</p>`).join('')}</div>`:'')+(o.firma?`<div class="fm-firma"><b>${esc(INF_FIRMA.nombre)}</b><br>${esc(INF_FIRMA.cargo.toUpperCase())}</div>`:'')});
  if(typeof window!=='undefined'&&window.IMPRIMIR_HOOK){ window.IMPRIMIR_HOOK(html,o); return; }
  fmActual=html; fmDim=o.vertical?{w:816,h:1056}:{w:1056,h:816};
  openModal(`${mHead('Reporte para imprimir')}
    <div class="doc-pv fm-pv" id="fmPv"><iframe id="fmFrame" title="Vista previa del reporte"></iframe></div>
    <div class="sub" style="margin:10px 0 0">Hoja carta con el formato del club. En el cuadro de impresión elige <b>Guardar como PDF</b> para descargarlo.</div>
    <div class="btns"><button class="btn" data-act="closeModal">Cerrar</button><button class="btn primary" data-act="fmPrint">Imprimir / guardar PDF</button></div>`);
  $('#fmFrame').srcdoc=html; fmEscala();
}
function fmEscala(){ const pv=$('#fmPv'), f=$('#fmFrame'); if(!pv||!f) return; const s=Math.min(1,(pv.clientWidth||560)/fmDim.w); f.style.width=fmDim.w+'px'; f.style.height=fmDim.h+'px'; f.style.transform=`scale(${s})`; pv.style.height=Math.round(fmDim.h*s)+'px'; }
window.addEventListener('resize',fmEscala);
function fmImprimir(){
  if(!fmActual) return;
  const f=document.createElement('iframe');
  f.setAttribute('aria-hidden','true'); f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(f);
  const d=f.contentDocument; d.open(); d.write(fmActual); d.close();
  let lanzado=false;
  const lanzar=()=>{ if(lanzado) return; lanzado=true; try{ f.contentWindow.focus(); f.contentWindow.print(); }catch(e){ toast('No se pudo abrir la impresión en este navegador'); } setTimeout(()=>f.remove(),120000); };
  const imgs=[...d.images]; const pend=imgs.filter(i=>!i.complete);
  if(!pend.length) setTimeout(lanzar,250); else { let n=pend.length; pend.forEach(i=>{ const fin=()=>{ if(--n<=0) setTimeout(lanzar,200); }; i.onload=fin; i.onerror=fin; }); }
  setTimeout(lanzar,4000);
}

/* ---------- pestaña Reportes del metodólogo ---------- */
const RP_LISTA = [
  {id:'anual',nombre:'Resumen anual de eventos realizados',desc:'Por deporte: eventos planificados contra realizados, participantes del club y foráneos, eventos nacionales e internacionales e impacto social.',ic:'trofeo'},
  {id:'evaluacion',nombre:'Evaluación de los profesores',desc:'Evaluación anual que hace la dirección de cada disciplina: puntaje, categoría y el formato para imprimir.',ic:'clip'},
  {id:'fuerza',nombre:'Formato de la fuerza técnica',desc:'Cada entrenador por deporte: licenciatura, maestría, otras carreras, certificaciones y años de experiencia.',ic:'clip'}
];
function rpAnios(){
  const y=new Date().getFullYear(), ys=new Set([y,y-1]);
  areasList().forEach(a=>coll(a.id,'eventos').forEach(e=>{ const v=parseInt(String(e.fecha).slice(0,4),10); if(v>2000&&v<=y+1) ys.add(v); }));
  return [...ys].sort((a,b)=>b-a);
}
function vMetReportes(){
  const R=ui.rp;
  if(R.rep==='anual') return vRpAnual();
  if(R.rep==='fuerza') return vRpFuerza();
  if(R.rep==='evaluacion') return vPeReporte();
  return `<div class="sub">Elige el reporte. Se arma solo con lo que ya capturan las direcciones y los profesores; tú solo indicas la fecha.</div>
    ${RP_LISTA.map(r=>`<button class="line mt-prueba" style="--ac:var(--b3)" data-act="rpAbrir" data-r="${r.id}"><div class="t">${ic(r.ic)}</div><div class="b"><b>${esc(r.nombre)}</b><small>${esc(r.desc)}</small></div><div class="r">${ic('next')}</div></button>`).join('')}
    <div class="sub" style="margin-top:8px">Otros reportes se irán agregando aquí.</div>`;
}
function vRpAnual(){
  const R=ui.rp, r=rpRango(), D=anualDatos(r), anios=rpAnios();
  return `<div class="mt-back"><button class="btn sm" data-act="rpVolver">${ic('back')} Regresar</button></div>
    <div class="h2">Resumen anual de eventos realizados</div>
    <div class="an-f no-print"><div class="an-row">
      <label class="f"><span>Año</span><select id="rp_anio">${anios.map(y=>`<option value="${y}"${String(y)===String(R.anio)?' selected':''}>${y}</option>`).join('')}</select></label></div>
      <div class="two an-dates"><label class="f"><span>Desde</span><input type="date" id="rp_desde" value="${esc(r.desde)}"></label><label class="f"><span>Hasta</span><input type="date" id="rp_hasta" value="${esc(r.hasta)}"></label></div>
      <div class="btns"><button class="btn primary" data-act="rpImprimirAnual">${ic('doc')} Imprimir / guardar PDF</button>${rpAnioCompleto(r)?`<button class="btn" data-act="rpPlan">Plan anual ${esc(r.desde.slice(0,4))}</button>`:''}</div></div>
    <div class="fm-titulo">${esc(anualTitulo(r))}</div>
    <div class="rep-pantalla fm-pantalla">${anualTabla(D,{pantalla:true})}</div>
    <div class="an-nota">${anualNotas(D,r).join('<br>')}</div>`;
}
function vRpFuerza(){
  const R=ui.rp, D=fuerzaDatos(R.area), as=areasList().filter(a=>esDeporteArea(a.id)&&fzLista(a.id).length);
  if(R.area!=='all'&&!as.some(a=>a.id===R.area)) R.area='all';
  return `<div class="mt-back"><button class="btn sm" data-act="rpVolver">${ic('back')} Regresar</button></div>
    <div class="h2">Formato de la fuerza técnica</div>
    <div class="an-f no-print"><div class="an-row"><label class="f"><span>Deporte</span><select id="rp_area"><option value="all"${R.area==='all'?' selected':''}>Todos los deportes</option>${as.map(a=>`<option value="${esc(a.id)}"${R.area===a.id?' selected':''}>${esc(a.nombre)}</option>`).join('')}</select></label></div>
      <div class="btns"><button class="btn primary" data-act="rpImprimirFuerza">${ic('doc')} Imprimir / guardar PDF</button></div></div>
    <div class="kpis k3 mt-kpis">${kpi('Entrenadores',D.total,'dados de alta',{color:'var(--b2)'})}${kpi('Con formación',`${D.capturados}/${D.total}`,D.capturados<D.total?'faltan por capturar':'completo',{cls:D.capturados<D.total?'warn':'ok',color:'var(--b3)'})}${kpi('Experiencia',D.prom==null?'—':D.prom+' años','promedio',{color:'var(--b1)'})}</div>
    <div class="sub">Toca un entrenador para ver o completar su formación.</div>
    <div class="rep-pantalla fm-pantalla">${fuerzaTabla(D,{pantalla:true})}</div>
    <div class="an-nota">Cada entrenador captura su formación una sola vez (en su portal) o la captura su dirección; los años de experiencia se calculan solos a partir del año en que empezó. El promedio es de los años de experiencia de cada deporte.</div>`;
}
function openPlan(){
  const r=rpRango(), anio=r.desde.slice(0,4), as=areasList().filter(a=>esDeporteArea(a.id)).sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre),'es'));
  openModal(`${mHead('Plan anual de eventos '+anio)}
    <div class="sub">Eventos planificados para el año en cada deporte. Si dejas un deporte en blanco, se cuentan los eventos agendados en el sistema.</div>
    <div class="pl-lista">${as.map(a=>`<label class="pl-fila"><span>${esc(a.nombre)}</span><input class="pl-n" data-aid="${esc(a.id)}" type="number" inputmode="numeric" min="0" value="${planDe(anio,a.id)==null?'':planDe(anio,a.id)}" placeholder="auto"></label>`).join('')}</div>
    <div class="btns"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="rpPlanGuardar" data-anio="${esc(anio)}">Guardar plan</button></div>`);
}

Object.assign(actions,{
  rpAbrir(d){ ui.rp.rep=d.r; ui.rp.desde=''; ui.rp.hasta=''; ui.rp.area='all'; render(); top0(); },
  rpVolver(){ ui.rp.rep=null; render(); top0(); },
  rpImprimirAnual(){
    const r=rpRango(), D=anualDatos(r);
    imprimirFormato({titulo:anualTitulo(r),cuerpo:anualTabla(D),notas:anualNotas(D,r),firma:true});
  },
  rpImprimirFuerza(){
    const D=fuerzaDatos(ui.rp.area);
    imprimirFormato({titulo:'FORMATO DE LA FUERZA TECNICA',sub:'FORMATOS CONTROL DE LA FUERZA TÉCNICA',codigo:true,cuerpo:fuerzaTabla(D)});
  },
  rpPlan(){ openPlan(); },
  rpPlanGuardar(d){
    document.querySelectorAll('.pl-n').forEach(i=>{ const v=i.value.trim(); setPath(`met/plan/${d.anio}/${i.dataset.aid}`,v===''?undefined:Math.max(0,Math.round(+v)||0)); });
    closeModal(); render(); toast('Plan anual guardado');
  },
  fmPrint(){ fmImprimir(); },
  fzAbrir(d){
    if(!session) return;
    if(session.rol==='prof'&&d.id!==session.profId) return;
    if(session.rol==='dir'&&d.aid!==session.area) return;
    closeModal(); openFormacion(d.aid,d.id);
  },
  fzGuardar(d){
    const v=id=>String((($('#'+id)||{}).value)||'').trim(), desde=parseInt(v('fz_desde'),10), y=new Date().getFullYear();
    if(v('fz_desde')&&!(desde>=1950&&desde<=y)){ toast('Escribe un año válido, por ejemplo 2012'); return; }
    const f={id:d.id,lic:v('fz_lic').slice(0,80),maes:v('fz_maes').slice(0,80),otras:v('fz_otras').slice(0,100),cert:v('fz_cert').slice(0,160),desde:v('fz_desde')?String(desde):'',nada:!!($('#fz_nada')||{}).checked,act:todayStr(),
      por:session.rol==='prof'?'prof':session.rol==='dir'?'dir':'met'};
    if(!fzCompleta(f)){ toast('Captura al menos un dato, o marca que no tiene estudios que reportar'); return; }
    setPath(`met/formacion/${d.id}`,f); closeModal(); render(); toast('Formación guardada');
  }
});
document.addEventListener('change',e=>{
  const t=e.target; if(!ui.rp||!ui.mt||ui.mt.tab!=='reportes') return;
  if(t.id==='rp_anio'){ ui.rp.anio=t.value; ui.rp.desde=''; ui.rp.hasta=''; render(); }
  else if(t.id==='rp_desde'||t.id==='rp_hasta'){ ui.rp.desde=($('#rp_desde')||{}).value; ui.rp.hasta=($('#rp_hasta')||{}).value; if(ui.rp.desde) ui.rp.anio=ui.rp.desde.slice(0,4); render(); }
  else if(t.id==='rp_area'){ ui.rp.area=t.value; render(); }
});
