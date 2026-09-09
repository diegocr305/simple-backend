import { Component } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonButton,
  IonIcon,
  IonSpinner,
  IonText,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { logoGoogle, shieldCheckmarkOutline } from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    IonContent, IonCard, IonCardHeader, IonCardTitle,
    IonCardContent, IonButton, IonIcon, IonSpinner, IonText,
  ],
  template: `
    <ion-content class="login-content">
      <div class="login-wrapper">
        <div class="login-header">
          <ion-icon name="shield-checkmark-outline" class="logo-icon"></ion-icon>
          <h1>OIRS SIMPLE</h1>
          <p>Sistema de Seguimiento OIRS/SIAC</p>
          <p class="subtitle">SLEP Valparaíso</p>
        </div>

        <ion-card class="login-card">
          <ion-card-header>
            <ion-card-title>Iniciar Sesión</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <p class="login-description">
              Accede con tu cuenta institucional de Google para gestionar
              los requerimientos OIRS y SIAC.
            </p>

            @if (errorMessage) {
              <ion-text color="danger">
                <p class="error-message">{{ errorMessage }}</p>
              </ion-text>
            }

            <ion-button
              expand="block"
              (click)="loginWithGoogle()"
              [disabled]="loading"
              class="google-btn"
            >
              @if (loading) {
                <ion-spinner name="crescent"></ion-spinner>
              } @else {
                <ion-icon name="logo-google" slot="start"></ion-icon>
                Continuar con Google
              }
            </ion-button>
          </ion-card-content>
        </ion-card>

        <p class="footer-text">
          Sistema interno — Servicio Local de Educación Pública Valparaíso
        </p>
      </div>
    </ion-content>
  `,
  styles: [`
    .login-content {
      --background: linear-gradient(135deg, #1a56db 0%, #7e3af2 100%);
    }

    .login-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100%;
      padding: 24px;
    }

    .login-header {
      text-align: center;
      color: white;
      margin-bottom: 32px;

      .logo-icon {
        font-size: 64px;
        margin-bottom: 16px;
      }

      h1 {
        font-size: 28px;
        font-weight: 700;
        margin: 0 0 8px;
      }

      p {
        font-size: 16px;
        margin: 0;
        opacity: 0.9;
      }

      .subtitle {
        font-size: 14px;
        opacity: 0.7;
        margin-top: 4px;
      }
    }

    .login-card {
      width: 100%;
      max-width: 400px;
      border-radius: 16px;

      ion-card-title {
        text-align: center;
        font-size: 20px;
      }
    }

    .login-description {
      text-align: center;
      color: var(--ion-color-medium);
      margin-bottom: 24px;
      font-size: 14px;
      line-height: 1.5;
    }

    .error-message {
      text-align: center;
      font-size: 13px;
      margin-bottom: 16px;
    }

    .google-btn {
      --border-radius: 8px;
      height: 48px;
      font-weight: 600;
    }

    .footer-text {
      color: rgba(255, 255, 255, 0.6);
      font-size: 12px;
      margin-top: 32px;
      text-align: center;
    }
  `],
})
export class LoginPage {
  loading = false;
  errorMessage = '';

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {
    addIcons({ logoGoogle, shieldCheckmarkOutline });
    this.checkExistingSession();
  }

  private async checkExistingSession(): Promise<void> {
    const session = await this.authService.getSession();
    if (session) {
      this.router.navigate(['/tabs/dashboard']);
    }
  }

  async loginWithGoogle(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';

    try {
      await this.authService.signInWithGoogle();
    } catch (error) {
      this.errorMessage = 'Error al iniciar sesión. Intenta nuevamente.';
      console.error('Login error:', error);
    } finally {
      this.loading = false;
    }
  }
}
