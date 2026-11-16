# Matriz de trazabilidad actualizada (Fase 3)

RF → CU → componente de diseño → **módulo / archivo / función identificable**. Los RF y CU se toman de la tabla 7.1 de la Fase 2.

| RF | CU | Implementado | Frontend | Backend (ruta → controlador → servicio → repositorio) | Datos | Pruebas automáticas (`backend/test/reglas.test.js`) |
|----|----|--------------|----------|------------------------------------------------------|-------|------|
| RF-01 | CU-01 | **Sí** | `frontend/src/pages/NuevoReportePage.jsx` (`validar`, `revisar`, `confirmar`) | `POST /api/reportes` (`routes/index.js`) → `reporteController.crear` → `reporteService.registrar` → `reporteRepository.crear`, `evidenciaRepository.crear`, `evidenciaStorage.guardar/eliminar`; validación `validators.validarNuevoReporte` | tablas `reporte`, `evidencia` | «CU-01 flujo principal», «CU-01 A2», «foto obligatoria…», «ubicación inválida…», «CU-01 E1/E2 … ROLLBACK» |
| RF-02 | CU-01, CU-02, CU-04 | **Sí** | `pages/ReporteDetallePage.jsx` | `GET /api/reportes/:id` → `reporteController.obtener` → `reporteService.obtener`; `GET /api/reportes/:id/historial` → `reporteService.historial` → `historialRepository.agregar/listarPorReporte` | tabla `historial_estado` (trigger de solo agregado) | «RNF-05 …», comprobaciones de historial en CU-02 |
| RF-03 | CU-02 | **Sí** | `pages/BandejaValidacionPage.jsx` (`BandejaValidacionPage`, `PanelDecision.decidir`) | `GET /api/reportes` → `reporteService.listar` → `reporteRepository.listar`; `POST /api/reportes/:id/decisiones` → `validacionController.decidir` → `validacionService.decidir` → `reporteRepository.actualizarEstado`, `historialRepository.agregar` | `reporte.version`, `reporte.estado` | «CU-02 validar…», «observación obligatoria», «A1/A2/A3», «duplicado de sí mismo», «E2 … 409», «ya decidido (422)» |
| RF-04 | CU-01, CU-02, CU-04 | **Parcial** (mapa en CU-01 y CU-02) | `components/MapaReportes.jsx` | `GET /api/reportes/cercanos` → `reporteController.cercanos` → `reporteService.cercanos` → `reporteRepository.listarAbiertosCerca` | índice `idx_reporte_ubicacion` | (consulta SQL; se verifica manualmente, ver PENDIENTES) |
| RF-05 | CU-03 | **Sí** | `pages/CrearJornadaPage.jsx` | `POST /api/jornadas` → `jornadaController.crear` → `jornadaService.crear` → `jornadaRepository.crear`; validación `validators.validarJornada` | tabla `jornada` | «CU-03 publica…», «A2 fecha pasada», «A3 reporte PENDIENTE… 422», «A3 sin reporte… zona» |
| RF-06 | CU-03, CU-08 | **Sí** | `pages/JornadasPage.jsx` (`publicar`, vista «Actividades disponibles») | `POST /api/jornadas/:id/publicar` → `jornadaService.publicar`; `GET /api/jornadas?estado=PUBLICADA` → `jornadaService.listar` → `jornadaRepository.listar` | `jornada.estado` | «CU-03 A1 borrador … publicarlo después revalida» |
| RF-07 | CU-05 | No (diseño a nivel de módulo) | — | — | tabla `participacion` creada en `schema.sql` | — |
| RF-08 | CU-03 | **Sí** (opcional en el diseño) | `pages/JornadasPage.jsx` (`cerrar`) | `POST /api/jornadas/:id/cierre` → `jornadaService.cerrar` → `jornadaRepository.cerrar`, `reporteRepository.actualizarEstado`, `historialRepository.agregar` (misma transacción) | `jornada.resultado`, `jornada.fecha_cierre` | «CU-03 RF-08 …» |
| RF-09 | CU-06 | No (diseño a nivel de módulo) | — | — | — | — |
| RF-10 | CU-07 | **Parcial** (inicio de sesión con acceso de ciudadanos y del personal, y roles) | `pages/LoginPage.jsx` (`acceso` CIUDADANO en `/login`, PERSONAL en `/personal`), `auth.jsx`, `components/Layout.jsx`, `api.js` (`loginPorRol`) | `POST /api/auth/login` → `authController.login` → `authService.login` (`ACCESOS`) → `usuarioRepository`; `middleware/auth.js` (`crearAutenticacion`, `autorizar`) | tablas `usuario`, `organizacion` | «RF-10: cada acceso admite solo sus cuentas…», «RF-10: un acceso desconocido es 400…» |

## RNF → implementación

| RNF | Dónde se cumple |
|-----|-----------------|
| RNF-01 (registro en ≤ 3 min) | Formulario de una pantalla con ubicación automática y validación inmediata (`NuevoReportePage.jsx`) |
| RNF-02 (rendimiento) | Fotos fuera de la BD (`evidenciaStorage.js`), índices (`schema.sql`), paginación de 10 en `reporteRepository.listar` |
| RNF-03 (disponibilidad) | Fuera del alcance del código (despliegue administrado) |
| RNF-04 (seguridad) | `middleware/auth.js` (JWT, roles), hash de contraseñas con bcrypt en `authService.login` |
| RNF-05 (privacidad) | `reporteService.obtener`: el ciudadano no recibe `reportante` de reportes ajenos; `cercanos` no incluye datos personales |
| RNF-06 (integridad) | `withTransaction` (`config/db.js`), `CHECK`/triggers (`schema.sql`), control de versión `reporteRepository.actualizarEstado` |
| RNF-07 (compatibilidad) | SPA responsive en React (`styles.css`) |
| RNF-08 (accesibilidad) | Etiquetas `label`/`htmlFor` en cada campo, `role="alert"` en errores, foco visible |

> Esta matriz debe ampliarse en la Fase 4 con las columnas «prueba» y «resultado».
