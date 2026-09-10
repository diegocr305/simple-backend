---
inclusion: manual
---

# Backend OIRS/SIAC V4 - Contexto tecnico

> Documento de contexto para retomar el trabajo del backend OIRS en cualquier momento.
> Invocalo en el chat con `#backend-oirs-v4`.
> Ultima actualizacion: 2026-09-10 (agregada seccion de despliegue en Lightsail).

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

---

# 13. Despliegue del FRONTEND en Lightsail (AWS)

> Esta app es SOLO frontend Angular/Ionic estatico. NO tiene backend propio en el
> servidor: habla directo con Supabase desde el navegador. El "backend" son las
> Edge Functions, que viven en Supabase (la nube). En el servidor solo corre Nginx
> sirviendo archivos estaticos. No hay systemd, ni venv, ni proxy a un puerto.

## 13.1 Servidor

- **AWS Lightsail**, Bitnami **Nginx** sobre Debian 12. Region us-east-1.
- **IP estatica IPv4:** `54.86.236.154`
- **IPv6 publica:** `2600:1f18:2e0f:9800:fe1e:964f:569a:e349`
- **Networking type:** Dual-stack (IPv4 + IPv6). MUY IMPORTANTE (ver 13.6).
- Usuario SSH: `bitnami` (consola SSH de Lightsail).
- Servidor **COMPARTIDO**: aloja tambien la web principal `slepvalparaiso.gob.cl`,
  `matricula`, `reservas`, `repositorio`, etc. NO tocar sus server blocks ni certs.
- Servicios: `sudo /opt/bitnami/ctlscript.sh {start|stop|restart} nginx`
- Node 20 instalado (Angular 17 lo requiere).

## 13.2 URLs de OIRS

- Definitiva: `https://oirs.slepvalparaiso.gob.cl`
- `oirs.slepvalparaiso.cl` redirige (301) al `.gob.cl` (patron de matricula/rgm).
- Ambos dominios estan detras del **proxy de Cloudflare** (nube naranja).
- Repo (publico): `https://github.com/diegocr305/simple-backend` rama `main`.

## 13.3 Estructura en el servidor

- Codigo: `/opt/bitnami/nginx/apps/oirs/` (clon del repo).
- Build de Angular: `/opt/bitnami/nginx/apps/oirs/dist/oirs-simple/browser/`
  OJO: el builder moderno de Angular crea la subcarpeta `browser/`. El `root` de
  Nginx apunta AHI, no a `dist/oirs-simple/`.
- Server blocks:
  - `/opt/bitnami/nginx/conf/server_blocks/16-oirs-https.conf` (sirve la SPA)
  - `/opt/bitnami/nginx/conf/server_blocks/17-oirs-redirect.conf` (.cl -> .gob.cl)

## 13.4 Deploy inicial (paso a paso)

```bash
# 1. Clonar
cd /opt/bitnami/nginx/apps
git clone https://github.com/diegocr305/simple-backend.git oirs
cd oirs

# 2. Build
npm ci
npm run build
ls dist/oirs-simple/browser/index.html   # debe existir

# 3-5. Certificado + server blocks + reload (ver secciones siguientes)
```

## 13.5 Redeploy (cuando cambia el frontend)

```bash
cd /opt/bitnami/nginx/apps/oirs
git pull origin main
npm ci
npm run build
# No hace falta recargar Nginx (sirve estatico). Ctrl+F5 por cache de Cloudflare.
```

## 13.6 LECCION CLAVE: IPv6 y el error 522 de Cloudflare

**El problema mas dificil del despliegue.** Sintoma: Cloudflare muestra
`Error 522 - Connection timed out`, "Host: Error". El sitio no carga aunque
Nginx este bien.

### Diagnostico (en orden)
1. `curl -k -H "Host: oirs.slepvalparaiso.gob.cl" https://localhost/ -I`
   -> si da 200, Nginx OK localmente.
2. `curl -k -H "Host: oirs..." https://54.86.236.154/ -I`
   -> si da 200, el origen responde por IPv4 publica.
3. `sudo tail -f /opt/bitnami/nginx/logs/access.log` + recargar en navegador
   -> si el log queda VACIO, Cloudflare no esta llegando al origen.
4. `dig +short AAAA oirs.slepvalparaiso.gob.cl` -> tiene registros AAAA (IPv6).
5. `curl -g -6 'http://[2600:1f18:...]'` -> "Failed to connect" = Nginx NO
   escucha IPv6, PERO Cloudflare intenta conectar por IPv6 -> 522.

### Causa raiz
La instancia es **dual-stack**: Cloudflare resuelve el origen por IPv6 e intenta
conectar ahi, pero Nginx (Bitnami) por defecto **NO escucha en IPv6**. Lightsail
avisa: "Configure your instance for IPv6". El firewall de Lightsail ya tiene el
443 abierto para IPv6; el problema es que Nginx no escuchaba.

### Solucion (la que funciono)
Basado en docs de AWS (lightsail configure-ipv6-on-nginx):

1. Agregar `listen [::]:80;` en el **nginx.conf principal**, en el bloque
   `# HTTP Server` (justo debajo del `listen 80;` global):
   ```
   sudo cp /opt/bitnami/nginx/conf/nginx.conf /opt/bitnami/nginx/conf/nginx.conf.bak-oirs
   sudo nano /opt/bitnami/nginx/conf/nginx.conf
   # debajo de "listen  80;" agregar:  listen  [::]:80;
   ```
2. En los server blocks de oirs (16 y 17), incluir las 4 lineas de listen:
   `listen 80; listen [::]:80; listen 443 ssl; listen [::]:443 ssl;`
