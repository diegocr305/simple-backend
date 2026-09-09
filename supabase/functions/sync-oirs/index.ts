/**
 * Edge Function: sync-oirs (V4 - por eventos)
 * Recibe eventos desde SIMPLE (proceso 22 - OIRS/SIAC SLEP Valparaiso V4)
 * y persiste el estado en el esquema `oirs` de Supabase.
 *
 * Eventos soportados (campo `evento` del body):
 *  - ingreso         -> crea/actualiza la solicitud. Devuelve solicitud_id, plazo_dias_habiles, fecha_vencimiento
 *  - respuesta_area  -> registra la respuesta de un area derivada
 *  - revision_final  -> registra la decision de revision final
 *  - cierre          -> marca la solicitud como cerrada
 *
 * Autenticacion: header `x-simple-token` validado contra el secret SIMPLE_API_TOKEN.
 * Idempotente por `simple_tramite_id`.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SIMPLE_API_TOKEN = Deno.env.get('SIMPLE_API_TOKEN') || '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-simple-token',
};

// Cliente con el esquema `oirs` por defecto (todas las tablas viven ahi)
function oirsClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: 'oirs' },
    auth: { persistSession: false },
  });
}

interface IngresoBody {
  evento: 'ingreso';
  source?: string;
  simple_tramite_id: string;
  tipo_identificacion?: string;
  rut_solicitante?: string;
  documento_extranjero?: string;
  nombre_adulto_responsable?: string;
  documento_adulto_responsable?: string;
  nombre_completo?: string;
  correo_electronico?: string;
  motivo?: string;
  asunto?: string;
  descripcion?: string;
  modo_respuesta?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Metodo no permitido' }, 405);
  }

  // Autenticacion por token de SIMPLE
  const token = req.headers.get('x-simple-token') || '';
  if (!SIMPLE_API_TOKEN || token !== SIMPLE_API_TOKEN) {
    console.warn('[sync-oirs] Token invalido o ausente');
    return json({ ok: false, error: 'No autorizado' }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'JSON invalido' }, 400);
  }

  const evento = String(body.evento ?? '').trim();
  const tramiteId = normStr(body.simple_tramite_id);

  if (!tramiteId) {
    return json({ ok: false, error: 'Falta simple_tramite_id' }, 400);
  }

  const db = oirsClient();

  try {
    switch (evento) {
      case 'ingreso':
        return json(await handleIngreso(db, body as unknown as IngresoBody));
      case 'respuesta_area':
        return json(await handleRespuestaArea(db, body));
      case 'revision_final':
        return json(await handleRevisionFinal(db, body));
      case 'cierre':
        return json(await handleCierre(db, body));
      default:
        return json({ ok: false, error: `Evento no soportado: ${evento}` }, 400);
    }
  } catch (error) {
    console.error(`[sync-oirs] Error en evento ${evento}:`, error);
    return json({ ok: false, error: (error as Error).message }, 500);
  }
});

/**
 * Evento ingreso: crea (o actualiza si ya existe) la solicitud.
 * Calcula plazo segun tipo y fecha de vencimiento en dias habiles.
 */
async function handleIngreso(db: SupabaseClient, body: IngresoBody) {
  const tramiteId = normStr(body.simple_tramite_id)!;
  const tipoCodigo = mapMotivoATipo(normStr(body.motivo));

  // Plazo desde el catalogo (fallback 20 si el tipo no existe)
  let plazo = 20;
  if (tipoCodigo) {
    const { data: tipo } = await db
      .from('tipos_solicitud')
      .select('plazo_dias_habiles')
      .eq('codigo', tipoCodigo)
      .maybeSingle();
    if (tipo?.plazo_dias_habiles != null) plazo = tipo.plazo_dias_habiles;
  }

  const fechaIngreso = new Date().toISOString().slice(0, 10);

  // Fecha de vencimiento en dias habiles via funcion de BD
  const { data: venc, error: vencErr } = await db.rpc('calcular_vencimiento', {
    p_fecha: fechaIngreso,
    p_dias: plazo,
  });
  if (vencErr) throw vencErr;
  const fechaVencimiento = venc as string;

  const registro = {
    simple_tramite_id: tramiteId,
    source: normStr(body.source) ?? 'simple',
    estado: 'ingresada',
    etapa: 'ingreso',
    tipo_codigo: tipoCodigo,
    tipo_identificacion: normStr(body.tipo_identificacion),
    rut_solicitante: normStr(body.rut_solicitante),
    documento_extranjero: normStr(body.documento_extranjero),
    nombre_adulto_responsable: normStr(body.nombre_adulto_responsable),
    documento_adulto_responsable: normStr(body.documento_adulto_responsable),
    nombre_completo: normStr(body.nombre_completo),
    correo_electronico: normStr(body.correo_electronico),
    asunto: normStr(body.asunto),
    descripcion: normStr(body.descripcion),
    modo_respuesta: normStr(body.modo_respuesta),
    plazo_dias_habiles: plazo,
    fecha_ingreso: fechaIngreso,
    fecha_vencimiento: fechaVencimiento,
  };

  // Upsert idempotente por simple_tramite_id
  const { data, error } = await db
    .from('solicitudes')
    .upsert(registro, { onConflict: 'simple_tramite_id', ignoreDuplicates: false })
    .select('id, plazo_dias_habiles, fecha_vencimiento')
    .single();
  if (error) throw error;

  await registrarEvento(db, data.id, 'ingreso', 'simple', {
    tramite_id: tramiteId,
    tipo_codigo: tipoCodigo,
  });

  return {
    ok: true,
    solicitud_id: data.id,
    plazo_dias_habiles: data.plazo_dias_habiles,
    fecha_vencimiento: data.fecha_vencimiento,
  };
}

