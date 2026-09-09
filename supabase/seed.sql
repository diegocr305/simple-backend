-- ============================================================
-- SEED DATA: Datos de prueba para desarrollo
-- ============================================================

INSERT INTO seguimiento_oirs_siac (
  folio, folio_simple, fecha_ingreso, fecha_vencimiento,
  etapa_actual_id, etapa_actual_nombre, tipo_solicitud,
  motivo, submotivo, area_derivada,
  solicitante_nombre, solicitante_rut, solicitante_email,
  descripcion, prioridad
) VALUES
(
  'OIRS-2025-0001', 'SMP-10001',
  NOW() - INTERVAL '10 days', NOW() + INTERVAL '5 days',
  2, 'Derivación de solicitud', 'OIRS',
  'Infraestructura', 'Mantención de establecimiento', 'Área de Infraestructura',
  'Juan Pérez González', '12.345.678-9', 'juan.perez@email.com',
  'Solicito reparación de techumbre en Escuela N°1 que presenta filtraciones en periodo de lluvias.',
  'normal'
),
(
  'OIRS-2025-0002', 'SMP-10002',
  NOW() - INTERVAL '18 days', NOW() - INTERVAL '1 day',
  2, 'Derivación de solicitud', 'OIRS',
  'Recursos Humanos', 'Consulta dotación', 'Área de Personas',
  'María López Soto', '9.876.543-2', 'maria.lopez@email.com',
  'Consulta sobre estado de contratación de profesores para el segundo semestre.',
  'urgente'
),
(
  'OIRS-2025-0003', 'SMP-10003',
  NOW() - INTERVAL '5 days', NOW() + INTERVAL '12 days',
  1, 'Revisión de Requerimiento', 'OIRS',
  'Educación', 'Matrícula', 'Área de Educación',
  'Carlos Muñoz Araya', '15.432.109-8', 'carlos.munoz@email.com',
  'Solicito información sobre proceso de matrícula para estudiante con NEE.',
  'normal'
),
(
  'OIRS-2025-0004', 'SMP-10004',
  NOW() - INTERVAL '14 days', NOW() + INTERVAL '1 day',
  3, 'Revisión Final Oficina de Partes', 'OIRS',
  'Transporte', 'Recorrido escolar', 'Área de Operaciones',
  'Andrea Silva Rojas', '11.222.333-4', 'andrea.silva@email.com',
  'Reclamo por cambio de recorrido de transporte escolar sin aviso previo.',
  'urgente'
),
(
  'OIRS-2025-0005', 'SMP-10005',
  NOW() - INTERVAL '20 days', NOW() - INTERVAL '5 days',
  2, 'Derivación de solicitud', 'SIAC',
  'Alimentación', 'Calidad del servicio', 'Área de Alimentación',
  'Roberto Díaz Fuentes', '8.765.432-1', 'roberto.diaz@email.com',
  'Reclamo por calidad de alimentación entregada en Liceo Politécnico durante última semana.',
  'critica'
),
(
  'OIRS-2025-0006', 'SMP-10006',
  NOW() - INTERVAL '3 days', NOW() + INTERVAL '17 days',
  4, 'Ingreso de Solicitud', 'OIRS',
  'Convivencia Escolar', 'Denuncia', 'Área de Convivencia',
  'Patricia Gómez Valenzuela', '14.567.890-K', 'patricia.gomez@email.com',
  'Denuncia de situación de bullying no atendida en establecimiento.',
  'urgente'
);
