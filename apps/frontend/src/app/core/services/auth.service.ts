import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError } from 'rxjs';
import {
  ApiResponse,
  AuthResponseData,
  IUser,
  LoginRequestDto,
  Permission,
  ROLE_PERMISSIONS,
  UserRole,
} from '../models/auth.models';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly API_URL = 'http://localhost:3000/api/auth';
  private readonly TOKEN_KEY = 'rice_mill_token';
  private readonly USER_KEY = 'rice_mill_user';

  // Reactive State with Angular Signals
  readonly currentUser = signal<IUser | null>(this.getStoredUser());
  readonly isAuthenticated = computed(() => !!this.currentUser());
  readonly isSuperAdmin = computed(() => this.currentUser()?.role === UserRole.SUPER_ADMIN);
  readonly permissions = computed<Permission[]>(() => {
    const user = this.currentUser();
    if (!user) return [];
    return ROLE_PERMISSIONS[user.role as UserRole] || [];
  });

  constructor() {
    if (this.getToken()) {
      this.fetchProfile().subscribe({
        error: () => {
          this.logout(false);
        },
      });
    }
  }

  login(credentials: LoginRequestDto): Observable<ApiResponse<AuthResponseData>> {
    return this.http
      .post<ApiResponse<AuthResponseData>>(`${this.API_URL}/login`, credentials)
      .pipe(
        tap((response) => {
          if (response.success && response.data) {
            const { accessToken, user } = response.data;
            this.setSession(accessToken, user, credentials.rememberMe ?? false);
          }
        }),
        catchError((err) => {
          return throwError(() => err);
        })
      );
  }

  fetchProfile(): Observable<ApiResponse<{ user: IUser; permissions: Permission[] }>> {
    return this.http
      .get<ApiResponse<{ user: IUser; permissions: Permission[] }>>(
        `${this.API_URL}/me`
      )
      .pipe(
        tap((response) => {
          if (response.success && response.data?.user) {
            this.currentUser.set(response.data.user);
            this.persistUserData(response.data.user);
          }
        })
      );
  }

  forgotPassword(email: string): Observable<ApiResponse<{ message: string }>> {
    return this.http.post<ApiResponse<{ message: string }>>(
      `${this.API_URL}/forgot-password`,
      { email }
    );
  }

  logout(redirect = true): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    sessionStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.USER_KEY);
    this.currentUser.set(null);

    if (redirect) {
      this.router.navigate(['/login']);
    }
  }

  getToken(): string | null {
    return (
      localStorage.getItem(this.TOKEN_KEY) ||
      sessionStorage.getItem(this.TOKEN_KEY)
    );
  }

  hasPermission(permission: Permission): boolean {
    const user = this.currentUser();
    if (!user) return false;
    if (user.role === UserRole.SUPER_ADMIN) return true;
    return this.permissions().includes(permission);
  }

  private setSession(token: string, user: IUser, rememberMe: boolean): void {
    const storage = rememberMe ? localStorage : sessionStorage;

    if (rememberMe) {
      sessionStorage.removeItem(this.TOKEN_KEY);
      sessionStorage.removeItem(this.USER_KEY);
    } else {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    }

    storage.setItem(this.TOKEN_KEY, token);
    storage.setItem(this.USER_KEY, JSON.stringify(user));
    this.currentUser.set(user);
  }

  private persistUserData(user: IUser): void {
    if (localStorage.getItem(this.TOKEN_KEY)) {
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    } else if (sessionStorage.getItem(this.TOKEN_KEY)) {
      sessionStorage.setItem(this.USER_KEY, JSON.stringify(user));
    }
  }

  private getStoredUser(): IUser | null {
    try {
      const stored =
        localStorage.getItem(this.USER_KEY) ||
        sessionStorage.getItem(this.USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }
}
