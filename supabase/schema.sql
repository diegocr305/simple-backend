-- ============================================================
-- OIRS SIMPLE - Schema PostgreSQL para Supabase
-- Sistema de seguimiento OIRS/SIAC integrado con SIMPLE
-- 
-- IMPORTANTE: Este schema es SEGURO de ejecutar en tu Supabase
-- existente. No toca las tablas de reservas, documentos ni
-- establecimientos. Reutiliza la tabla "usuarios" existente.
-- ============================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLA PRINCIPAL: seguimiento_oirs_siac
-- ============================================================
CREATE TABLE IF NOT EXISTS seguimiento_oirs_siac (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identificadores
  folio TEXT NOT NULL,
  folio_simple TEXT UNIQUE NOT NULL,
  
  -- Fechas clave
  fecha_ingreso TIMESTAMPTZ NOT NULL,
  fecha_vencimiento TIMESTAMPTZ NOT NULL,
  dias_restantes INTEGER,  -- Se calcula via trigger
  
  -- Estado
  estado_funcional TEXT NOT NULL DEFAULT 'vigente'
    CHECK (estado_funcional IN ('vigente', 'por_vencer', 'vencido', 'respondido', 'cerrado')),
  etapa_actual_id INTEGER NOT NULL,
  etapa_actual_nombre TEXT NOT NULL,
  
  -- Clasificación
  tipo_solicitud TEXT NOT NULL DEFAULT 'OIRS',
  motivo TEXT,
  submotivo TEXT,
  area_derivada TEXT,
  
  -- Etiquetas internas (clasificación para reportería)
  area_responsable_etiqueta TEXT,   -- Subdirección/Depto/Unidad responsable
  tematica TEXT,                     -- Categoría principal (Matrícula, Infraestructura, etc.)
  subtematica TEXT,                  -- Detalle de la temática
  tipo_requirente TEXT,              -- Apoderado, Funcionario, Comunidad, etc.
  
  -- Solicitante
  solicitante_nombre TEXT,
  solicitante_rut TEXT,
  solicitante_email TEXT,
  
  -- Contenido
  descripcion TEXT,
  respuesta TEXT,
  
  -- Asignación
  funcionario_asignado TEXT,
  prioridad TEXT NOT NULL DEFAULT 'normal'
    CHECK (prioridad IN ('normal', 'urgente', 'critica')),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_at TIMESTAMPTZ DEFAULT NOW(),
  raw_data JSONB DEFAULT '{}'::JSONB
);

