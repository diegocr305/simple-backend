-- RLS en todas las tablas del esquema oirs
do $$
declare t text;
begin
  foreach t in array array['config','tipos_solicitud','feriados','areas','area_usuarios','temas','subtemas','etiquetas','plantillas_respuesta','solicitudes','derivaciones','solicitud_etiquetas','eventos'] loop
    execute format('alter table oirs.%I enable row level security', t);
    execute format('revoke all on oirs.%I from anon, authenticated', t);
    execute format('grant all on oirs.%I to service_role', t);
  end loop;
end $$;

-- Acceso al esquema y secuencias solo para service_role
grant usage on schema oirs to service_role;
revoke usage on schema oirs from anon, authenticated;
grant usage, select on all sequences in schema oirs to service_role;

-- Funciones: solo service_role ejecuta
revoke all on function oirs.calcular_vencimiento(date, integer) from public, anon, authenticated;
revoke all on function oirs.sincronizar_funcionarios(regclass) from public, anon, authenticated;
revoke all on function oirs.definir_responsable(text, text) from public, anon, authenticated;
grant execute on function oirs.calcular_vencimiento(date, integer) to service_role;
grant execute on function oirs.sincronizar_funcionarios(regclass) to service_role;
grant execute on function oirs.definir_responsable(text, text) to service_role;;
