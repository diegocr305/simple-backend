/**
 * Modelo de datos para seguimiento OIRS/SIAC
 * Refleja la tabla seguimiento_oirs_siac en Supabase
 */

export interface SeguimientoOirs {
  id: string;
  folio: string;
  folio_simple: string;
  fecha_ingreso: string;
  fecha_vencimiento: string;
  dias_restantes: number;
  estado_funcional: EstadoFuncional;
  etapa_actual_id: number;
  etapa_actual_nombre: string;
  tipo_solicitud: string;
  motivo: string;
  submotivo: string;
  area_derivada: string;
  
  // Etiquetas internas (clasificación para reportería)
  area_responsable_etiqueta: string | null;
  tematica: string | null;
  subtematica: string | null;
  tipo_requirente: string | null;
  solicitante_nombre: string;
  solicitante_rut: string;
  solicitante_email: string;
  descripcion: string;
  respuesta: string | null;
  funcionario_asignado: string | null;
  prioridad: Prioridad;
  created_at: string;
  updated_at: string;
  sync_at: string;
  raw_data: Record<string, unknown>;
}

export type EstadoFuncional = 'vigente' | 'por_vencer' | 'vencido' | 'respondido' | 'cerrado';

export type Prioridad = 'normal' | 'urgente' | 'critica';

export interface EtapaSimple {
  id: number;
  nombre: string;
  orden: number;
}

// Etapas del proceso SIMPLE 22 (OIRS/SIAC V4)
export const ETAPAS_OIRS: EtapaSimple[] = [
  { id: 54, nombre: 'Ingreso de Solicitud', orden: 1 },
  { id: 55, nombre: 'Revisión de Requerimiento', orden: 2 },
  { id: 58, nombre: 'Derivación de solicitud', orden: 3 },
  { id: 57, nombre: 'Revisión Final Oficina de Partes', orden: 4 },
  { id: 56, nombre: 'Solicitud Aprobada', orden: 5 },
];

export interface ResumenDashboard {
  total: number;
  vigentes: number;
  por_vencer: number;
  vencidos: number;
  respondidos: number;
  cerrados: number;
}

export interface FiltroSeguimiento {
  etapa_id?: number;
  estado_funcional?: EstadoFuncional;
  area_derivada?: string;
  busqueda?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
