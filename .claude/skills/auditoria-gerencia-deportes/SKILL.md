---
name: auditoria-gerencia-deportes
description: Auditar Control Gerencia de Deportes (PWA del Club Campestre) — errores de "backend" (Firebase, sincronización, acceso por rol), errores de frontend, experiencia de usuario e interfaz en escritorio y móvil. Usar al pedir revisar, evaluar, auditar o "buscar errores" en el proyecto, o antes/después de preparar un parche.
---

# Auditoría de Control Gerencia de Deportes

PWA sin compilación (HTML + JS + CSS en `index.html`, `js/`, `css/`, `sw.js`, `manifest.json`).
No hay servidor propio: el "backend" son tres proyectos de Firebase Realtime Database
configurados en `js/config.js`:

- `registro-gerencia`: base propia (lee y escribe).
- `fitness-campestre-e218c`: Fitness Control (**solo lectura**, ver `LEEME-vinculo.txt` y `js/vinculo.js`).
- `registro-mantenimiento-9854c`: Control Mantenimiento (lectura en `js/mantenimiento.js`; los profesores
  **sí escriben** sus reportes de equipo en `reportes/` e `historial/` desde `js/mantprof.js`, por diseño).

Roles (`js/auth.js`): Gerencia (`ger`), Dirección (`dir`), Profesor (`prof`), Recepción (`rec`), Metodología (`met`).
Cada cambio se entrega como un `LEEME-parcheN.txt` y sube `VERSION` en `sw.js`.

## Reglas

- **Nunca escribir en las bases reales.** Las pruebas en el navegador se hacen en modo simulación
  (el script copia el proyecto con `CONECTAR_FIREBASE = false`). No cambiar `js/config.js` en el repo.
- Solo se audita: no corregir nada salvo que el usuario lo pida después de ver el informe.
- Cada hallazgo lleva `archivo:línea`, cómo reproducirlo y la corrección propuesta.
- Escribir el informe en español, sin jerga: lo lee la gerencia del club.

## Paso 1 — Revisión estática

```bash
node .claude/skills/auditoria-gerencia-deportes/scripts/revision-estatica.mjs
```

Revisa: sintaxis de cada JS, archivos que faltan en `ARCHIVOS` de `sw.js` (no abrirían sin internet),
referencias rotas en `index.html`, scripts sin `?v=`, `VERSION` contra el último `LEEME-parche`,
`console.log`/`debugger`/`eval`, `innerHTML` con variables y claves guardadas en `localStorage`.
Los avisos de `innerHTML` son pistas: confirmar a mano antes de reportarlos.

## Paso 2 — Prueba en el navegador

```bash
node .claude/skills/auditoria-gerencia-deportes/scripts/prueba-navegador.mjs <scratchpad>/auditoria
```

Entra como Gerencia y Metodología con las contraseñas de fábrica (`DEF_PASS_*` en `js/core.js`),
recorre todas las pestañas en escritorio (1366×900) y móvil (390×844), y como Gerencia abre cada
disciplina. Anota errores de JS y de consola, peticiones fallidas, desbordes horizontales, botones sin
nombre y controles menores de 32 px. Deja capturas `.png` e `informe.json` en la carpeta indicada.

**Mirar las capturas** (con Read) de al menos: login, inicio de cada rol, una disciplina deportiva,
Gimnasio, un área de salud (Nutrición o Fisioterapia) y Ajustes, en las dos medidas. En las capturas de
página completa, la barra inferior del móvil aparece a media página: es efecto de la captura, no un error.

Dirección, Profesor y Recepción no se recorren solos (piden PIN o elegir persona). Si el cambio a revisar
toca esas vistas, probarlas a mano con Playwright sobre la misma copia en simulación.

## Paso 3 — Revisión del "backend" (lectura de código)

Revisar sobre todo `js/core.js`, `js/auth.js`, `js/sincronizacion.js`, `js/vinculo.js`, `js/mantenimiento.js`, `js/mantprof.js`:

1. **Acceso y roles**: que cada rol vea y modifique solo lo suyo (Recepción solo Gimnasio, Profesor solo
   su disciplina, Dirección solo sus áreas). Buscar acciones de `actions` que no revisen `session.rol`.
   Las contraseñas se validan en el navegador con `hashPass` (ofuscación, no criptografía): reportar el
   riesgo una sola vez y revisar si las reglas de Firebase protegen los datos (no están en el repo: preguntar).
