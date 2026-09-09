/**
 * Edge Function: oirs-estado (V4)
 * Consulta el estado consolidado de las derivaciones de una solicitud OIRS.
 * Lo usa SIMPLE (accion 229) para mostrar el avance de insumos en la revision final.
 *
 * Body: { simple_tramite_id }
 * Responde: { ok, solicitud_id, total, respondidas, pendientes, progreso, resumen, detalle[] }
 *
 * Auth: header x-simple-token vs secret SIMPLE_API_TOKEN.
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

function oirsClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: 'oirs' },
    auth: { persistSession: false },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ ok: false, error: 'Metodo no permitido' }, 405);

  const token = req.headers.get('x-simple-token') || '';
  if (!SIMPLE_API_TOKEN || token !== SIMPLE_API_TOKEN) {
    return json({ ok: false, error: 'No autorizado' }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'JSON invalido' }, 400);
  }

  const tramiteId = normStr(body.simple_tramite_id);
  if (!tramiteId) return json({ ok: false, error: 'Falta simple_tramite_id' }, 400);

  const db = oirsClient();

  try {
    const { data: solicitud, error: solErr } = await db
      .from('solicitudes')
      .select('id, estado, etapa, fecha_vencimiento')
      .eq('simple_tramite_id', tramiteId)
      .maybeSingle();
    if (solErr) throw solErr;
    if (!solicitud) throw new Error(`Solicitud no encontrada para tramite ${tramiteId}`);

    const { data: derivaciones, error: derErr } = await db
      .from('derivaciones')
      .select('estado, respuesta, correo_responsable, responsable_rut, fecha_respuesta, areas!inner(nombre)')
      .eq('solicitud_id', solicitud.id)
      .order('fecha_derivacion', { ascending: true });
    if (derErr) throw derErr;

    const rows = (derivaciones ?? []) as Array<Record<string, unknown>>;
    const total = rows.length;
    const respondidas = rows.filter((d) => d.estado === 'respondida').length;
    const pendientes = total - respondidas;

    const detalle = rows.map((d) => {
      const area = (d.areas ?? {}) as { nombre?: string };
      return {
        area: area.nombre ?? '',
        responsable: (d.correo_responsable as string) ?? (d.responsable_rut as string) ?? '',
        estado: d.estado as string,
        respondio: d.estado === 'respondida',
      };
    });

    const resumen =
      total === 0
        ? 'Sin derivaciones registradas.'
        : `Progreso ${respondidas}/${total} insumos recibidos.\n` +
          detalle
            .map((d) => `- ${d.area}: ${d.respondio ? 'RESPONDIDO' : 'PENDIENTE'} (${d.responsable})`)
            .join('\n');

    return json({
      ok: true,
      solicitud_id: solicitud.id,
      estado: solicitud.estado,
      etapa: solicitud.etapa,
      total,
      respondidas,
      pendientes,
      progreso: `${respondidas}/${total}`,
      resumen,
      detalle,
    });
  } catch (error) {
    console.error('[oirs-estado] Error:', error);
    return json({ ok: false, error: (error as Error).message }, 500);
  }
});

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
