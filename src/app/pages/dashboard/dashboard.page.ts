import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonChip,
  IonLabel,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  syncOutline,
  analyticsOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  closeCircleOutline,
  documentTextOutline,
  archiveOutline,
  trendingUpOutline,
} from 'ionicons/icons';
import { OirsService } from '../../services/oirs.service';

import { ResumenDashboard } from '../../models/oirs.model';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
    IonIcon, IonSpinner,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonGrid, IonRow, IonCol, IonChip, IonLabel,
    KpiCardComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Dashboard OIRS</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="syncManual()" [disabled]="syncing">
            <ion-icon name="sync-outline" [class.spinning]="syncing"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>


      @if (loading) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
          <p>Cargando datos...</p>
        </div>
      } @else {
        <!-- KPI Cards -->
        <div class="dashboard-container">
          <h2 class="section-title">Resumen General</h2>

          <ion-grid>
            <ion-row>
              <ion-col size="12" size-md="6" size-lg="4">
                <app-kpi-card
                  [value]="resumen.total"
                  label="Total Trámites"
                  icon="document-text-outline"
                  color="primary"
                ></app-kpi-card>
              </ion-col>
              <ion-col size="12" size-md="6" size-lg="4">
                <app-kpi-card
                  [value]="resumen.vigentes"
                  label="Vigentes"
                  icon="checkmark-circle-outline"
                  color="success"
                ></app-kpi-card>
              </ion-col>
              <ion-col size="12" size-md="6" size-lg="4">
                <app-kpi-card
                  [value]="resumen.por_vencer"
                  label="Por Vencer"
                  icon="alert-circle-outline"
                  color="warning"
                ></app-kpi-card>
              </ion-col>
              <ion-col size="12" size-md="6" size-lg="4">
                <app-kpi-card
                  [value]="resumen.vencidos"
                  label="Vencidos"
                  icon="close-circle-outline"
                  color="danger"
                ></app-kpi-card>
              </ion-col>
              <ion-col size="12" size-md="6" size-lg="4">
                <app-kpi-card
                  [value]="resumen.respondidos"
                  label="Respondidos"
                  icon="archive-outline"
                  color="info"
                ></app-kpi-card>
              </ion-col>
              <ion-col size="12" size-md="6" size-lg="4">
                <app-kpi-card
                  [value]="resumen.cerrados"
                  label="Cerrados"
                  icon="analytics-outline"
                  color="neutral"
                ></app-kpi-card>
              </ion-col>
            </ion-row>
          </ion-grid>

          <!-- Por Etapa -->
          <h2 class="section-title">Por Etapa</h2>
          <ion-card>
            <ion-card-content>
              @for (etapa of conteoPorEtapa; track etapa.etapa_actual_nombre) {
                <div class="etapa-row">
                  <span class="etapa-row__nombre">{{ etapa.etapa_actual_nombre }}</span>
                  <div class="etapa-row__bar">
                    <div
                      class="etapa-row__fill"
                      [style.width.%]="getEtapaPercent(etapa.count)"
                    ></div>
                  </div>
                  <span class="etapa-row__count">{{ etapa.count }}</span>
                </div>
              } @empty {
                <p class="empty-text">Sin datos por etapa</p>
              }
            </ion-card-content>
          </ion-card>

          <!-- Sync Info -->
          @if (syncMessage) {
            <ion-chip [color]="syncSuccess ? 'success' : 'danger'">
              <ion-label>{{ syncMessage }}</ion-label>
            </ion-chip>
          }

          <p class="last-sync">
            Última actualización: {{ lastUpdate | date:'dd/MM/yyyy HH:mm' }}
          </p>
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .dashboard-container {
      padding: 16px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .section-title {
      font-size: 18px;
      font-weight: 600;
      margin: 24px 0 12px;
      color: var(--ion-color-dark);
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 60vh;
      color: var(--ion-color-medium);
    }

    .etapa-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid var(--ion-color-light-shade);

      &:last-child {
        border-bottom: none;
      }
    }

    .etapa-row__nombre {
      flex: 0 0 220px;
      font-size: 14px;
      font-weight: 500;
    }

    .etapa-row__bar {
      flex: 1;
      height: 8px;
      background: var(--ion-color-light);
      border-radius: 4px;
      overflow: hidden;
    }

    .etapa-row__fill {
      height: 100%;
      background: var(--ion-color-primary);
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .etapa-row__count {
      flex: 0 0 40px;
      text-align: right;
      font-weight: 700;
      font-size: 16px;
      color: var(--ion-color-primary);
    }

    .last-sync {
      text-align: center;
      font-size: 12px;
      color: var(--ion-color-medium);
      margin-top: 24px;
    }

    .empty-text {
      text-align: center;
      color: var(--ion-color-medium);
      padding: 16px;
    }

    .spinning {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @media (max-width: 768px) {
      .etapa-row__nombre {
        flex: 0 0 140px;
        font-size: 12px;
      }
    }
  `],
})
export class DashboardPage implements OnInit {
  loading = true;
  syncing = false;
  syncMessage = '';
  syncSuccess = false;
  lastUpdate = new Date();

  resumen: ResumenDashboard = {
    total: 0,
    vigentes: 0,
    por_vencer: 0,
    vencidos: 0,
    respondidos: 0,
    cerrados: 0,
  };

  conteoPorEtapa: { etapa_actual_nombre: string; count: number }[] = [];

  constructor(
    private oirsService: OirsService,
    private router: Router,

  ) {
    addIcons({
      syncOutline, analyticsOutline, checkmarkCircleOutline,
      alertCircleOutline, closeCircleOutline, documentTextOutline,
      archiveOutline, trendingUpOutline,
    });
  }

  async ngOnInit(): Promise<void> {
    await this.loadData();
  }

  async loadData(): Promise<void> {
    this.loading = true;
    try {
      const [resumen, conteo] = await Promise.all([
        this.oirsService.getResumen(),
        this.oirsService.getConteoPorEtapa(),
      ]);
      this.resumen = resumen;
      this.conteoPorEtapa = conteo;
      this.lastUpdate = new Date();
    } catch (error) {
      console.error('Error cargando dashboard:', error);
    } finally {
      this.loading = false;
    }
  }

  async refresh(event: any): Promise<void> {
    await this.loadData();
    event.target.complete();
  }

  async syncManual(): Promise<void> {
    this.syncing = true;
    this.syncMessage = '';

    try {
      await this.loadData();
      this.syncMessage = 'Datos actualizados';
      this.syncSuccess = true;
    } catch (error) {
      this.syncMessage = 'Error al recargar'; //ón';
      this.syncSuccess = false;
    } finally {
      this.syncing = false;
    }
  }

  getEtapaPercent(count: number): number {
    const max = Math.max(...this.conteoPorEtapa.map(e => e.count), 1);
    return (count / max) * 100;
  }
}
