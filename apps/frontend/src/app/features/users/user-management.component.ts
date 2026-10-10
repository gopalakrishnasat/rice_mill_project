import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { UsersService } from '../../core/services/users.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { SnackbarService } from '../../core/services/snackbar.service';
import { IUser, UserRole } from '../../core/models/auth.models';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.scss'],
})
export class UserManagementComponent implements OnInit {
  private readonly usersService = inject(UsersService);
  readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly confirmDialogService = inject(ConfirmDialogService);
  private readonly snackbarService = inject(SnackbarService);

  readonly currentUser = this.authService.currentUser;
  readonly isSuperAdmin = computed(
    () => this.currentUser()?.role === UserRole.SUPER_ADMIN,
  );

  // User list state
  users = signal<IUser[]>([]);
  isLoading = signal(true);
  searchTerm = signal('');
  selectedRoleFilter = signal<string>('ALL');
  selectedStatusFilter = signal<string>('ALL');
  alertMessage = signal<{ text: string; type: 'success' | 'error' } | null>(null);

  // Available roles for creation
  readonly systemRoles = Object.values(UserRole);

  formatRole(role: UserRole | string): string {
    switch (role) {
      case UserRole.SUPER_ADMIN:
        return 'Super Admin';
      case UserRole.ADMIN:
        return 'Admin';
      case UserRole.VIEW_ONLY_ADMIN:
        return 'View-Only Admin';
      default:
        return role;
    }
  }

  // Create User Modal State
  showCreateModal = signal(false);
  isSubmitting = signal(false);
  autoEmpId = signal('EMP-001');

  createUserForm: FormGroup = this.fb.group({
    employeeId: [{ value: '', disabled: true }],
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    mobile: ['', [Validators.pattern('^[+]?[0-9\\s-]{8,15}$')]],
    role: [UserRole.VIEW_ONLY_ADMIN, [Validators.required]],
    password: ['Mill@2026', [Validators.required, Validators.minLength(6)]],
    mustChangePassword: [true],
  });

  // Change Role Modal State
  showRoleModal = signal(false);
  selectedUserForRole = signal<IUser | null>(null);
  newRoleSelection = signal<UserRole>(UserRole.VIEW_ONLY_ADMIN);

  // Reset Password Modal State
  showPasswordModal = signal(false);
  selectedUserForPassword = signal<IUser | null>(null);
  newPasswordInput = signal('Mill@2026');

  // Filtered Users computed signal
  readonly filteredUsers = computed(() => {
    const search = this.searchTerm().toLowerCase().trim();
    const roleFilter = this.selectedRoleFilter();
    const statusFilter = this.selectedStatusFilter();

    return this.users().filter((user) => {
      // Role Filter
      if (roleFilter !== 'ALL' && user.role !== roleFilter) {
        return false;
      }

      // Status Filter
      if (statusFilter === 'ACTIVE' && !user.isActive) return false;
      if (statusFilter === 'INACTIVE' && user.isActive) return false;

      // Search Filter
      if (search) {
        const matchesName = user.name.toLowerCase().includes(search);
        const matchesEmail = user.email.toLowerCase().includes(search);
        const matchesEmpId =
          user.employeeId?.toLowerCase().includes(search) ?? false;
        const matchesMobile = user.mobile?.includes(search) ?? false;
        return matchesName || matchesEmail || matchesEmpId || matchesMobile;
      }

      return true;
    });
  });

  readonly totalActive = computed(
    () => this.users().filter((u) => u.isActive).length,
  );
  readonly totalInactive = computed(
    () => this.users().filter((u) => !u.isActive).length,
  );

