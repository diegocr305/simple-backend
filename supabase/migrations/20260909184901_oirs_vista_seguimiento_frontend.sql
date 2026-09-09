-- Vista que adapta oirs.solicitudes (modelo V4) al contrato que el frontend
-- ya consume (mismos nombres de columna que seguimiento_oirs_siac).
create or replace view oirs.v_seguimiento as
select
  s.id,
  s.simple_tramite_id as folio,
  s.simple_tramite_id as folio_simple,
  s.fecha_ingreso::timestamptz as fecha_ingreso,
  s.fecha_vencimiento::timestamptz as fecha_vencimiento,
  -- dias habiles restantes aprox (corridos) desde hoy
  (s.fecha_vencimiento - current_date) as dias_restantes,
  -- estado_funcional derivado
  case
    when s.estado in ('cerrada') then 'cerrado'
    when s.estado in ('aprobada') or s.respuesta_final is not null then 'respondido'
    when s.fecha_vencimiento < current_date then 'vencido'
    when (s.fecha_vencimiento - current_date) <= 3 then 'por_vencer'
    else 'vigente'
  end as estado_funcional,
  -- mapeo etapa texto -> id SIMPLE (proceso 22)
  case s.etapa
    when 'ingreso' then 54
    when 'revision' then 55
    when 'derivacion' then 58
    when 'respuesta_area' then 58
    when 'revision_final' then 57
    when 'cierre' then 56
    else 0
  end as etapa_actual_id,
  case s.etapa
    when 'ingreso' then 'Ingreso de Solicitud'
    when 'revision' then 'Revision de Requerimiento'
    when 'derivacion' then 'Derivacion de solicitud'
    when 'respuesta_area' then 'Respuesta de area'
    when 'revision_final' then 'Revision Final Oficina de Partes'
    when 'cierre' then 'Cerrado'
    else s.etapa
  end as etapa_actual_nombre,
  coalesce(s.tipo_codigo, 'OIRS') as tipo_solicitud,
  ts.nombre as motivo,
  s.subtema_texto as submotivo,
  -- area derivada: nombre de la primera derivacion si existe
  (select a.nombre from oirs.derivaciones d join oirs.areas a on a.id=d.area_id where d.solicitud_id=s.id order by d.fecha_derivacion limit 1) as area_derivada,
  null::text as area_responsable_etiqueta,
  s.tema_texto as tematica,
  s.subtema_texto as subtematica,
  s.tipo_identificacion as tipo_requirente,
  s.nombre_completo as solicitante_nombre,
  coalesce(s.rut_solicitante, s.documento_extranjero) as solicitante_rut,
  s.correo_electronico as solicitante_email,
  coalesce(s.descripcion, s.asunto) as descripcion,
  s.respuesta_final as respuesta,
  -- funcionario asignado: responsable principal de la primera derivacion
  (select au.nombre_completo from oirs.derivaciones d join oirs.area_usuarios au on au.simple_usuario_id=d.simple_usuario_id where d.solicitud_id=s.id order by d.fecha_derivacion limit 1) as funcionario_asignado,
  'normal'::text as prioridad,
  s.created_at,
  s.updated_at,
  s.updated_at as sync_at,
  s.metadata as raw_data
from oirs.solicitudes s
left join oirs.tipos_solicitud ts on ts.codigo = s.tipo_codigo;

grant select on oirs.v_seguimiento to service_role;;
