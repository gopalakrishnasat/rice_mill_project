import { Route } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { DashboardPlaceholderComponent } from './features/dashboard/dashboard-placeholder.component';
import { UserManagementComponent } from './features/users/user-management.component';
import { CustomersComponent } from './features/customers/customers.component';
import { CustomerDetailComponent } from './features/customers/customer-detail.component';
import { CustomerStatementPrintComponent } from './features/customers/customer-statement-print.component';
import { InvoiceListComponent } from './features/invoices/invoice-list.component';
import { InvoiceCreateComponent } from './features/invoices/invoice-create.component';
import { InvoicePrintComponent } from './features/invoices/invoice-print.component';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { superAdminGuard } from './core/guards/super-admin.guard';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
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
    path: 'customers',
    component: CustomersComponent,
    canActivate: [authGuard],
  },
  {
    path: 'customers/:id/statement',
    component: CustomerStatementPrintComponent,
    canActivate: [authGuard],
  },
  {
    path: 'customers/:id',
    component: CustomerDetailComponent,
    canActivate: [authGuard],
  },
  {
    path: 'invoices',
    component: InvoiceListComponent,
    canActivate: [authGuard],
  },
  {
    path: 'invoices/new',
    component: InvoiceCreateComponent,
    canActivate: [authGuard],
  },
  {
    path: 'invoices/:id/edit',
    component: InvoiceCreateComponent,
    canActivate: [authGuard],
  },
  {
    path: 'invoices/:id/print',
    component: InvoicePrintComponent,
    canActivate: [authGuard],
  },
  {
    path: 'users',
    component: UserManagementComponent,
    canActivate: [authGuard, superAdminGuard],
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
