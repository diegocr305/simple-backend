import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  
  
  IonSpinner,
  IonCard,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonChip,
  IonLabel,


  IonItem,
  IonList,
  IonBadge,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  downloadOutline,
  funnelOutline,
  chevronForwardOutline,
  searchOutline,
  syncOutline,
} from 'ionicons/icons';
import { OirsService } from '../../services/oirs.service';
import { CsvExportService } from '../../services/csv-export.service';
import {
  SeguimientoOirs,
  FiltroSeguimiento,
  EstadoFuncional,
  ETAPAS_OIRS,
} from '../../models/oirs.model';
import { SemaforoComponent } from '../../shared/components/semaforo/semaforo.component';
import { EtapaBadgeComponent } from '../../shared/components/etapa-badge/etapa-badge.component';

@Component({
  selector: 'app-seguimiento',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
    IonIcon, IonSearchbar, IonSelect, IonSelectOption,
    IonSpinner,
    IonCard, IonCardContent, IonGrid, IonRow, IonCol,
    IonChip, IonLabel, 
    IonItem, IonList, IonBadge, RouterLink,
    SemaforoComponent, EtapaBadgeComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Seguimiento OIRS</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="sincronizar()" title="Sincronizar con SIMPLE" [disabled]="syncing">
            <ion-icon name="sync-outline" [class.spin]="syncing"></ion-icon>
          </ion-button>
          <ion-button (click)="exportarCSV()" title="Exportar CSV">
            <ion-icon name="download-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar
          placeholder="Buscar por folio, nombre o RUT..."
          [debounce]="400"
          (ionInput)="onSearch($event)"
        ></ion-searchbar>
      </ion-toolbar>
    </ion-header>

    <ion-content>


      <!-- Filtros -->
      <div style="padding: 8px 16px;">
        <ion-grid>
          <ion-row>
            <ion-col size="12" size-md="4">
              <ion-select
                label="Estado"
                labelPlacement="floating"
                interface="popover"
                [(ngModel)]="filtros.estado_funcional"
                (ionChange)="aplicarFiltros()"
              >
                <ion-select-option [value]="undefined">Todos</ion-select-option>
                <ion-select-option value="vigente">Vigente</ion-select-option>
                <ion-select-option value="por_vencer">Por vencer</ion-select-option>
                <ion-select-option value="vencido">Vencido</ion-select-option>
                <ion-select-option value="respondido">Respondido</ion-select-option>
                <ion-select-option value="cerrado">Cerrado</ion-select-option>
              </ion-select>
            </ion-col>
            <ion-col size="12" size-md="4">
              <ion-select
                label="Etapa"
                labelPlacement="floating"
                interface="popover"
                [(ngModel)]="filtros.etapa_id"
                (ionChange)="aplicarFiltros()"
              >
                <ion-select-option [value]="undefined">Todas</ion-select-option>
                @for (etapa of etapas; track etapa.id) {
                  <ion-select-option [value]="etapa.id">{{ etapa.nombre }}</ion-select-option>
                }
              </ion-select>
            </ion-col>
            <ion-col size="12" size-md="4">
              <ion-select
                label="Área"
                labelPlacement="floating"
                interface="popover"
                [(ngModel)]="filtros.area_derivada"
                (ionChange)="aplicarFiltros()"
              >
                <ion-select-option [value]="undefined">Todas</ion-select-option>
                @for (area of areas; track area) {
                  <ion-select-option [value]="area">{{ area }}</ion-select-option>
                }
              </ion-select>
            </ion-col>
          </ion-row>
        </ion-grid>
      </div>

      <!-- Contador -->
      <div class="results-info">
        <span>{{ totalResults }} resultado{{ totalResults !== 1 ? 's' : '' }}</span>
        @if (hasActiveFilters()) {
          <ion-chip (click)="limpiarFiltros()" color="medium">
            <ion-label>Limpiar filtros</ion-label>
          </ion-chip>
        }
      </div>

      @if (loading && page === 1) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
        </div>
      } @else {
        <!-- Lista de trámites -->
        <ion-list lines="full">
          @for (tramite of tramites; track tramite.id) {
            <ion-item button (click)="verDetalle(tramite.id)" detail="true">
              <ion-label>
                <h2 style="color: var(--ion-color-primary); font-weight: 700;">{{ tramite.folio }}</h2>
                <p>{{ tramite.descripcion | slice:0:80 }}</p>
                <p>
                  <ion-badge color="medium" style="margin-right: 8px;">{{ tramite.etapa_actual_nombre }}</ion-badge>
                  <span [style.color]="tramite.dias_restantes < 0 ? 'red' : tramite.dias_restantes <= 3 ? 'orange' : 'green'">
                    {{ tramite.dias_restantes < 0 ? (tramite.dias_restantes * -1) + 'd vencido' : tramite.dias_restantes + 'd restantes' }}
                  </span>
                </p>
                <p *ngIf="tramite.solicitante_nombre">{{ tramite.solicitante_nombre }}</p>
              </ion-label>
              <app-semaforo slot="end" [estado]="tramite.estado_funcional" [showLabel]="false"></app-semaforo>
            </ion-item>
          } @empty {
            <ion-item>
              <ion-label class="ion-text-center">
                <p>No se encontraron tramites con los filtros actuales</p>
              </ion-label>
            </ion-item>
          }
        </ion-list>

        
      }
    </ion-content>
  `,
  styles: [`
    .filtros-container {
      padding: 8px 16px;
      background: white;
      border-bottom: 1px solid var(--ion-color-light-shade);
    }

    .results-info {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px;
      font-size: 13px;
      color: var(--ion-color-medium);
    }

    .loading-container {
      display: flex;
      justify-content: center;
      padding: 48px;
    }

    .tramites-list {
      padding: 0;
    }

    .tramite-item {
      width: 100%;
      padding: 12px 0;
    }

    .tramite-item__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }

    .tramite-item__folio {
      font-weight: 700;
      font-size: 15px;
      color: var(--ion-color-primary);
    }

    .tramite-item__body {
      margin-bottom: 8px;
    }

    .tramite-item__descripcion {
      font-size: 13px;
      color: var(--ion-color-dark);
      margin: 0 0 8px;
      line-height: 1.4;
    }

    .tramite-item__meta {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .tramite-item__dias {
      font-size: 12px;
      font-weight: 600;
    }

    .tramite-item__footer {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: var(--ion-color-medium);
    }

    .text-danger { color: var(--ion-color-danger); }
    .text-warning { color: var(--ion-color-warning); }
    .text-success { color: var(--ion-color-success); }

    .empty-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 64px 24px;
      color: var(--ion-color-medium);

      ion-icon {
        font-size: 48px;
        margin-bottom: 16px;
      }
    }

    .spin {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `],
})
export class SeguimientoPage implements OnInit {
  tramites: SeguimientoOirs[] = [];
  loading = false;
  syncing = false;
  page = 1;
  pageSize = 20;
  totalResults = 0;
  hasMore = true;

  filtros: FiltroSeguimiento = {};
  etapas = ETAPAS_OIRS;
  areas: string[] = [];

  constructor(
    private oirsService: OirsService,
    private csvExport: CsvExportService,
    private router: Router,
  ) {
    addIcons({ downloadOutline, funnelOutline, chevronForwardOutline, searchOutline, syncOutline });
  }

  async ngOnInit(): Promise<void> {
    await this.loadAreas();
    await this.loadData();
  }

  async loadAreas(): Promise<void> {
    try {
      this.areas = await this.oirsService.getAreasDerivadas();
    } catch (error) {
      console.error('Error cargando áreas:', error);
    }
  }

  async loadData(reset = true): Promise<void> {
    if (reset) {
      this.page = 1;
      this.tramites = [];
      this.hasMore = true;
    }

    this.loading = true;

    try {
      const result = await this.oirsService.getSeguimientos(this.filtros, {
        page: this.page,
        pageSize: this.pageSize,
      });

      if (reset) {
        this.tramites = result.data;
      } else {
        this.tramites = [...this.tramites, ...result.data];
      }

      this.totalResults = result.total;
      this.hasMore = this.page < result.totalPages;
    } catch (error) {
      console.error('Error cargando seguimientos:', error);
    } finally {
      this.loading = false;
    }
  }

  onSearch(event: any): void {
    this.filtros.busqueda = event.detail.value || undefined;
    this.loadData();
  }

  aplicarFiltros(): void {
    this.loadData();
  }

  limpiarFiltros(): void {
    this.filtros = {};
    this.loadData();
  }

  hasActiveFilters(): boolean {
    return !!(this.filtros.estado_funcional || this.filtros.etapa_id || this.filtros.area_derivada || this.filtros.busqueda);
  }

  async loadMore(event: any): Promise<void> {
    this.page++;
    await this.loadData(false);
    event.target.complete();
  }

  async refresh(event: any): Promise<void> {
    await this.loadData();
    event.target.complete();
  }

  verDetalle(id: string): void {
    this.router.navigate(['/detalle', id]);
  }

  async sincronizar(): Promise<void> {
    this.syncing = true;
    try {
      await this.loadData();
    } catch (error) {
      console.error('Error recargando:', error);
    } finally {
      this.syncing = false;
    }
  }

  async exportarCSV(): Promise<void> {
    try {
      const data = await this.oirsService.exportar(this.filtros);
      this.csvExport.exportar(data, 'seguimiento_oirs');
    } catch (error) {
      console.error('Error exportando:', error);
    }
  }
}
