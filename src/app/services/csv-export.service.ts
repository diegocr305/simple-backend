import { Injectable } from '@angular/core';
import { SeguimientoOirs } from '../models/oirs.model';

@Injectable({
  providedIn: 'root',
})
export class CsvExportService {

  /**
   * Exportar seguimientos a CSV y descargar
   */
  exportar(data: SeguimientoOirs[], filename: string): void {
    if (!data.length) {
      console.warn('No hay datos para exportar');
      return;
    }

    const headers = [
      'Folio',
      'Folio SIMPLE',
      'Fecha Ingreso',
      'Fecha Vencimiento',
      'Días Restantes',
      'Estado',
      'Etapa',
      'Tipo Solicitud',
      'Motivo',
      'Submotivo',
      'Área Derivada',
      'Solicitante',
      'RUT',
      'Email',
      'Descripción',
      'Respuesta',
      'Funcionario Asignado',
      'Prioridad',
    ];

    const rows = data.map(item => [
      item.folio,
      item.folio_simple,
      this.formatDate(item.fecha_ingreso),
      this.formatDate(item.fecha_vencimiento),
      item.dias_restantes?.toString() ?? '',
      this.formatEstado(item.estado_funcional),
      item.etapa_actual_nombre,
      item.tipo_solicitud,
      item.motivo ?? '',
      item.submotivo ?? '',
      item.area_derivada ?? '',
      item.solicitante_nombre ?? '',
      item.solicitante_rut ?? '',
      item.solicitante_email ?? '',
      this.escapeCsv(item.descripcion ?? ''),
      this.escapeCsv(item.respuesta ?? ''),
      item.funcionario_asignado ?? '',
      item.prioridad,
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.join(';')),
    ].join('\n');

    // BOM para que Excel reconozca UTF-8
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${this.getTimestamp()}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  private formatDate(date: string): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('es-CL');
  }

  private formatEstado(estado: string): string {
    const map: Record<string, string> = {
      vigente: 'Vigente',
      por_vencer: 'Por vencer',
      vencido: 'Vencido',
      respondido: 'Respondido',
      cerrado: 'Cerrado',
    };
    return map[estado] || estado;
  }

  private escapeCsv(value: string): string {
    if (value.includes(';') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private getTimestamp(): string {
    const now = new Date();
    return `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
  }
}
