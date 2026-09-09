import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonButton,
  IonIcon,
  IonSpinner,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonItem,
  IonLabel,
  IonList,
  IonChip,
  IonNote,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  personOutline,
  calendarOutline,
  documentTextOutline,
  chatbubblesOutline,
  timeOutline,
  businessOutline,
  mailOutline,
  cardOutline,
} from 'ionicons/icons';
import { OirsService } from '../../services/oirs.service';
import { SeguimientoOirs } from '../../models/oirs.model';
import { SemaforoComponent } from '../../shared/components/semaforo/semaforo.component';
import { EtapaBadgeComponent } from '../../shared/components/etapa-badge/etapa-badge.component';
import { SupabaseService } from '../../services/supabase.service';

interface HistorialEntry {
  id: string;
  campo_modificado: string;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  usuario: string | null;
  fecha: string;
}

@Component({
  selector: 'app-detalle',
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonButton, IonIcon, IonSpinner, IonCard, IonCardHeader, IonCardTitle,
    IonCardContent, IonGrid, IonRow, IonCol, IonItem, IonLabel, IonList,
    IonChip, IonNote,
    SemaforoComponent, EtapaBadgeComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/seguimiento"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ tramite?.folio || 'Detalle' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (loading) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
        </div>
      } @else if (tramite) {
        <div class="detalle-container">

          <!-- Header con estado -->
          <div class="detalle-header">
            <div class="detalle-header__info">
              <h1>{{ tramite.folio }}</h1>
              <p class="folio-simple">SIMPLE: {{ tramite.folio_simple }}</p>
            </div>
            <app-semaforo [estado]="tramite.estado_funcional" [showLabel]="true"></app-semaforo>
          </div>

          <!-- Etapa y prioridad -->
          <div class="detalle-tags">
            <app-etapa-badge
              [etapaId]="tramite.etapa_actual_id"
              [etapaNombre]="tramite.etapa_actual_nombre"
            ></app-etapa-badge>
            <ion-chip [color]="getPrioridadColor()">
              <ion-label>{{ tramite.prioridad | titlecase }}</ion-label>
            </ion-chip>
          </div>

          <!-- Timeline visual de etapas -->
          <ion-card>
            <ion-card-header>
              <ion-card-title>Progreso</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <div class="timeline">
                @for (step of etapasTimeline; track step.id) {
                  <div class="timeline__step" [ngClass]="{
                    'timeline__step--active': step.id === tramite.etapa_actual_id,
                    'timeline__step--completed': step.orden < getOrdenActual()
                  }">
                    <div class="timeline__dot"></div>
                    <span class="timeline__label">{{ step.nombre }}</span>
                  </div>
                }
              </div>
            </ion-card-content>
          </ion-card>

          <!-- Fechas -->
          <ion-card>
            <ion-card-header>
              <ion-card-title>
                <ion-icon name="calendar-outline"></ion-icon>
                Plazos
              </ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <ion-grid>
                <ion-row>
                  <ion-col size="6">
                    <div class="date-field">
                      <span class="date-field__label">Ingreso</span>
                      <span class="date-field__value">{{ tramite.fecha_ingreso | date:'dd/MM/yyyy' }}</span>
                    </div>
                  </ion-col>
                  <ion-col size="6">
                    <div class="date-field">
                      <span class="date-field__label">Vencimiento</span>
                      <span class="date-field__value" [ngClass]="{
                        'text-danger': tramite.dias_restantes < 0,
                        'text-warning': tramite.dias_restantes >= 0 && tramite.dias_restantes <= 3
                      }">
                        {{ tramite.fecha_vencimiento | date:'dd/MM/yyyy' }}
                      </span>
                    </div>
                  </ion-col>
                </ion-row>
                <ion-row>
                  <ion-col size="12">
                    <div class="dias-badge" [ngClass]="{
                      'dias-badge--danger': tramite.dias_restantes < 0,
                      'dias-badge--warning': tramite.dias_restantes >= 0 && tramite.dias_restantes <= 3,
                      'dias-badge--success': tramite.dias_restantes > 3
                    }">
                      @if (tramite.dias_restantes < 0) {
                        Vencido hace {{ tramite.dias_restantes * -1 }} día(s)
                      } @else if (tramite.dias_restantes === 0) {
                        Vence HOY
                      } @else {
                        {{ tramite.dias_restantes }} día(s) restantes
                      }
                    </div>
                  </ion-col>
                </ion-row>
              </ion-grid>
            </ion-card-content>
          </ion-card>

          <!-- Solicitante -->
          <ion-card>
            <ion-card-header>
              <ion-card-title>
                <ion-icon name="person-outline"></ion-icon>
                Solicitante
              </ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <ion-list lines="none">
                <ion-item>
                  <ion-icon name="person-outline" slot="start" color="primary"></ion-icon>
                  <ion-label>
                    <p>Nombre</p>
                    <h3>{{ tramite.solicitante_nombre || 'No informado' }}</h3>
                  </ion-label>
                </ion-item>
                <ion-item>
                  <ion-icon name="card-outline" slot="start" color="primary"></ion-icon>
                  <ion-label>
                    <p>RUT</p>
                    <h3>{{ tramite.solicitante_rut || 'No informado' }}</h3>
                  </ion-label>
                </ion-item>
                <ion-item>
                  <ion-icon name="mail-outline" slot="start" color="primary"></ion-icon>
                  <ion-label>
                    <p>Email</p>
                    <h3>{{ tramite.solicitante_email || 'No informado' }}</h3>
                  </ion-label>
                </ion-item>
              </ion-list>
            </ion-card-content>
          </ion-card>

          <!-- Clasificación -->
          <ion-card>
            <ion-card-header>
              <ion-card-title>
                <ion-icon name="business-outline"></ion-icon>
                Clasificación
              </ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <ion-list lines="none">
                <ion-item>
                  <ion-label>
                    <p>Tipo</p>
                    <h3>{{ tramite.tipo_solicitud }}</h3>
                  </ion-label>
                </ion-item>
                <ion-item>
                  <ion-label>
                    <p>Motivo</p>
                    <h3>{{ tramite.motivo || 'No clasificado' }}</h3>
                  </ion-label>
                </ion-item>
                <ion-item>
                  <ion-label>
                    <p>Submotivo</p>
                    <h3>{{ tramite.submotivo || 'No clasificado' }}</h3>
                  </ion-label>
                </ion-item>
                <ion-item>
                  <ion-label>
                    <p>Área Derivada</p>
                    <h3>{{ tramite.area_derivada || 'Sin derivar' }}</h3>
                  </ion-label>
                </ion-item>
                @if (tramite.funcionario_asignado) {
                  <ion-item>
                    <ion-label>
                      <p>Funcionario Asignado</p>
                      <h3>{{ tramite.funcionario_asignado }}</h3>
                    </ion-label>
                  </ion-item>
                }
              </ion-list>
            </ion-card-content>
          </ion-card>

          <!-- Descripción -->
          <ion-card>
            <ion-card-header>
              <ion-card-title>
                <ion-icon name="document-text-outline"></ion-icon>
                Descripción
              </ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <p class="description-text">{{ tramite.descripcion || 'Sin descripción' }}</p>
            </ion-card-content>
          </ion-card>

          <!-- Respuesta -->
          @if (tramite.respuesta) {
            <ion-card>
              <ion-card-header>
                <ion-card-title>
                  <ion-icon name="chatbubbles-outline"></ion-icon>
                  Respuesta
                </ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <p class="description-text">{{ tramite.respuesta }}</p>
              </ion-card-content>
            </ion-card>
          }

          <!-- Historial de cambios -->
          <ion-card>
            <ion-card-header>
              <ion-card-title>
                <ion-icon name="time-outline"></ion-icon>
                Historial
              </ion-card-title>
            </ion-card-header>
            <ion-card-content>
              @if (historial.length > 0) {
                <div class="historial-list">
                  @for (entry of historial; track entry.id) {
                    <div class="historial-item">
                      <div class="historial-item__dot"></div>
                      <div class="historial-item__content">
                        <span class="historial-item__campo">{{ formatCampo(entry.campo_modificado) }}</span>
                        <span class="historial-item__cambio">
                          {{ entry.valor_anterior || '(vacío)' }} → {{ entry.valor_nuevo || '(vacío)' }}
                        </span>
                        <span class="historial-item__fecha">{{ entry.fecha | date:'dd/MM/yyyy HH:mm' }}</span>
                      </div>
                    </div>
                  }
                </div>
              } @else {
                <p class="empty-text">Sin cambios registrados</p>
              }
            </ion-card-content>
          </ion-card>

        </div>
      } @else {
        <div class="error-container">
          <p>Trámite no encontrado</p>
          <ion-button (click)="volver()">Volver</ion-button>
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .detalle-container {
      padding: 16px;
      max-width: 800px;
      margin: 0 auto;
    }

    .loading-container, .error-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 60vh;
      color: var(--ion-color-medium);
    }

    .detalle-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;

      h1 {
        font-size: 24px;
        font-weight: 700;
        margin: 0;
        color: var(--ion-color-dark);
      }

      .folio-simple {
        font-size: 13px;
        color: var(--ion-color-medium);
        margin: 4px 0 0;
      }
    }

    .detalle-tags {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }

    /* Timeline */
    .timeline {
      display: flex;
      justify-content: space-between;
      position: relative;
      padding: 16px 0;

      &::before {
        content: '';
        position: absolute;
        top: 28px;
        left: 24px;
        right: 24px;
        height: 3px;
        background: var(--ion-color-light-shade);
      }
    }

    .timeline__step {
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      flex: 1;
    }

    .timeline__dot {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--ion-color-light-shade);
      border: 3px solid white;
      box-shadow: 0 0 0 2px var(--ion-color-light-shade);
      margin-bottom: 8px;
      z-index: 1;
    }

    .timeline__step--completed .timeline__dot {
      background: var(--ion-color-success);
      box-shadow: 0 0 0 2px var(--ion-color-success);
    }

    .timeline__step--active .timeline__dot {
      background: var(--ion-color-primary);
      box-shadow: 0 0 0 2px var(--ion-color-primary);
      width: 20px;
      height: 20px;
    }

    .timeline__label {
      font-size: 11px;
      text-align: center;
      color: var(--ion-color-medium);
      max-width: 80px;
    }

    .timeline__step--active .timeline__label {
      color: var(--ion-color-primary);
      font-weight: 600;
    }

    .timeline__step--completed .timeline__label {
      color: var(--ion-color-success);
    }

    /* Dates */
    .date-field {
      text-align: center;
      padding: 8px;
    }

    .date-field__label {
      display: block;
      font-size: 12px;
      color: var(--ion-color-medium);
      margin-bottom: 4px;
    }

    .date-field__value {
      font-size: 16px;
      font-weight: 600;
    }

    .dias-badge {
      text-align: center;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
    }

    .dias-badge--success { background: #d1fae5; color: #065f46; }
    .dias-badge--warning { background: #fef3c7; color: #92400e; }
    .dias-badge--danger { background: #fee2e2; color: #991b1b; }

    .text-danger { color: var(--ion-color-danger); }
    .text-warning { color: var(--ion-color-warning); }

    .description-text {
      font-size: 14px;
      line-height: 1.6;
      color: var(--ion-color-dark);
    }

    /* Historial */
    .historial-list {
      padding-left: 12px;
      border-left: 2px solid var(--ion-color-light-shade);
    }

    .historial-item {
      display: flex;
      gap: 12px;
      padding: 10px 0;
      position: relative;
    }

    .historial-item__dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--ion-color-primary);
      margin-top: 4px;
      margin-left: -17px;
    }

    .historial-item__content {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .historial-item__campo {
      font-weight: 600;
      font-size: 13px;
    }

    .historial-item__cambio {
      font-size: 13px;
      color: var(--ion-color-dark);
    }

    .historial-item__fecha {
      font-size: 11px;
      color: var(--ion-color-medium);
    }

    .empty-text {
      text-align: center;
      color: var(--ion-color-medium);
      padding: 16px;
    }

    ion-card-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;

      ion-icon {
        font-size: 20px;
        color: var(--ion-color-primary);
      }
    }
  `],
})
export class DetallePage implements OnInit {
  tramite: SeguimientoOirs | null = null;
  historial: HistorialEntry[] = [];
  loading = true;

  etapasTimeline = [
    { id: 54, nombre: 'Ingreso', orden: 1 },
    { id: 55, nombre: 'Revisión', orden: 2 },
    { id: 56, nombre: 'Derivación', orden: 3 },
    { id: 57, nombre: 'Revisión Final', orden: 4 },
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private oirsService: OirsService,
    private supabaseService: SupabaseService,
  ) {
    addIcons({
      arrowBackOutline, personOutline, calendarOutline,
      documentTextOutline, chatbubblesOutline, timeOutline,
      businessOutline, mailOutline, cardOutline,
    });
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      await this.loadDetalle(id);
      await this.loadHistorial(id);
    }
  }

  async loadDetalle(id: string): Promise<void> {
    this.loading = true;
    try {
      this.tramite = await this.oirsService.getDetalle(id);
    } catch (error) {
      console.error('Error cargando detalle:', error);
    } finally {
      this.loading = false;
    }
  }

  async loadHistorial(seguimientoId: string): Promise<void> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('historial_cambios_oirs')
        .select('*')
        .eq('seguimiento_id', seguimientoId)
        .order('fecha', { ascending: false });

      if (error) throw error;
      this.historial = data as HistorialEntry[];
    } catch (error) {
      console.error('Error cargando historial:', error);
    }
  }

  getOrdenActual(): number {
    if (!this.tramite) return 0;
    const etapa = this.etapasTimeline.find(e => e.id === this.tramite!.etapa_actual_id);
    return etapa?.orden ?? 0;
  }

  getPrioridadColor(): string {
    if (!this.tramite) return 'medium';
    const colors: Record<string, string> = {
      normal: 'success',
      urgente: 'warning',
      critica: 'danger',
    };
    return colors[this.tramite.prioridad] || 'medium';
  }

  formatCampo(campo: string): string {
    const labels: Record<string, string> = {
      etapa: 'Cambio de Etapa',
      estado_funcional: 'Cambio de Estado',
      area_derivada: 'Cambio de Área',
      funcionario_asignado: 'Asignación de Funcionario',
    };
    return labels[campo] || campo;
  }

  volver(): void {
    this.router.navigate(['/tabs/seguimiento']);
  }
}