3. `sudo /opt/bitnami/nginx/sbin/nginx -t` y `restart nginx`.
4. Verificar: `curl -k -g -6 -H "Host: oirs.slepvalparaiso.gob.cl" 'https://[2600:1f18:2e0f:9800:fe1e:964f:569a:e349]/' -I`
   -> debe dar 200 OK.

Tras esto, Cloudflare conecta por IPv6 y el 522 desaparece (puede tardar unos
minutos por CACHE de Cloudflare del estado "origen caido").

> NOTA para futuras apps en este servidor: si agregas un subdominio dual-stack
> detras de Cloudflare, RECUERDA el `listen [::]:` o daras 522. matricula no dio
> problema porque su registro/config no forzaba IPv6 igual.

## 13.7 Certificado HTTPS (cert autofirmado, patron repositorio)

No se pudo usar Let's Encrypt/certbot porque el proxy de Cloudflare bloquea el
challenge HTTP (da 522 en la validacion webroot). Solucion: **certificado
autofirmado** para el tramo Cloudflare<->origen (igual que hace `repositorio`).
El usuario final ve el certificado de Cloudflare, no este.

```bash
sudo openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout /etc/letsencrypt/live/oirs-selfsigned.key \
  -out /etc/letsencrypt/live/oirs-selfsigned.crt \
  -subj "/CN=oirs.slepvalparaiso.gob.cl"
```
(Ejecutar el openssl en UNA sola linea al pegar, o los `\` se separan y falla.)

Los server blocks apuntan a:
```
ssl_certificate     /etc/letsencrypt/live/oirs-selfsigned.crt;
ssl_certificate_key /etc/letsencrypt/live/oirs-selfsigned.key;
```

> Requisito Cloudflare: el modo SSL/TLS debe ser **Full** (no "Full strict"),
> porque un cert autofirmado no pasa la validacion de "strict". Si en el futuro
> Cloudflare pasa a strict, habra que pedir un **Origin Certificate** de Cloudflare
> al administrador (no tenemos acceso al panel de Cloudflare).

## 13.8 Server block principal (16-oirs-https.conf)

```nginx
# OIRS/SIAC - SPA Angular estatica (sin backend local)
server {
    listen 80;
    listen [::]:80;
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name oirs.slepvalparaiso.gob.cl;

    ssl_certificate     /etc/letsencrypt/live/oirs-selfsigned.crt;
    ssl_certificate_key /etc/letsencrypt/live/oirs-selfsigned.key;

    location /.well-known/acme-challenge/ {
        root /opt/bitnami/nginx/html;
    }

    root /opt/bitnami/nginx/apps/oirs/dist/oirs-simple/browser;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## 13.9 Server block redirect (17-oirs-redirect.conf)

```nginx
# OIRS - redirige el dominio .cl al .gob.cl
server {
    listen 80;
    listen [::]:80;
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name oirs.slepvalparaiso.cl;

    ssl_certificate     /etc/letsencrypt/live/oirs-selfsigned.crt;
    ssl_certificate_key /etc/letsencrypt/live/oirs-selfsigned.key;

    return 301 https://oirs.slepvalparaiso.gob.cl$request_uri;
}
```

> PLAN B temporal: si el .gob.cl no carga (cache de Cloudflare), se puede convertir
> el 17 en un server que sirva la app directo (mismo contenido que el 16 pero con
> server_name .cl, sin el `return 301`). Volver al redirect cuando el .gob.cl este
> estable.

## 13.10 Validar y recargar (SIEMPRE en este orden)

```bash
sudo /opt/bitnami/nginx/sbin/nginx -t          # DEBE decir "test is successful"
sudo /opt/bitnami/ctlscript.sh restart nginx
```
Si `nginx -t` falla, NO reiniciar (tumbaria los otros sitios). Restaurar backup:
`sudo cp /opt/bitnami/nginx/conf/nginx.conf.bak-oirs /opt/bitnami/nginx/conf/nginx.conf`

## 13.11 Build budget (Angular)

El bundle inicial (~1.11 MB, normal para Ionic+Angular+Supabase) superaba el limite
por defecto de 1mb y abortaba `npm run build`. En `angular.json` se subio a:
`initial: maximumWarning 1.5mb, maximumError 2.5mb` y `anyComponentStyle: 16kb`.

## 13.12 environment.ts SI se versiona

`src/environments/environment.ts` y `.prod.ts` estaban en `.gitignore`, lo que
rompia el build en un clone limpio ("environment.prod.ts path does not exist").
Se quitaron del .gitignore porque solo contienen URL de Supabase + anon key
(publicas). El token de SIMPLE y la service_role NUNCA van en el frontend.

## 13.13 Verificar el sitio sin depender de Cloudflare (truco hosts)

En Windows, editar `C:\Windows\System32\drivers\etc\hosts` (como admin) y agregar:
```
54.86.236.154 oirs.slepvalparaiso.gob.cl
```
Abrir `https://oirs.slepvalparaiso.gob.cl`, aceptar la advertencia de cert
autofirmado. Salta Cloudflare y va directo al origen. Borrar la linea al terminar.

## 13.14 Pendientes del despliegue

- Confirmar que Cloudflare refresco cache y el .gob.cl carga publico (fue cuestion
  de esperar tras activar IPv6).
- Cuando el .gob.cl este estable, dejar el 17 como redirect (no sirviendo la app).
- Versionar los server blocks 16 y 17 en el repo (carpeta de referencia) si se
  quiere tenerlos bajo control de versiones.
