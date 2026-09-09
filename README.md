# OIRS SIMPLE - Sistema de Seguimiento

Sistema de seguimiento de trámites OIRS/SIAC integrado con la plataforma SIMPLE del SLEP Valparaíso.

## Stack

- **Frontend**: Ionic Angular 7 + Angular 17 (standalone components)
- **Backend**: Supabase (PostgreSQL + Edge Functions + Auth)
- **API externa**: SIMPLE (tramites.slepvalparaiso.gob.cl)

## Estructura del Proyecto

```
oirs-simple/
├── src/
│   ├── app/
│   │   ├── guards/          # Auth guard
│   │   ├── layout/          # Tabs layout
│   │   ├── models/          # Interfaces y tipos
│   │   ├── pages/
│   │   │   ├── login/       # Login con Google
│   │   │   ├── dashboard/   # KPIs y resumen
│   │   │   ├── seguimiento/ # Tabla con filtros
│   │   │   └── detalle/     # Detalle de trámite
│   │   ├── services/        # Supabase, Auth, OIRS, CSV
│   │   └── shared/          # Componentes reutilizables
│   ├── environments/        # Config por ambiente
│   └── theme/               # Variables Ionic/SCSS
├── supabase/
│   ├── schema.sql           # DDL completo (tablas, views, RLS, triggers)
│   ├── seed.sql             # Datos de prueba
│   └── functions/
│       └── sync-oirs/       # Edge Function de sincronización
└── package.json
```

## Setup Rápido

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar Supabase

1. Ve al [Dashboard de Supabase](https://supabase.com/dashboard)
2. Abre el proyecto `gyhihuovussdauehmeuk`
3. Ve a **SQL Editor** y ejecuta `supabase/schema.sql`
4. (Opcional) Ejecuta `supabase/seed.sql` para datos de prueba

### 3. Configurar Auth con Google

1. En Supabase Dashboard → Authentication → Providers → Google
2. Habilita Google y configura:
   - Client ID de Google Cloud Console
   - Client Secret
3. En Google Cloud Console, agrega las URLs de redirect:
   - `https://gyhihuovussdauehmeuk.supabase.co/auth/v1/callback`

### 4. Configurar variables de entorno

Copia `.env.example` y ajusta los valores en `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  supabaseUrl: 'https://gyhihuovussdauehmeuk.supabase.co',
  supabaseAnonKey: 'tu_anon_key',
  simpleApiBaseUrl: 'https://tramites.slepvalparaiso.gob.cl',
};
```

### 5. Deploy Edge Function

```bash
# Instalar Supabase CLI
npm install -g supabase

# Login
supabase login

# Link al proyecto
supabase link --project-ref gyhihuovussdauehmeuk

# Deploy
supabase functions deploy sync-oirs

# Configurar secrets para la function
supabase secrets set SIMPLE_API_TOKEN=tu_token_simple
```

### 6. Ejecutar en desarrollo

```bash
npm start
```

La app estará en `http://localhost:4200`

## Funcionalidades

### Dashboard
- KPIs: total, vigentes, por vencer, vencidos, respondidos, cerrados
- Distribución por etapa con barra visual
- Botón de sincronización manual con SIMPLE

### Seguimiento
- Tabla con todos los trámites
- Búsqueda por folio, nombre o RUT
- Filtros por: estado, etapa, área derivada
- Semáforos visuales de estado
- Scroll infinito
- Exportación a CSV

### Detalle
- Timeline visual de etapas
- Información completa del trámite
- Datos del solicitante
- Clasificación (motivo, submotivo, área)
- Historial de cambios automático

### Auth
- Login con Google (cuenta institucional)
- Row Level Security por rol
- Roles: admin, oirs, area, jefatura, usuario

## Semáforos

| Estado | Color | Significado |
|--------|-------|-------------|
| 🟢 Vigente | Verde | Más de 3 días para vencer |
| 🟡 Por vencer | Amarillo | 3 días o menos |
| 🔴 Vencido | Rojo | Plazo cumplido sin respuesta |
| 🔵 Respondido | Azul | Tiene respuesta |
| ⚪ Cerrado | Gris | Proceso finalizado |

## Próximos pasos

- [ ] Alertas automáticas por email (2 días antes de vencer)
- [ ] Reportería mensual automática (PDF)
- [ ] Bot de consulta pública por folio
- [ ] Dashboard de métricas avanzadas (tiempos promedio, carga por área)
- [ ] Notificaciones push
