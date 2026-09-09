import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Session, User } from '@supabase/supabase-js';
import { BehaviorSubject, Observable } from 'rxjs';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private currentUser = new BehaviorSubject<User | null>(null);
  user$: Observable<User | null> = this.currentUser.asObservable();

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
  ) {
    this.initAuthListener();
  }

  private initAuthListener(): void {
    this.supabaseService.client.auth.onAuthStateChange((_event, session) => {
      this.currentUser.next(session?.user ?? null);
    });
  }

  async signInWithGoogle(): Promise<void> {
    const { error } = await this.supabaseService.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      console.error('Error al iniciar sesión con Google:', error.message);
      throw error;
    }
  }

  async signOut(): Promise<void> {
    await this.supabaseService.client.auth.signOut();
    this.router.navigate(['/login']);
  }

  async getSession(): Promise<Session | null> {
    const { data: { session } } = await this.supabaseService.client.auth.getSession();
    return session;
  }

  async getUser(): Promise<User | null> {
    const { data: { user } } = await this.supabaseService.client.auth.getUser();
    return user;
  }
}