/**
 * Evento respuesta_area: registra la respuesta de un area derivada.
 * Actualiza la derivacion del funcionario (por simple_usuario_id) del tramite.
 */
async function handleRespuestaArea(db: SupabaseClient, body: Record<string, unknown>) {
  const solicitud = await getSolicitud(db, normStr(body.simple_tramite_id)!);

  const simpleUsuarioId = normStr(body.simple_usuario_id);
  const respuesta = normStr(body.respuesta);
  const plantilla = normStr(body.plantilla_codigo);

  // Buscar la derivacion del funcionario que responde
  let query = db
    .from('derivaciones')
    .update({
      estado: 'respondida',
      respuesta,
      plantilla_codigo: plantilla,
      fecha_respuesta: new Date().toISOString(),
    })
    .eq('solicitud_id', solicitud.id);

  if (simpleUsuarioId && /^\d+$/.test(simpleUsuarioId)) {
    query = query.eq('simple_usuario_id', Number(simpleUsuarioId));
  }

  const { data, error } = await query.select('id');
  if (error) throw error;

  await db.from('solicitudes').update({ etapa: 'respuesta_area' }).eq('id', solicitud.id);
  await registrarEvento(db, solicitud.id, 'respuesta_area', simpleUsuarioId ?? 'area', {
    plantilla_codigo: plantilla,
    derivaciones_actualizadas: data?.length ?? 0,
  });

  return { ok: true, solicitud_id: solicitud.id, derivaciones_actualizadas: data?.length ?? 0 };
}

/**
 * Evento revision_final: registra la decision de la Oficina de Partes.
 */
async function handleRevisionFinal(db: SupabaseClient, body: Record<string, unknown>) {
  const solicitud = await getSolicitud(db, normStr(body.simple_tramite_id)!);
  const decision = normStr(body.decision);
  const respuestaFinal = normStr(body.respuesta_final);

  const nuevoEstado = decision === 'aprobar' ? 'aprobada' : 'en_revision';

  const { error } = await db
    .from('solicitudes')
    .update({
      estado: nuevoEstado,
      etapa: 'revision_final',
      respuesta_final: respuestaFinal,
    })
    .eq('id', solicitud.id);
  if (error) throw error;

  await registrarEvento(db, solicitud.id, 'revision_final', 'oficina_partes', {
    decision,
    plantilla_codigo: normStr(body.plantilla_codigo),
  });

  return { ok: true, solicitud_id: solicitud.id, estado: nuevoEstado };
}

/**
 * Evento cierre: marca la solicitud como cerrada.
 */
async function handleCierre(db: SupabaseClient, body: Record<string, unknown>) {
  const solicitud = await getSolicitud(db, normStr(body.simple_tramite_id)!);

  const { error } = await db
    .from('solicitudes')
    .update({ estado: 'cerrada', etapa: 'cierre', closed_at: new Date().toISOString() })
    .eq('id', solicitud.id);
  if (error) throw error;

  await registrarEvento(db, solicitud.id, 'cierre', 'sistema', {});
  return { ok: true, solicitud_id: solicitud.id, estado: 'cerrada' };
}

// ---------- Helpers ----------

async function getSolicitud(db: SupabaseClient, tramiteId: string) {
  const { data, error } = await db
    .from('solicitudes')
    .select('id, estado, etapa')
    .eq('simple_tramite_id', tramiteId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Solicitud no encontrada para tramite ${tramiteId}`);
  return data;
}

async function registrarEvento(
  db: SupabaseClient,
  solicitudId: string,
  tipo: string,
  actor: string,
  detalle: Record<string, unknown>,
) {
  const { error } = await db.from('eventos').insert({
    solicitud_id: solicitudId,
    tipo,
    actor,
    detalle,
  });
  if (error) console.warn('[sync-oirs] No se pudo registrar evento:', error.message);
}

/**
 * Mapea el `motivo` del formulario SIMPLE al `codigo` de oirs.tipos_solicitud.
 * Los valores del radio en SIMPLE ya coinciden con los codigos del catalogo.
 */
function mapMotivoATipo(motivo: string | null): string | null {
  if (!motivo) return null;
  const m = motivo.trim().toLowerCase();
  const validos = ['solicitudes', 'sugerencias', 'felicitaciones', 'reclamos', 'denuncias'];
  return validos.includes(m) ? m : null;
}

function normStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
