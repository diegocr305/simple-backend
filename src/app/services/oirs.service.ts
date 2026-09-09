import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import {
  SeguimientoOirs,
  FiltroSeguimiento,
  PaginatedResult,
  PaginationParams,
  ResumenDashboard,
  EstadoFuncional,
} from '../models/oirs.model';

@Injectable({
  providedIn: 'root',
})
export class OirsService {
  // Vista del modelo V4 (esquema oirs) con el mismo contrato que el frontend espera.
  private readonly SCHEMA = 'oirs';
  private readonly TABLE = 'v_seguimiento';

  constructor(private supabaseService: SupabaseService) {}

  /** Helper: query builder apuntando al esquema/vista correctos */
  private from() {
    return this.supabaseService.client.schema(this.SCHEMA).from(this.TABLE);
  }

  /**
   * Obtener resumen para dashboard
   */
  async getResumen(): Promise<ResumenDashboard> {
    const { data, error } = await this.from()
      .select('estado_funcional');

    if (error) throw error;

    const resumen: ResumenDashboard = {
      total: data.length,
      vigentes: data.filter(d => d.estado_funcional === 'vigente').length,
      por_vencer: data.filter(d => d.estado_funcional === 'por_vencer').length,
      vencidos: data.filter(d => d.estado_funcional === 'vencido').length,
      respondidos: data.filter(d => d.estado_funcional === 'respondido').length,
      cerrados: data.filter(d => d.estado_funcional === 'cerrado').length,
    };

    return resumen;
  }

  /**
   * Obtener lista paginada con filtros
   */
  async getSeguimientos(
    filtros: FiltroSeguimiento,
    paginacion: PaginationParams,
  ): Promise<PaginatedResult<SeguimientoOirs>> {
    const { page, pageSize } = paginacion;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.from()
      .select('*', { count: 'exact' });

    // Aplicar filtros
    if (filtros.etapa_id) {
      query = query.eq('etapa_actual_id', filtros.etapa_id);
    }

    if (filtros.estado_funcional) {
      query = query.eq('estado_funcional', filtros.estado_funcional);
    }

    if (filtros.area_derivada) {
      query = query.eq('area_derivada', filtros.area_derivada);
    }

    if (filtros.busqueda) {
      query = query.or(
        `folio.ilike.%${filtros.busqueda}%,solicitante_nombre.ilike.%${filtros.busqueda}%,solicitante_rut.ilike.%${filtros.busqueda}%,descripcion.ilike.%${filtros.busqueda}%`
      );
    }

    if (filtros.fecha_desde) {
      query = query.gte('fecha_ingreso', filtros.fecha_desde);
    }

    if (filtros.fecha_hasta) {
      query = query.lte('fecha_ingreso', filtros.fecha_hasta);
    }

    // Ordenar y paginar
    query = query
      .order('fecha_vencimiento', { ascending: true })
      .range(from, to);

    const { data, count, error } = await query;

    if (error) throw error;

    const total = count ?? 0;

    return {
      data: data as SeguimientoOirs[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Obtener detalle de un trámite por ID
   */
  async getDetalle(id: string): Promise<SeguimientoOirs | null> {
    const { data, error } = await this.from()
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    return data as SeguimientoOirs;
  }

  /**
   * Obtener áreas derivadas únicas (para filtro)
   */
  async getAreasDerivadas(): Promise<string[]> {
    const { data, error } = await this.from()
      .select('area_derivada')
      .not('area_derivada', 'is', null);

    if (error) throw error;

    const areas = [...new Set(data.map(d => d.area_derivada as string))];
    return areas.sort();
  }

  /**
   * Obtener conteo por etapa para dashboard
   */
  async getConteoPorEtapa(): Promise<{ etapa_actual_nombre: string; count: number }[]> {
    const { data, error } = await this.from()
      .select('etapa_actual_nombre');

    if (error) throw error;

    const conteo = data.reduce((acc: Record<string, number>, item) => {
      const etapa = item.etapa_actual_nombre;
      acc[etapa] = (acc[etapa] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(conteo).map(([etapa_actual_nombre, count]) => ({
      etapa_actual_nombre,
      count: count as number,
    }));
  }

  /**
   * Exportar todos los datos filtrados para CSV
   */
  async exportar(filtros: FiltroSeguimiento): Promise<SeguimientoOirs[]> {
    let query = this.from()
      .select('*');

    if (filtros.etapa_id) {
      query = query.eq('etapa_actual_id', filtros.etapa_id);
    }
    if (filtros.estado_funcional) {
      query = query.eq('estado_funcional', filtros.estado_funcional);
    }
    if (filtros.area_derivada) {
      query = query.eq('area_derivada', filtros.area_derivada);
    }
    if (filtros.busqueda) {
      query = query.or(
        `folio.ilike.%${filtros.busqueda}%,solicitante_nombre.ilike.%${filtros.busqueda}%`
      );
    }

    query = query.order('fecha_vencimiento', { ascending: true });

    const { data, error } = await query;

    if (error) throw error;

    return data as SeguimientoOirs[];
  }

}
