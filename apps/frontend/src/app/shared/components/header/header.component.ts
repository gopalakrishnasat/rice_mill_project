import { Component, inject, signal, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CompanyService } from '../../../core/services/company.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly companyService = inject(CompanyService);

  readonly currentUser = this.authService.currentUser;
  readonly isSuperAdmin = this.authService.isSuperAdmin;
  readonly currentCompany = this.companyService.currentCompany;

  readonly showLogoutModal = signal<boolean>(false);

  ngOnInit(): void {
    if (this.currentUser()) {
      this.companyService.getCompanyDetails().subscribe({
        error: () => {
          // Silent fallback to defaults
        },
      });
    }
  }

  openLogoutModal(): void {
    this.showLogoutModal.set(true);
  }

  cancelLogout(): void {
    this.showLogoutModal.set(false);
  }

  confirmLogout(): void {
    this.showLogoutModal.set(false);
    this.authService.logout();
  }

  @HostListener('window:keydown.escape')
  handleEscapeKey(): void {
    if (this.showLogoutModal()) {
      this.cancelLogout();
    }
  }
}
