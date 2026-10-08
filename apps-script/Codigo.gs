/** @OnlyCurrentDoc */  // el script solo puede tocar esta hoja, ningún otro archivo de Drive
/**
 * ENCUESTA DOCENTES · PLAN 2026 · II/2026  (v1.0)
 * Backend en Google Apps Script, ligado a la hoja que contiene la base de docentes (pestaña P26).
 *
 * ── PRIMERA VEZ ─────────────────────────────────────────────────────────────
 *   1. En la hoja de la base: Extensiones → Apps Script → pega este código → Guardar.
 *   2. Ejecuta configuracionInicial() (autoriza permisos). Crea las pestañas de trabajo
 *      sin tocar la base de RR. HH.
 *   3. Recarga la hoja: aparece el menú «Encuesta». Revisa CONFIG y CARRERAS y usa
 *      «Encuesta → Actualizar padrón de habilitados».
 *   4. Implementar → Nueva implementación → Aplicación web
 *        Ejecutar como: Yo · Quién tiene acceso: Cualquier persona
 *      Copia la URL que termina en /exec y pégala en API_URL_DEFECTO del index.html.
 *
 * ── PARA ACTUALIZAR ESTE CÓDIGO DESPUÉS ─────────────────────────────────────
 *   Implementar → Administrar implementaciones → ✏️ → Versión: «Nueva versión» → Implementar.
 *   (Nunca «Nueva implementación»: cambia la URL.)
 *
 * Todo lo que cambia de un semestre a otro (planes, semestres, sedes, pestañas de
 * origen, fechas, nombres de carreras, excluidos) se maneja desde la hoja, sin tocar código.
 */

const VERSION_APP = '1.0';
const ZONA = 'America/La_Paz';
const H = {             // nombres de pestañas
  CONFIG: 'CONFIG', CARRERAS: 'CARRERAS', PADRON: 'PADRON', EXCLUIDOS: 'EXCLUIDOS',
  AGREGADOS: 'AGREGADOS', RESP: 'RESPUESTAS', PAPELERA: 'PAPELERA', RESUMEN: 'RESUMEN', BITACORA: 'BITACORA'
};
const SEDES = { LPZ: 'La Paz', EAT: 'El Alto', CBB: 'Cochabamba', SCZ: 'Santa Cruz' };
// Opciones del instrumento (textuales). Deben coincidir con las de la app.
const SEMS = ['Primero', 'Segundo', 'Tercero', 'Cuarto', 'Quinto', 'Sexto', 'Séptimo', 'Octavo', 'Noveno', 'Décimo'];
const ROLES = ['Docente Tiempo Completo', 'Docente Tiempo Horario'];
const MODELO = ['Sí conozco', 'Requiero más información'];
const RETRO = ['Al finalizar el hito', 'Al finalizar evaluaciones', 'Al finalizar Actividades y evaluaciones', 'En todas mis clases'];
const ACUDE = ['Director de Carrera', 'Jefatura de Enseñanza Aprendizaje', 'Colegas docentes', 'Docentes Tiempo Completo'];
const USO = ['No los utilizo', 'Menos de una vez al mes', 'Aproximadamente una vez al mes', 'Varias veces al mes', 'En todas o casi todas las clases'];
const MEDIDA = ['Nada', 'Poco', 'Moderadamente', 'Bastante', 'Mucho'];
const NO_USA = 'No los he utilizado';
const CAT_TEC = [
  'Herramientas de creación y diseño', 'Plataformas de gestión y evaluación', 'Recursos audiovisuales y multimedia',
  'Bases de datos y recursos de investigación', 'Simuladores y entornos interactivos', 'Recursos de investigación y análisis',
  'Comunicación y colaboración', 'Herramientas específicas por disciplina o uso', 'Plataformas IA', 'Otros recursos y plataformas varias'
];
// Nombres sugeridos (solo carreras del plan 2026). La pestaña CARRERAS manda: ahí se corrigen y
// los códigos nuevos que aparezcan en la base se agregan solos en amarillo.
const CARRERAS_SUGERIDAS = [
  ['AFC', 'Auditoría Financiera y Control de Gestión'], ['BYF', 'Bioquímica y Farmacia'], ['CPD', 'Comunicación y Periodismo Digital'],
  ['DDP', 'Diseño Digital y Producción Transmedia'], ['DER', 'Derecho'], ['ENF', 'Enfermería'], ['GAC', 'Gastronomía y Artes Culinarias'],
  ['ICO', 'Ingeniería Comercial'], ['IEF', 'Ingeniería Económica y Financiera'], ['MED', 'Medicina'], ['NGE', 'Negocios y Gestión Empresarial'],
  ['ODO', 'Odontología'], ['PSI', 'Psicología'], ['PYM', 'Publicidad y Marketing'], ['SIS', 'Ingeniería de Sistemas'], ['THO', 'Turismo y Hotelería']
];
// Columnas que se buscan en las bases de RR. HH. (por nombre, en cualquier orden).
const COLS_BASE = {
  correo: ['correo_institucional', 'correo', 'email', 'correo_electronico'],
  sede: ['sede'], modalidad: ['modalidad'],
  plan: ['plan_de_estudios', 'plan_de_estudio', 'anho_plan_estudio', 'anio_plan_estudio', 'plan', 'plan_estudio', 'ano_plan_estudio'],
  carrera: ['carrera', 'cod_carrera', 'codigo_carrera'],
  semestre: ['semestre_pertenencia', 'semestre'],
  n1: ['docente', 'nombre_completo', 'primer_nombre', 'nombres', 'nombre'], n2: ['segundo_nombre'],
  a1: ['primer_apellido', 'apellidos', 'apellido_paterno'], a2: ['segundo_apellido', 'apellido_materno']
};
const MAIL_RE = /^[a-z0-9._%+-]+@unifranz\.edu\.bo$/;
const CAB_AGREGADOS = ['Email', 'Docente', 'Sede', 'Carrera', 'Plan de estudios', 'Nota'];
const MAX_PRUEBAS = 5;   // filas PRUEBA- permitidas a la vez en RESPUESTAS (se limpian con «Borrar filas de prueba»)

/* ═════════════════════════════ MENÚ ═════════════════════════════ */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Encuesta')
    .addItem('▶ Abrir encuesta', 'menuAbrir')
    .addItem('■ Cerrar encuesta', 'menuCerrar')
    .addSeparator()
    .addItem('↻ Actualizar padrón de habilitados', 'menuActualizarPadron')
    .addItem('ⓘ Ver estado de la encuesta', 'menuEstado')
    .addSeparator()
    .addItem('Anular la respuesta de un docente…', 'menuAnular')
    .addItem('Restaurar una respuesta anulada…', 'menuRestaurar')
    .addSeparator()
    .addItem('Excluir a un docente…', 'menuExcluir')
    .addItem('Reincorporar a un docente excluido…', 'menuReincorporar')
    .addItem('Agregar docentes a mano (pestaña AGREGADOS)', 'menuIrAgregados')
    .addSeparator()
    .addItem('Iniciar un nuevo periodo…', 'menuNuevoPeriodo')
    .addItem('Reconstruir RESUMEN', 'menuResumen')
    .addItem('Borrar filas de prueba', 'menuBorrarPruebas')
    .addSeparator()
    .addItem('Configuración inicial / reparar pestañas', 'configuracionInicial')
    .addToUi();
}

