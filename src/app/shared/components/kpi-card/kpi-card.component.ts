import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonCard, IonCardContent, IonIcon } from '@ionic/angular/standalone';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [CommonModule, IonCard, IonCardContent, IonIcon],
  template: `
    <ion-card class="kpi-card" [ngClass]="'kpi-card--' + color" button (click)="null">
      <ion-card-content>
        <div class="kpi-card__icon">
          <ion-icon [name]="icon"></ion-icon>
        </div>
        <div class="kpi-card__info">
          <span class="kpi-card__value">{{ value }}</span>
          <span class="kpi-card__label">{{ label }}</span>
        </div>
      </ion-card-content>
    </ion-card>
  `,
  styles: [`
    .kpi-card {
      margin: 0;
      border-radius: 12px;
      cursor: pointer;
      transition: transform 0.2s;

      &:hover {
        transform: translateY(-2px);
      }

      ion-card-content {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
      }
    }

    .kpi-card__icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;

      ion-icon {
        font-size: 24px;
      }
    }

    .kpi-card__info {
      display: flex;
      flex-direction: column;
    }

    .kpi-card__value {
      font-size: 28px;
      font-weight: 700;
      line-height: 1;
    }

    .kpi-card__label {
      font-size: 13px;
      color: var(--ion-color-medium);
      margin-top: 4px;
    }

    .kpi-card--primary .kpi-card__icon {
      background: #dbeafe;
      color: #1a56db;
    }
    .kpi-card--primary .kpi-card__value { color: #1a56db; }

    .kpi-card--success .kpi-card__icon {
      background: #d1fae5;
      color: #065f46;
    }
    .kpi-card--success .kpi-card__value { color: #065f46; }

    .kpi-card--warning .kpi-card__icon {
      background: #fef3c7;
      color: #92400e;
    }
    .kpi-card--warning .kpi-card__value { color: #92400e; }

    .kpi-card--danger .kpi-card__icon {
      background: #fee2e2;
      color: #991b1b;
    }
    .kpi-card--danger .kpi-card__value { color: #991b1b; }

    .kpi-card--info .kpi-card__icon {
      background: #e0e7ff;
      color: #3730a3;
    }
    .kpi-card--info .kpi-card__value { color: #3730a3; }

    .kpi-card--neutral .kpi-card__icon {
      background: #e5e7eb;
      color: #374151;
    }
    .kpi-card--neutral .kpi-card__value { color: #374151; }
  `],
})
export class KpiCardComponent {
  @Input() value: number | string = 0;
  @Input() label = '';
  @Input() icon = 'analytics-outline';
  @Input() color: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' = 'primary';
}
