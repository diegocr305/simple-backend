import { Component } from '@angular/core';
import {
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,

} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { gridOutline, listOutline, logOutOutline } from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="dashboard">
          <ion-icon name="grid-outline"></ion-icon>
          <ion-label>Dashboard</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="seguimiento">
          <ion-icon name="list-outline"></ion-icon>
          <ion-label>Seguimiento</ion-label>
        </ion-tab-button>
        <ion-tab-button (click)="logout()">
          <ion-icon name="log-out-outline"></ion-icon>
          <ion-label>Salir</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
  styles: [`
    ion-tab-bar {
      --background: #ffffff;
      border-top: 1px solid #e5e7eb;
    }
  `],
})
export class TabsPage {
  constructor(private authService: AuthService) {
    addIcons({ gridOutline, listOutline, logOutOutline });
  }

  async logout(): Promise<void> {
    await this.authService.signOut();
  }
}
