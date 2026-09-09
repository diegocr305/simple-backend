import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { SupabaseService } from './supabase.service';

/**
 * Servicio para consumir directamente la API de SIMPLE
 * y sincronizar los datos con Supabase.
 *
 * API SIMPLE endpoints:
 * - GET /backend/api/procesos?token=...
 * - GET /backend/api/procesos/{id}/tramites?token=...  (paginado)
 * - GET /backend/api/tramites/{id}?token=...
 */

interface SimpleTramite {
  id: number;
  estado: string;
  proceso_id: number;
  fecha_inicio: string;
  fecha_modificacion: string;
  fecha_termino: string | null;
  etapas: SimpleEtapa[];
  datos: Record<string, unknown> | null;
}

interface SimpleEtapa {
  id: number;
  estado: string;
  usuario_asignado: {
    usuario: string;
    email: string | null;
    nombres: string | null;
    apellido_paterno: string | null;
    apellido_materno: string | null;
  };
  fecha_inicio: string;
  fecha_modificacion: string;
  fecha_termino: string | null;
  fecha_vencimiento: string | null;
  tarea: {
    id: number;
    nombre: string;
  };
}

interface SimpleListResponse {
  tramites: {
    titulo: string;
    tipo: string;
    nextPageToken: string | null;
    items: SimpleTramite[];
  };
}

interface SimpleDetailResponse {
  tramite: SimpleTramite;
}

@Injectable({
  providedIn: 'root',
})
export class SimpleApiService {
  private baseUrl = environment.simpleApiBaseUrl;
  private token = environment.simpleApiToken;
  private procesoId = environment.procesoOirsId;

  constructor(
    private http: HttpClient,
    private supabaseService: SupabaseService,
  ) {}

  /**
   * Sincronizar trámites OIRS desde SIMPLE a Supabase
   */
  async sincronizar(): Promise<{ success: boolean; message: string; count: number }> {
    try {
      // 1. Obtener todos los trámites del proceso OIRS
      const tramites = await this.fetchAllTramites();

      if (tramites.length === 0) {
        return { success: true, message: 'No hay trámites para sincronizar', count: 0 };
      }

      // 2. Obtener detalle de cada trámite
      const detallados = await this.fetchDetalles(tramites);

      // 3. Normalizar y upsert
      const normalized = detallados.map(t => this.normalizeTramite(t));

      const { error } = await this.supabaseService.client
        .from('seguimiento_oirs_siac')
        .upsert(normalized, {
          onConflict: 'folio_simple',
          ignoreDuplicates: false,
        });

      if (error) throw error;

      return {
        success: true,
        message: `Sincronizados ${normalized.length} trámites desde SIMPLE`,
        count: normalized.length,
      };
    } catch (error) {
      console.error('Error en sincronización:', error);
      return {
        success: false,
        message: `Error: ${(error as Error).message}`,
        count: 0,
      };
    }
  }

  /**
   * Obtener todos los trámites con paginación
   */
  private async fetchAllTramites(): Promise<SimpleTramite[]> {
    const all: SimpleTramite[] = [];
    let pageToken: string | null = null;
    let hasMore = true;

    while (hasMore) {
      let url = `${this.baseUrl}/backend/api/procesos/${this.procesoId}/tramites?token=${encodeURIComponent(this.token)}`;
      if (pageToken) {
        url += `&pageToken=${pageToken}`;
      }

      const resp = await firstValueFrom(
        this.http.get<SimpleListResponse>(url)
      );

      const items = resp.tramites?.items ?? [];
      all.push(...items);

      pageToken = resp.tramites?.nextPageToken ?? null;
      hasMore = !!pageToken && items.length > 0;
    }

    return all;
  }

  /**
   * Obtener detalle de cada trámite (solo los que tienen datos = formulario completado)
   */
  private async fetchDetalles(tramites: SimpleTramite[]): Promise<SimpleTramite[]> {
    const detailed: SimpleTramite[] = [];

    for (const tramite of tramites) {
      try {
        const url = `${this.baseUrl}/backend/api/tramites/${tramite.id}?token=${encodeURIComponent(this.token)}`;
        const resp = await firstValueFrom(
          this.http.get<SimpleDetailResponse>(url)
        );
        // Solo incluir trámites con datos (formulario completado, no borradores)
        if (resp.tramite.datos && Array.isArray(resp.tramite.datos) && resp.tramite.datos.length > 0) {
          detailed.push(resp.tramite);
        }
      } catch {
        // Si falla el detalle, skip
      }
    }

    return detailed;
  }

