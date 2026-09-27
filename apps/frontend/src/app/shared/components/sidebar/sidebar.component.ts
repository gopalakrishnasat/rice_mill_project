import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { SidebarService } from '../../../core/services/sidebar.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent {
  readonly authService = inject(AuthService);
  readonly sidebarService = inject(SidebarService);

  readonly isCollapsed = this.sidebarService.isCollapsed;
  readonly isSuperAdmin = this.authService.isSuperAdmin;

  toggleCollapse(): void {
    this.sidebarService.toggle();
  }
}
