-- Eliminar tablas oirs_* viejas de public (migradas a esquema oirs, solo tenian semillas)
drop table if exists
  public.oirs_solicitud_etiquetas,
  public.oirs_eventos,
  public.oirs_derivaciones,
  public.oirs_solicitudes,
  public.oirs_plantillas_respuesta,
  public.oirs_subtemas,
  public.oirs_temas,
  public.oirs_etiquetas,
  public.oirs_area_usuarios,
  public.oirs_areas,
  public.oirs_feriados,
  public.oirs_tipos_solicitud,
  public.oirs_config
cascade;

-- Funciones viejas en public
drop function if exists public.oirs_sincronizar_funcionarios(regclass) cascade;
drop function if exists public.oirs_definir_responsable(text, text) cascade;
drop function if exists public.oirs_calcular_vencimiento(date, integer) cascade;
drop function if exists public.oirs_normalizar_rut(text) cascade;
drop function if exists public.oirs_codigo(text) cascade;
drop function if exists public.oirs_actualizar_fecha() cascade;;
