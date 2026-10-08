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
| `docs/tutorial/` | Guía PDF del administrador **todavía con textos de la encuesta de estudiantes** (pendiente adaptar). No va al repo. |

## Decisiones
- **Población:** docentes del **plan 2026**, con su correo docente `@unifranz.edu.bo` (formato `doc.nombre.apellido.xx@…`).
- **Hoja:** «Copia de Base de datos Docentes 1er semestre P2026», id `1Oc6AAqNByXPWsipnS1rudA-hQAP68qxBO-SsPkEwET8`, configuración regional es_ES (fórmulas con `;`, lo resuelve `fx_`). El script va **ligado a esta hoja**.
- **Base:** pestaña **P26** (~265 docentes, uno por fila): `Docente` (nombre completo en mayúsculas), `CI`, `Sede`, `Carrera`, `Email`, `Plan de estudios`. Las pestañas `Filtrado3/6/7/8` (una fila por docente × asignatura, todos los planes) **no se usan**. CONFIG → Pestañas de origen = `P26`, Planes habilitados = `2026`. La base no tiene semestre ni modalidad: esos filtros se quitaron de CONFIG.
- Preguntas 1 (Sede) y 2 (Carrera) **no se muestran**: salen de P26 (si un docente dicta en varias carreras, cuenta la de P26).
- Payload de perfil: `validar` devuelve `docente:{nombre, sede, sede_nombre, carrera_cod, carrera, plan}` (antes `estudiante`). IDs `DO-…`.
- Claves locales: `encdoc_draft1`, `encdoc_cola1` (distintas de la encuesta de estudiantes).
- Opciones y redacción **textuales** del instrumento (`para preguntas docentes.xlsx`, en el Escritorio de Rafael), incluso «Cúando», «que está dando docencia», «Al finalizar Actividades y evaluaciones». Rafael autorizó pasar a escala Likert donde corresponda:
  - 3 Semestres: múltiple, Primero…Décimo (sin máximo).
  - 4 Rol docente: Docente Tiempo Completo / Docente Tiempo Horario.
  - 5 Modelo Educativo: Sí conozco / Requiero más información.
  - 6, 11: 1–5 Nada satisfecho … Totalmente satisfecho (carita).
  - 7, 8 («son pertinentes»): pasaron a **acuerdo** 1–5 Nada de acuerdo … Totalmente de acuerdo (medidor). El Excel decía «satisfecho».
  - 9, 12: 1–5 Nunca … Siempre (barras).
  - 10 Retroalimentación: el Excel decía «escala 1 a 5» pero da 4 momentos → **opción única** con esos 4 textos.
  - 13 A quién acudes: múltiple (4 opciones). 14: abierta opcional (1000).
  - RRDDTT 1: múltiple, 10 categorías, sin máximo. RRDDTT 2: múltiple, **solo muestra lo marcado en RRDDTT 1** (si se desmarca algo en 1, se quita de 2).
  - RRDDTT 3: escala 1–5 con las 5 frecuencias del instrumento (1 = No los utilizo … 5 = En todas o casi todas las clases).
  - RRDDTT 4: escala 1–5 Nada/Poco/Moderadamente/Bastante/Mucho + botón aparte «No los he utilizado» (se guarda como texto y no cuenta en el promedio).
  - RRDDTT 5: abierta opcional (500).
- RESPUESTAS: múltiples = columna de texto «A | B» + una columna 0/1 por opción (`3.1 …`, `13.1 …`, `RRDDTT 1.1 …`, `RRDDTT 2.1 …`). RESUMEN suma esas columnas.

## Contrato app ↔ script
- `GET ?action=ping` → `{ok, servicio:'encuesta-docentes-plan2026', version_app, abierta, periodo, respuestas}`
- `GET ?action=validar&correo=` → `{ok, habilitado:true, docente:{…}, carreras}` o `{ok, habilitado:false, motivo, fecha?, mensaje?}`
- `GET ?action=verificar&id=` → `{ok, existe}`
- `POST {action:'guardar', data:{id, correo, …, p03, p03_idx, p04, p05, p06…p12, p13, p13_idx, p14, r01, r01_idx, r02, r02_idx, r03, r04 (1–5 o 'NA'), r05, dur_s, movil, fecha_local, version}}`. El script usa los `_idx` y valida los textos contra sus catálogos; sede/carrera/plan salen del padrón.

## Estado y pendientes (08-oct-2026)
- [x] App v1.0 y script v1.0 escritos; pruebas locales OK (390 px, 1366 px, hoja simulada en inglés y español).
- [ ] Rafael pega el script en la hoja de docentes, corre `configuracionInicial`, implementa y pasa la URL `/exec`.
- [ ] Incrustar la URL en `API_URL_DEFECTO`, crear repo `UNIFRANZ-BO/encuesta-docentes` + Pages, repartir `?v=1`.
- [ ] Prueba real (ping, fila de prueba, correo real de P26, anular, borrar pruebas).
- [ ] Adaptar la guía PDF (`docs/tutorial/`).

## Comandos
```bash
export PATH="/c/Program Files/nodejs:$PATH"; export PYTHONIOENCODING=utf-8
python build.py
node tests/backend.test.js && SEP=";" node tests/backend.test.js
python tests/e2e_test.py 390 && python tests/e2e_test.py 1366
```