/* ═════════════════════ CONFIGURACIÓN INICIAL ═════════════════════ */
function configuracionInicial() {
  const ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(ZONA);
  crearConfig_(); crearCarreras_(); hojaSimple_(H.EXCLUIDOS, ['Correo', 'Motivo', 'Fecha', 'Registrado por']);
  hojaSimple_(H.AGREGADOS, CAB_AGREGADOS);
  hojaResp_(); hojaPapelera_(); hojaSimple_(H.BITACORA, ['Fecha', 'Usuario', 'Acción', 'Detalle']);
  const r = generarPadron_();
  CacheService.getScriptCache().remove('carreras_padron');
  crearResumen_();
  onOpen();
  bitacora_('Configuración inicial', r.texto);
  aviso_('Configuración lista', r.texto + '\n\nRevisa la pestaña CONFIG y los nombres en CARRERAS. Las celdas amarillas en CARRERAS son códigos nuevos sin nombre.');
}

function crearConfig_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(H.CONFIG);
  const filas = [
    ['Encuesta activa', 'SÍ', 'SÍ = los docentes pueden responder. NO = cerrada.'],
    ['Fecha de apertura', '', 'Opcional. Antes de esta fecha la encuesta aparece cerrada.'],
    ['Fecha de cierre', '', 'Opcional. Después de esta fecha (incluido el día completo) aparece cerrada.'],
    ['Periodo', 'II-2026', 'Nombre del periodo. Se usa al archivar respuestas en «Nuevo periodo».'],
    ['Pestañas de origen', primeraBase_(), 'Pestañas con la base de docentes (Email, Docente, Sede, Carrera, Plan de estudios), separadas por punto y coma. AGREGADOS se incluye siempre.'],
    ['Planes habilitados', '2026', 'Ej.: 2026  ·  2017; 2026  ·  vacío = todos'],
    ['Sedes habilitadas', '', 'Códigos: LPZ; EAT; CBB; SCZ  ·  vacío = todas'],
    ['Carreras habilitadas', '', 'Códigos, ej.: NGE; ICO  ·  vacío = todas'],
    ['Mensaje de encuesta cerrada', 'La encuesta no está disponible en este momento.', 'Texto que ve el docente cuando está cerrada.']
  ];
  if (!sh) {
    sh = ss.insertSheet(H.CONFIG, 0);
    sh.getRange(1, 1, 1, 3).setValues([['Parámetro', 'Valor', 'Ayuda']]);
    sh.getRange(2, 1, filas.length, 3).setValues(filas);
  } else {   // agrega solo los parámetros que falten; nunca pisa valores existentes
    const exist = sh.getRange(1, 1, Math.max(1, sh.getLastRow()), 1).getValues().map(r => String(r[0]).trim());
    filas.filter(f => exist.indexOf(f[0]) < 0).forEach(f => sh.appendRow(f));
  }
  sh.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#3a3a3a').setFontColor('#ffffff');
  sh.setColumnWidth(1, 220); sh.setColumnWidth(2, 260); sh.setColumnWidth(3, 520);
  sh.setFrozenRows(1);
  const fila = buscarFila_(sh, 'Encuesta activa');
  if (fila) sh.getRange(fila, 2).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['SÍ', 'NO'], true).build());
  ['Fecha de apertura', 'Fecha de cierre'].forEach(k => { const f = buscarFila_(sh, k); if (f) sh.getRange(f, 2).setNumberFormat('dd/MM/yyyy'); });
  sh.getRange(2, 2, sh.getLastRow() - 1, 1).setBackground('#fff8e1');
}
function primeraBase_() {
  const ss = SpreadsheetApp.getActive();
  const propias = Object.keys(H).map(k => H[k]);
  const sh = ss.getSheets().find(s => propias.indexOf(s.getName()) < 0 && s.getName().indexOf('RESPUESTAS') !== 0);
  return ss.getSheetByName('P26') ? 'P26' : sh ? sh.getName() : 'P26';
}

function crearCarreras_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(H.CARRERAS);
  if (!sh) {
    sh = ss.insertSheet(H.CARRERAS);
    sh.getRange(1, 1, 1, 2).setValues([['Código', 'Nombre que ve el docente']]);
    sh.getRange(2, 1, CARRERAS_SUGERIDAS.length, 2).setValues(CARRERAS_SUGERIDAS);
  }
  sh.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#3a3a3a').setFontColor('#ffffff');
  sh.setColumnWidth(1, 110); sh.setColumnWidth(2, 360); sh.setFrozenRows(1);
}

function hojaSimple_(nombre, cab) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(nombre);
  if (!sh) sh = ss.insertSheet(nombre);
  if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, cab.length).setValues([cab]);
  sh.getRange(1, 1, 1, cab.length).setFontWeight('bold').setBackground('#3a3a3a').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  return sh;
}

/* ═════════════════════════ LECTURA DE CONFIG ═════════════════════════ */
function config_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(H.CONFIG);
  const c = {};
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(r => { c[String(r[0]).trim()] = r[1]; });
  const lista = v => String(v || '').split(/[,;\n]/).map(x => norm_(x)).filter(String);
  return {
    activa: /^s/i.test(String(c['Encuesta activa'] || 'SÍ').trim()),
    apertura: c['Fecha de apertura'] instanceof Date ? c['Fecha de apertura'] : null,
    cierre: c['Fecha de cierre'] instanceof Date ? c['Fecha de cierre'] : null,
    periodo: String(c['Periodo'] || '').trim(),
    origenes: String(c['Pestañas de origen'] || 'P26').split(/[,;\n]/).map(x => x.trim()).filter(String),
    planes: lista(c['Planes habilitados']), semestres: lista(c['Semestres habilitados']),
    sedes: lista(c['Sedes habilitadas']), modalidades: lista(c['Modalidades habilitadas']),
    carreras: lista(c['Carreras habilitadas']),
    mensaje: String(c['Mensaje de encuesta cerrada'] || 'La encuesta no está disponible en este momento.')
  };
}
function setConfig_(clave, valor) {
  const sh = SpreadsheetApp.getActive().getSheetByName(H.CONFIG);
  const f = buscarFila_(sh, clave);
  if (f) sh.getRange(f, 2).setValue(valor);
}
function abierta_(cfg) {
  if (!cfg.activa) return false;
  const hoy = new Date();
  if (cfg.apertura && hoy < cfg.apertura) return false;
  if (cfg.cierre) { const fin = new Date(cfg.cierre); fin.setHours(23, 59, 59, 999); if (hoy > fin) return false; }
  return true;
}
function nombresCarreras_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(H.CARRERAS), m = {};
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(r => {
    const k = String(r[0]).trim().toUpperCase(); if (k) m[k] = String(r[1] || '').trim() || k;
  });
  return m;
}

/* ═════════════════════════ PADRÓN ═════════════════════════ */
const CAB_PADRON = ['Correo', 'Nombre completo', 'Primer nombre', 'Cód. sede', 'Sede', 'Cód. carrera', 'Carrera', 'Semestre', 'Plan', 'Modalidad', 'Pestaña de origen', 'Estado'];

