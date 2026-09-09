create table if not exists oirs.areas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  subdireccion text,
  activo boolean not null default true,
  origen text not null default 'funcionarios',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists oirs.area_usuarios (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references oirs.areas(id) on delete cascade,
  rut text not null,
  rut_jefatura text,
  nombre_completo text,
  correo text,
  simple_usuario_id bigint,
  es_principal boolean not null default false,
  principal_manual boolean not null default false,
  activo boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (area_id, rut)
);
create unique index if not exists oirs_area_un_principal_idx on oirs.area_usuarios(area_id) where es_principal and activo;

create table if not exists oirs.temas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into oirs.temas (codigo, nombre) values ('general','General') on conflict (codigo) do nothing;

create table if not exists oirs.subtemas (
  id uuid primary key default gen_random_uuid(),
  tema_id uuid not null references oirs.temas(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tema_id, codigo)
);

create table if not exists oirs.etiquetas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  color text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists oirs.plantillas_respuesta (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  categoria text,
  asunto text,
  contenido_html text not null,
  contenido_texto text,
  enlaces jsonb not null default '[]'::jsonb,
  imagenes jsonb not null default '[]'::jsonb,
  area_id uuid references oirs.areas(id) on delete set null,
  version integer not null default 1,
  activo boolean not null default true,
  creado_por text,
  actualizado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into oirs.plantillas_respuesta (codigo, nombre, categoria, asunto, contenido_html, contenido_texto) values
  ('acuse_general','Acuse general','ingreso','Recepcion de solicitud OIRS/SIAC','<p>Su solicitud fue recibida y sera revisada por OIRS/SIAC.</p>','Su solicitud fue recibida y sera revisada por OIRS/SIAC.'),
  ('solicitud_antecedentes','Solicitud de antecedentes','subsanacion','Solicitud requiere antecedentes','<p>Para continuar con la gestion necesitamos que complemente los antecedentes indicados.</p>','Para continuar con la gestion necesitamos que complemente los antecedentes indicados.'),
  ('derivacion_competencia','Derivacion por competencia','derivacion','Solicitud derivada al area competente','<p>Su solicitud fue derivada al area competente para analisis y respuesta.</p>','Su solicitud fue derivada al area competente para analisis y respuesta.'),
  ('respuesta_tecnica_general','Respuesta tecnica general','respuesta_area','Respuesta del area tecnica','<p>De acuerdo con los antecedentes revisados, informamos lo siguiente:</p>','De acuerdo con los antecedentes revisados, informamos lo siguiente:'),
  ('solicitud_plazo_adicional','Solicitud de plazo adicional','respuesta_area','Antecedentes en revision','<p>Los antecedentes continuan en revision por el area responsable.</p>','Los antecedentes continuan en revision por el area responsable.'),
  ('sin_competencia_area','Sin competencia del area','respuesta_area','Derivacion por competencia','<p>La materia consultada no corresponde a las competencias de esta area.</p>','La materia consultada no corresponde a las competencias de esta area.'),
  ('respuesta_final_general','Respuesta final general','cierre','Respuesta final OIRS/SIAC','<p>Conforme a los antecedentes recopilados, se entrega la siguiente respuesta final:</p>','Conforme a los antecedentes recopilados, se entrega la siguiente respuesta final:'),
  ('respuesta_consolidada_multiarea','Respuesta consolidada multiarea','cierre','Respuesta consolidada OIRS/SIAC','<p>Las areas consultadas informaron lo siguiente:</p>','Las areas consultadas informaron lo siguiente:')
on conflict (codigo) do update set nombre=excluded.nombre, categoria=excluded.categoria, asunto=excluded.asunto, contenido_html=excluded.contenido_html, contenido_texto=excluded.contenido_texto, updated_at=now();;
