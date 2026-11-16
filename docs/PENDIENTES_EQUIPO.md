# Lo que el equipo debe hacer antes de entregar la Fase 3

## 0. Estado honesto de lo que se entrega

| Verificado en el entorno donde se generó | NO verificado (lo deben comprobar ustedes) |
|---|---|
| 20 pruebas automáticas de las reglas de negocio de CU-01, CU-02, CU-03 y del inicio de sesión (RF-10) pasan (`cd backend && npm test`) | Que `schema.sql` y las consultas SQL corran en SU PostgreSQL (aquí no había base de datos) |
| Todo el código JavaScript y JSX compila sin errores de sintaxis | Que `npm install` + `npm run dev` levanten en sus máquinas (aquí no había red para instalar paquetes) |
| | Pantallas y mapa en el navegador |

Si algo falla al ejecutar, copien el mensaje de error exacto y pásenselo a Claude para corregirlo.

## 1. Puesta en marcha (30–45 min)

1. Seguir la «Guía de ejecución» del `README.md`.
2. Si `npm run db:setup` falla: revisar `DATABASE_URL` en `backend/.env` (usuario, clave, nombre de la base).
3. Abrir `http://localhost:5173/login` (ciudadanos) o `http://localhost:5173/personal` (entidades y organizaciones) e iniciar sesión con los usuarios de demostración.

## 2. Recorrido de comprobación (sirve como evidencia funcional)

Hagan cada paso y tomen una captura. Resultado esperado entre paréntesis.

**CU-01 (ciudadano@ecoriz.test)**
1. Abrir «Nuevo reporte», permitir ubicación (marcador en el mapa).
2. Elegir un punto junto a 8.9834, -79.5198 (aviso de posible duplicado con RPT-0001 y RPT-0002).
3. Dejar la descripción vacía y pulsar «Revisar y enviar» (error «La descripción es obligatoria.», **A2**).
4. Completar descripción + foto JPEG/PNG → «Revisar y enviar» → «Confirmar envío» (código RPT-000N).
5. Probar una foto de más de 5 MB o un PDF (rechazo).
6. Detener el backend y confirmar el envío (error sin confirmación falsa, **E**).

**CU-02 (entidad@ecoriz.test)**
7. «Validar reportes» → seleccionar RPT-0001 (mapa, foto, reportes cercanos).
8. «Validar» sin prioridad y sin observación (errores de campo).
9. Prioridad Alta + observación → «Validar» (estado Validado).
10. Marcar duplicado de RPT-0001 sobre otro reporte; rechazar otro; «Mantener pendiente» en otro (**A1, A2, A3**).
11. **E2:** abrir el mismo reporte pendiente en dos navegadores (uno con `organizacion@ecoriz.test`); decidir en el primero y luego en el segundo (mensaje de recarga).
12. Ver el historial: abrir `http://localhost:5173/reportes/1` (responsable, fecha y observación).

**CU-03 (entidad@ecoriz.test)**
13. «Crear jornada»: el selector solo lista reportes VALIDADOS.
14. Fecha pasada → «Publicar» (error de fecha, datos conservados, **A2**).
15. Fecha futura + todo completo → «Publicar jornada» (aparece en «Actividades disponibles»).
16. «Guardar borrador» (solo con título) → «Mis borradores» → «Publicar» (**A1**).
17. Jornada «por zona» sin justificación (error) y con justificación (**A3**).
18. Con `organizacion@ecoriz.test`: «Registrar cierre» sobre una jornada de su organización → el reporte pasa a Cerrado (**RF-08**).

**Privacidad (RNF-05):** con `ciudadano2@ecoriz.test` abrir `/reportes/1` (no aparece quién reportó). Con `ciudadano@ecoriz.test` intentar abrir `/bandeja` (redirige) y la API devuelve 403.

## 3. Entregables de la Fase 3 y quién los completa

| Entregable del enunciado | Estado |
|---|---|
| Versión ejecutable | Incluida (backend + frontend) |
| Código / repositorio | **Ustedes:** subirlo a Git (ver sección 4) |
| Configuración y datos necesarios | Incluidos (`.env.example`, `schema.sql`, `seed.js`) |
| Guía de ejecución | `README.md` |
| Evidencia funcional | **Ustedes:** capturas/video del recorrido de la sección 2 |
| Matriz actualizada | `docs/trazabilidad-fase3.md` (revísenla contra su Fase 1) |
| Ajustes justificados | `docs/ajustes-justificados.md` |

## 4. Git

- Creen el repositorio con todo el contenido de esta carpeta y súbanlo (`git init`, `git add .`, `git commit`, `git remote add origin <url>`, `git push`).
- El enunciado evalúa que el trabajo sea colaborativo y gradual. Cada integrante debe hacer commits propios con su usuario real (por ejemplo, uno por módulo: base de datos, CU-01, CU-02, CU-03, frontend, pruebas) y probarlo en su máquina. **No falsifiquen fechas ni autoría de commits**: la profesora puede revisarlo y es una falta académica.
- Si ya tienen repositorio de las Fases 1 y 2, copien esta carpeta dentro de él.

## 5. Uso de IA (obligatorio declararlo)

El enunciado exige declarar el uso relevante de IA y poder explicar todo el código. Texto sugerido para su documento:

> Se usó un asistente de IA (Claude, de Anthropic) para generar el borrador de la implementación de CU-01, CU-02 y CU-03 a partir del diseño de la Fase 2. El equipo ejecutó el sistema, verificó cada flujo con el recorrido de comprobación, revisó el código de forma cruzada y puede explicar cada módulo. Los ajustes respecto al diseño están en `docs/ajustes-justificados.md`.

Solo declárenlo así si es cierto: ejecuten y revisen de verdad.

## 6. Pendientes que dependen de su contexto

- **Hito intermedio del 26 de octubre:** la revisión técnica pudo dejar observaciones. Esta implementación sigue la Fase 2 tal como la subieron; si la profesora pidió cambios, dígannoslos para aplicarlos.
- **Aprobación docente de los 3 CU:** el enunciado la exige antes de implementar; confirmen que la tienen.
- **Fase 1:** la matriz usa los RF/CU de la tabla 7.1 de la Fase 2. Verifiquen que coincidan con su documento de Fase 1.

## 7. Preparación para la defensa individual (cada integrante, cualquier parte)

Lean en este orden el recorrido completo de CU-01 y repitan para CU-02 y CU-03:
`NuevoReportePage.jsx` → `routes/index.js` → `middleware/auth.js` → `reporteController.js` → `reporteService.registrar` → `validators.js` → `reporteRepository.crear` → `schema.sql` (tablas `reporte`, `evidencia`, `historial_estado`) → `test/reglas.test.js`.

Preguntas típicas: ¿por qué se guarda la foto antes de la transacción y se borra si falla (D-04)? ¿cómo evita `version` que dos validadores se pisen (D-07)? ¿qué pasa si se publica una jornada sobre un reporte ya cerrado (A3)? ¿dónde se hace cumplir el rol (D-05)?

## 8. Fase 4 (29 de noviembre)

Las pruebas de `backend/test/reglas.test.js` pueden servir de punto de partida para sus 8–12 casos de prueba, pero la ejecución, los resultados y el ciclo falla → defecto → corrección deben ser reales y documentados por ustedes.
