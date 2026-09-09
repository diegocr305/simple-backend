---
inclusion: manual
---

# Backend OIRS/SIAC V4 - Contexto tecnico

> Documento de contexto para retomar el trabajo del backend OIRS en cualquier momento.
> Invocalo en el chat con `#backend-oirs-v4`.
> Ultima actualizacion: 2026-09-09.

## 1. Que es este backend

Capa de gestion interna para las solicitudes OIRS/SIAC del SLEP Valparaiso.
El sistema de cara al ciudadano vive en **SIMPLE** (plataforma de tramitacion
en linea). Este backend recibe eventos de SIMPLE y persiste el estado en
Supabase para notificar, rastrear plazos y coordinar derivaciones a multiples
areas en paralelo (el "Rastreador de Insumos en Paralelo").

- **SIMPLE es la fuente de verdad** del flujo cara al ciudadano.
- **Supabase es la capa de gestion y reporteria interna.**
- La spec formal esta en `.kiro/specs/gestion-oirs-backend/requirements.md`.

## 2. Proyecto Supabase (hosted)

| Dato | Valor |
|------|-------|
| Project ref / id | `gyhihuovussdauehmeuk` |
| Nombre | directorio_escolar_slep |
| URL | `https://gyhihuovussdauehmeuk.supabase.co` |
| Region | East US (North Virginia) |
| Postgres | 17.x |

El CLI local esta linkeado a este proyecto (`supabase/.temp/project-ref`).

## 3. Proceso SIMPLE

- **Proceso 22** = "OIRS/SIAC SLEP Valparaiso V4 - Supabase" (EL ACTUAL).
- El proceso 14 fue una version anterior (polling, solo lectura). Quedo obsoleto.

## 4. Esquema de base de datos: `oirs`

Todas las tablas del V4 viven en un **esquema dedicado `oirs`** (no en `public`),
para separar la capa de gestion de la de ingesta y del resto del sistema.

Tablas (sin prefijo, ej. `oirs.solicitudes`):

| Tabla | Rol |
|-------|-----|
| `oirs.config` | Configuracion clave/valor |
| `oirs.tipos_solicitud` | Catalogo de tipos + plazo en dias habiles (semilla) |
| `oirs.feriados` | Feriados para el calculo de dias habiles |
| `oirs.areas` | Areas/unidades organizacionales |
| `oirs.area_usuarios` | Funcionarios por area + responsable principal |
| `oirs.temas` / `oirs.subtemas` | Clasificacion tematica |
| `oirs.etiquetas` / `oirs.solicitud_etiquetas` | Etiquetas internas |
| `oirs.plantillas_respuesta` | Plantillas de respuesta (semilla, 8) |
| `oirs.solicitudes` | Solicitud OIRS (una por tramite SIMPLE) |
| `oirs.derivaciones` | Derivaciones a areas (multiples por solicitud) |
| `oirs.eventos` | Bitacora de eventos por solicitud |

Funciones: `oirs.calcular_vencimiento(date,int)`, `oirs.sincronizar_funcionarios(regclass)`,
`oirs.definir_responsable(text,text)`, `oirs.normalizar_rut(text)`, `oirs.codigo(text)`,
`oirs.actualizar_fecha()` (trigger updated_at).

### Plazos legales por tipo (semilla actual)
- reclamos: **10** dias habiles
- solicitudes, sugerencias, felicitaciones, denuncias: **20** dias habiles

### Seguridad del esquema (IMPORTANTE)
- RLS habilitado en todas las tablas.
- Solo el rol `service_role` tiene USAGE + permisos. `anon` y `authenticated`
  NO tienen acceso (revocado a proposito).
- El esquema `oirs` esta **expuesto a PostgREST** (`alter role authenticator set
  pgrst.db_schemas = 'public, graphql_public, oirs'`). Esto NO abre acceso publico:
  como anon/authenticated no tienen grants, no pueden leer nada. Solo permite que
  el service_role (Edge Functions) enrute a `oirs` via supabase-js.
- Por eso los clientes en las Edge Functions usan `createClient(..., { db: { schema: 'oirs' } })`.

## 5. Edge Functions

Todas con `verify_jwt = false` (la auth la da el header `x-simple-token`, no un
JWT de usuario). Codigo en `supabase/functions/<nombre>/index.ts`.

| Funcion | Que hace | Body principal |
|---------|----------|----------------|
| `sync-oirs` | Router de eventos: `ingreso`, `respuesta_area`, `revision_final`, `cierre` | `{evento, simple_tramite_id, ...}` |
| `oirs-derivar` | Crea derivaciones (por RUT o por area) | `{simple_tramite_id, criterio_derivacion, ruts_responsables|areas, ...}` |
| `oirs-estado` | Progreso de derivaciones (X/Y) | `{simple_tramite_id}` |

