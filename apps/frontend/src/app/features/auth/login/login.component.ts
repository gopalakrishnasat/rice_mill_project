import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  loginForm: FormGroup = this.fb.group({
    email: ['superadmin@ricemill.com', [Validators.required, Validators.email]],
    password: ['SuperAdmin@123', [Validators.required, Validators.minLength(6)]],
    rememberMe: [true],
  });

  forgotPasswordForm: FormGroup = this.fb.group({
    resetEmail: ['', [Validators.required, Validators.email]],
  });

  showPassword = signal(false);
  isLoading = signal(false);
  isForgotLoading = signal(false);
  showForgotDialog = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  get emailControl() {
    return this.loginForm.get('email');
  }

  get passwordControl() {
    return this.loginForm.get('password');
  }

  get resetEmailControl() {
    return this.forgotPasswordForm.get('resetEmail');
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((val) => !val);
  }

  setDemoUser(role: 'super_admin' | 'admin' | 'view_only_admin'): void {
    const credentials = {
      super_admin: { email: 'superadmin@ricemill.com', password: 'SuperAdmin@123' },
      admin: { email: 'admin@ricemill.com', password: 'Admin@123' },
      view_only_admin: { email: 'viewer@ricemill.com', password: 'Viewer@123' },
    };

    const user = credentials[role];
    this.loginForm.patchValue({
      email: user.email,
      password: user.password,
    });
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  openForgotPassword(): void {
    this.showForgotDialog.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    const currentEmail = this.loginForm.get('email')?.value;
    if (currentEmail) {
      this.forgotPasswordForm.patchValue({ resetEmail: currentEmail });
    }
  }

  closeForgotPassword(): void {
    this.showForgotDialog.set(false);
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  onForgotSubmit(): void {
    if (this.forgotPasswordForm.invalid) {
      this.forgotPasswordForm.markAllAsTouched();
      return;
    }

    this.isForgotLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const email = this.forgotPasswordForm.get('resetEmail')?.value;

    this.authService.forgotPassword(email).subscribe({
      next: (res) => {
        this.isForgotLoading.set(false);
        this.successMessage.set(
          res.message ||
            'Password reset request submitted. Please check with your administrator.',
        );
      },
      error: () => {
        this.isForgotLoading.set(false);
        this.successMessage.set(
          'If your account is registered in our system, password reset instructions have been forwarded to the mill system administrator.',
        );
      },
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const { email, password, rememberMe } = this.loginForm.value;

    this.authService.login({ email, password, rememberMe }).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        if (response.success) {
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        if (err.status === 0) {
          this.errorMessage.set(
            'Unable to connect to the server. Please check your connection and try again.',
          );
        } else if (err.status === 401) {
          this.errorMessage.set('Invalid email or password.');
        } else if (err.status === 403) {
          this.errorMessage.set(
            err.error?.message ||
              'Your account is currently disabled. Please contact your mill administrator.',
          );
        } else if (err.error?.message) {
          this.errorMessage.set(err.error.message);
        } else {
          this.errorMessage.set(
            'An unexpected error occurred. Please try again later.',
          );
        }
      },
    });
  }
}
