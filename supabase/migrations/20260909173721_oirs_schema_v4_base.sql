-- Esquema dedicado OIRS V4 (proceso SIMPLE 22)
create schema if not exists oirs;
create extension if not exists pgcrypto;

-- Funciones auxiliares
create or replace function oirs.actualizar_fecha()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function oirs.normalizar_rut(p_rut text)
returns text language sql immutable as $$
  select upper(regexp_replace(coalesce(p_rut, ''), '[^0-9Kk]', '', 'g'));
$$;

create or replace function oirs.codigo(p_texto text)
returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(
    translate(lower(coalesce(p_texto, '')), 'aeiouunAEIOUUN', 'aeiouunAEIOUUN'),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

-- Config y catalogos base
create table if not exists oirs.config (
  clave text primary key,
  valor jsonb not null,
  descripcion text,
  updated_at timestamptz not null default now()
);

create table if not exists oirs.tipos_solicitud (
  codigo text primary key,
  nombre text not null,
  plazo_dias_habiles integer not null check (plazo_dias_habiles >= 0),
  activo boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into oirs.tipos_solicitud (codigo, nombre, plazo_dias_habiles) values
  ('solicitudes', 'Solicitud o requerimiento de informacion', 20),
  ('sugerencias', 'Sugerencia', 20),
  ('felicitaciones', 'Felicitacion', 20),
  ('reclamos', 'Reclamo', 10),
  ('denuncias', 'Denuncia', 20)
on conflict (codigo) do update set nombre=excluded.nombre, plazo_dias_habiles=excluded.plazo_dias_habiles, activo=true, updated_at=now();

create table if not exists oirs.feriados (
  fecha date primary key,
  nombre text not null,
  irrenunciable boolean not null default false,
  fuente text,
  created_at timestamptz not null default now()
);

create or replace function oirs.calcular_vencimiento(p_fecha date, p_dias integer)
returns date language plpgsql stable security definer set search_path = oirs, public as $$
declare v_fecha date := coalesce(p_fecha, current_date); v_contador integer := 0;
begin
  if coalesce(p_dias,0) <= 0 then return v_fecha; end if;
  while v_contador < p_dias loop
    v_fecha := v_fecha + 1;
    if extract(isodow from v_fecha) < 6 and not exists (select 1 from oirs.feriados f where f.fecha = v_fecha) then
      v_contador := v_contador + 1;
    end if;
  end loop;
  return v_fecha;
end;
$$;;
