-- Vista que une funcionarios + unidades para que oirs.sincronizar_funcionarios
-- disponga del codigo Y el nombre del area en la misma fila.
create or replace view public.v_oirs_funcionarios_sync as
select
  f.rut,
  f.rut_jefatura,
  f.nombre_completo,
  f.correo_electronico::text as correo_electronico,
  f.simple_usuario_id,
  f.unidad_codigo,
  coalesce(u.nombre, f.unidad_codigo) as unidad
from public.funcionarios f
left join public.unidades u on u.codigo = f.unidad_codigo
where f.activo is not false;

grant select on public.v_oirs_funcionarios_sync to service_role;;
