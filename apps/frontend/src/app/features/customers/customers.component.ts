import {
  Component,
  OnInit,
  signal,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  FormsModule,
} from '@angular/forms';
import { CustomersService } from '../../core/services/customers.service';
import { AuthService } from '../../core/services/auth.service';
import { SnackbarService } from '../../core/services/snackbar.service';
import { CompanyService } from '../../core/services/company.service';
import {
  ICustomer,
  CreateCustomerDto,
  UserRole,
  getStateCodeFromName,
  getStateNameFromCode,
} from '@rice-mill-project/shared-types';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule],
  templateUrl: './customers.component.html',
  styleUrls: ['./customers.component.scss'],
})
export class CustomersComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly customersService = inject(CustomersService);
  private readonly authService = inject(AuthService);
  private readonly snackbarService = inject(SnackbarService);
  private readonly companyService = inject(CompanyService);
  private readonly router = inject(Router);

  readonly currentUser = this.authService.currentUser;
  readonly isSuperAdmin = this.authService.isSuperAdmin;
  readonly canManageCustomers = computed(() => {
    const role = this.currentUser()?.role;
    return role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;
  });

  // Signals
  readonly customers = signal<ICustomer[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);
  readonly searchTerm = signal<string>('');
  readonly selectedFilter = signal<'ALL' | 'BALANCE' | 'CLEAR'>('ALL');
  readonly alertMessage = signal<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Next Auto Customer Code
  readonly autoCustomerCode = signal<string>('CUST-001');

  // Customer Modal
  readonly showCreateModal = signal<boolean>(false);
  createCustomerForm!: FormGroup;

  // Computed Metrics
  readonly totalReceivables = computed(() =>
    this.customers().reduce((sum, c) => sum + (c.currentBalance > 0 ? c.currentBalance : 0), 0),
  );
  readonly totalBilledSum = computed(() =>
    this.customers().reduce((sum, c) => sum + (c.totalBilled || 0), 0),
  );
  readonly totalCustomersCount = computed(() => this.customers().length);
  readonly customersWithBalanceCount = computed(
    () => this.customers().filter((c) => c.currentBalance > 0).length,
  );

  // Filtered Customers
  readonly filteredCustomers = computed(() => {
    let list = this.customers();
    const filter = this.selectedFilter();
    if (filter === 'BALANCE') {
      list = list.filter((c) => c.currentBalance > 0);
    } else if (filter === 'CLEAR') {
      list = list.filter((c) => c.currentBalance <= 0);
    }

    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return list;

    return list.filter(
      (c) =>
        c.companyName.toLowerCase().includes(term) ||
        c.customerCode.toLowerCase().includes(term) ||
        c.mobile.includes(term) ||
        (c.gstin && c.gstin.toLowerCase().includes(term)) ||
        (c.billingAddress?.city &&
          c.billingAddress.city.toLowerCase().includes(term)),
    );
  });

  ngOnInit(): void {
    this.initForm();
    this.loadCustomers();
    if (!this.companyService.company()) {
      this.companyService.getCompanyDetails().subscribe();
    }
  }

  private initForm(): void {
    this.createCustomerForm = this.fb.group({
      companyName: ['', [Validators.required, Validators.minLength(2)]],
      contactPerson: [''],
      mobile: ['', [Validators.required, Validators.minLength(10)]],
      email: ['', [Validators.email]],
      gstin: [''],
      pan: [''],
      line1: ['', [Validators.required]],
      line2: [''],
      city: ['', [Validators.required]],
      state: ['', [Validators.required]],
      stateCode: ['', [Validators.required]],
      pincode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
      // openingBalance: [0, [Validators.min(0)]],
      // creditLimit: [0, [Validators.min(0)]],
      notes: [''],
    });

    // Auto-detect State and State Code from GSTIN
    this.createCustomerForm.get('gstin')?.valueChanges.subscribe((gstinVal) => {
      if (gstinVal && gstinVal.trim().length >= 2) {
        const code = gstinVal.trim().substring(0, 2);
        const stateName = getStateNameFromCode(code);
        if (stateName) {
          this.createCustomerForm.patchValue({ state: stateName, stateCode: code }, { emitEvent: false });
        } else {
          this.createCustomerForm.patchValue({ stateCode: code }, { emitEvent: false });
        }
      }
    });

    // Auto-sync State Code when State Name is entered
    this.createCustomerForm.get('state')?.valueChanges.subscribe((stateVal) => {
      if (stateVal) {
        const code = getStateCodeFromName(stateVal);
        if (code) {
          this.createCustomerForm.patchValue({ stateCode: code }, { emitEvent: false });
        }
      }
    });
  }

  loadCustomers(): void {
    this.isLoading.set(true);
    this.customersService.getNextCustomerCode().subscribe({
      next: (code) => this.autoCustomerCode.set(code),
      error: () => this.autoCustomerCode.set('CUST-001'),
    });

    this.customersService.getCustomers().subscribe({
      next: (data) => {
        this.customers.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.showAlert('error', err.error?.message || 'Failed to load customers.');
      },
    });
  }

  openCreateModal(): void {
    if (!this.canManageCustomers()) {
      this.showAlert('error', 'Access denied: You do not have permission to register new buyers.');
      return;
    }

    const company = this.companyService.company();
    const defaultState = company?.address?.state || '';
    const defaultCode =
      (company?.gstin && company.gstin.trim().length >= 2 ? company.gstin.trim().substring(0, 2) : '') ||
      getStateCodeFromName(defaultState) ||
      '';

    this.createCustomerForm.reset({
      state: defaultState,
      stateCode: defaultCode,
      // openingBalance: 0,
      // creditLimit: 0,
    });
    this.customersService.getNextCustomerCode().subscribe({
      next: (code) => this.autoCustomerCode.set(code),
    });
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
  }

  onCreateSubmit(): void {
    if (!this.canManageCustomers()) {
      this.showAlert('error', 'Access denied: You do not have permission to register new buyers.');
      return;
    }

    if (this.createCustomerForm.invalid) {
      this.createCustomerForm.markAllAsTouched();
      return;
    }

    const val = this.createCustomerForm.value;
    const dto: CreateCustomerDto = {
      customerCode: this.autoCustomerCode(),
      companyName: val.companyName,
      contactPerson: val.contactPerson,
      mobile: val.mobile,
      email: val.email || undefined,
      gstin: val.gstin || undefined,
      pan: val.pan || undefined,
      billingAddress: {
        line1: val.line1,
        line2: val.line2 || undefined,
        city: val.city,
        state: val.state,
        stateCode: val.stateCode,
        pincode: val.pincode,
      },
      // openingBalance: Number(val.openingBalance) || 0,
      // creditLimit: Number(val.creditLimit) || 0,
      notes: val.notes || undefined,
    };

    this.isSubmitting.set(true);
    this.customersService.createCustomer(dto).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.closeCreateModal();
        this.showAlert(
          'success',
          `Buyer "${res.companyName}" (${res.customerCode}) registered successfully!`,
        );
        this.loadCustomers();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const msg =
          err.status === 403
            ? (err.error?.message || 'Access denied: You do not have permission to register new buyers.')
            : (err.error?.message || 'Failed to register customer.');
        this.showAlert('error', msg);
      },
    });
  }

  viewCustomerDetails(customer: ICustomer): void {
    this.router.navigate(['/customers', customer.id]);
  }

  openCustomer360(customer: ICustomer): void {
    this.viewCustomerDetails(customer);
  }

  createInvoiceForCustomer(customer: ICustomer): void {
    if (!this.canManageCustomers()) {
      this.showAlert('error', 'Access denied: You do not have permission to create invoices.');
      return;
    }
    this.router.navigate(['/invoices/new'], {
      queryParams: { customerId: customer.id },
    });
  }

  logout(): void {
    this.authService.logout();
  }

  private showAlert(type: 'success' | 'error', text: string): void {
    this.alertMessage.set({ type, text });
    this.snackbarService.show(text, type);
    setTimeout(() => this.alertMessage.set(null), 5000);
  }
}
