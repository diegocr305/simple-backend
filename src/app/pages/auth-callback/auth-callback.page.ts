import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';
import { SupabaseService } from '../../services/supabase.service';

/**
 * Página intermedia que procesa el callback de OAuth (Google).
 * Supabase detecta el token en la URL automáticamente y establece la sesión.
 * Luego redirige al dashboard.
 */
@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [IonContent, IonSpinner],
  template: `
    <ion-content class="callback-content">
      <div class="callback-wrapper">
        <ion-spinner name="crescent"></ion-spinner>
        <p>Iniciando sesión...</p>
      </div>
    </ion-content>
  `,
  styles: [`
    .callback-content {
      --background: #f9fafb;
    }
    .callback-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--ion-color-medium);
    }
  `],
})
export class AuthCallbackPage implements OnInit {
  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    // Supabase client detecta automáticamente el hash con el token
    // al inicializar (detectSessionInUrl: true en la config).
    // Solo esperamos un momento y redirigimos.
    const { data: { session } } = await this.supabaseService.client.auth.getSession();

    if (session) {
      this.router.navigate(['/tabs/dashboard'], { replaceUrl: true });
    } else {
      // Si no hay sesión, esperar un poco más (a veces tarda el exchange)
      setTimeout(async () => {
        const { data: { session: retrySession } } = await this.supabaseService.client.auth.getSession();
        if (retrySession) {
          this.router.navigate(['/tabs/dashboard'], { replaceUrl: true });
        } else {
          this.router.navigate(['/login'], { replaceUrl: true });
        }
      }, 2000);
    }
  }
}
