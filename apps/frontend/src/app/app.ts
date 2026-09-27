import { Component, inject, computed } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from './shared/components/header/header.component';
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';
import { AuthService } from './core/services/auth.service';
import { SidebarService } from './core/services/sidebar.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';

@Component({
  imports: [CommonModule, RouterOutlet, HeaderComponent, SidebarComponent],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  readonly sidebarService = inject(SidebarService);

  readonly isAuthenticated = this.authService.isAuthenticated;
  readonly isSidebarCollapsed = this.sidebarService.isCollapsed;

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects || e.url),
    ),
    { initialValue: this.router.url },
  );

  readonly showNavigation = computed(() => {
    const url = this.currentUrl() || '';
    if (!this.isAuthenticated()) return false;
    if (url.includes('/login') || url.includes('/print')) return false;
    return true;
  });
}
