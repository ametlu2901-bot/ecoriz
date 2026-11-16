# Ajustes respecto al diseño de la Fase 2 (justificados)

El enunciado pide «registrar ajustes justificados» entre diseño y código. Estos son los únicos cambios.

| # | Ajuste | Justificación |
|---|--------|---------------|
| 1 | La tabla `JORNADA` agrega `zona` y `justificacion_zona` | El flujo A3 de CU-03 permite crear una jornada «por zona» sin reporte vinculado. La Figura 9 solo tenía `reporte_id` opcional y no había dónde guardar la zona ni su justificación. |
| 2 | Se agrega `GET /api/organizaciones` (ruta auxiliar) | La pantalla de CU-03 (Figura 12) tiene la lista «Organización responsable»; necesita sus datos. No estaba en la tabla 6.1. |
| 3 | `POST /api/jornadas` recibe `accion` (`PUBLICAR` o `BORRADOR`) | La Figura 6 decide publicar o guardar borrador en el mismo paso del flujo; así se evita un segundo endpoint para crear borradores. `PUT /api/jornadas/{id}` y `POST /api/jornadas/{id}/publicar` quedan como en la tabla 6.1. |
| 4 | `POST /api/reportes/{id}/decisiones` acepta `duplicadoDeCodigo` (p. ej. `RPT-0153`) además de `duplicadoDeId` | La pantalla de CU-02 (Figura 11) pide el reporte relacionado por código `RPT-____`, no por id interno. |
| 5 | `HISTORIAL_ESTADO.decision` también guarda `REGISTRO` y `CIERRE_JORNADA` | El historial debe cubrir todo cambio de estado (registro en CU-01 y cierre en RF-08), no solo las decisiones del validador. |
| 6 | El filtro `zona` de `GET /api/reportes` usa el formato `lat,lng,radioEnMetros` | `REPORTE` no tiene una columna «zona»; se interpreta como un círculo geográfico. La pantalla actual filtra por estado, tipo y fecha. |
| 7 | `bcryptjs` (bcrypt en JavaScript puro) en lugar de `bcrypt` | Mismo algoritmo y formato de hash; evita compilar módulos nativos en las máquinas del equipo. |
| 8 | Las fotos se sirven desde `/uploads` con nombre aleatorio (UUID) | Cumple D-04 (archivos fuera de la BD). Queda como mejora futura servirlas con autenticación. |
| 9 | Borradores: solo los ve su creador | Aplica RF-06 (solo jornadas publicadas son visibles para todos) y evita exponer datos incompletos. |
| 10 | Dos pantallas de inicio de sesión: `/login` (ciudadanos) y `/personal` (entidades y organizaciones). `POST /api/auth/login` acepta `acceso` (`CIUDADANO` o `PERSONAL`); si la cuenta no corresponde responde lo mismo que con clave errónea (401 `CREDENCIALES_INVALIDAS`) | El ciudadano y el personal usan la plataforma para cosas distintas (reportar frente a validar y coordinar). Las pantallas no se enlazan entre sí y sin sesión siempre se redirige a `/login`, para no anunciar el acceso del personal en la parte pública; tampoco el mensaje de error revela que existe. Es una medida adicional: la protección real sigue siendo la contraseña y la autorización por rol en el servidor (D-05). Sin `acceso` el endpoint se comporta como antes. |
