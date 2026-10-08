// Prueba de humo del backend con una hoja de cálculo simulada (no necesita Google).
// Uso: node tests/backend.test.js
const fs=require('fs'),vm=require('vm');
const SEP=process.env.SEP||',';   // SEP=";" node tests/backend.test.js  → hoja en español
const code=fs.readFileSync(require('path').join(__dirname,'..','apps-script','Codigo.gs'),'utf8');
function Sheet(name){this.name=name;this.d=[];this.formulas={};}
Sheet.prototype={
 getName(){return this.name},setName(n){this.name=n;return this},
 get(r,c){const row=this.d[r-1];return row&&row[c-1]!==undefined?row[c-1]:''},
 set(r,c,v){while(this.d.length<r)this.d.push([]);const row=this.d[r-1];while(row.length<c)row.push('');row[c-1]=v},
 getLastRow(){for(let i=this.d.length;i>0;i--)if(this.d[i-1].some(v=>v!==''&&v!==null))return i;return 0},
 getLastColumn(){return Math.max(0,...this.d.map(r=>{for(let i=r.length;i>0;i--)if(r[i-1]!=='')return i;return 0}))},
 getRange(a,b,c,e){if(typeof a==='string')return new Range(this,1,1,1,1);return new Range(this,a,b,c||1,e||1)},
 getDataRange(){return new Range(this,1,1,Math.max(1,this.getLastRow()),Math.max(1,this.getLastColumn()))},
 appendRow(row){const r=this.getLastRow()+1;row.forEach((v,j)=>this.set(r,j+1,v))},
 deleteRow(r){this.d.splice(r-1,1)},deleteRows(r,n){this.d.splice(r-1,n)},
 clear(){this.d=[];this.formulas={}},createTextFinder(t){return new Range(this,1,1,Math.max(1,this.getLastRow()),Math.max(1,this.getLastColumn())).createTextFinder(t)},
 copyTo(ss){const s=new Sheet(this.name+' copy');s.d=JSON.parse(JSON.stringify(this.d));ss._sheets.push(s);return s},
 setFrozenRows(){},setFrozenColumns(){},setRowHeight(){},setColumnWidths(){},setColumnWidth(){}
};
function Range(sh,r,c,nr,nc){Object.assign(this,{sh,r,c,nr,nc})}
const chain=['setFontWeight','setFontColor','setBackground','setWrap','setVerticalAlignment','setNumberFormat','setFontSize','setFontFamily','setFontStyle','setDataValidation'];
chain.forEach(m=>Range.prototype[m]=function(){return this});
Object.assign(Range.prototype,{
 setValues(v){v.forEach((row,i)=>row.forEach((x,j)=>this.sh.set(this.r+i,this.c+j,x)));return this},
 setValue(v){this.sh.set(this.r,this.c,v);return this},
 setFormula(f){this.sh.formulas[this.r+','+this.c]=f;return this},
 clearContent(){delete this.sh.formulas[this.r+','+this.c];this.sh.set(this.r,this.c,'');return this},
 // simula la configuración regional: solo «=SUM(2<sep>5)» con el separador de la hoja da 7
 getValue(){const f=this.sh.formulas[this.r+','+this.c];return f==='=SUM(2'+SEP+'5)'?7:(f?'#ERROR!':this.sh.get(this.r,this.c))},
 getValues(){const o=[];for(let i=0;i<this.nr;i++){const row=[];for(let j=0;j<this.nc;j++)row.push(this.sh.get(this.r+i,this.c+j));o.push(row)}return o},
 getRow(){return this.r},
 createTextFinder(t){const self=this;let entire=false;return{matchEntireCell(x){entire=x;return this},findNext(){for(let i=0;i<self.nr;i++)for(let j=0;j<self.nc;j++){const v=String(self.sh.get(self.r+i,self.c+j)).toLowerCase(),q=String(t).toLowerCase();if(entire?v===q:v.includes(q))return new Range(self.sh,self.r+i,self.c+j,1,1)}return null}}}
});
const ss={_sheets:[],getSheetByName(n){return this._sheets.find(s=>s.name===n)||null},insertSheet(n,i){const s=new Sheet(n);if(i===0)this._sheets.unshift(s);else this._sheets.push(s);return s},getSheets(){return this._sheets},setSpreadsheetTimeZone(){},setActiveSheet(){}};
const cache={};
const ui={alert:(t,m)=>{console.log('[ALERT]',t,'|',String(m).replace(/\n/g,' / '));return 'YES'},prompt:(t,m)=>({getSelectedButton:()=> 'OK',getResponseText:()=>ctx.__answers.shift()}),ButtonSet:{OK:1,YES_NO:2,OK_CANCEL:3},Button:{YES:'YES',OK:'OK'},createMenu(){const m={addItem(){return m},addSeparator(){return m},addToUi(){}};return m}};
const props={};
const ctx={PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||null,setProperty:(k,v)=>props[k]=v})},
 SpreadsheetApp:{flush(){},getActive:()=>ss,getActiveSpreadsheet:()=>ss,getUi:()=>ui,newDataValidation:()=>({requireValueInList(){return this},build(){return{}}})},
 LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},CacheService:{getScriptCache:()=>({get:k=>cache[k]||null,put:(k,v)=>cache[k]=v,remove:k=>delete cache[k]})},
 Session:{getActiveUser:()=>({getEmail:()=>'rafael@unifranz.edu.bo'})},Utilities:{formatDate:(d)=>d.toISOString().slice(0,10)},
 ContentService:{createTextOutput:t=>({t,setMimeType(){return this}}),MimeType:{JSON:1,JAVASCRIPT:2}},Logger:{log:console.log},console,__answers:[]};
