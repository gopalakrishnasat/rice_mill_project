import { Route } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { DashboardPlaceholderComponent } from './features/dashboard/dashboard-placeholder.component';
import { UserManagementComponent } from './features/users/user-management.component';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { superAdminGuard } from './core/guards/super-admin.guard';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login',
  },
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [guestGuard],
  },
  {
    path: 'dashboard',
    component: DashboardPlaceholderComponent,
    canActivate: [authGuard],
  },
  {
    path: 'users',
    component: UserManagementComponent,
    canActivate: [authGuard, superAdminGuard],
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