  /**
   * Normalizar trámite SIMPLE → esquema seguimiento_oirs_siac
   */
  private normalizeTramite(tramite: SimpleTramite): Record<string, unknown> {
    const datos = this.flattenDatos(tramite.datos);
    const etapaActual = this.getEtapaActual(tramite.etapas);
    const usuario = etapaActual?.usuario_asignado;

    const fechaIngreso = tramite.fecha_inicio;
    const fechaVencimiento = etapaActual?.fecha_vencimiento || this.calcularVencimiento(fechaIngreso);

    const funcionarioNombre = usuario?.nombres
      ? `${usuario.nombres} ${usuario.apellido_paterno || ''} ${usuario.apellido_materno || ''}`.trim()
      : null;

    return {
      folio: `OIRS-${tramite.id}`,
      folio_simple: `SMP-${tramite.id}`,
      fecha_ingreso: fechaIngreso,
      fecha_vencimiento: fechaVencimiento,
      etapa_actual_id: etapaActual?.tarea?.id ?? 0,
      etapa_actual_nombre: this.limpiarNombreEtapa(etapaActual?.tarea?.nombre ?? 'Desconocida'),
      tipo_solicitud: this.extractField(datos, ['tipo_solicitud', 'tipo', 'Tipo de solicitud']) || 'OIRS',
      motivo: this.extractField(datos, ['motivo_de_tu_contacto', 'motivo', 'categoria', 'Motivo']),
      submotivo: this.extractField(datos, ['submotivo', 'subcategoria', 'Submotivo']),
      area_derivada: this.extractField(datos, ['area_derivada', 'area', 'Area', 'Área']),
      solicitante_nombre: this.extractField(datos, ['nombre_ciudadano', 'nombre_completo', 'nombre', 'nombre_solicitante']),
      solicitante_rut: this.extractField(datos, ['solicitante', 'rut', 'rut_solicitante', 'RUT']),
      solicitante_email: this.extractField(datos, ['correo_solicitante', 'correo_electronico', 'email', 'correo']) || usuario?.email,
      descripcion: this.extractField(datos, ['descripcion_solicitud', 'asunto', 'descripcion', 'detalle', 'mensaje']),
      respuesta: this.extractField(datos, ['respuesta', 'Respuesta', 'respuesta_oirs']),
      funcionario_asignado: funcionarioNombre,
      prioridad: this.determinePrioridad(fechaVencimiento),
      sync_at: new Date().toISOString(),
      raw_data: tramite,
    };
  }

  /**
   * Convertir datos de SIMPLE (array de objetos) a objeto plano
   */
  private flattenDatos(datos: unknown): Record<string, unknown> {
    if (!datos) return {};
    if (Array.isArray(datos)) {
      const flat: Record<string, unknown> = {};
      for (const item of datos) {
        if (typeof item === 'object' && item !== null) {
          for (const [key, value] of Object.entries(item)) {
            if (value !== null && value !== undefined && value !== '') {
              flat[key] = value;
            }
          }
        }
      }
      return flat;
    }
    if (typeof datos === 'object') return datos as Record<string, unknown>;
    return {};
  }

  private getEtapaActual(etapas: SimpleEtapa[]): SimpleEtapa | null {
    if (!etapas || etapas.length === 0) return null;
    return etapas.find(e => e.estado === 'pendiente') || etapas[0];
  }

  private limpiarNombreEtapa(nombre: string): string {
    return nombre.replace(/^\d+\.\s*/, '');
  }

  private extractField(obj: Record<string, unknown>, fieldNames: string[]): string | null {
    for (const name of fieldNames) {
      const value = obj[name];
      if (value !== null && value !== undefined && value !== '') {
        return String(value);
      }
    }
    return null;
  }

  private calcularVencimiento(fechaIngreso: string): string {
    const fecha = new Date(fechaIngreso);
    fecha.setDate(fecha.getDate() + 21);
    return fecha.toISOString();
  }

  private determinePrioridad(fechaVencimiento: string): string {
    const vencimiento = new Date(fechaVencimiento);
    const ahora = new Date();
    const dias = Math.ceil((vencimiento.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24));
    if (dias < 0) return 'critica';
    if (dias <= 3) return 'urgente';
    return 'normal';
  }
}
