-- El frontend (usuarios logueados = rol authenticated) necesita leer la vista.
-- Damos USAGE del esquema + SELECT SOLO de la vista, no de las tablas base.
-- La vista es security_invoker=false por defecto en PG, pero para que funcione
-- con RLS de las tablas base y el rol authenticated, la definimos como
-- security definer (corre con permisos del owner, que si ve las tablas).
alter view oirs.v_seguimiento set (security_invoker = false);

grant usage on schema oirs to authenticated;
grant select on oirs.v_seguimiento to authenticated;;