// base de docentes ficticia (como la pestaña P26: incluye CI, que nunca debe salir)
const base=ss.insertSheet('P26');
base.d=[['Docente','CI','Sede','Carrera','Email','Plan de estudios'],
 ['JUAN CARLOS PEREZ LOPEZ','111','CBB','NGE','doc.juancarlos.perez.lo@unifranz.edu.bo',2026],
 ['ANA ROJAS VARGAS','222','LPZ','ICO','DOC.ana.rojas.va@unifranz.edu.bo ',2026],
 ['LUIS PAZ SOTO','333','SCZ','GAC','doc.luis.paz.so@unifranz.edu.bo',2026],
 ['MARIA DIAZ CRUZ','444','SCZ','ARQ','doc.maria.diaz.cr@unifranz.edu.bo',2017],
 ['ROSA MAMANI QUISPE','555','EAT','MED','doc.rosa.mamani.qu@unifranz.edu.bo',2026]];
ss.insertSheet('Filtrado3').d=[['ID','Docente','Email'],['1','X','x@unifranz.edu.bo']];   // otras pestañas de la hoja: no se usan
vm.createContext(ctx);vm.runInContext(code,ctx);
const J=o=>JSON.stringify(o);
ctx.configuracionInicial();
console.log('PADRON rows',ss.getSheetByName('PADRON').getLastRow()-1, J(ss.getSheetByName('PADRON').d.slice(0,3)));
console.log('PADRON L2 formula',ss.getSheetByName('PADRON').formulas['2,12']);
console.log('CARRERAS tail',J(ss.getSheetByName('CARRERAS').d.slice(-2)));
const get=(a,extra)=>JSON.parse(ctx.doGet({parameter:Object.assign({action:a},extra||{})}).t);
const v1=get('validar',{correo:'doc.juancarlos.perez.lo@unifranz.edu.bo'});console.log('validar ok',J(v1));
if(!v1.docente||v1.docente.nombre!=='Juan'||J(v1).includes('111')){console.error('FALLA: validar');process.exit(1)}
console.log('CONFIG origen',ctx.config_().origenes.join(','));
console.log('validar mayus',J(get('validar',{correo:'doc.ana.rojas.va@unifranz.edu.bo'})).slice(0,120));
console.log('validar plan 2017',J(get('validar',{correo:'doc.maria.diaz.cr@unifranz.edu.bo'})));
console.log('validar nada',J(get('validar',{correo:'x.y@unifranz.edu.bo'})));
// alumno nuevo agregado a la base despues del padron
base.d.push(['NUEVO DOCENTE X','666','CBB','PSI','doc.nuevo.docente.x@unifranz.edu.bo',2026]);
console.log('validar nuevo en base',J(get('validar',{correo:'doc.nuevo.docente.x@unifranz.edu.bo'})).slice(0,160),'padron rows',ss.getSheetByName('PADRON').getLastRow()-1, ss.getSheetByName('PADRON').formulas[(ss.getSheetByName('PADRON').getLastRow())+',12']);
const pl={id:'DO-AAAAA-BBBBBB',correo:'doc.juancarlos.perez.lo@unifranz.edu.bo',sede:'Cochabamba',sede_cod:'CBB',carrera:'Trucho',carrera_cod:'ICO',datos_corregidos:true,
 p03_idx:[2,1,1,11],p04:'Docente Tiempo Completo',p05:'Requiero más información',p06:4,p07:5,p08:3,p09:2,p10:'En todas mis clases',p11:5,p12:1,p13_idx:[1,4],p14:'=mal',
 r01_idx:[1,2,3,9],r02_idx:[2,9,5],r03:4,r04:'NA',r05:'Más simuladores',dur_s:90,movil:true,version:'1.0'};