function leerBase_(sh) {
  const datos = sh.getDataRange().getValues();
  if (datos.length < 2) return { filas: [], error: null };
  const cab = datos[0].map(h => norm_(h).replace(/\s+/g, '_'));
  const idx = {};
  Object.keys(COLS_BASE).forEach(k => { idx[k] = cab.findIndex(h => COLS_BASE[k].indexOf(h) >= 0); });
  const faltan = ['correo', 'carrera'].filter(k => idx[k] < 0);
  if (faltan.length) return { filas: [], error: 'En «' + sh.getName() + '» no encuentro la columna: ' + faltan.join(', ') };
  const val = (r, k) => idx[k] >= 0 ? String(r[idx[k]] === null ? '' : r[idx[k]]).trim() : '';
  return {
    error: null,
    filas: datos.slice(1).map(r => ({
      correo: val(r, 'correo').toLowerCase().replace(/\s+/g, ''),
      sede: val(r, 'sede').toUpperCase(), modalidad: val(r, 'modalidad').toUpperCase(),
      plan: val(r, 'plan'), carrera: val(r, 'carrera').toUpperCase(), semestre: val(r, 'semestre'),
      n1: val(r, 'n1'), n2: val(r, 'n2'), a1: val(r, 'a1'), a2: val(r, 'a2'), origen: sh.getName()
    })).filter(e => e.correo)
  };
}
function cumple_(e, cfg) {
  const ok = (lista, v) => !lista.length || lista.indexOf(norm_(v)) >= 0;
  return ok(cfg.planes, e.plan) && ok(cfg.semestres, e.semestre) && ok(cfg.sedes, e.sede) && ok(cfg.modalidades, e.modalidad) && ok(cfg.carreras, e.carrera);
}
function excluidos_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(H.EXCLUIDOS), s = {};
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(r => { const c = String(r[0]).trim().toLowerCase(); if (c) s[c] = true; });
  return s;
}
function filaPadron_(e, nombres) {
  const titulo = s => String(s || '').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
  const nombre = [e.n1, e.n2, e.a1, e.a2].filter(String).map(titulo).join(' ').replace(/\s+/g, ' ');
  return [e.correo, nombre, titulo(String(e.n1).split(/\s+/)[0]), e.sede, SEDES[e.sede] || e.sede, e.carrera, nombres[e.carrera] || e.carrera,
    Number(e.semestre) || e.semestre, Number(e.plan) || e.plan, e.modalidad, e.origen];
}

function generarPadron_() {
  const ss = SpreadsheetApp.getActive(), cfg = config_(), nombres = nombresCarreras_(), exc = excluidos_();
  const errores = [], vistos = {}, salida = [], codigos = {};
  let leidos = 0, fueraFiltro = 0, nExcl = 0, dup = 0;
  cfg.origenes.concat([H.AGREGADOS]).forEach(nombre => {
    const sh = ss.getSheetByName(nombre);
    if (!sh) { if (nombre !== H.AGREGADOS) errores.push('No existe la pestaña «' + nombre + '»'); return; }
    const b = leerBase_(sh);
    if (b.error) { errores.push(b.error); return; }
    b.filas.forEach(e => {
      leidos++;
      const manual = nombre === H.AGREGADOS;          // los agregados a mano no pasan por los filtros
      if (!manual && !cumple_(e, cfg)) { fueraFiltro++; return; }
      if (exc[e.correo]) { nExcl++; return; }
      if (vistos[e.correo]) { dup++; return; }
      vistos[e.correo] = true; codigos[e.carrera] = true;
      salida.push(filaPadron_(e, nombres));
    });
  });
  // códigos de carrera nuevos → se agregan a CARRERAS (en amarillo) para ponerles nombre
  const shC = ss.getSheetByName(H.CARRERAS) || (crearCarreras_(), ss.getSheetByName(H.CARRERAS));
  const nuevos = Object.keys(codigos).filter(k => k && !nombres[k]).sort();
  nuevos.forEach(k => { shC.appendRow([k, '']); shC.getRange(shC.getLastRow(), 1, 1, 2).setBackground('#fff59d'); });

  let sh = ss.getSheetByName(H.PADRON);
  if (!sh) sh = ss.insertSheet(H.PADRON);
  sh.clear();
  sepFormulas_(sh);
  sh.getRange(1, 1, 1, CAB_PADRON.length).setValues([CAB_PADRON]).setFontWeight('bold').setBackground('#3a3a3a').setFontColor('#ffffff');
  salida.sort((x, y) => (x[3] + x[6] + x[1]).localeCompare(y[3] + y[6] + y[1], 'es'));
  if (salida.length) { sh.getRange(2, 1, salida.length, salida[0].length).setValues(salida); ponerFormulaEstado_(sh, salida.length); }
  sh.setFrozenRows(1); sh.setColumnWidth(1, 300); sh.setColumnWidth(2, 260);

  const texto = 'Padrón: ' + salida.length + ' docentes habilitados.\n' +
    'Filas leídas: ' + leidos + ' · fuera de los filtros: ' + fueraFiltro + ' · excluidos: ' + nExcl + ' · correos repetidos: ' + dup + '.' +
    (nuevos.length ? '\nCódigos de carrera nuevos sin nombre: ' + nuevos.join(', ') + ' (complétalos en CARRERAS).' : '') +
    (errores.length ? '\n\n⚠ ' + errores.join('\n⚠ ') : '');
  return { n: salida.length, texto: texto };
}
// Estado vivo (Respondió / Pendiente). La fórmula cubre exactamente las filas escritas, para no
// inflar getLastRow() con celdas vacías de un ARRAYFORMULA abierto.
function ponerFormulaEstado_(sh, n) {
  const c = colLetra_(cabResp_().indexOf('Correo') + 1), ref = H.RESP + '!$' + c + '$2:$' + c;
  sh.getRange(2, CAB_PADRON.length).setFormula(fx_('=ARRAYFORMULA(IF(COUNTIF(' + ref + ',A2:A' + (n + 1) + ')>0,"Respondió","Pendiente"))'));
}
function formulaEstadoFila_(sh, r) {
  const c = colLetra_(cabResp_().indexOf('Correo') + 1);
  sh.getRange(r, CAB_PADRON.length).setFormula(fx_('=IF(COUNTIF(' + H.RESP + '!$' + c + '$2:$' + c + ',A' + r + ')>0,"Respondió","Pendiente")'));
}

