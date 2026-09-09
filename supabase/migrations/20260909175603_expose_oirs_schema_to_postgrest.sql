-- Exponer el esquema oirs a PostgREST (Data API).
-- IMPORTANTE: esto NO otorga permisos por si solo. anon/authenticated siguen
-- sin USAGE sobre oirs, asi que no pueden leer/escribir nada. Solo service_role
-- (que usan las Edge Functions) puede operar sobre estas tablas.
do $$
declare
  v_current text;
begin
  select coalesce(
    (select setconfig[array_position(array(select split_part(unnest(setconfig),'=',1)), 'pgrst.db_schemas')]
     from pg_db_role_setting s join pg_roles r on r.oid=s.setrole
     where r.rolname='authenticator' limit 1),
    ''
  ) into v_current;
  raise notice 'config actual: %', v_current;
end $$;

-- Fijar la lista de esquemas expuestos incluyendo oirs
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, oirs';

-- Recargar configuracion de PostgREST
notify pgrst, 'reload config';;