const post=d=>JSON.parse(ctx.doPost({postData:{contents:J({action:'guardar',data:d})}}).t);
console.log('guardar',J(post(pl)));
console.log('guardar dup id',J(post(pl)));
console.log('guardar otro id mismo correo',J(post({...pl,id:'DO-CCCCC-DDDDDD'})));
console.log('validar ya',J(get('validar',{correo:pl.correo})));
const R=ss.getSheetByName('RESPUESTAS'),H=ctx.cabResp_();
H.forEach((h,i)=>console.log(i+1,h.slice(0,46),'=>',J(R.get(2,i+1)).slice(0,50)));
const fila=ctx.filaResp_(pl,'DO-X','x',null);
if(fila.length!==H.length){console.error('FALLA: la fila tiene',fila.length,'celdas y la cabecera',H.length);process.exit(1)}
const val=t=>R.get(2,H.findIndex(h=>h.indexOf(t)===0)+1);
const esper={'1. Sede':'Cochabamba','2. Carrera':'Negocios y Gestión Empresarial','3. Selecciona':'Primero | Segundo','3.11':undefined,'4. Rol':'Docente Tiempo Completo','10. ':'En todas mis clases','13. ':'Director de Carrera | Docentes Tiempo Completo','14. ':"'=mal",'RRDDTT 2. ':'Plataformas de gestión y evaluación | Plataformas IA','RRDDTT 4.':'No los he utilizado','RRDDTT 2.5 ':0,'RRDDTT 2.9 ':1};
Object.keys(esper).forEach(k=>{ if(esper[k]===undefined) return; if(val(k)!==esper[k]){console.error('FALLA:',k,'=>',J(val(k)),'esperado',J(esper[k]));process.exit(1)} });
// cerrar
ctx.menuCerrar(); console.log('cerrada',J(get('validar',{correo:'doc.ana.rojas.va@unifranz.edu.bo'}))); ctx.menuAbrir();
// anular
ctx.__answers=['DOC.juancarlos.perez.lo@unifranz.edu.bo','Se equivocó de rol']; ctx.menuAnular();
console.log('resp rows',R.getLastRow()-1,'papelera rows',ss.getSheetByName('PAPELERA').getLastRow()-1);
console.log('validar tras anular',J(get('validar',{correo:pl.correo})).slice(0,60));
// restaurar
ctx.__answers=['do-aaaaa-bbbbbb']; ctx.menuRestaurar(); console.log('resp rows',R.getLastRow()-1);
// excluir
ctx.__answers=['doc.rosa.mamani.qu@unifranz.edu.bo','Retiro']; ctx.menuExcluir(); console.log('validar excluida',J(get('validar',{correo:'doc.rosa.mamani.qu@unifranz.edu.bo'})));
ctx.menuActualizarPadron();
ctx.__answers=['doc.rosa.mamani.qu@unifranz.edu.bo']; ctx.menuReincorporar(); console.log('validar reincorp',J(get('validar',{correo:'doc.rosa.mamani.qu@unifranz.edu.bo'})).slice(0,60));
// agregados manual (plan 2017 no cumple filtro pero agregado)
const ag=ss.getSheetByName('AGREGADOS'); ag.appendRow(['doc.maria.diaz.cr@unifranz.edu.bo','MARIA DIAZ CRUZ','SCZ','ARQ',2017,'caso especial']);
console.log('validar agregado',J(get('validar',{correo:'doc.maria.diaz.cr@unifranz.edu.bo'})).slice(0,80));
// prueba
console.log('prueba',J(post({id:'PRUEBA-XYZ12',correo:'prueba@unifranz.edu.bo',sede:'Cochabamba',sede_cod:'CBB',carrera:'X',carrera_cod:'X',p04:'Docente Tiempo Horario',r01_idx:[1]})));
// nuevo periodo
ctx.__answers=['I-2027']; ctx.menuNuevoPeriodo(); console.log('sheets',ss._sheets.map(s=>s.name).join(','),'resp rows',R.getLastRow()-1, 'periodo', ctx.config_().periodo);
ctx.menuEstado();
const rs=ss.getSheetByName('RESUMEN'); for(let r=1;r<=rs.getLastRow();r++) console.log(r,[1,2,3].map(c=>String(rs.get(r,c)).slice(0,110)).join(' || '));
// tope de filas de prueba
const pr=i=>JSON.parse(ctx.doPost({postData:{contents:JSON.stringify({action:'guardar',data:Object.assign({},pl,{id:'PRUEBA-TOPE'+i,correo:'prueba@unifranz.edu.bo'})})}}).t);
const tope=[];for(let i=0;i<8;i++){const r=pr(i);tope.push(r.ok?'ok':r.codigo)}console.log('pruebas',tope.join(','));
if(!tope.includes('limite_pruebas')){console.error('FALLA: no se aplicó el tope de pruebas');process.exit(1)}
