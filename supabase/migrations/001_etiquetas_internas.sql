-- ============================================================
-- MIGRACIÓN: Agregar etiquetas internas + corregir IDs de etapas
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Nuevas columnas de clasificación interna
ALTER TABLE seguimiento_oirs_siac
  ADD COLUMN IF NOT EXISTS area_responsable_etiqueta TEXT,
  ADD COLUMN IF NOT EXISTS tematica TEXT,
  ADD COLUMN IF NOT EXISTS subtematica TEXT,
  ADD COLUMN IF NOT EXISTS tipo_requirente TEXT;

CREATE INDEX IF NOT EXISTS idx_seguimiento_tematica ON seguimiento_oirs_siac(tematica);
CREATE INDEX IF NOT EXISTS idx_seguimiento_area_resp ON seguimiento_oirs_siac(area_responsable_etiqueta);

-- 2. Corregir función de estado funcional (IDs de tarea reales de SIMPLE)
CREATE OR REPLACE FUNCTION calcular_estado_funcional()
RETURNS TRIGGER AS $$
BEGIN
  NEW.dias_restantes := EXTRACT(DAY FROM (NEW.fecha_vencimiento - NOW()))::INTEGER;

  IF NEW.respuesta IS NOT NULL AND NEW.respuesta != '' THEN
    NEW.estado_funcional := 'respondido';
  ELSIF NEW.etapa_actual_id = 57 AND NEW.respuesta IS NOT NULL THEN
    NEW.estado_funcional := 'cerrado';
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

-- 3. Vistas de reportería por etiquetas
CREATE OR REPLACE VIEW v_oirs_resumen_por_tematica AS
SELECT
  tematica, subtematica,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE estado_funcional = 'vencido') AS vencidos,
  COUNT(*) FILTER (WHERE estado_funcional = 'respondido') AS respondidos
FROM seguimiento_oirs_siac
WHERE tematica IS NOT NULL
GROUP BY tematica, subtematica
ORDER BY total DESC;

CREATE OR REPLACE VIEW v_oirs_resumen_por_area_responsable AS
SELECT
  area_responsable_etiqueta,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE estado_funcional = 'vigente') AS vigentes,
  COUNT(*) FILTER (WHERE estado_funcional = 'por_vencer') AS por_vencer,
  COUNT(*) FILTER (WHERE estado_funcional = 'vencido') AS vencidos,
  COUNT(*) FILTER (WHERE estado_funcional = 'respondido') AS respondidos
FROM seguimiento_oirs_siac
WHERE area_responsable_etiqueta IS NOT NULL
GROUP BY area_responsable_etiqueta
ORDER BY vencidos DESC, total DESC;