-- ============================================================
-- ÍNDICES (IF NOT EXISTS para no fallar si ya existen)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_seguimiento_folio ON seguimiento_oirs_siac(folio);
CREATE INDEX IF NOT EXISTS idx_seguimiento_folio_simple ON seguimiento_oirs_siac(folio_simple);
CREATE INDEX IF NOT EXISTS idx_seguimiento_estado ON seguimiento_oirs_siac(estado_funcional);
CREATE INDEX IF NOT EXISTS idx_seguimiento_etapa ON seguimiento_oirs_siac(etapa_actual_id);
CREATE INDEX IF NOT EXISTS idx_seguimiento_area ON seguimiento_oirs_siac(area_derivada);
CREATE INDEX IF NOT EXISTS idx_seguimiento_vencimiento ON seguimiento_oirs_siac(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_seguimiento_rut ON seguimiento_oirs_siac(solicitante_rut);
CREATE INDEX IF NOT EXISTS idx_seguimiento_tematica ON seguimiento_oirs_siac(tematica);
CREATE INDEX IF NOT EXISTS idx_seguimiento_area_resp ON seguimiento_oirs_siac(area_responsable_etiqueta);

-- ============================================================
-- FUNCIÓN: Actualizar updated_at automáticamente
-- ============================================================
CREATE OR REPLACE FUNCTION update_seguimiento_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_seguimiento_updated_at ON seguimiento_oirs_siac;
CREATE TRIGGER trigger_seguimiento_updated_at
  BEFORE UPDATE ON seguimiento_oirs_siac
  FOR EACH ROW
  EXECUTE FUNCTION update_seguimiento_updated_at();

-- ============================================================
-- FUNCIÓN: Calcular estado funcional y días restantes
-- ============================================================
CREATE OR REPLACE FUNCTION calcular_estado_funcional()
RETURNS TRIGGER AS $$
BEGIN
  -- Calcular días restantes
  NEW.dias_restantes := EXTRACT(DAY FROM (NEW.fecha_vencimiento - NOW()))::INTEGER;

  -- Si ya tiene respuesta, marcar como respondido
  IF NEW.respuesta IS NOT NULL AND NEW.respuesta != '' THEN
    NEW.estado_funcional := 'respondido';
  -- Si está en etapa final (Revisión Final) y tiene respuesta
  ELSIF NEW.etapa_actual_id = 57 AND NEW.respuesta IS NOT NULL THEN
    NEW.estado_funcional := 'cerrado';
  -- Calcular por días restantes
  ELSIF (NEW.fecha_vencimiento - NOW()) < INTERVAL '0 days' THEN
    NEW.estado_funcional := 'vencido';
  ELSIF (NEW.fecha_vencimiento - NOW()) < INTERVAL '3 days' THEN
    NEW.estado_funcional := 'por_vencer';
  ELSE
    NEW.estado_funcional := 'vigente';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_estado_funcional ON seguimiento_oirs_siac;
CREATE TRIGGER trigger_estado_funcional
  BEFORE INSERT OR UPDATE ON seguimiento_oirs_siac
  FOR EACH ROW
  EXECUTE FUNCTION calcular_estado_funcional();

-- ============================================================
-- TABLA: historial_cambios_oirs (timeline de cada trámite OIRS)
-- Nombre distinto para no colisionar con historial_reservas
-- ============================================================
CREATE TABLE IF NOT EXISTS historial_cambios_oirs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seguimiento_id UUID NOT NULL REFERENCES seguimiento_oirs_siac(id) ON DELETE CASCADE,
  campo_modificado TEXT NOT NULL,
  valor_anterior TEXT,
  valor_nuevo TEXT,
  usuario TEXT,
  fecha TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historial_oirs_seguimiento ON historial_cambios_oirs(seguimiento_id);
CREATE INDEX IF NOT EXISTS idx_historial_oirs_fecha ON historial_cambios_oirs(fecha);

-- ============================================================
-- NOTA: NO se crea tabla usuarios_sistema.
-- Se reutiliza la tabla "usuarios" existente que tiene:
--   id (UUID, ref auth.users), email, nombre_completo, area, activo, rol, created_at
--
-- Los roles existentes (funcionario, subdirector, admin, etc.)
-- se pueden extender agregando roles OIRS si se necesita.
-- Para este MVP, cualquier usuario autenticado puede ver OIRS.
-- ============================================================

-- ============================================================
-- VIEWS: Consultas pre-armadas para el frontend OIRS
-- ============================================================

-- Vista: Trámites pendientes (vigentes + por vencer)
CREATE OR REPLACE VIEW v_oirs_pendientes AS
SELECT *
FROM seguimiento_oirs_siac
WHERE estado_funcional IN ('vigente', 'por_vencer')
ORDER BY fecha_vencimiento ASC;

-- Vista: Trámites vencidos
CREATE OR REPLACE VIEW v_oirs_vencidos AS
SELECT *
FROM seguimiento_oirs_siac
WHERE estado_funcional = 'vencido'
ORDER BY fecha_vencimiento ASC;

-- Vista: Resumen por área
CREATE OR REPLACE VIEW v_oirs_resumen_por_area AS
SELECT
  area_derivada,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE estado_funcional = 'vigente') AS vigentes,
  COUNT(*) FILTER (WHERE estado_funcional = 'por_vencer') AS por_vencer,
  COUNT(*) FILTER (WHERE estado_funcional = 'vencido') AS vencidos,
  COUNT(*) FILTER (WHERE estado_funcional = 'respondido') AS respondidos
FROM seguimiento_oirs_siac
WHERE area_derivada IS NOT NULL
GROUP BY area_derivada
ORDER BY vencidos DESC, por_vencer DESC;

-- Vista: Resumen por etapa
CREATE OR REPLACE VIEW v_oirs_resumen_por_etapa AS
SELECT
  etapa_actual_id,
  etapa_actual_nombre,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE estado_funcional = 'vencido') AS vencidos,
  COUNT(*) FILTER (WHERE estado_funcional = 'por_vencer') AS por_vencer,
  AVG(EXTRACT(DAY FROM (fecha_vencimiento - NOW())))::INTEGER AS promedio_dias_restantes
FROM seguimiento_oirs_siac
GROUP BY etapa_actual_id, etapa_actual_nombre
ORDER BY etapa_actual_id;

-- Vista: KPIs generales
CREATE OR REPLACE VIEW v_oirs_kpis AS
SELECT
  COUNT(*) AS total_tramites,
  COUNT(*) FILTER (WHERE estado_funcional = 'vigente') AS vigentes,
  COUNT(*) FILTER (WHERE estado_funcional = 'por_vencer') AS por_vencer,
  COUNT(*) FILTER (WHERE estado_funcional = 'vencido') AS vencidos,
  COUNT(*) FILTER (WHERE estado_funcional = 'respondido') AS respondidos,
  COUNT(*) FILTER (WHERE estado_funcional = 'cerrado') AS cerrados,
  ROUND(
    (COUNT(*) FILTER (WHERE estado_funcional = 'vencido')::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 1
  ) AS porcentaje_vencidos,
  AVG(EXTRACT(DAY FROM (fecha_vencimiento - fecha_ingreso)))::INTEGER AS promedio_plazo_dias
FROM seguimiento_oirs_siac;

-- Vista: Resumen por temática (etiquetas internas)
CREATE OR REPLACE VIEW v_oirs_resumen_por_tematica AS
SELECT
  tematica,
  subtematica,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE estado_funcional = 'vencido') AS vencidos,
  COUNT(*) FILTER (WHERE estado_funcional = 'respondido') AS respondidos,
  AVG(EXTRACT(DAY FROM (COALESCE(updated_at, NOW()) - fecha_ingreso)))::INTEGER AS promedio_dias_respuesta
