# Encuesta Docentes · Plan 2026 · II/2026 — UNIFRANZ

Proyecto de Rafael Aramayo (UNIFRANZ, Cochabamba). Hermana de la Encuesta de Seguimiento de estudiantes
(`../encuesta-seguimiento`, cuyo CLAUDE.md explica la arquitectura y las lecciones; se aplican todas).
Creada el 08-oct-2026 desde la plantilla del skill `encuesta-app-unifranz`. Léelo completo antes de tocar código.

## Cómo trabaja Rafael
- Prefiere ejecución directa, poco ida y vuelta y justificaciones breves. No es programador: pasos exactos y qué NO tocar.
- Todo en **castellano neutro** (tú), nunca voseo.
- Aspecto profesional en Sheets: encabezados gris oscuro `#3a3a3a`.

## Estructura
| Ruta | Qué es |
|---|---|
| `src.html` | **Fuente de la app.** Se edita aquí (`__LOGO_FULL__`/`__LOGO_WORD__` = marcadores). |
| `build.py` | Genera `index.html` y valida el JS con `node --check`. Correr siempre tras editar `src.html`. |
| `index.html` | Archivo que se publica. **No editar a mano.** |
| `apps-script/Codigo.gs` | Backend (web app + menú «Encuesta»). |
| `tests/backend.test.js` | Hoja simulada con una pestaña tipo P26. Falla si la fila no coincide con la cabecera. |
| `tests/e2e_test.py` | Recorrido completo (Playwright). `python tests/e2e_test.py 390` y `… 1366`. |
| `docs/tutorial/` | Fuente de la guía PDF del administrador (`build_pdf.py`). No va al repo. |

## Decisiones
- **Población:** docentes del **plan 2026**, con su correo docente `@unifranz.edu.bo` (formato `doc.nombre.apellido.xx@…`).
- **Hoja (desde 22-oct-2026):** «Encuestas docentes Unifranz» en la cuenta **@unifranz** (`rafael.aramayo@unifranz.edu.bo`), id `1WiSS7_0xsmErRF15VP6EW42127GxNgSUFFP2Pv6L058`, es_ES (fórmulas con `;`, lo resuelve `fx_`). El script va **ligado a esta hoja**. La pestaña P26 la cargué yo desde `base docentes.xlsx` (Escritorio, hoja BASEDEDATOSDOC; encabezado `Plan_estudios` renombrado a «Plan de estudios», que es el alias que reconoce el script). Hay una «Hoja 1» vacía que no se usa.
  - Hoja anterior (cuenta personal, ya no se usa, respaldo): «Copia de Base de datos Docentes 1er semestre P2026», `1Oc6AAqNByXPWsipnS1rudA-hQAP68qxBO-SsPkEwET8`, script `AKfycbxu8VQnHKLX…tl53`.
  - **Los conectores de Google (Sheets y Drive) de Claude ahora están en la cuenta @unifranz**: ya no ven la hoja personal.
- **Base:** pestaña **P26** (239 docentes, uno por fila): `Docente` (nombre completo en mayúsculas), `CI`, `Sede`, `Carrera`, `Email`, `Plan de estudios`. Las pestañas `Filtrado3/6/7/8` (una fila por docente × asignatura, todos los planes) **no se usan**. CONFIG → Pestañas de origen = `P26`, Planes habilitados = `2026`. La base no tiene semestre ni modalidad: esos filtros se quitaron de CONFIG.
- Preguntas 1 (Sede) y 2 (Carrera) **no se muestran**: salen de P26 (si un docente dicta en varias carreras, cuenta la de P26).
- Payload de perfil: `validar` devuelve `docente:{nombre, sede, sede_nombre, carrera_cod, carrera, plan}` (antes `estudiante`). IDs `DO-…`.
- Claves locales: `encdoc_draft1`, `encdoc_cola1` (distintas de la encuesta de estudiantes).
- **v1.1 (22-oct-2026):** Rafael pasó `preguntas.xlsx` (Escritorio; columna F = sugerencias, «respetar la base de preguntas y respuestas, se pueden optimizar las respuestas») y aprobó además mis mejoras de redacción. Textos vigentes:
  - 3 «Selecciona los semestres en los que estás dando docencia»: múltiple, Primero…Décimo (sin máximo).
  - 4 «¿Cuál es tu rol docente?»: Docente Tiempo Completo / Docente Tiempo Horario.
  - 5 «¿Conoces el Modelo Educativo UNIFRANZ?»: Sí, lo conozco / Requiero más información.
  - 6, 11 «¿Qué tan satisfecho estás con…?»: 1–5 Nada satisfecho … Totalmente satisfecho (carita).
  - 7 «…del diseño instruccional (DI)… competencias de la asignatura?» y 8 «…desafío educativo del Proyecto Integrador?»: **acuerdo** 1–5 (medidor). El Excel dice «satisfecho»; se mantiene acuerdo.
  - 9 (v1.2, 22-oct, pedido de Rafael): «¿Sientes que tus evaluaciones se están enfocando en la calificación (notas) o en el aprendizaje que desarrollas?» → binaria **1. Notas / 2. Aprendizaje** (como la de estudiantes). Se guarda el texto; RESUMEN muestra su distribución (ya no está en promedios).
  - 12: 1–5 Nunca … Siempre (barras).
  - 10 Retroalimentación: tipo `level` 1–5 (columna F, con el 3 completado): Nunca realizo retroalimentación · Al finalizar cada hito · Al finalizar las evaluaciones · Al finalizar actividades y evaluaciones · En todas mis clases. Tiene promedio en RESUMEN.
  - 13 «Cuando tienes dudas sobre las experiencias de aprendizaje, ¿a quién acudes?»: múltiple (4). 14: abierta opcional (1000).
  - RRDDTT 1: múltiple, 10 categorías, sin máximo. RRDDTT 2: múltiple, **solo muestra lo marcado en RRDDTT 1** + **«Ninguno»** excluyente (índice 99 en la app, `r02_ninguno:true` en el payload): salta RRDDTT 3 y 4 y las guarda como 1 «No los utilizo» y «No los he utilizado» (el script lo fuerza).
  - RRDDTT 3 y 4: tipo **`level`** (lista con letra y medidor de rayas, **sin números**; se guarda 1–5).
    - RRDDTT 3: En todas o casi todas mis clases (5) … No los utilizo (1).
    - RRDDTT 4: No me ayudan (1) · Me ayudan poco · moderadamente · bastante · Me ayudan mucho (5) + «No los he utilizado» (texto, fuera del promedio).
  - RRDDTT 5 «¿Tienes sugerencias de recursos tecnológicos o didácticos, o algún comentario?»: abierta opcional (500).
