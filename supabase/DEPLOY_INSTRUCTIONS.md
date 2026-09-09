# Backend OIRS/SIAC V4 - Modelo por eventos (proceso SIMPLE 22)

Este backend reemplaza el modelo antiguo de polling. Ahora SIMPLE (proceso 22)
llama a las Edge Functions en cada transicion del flujo y el estado se persiste
en el esquema dedicado `oirs`.

## Arquitectura

```
  SIMPLE (proceso 22)                Supabase
  ────────────────────               ─────────────────────────────
  Tarea "Ingreso"       ──POST──►  sync-oirs   {evento:"ingreso"}      ──►  oirs.solicitudes
  Tarea "Derivacion"    ──POST──►  oirs-derivar                        ──►  oirs.derivaciones
  Respuesta de area     ──POST──►  sync-oirs   {evento:"respuesta_area"}
  Consulta estado       ──POST──►  oirs-estado
  Revision final        ──POST──►  sync-oirs   {evento:"revision_final"}
  Cierre                ──POST──►  sync-oirs   {evento:"cierre"}
```

Todas las tablas viven en el esquema `oirs` (no en `public`). Solo `service_role`
tiene acceso; las Edge Functions usan la service key.

## Edge Functions

| Funcion | Descripcion | verify_jwt |
|---------|-------------|------------|
| `sync-oirs` | Router de eventos: ingreso, respuesta_area, revision_final, cierre | false |
| `oirs-derivar` | Crea derivaciones multiples (por RUT o por area) | false |
| `oirs-estado` | Consulta estado/progreso de derivaciones (X/Y) | false |

`verify_jwt` es `false` a proposito: la autenticacion la da el header
`x-simple-token`, validado dentro de cada funcion contra el secret `SIMPLE_API_TOKEN`.

## Secrets requeridos (Edge Functions)

Ya configurados en el proyecto. Para actualizarlos:

```bash
supabase secrets set SIMPLE_API_TOKEN=<token que SIMPLE envia en x-simple-token>
```

> `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` se inyectan automaticamente.

## Deploy

```bash
supabase functions deploy sync-oirs
supabase functions deploy oirs-derivar
supabase functions deploy oirs-estado
```

## Configuracion en SIMPLE (proceso 22)

Cada accion REST debe enviar el header `x-simple-token` con el mismo valor del
secret `SIMPLE_API_TOKEN`. El body de cada evento:

- **ingreso** (`sync-oirs`): `{evento:"ingreso", simple_tramite_id, tipo_identificacion, rut_solicitante, documento_extranjero, nombre_adulto_responsable, documento_adulto_responsable, nombre_completo, correo_electronico, motivo, asunto, descripcion, modo_respuesta}` → responde `{solicitud_id, plazo_dias_habiles, fecha_vencimiento}`
- **derivar** (`oirs-derivar`): `{simple_tramite_id, criterio_derivacion, ruts_responsables|areas, observaciones, tema, subtema, etiquetas}` → responde `{simple_usuario_derivacion_id, correo_usuario_asignado, correos_derivacion, resumen_derivaciones}`
- **respuesta_area** (`sync-oirs`): `{evento:"respuesta_area", simple_tramite_id, simple_usuario_id, respuesta, plantilla_codigo}`
- **estado** (`oirs-estado`): `{simple_tramite_id}` → responde `{progreso, resumen, detalle[]}`
- **revision_final** (`sync-oirs`): `{evento:"revision_final", simple_tramite_id, decision, respuesta_final, plantilla_codigo}`
- **cierre** (`sync-oirs`): `{evento:"cierre", simple_tramite_id}`

## Poblar areas y responsables

Antes de derivar, sincronizar la estructura organizacional desde la tabla institucional:

```sql
select oirs.sincronizar_funcionarios('public.funcionarios'::regclass);
-- Confirmar/corregir responsable principal de un area:
select oirs.definir_responsable('codigo-del-area', '13851438-2');
```

## Verificacion rapida

Sin token debe responder 401:
```bash
curl -X POST https://gyhihuovussdauehmeuk.supabase.co/functions/v1/sync-oirs \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" -d '{"evento":"ingreso","simple_tramite_id":"X"}'
# => 401 {"ok":false,"error":"No autorizado"}
```