- `sync-oirs` es idempotente por `simple_tramite_id` (upsert).
- El evento `ingreso` calcula plazo + fecha de vencimiento y responde
  `{solicitud_id, plazo_dias_habiles, fecha_vencimiento}`.
- `oirs-derivar` resuelve el responsable principal de cada area (o el usuario por
  RUT) y responde `{simple_usuario_derivacion_id, correo_usuario_asignado,
  correos_derivacion, resumen_derivaciones}`.

## 6. Secrets (Edge Functions)

Configurados en el proyecto (Dashboard -> Edge Functions -> Secrets). NO se
versionan. Referirse por nombre, nunca escribir el valor en el repo.

| Secret | Uso |
|--------|-----|
| `SIMPLE_API_TOKEN` | Token que valida el header `x-simple-token`. Debe coincidir con el que envia SIMPLE. |
| `SIMPLE_API_BASE_URL` | Base URL de la API de SIMPLE |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Inyectados automaticamente por Supabase |

> El valor del token vive solo en el secret y en la config de SIMPLE. Si se pierde,
> se reemplaza con `supabase secrets set SIMPLE_API_TOKEN=<nuevo>` y se actualiza en SIMPLE.

Para setear/actualizar secrets (no se puede por SQL/MCP):
```bash
supabase secrets set SIMPLE_API_TOKEN=<valor>
supabase secrets list   # muestra solo un digest, nunca el valor
```

## 7. Autenticacion del flujo

Cada llamada de SIMPLE a una Edge Function lleva:
- `apikey: <ANON_KEY>` y `Authorization: Bearer <ANON_KEY>` (requisito de la plataforma)
- `x-simple-token: <SIMPLE_API_TOKEN>` (la seguridad real, validada dentro de la funcion)

Sin `x-simple-token` valido -> HTTP 401.

## 8. Sincronizacion de funcionarios y areas

Antes de poder derivar hay que poblar `oirs.areas` y `oirs.area_usuarios`.
La fuente es `public.funcionarios` (86 filas), pero solo tiene `unidad_codigo`,
no el nombre del area. Por eso existe la vista:

```sql
public.v_oirs_funcionarios_sync  -- une funcionarios + unidades (aporta nombre de area)
```

Sincronizar:
```sql
select oirs.sincronizar_funcionarios('public.v_oirs_funcionarios_sync'::regclass);
```
Resultado actual: 10 areas, 83 usuarios, todas con responsable principal
designado automaticamente (la persona con mas subordinados en el area).

Corregir un responsable manualmente:
```sql
select oirs.definir_responsable('area_juridica', '13851438-2');
```

## 9. Cron (reconciliacion)

- El polling viejo (`sync-oirs-auto`, cada 10 min) fue ELIMINADO.
- Existe `oirs-reconciliacion-diaria`: `0 0 * * *` (00:00 UTC = 20:00 Chile, fin del dia),
  **desactivado** hasta implementar la Edge Function `oirs-reconciliar` (spec R10.6).
- Gestion del cron (requiere API cron.*, no UPDATE directo):
  ```sql
  select jobid, jobname, schedule, active from cron.job;
  select cron.alter_job(job_id := <id>, active := true);   -- activar cuando exista oirs-reconciliar
  ```

## 10. Deploy

```bash
supabase functions deploy sync-oirs
supabase functions deploy oirs-derivar
supabase functions deploy oirs-estado
```
Migraciones en `supabase/migrations/` (prefijo `20260909*` = esquema oirs V4).
Sincronizar cambios remotos: `supabase migration fetch --yes`.

## 11. Decisiones y pendientes

Decisiones tomadas:
- Esquema dedicado `oirs` en vez de prefijo `oirs_` en `public` (mas limpio).
- Modelo por eventos en vez de polling (ahorra ~3.700 llamadas/dia).
- `verify_jwt=false` + `x-simple-token` como mecanismo de auth.
- Derivar preferentemente por **codigo** de area, no por nombre (los acentos rompen el match por nombre).

Pendientes / trabajo futuro:
- Implementar Edge Function `oirs-reconciliar` y activar el cron diario (R10.6).
- Manejo de plazos suspendidos (R5), alertas de vencimiento (R8), reporteria (R12).
- RLS de 4 tablas de `public` (slep_establecimientos, historial_reservas, 2 backups)
  sigue deshabilitada - decision del usuario, no tocar sin confirmar.

## 12. Prueba rapida de humo

```bash
# Sin token -> 401
curl -X POST https://gyhihuovussdauehmeuk.supabase.co/functions/v1/sync-oirs \
  -H "apikey: <ANON>" -H "Authorization: Bearer <ANON>" \
  -H "Content-Type: application/json" -d '{"evento":"ingreso","simple_tramite_id":"X"}'
# => 401 {"ok":false,"error":"No autorizado"}
```
