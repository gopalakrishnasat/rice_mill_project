import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models/auth.models';

@Component({
  selector: 'app-dashboard-placeholder',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard-placeholder.component.html',
  styleUrls: ['./dashboard-placeholder.component.scss'],
})
export class DashboardPlaceholderComponent {
  readonly authService = inject(AuthService);
  readonly user = this.authService.currentUser;
  readonly permissions = this.authService.permissions;

  readonly isSuperAdmin = computed(
    () => this.user()?.role === UserRole.SUPER_ADMIN,
  );
  readonly isAdmin = computed(
    () =>
      this.user()?.role === UserRole.SUPER_ADMIN ||
      this.user()?.role === UserRole.ADMIN,
  );

  logout(): void {
    this.authService.logout();
  }
}
