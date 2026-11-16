-- Ecoriz · Modelo de datos (Figura 9 de la Fase 2) · PostgreSQL
-- Ajustes respecto a la Figura 9 (ver docs/ajustes-justificados.md):
--   * JORNADA agrega zona y justificacion_zona (flujo A3 de CU-03: jornada "por zona")
--   * HISTORIAL_ESTADO.decision registra el origen del cambio (REGISTRO, VALIDAR, CIERRE_JORNADA...)

CREATE TABLE organizacion (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(120) NOT NULL,
  tipo        VARCHAR(20)  NOT NULL CHECK (tipo IN ('ENTIDAD','ORGANIZACION','UNIVERSIDAD')),
  verificada  BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE TABLE usuario (
  id              SERIAL PRIMARY KEY,
  nombre          VARCHAR(120) NOT NULL,
  correo          VARCHAR(160) NOT NULL UNIQUE,
  hash_contrasena VARCHAR(100) NOT NULL,
  rol             VARCHAR(20)  NOT NULL CHECK (rol IN ('CIUDADANO','ENTIDAD','ORGANIZACION','UNIVERSIDAD','ADMIN')),
  organizacion_id INT REFERENCES organizacion(id),
  activo          BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE SEQUENCE reporte_codigo_seq START 1;

CREATE TABLE reporte (
  id              SERIAL PRIMARY KEY,
  codigo          VARCHAR(12) NOT NULL UNIQUE,
  usuario_id      INT NOT NULL REFERENCES usuario(id),
  tipo_residuo    VARCHAR(30),
  descripcion     TEXT NOT NULL CHECK (length(btrim(descripcion)) > 0),
  latitud         NUMERIC(9,6) NOT NULL CHECK (latitud BETWEEN -90 AND 90),
  longitud        NUMERIC(9,6) NOT NULL CHECK (longitud BETWEEN -180 AND 180),
  estado          VARCHAR(12) NOT NULL DEFAULT 'PENDIENTE'
                  CHECK (estado IN ('PENDIENTE','VALIDADO','RECHAZADO','DUPLICADO','CERRADO')),
  prioridad       VARCHAR(8) CHECK (prioridad IN ('ALTA','MEDIA','BAJA')),
  duplicado_de_id INT REFERENCES reporte(id),
  version         INT NOT NULL DEFAULT 1,
  fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (duplicado_de_id IS NULL OR duplicado_de_id <> id)
);
CREATE INDEX idx_reporte_estado_fecha ON reporte (estado, fecha_creacion);
CREATE INDEX idx_reporte_ubicacion    ON reporte (latitud, longitud);

CREATE TABLE evidencia (
  id            SERIAL PRIMARY KEY,
  reporte_id    INT NOT NULL REFERENCES reporte(id),
  ruta_archivo  VARCHAR(200) NOT NULL,
  tipo_mime     VARCHAR(20)  NOT NULL CHECK (tipo_mime IN ('image/jpeg','image/png')),
  tamano_bytes  INT NOT NULL CHECK (tamano_bytes > 0 AND tamano_bytes <= 5242880),
  fecha_subida  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_evidencia_reporte ON evidencia (reporte_id);

CREATE TABLE historial_estado (
  id              SERIAL PRIMARY KEY,
  reporte_id      INT NOT NULL REFERENCES reporte(id),
  responsable_id  INT NOT NULL REFERENCES usuario(id),
  estado_anterior VARCHAR(12),
  estado_nuevo    VARCHAR(12) NOT NULL,
  decision        VARCHAR(20) NOT NULL,
  observacion     TEXT NOT NULL CHECK (length(btrim(observacion)) > 0),
  fecha           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_historial_reporte ON historial_estado (reporte_id, fecha);

-- D-06: el historial solo se agrega; la base de datos rechaza UPDATE y DELETE
CREATE OR REPLACE FUNCTION historial_solo_agrega() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'historial_estado es de solo agregado (D-06)';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_historial_solo_agrega
  BEFORE UPDATE OR DELETE ON historial_estado
  FOR EACH ROW EXECUTE FUNCTION historial_solo_agrega();

CREATE TABLE jornada (
  id                 SERIAL PRIMARY KEY,
  reporte_id         INT REFERENCES reporte(id),
  organizacion_id    INT REFERENCES organizacion(id),
  creador_id         INT NOT NULL REFERENCES usuario(id),
  titulo             VARCHAR(150) NOT NULL,
  tipo               VARCHAR(12) NOT NULL DEFAULT 'LIMPIEZA' CHECK (tipo IN ('LIMPIEZA','RECICLAJE')),
  fecha_hora         TIMESTAMPTZ,
  punto_encuentro    VARCHAR(200),
  detalles           TEXT,
  zona               VARCHAR(120),
  justificacion_zona TEXT,
  estado             VARCHAR(10) NOT NULL DEFAULT 'BORRADOR' CHECK (estado IN ('BORRADOR','PUBLICADA','CERRADA')),
  resultado          TEXT,
  fecha_cierre       TIMESTAMPTZ,
  -- Para publicar: fecha, punto de encuentro y organización son obligatorios
  CHECK (estado = 'BORRADOR' OR (fecha_hora IS NOT NULL AND punto_encuentro IS NOT NULL AND organizacion_id IS NOT NULL)),
  -- Una jornada se vincula a un reporte o, en su defecto, a una zona justificada (A3)
  CHECK (estado = 'BORRADOR' OR reporte_id IS NOT NULL OR (zona IS NOT NULL AND justificacion_zona IS NOT NULL)),
  CHECK (estado <> 'CERRADA' OR (resultado IS NOT NULL AND fecha_cierre IS NOT NULL))
);
CREATE INDEX idx_jornada_estado ON jornada (estado, fecha_hora);

CREATE TABLE participacion (
  id             SERIAL PRIMARY KEY,
  jornada_id     INT NOT NULL REFERENCES jornada(id),
  usuario_id     INT NOT NULL REFERENCES usuario(id),
  fecha_registro TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (jornada_id, usuario_id)
);