FROM seguimiento_oirs_siac
WHERE tematica IS NOT NULL
GROUP BY tematica, subtematica
ORDER BY total DESC;

-- Vista: Resumen por área responsable (etiquetas internas)
CREATE OR REPLACE VIEW v_oirs_resumen_por_area_responsable AS
SELECT
  area_responsable_etiqueta,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE estado_funcional = 'vigente') AS vigentes,
  COUNT(*) FILTER (WHERE estado_funcional = 'por_vencer') AS por_vencer,
  COUNT(*) FILTER (WHERE estado_funcional = 'vencido') AS vencidos,
  COUNT(*) FILTER (WHERE estado_funcional = 'respondido') AS respondidos,
  AVG(EXTRACT(DAY FROM (fecha_vencimiento - NOW())))::INTEGER AS promedio_dias_restantes
FROM seguimiento_oirs_siac
WHERE area_responsable_etiqueta IS NOT NULL
GROUP BY area_responsable_etiqueta
ORDER BY vencidos DESC, total DESC;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE seguimiento_oirs_siac ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_cambios_oirs ENABLE ROW LEVEL SECURITY;

-- Política: Usuarios autenticados pueden leer todos los seguimientos
DROP POLICY IF EXISTS "Usuarios autenticados leen seguimientos oirs" ON seguimiento_oirs_siac;
CREATE POLICY "Usuarios autenticados leen seguimientos oirs"
  ON seguimiento_oirs_siac
  FOR SELECT
  TO authenticated
  USING (true);

-- Política: Usuarios autenticados pueden insertar/actualizar (para sync)
DROP POLICY IF EXISTS "Usuarios autenticados modifican seguimientos oirs" ON seguimiento_oirs_siac;
CREATE POLICY "Usuarios autenticados modifican seguimientos oirs"
  ON seguimiento_oirs_siac
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Política: Service role puede hacer todo (para Edge Functions)
DROP POLICY IF EXISTS "Service role full access oirs" ON seguimiento_oirs_siac;
CREATE POLICY "Service role full access oirs"
  ON seguimiento_oirs_siac
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Política: Todos los autenticados leen historial OIRS
DROP POLICY IF EXISTS "Usuarios leen historial oirs" ON historial_cambios_oirs;
CREATE POLICY "Usuarios leen historial oirs"
  ON historial_cambios_oirs
  FOR SELECT
  TO authenticated
  USING (true);

-- Política: Service role puede escribir historial
DROP POLICY IF EXISTS "Service role escribe historial oirs" ON historial_cambios_oirs;
CREATE POLICY "Service role escribe historial oirs"
  ON historial_cambios_oirs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- FUNCIÓN: Registrar cambio en historial automáticamente
-- ============================================================
CREATE OR REPLACE FUNCTION registrar_cambio_historial_oirs()
RETURNS TRIGGER AS $$
BEGIN
  -- Registrar cambio de etapa
  IF OLD.etapa_actual_id IS DISTINCT FROM NEW.etapa_actual_id THEN
    INSERT INTO historial_cambios_oirs (seguimiento_id, campo_modificado, valor_anterior, valor_nuevo)
    VALUES (NEW.id, 'etapa', OLD.etapa_actual_nombre, NEW.etapa_actual_nombre);
  END IF;

  -- Registrar cambio de estado
  IF OLD.estado_funcional IS DISTINCT FROM NEW.estado_funcional THEN
    INSERT INTO historial_cambios_oirs (seguimiento_id, campo_modificado, valor_anterior, valor_nuevo)
    VALUES (NEW.id, 'estado_funcional', OLD.estado_funcional, NEW.estado_funcional);
  END IF;

  -- Registrar cambio de área
  IF OLD.area_derivada IS DISTINCT FROM NEW.area_derivada THEN
    INSERT INTO historial_cambios_oirs (seguimiento_id, campo_modificado, valor_anterior, valor_nuevo)
    VALUES (NEW.id, 'area_derivada', OLD.area_derivada, NEW.area_derivada);
  END IF;

  -- Registrar asignación de funcionario
  IF OLD.funcionario_asignado IS DISTINCT FROM NEW.funcionario_asignado THEN
    INSERT INTO historial_cambios_oirs (seguimiento_id, campo_modificado, valor_anterior, valor_nuevo)
    VALUES (NEW.id, 'funcionario_asignado', OLD.funcionario_asignado, NEW.funcionario_asignado);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_historial_cambios_oirs ON seguimiento_oirs_siac;
CREATE TRIGGER trigger_historial_cambios_oirs
  AFTER UPDATE ON seguimiento_oirs_siac
  FOR EACH ROW
  EXECUTE FUNCTION registrar_cambio_historial_oirs();
