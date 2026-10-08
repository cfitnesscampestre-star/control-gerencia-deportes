/* =====================================================================
   xlsx.js — genera un archivo Excel (.xlsx) con formato, sin librerías y sin internet.
   Uso:  xlsxDescargar('nombre.xlsx', [ {nombre, cols:[anchos], filas:[[celda,…],…], combinar:['A1:H1'], congelar:'C5', filtro:'A4:N30'} , … ])
   Celda: valor simple (texto o número)  ó  {v:valor, s:'estilo'}   (texto con salto de línea ya envuelve)
   Estilos: titulo, sub, enc, encG, txt, ctr, num1, ent, ok, info, warn, bad, neg, nota, tot
   ===================================================================== */
(function(){
  const ESTILOS = ['def','titulo','sub','enc','encG','txt','ctr','num1','ent','ok','info','warn','bad','neg','nota','tot'];
  const X = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
  const colL = i => { let s=''; i++; while(i>0){ const m=(i-1)%26; s=String.fromCharCode(65+m)+s; i=Math.floor((i-1)/26); } return s; };

  function stylesXml(){
    const fill = c => `<fill><patternFill patternType="solid"><fgColor rgb="FF${c}"/><bgColor indexed="64"/></patternFill></fill>`;
    const fills = ['<fill><patternFill patternType="none"/></fill>','<fill><patternFill patternType="gray125"/></fill>',
      fill('1F7A5C'),fill('DCEFE6'),fill('D5F0DD'),fill('D9EAF7'),fill('FFF1CC'),fill('F8D7D7'),fill('EEF2F0')];     // 2 verde enc · 3 verde claro · 4 ok · 5 info · 6 warn · 7 bad · 8 gris
    const fonts = [
      '<font><sz val="10"/><name val="Calibri"/></font>',                                               // 0
      '<font><b/><sz val="15"/><color rgb="FF1F7A5C"/><name val="Calibri"/></font>',                    // 1 título
      '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>',                    // 2 encabezado
      '<font><b/><sz val="10"/><name val="Calibri"/></font>',                                           // 3 negrita
      '<font><i/><sz val="9"/><color rgb="FF5F6B66"/><name val="Calibri"/></font>',                     // 4 nota
      '<font><b/><sz val="11"/><color rgb="FF1F7A5C"/><name val="Calibri"/></font>'                     // 5 subtítulo
    ];
    const thin = '<left style="thin"><color rgb="FFB7C4BE"/></left><right style="thin"><color rgb="FFB7C4BE"/></right><top style="thin"><color rgb="FFB7C4BE"/></top><bottom style="thin"><color rgb="FFB7C4BE"/></bottom><diagonal/>';
    const borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>',`<border>${thin}</border>`];
    const al = (h,w) => `<alignment horizontal="${h}" vertical="center"${w?' wrapText="1"':''}/>`;
    // [numFmt, font, fill, border, alignment]
    const xf = {
      def:[0,0,0,0,''], titulo:[0,1,0,0,al('left')], sub:[0,5,0,0,al('left')],
      enc:[0,2,2,1,al('center',1)], encG:[0,2,2,1,al('center',1)],
      txt:[0,0,0,1,al('left',1)], ctr:[0,0,0,1,al('center',1)], num1:[164,0,0,1,al('center')], ent:[1,0,0,1,al('center')],
      ok:[0,3,4,1,al('center',1)], info:[0,3,5,1,al('center',1)], warn:[0,3,6,1,al('center',1)], bad:[0,3,7,1,al('center',1)],
      neg:[0,3,3,1,al('left',1)], nota:[0,4,0,0,al('left',1)], tot:[0,3,8,1,al('center',1)]
    };
    const xfs = ESTILOS.map(k=>{ const [n,f,fi,b,a]=xf[k]; return `<xf numFmtId="${n}" fontId="${f}" fillId="${fi}" borderId="${b}" xfId="0"${n?' applyNumberFormat="1"':''} applyFont="1" applyFill="1" applyBorder="1"${a?' applyAlignment="1">'+a+'</xf>':'/>'}`; });
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      <numFmts count="1"><numFmt numFmtId="164" formatCode="0.0"/></numFmts>
      <fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="${borders.length}">${borders.join('')}</borders>
      <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
      <cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>
      <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  }

  function sheetXml(sh){
    const filas = sh.filas||[], cols = sh.cols||[];
    const rows = filas.map((fila,r)=>{
      let alto=''; if(fila&&fila.alto){ alto=` ht="${fila.alto}" customHeight="1"`; }
      const celdas = (fila||[]).map((c,i)=>{
        if(c==null||c==='') return '';
        const o = (typeof c==='object') ? c : {v:c};
        const s = Math.max(0,ESTILOS.indexOf(o.s||(typeof o.v==='number'?'ctr':'txt')));
        const ref = colL(i)+(r+1);
        if(typeof o.v==='number' && isFinite(o.v)) return `<c r="${ref}" s="${s}"><v>${o.v}</v></c>`;
        return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${X(o.v)}</t></is></c>`;
      }).join('');
      // celdas vacías con estilo (para que los bordes de las combinadas se vean): se agregan en 'vacias'
      return `<row r="${r+1}"${alto}>${celdas}</row>`;
    }).join('');
    const colsXml = cols.length?`<cols>${cols.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols>`:'';
    let vista = '<sheetViews><sheetView workbookViewId="0" showGridLines="0">';
    if(sh.congelar){ const m=/^([A-Z]+)(\d+)$/.exec(sh.congelar); if(m){ let xs=0; m[1].split('').forEach(ch=>{ xs=xs*26+ch.charCodeAt(0)-64; }); xs--; const ys=+m[2]-1;
      vista += `<pane${xs?` xSplit="${xs}"`:''}${ys?` ySplit="${ys}"`:''} topLeftCell="${sh.congelar}" activePane="${xs&&ys?'bottomRight':ys?'bottomLeft':'topRight'}" state="frozen"/>`; } }
    vista += '</sheetView></sheetViews>';
    const comb = (sh.combinar&&sh.combinar.length)?`<mergeCells count="${sh.combinar.length}">${sh.combinar.map(m=>`<mergeCell ref="${m}"/>`).join('')}</mergeCells>`:'';
    const filtro = sh.filtro?`<autoFilter ref="${sh.filtro}"/>`:'';
    const pagina = '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup orientation="landscape" paperSize="1" fitToHeight="0"/>';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>${vista}<sheetFormatPr defaultRowHeight="15"/>${colsXml}<sheetData>${rows}</sheetData>${filtro}${comb}${pagina}</worksheet>`;
  }

  /* ---- ZIP sin compresión (método "store") ---- */
  let T=null;
  const crc = b => { if(!T){ T=new Uint32Array(256); for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c=c&1?0xEDB88320^(c>>>1):c>>>1; T[n]=c>>>0; } }
    let c=0xFFFFFFFF; for(let i=0;i<b.length;i++) c=T[(c^b[i])&255]^(c>>>8); return (c^0xFFFFFFFF)>>>0; };
  function zip(archivos){
    const enc = new TextEncoder(), partes=[], central=[]; let pos=0;
    const u16=n=>[n&255,(n>>>8)&255], u32=n=>[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];
    archivos.forEach(a=>{
      const nom=enc.encode(a.n), dat=enc.encode(a.d), c=crc(dat);
      const loc=new Uint8Array([0x50,0x4b,3,4,20,0,0,8,0,0,0,0,0x21,0,...u32(c),...u32(dat.length),...u32(dat.length),...u16(nom.length),0,0]);   // bit 11: nombres UTF-8
      partes.push(loc,nom,dat);
      central.push({nom,c,len:dat.length,pos});
      pos+=loc.length+nom.length+dat.length;
    });
    const cd=[]; let cdLen=0;
    central.forEach(f=>{
      const h=new Uint8Array([0x50,0x4b,1,2,20,0,20,0,0,8,0,0,0,0,0x21,0,...u32(f.c),...u32(f.len),...u32(f.len),...u16(f.nom.length),0,0,0,0,0,0,0,0,0,0,0,0,...u32(f.pos)]);
      cd.push(h,f.nom); cdLen+=h.length+f.nom.length;
    });
    const fin=new Uint8Array([0x50,0x4b,5,6,0,0,0,0,...u16(central.length),...u16(central.length),...u32(cdLen),...u32(pos),0,0]);
    return new Blob([...partes,...cd,fin],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }

  function nombreHoja(n,usados){
    let b=String(n||'Hoja').replace(/[\[\]:*?\/\\]/g,' ').replace(/\s+/g,' ').trim().slice(0,31)||'Hoja', k=b, i=2;
    while(usados.includes(k.toLowerCase())) k=b.slice(0,28)+' '+(i++);
    usados.push(k.toLowerCase()); return k;
  }

  window.xlsxBuild = function(hojas){
    const usados=[], nombres=hojas.map(h=>nombreHoja(h.nombre,usados));
    const ar=[
      {n:'[Content_Types].xml',d:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${hojas.map((h,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`},
      {n:'_rels/.rels',d:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
      {n:'xl/workbook.xml',d:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${nombres.map((n,i)=>`<sheet name="${X(n)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`},
      {n:'xl/_rels/workbook.xml.rels',d:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hojas.map((h,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${hojas.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
      {n:'xl/styles.xml',d:stylesXml()},
      ...hojas.map((h,i)=>({n:`xl/worksheets/sheet${i+1}.xml`,d:sheetXml(h)}))
    ];
    return zip(ar);
  };
  window.xlsxDescargar = function(nombre,hojas){
    const blob=window.xlsxBuild(hojas), a=document.createElement('a');
    a.href=URL.createObjectURL(blob); a.download=nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  };
})();