2. **Solo lectura de verdad**: ninguna escritura (`set`, `update`, `push`, `remove`, `setPath`) hacia
   la base de Fitness; hacia Mantenimiento solo las de `js/mantprof.js` (reportes del profesor).
3. **Sincronización sin internet**: cola de pendientes (`outbox`), qué pasa si se cierra la app con cambios
   sin subir, conflictos cuando dos personas guardan lo mismo, memoria llena (`memFalla`).
4. **Integridad de datos**: rutas `data/<area>/...` con ids que vengan del usuario, fechas y zonas
   horarias (`toISOString` corre la fecha de noche en México), divisiones entre cero en porcentajes,
   campos que pueden faltar en registros viejos.
5. **Simulación**: que los datos de ejemplo nunca se suban ni se mezclen con los reales.
6. **Llaves y cuota**: claves de API en `config.js` son públicas por diseño en Firebase; lo importante
   son las reglas y no descargar ramas enteras en cada render (cuota de 10 GB/mes del plan gratis).

## Paso 4 — Revisión del frontend

1. **Escape de texto**: todo texto que escribe una persona (nombres, notas, motivos, clientes) debe pasar
   por `esc()` antes de entrar en una plantilla `${...}` que acaba en `innerHTML`, `openModal` o `toast` con HTML.
2. **Render**: `render()` reconstruye `#app` completo; buscar estado que se pierde (foco, scroll, texto a
   medio escribir) y listeners que se agregan en cada render.
3. **Service worker**: archivo nuevo sin agregar a `ARCHIVOS`, `VERSION` sin subir, `?v=` sin subir en
   `index.html` al cambiar un archivo. Cualquiera de estos deja a los usuarios con la versión vieja.
4. **Dependencias externas**: Firebase 10.12.2 desde gstatic, `jsqr.min.js` cargado al vuelo; qué pasa
   si no cargan.

## Paso 5 — Experiencia de usuario e interfaz

Con las capturas y el código:

- **Flujos clave por rol**: pasar lista (Profesor), registrar aforo (Metodología), registrar y agendar un
  personalizado (Gimnasio/Recepción), reportes y comité (Gerencia). ¿Cuántos toques? ¿Se entiende qué
  hacer sin explicación? ¿Hay confirmación antes de borrar?
- **Mensajes**: errores que digan qué pasó y qué hacer; estados vacíos con siguiente paso; avisos de
  sincronización claros (chip de nube).
- **Móvil**: nada se sale de la pantalla, botones de al menos 44 px en lo que se toca seguido,
  teclado numérico en PIN y números, el menú inferior no tapa contenido.
- **Consistencia**: mismos colores, iconos (`js/iconos.js`) y nombres para lo mismo en todas las áreas;
  `app-desktop.css` y `app-mobile.css` sin reglas contradictorias; tema claro y oscuro (Ajustes).
- **Accesibilidad**: contraste de texto sobre el fondo glassmorphism, `aria-label` en botones de solo
  icono, foco visible con teclado.

## Paso 6 — Informe

Guardar `auditoria-AAAA-MM-DD.md` en el scratchpad (no en el repo, salvo que lo pidan) con:

1. **Resumen** en 5 líneas: estado general y las 3 cosas más urgentes.
2. **Hallazgos** en una tabla por gravedad:
   - **Crítico**: pérdida o fuga de datos, la app no abre, un rol ve o cambia lo que no debe.
   - **Alto**: una función principal falla o da datos equivocados.
   - **Medio**: error en un caso poco común, problema de UX que confunde.
   - **Bajo**: detalle visual, texto, limpieza de código.
   Columnas: gravedad · área (backend/frontend/UX/interfaz) · `archivo:línea` · problema · cómo reproducir · corrección propuesta.
3. **Lo que está bien** (breve): para no "corregir" lo que funciona.
4. **Propuesta de siguiente parche**: qué arreglos agrupar y qué archivos tocaría (con el formato de los
   `LEEME-parcheN.txt`: archivos a subir y nueva `VERSION` de `sw.js`).

Mostrar al usuario el resumen y la tabla de críticos y altos; ofrecer corregirlos.