// Busca un correo en el padrón; si no está, lo busca en vivo en las bases (por si la base se actualizó).
function buscarDocente_(correo, cfg) {
  const ss = SpreadsheetApp.getActive();
  if (excluidos_()[correo]) return { motivo: 'no_encontrado' };
  const sh = ss.getSheetByName(H.PADRON);
  if (sh && sh.getLastRow() > 1) {
    const f = sh.getRange(2, 1, sh.getLastRow() - 1, 1).createTextFinder(correo).matchEntireCell(true).findNext();
    if (f) return { fila: sh.getRange(f.getRow(), 1, 1, CAB_PADRON.length - 1).getValues()[0] };
  }
  let fuera = false;
  const nombres = nombresCarreras_();
  const hojas = cfg.origenes.concat([H.AGREGADOS]);
  for (let i = 0; i < hojas.length; i++) {
    const b = ss.getSheetByName(hojas[i]);
    if (!b) continue;
    const f = b.createTextFinder(correo).matchEntireCell(true).findNext();
    if (!f) continue;
    const base = leerFila_(b, f.getRow());
    if (!base || base.correo !== correo) continue;
    if (hojas[i] !== H.AGREGADOS && !cumple_(base, cfg)) { fuera = true; continue; }
    const fila = filaPadron_(base, nombres);
    if (sh) { sh.appendRow(fila); formulaEstadoFila_(sh, sh.getLastRow()); CacheService.getScriptCache().remove('carreras_padron'); }
    return { fila: fila };
  }
  return { motivo: fuera ? 'no_habilitado' : 'no_encontrado' };
}
function leerFila_(sh, r) {
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => norm_(h).replace(/\s+/g, '_'));
  const fila = sh.getRange(r, 1, 1, sh.getLastColumn()).getValues()[0];
  const get = k => { const i = cab.findIndex(h => COLS_BASE[k].indexOf(h) >= 0); return i >= 0 ? String(fila[i] === null ? '' : fila[i]).trim() : ''; };
  return { correo: get('correo').toLowerCase().replace(/\s+/g, ''), sede: get('sede').toUpperCase(), modalidad: get('modalidad').toUpperCase(),
    plan: get('plan'), carrera: get('carrera').toUpperCase(), semestre: get('semestre'), n1: get('n1'), n2: get('n2'), a1: get('a1'), a2: get('a2'), origen: sh.getName() };
}
function listaCarrerasPadron_() {
  const cache = CacheService.getScriptCache(), k = 'carreras_padron';
  const c = cache.get(k); if (c) return JSON.parse(c);
  const sh = SpreadsheetApp.getActive().getSheetByName(H.PADRON), nombres = nombresCarreras_(), vistos = {};
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 6, sh.getLastRow() - 1, 1).getValues().forEach(r => { const k2 = String(r[0]).trim(); if (k2) vistos[k2] = true; });
  const out = Object.keys(vistos).map(cod => ({ cod: cod, nombre: nombres[cod] || cod })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  cache.put(k, JSON.stringify(out), 600);
  return out;
}

/* ═════════════════════════ RESPUESTAS ═════════════════════════ */
// Columnas 0/1 de una pregunta de opción múltiple: «13.1 Director de Carrera (1 = sí)», …
const cols01_ = (pre, ops) => ops.map((c, i) => pre + '.' + (i + 1) + ' ' + c + ' (1 = sí)');
const leyenda_ = labels => labels.map((t, i) => (i + 1) + ' = ' + t).join(' · ');
function cabResp_() {
  return [
    'Marca temporal', 'ID respuesta', 'Correo', 'Nombre completo', '1. Sede', 'Cód. sede', '2. Carrera', 'Cód. carrera', 'Plan',
    '3. Selecciona los semestres que está dando docencia'
  ].concat(cols01_('3', SEMS)).concat([
    '4. Rol docente',
    '5. ¿Conoces el Modelo Educativo UNIFRANZ?',
    '6. ¿Te sientes satisfecho con el desarrollo de las experiencias de aprendizaje en tus clases? (1 = Nada satisfecho · 5 = Totalmente satisfecho)',
    '7. ¿Las actividades experienciales del DI son pertinentes para desarrollar las competencias previstas en la asignatura? (1 = Nada de acuerdo · 5 = Totalmente de acuerdo)',
    '8. ¿Las actividades experienciales del DI son pertinentes para desarrollar las competencias previstas para el Proyecto Integrador? (1 = Nada de acuerdo · 5 = Totalmente de acuerdo)',
    '9. ¿Con qué frecuencia tus evaluaciones se centran en la asignación de calificaciones? (1 = Nunca · 5 = Siempre)',
    '10. ¿Con qué frecuencia brindas retroalimentación en el desarrollo de tus clases?',
    '11. ¿Estás satisfecho con el desarrollo de las codocencias? (1 = Nada satisfecho · 5 = Totalmente satisfecho)',
    '12. ¿Con qué frecuencia coordinas con el docente tutor? (1 = Nunca · 5 = Siempre)',
    '13. ¿Cúando tienes dudas sobre la Experiencias de Aprendizaje a quién acudes?'
  ]).concat(cols01_('13', ACUDE)).concat([
    '14. Observaciones o sugerencias',
    'RRDDTT 1. ¿Qué recursos didácticos y digitales están incluidos en el diseño instruccional de tus asignaturas?'
  ]).concat(cols01_('RRDDTT 1', CAT_TEC)).concat([
    'RRDDTT 2. De los recursos incluidos en el diseño instruccional, ¿cuáles utilizas efectivamente en tus clases?'
  ]).concat(cols01_('RRDDTT 2', CAT_TEC)).concat([
    'RRDDTT 3. ¿Con qué frecuencia utilizas los recursos didácticos y digitales incluidos en el diseño instruccional? (' + leyenda_(USO) + ')',
    'RRDDTT 4. ¿En qué medida los recursos que utilizas te ayudan a desarrollar las actividades de enseñanza y aprendizaje previstas en el diseño instruccional? (' + leyenda_(MEDIDA) + ' · o «' + NO_USA + '»)',
    'RRDDTT 5. Tienes sugerencias de algún recursos tecnológicos/didácticos y/o Comentarios',
    'Duración (segundos)', 'Dispositivo', 'Fecha y hora local (dispositivo)', 'Periodo', 'Versión app', 'Datos completos (JSON)'
  ]);
}
function hojaResp_(nombre) {
  const ss = SpreadsheetApp.getActive(), C = cabResp_();
  nombre = nombre || H.RESP;
  let sh = ss.getSheetByName(nombre);
  if (!sh) sh = ss.insertSheet(nombre);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, C.length).setValues([C]).setFontWeight('bold').setFontColor('#ffffff').setBackground('#3a3a3a').setWrap(true).setVerticalAlignment('middle');
    sh.setFrozenRows(1); sh.setFrozenColumns(3); sh.setRowHeight(1, 90);
    sh.setColumnWidths(1, C.length, 140); sh.setColumnWidth(3, 280);
    sh.getRange('A:A').setNumberFormat('dd/MM/yyyy HH:mm:ss');
  } else {
    const act = sh.getRange(1, 1, 1, C.length).getValues()[0];
    for (let i = 0; i < C.length; i++) if (String(act[i]).trim() !== C[i])
      throw new Error('La fila 1 de «' + nombre + '» no coincide en la columna ' + (i + 1) + '. Esperado: «' + C[i] + '». No se guardó nada.');
  }
  return sh;
}
function hojaPapelera_() {
  const ss = SpreadsheetApp.getActive(), C = ['Fecha de anulación', 'Anulado por', 'Motivo'].concat(cabResp_());
  let sh = ss.getSheetByName(H.PAPELERA);
  if (!sh) { sh = ss.insertSheet(H.PAPELERA); sh.getRange(1, 1, 1, C.length).setValues([C]).setFontWeight('bold').setFontColor('#ffffff').setBackground('#7a3b3b').setWrap(true); sh.setFrozenRows(1); }
  return sh;
}
function respuestaDe_(correo, sh) {
  sh = sh || SpreadsheetApp.getActive().getSheetByName(H.RESP);
  if (!sh || sh.getLastRow() < 2 || !correo) return null;
  const f = sh.getRange(2, 3, sh.getLastRow() - 1, 1).createTextFinder(correo).matchEntireCell(true).findNext();
  return f ? { fila: f.getRow(), valores: sh.getRange(f.getRow(), 1, 1, sh.getLastColumn()).getValues()[0] } : null;
}
const fmtFecha_ = d => d instanceof Date ? Utilities.formatDate(d, ZONA, 'dd/MM/yyyy') : String(d || '');

