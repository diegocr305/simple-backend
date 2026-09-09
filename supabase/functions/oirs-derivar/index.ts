/**
 * Edge Function: oirs-derivar (V4)
 * Crea derivaciones multiples de una solicitud OIRS hacia una o mas areas/responsables,
 * en paralelo. Es la pieza del "Rastreador de Insumos en Paralelo".
 *
 * Body (desde SIMPLE, accion 222):
 *  - simple_tramite_id     (req)
 *  - criterio_derivacion   'por_rut' | 'por_area'
 *  - ruts_responsables     lista separada por coma (cuando criterio=por_rut)
 *  - areas                 lista separada por coma de codigos/nombres (cuando criterio=por_area)
 *  - observaciones         instruccion del analista OIRS
 *  - tema, subtema         clasificacion (texto)
 *  - etiquetas             lista separada por coma
 *
 * Responde: simple_usuario_derivacion_id, correo_usuario_asignado,
 *           correos_derivacion (coma), resumen_derivaciones (texto)
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

interface ResponsableResuelto {
  area_id: string;
  area_codigo: string;
  area_nombre: string;
  rut: string;
  correo: string;
  simple_usuario_id: number | null;
  nombre: string | null;
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
    // 1. Localizar la solicitud
    const { data: solicitud, error: solErr } = await db
      .from('solicitudes')
      .select('id, fecha_vencimiento, tema_texto, subtema_texto')
      .eq('simple_tramite_id', tramiteId)
      .maybeSingle();
    if (solErr) throw solErr;
    if (!solicitud) throw new Error(`Solicitud no encontrada para tramite ${tramiteId}`);

    // 2. Resolver responsables segun criterio
    const criterio = normStr(body.criterio_derivacion) ?? 'por_area';
    const responsables =
      criterio === 'por_rut'
        ? await resolverPorRut(db, splitLista(body.ruts_responsables))
        : await resolverPorArea(db, splitLista(body.areas));

    if (responsables.length === 0) {
      throw new Error('No se pudo resolver ningun responsable con correo y usuario SIMPLE valido');
    }

    // 3. Clasificacion opcional en la solicitud
    const tema = normStr(body.tema);
    const subtema = normStr(body.subtema);
    if (tema || subtema) {
      await db
        .from('solicitudes')
        .update({ tema_texto: tema ?? solicitud.tema_texto, subtema_texto: subtema ?? solicitud.subtema_texto })
        .eq('id', solicitud.id);
    }

    // 4. Crear una derivacion por responsable (idempotente por (solicitud_id, area_id))
    const observaciones = normStr(body.observaciones);
    const creadas: ResponsableResuelto[] = [];
    for (const r of responsables) {
      const { error: derErr } = await db.from('derivaciones').upsert(
        {
          solicitud_id: solicitud.id,
          area_id: r.area_id,
          responsable_rut: r.rut,
          simple_usuario_id: r.simple_usuario_id,
          correo_responsable: r.correo,
          observaciones,
          estado: 'pendiente',
          fecha_derivacion: new Date().toISOString(),
          fecha_vencimiento: solicitud.fecha_vencimiento,
        },
        { onConflict: 'solicitud_id,area_id', ignoreDuplicates: false },
      );
      if (derErr) throw derErr;
      creadas.push(r);
    }

    // 5. Marcar etapa de la solicitud
    await db.from('solicitudes').update({ estado: 'derivada', etapa: 'derivacion' }).eq('id', solicitud.id);

    // 6. Registrar evento
    await db.from('eventos').insert({
      solicitud_id: solicitud.id,
      tipo: 'derivacion',
      actor: 'siac',
      detalle: { criterio, total: creadas.length, areas: creadas.map((c) => c.area_codigo) },
    });

    // 7. Armar respuesta para SIMPLE
    // El responsable principal (primero) se asigna la tarea en SIMPLE; el resto queda registrado.
    const principal = creadas[0];
    const correos = creadas.map((c) => c.correo).filter(Boolean);
    const resumen = creadas
      .map((c) => `- ${c.area_nombre} (${c.nombre ?? c.rut}) <${c.correo}>`)
      .join('\n');

    return json({
      ok: true,
      solicitud_id: solicitud.id,
      total_derivaciones: creadas.length,
      simple_usuario_derivacion_id: principal.simple_usuario_id,
      correo_usuario_asignado: principal.correo,
      correos_derivacion: correos.join(','),
      resumen_derivaciones: resumen,
    });
  } catch (error) {
    console.error('[oirs-derivar] Error:', error);
    return json({ ok: false, error: (error as Error).message }, 500);
  }
});

/**
 * Resuelve responsables a partir de una lista de RUTs.
 * Toma el area_usuario activo con correo y simple_usuario_id.
 */
