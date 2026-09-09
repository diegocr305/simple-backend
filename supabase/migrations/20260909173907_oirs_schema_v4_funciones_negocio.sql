create or replace function oirs.sincronizar_funcionarios(p_tabla regclass default null)
returns jsonb language plpgsql security definer set search_path = oirs, public as $$
declare
  r record; j jsonb;
  v_area_nombre text; v_area_codigo text; v_subdireccion text;
  v_rut text; v_rut_jefatura text; v_nombre text; v_correo text;
  v_simple_raw text; v_simple_id bigint; v_area_id uuid;
  v_areas integer := 0; v_usuarios integer := 0;
begin
  if p_tabla is null then raise exception 'Debe indicar la tabla fuente, por ejemplo public.funcionarios'; end if;
  for r in execute format('select to_jsonb(f) as j from %s f', p_tabla) loop
    j := r.j;
    v_area_nombre := nullif(trim(coalesce(j->>'unidad', j->>'area', j->>'unidad_nombre', j->>'nombre_unidad', j->>'subdireccion')), '');
    v_subdireccion := nullif(trim(coalesce(j->>'subdireccion', j->>'subdireccion')), '');
    v_area_codigo := nullif(trim(coalesce(j->>'unidad_codigo', j->>'codigo_unidad', j->>'area_codigo')), '');
    if v_area_codigo is null and v_area_nombre is not null then v_area_codigo := oirs.codigo(v_area_nombre); end if;
    v_rut := oirs.normalizar_rut(coalesce(j->>'rut', j->>'RUT'));
    v_rut_jefatura := oirs.normalizar_rut(coalesce(j->>'rut_jefatura', j->>'RUT jefatura'));
    v_nombre := nullif(trim(coalesce(j->>'nombre_completo', j->>'funcionario', j->>'nombre', concat_ws(' ', j->>'nombres', j->>'apellido_paterno', j->>'apellido_materno'))), '');
    v_correo := lower(nullif(trim(coalesce(j->>'correo_electronico', j->>'correo', j->>'email', j->>'correo institucional')), ''));
    v_simple_raw := nullif(trim(coalesce(j->>'simple_usuario_id', j->>'id_usuario_simple', j->>'ID usuario SIMPLE')), '');
    v_simple_id := case when v_simple_raw ~ '^[0-9]+$' then v_simple_raw::bigint else null end;
    if v_area_codigo is null or v_area_nombre is null then continue; end if;
    insert into oirs.areas (codigo, nombre, subdireccion, activo) values (v_area_codigo, v_area_nombre, v_subdireccion, true)
    on conflict (codigo) do update set nombre=excluded.nombre, subdireccion=coalesce(excluded.subdireccion, oirs.areas.subdireccion), activo=true, updated_at=now()
    returning id into v_area_id;
    v_areas := v_areas + 1;
    if v_rut <> '' then
      insert into oirs.area_usuarios (area_id, rut, rut_jefatura, nombre_completo, correo, simple_usuario_id, activo, metadata)
      values (v_area_id, v_rut, nullif(v_rut_jefatura,''), v_nombre, v_correo, v_simple_id, true, j)
      on conflict (area_id, rut) do update set rut_jefatura=excluded.rut_jefatura, nombre_completo=excluded.nombre_completo, correo=excluded.correo, simple_usuario_id=excluded.simple_usuario_id, activo=true, metadata=excluded.metadata, updated_at=now();
      v_usuarios := v_usuarios + 1;
    end if;
  end loop;
  with areas_sin_principal as (
    select a.id from oirs.areas a where not exists (select 1 from oirs.area_usuarios au where au.area_id=a.id and au.es_principal and au.activo)
  ), ranking as (
    select candidato.id, candidato.area_id, count(dependiente.id) as subordinados,
      row_number() over (partition by candidato.area_id order by count(dependiente.id) desc, candidato.nombre_completo nulls last) as posicion
    from oirs.area_usuarios candidato
    join areas_sin_principal ap on ap.id=candidato.area_id
    join oirs.area_usuarios dependiente on dependiente.area_id=candidato.area_id and dependiente.rut_jefatura=candidato.rut
    where candidato.activo and candidato.simple_usuario_id is not null and candidato.correo is not null
    group by candidato.id, candidato.area_id, candidato.nombre_completo
  )
  update oirs.area_usuarios au set es_principal=true, principal_manual=false, updated_at=now()
  from ranking rnk where au.id=rnk.id and rnk.posicion=1 and rnk.subordinados>0;
  return jsonb_build_object('ok', true, 'tabla', p_tabla::text, 'filas_area_procesadas', v_areas, 'usuarios_procesados', v_usuarios);
end;
$$;

create or replace function oirs.definir_responsable(p_area_codigo text, p_rut text)
returns jsonb language plpgsql security definer set search_path = oirs, public as $$
declare v_area_id uuid; v_usuario oirs.area_usuarios%rowtype;
begin
  select id into v_area_id from oirs.areas where codigo=oirs.codigo(p_area_codigo) or lower(nombre)=lower(trim(p_area_codigo));
  if v_area_id is null then raise exception 'Area no encontrada: %', p_area_codigo; end if;
  select * into v_usuario from oirs.area_usuarios where area_id=v_area_id and rut=oirs.normalizar_rut(p_rut) and activo;
  if v_usuario.id is null then raise exception 'El RUT % no esta sincronizado en el area %', p_rut, p_area_codigo; end if;
  if v_usuario.simple_usuario_id is null or v_usuario.correo is null then raise exception 'El responsable no tiene correo o simple_usuario_id'; end if;
  update oirs.area_usuarios set es_principal=false, principal_manual=false, updated_at=now() where area_id=v_area_id;
  update oirs.area_usuarios set es_principal=true, principal_manual=true, updated_at=now() where id=v_usuario.id;
  return jsonb_build_object('ok', true, 'area_codigo', p_area_codigo, 'rut', oirs.normalizar_rut(p_rut), 'simple_usuario_id', v_usuario.simple_usuario_id, 'correo', v_usuario.correo);
end;
$$;

-- Triggers updated_at
do $$
declare t text;
begin
  foreach t in array array['config','tipos_solicitud','areas','area_usuarios','temas','subtemas','etiquetas','plantillas_respuesta','solicitudes','derivaciones'] loop
    execute format('drop trigger if exists %I on oirs.%I', t || '_actualizar_fecha', t);
    execute format('create trigger %I before update on oirs.%I for each row execute function oirs.actualizar_fecha()', t || '_actualizar_fecha', t);
  end loop;
end $$;;