- RESPUESTAS: múltiples = columna de texto «A | B» + una columna 0/1 por opción (`3.1 …`, `13.1 …`, `RRDDTT 1.1 …`, `RRDDTT 2.1 …`). RESUMEN suma esas columnas.

## Contrato app ↔ script
- `GET ?action=ping` → `{ok, servicio:'encuesta-docentes-plan2026', version_app, abierta, periodo, respuestas}`
- `GET ?action=validar&correo=` → `{ok, habilitado:true, docente:{…}, carreras}` o `{ok, habilitado:false, motivo, fecha?, mensaje?}`
- `GET ?action=verificar&id=` → `{ok, existe}`
- `POST {action:'guardar', data:{id, correo, …, p03, p03_idx, p04, p05, p06…p12 (p10 = 1–5), p13, p13_idx, p14, r01, r01_idx, r02, r02_idx, r02_ninguno, r03, r04 (1–5 o 'NA'), r05, dur_s, movil, fecha_local, version}}`. El script usa los `_idx` y valida los textos contra sus catálogos; sede/carrera/plan salen del padrón.

## Publicación
- **URL del script:** implementación `AKfycbxnS5AIBBrpoV…q59Wg` (cuenta @unifranz, 22-oct-2026), incrustada en `API_URL_DEFECTO`.
- **Repo:** `UNIFRANZ-BO/encuesta-docentes` (público, Pages en `main`, raíz) → enlace vigente **https://unifranz-bo.github.io/encuesta-docentes/?v=4** (v=4: v1.2, pregunta 9 Notas/Aprendizaje)
- Guía PDF del administrador: `entregables/Guia_hoja_encuesta_docentes.pdf` (generada con `python docs/tutorial/build_pdf.py`; `docs/tutorial/` y `entregables/` no van al repo).

## Estado y pendientes (22-oct-2026)
- [x] v1.2 publicada (`?v=4`) y **script v1.2 implementado** (ping `version_app:"1.2"`). Padrón actualizado: 239. Guardado verificado desde la página publicada (`PRUEBA-MVJXF70K`: 9 = «Aprendizaje», 5 = «Sí, lo conozco»).
- [x] Rafael hizo una respuesta real de prueba (Vannia Villarroel) y la anuló (está en PAPELERA).
- [ ] Rafael: **Reconstruir RESUMEN** (aún muestra la 9 vieja en promedios) y **Borrar filas de prueba** (quedan `PRUEBA-V12152025` —con «5» vacío y «Ingeniería» mal escrita porque la mandé con curl desde la consola de Windows, no es un error del sistema— y `PRUEBA-MVJXF70K`).
- [ ] Rafael: cerrar la encuesta en la hoja vieja de la cuenta personal.
- [ ] Opcional ofrecido: verificar el correo en segundo plano mientras el docente lo escribe (solo app).

## Velocidad (22-oct-2026)
- Medido: `ping` ~2,5 s (costo fijo de Apps Script; 4–7 s el 22-oct por la tarde con la cuenta @unifranz), `validar` 3,5–4,9 s; la primera llamada tras un rato sin uso es más lenta (arranque en frío).
- v1.2: la app hace un `ping` silencioso al abrir la bienvenida (el servidor ya está despierto cuando el docente escribe su correo) y `validar` ya no arma la lista de carreras (la app de docentes no la usa).
- Con PADRON vacío, `validar` busca en vivo en P26 y agrega la fila a PADRON (más lento): por eso hay que correr **Actualizar padrón**.
- Al cambiar un título de RESPUESTAS en el script hay que cambiar también la fila 1 de RESPUESTAS y de PAPELERA (columna +3), o `hojaResp_` deja de guardar. Lo hice con el conector de Sheets (Z1 y AC1).

## Comandos
```bash
export PATH="/c/Program Files/nodejs:$PATH"; export PYTHONIOENCODING=utf-8
python build.py
node tests/backend.test.js && SEP=";" node tests/backend.test.js
python tests/e2e_test.py 390 && python tests/e2e_test.py 390 ninguno && python tests/e2e_test.py 1366
```
