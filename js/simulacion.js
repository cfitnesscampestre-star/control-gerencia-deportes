'use strict';
/* =====================================================================
   simulacion.js — datos de ejemplo en todas las áreas.
   · Son ficticios (nombres inventados) y se generan al abrir la app.
   · NO se guardan ni se envían a Firebase: viven solo en pantalla.
   · Son de solo lectura y se reconocen por el prefijo "sim_".
   · Desaparecen al poner CONECTAR_FIREBASE = true en js/config.js,
     o con el botón "Quitar datos de simulación" en Ajustes.
   ===================================================================== */
const SIM_OFF_KEY = 'gd_sim_off';
const simDisponible = () => typeof SIMULACION!=='undefined' && SIMULACION && !FIREBASE_CONFIG.databaseURL;
const simPreferida = () => { try{ return localStorage.getItem(SIM_OFF_KEY)!=='1'; }catch(e){ return true; } };
const simActiva = () => Object.keys(SIM).length>0;

const SIM_PROFES = ['Mariana Ortega','Ricardo Beltrán','Lucía Ferrer','Andrés Ibarra','Paola Castañeda','Héctor Villalobos','Daniela Rocha','Emilio Serrano','Fernanda Lugo','Gabriel Quiroz','Ximena Paredes','Omar Delgado','Renata Solís','Iván Cordero','Camila Ávila','Tomás Escobar','Regina Montes','Julián Peña','Valentina Cruz','Mauricio Lara','Alma Rentería','Sebastián Ochoa','Karla Nájera','Rodolfo Meza','Ilse Barragán','Leonel Ponce','Marisol Tapia','Bruno Cervantes','Nadia Galván','Esteban Ríos'];
const SIM_NOMBRES = ['Ana','Luis','María','Pedro','Sofía','Jorge','Laura','Diego','Elena','Carlos','Paula','Mateo','Vanesa','Andrés','Camila','Rafael','Isabel','Emilio','Renata','Santiago','Lucía','Tomás','Regina','Daniel','Julia','Adrián','Mónica','Sergio','Natalia','Óscar'];
const SIM_APELLIDOS = ['Torres','Pérez','Gómez','Ramos','Vega','Ríos','Núñez','Cano','Salas','Mora','Duarte','Ibarra','Lozano','Pineda','Sandoval','Aguilar','Cortés','Medina','Herrera','Campos'];

