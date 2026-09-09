import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  checkmarkCircle,
  alertCircle,
  closeCircle,
  timeOutline,
  checkmarkDoneCircle,
} from 'ionicons/icons';
import { EstadoFuncional } from '../../../models/oirs.model';

@Component({
  selector: 'app-semaforo',
  standalone: true,
  imports: [CommonModule, IonIcon],
  template: `
    <span class="semaforo" [ngClass]="'semaforo--' + estado" [title]="getLabel()">
      <ion-icon [name]="getIcon()"></ion-icon>
      @if (showLabel) {
        <span class="semaforo__label">{{ getLabel() }}</span>
      }
    </span>
  `,
  styles: [`
    .semaforo {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;

      ion-icon {
        font-size: 16px;
      }
    }

    .semaforo--vigente {
      background: #d1fae5;
      color: #065f46;
    }

    .semaforo--por_vencer {
      background: #fef3c7;
      color: #92400e;
    }

    .semaforo--vencido {
      background: #fee2e2;
      color: #991b1b;
    }

    .semaforo--respondido {
      background: #dbeafe;
      color: #1e40af;
    }

    .semaforo--cerrado {
      background: #e5e7eb;
      color: #374151;
    }
  `],
})
export class SemaforoComponent {
  @Input() estado: EstadoFuncional = 'vigente';
  @Input() showLabel = true;

  constructor() {
    addIcons({
      checkmarkCircle,
      alertCircle,
      closeCircle,
      timeOutline,
      checkmarkDoneCircle,
    });
  }

  getIcon(): string {
    const icons: Record<EstadoFuncional, string> = {
      vigente: 'checkmark-circle',
      por_vencer: 'alert-circle',
      vencido: 'close-circle',
      respondido: 'checkmark-done-circle',
      cerrado: 'time-outline',
    };
    return icons[this.estado];
  }

  getLabel(): string {
    const labels: Record<EstadoFuncional, string> = {
      vigente: 'Vigente',
      por_vencer: 'Por vencer',
      vencido: 'Vencido',
      respondido: 'Respondido',
      cerrado: 'Cerrado',
    };
    return labels[this.estado];
  }
}