async function resolverPorRut(db: SupabaseClient, ruts: string[]): Promise<ResponsableResuelto[]> {
  const out: ResponsableResuelto[] = [];
  for (const rutRaw of ruts) {
    const { data: rutNorm } = await db.rpc('normalizar_rut', { p_rut: rutRaw });
    const rut = (rutNorm as string) ?? '';
    if (!rut) continue;

    const { data, error } = await db
      .from('area_usuarios')
      .select('area_id, rut, correo, simple_usuario_id, nombre_completo, areas!inner(codigo, nombre)')
      .eq('rut', rut)
      .eq('activo', true)
      .not('correo', 'is', null)
      .not('simple_usuario_id', 'is', null)
      .limit(1);
    if (error) throw error;
    const row = data?.[0] as Record<string, unknown> | undefined;
    if (row) out.push(mapRow(row));
  }
  return out;
}

/**
 * Resuelve responsables a partir de una lista de codigos/nombres de area.
 * Toma el responsable principal activo de cada area.
 */
async function resolverPorArea(db: SupabaseClient, areas: string[]): Promise<ResponsableResuelto[]> {
  const out: ResponsableResuelto[] = [];
  for (const areaRaw of areas) {
    const area = await buscarArea(db, areaRaw);
    if (!area) continue;

    // Responsable principal del area
    const { data: resp, error: respErr } = await db
      .from('area_usuarios')
      .select('area_id, rut, correo, simple_usuario_id, nombre_completo')
      .eq('area_id', area.id)
      .eq('es_principal', true)
      .eq('activo', true)
      .not('correo', 'is', null)
      .not('simple_usuario_id', 'is', null)
      .limit(1)
      .maybeSingle();
    if (respErr) throw respErr;
    if (!resp) continue;

    out.push({
      area_id: area.id,
      area_codigo: area.codigo,
      area_nombre: area.nombre,
      rut: resp.rut,
      correo: resp.correo,
      simple_usuario_id: resp.simple_usuario_id,
      nombre: resp.nombre_completo,
    });
  }
  return out;
}

/**
 * Busca un area por codigo o nombre de forma robusta, tolerando guion/guion_bajo
 * y acentos. Evita el operador .or() de PostgREST que es fragil con espacios/acentos.
 */
async function buscarArea(
  db: SupabaseClient,
  areaRaw: string,
): Promise<{ id: string; codigo: string; nombre: string } | null> {
  const raw = areaRaw.trim();
  const { data: codeData } = await db.rpc('codigo', { p_texto: raw });
  const codigoGuion = (codeData as string) ?? ''; // ej: area-juridica
  const codigoUnderscore = codigoGuion.replace(/-/g, '_'); // ej: area_juridica

  // 1. Match exacto por codigo (probando ambas variantes)
  const { data: porCodigo, error: e1 } = await db
    .from('areas')
    .select('id, codigo, nombre')
    .in('codigo', [codigoGuion, codigoUnderscore, raw])
    .eq('activo', true)
    .limit(1);
  if (e1) throw e1;
  if (porCodigo && porCodigo.length > 0) return porCodigo[0];

  // 2. Match por nombre (ilike, un solo filtro, sin .or)
  const { data: porNombre, error: e2 } = await db
    .from('areas')
    .select('id, codigo, nombre')
    .ilike('nombre', `%${raw}%`)
    .eq('activo', true)
    .limit(1);
  if (e2) throw e2;
  if (porNombre && porNombre.length > 0) return porNombre[0];

  return null;
}

function mapRow(row: Record<string, unknown>): ResponsableResuelto {
  const area = (row.areas ?? {}) as { codigo?: string; nombre?: string };
  return {
    area_id: String(row.area_id),
    area_codigo: area.codigo ?? '',
    area_nombre: area.nombre ?? '',
    rut: String(row.rut),
    correo: String(row.correo ?? ''),
    simple_usuario_id: row.simple_usuario_id != null ? Number(row.simple_usuario_id) : null,
    nombre: (row.nombre_completo as string) ?? null,
  };
}

function splitLista(v: unknown): string[] {
  const s = normStr(v);
  if (!s) return [];
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
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