/* [nombre, hora, días (0 = lunes), lugar, cupo, ocupación base] */
const SIM_PLAN = {
  gimnasia:  [['Rítmica infantil','16:00',[0,2,4],'Gimnasio',14,.86],['Rítmica juvenil','17:30',[1,3],'Gimnasio',12,.70],['Acrobática','18:00',[1,3],'Gimnasio',12,.45],['Precompetitiva','15:00',[0,2,4],'Gimnasio',10,.92]],
  fitness:   [['TRX','06:00',[1,3],'Box',20,.62],['Step','07:00',[0,2,4],'Salón Principal',25,.34],['RPM','07:00',[0,2,4],'Estudio Spinning',25,.55],['Yoga','19:00',[1,3],'Sala Yoga',15,.82],['Body Combat','18:00',[0,2],'Salón Principal',20,.22],['Pilates','09:00',[0,2,4],'Sala Yoga',12,.78],['Zumba','19:00',[0,2],'Salón Principal',25,.18],['CrossFit','18:00',[1,3],'Box',20,.70]],
  tenis:     [['Iniciación infantil','16:00',[0,2],'Cancha 1',8,.74],['Juvenil','17:00',[1,3],'Cancha 2',10,.58],['Adultos','19:00',[0,2],'Cancha 3',8,.66],['Clínica avanzada','07:00',[5],'Cancha 1',8,.80]],
  futbol:    [['Sub-8','16:30',[0,2],'Campo 1',18,.60],['Sub-12','17:30',[1,3],'Campo 1',18,.72],['Sub-16','18:30',[0,2,4],'Campo 2',18,.50],['Femenil','19:30',[1,3],'Campo 2',16,.40]],
  natacion:  [['Bebés','10:00',[1,3,5],'Alberca',10,.90],['Infantil','16:00',[0,2,4],'Alberca',14,.70],['Adultos','19:00',[0,2,4],'Alberca',16,.45],['Aqua fitness','08:00',[1,3],'Alberca',16,.55]],
  padel:     [['Iniciación','18:00',[0,2],'Cancha de pádel 1',8,.27],['Intermedio','19:00',[1,3],'Cancha de pádel 2',8,.50],['Clínica de sábado','09:00',[5],'Cancha de pádel 1',8,.75]],
  taekwondo: [['Infantil','17:00',[0,2,4],'Dojo',20,.68],['Juvenil','18:00',[0,2,4],'Dojo',20,.55],['Adultos','19:30',[1,3],'Dojo',15,.35],['Poomsae','16:00',[5],'Dojo',12,.60]],
  squash:    [['Iniciación','18:00',[0,2],'Cancha de squash 1',6,.50],['Juvenil','17:00',[1,3],'Cancha de squash 2',6,.62],['Adultos','20:00',[0,2],'Cancha de squash 1',6,.30]],
  basquetbol:[['Mini','16:30',[0,2],'Duela',20,.80],['Infantil','17:30',[1,3],'Duela',20,.66],['Juvenil','19:00',[0,2,4],'Duela',18,.48],['Adultos','20:30',[1],'Duela',15,.30]],
  frontenis: [['Iniciación','18:00',[1,3],'Frontón',8,.58],['Competitivo','19:30',[0,2],'Frontón',8,.70],['Adultos','08:00',[5],'Frontón',8,.40]],
  gimnasio:  []                                           // el gimnasio se simula por hora, no por clases
};
const SIM_GENERICO = [['Grupo A','17:00',[0,2],'Instalación principal',12,.70],['Grupo B','18:00',[1,3],'Instalación principal',12,.50],['Grupo C','19:00',[0,2,4],'Instalación principal',12,.35]];
const SIM_EVENTOS = {
  gimnasia:[['Exhibición de fin de ciclo',-34,'realizado',60,12000,11200,5],['Torneo interno de rítmica',18,'planificado',45,9000]],
  fitness:[['Reto 21 días',-20,'realizado',48,8000,7600,4],['Clase masiva de aniversario',12,'planificado',70,6000]],
  tenis:[['Copa Campestre',-10,'realizado',48,25000,23100,5],['Torneo de dobles',24,'planificado',32,15000]],
  futbol:[['Torneo relámpago Sub-12',-27,'realizado',96,14000,15200,4],['Copa de verano',30,'planificado',120,22000]],
  natacion:[['Torneo interno de natación',-25,'realizado',60,12000,13400,4],['Gala acuática',20,'planificado',80,18000]],
  padel:[['Americano de pádel',-15,'realizado',24,5000,4700,5],['Torneo relámpago',9,'planificado',32,7000]],
  taekwondo:[['Examen de cinta',-12,'realizado',55,4000,3900,5],['Copa interna',26,'planificado',64,10000]],
  squash:[['Ranking abierto',-40,'realizado',18,3000,3200,4],['Liga de otoño',15,'planificado',24,4500]],
  basquetbol:[['Liga interna',-18,'realizado',110,16000,15400,4],['Juego de estrellas',22,'planificado',90,9000]],
  frontenis:[['Torneo social',-8,'realizado',26,5500,5100,5],['Copa Campestre de frontenis',28,'planificado',32,8000]],
  gimnasio:[['Reto de fuerza',-16,'realizado',38,6000,5600,5],['Jornada de valoración física',11,'planificado',60,4000]]
};
const SIM_INCIDENCIAS = {
  padel:[['Instalaciones','alta','Red de la cancha 2 rota; se suspendió la clase de las 19:00.','abierta',0],['Material o equipo','baja','Faltan pelotas nuevas para las clínicas.','resuelta',-12]],
  natacion:[['Instalaciones','media','El filtro de la alberca hace ruido; el técnico ya lo revisó una vez.','en seguimiento',-5]],
  taekwondo:[['Lesión o accidente','media','Golpe leve en el tobillo de un alumno infantil; se avisó a los padres.','abierta',-2]],
  tenis:[['Material o equipo','baja','Pelotas insuficientes para el grupo juvenil.','abierta',-3]],
  gimnasia:[['Instalaciones','media','Colchoneta principal con desgaste en una esquina.','abierta',-6]],
  futbol:[['Disciplina','alta','Discusión entre padres en el partido Sub-16; se habló con ambas familias.','resuelta',-20]],
  fitness:[['Queja de socio','baja','Temperatura alta en el salón de las 7:00.','resuelta',-9]],
  gimnasio:[['Material o equipo','media','La caminadora 3 se detiene sola; ya se reportó al proveedor.','en seguimiento',-4],['Instalaciones','baja','Faltan toallas en el área de estiramiento.','resuelta',-11]]
};
const SIM_APOYOS = { gimnasio:'Autorizar dos mancuernas de 30 kg para la zona de peso libre.', fitness:'Necesitamos 2 tapetes nuevos para Pilates.', padel:'Reparar la red de la cancha 2 antes del sábado.', tenis:'Apoyo con difusión para la clínica avanzada.' };

