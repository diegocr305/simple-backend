create table if not exists oirs.solicitudes (
  id uuid primary key default gen_random_uuid(),
  simple_tramite_id text not null unique,
  source text not null default 'simple',
  estado text not null default 'ingresada',
  etapa text not null default 'ingreso',
  tipo_codigo text references oirs.tipos_solicitud(codigo),
  tipo_identificacion text,
  rut_solicitante text,
  documento_extranjero text,
  nombre_adulto_responsable text,
  documento_adulto_responsable text,
  nombre_completo text,
  correo_electronico text,
  asunto text,
  descripcion text,
  modo_respuesta text,
  tema_texto text,
  subtema_texto text,
  plazo_dias_habiles integer,
  fecha_ingreso date not null default current_date,
  fecha_vencimiento date,
  respuesta_final text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists oirs.derivaciones (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references oirs.solicitudes(id) on delete cascade,
  area_id uuid not null references oirs.areas(id),
  responsable_rut text,
  simple_usuario_id bigint,
  correo_responsable text,
  observaciones text,
  estado text not null default 'pendiente',
  respuesta text,
  plantilla_codigo text references oirs.plantillas_respuesta(codigo),
  fecha_derivacion timestamptz not null default now(),
  fecha_respuesta timestamptz,
  fecha_vencimiento date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (solicitud_id, area_id)
);

create table if not exists oirs.solicitud_etiquetas (
  solicitud_id uuid not null references oirs.solicitudes(id) on delete cascade,
  etiqueta_id uuid not null references oirs.etiquetas(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (solicitud_id, etiqueta_id)
);

create table if not exists oirs.eventos (
  id bigint generated always as identity primary key,
  solicitud_id uuid references oirs.solicitudes(id) on delete cascade,
  tipo text not null,
  actor text,
  detalle jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists oirs_solicitudes_estado_idx on oirs.solicitudes(estado, fecha_vencimiento);
create index if not exists oirs_derivaciones_estado_idx on oirs.derivaciones(estado, fecha_vencimiento);
create index if not exists oirs_area_usuarios_rut_idx on oirs.area_usuarios(rut);
create index if not exists oirs_area_usuarios_simple_idx on oirs.area_usuarios(simple_usuario_id);;