/* ═════════════════════════ WEB APP ═════════════════════════ */
function doGet(e) {
  const p = (e && e.parameter) || {};
  const accion = p.action || 'ping';
  let out;
  try {
    if (accion === 'ping') {
      const sh = SpreadsheetApp.getActive().getSheetByName(H.RESP), cfg = config_();
      out = { ok: true, servicio: 'encuesta-docentes-plan2026', version_app: VERSION_APP, abierta: abierta_(cfg), periodo: cfg.periodo, respuestas: sh ? Math.max(0, sh.getLastRow() - 1) : 0 };
    } else if (accion === 'validar') out = validar_(p.correo);
    else if (accion === 'verificar') out = { ok: true, id: p.id || '', existe: existeId_(p.id) };
    else if (accion === 'guardar') out = guardar_(JSON.parse(p.data || '{}'));
    else out = { ok: false, error: 'Acción desconocida' };
  } catch (err) { out = { ok: false, error: String(err && err.message || err) }; }
  return responder_(out, p.callback);
}
function doPost(e) {
  let out;
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    out = guardar_(body.data || body);
  } catch (err) { out = { ok: false, error: String(err && err.message || err) }; }
  return responder_(out);
}
function responder_(obj, cb) {
  const json = JSON.stringify(obj);
  if (cb && /^[A-Za-z_$][\w$]{0,80}$/.test(cb)) return ContentService.createTextOutput(cb + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function validar_(correoIn) {
  const cfg = config_();
  if (!abierta_(cfg)) return { ok: true, habilitado: false, motivo: 'cerrada', mensaje: cfg.mensaje };
  const correo = String(correoIn || '').trim().toLowerCase();
  if (!MAIL_RE.test(correo)) return { ok: true, habilitado: false, motivo: 'no_encontrado' };
  const r = buscarDocente_(correo, cfg);
  if (!r.fila) return { ok: true, habilitado: false, motivo: r.motivo };
  const ya = respuestaDe_(correo);
  if (ya) return { ok: true, habilitado: false, motivo: 'ya_respondio', fecha: fmtFecha_(ya.valores[0]) };
  const f = r.fila, nombres = nombresCarreras_();
  return {
    ok: true, habilitado: true, carreras: listaCarrerasPadron_(),
    docente: { nombre: f[2], sede: f[3], sede_nombre: f[4], carrera_cod: f[5], carrera: nombres[f[5]] || f[6], plan: f[8] }
  };
}

function guardar_(d) {
  if (!d || typeof d !== 'object') throw new Error('Datos vacíos');
  const id = txt_(d.id, 60);
  if (!/^(DO|PRUEBA)-[A-Z0-9-]{4,40}$/.test(id)) throw new Error('ID inválido');
  const prueba = id.indexOf('PRUEBA-') === 0;
  const correo = String(d.correo || '').trim().toLowerCase();
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const sh = hojaResp_();
    if (existeId_(id, sh)) return { ok: true, id: id, duplicado: true };
    let fila = null;
    if (prueba) {     // las filas PRUEBA- no se validan: se limitan para que nadie pueda llenar la hoja con ellas
      const ids = sh.getLastRow() > 1 ? sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues() : [];
      if (ids.filter(r => String(r[0]).indexOf('PRUEBA-') === 0).length >= MAX_PRUEBAS) return { ok: false, codigo: 'limite_pruebas' };
    } else {
      const cfg = config_();
      if (!abierta_(cfg)) return { ok: false, codigo: 'cerrada' };
      const r = buscarDocente_(correo, cfg);
      if (!r.fila) return { ok: false, codigo: r.motivo };
      const ya = respuestaDe_(correo, sh);
      if (ya) return { ok: false, codigo: 'ya_respondio', fecha: fmtFecha_(ya.valores[0]) };
      fila = r.fila;
    }
    sh.appendRow(filaResp_(d, id, correo, fila));
    CacheService.getScriptCache().remove('resumen');
    return { ok: true, id: id };
  } finally { lock.releaseLock(); }
}
// Sede, carrera y plan salen del padrón (P), no del cliente. Las opciones se validan contra los catálogos.
function filaResp_(d, id, correo, P) {
  P = P || [correo, 'PRUEBA', '', d.sede_cod, d.sede, d.carrera_cod, d.carrera, '', d.plan, ''];
  const sems = idx_(d.p03_idx, SEMS), acude = idx_(d.p13_idx, ACUDE), r1 = idx_(d.r01_idx, CAT_TEC);
  const r2 = idx_(d.r02_idx, CAT_TEC).filter(n => r1.indexOf(n) >= 0);
  const multi = (idx, ops) => [idx.map(n => ops[n - 1]).join(' | ')].concat(ops.map((_, i) => idx.indexOf(i + 1) >= 0 ? 1 : 0));
  return [
    new Date(), id, correo, P[1], txt_(P[4], 40), txt_(P[3], 10), txt_(P[6], 80), txt_(P[5], 10), P[8]
  ].concat(multi(sems, SEMS)).concat([
    opc_(d.p04, ROLES), opc_(d.p05, MODELO),
    esc_(d.p06), esc_(d.p07), esc_(d.p08), esc_(d.p09), opc_(d.p10, RETRO), esc_(d.p11), esc_(d.p12)
  ]).concat(multi(acude, ACUDE)).concat([
    txt_(d.p14, 1000)
  ]).concat(multi(r1, CAT_TEC)).concat(multi(r2, CAT_TEC)).concat([
    esc_(d.r03), d.r04 === 'NA' ? NO_USA : esc_(d.r04), txt_(d.r05, 500),
    Number(d.dur_s) || '', d.movil ? 'Móvil' : 'Computadora', txt_(d.fecha_local, 40), config_().periodo, txt_(d.version, 10),
    JSON.stringify(d).slice(0, 45000)
  ]);
}
function idx_(v, ops) { const out = []; (Array.isArray(v) ? v : []).map(Number).forEach(n => { if (n >= 1 && n <= ops.length && Math.round(n) === n && out.indexOf(n) < 0) out.push(n); }); return out.sort((a, b) => a - b); }
function opc_(v, ops) { const s = String(v || '').trim(); return ops.indexOf(s) >= 0 ? s : ''; }
function txt_(v, max) { let s = (v === null || v === undefined) ? '' : String(v).trim().slice(0, max || 500); if (/^[=+\-@]/.test(s)) s = "'" + s; return s; }
function esc_(v) { const n = Number(v); return (n >= 1 && n <= 5 && Math.round(n) === n) ? n : ''; }
function siNo_(v) { const s = String(v || '').trim(); return /^s/i.test(s) ? 'Sí' : /^n/i.test(s) ? 'No' : ''; }
function existeId_(id, sh) {
  if (!id) return false;
  sh = sh || SpreadsheetApp.getActive().getSheetByName(H.RESP);
  if (!sh || sh.getLastRow() < 2) return false;
  return !!sh.getRange(2, 2, sh.getLastRow() - 1, 1).createTextFinder(String(id)).matchEntireCell(true).findNext();
}

/* ═════════════════════════ ACCIONES DEL MENÚ ═════════════════════════ */
function menuAbrir() { setConfig_('Encuesta activa', 'SÍ'); bitacora_('Abrir encuesta', ''); aviso_('Encuesta abierta', 'Los docentes ya pueden responder.' + avisoFechas_()); }
function menuCerrar() { setConfig_('Encuesta activa', 'NO'); bitacora_('Cerrar encuesta', ''); aviso_('Encuesta cerrada', 'Nadie puede responder hasta que la abras de nuevo.'); }
function avisoFechas_() { const c = config_(); return (c.apertura || c.cierre) ? '\n(Recuerda que también rigen las fechas de CONFIG.)' : ''; }

function menuActualizarPadron() {
  const r = generarPadron_();
  CacheService.getScriptCache().remove('carreras_padron');
  bitacora_('Actualizar padrón', r.texto);
  aviso_('Padrón actualizado', r.texto);
}
function menuEstado() {
  const ss = SpreadsheetApp.getActive(), cfg = config_();
  const pad = ss.getSheetByName(H.PADRON), resp = ss.getSheetByName(H.RESP);
  const nPad = pad ? Math.max(0, pad.getLastRow() - 1) : 0;
  let nResp = 0;
  if (resp && resp.getLastRow() > 1) nResp = resp.getRange(2, 2, resp.getLastRow() - 1, 1).getValues().filter(r => String(r[0]).indexOf('PRUEBA-') !== 0).length;
  aviso_('Estado de la encuesta',
    'Estado: ' + (abierta_(cfg) ? 'ABIERTA' : 'CERRADA') + '\nPeriodo: ' + cfg.periodo +
    '\nFiltros → planes: ' + (cfg.planes.join(', ') || 'todos') + ' · sedes: ' + (cfg.sedes.join(', ').toUpperCase() || 'todas') +
    ' · carreras: ' + (cfg.carreras.join(', ').toUpperCase() || 'todas') +
    '\nPestañas de origen: ' + cfg.origenes.join(', ') +
    '\n\nHabilitados en el padrón: ' + nPad + '\nRespuestas recibidas: ' + nResp + (nPad ? ' (' + Math.round(nResp / nPad * 100) + '%)' : ''));
}

// Anular = mover la respuesta a PAPELERA (nada se pierde) para que el docente pueda volver a responder.
function menuAnular() {
  const ui = SpreadsheetApp.getUi();
  const correo = pedir_('Anular respuesta', 'Correo institucional del docente cuya respuesta quieres anular:');
  if (!correo) return;
  const sh = SpreadsheetApp.getActive().getSheetByName(H.RESP);
  const r = respuestaDe_(correo, sh);
  if (!r) return aviso_('Sin respuesta', 'No hay una respuesta registrada con el correo:\n' + correo);
  const v = r.valores;
  const motivo = pedir_('Motivo', 'Respuesta encontrada:\n• ' + v[3] + '\n• ' + v[6] + ' · ' + v[4] + '\n• Enviada el ' + fmtFecha_(v[0]) + '\n• ID ' + v[1] + '\n\nEscribe el motivo de la anulación (queda en la bitácora):', true);
  if (motivo === null) return;
  const ok = ui.alert('Confirmar anulación', '¿Anular la respuesta de ' + correo + '?\n\nLa fila se moverá a PAPELERA (se puede restaurar) y el docente podrá responder de nuevo.', ui.ButtonSet.YES_NO);
  if (ok !== ui.Button.YES) return;
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    const actual = respuestaDe_(correo, sh);          // se vuelve a buscar dentro del candado
    if (!actual) return aviso_('Sin cambios', 'La respuesta ya no estaba en RESPUESTAS.');
    hojaPapelera_().appendRow([new Date(), usuario_(), motivo || '(sin motivo)'].concat(actual.valores));
    sh.deleteRow(actual.fila);
  } finally { lock.releaseLock(); }
  bitacora_('Anular respuesta', correo + ' · ID ' + v[1] + ' · motivo: ' + (motivo || '—'));
  aviso_('Respuesta anulada', 'Listo. ' + correo + ' ya puede volver a responder la encuesta.\nLa respuesta anterior quedó en PAPELERA.');
}
function menuRestaurar() {
  const ui = SpreadsheetApp.getUi();
  let id = pedir_('Restaurar respuesta', 'ID de la respuesta a restaurar (columna «ID respuesta» de PAPELERA, ej.: DO-ABC12-XYZ987):');
  if (!id) return;
  id = id.toUpperCase();
  const pap = SpreadsheetApp.getActive().getSheetByName(H.PAPELERA);
  if (!pap || pap.getLastRow() < 2) return aviso_('Papelera vacía', 'No hay respuestas anuladas.');
  const f = pap.getRange(2, 5, pap.getLastRow() - 1, 1).createTextFinder(id.toUpperCase()).matchEntireCell(true).findNext();
  if (!f) return aviso_('No encontrada', 'No hay ninguna respuesta con el ID ' + id + ' en PAPELERA.');
  const fila = pap.getRange(f.getRow(), 1, 1, pap.getLastColumn()).getValues()[0], valores = fila.slice(3, 3 + cabResp_().length), correo = valores[2];
  const resp = hojaResp_();
  if (respuestaDe_(correo, resp)) return aviso_('No se puede restaurar', correo + ' ya tiene una respuesta nueva en RESPUESTAS. Anúlala primero si quieres recuperar la anterior.');
  if (ui.alert('Confirmar', '¿Restaurar la respuesta ' + id + ' de ' + correo + '?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  resp.appendRow(valores); pap.deleteRow(f.getRow());
  bitacora_('Restaurar respuesta', correo + ' · ID ' + id);
  aviso_('Restaurada', 'La respuesta volvió a RESPUESTAS.');
}

function menuExcluir() {
  const correo = pedir_('Excluir docente', 'Correo institucional del docente que NO debe responder:');
  if (!correo) return;
  const motivo = pedir_('Motivo', 'Motivo de la exclusión (ej.: retiro, cambio de carrera):', true);
  if (motivo === null) return;
  const ss = SpreadsheetApp.getActive(), ex = ss.getSheetByName(H.EXCLUIDOS);
  if (excluidos_()[correo]) return aviso_('Ya estaba excluido', correo);
  ex.appendRow([correo, motivo, new Date(), usuario_()]);
  const pad = ss.getSheetByName(H.PADRON);
  if (pad && pad.getLastRow() > 1) { const f = pad.getRange(2, 1, pad.getLastRow() - 1, 1).createTextFinder(correo).matchEntireCell(true).findNext(); if (f) pad.deleteRow(f.getRow()); }
  bitacora_('Excluir docente', correo + ' · ' + motivo);
  const ya = respuestaDe_(correo);
  aviso_('Docente excluido', correo + ' ya no podrá ingresar.' + (ya ? '\n\nOjo: ya tenía una respuesta registrada. Si no debe contar, anúlala con «Anular la respuesta de un docente».' : ''));
}
function menuReincorporar() {
  const correo = pedir_('Reincorporar docente', 'Correo institucional a quitar de EXCLUIDOS:');
  if (!correo) return;
  const ex = SpreadsheetApp.getActive().getSheetByName(H.EXCLUIDOS);
  if (!ex || ex.getLastRow() < 2) return aviso_('Sin excluidos', 'La lista está vacía.');
  const vals = ex.getRange(2, 1, ex.getLastRow() - 1, 1).getValues();
  let n = 0;
  for (let i = vals.length - 1; i >= 0; i--) if (String(vals[i][0]).trim().toLowerCase() === correo) { ex.deleteRow(i + 2); n++; }
  if (!n) return aviso_('No estaba excluido', correo);
  bitacora_('Reincorporar docente', correo);
  aviso_('Reincorporado', correo + ' vuelve a estar habilitado si cumple los filtros de CONFIG (o si está en AGREGADOS). Se sumará al padrón cuando ingrese o al actualizar el padrón.');
}
function menuIrAgregados() {
  const sh = SpreadsheetApp.getActive().getSheetByName(H.AGREGADOS) || hojaSimple_(H.AGREGADOS, CAB_AGREGADOS);
  SpreadsheetApp.getActive().setActiveSheet(sh);
  aviso_('Agregar docentes a mano', 'Escribe una fila por docente (Email, Docente, Sede LPZ/EAT/CBB/SCZ, código de Carrera, Plan de estudios).\nQuienes estén aquí quedan habilitados aunque no cumplan los filtros de CONFIG.\nAl terminar usa «Actualizar padrón de habilitados».');
}

function menuNuevoPeriodo() {
  const ui = SpreadsheetApp.getUi(), ss = SpreadsheetApp.getActive(), cfg = config_();
  const nuevo = pedir_('Nuevo periodo', 'Periodo actual: ' + cfg.periodo + '\n\nLas respuestas actuales se guardarán en la pestaña «RESPUESTAS ' + cfg.periodo + '» y RESPUESTAS quedará vacía.\n\nEscribe el nombre del NUEVO periodo (ej.: I-2027):', true);
  if (!nuevo) return;
  const archivo = 'RESPUESTAS ' + (cfg.periodo || Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd'));
  if (ss.getSheetByName(archivo)) return aviso_('Ya existe', 'Ya hay una pestaña «' + archivo + '». Cambia el nombre del periodo actual en CONFIG y vuelve a intentar.');
  if (ui.alert('Confirmar', '¿Archivar ' + cfg.periodo + ' e iniciar ' + nuevo + '?\n\nDespués revisa en CONFIG los planes, sedes, carreras y pestañas de origen, y actualiza el padrón.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    const resp = ss.getSheetByName(H.RESP);
    resp.copyTo(ss).setName(archivo);
    if (resp.getLastRow() > 1) resp.deleteRows(2, resp.getLastRow() - 1);
    setConfig_('Periodo', nuevo);
  } finally { lock.releaseLock(); }
  crearResumen_();
  bitacora_('Nuevo periodo', cfg.periodo + ' → ' + nuevo + ' (archivo: ' + archivo + ')');
  aviso_('Nuevo periodo iniciado', 'Respuestas de ' + cfg.periodo + ' archivadas en «' + archivo + '».\nAhora: revisa CONFIG → Actualizar padrón → Abrir encuesta.');
}
function menuResumen() { crearResumen_(); aviso_('RESUMEN', 'Pestaña RESUMEN reconstruida.'); }
function menuBorrarPruebas() {
  const sh = SpreadsheetApp.getActive().getSheetByName(H.RESP);
  if (!sh || sh.getLastRow() < 2) return aviso_('Sin filas', 'No hay respuestas.');
  const ids = sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues();
  let n = 0;
  for (let i = ids.length - 1; i >= 0; i--) if (String(ids[i][0]).indexOf('PRUEBA-') === 0) { sh.deleteRow(i + 2); n++; }
  bitacora_('Borrar filas de prueba', n + ' filas');
  aviso_('Filas de prueba', 'Borradas: ' + n);
}

/* ═════════════════════════ RESUMEN (fórmulas vivas) ═════════════════════════ */
function crearResumen_() {
  const ss = SpreadsheetApp.getActive();
  let rs = ss.getSheetByName(H.RESUMEN);
  if (!rs) rs = ss.insertSheet(H.RESUMEN);
  rs.clear();
  sepFormulas_(rs);
  const C = cabResp_();
  const col = t => { const i = C.findIndex(h => h.indexOf(t) === 0); if (i < 0) throw new Error('Columna no encontrada: ' + t); return colLetra_(i + 1); };
  const R = c => H.RESP + '!$' + c + '$2:$' + c;
  const ID = R(col('ID respuesta')), SEDE = R(col('Cód. sede')), CARR = R(col('Cód. carrera'));
  const P = c => H.PADRON + '!$' + c + '$2:$' + c;
  const real = '"<>PRUEBA-*"', W = 7, rows = [], fmt = [];
  const push = (r, t) => { while (r.length < W) r.push(''); rows.push(r); if (t) fmt.push([rows.length, t]); };
  const sedes = Object.keys(SEDES);

  push(['RESUMEN · Encuesta Docentes · Plan 2026'], 'titulo');
  push(['Se actualiza solo. Excluye filas de prueba (ID que empieza con PRUEBA-).'], 'nota');
  push(['']);
  push(['Total de respuestas', '=COUNTIFS(' + ID + ',"<>",' + ID + ',' + real + ')'], 'total');
  push(['Habilitados en el padrón', '=COUNTA(' + P('A') + ')'], 'total');
  push(['Cobertura', '=IFERROR(B4/B5,0)'], 'totalpct');
  push(['']);
  push(['AVANCE POR SEDE', 'Habilitados', 'Respondieron', 'Cobertura'], 'cab');
  sedes.forEach(s => { const r = rows.length + 1; push([SEDES[s], '=COUNTIF(' + P('D') + ',"' + s + '")', '=COUNTIFS(' + P('D') + ',"' + s + '",' + P('L') + ',"Respondió")', '=IFERROR(C' + r + '/B' + r + ',0)'], 'pct4'); });
  push(['']);
  const ESC = [['6.', 'Satisfacción con las experiencias de aprendizaje en sus clases'], ['7.', 'Actividades del DI pertinentes para la asignatura (acuerdo)'], ['8.', 'Actividades del DI pertinentes para el Proyecto Integrador (acuerdo)'],
    ['9.', 'Evaluaciones centradas en la calificación (1 Nunca – 5 Siempre)'], ['11.', 'Satisfacción con las codocencias'], ['12.', 'Coordinación con el docente tutor (1 Nunca – 5 Siempre)'],
    ['RRDDTT 3.', 'Frecuencia de uso de los recursos del DI (1 No los utilizo – 5 En todas o casi todas)'], ['RRDDTT 4.', 'Los recursos ayudan a la enseñanza y el aprendizaje (1 Nada – 5 Mucho)']];
  push(['PROMEDIOS (escala 1 a 5)', 'General'].concat(sedes.map(s => SEDES[s])), 'cab');
  ESC.forEach(q => {
    const c = R(col(q[0] + ' '));
    push([q[0] + ' ' + q[1], '=IFERROR(AVERAGEIFS(' + c + ',' + ID + ',' + real + '),"–")'].concat(sedes.map(s => '=IFERROR(AVERAGEIFS(' + c + ',' + SEDE + ',"' + s + '",' + ID + ',' + real + '),"–")')), 'prom');
  });
  push(['']);
  const dist = (tit, ct, ops) => {
    push([tit, 'N', '%'], 'cab');
    const c = R(col(ct));
    ops.forEach(o => { push([o, '=COUNTIFS(' + c + ',"' + o + '",' + ID + ',' + real + ')', '=IFERROR(B' + (rows.length + 1) + '/$B$4,0)'], 'pct'); });
    push(['']);
  };
  // opción múltiple: suma de las columnas 0/1 («pre.1 », «pre.2 »…)
  const distMulti = (tit, pre, ops) => {
    push([tit, 'N', '% de docentes'], 'cab');
    ops.forEach((c, i) => { const cc = R(col(pre + '.' + (i + 1) + ' ')); push([(i + 1) + '. ' + c, '=SUMIFS(' + cc + ',' + ID + ',' + real + ')', '=IFERROR(B' + (rows.length + 1) + '/$B$4,0)'], 'pct'); });
    push(['']);
  };
  distMulti('3. SEMESTRES EN LOS QUE DA DOCENCIA (puede marcar varios)', '3', SEMS);
  dist('4. ROL DOCENTE', '4. ', ROLES);
  dist('5. ¿CONOCE EL MODELO EDUCATIVO UNIFRANZ?', '5. ', MODELO);
  dist('10. FRECUENCIA DE LA RETROALIMENTACIÓN', '10. ', RETRO);
  distMulti('13. A QUIÉN ACUDE CON DUDAS SOBRE LAS EXPERIENCIAS DE APRENDIZAJE (puede marcar varios)', '13', ACUDE);
  distMulti('RRDDTT 1. RECURSOS INCLUIDOS EN EL DISEÑO INSTRUCCIONAL', 'RRDDTT 1', CAT_TEC);
  distMulti('RRDDTT 2. RECURSOS QUE UTILIZA EFECTIVAMENTE EN CLASE', 'RRDDTT 2', CAT_TEC);
  push(['RRDDTT 3. FRECUENCIA DE USO DE LOS RECURSOS DEL DI', 'N', '%'], 'cab');
  USO.forEach((o, i) => { push([(i + 1) + ' · ' + o, '=COUNTIFS(' + R(col('RRDDTT 3.')) + ',' + (i + 1) + ',' + ID + ',' + real + ')', '=IFERROR(B' + (rows.length + 1) + '/$B$4,0)'], 'pct'); });
  push(['']);
  push(['RRDDTT 4. LOS RECURSOS AYUDAN A LA ENSEÑANZA Y EL APRENDIZAJE', 'N', '%'], 'cab');
  MEDIDA.forEach((o, i) => { push([(i + 1) + ' · ' + o, '=COUNTIFS(' + R(col('RRDDTT 4.')) + ',' + (i + 1) + ',' + ID + ',' + real + ')', '=IFERROR(B' + (rows.length + 1) + '/$B$4,0)'], 'pct'); });
  push([NO_USA, '=COUNTIFS(' + R(col('RRDDTT 4.')) + ',"' + NO_USA + '",' + ID + ',' + real + ')', '=IFERROR(B' + (rows.length + 1) + '/$B$4,0)'], 'pct');
  push(['']);
  push(['POR CARRERA', 'Habilitados', 'Respondieron', 'Cobertura', 'Prom. 6', 'Prom. 11', 'Prom. RRDDTT 4'], 'cab');
  const shC = ss.getSheetByName(H.CARRERAS);
  const cods = shC && shC.getLastRow() > 1 ? shC.getRange(2, 1, shC.getLastRow() - 1, 2).getValues().filter(r => String(r[0]).trim()) : [];
  cods.forEach(rw => {
    const k = String(rw[0]).trim().toUpperCase(), r = rows.length + 1;
    push([k + ' · ' + (rw[1] || k), '=COUNTIF(' + P('F') + ',"' + k + '")', '=COUNTIFS(' + CARR + ',"' + k + '",' + ID + ',' + real + ')', '=IFERROR(C' + r + '/B' + r + ',"–")',
      '=IFERROR(AVERAGEIFS(' + R(col('6. ')) + ',' + CARR + ',"' + k + '",' + ID + ',' + real + '),"–")',
      '=IFERROR(AVERAGEIFS(' + R(col('11. ')) + ',' + CARR + ',"' + k + '",' + ID + ',' + real + '),"–")',
      '=IFERROR(AVERAGEIFS(' + R(col('RRDDTT 4.')) + ',' + CARR + ',"' + k + '",' + ID + ',' + real + '),"–")'], 'carr');
  });

  rs.getRange(1, 1, rows.length, W).setValues(rows.map(r => r.map(v => typeof v === 'string' && v.charAt(0) === '=' ? fx_(v) : v)));
  rs.setColumnWidth(1, 430); rs.setColumnWidths(2, W - 1, 115);
  rs.getRange(1, 1, rows.length, W).setFontFamily('Arial').setFontSize(10).setVerticalAlignment('middle');
  fmt.forEach(f => {
    const n = f[0], t = f[1];
    if (t === 'titulo') rs.getRange(n, 1).setFontSize(14).setFontWeight('bold');
    if (t === 'nota') rs.getRange(n, 1).setFontColor('#777777').setFontStyle('italic');
    if (t === 'total') rs.getRange(n, 1, 1, 2).setFontWeight('bold').setFontSize(12);
    if (t === 'totalpct') rs.getRange(n, 1, 1, 2).setFontWeight('bold').setFontSize(12).setNumberFormat('0.0%');
    if (t === 'cab') rs.getRange(n, 1, 1, W).setFontWeight('bold').setBackground('#3a3a3a').setFontColor('#ffffff');
    if (t === 'pct') rs.getRange(n, 3).setNumberFormat('0.0%');
    if (t === 'pct4') rs.getRange(n, 4).setNumberFormat('0.0%');
    if (t === 'prom') rs.getRange(n, 2, 1, W - 1).setNumberFormat('0.00');
    if (t === 'carr') { rs.getRange(n, 4).setNumberFormat('0.0%'); rs.getRange(n, 5, 1, 3).setNumberFormat('0.00'); }
  });
}

/* ═════════════════════════ UTILIDADES ═════════════════════════ */
function norm_(s) { return String(s === null || s === undefined ? '' : s).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
// Separador de argumentos de las fórmulas: depende de la configuración regional de la hoja
// («,» en inglés; «;» en español y otras con coma decimal). Se prueba escribiendo =SUM(2,5)
// en la celda A1 de una pestaña recién vaciada y se guarda en las propiedades del script.
function sepFormulas_(sh) {
  try {
    const c = sh.getRange(1, 1);
    for (const s of [',', ';']) {
      c.setFormula('=SUM(2' + s + '5)'); SpreadsheetApp.flush();
      if (c.getValue() === 7) { c.clearContent(); PropertiesService.getScriptProperties().setProperty('SEP', s); return s; }
    }
    c.clearContent();
  } catch (e) {}
  return sep_();
}
function sep_() { try { return PropertiesService.getScriptProperties().getProperty('SEP') || ','; } catch (e) { return ','; } }
// Cambia las comas separadoras por «;» si hace falta (las comas dentro de "texto" no se tocan).
function fx_(f) { return sep_() === ',' ? f : f.replace(/("[^"]*")|,/g, (m, q) => q || ';'); }
function colLetra_(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function buscarFila_(sh, clave) {
  if (!sh || sh.getLastRow() < 1) return 0;
  const v = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  for (let i = 0; i < v.length; i++) if (String(v[i][0]).trim() === clave) return i + 1;
  return 0;
}
function usuario_() { try { return Session.getActiveUser().getEmail() || 'administrador'; } catch (e) { return 'administrador'; } }
function bitacora_(accion, detalle) {
  try { const sh = SpreadsheetApp.getActive().getSheetByName(H.BITACORA) || hojaSimple_(H.BITACORA, ['Fecha', 'Usuario', 'Acción', 'Detalle']); sh.appendRow([new Date(), usuario_(), accion, String(detalle || '').slice(0, 2000)]); } catch (e) {}
}
function aviso_(titulo, texto) { try { SpreadsheetApp.getUi().alert(titulo, texto, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) { Logger.log(titulo + '\n' + texto); } }
function pedir_(titulo, texto, crudo) {
  const ui = SpreadsheetApp.getUi(), r = ui.prompt(titulo, texto, ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return null;
  const t = r.getResponseText().trim();
  return crudo ? t : t.toLowerCase();
}
