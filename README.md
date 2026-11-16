# Ecoriz · Fase 3 (Implementación)

Implementación de extremo a extremo de los tres casos de uso seleccionados en la Fase 1 y diseñados en la Fase 2:

| CU | Nombre | Pantalla | Endpoint(s) |
|----|--------|----------|-------------|
| CU-01 | Registrar reporte | `NuevoReportePage` | `GET /api/reportes/cercanos`, `POST /api/reportes` |
| CU-02 | Validar y clasificar reporte | `BandejaValidacionPage` | `GET /api/reportes`, `GET /api/reportes/:id`, `POST /api/reportes/:id/decisiones` |
| CU-03 | Coordinar jornada | `CrearJornadaPage`, `JornadasPage` | `POST /api/jornadas`, `PUT /api/jornadas/:id`, `POST /api/jornadas/:id/publicar`, `POST /api/jornadas/:id/cierre` |

Arquitectura (Fase 2): cliente React (SPA) → API REST Node.js + Express (monolito modular: controlador → servicio → repositorio) → PostgreSQL + carpeta de archivos para las fotos.

## Requisitos

- Node.js 18 o superior (recomendado 20/22)
- PostgreSQL 14 o superior
- Un navegador moderno

## Guía de ejecución

### 1. Base de datos

```bash
# Crear la base (ajusta usuario/clave a tu instalación)
psql -U postgres -c "CREATE DATABASE ecoriz;"
```

### 2. Backend

```bash
cd backend
cp .env.example .env        # en Windows: copy .env.example .env
# Edita .env: DATABASE_URL (usuario y clave de tu PostgreSQL) y JWT_SECRET
npm install
npm run db:setup            # crea las 7 tablas y carga los datos de demostración
npm run dev                 # API en http://localhost:3000  (prueba: /api/salud)
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

### Dos accesos

| Acceso | Dirección | Quién entra |
|--------|-----------|-------------|
| Ciudadanos | `http://localhost:5173/login` | Cuentas `CIUDADANO` |
| Personal (panel de gestión) | `http://localhost:5173/personal` | Cuentas `ENTIDAD` y `ORGANIZACION` |

Son pantallas separadas: ninguna enlaza a la otra, y sin sesión la aplicación siempre redirige a `/login`. El personal entra con la dirección `/personal` (conviene guardarla en favoritos). Si una cuenta entra por el acceso que no le corresponde, el servidor responde lo mismo que con una clave errónea (401 «Correo o contraseña incorrectos»), así no revela que existe el otro acceso.

### Usuarios de demostración (clave de todos: `Ecoriz2026!`)

| Correo | Rol | Acceso | Para qué |
|--------|-----|--------|----------|
| ciudadano@ecoriz.test | CIUDADANO | Ciudadanos | CU-01 (registrar reporte) |
| ciudadano2@ecoriz.test | CIUDADANO | Ciudadanos | Ver un reporte ajeno (RNF-05) |
| entidad@ecoriz.test | ENTIDAD (Alcaldía de Panamá) | Personal | CU-02 y CU-03 |
| organizacion@ecoriz.test | ORGANIZACION (Fundación Panamá Recicla) | Personal | CU-02, CU-03 y cierre de jornadas de su organización |

Datos de demostración: 3 reportes PENDIENTES (dos están a ~15 m entre sí, para ver el aviso de posible duplicado) y 2 reportes VALIDADOS (para crear jornadas).

### Pruebas automáticas de reglas de negocio

```bash
cd backend && npm test      # 20 pruebas, no requieren base de datos
```

Usan repositorios en memoria (`backend/test/fakes.js`) para comprobar las reglas de los tres CU: validaciones, flujos alternativos, excepciones, control de versión, transacciones y privacidad. Las dos últimas cubren los dos accesos de inicio de sesión (RF-10).

## Estructura

```
backend/
  database/schema.sql, reset.sql      Modelo de datos (Figura 9)
  scripts/initDb.js, seed.js          Crear tablas y datos de demostración
  src/
    config/        env.js, db.js (pool + withTransaction)
    middleware/    auth.js (JWT + roles, D-05/D-10), errorHandler.js
    routes/        index.js (tabla 6.1 de la Fase 2)
    controllers/   capa HTTP delgada
    services/      reglas de negocio: reporteService, validacionService, jornadaService, authService
    repositories/  único código que toca la BD o el disco
    utils/         validators.js (D-09), errors.js
  test/            pruebas de reglas con repositorios simulados
frontend/src/
  pages/           NuevoReporte, BandejaValidacion, CrearJornada, Jornadas, ReporteDetalle, Login
  components/      Layout, MapaReportes (Leaflet + OpenStreetMap)
  api.js, auth.jsx cliente HTTP y sesión
docs/
  trazabilidad-fase3.md      matriz RF → CU → diseño → archivo/función
  ajustes-justificados.md    cambios respecto al diseño de la Fase 2
  PENDIENTES_EQUIPO.md       lo que el equipo debe hacer/verificar antes de entregar
```

## Despliegue

Para la demostración basta con `npm run dev` en ambas carpetas. El frontend reenvía `/api` y `/uploads` al backend mediante el proxy de Vite (`frontend/vite.config.js`).