/* Gimnasio: conteo por hora (mujeres y hombres) de las últimas 12 semanas y paquetes de personalizados por instructor */
function simGimnasio(a,ai,D,profs,rnd,t,nombreAlumno){
  const c={cap:+a.cap||60,abre:a.abre!=null?+a.abre:6,cierra:a.cierra!=null?+a.cierra:22};
  const curva={6:.42,7:.6,8:.52,9:.36,10:.28,11:.3,12:.4,13:.42,14:.3,15:.3,16:.38,17:.6,18:.8,19:.9,20:.72,21:.4};      // ocupación típica por hora (entre semana)
  const mujeres={6:.42,7:.4,8:.5,9:.62,10:.66,11:.6,12:.5,13:.48,14:.52,15:.5,16:.46,17:.4,18:.36,19:.34,20:.38,21:.4};    // proporción de mujeres por hora
  for(let k=0;k<84;k++){
    const f=addDays(t,-k), wd=wdIdx(f), fdia=wd>=5?(wd===5?.62:.45):1, hoyHoras=k===0?new Date().getHours():99;
    if(rnd()<.03) continue;                                                     // día sin conteos
    for(let h=c.abre;h<c.cierra;h++){
      if(k===0&&h>hoyHoras) continue;
      const w=(curva[h]!=null?curva[h]:.35)*fdia*(.8+rnd()*.4)*(1+((84-k)/84-.5)*.12);
      const tot=Math.max(0,Math.min(c.cap,Math.round(c.cap*w))), mu=Math.round(tot*Math.min(.8,Math.max(.15,(mujeres[h]||.45)+(rnd()-.5)*.12))), ho=tot-mu;
      const id=`${f}_${pad(h)}`; D.accesos[id]={id,fecha:f,hora:h,mu,ho,sim:true};
    }
  }
  const clientes=Array.from({length:22},(_,i)=>nombreAlumno(ai*53+i*11+5)); let ci=0;
  const plazos=[[10,60],[12,60],[20,90],[24,90]];
  profs.forEach((pid,pi)=>{
    const n=pi===3?2:4-Math.min(pi,1);
    for(let j=0;j<n;j++){
      const id=`sim_pt${pi}_${j}`, [total,vig]=plazos[(pi+j)%plazos.length];
      let ini=addDays(t,-Math.round(8+rnd()*(vig-14))), fin=addDays(ini,vig), real=Math.round(total*Math.min(1,(1+Math.round((parseYmd(t)-parseYmd(ini))/86400000))/vig)*(.7+rnd()*.3));
      if(pi===0&&j===0){ fin=addDays(t,4); ini=addDays(fin,-vig); real=Math.round(total*.55); }        // por vencer con saldo
      else if(pi===1&&j===0){ fin=addDays(t,-5); ini=addDays(fin,-vig); real=Math.round(total*.6); }      // vencido con sesiones sin usar
      else if(pi===2&&j===0){ real=total; }                                                                 // completado
      real=Math.min(total,real);
      const P={id,profId:pid,cliente:clientes[ci++%clientes.length],total,monto:total*420,inicio:ini,fin,notas:'',sesiones:{},sim:true};
      const tope=fin<t?fin:t, span=Math.max(1,Math.round((parseYmd(tope)-parseYmd(ini))/86400000));
      for(let s=0;s<real;s++){ const f=addDays(ini,Math.min(span,Math.round((s+.5)*span/real))), sid=`sim_s${pi}_${j}_${s}`;
        P.sesiones[sid]={id:sid,f,h:`${pad(6+Math.floor(rnd()*14))}:00`,e:'realizada'}; }
      if(rnd()<.5&&real>2){ const sid=`sim_s${pi}_${j}_c`; P.sesiones[sid]={id:sid,f:addDays(ini,3),h:'10:00',e:'cancelada por el cliente'}; }
      D.paquetes[id]=P;
    }
  });
}
/* tipo y nivel de cada clase simulada, según su nombre */
function simTipoNivel(aid,nombre){
  const n=chNorm(nombre);
  if(aid==='fitness'){
    const tipo=/trx|crossfit/.test(n)?'Fuerza y funcional':/step|zumba|combat/.test(n)?'Cardio y baile':/rpm/.test(n)?'Ciclismo indoor':'Mente y cuerpo';
    return {tipo,nivel:/crossfit|combat/.test(n)?'Intermedio':'Todos los niveles'};
  }
  const tipo=/infantil|bebes|mini|sub-8|sub-12/.test(n)?'Infantil':/juvenil|sub-16/.test(n)?'Juvenil':/adultos|femenil/.test(n)?'Adultos':/precompetitiva|competitivo|avanzada/.test(n)?'Competitivo':'Especializada';
  const nivel=/iniciacion|bebes|mini/.test(n)?'Principiante':/precompetitiva|competitivo|avanzada/.test(n)?'Avanzado':'Intermedio';
  return {tipo,nivel};
}
function simGenerar(){
  let semilla=20260919; const rnd=()=>{ semilla=(semilla*9301+49297)%233280; return semilla/233280; };
  const t=todayStr(), out={}, areas=areasList();
  const nombreAlumno=i=>`${SIM_NOMBRES[i%SIM_NOMBRES.length]} ${SIM_APELLIDOS[(i*7+3)%SIM_APELLIDOS.length]}`;
  areas.forEach((a,ai)=>{
    const aid=a.id, plan=SIM_PLAN[aid]||SIM_GENERICO, D={profesores:{},grupos:{},asistencia:{},eventos:{},incidencias:{},reportes:{},accesos:{},paquetes:{}};
    // profesores (2 a 4 por área, nombres inventados)
    const gimA=a.tipo==='gimnasio';
    const nProf=gimA?4:Math.min(4,Math.max(2,Math.ceil(plan.length/2)));
    const profs=[]; for(let i=0;i<nProf;i++){ const id=`sim_p${ai}_${i}`, nombre=SIM_PROFES[(ai*4+i)%SIM_PROFES.length];
      D.profesores[id]={id,nombre,tipo:i===nProf-1&&nProf>2?'Externo':'Planta',activo:true,especialidad:'',foto:'',sim:true}; profs.push(id); }
    if(gimA){ simGimnasio(a,ai,D,profs,rnd,t,nombreAlumno); }
    // grupos, asistencia
    plan.forEach(([nombre,hi,dias,lugar,cupo,base],gi)=>{
      const gid=`sim_g${ai}_${gi}`, pid=profs[gi%profs.length], prof=D.profesores[pid].nombre;
      const conLista=cupo<=20&&rnd()<.6&&aid!=='fitness', nAl=Math.max(3,Math.round(cupo*(.72+rnd()*.28)));
      const roster=conLista?Array.from({length:nAl},(_,i)=>nombreAlumno(ai*97+gi*31+i)):[];
      D.grupos[gid]={id:gid,nombre,prof,profId:pid,dias:dias.join(','),hi,hf:'',lugar,cupo,inscritos:conLista?0:Math.round(cupo*(.8+rnd()*.5)),alumnos:roster.join('\n'),creado:addDays(t,-100),...simTipoNivel(aid,nombre),sim:true};
      for(let k=0;k<84;k++){
        const f=addDays(t,-k); if(!dias.includes(wdIdx(f))) continue;
        const r=rnd(); if(r<.06) continue;                                        // clase sin captura
        const id=`${gid}_${f}`, rec={id,grupoId:gid,fecha:f,asistentes:0,sim:true};
        if(r<.10){ rec.omitida=true; if(rnd()<.6){ rec.falta=true; rec.motivo='Ausencia del profesor'; } }
        else {
          const tend=1+((84-k)/84-.5)*.22*(base>.5?1:-1);
          let n=Math.max(0,Math.min(cupo,Math.round(cupo*base*tend+(rnd()-.5)*cupo*.3)));
          if(roster.length){ n=Math.min(n,roster.length); const orden=roster.slice().sort(()=>rnd()-.5);
            rec.lista=true; rec.presentes=orden.slice(0,n); rec.ausentes=orden.slice(n,n+Math.round((roster.length-n)*.5)); rec.extras=0; }
          rec.asistentes=n; if(r<.14) rec.sup=true;                               // clase cubierta por suplente
        }
        D.asistencia[id]=rec;
      }
    });
    // eventos
    (SIM_EVENTOS[aid]||[['Evento del área',-14,'realizado',30,5000,4800,4],['Próximo evento',14,'planificado',30,5000]]).forEach(([nombre,dd,estado,part,pres,costo,cal],i)=>{
      const id=`sim_e${ai}_${i}`;
      D.eventos[id]={id,nombre,fecha:addDays(t,dd),hora:'10:00',lugar:'Instalaciones del club',tipo:'Torneo',estado,participantes:part,presupuesto:pres,costoReal:costo||0,calificacion:cal||0,notas:'',sim:true};
    });
    // incidencias
    (SIM_INCIDENCIAS[aid]||[]).forEach(([tipo,grav,desc,estado,dd],i)=>{
      const id=`sim_i${ai}_${i}`; D.incidencias[id]={id,fecha:addDays(t,dd),tipo,grav,desc,acciones:estado==='resuelta'?'Atendido y cerrado.':'',estado,sim:true};
    });
    // reportes semanales: últimas 8 semanas completas + la actual
    const lunes=mondayOf(t);
    for(let w=8;w>=0;w--){
      const m=addDays(lunes,-7*w), omite=(aid==='padel'&&w%3===1)||(aid==='squash'&&w===2)||(aid==='frontenis'&&w===4);
      if(omite||(w===0&&rnd()<.5)) continue;
      const entregado=!(w===0)&&!(aid==='padel'&&w===2);
      D.reportes[m]={semana:m,entregado,entregadoEn:entregado?addDays(m,4)+'T15:00:00.000Z':'',
        objPrev:'Mantener la asistencia de los grupos.',cumplio:w%3===0?'Parcialmente':'Sí',porque:w%3===0?'Hubo lluvia dos días.':'',objProx:'Reforzar difusión de los horarios con menor ocupación.',
        logros:'Se mantuvo la operación regular.',incNota:'',apoyo:(w===1||w===0)&&SIM_APOYOS[aid]?SIM_APOYOS[aid]:'',sim:true};
    }
    out[aid]=D;
  });
  return out;
}
function simIniciar(){ SIM=(simDisponible()&&simPreferida())?simGenerar():{}; }
function simResumen(){
  const a=Object.values(SIM);
  return {areas:a.length,gimnasio:a.reduce((n,d)=>n+Object.keys(d.accesos||{}).length,0),grupos:a.reduce((n,d)=>n+Object.keys(d.grupos).length,0),profesores:a.reduce((n,d)=>n+Object.keys(d.profesores).length,0),registros:a.reduce((n,d)=>n+Object.keys(d.asistencia).length,0),eventos:a.reduce((n,d)=>n+Object.keys(d.eventos).length,0)};
}
function gSimulacionCard(){
  if(!simDisponible()) return '';
  const on=simActiva(), r=on?simResumen():null;
  return `<div class="h2">Simulación</div><div class="card">
    <div class="row"><div><b>Datos de ejemplo</b><small>${on?`Activos en ${r.areas} áreas: ${r.grupos} grupos, ${r.profesores} profesores, ${r.registros.toLocaleString('es-MX')} registros de asistencia y ${r.eventos} eventos; el gimnasio trae ${r.gimnasio.toLocaleString('es-MX')} conteos por hora y personalizados por instructor.`:'Apagados en este dispositivo.'}</small></div>${pill(on?'Activa':'Apagada',on?'warn':'mut')}</div>
    <div class="row"><div><small>${on?'Son ficticios, de solo lectura, no se guardan y desaparecen al conectar la base de datos (CONECTAR_FIREBASE = true en js/config.js).':'Puedes volver a cargarlos cuando quieras.'}</small></div><button class="btn sm ${on?'danger':'primary'}" data-act="simToggle">${on?'Quitar datos de simulación':'Cargar datos de simulación'}</button></div></div>`;
}
Object.assign(actions,{
  simToggle(){
    const on=simActiva();
    try{ on?localStorage.setItem(SIM_OFF_KEY,'1'):localStorage.removeItem(SIM_OFF_KEY); }catch(e){}
    simIniciar(); ui.chartSel=null; render(); toast(on?'Datos de simulación quitados':'Datos de simulación cargados');
  }
});