  ngOnInit(): void {
    // Strictly restrict to SUPER_ADMIN exclusively
    if (!this.isSuperAdmin()) {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading.set(true);
    this.usersService.getUsers().subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.success && res.data) {
          this.users.set(res.data);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.showAlert(
          err.error?.message || 'Failed to load user directory.',
          'error',
        );
      },
    });

    // Always fetch latest next sequential Employee ID for metrics card
    this.usersService.getNextEmployeeId().subscribe({
      next: (res) => {
        if (res.data?.nextEmployeeId) {
          this.autoEmpId.set(res.data.nextEmployeeId);
        }
      },
    });
  }

  openCreateModal(): void {
    this.createUserForm.reset({
      role: UserRole.VIEW_ONLY_ADMIN,
      password: 'Mill@2026',
      mustChangePassword: true,
    });

    // Fetch next sequential Employee ID from backend
    this.usersService.getNextEmployeeId().subscribe({
      next: (res) => {
        const nextId = res.data?.nextEmployeeId || 'EMP-001';
        this.autoEmpId.set(nextId);
        this.createUserForm.patchValue({ employeeId: nextId });
        this.showCreateModal.set(true);
      },
      error: () => {
        this.autoEmpId.set('EMP-001');
        this.createUserForm.patchValue({ employeeId: 'EMP-001' });
        this.showCreateModal.set(true);
      },
    });
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
  }

  onCreateSubmit(): void {
    if (this.createUserForm.invalid) {
      this.createUserForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const formValue = this.createUserForm.getRawValue();

    this.usersService.createUser(formValue).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.closeCreateModal();
        this.showAlert(
          `Employee ${res.data?.name} (${res.data?.employeeId}) created successfully!`,
          'success',
        );
        this.loadUsers();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.showAlert(
          err.error?.message || 'Failed to create employee account.',
          'error',
        );
      },
    });
  }

  async toggleUserStatus(user: IUser): Promise<void> {
    const newStatus = !user.isActive;
    const actionName = newStatus ? 'activate' : 'deactivate';

    const confirmed = await this.confirmDialogService.confirm({
      title: newStatus ? 'Activate Employee Account?' : 'Deactivate Employee Account?',
      message: `Are you sure you want to ${actionName} employee account for "${user.name}" (${user.employeeId || user.email})?`,
      confirmText: newStatus ? 'Yes, Activate' : 'Yes, Deactivate',
      cancelText: 'Cancel',
      type: newStatus ? 'primary' : 'danger',
    });

    if (!confirmed) {
      return;
    }

    this.usersService
      .updateUserStatus(
        user.id,
        newStatus,
        `Status changed by Super Admin (${this.currentUser()?.name})`,
      )
      .subscribe({
        next: () => {
          this.showAlert(
            `User ${user.name} has been ${actionName}d successfully.`,
            'success',
          );
          this.loadUsers();
        },
        error: (err) => {
          this.showAlert(
            err.error?.message || `Failed to ${actionName} user.`,
            'error',
          );
        },
      });
  }

  openRoleModal(user: IUser): void {
    this.selectedUserForRole.set(user);
    this.newRoleSelection.set(user.role);
    this.showRoleModal.set(true);
  }

  closeRoleModal(): void {
    this.showRoleModal.set(false);
    this.selectedUserForRole.set(null);
  }

  onUpdateRoleSubmit(): void {
    const user = this.selectedUserForRole();
    if (!user) return;

    const newRole = this.newRoleSelection();
    this.isSubmitting.set(true);

    this.usersService.updateUserRole(user.id, newRole).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.closeRoleModal();
        this.showAlert(
          `Role for ${user.name} updated to ${newRole} successfully.`,
          'success',
        );
        this.loadUsers();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.showAlert(
          err.error?.message || 'Failed to update user role.',
          'error',
        );
      },
    });
  }

  openPasswordModal(user: IUser): void {
    this.selectedUserForPassword.set(user);
    this.newPasswordInput.set('Mill@2026');
    this.showPasswordModal.set(true);
  }

  closePasswordModal(): void {
    this.showPasswordModal.set(false);
    this.selectedUserForPassword.set(null);
  }

  onResetPasswordSubmit(): void {
    const user = this.selectedUserForPassword();
    const newPass = this.newPasswordInput();
    if (!user || !newPass || newPass.length < 6) {
      this.confirmDialogService.alert({
        title: 'Invalid Password',
        message: 'Password must be at least 6 characters long.',
        buttonText: 'Got It',
        type: 'warning',
      });
      return;
    }

    this.isSubmitting.set(true);
    this.usersService.resetPassword(user.id, newPass).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.closePasswordModal();
        this.showAlert(
          `Password reset for ${user.name}. User must change password on next login.`,
          'success',
        );
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.showAlert(
          err.error?.message || 'Failed to reset user password.',
          'error',
        );
      },
    });
  }

  showAlert(text: string, type: 'success' | 'error'): void {
    this.alertMessage.set({ text, type });
    this.snackbarService.show(text, type);
    setTimeout(() => {
      this.alertMessage.set(null);
    }, 6000);
  }

  logout(): void {
    this.authService.logout();
  }
}
