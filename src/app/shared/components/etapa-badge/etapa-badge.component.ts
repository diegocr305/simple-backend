import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-etapa-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="etapa-badge" [ngClass]="'etapa-badge--' + getColorClass()">
      {{ etapaNombre }}
    </span>
  `,
  styles: [`
    .etapa-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
    }

    .etapa-badge--ingreso {
      background: #ede9fe;
      color: #5b21b6;
    }

    .etapa-badge--revision {
      background: #dbeafe;
      color: #1e40af;
    }

    .etapa-badge--derivacion {
      background: #fef3c7;
      color: #92400e;
    }

    .etapa-badge--final {
      background: #d1fae5;
      color: #065f46;
    }
  `],
})
export class EtapaBadgeComponent {
  @Input() etapaId = 4;
  @Input() etapaNombre = '';

  getColorClass(): string {
    const map: Record<number, string> = {
      54: 'ingreso',
      55: 'revision',
      56: 'derivacion',
      57: 'final',
    };
    return map[this.etapaId] || 'ingreso';
  }
}
