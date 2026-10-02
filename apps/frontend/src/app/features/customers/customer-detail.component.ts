import {
  Component,
  OnInit,
  signal,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  FormsModule,
} from '@angular/forms';
import { CustomersService } from '../../core/services/customers.service';
import { InvoicesService } from '../../core/services/invoices.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { SnackbarService } from '../../core/services/snackbar.service';
import {
  ICustomer,
  ICustomerLedgerEntry,
  IInvoice,
  UpdateCustomerDto,
  RecordPaymentDto,
  PaymentMode,
  PaymentStatus,
  InvoiceStatus,
} from '@rice-mill-project/shared-types';

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule],
  templateUrl: './customer-detail.component.html',
  styleUrls: ['./customer-detail.component.scss'],
})
export class CustomerDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly customersService = inject(CustomersService);
  private readonly invoicesService = inject(InvoicesService);
  private readonly authService = inject(AuthService);
  private readonly confirmDialogService = inject(ConfirmDialogService);
  private readonly snackbarService = inject(SnackbarService);

  readonly currentUser = this.authService.currentUser;
  readonly isSuperAdmin = this.authService.isSuperAdmin;

  // State Signals
  readonly customerId = signal<string>('');
  readonly customer = signal<ICustomer | null>(null);
  readonly ledger = signal<ICustomerLedgerEntry[]>([]);
  readonly invoices = signal<IInvoice[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly isLedgerLoading = signal<boolean>(false);
  readonly isInvoicesLoading = signal<boolean>(false);
  readonly activeTab = signal<'LEDGER' | 'INVOICES' | 'PAYMENTS'>('LEDGER');

  // Alert Notification
  readonly alertMessage = signal<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Edit Modal State & Form
  readonly showEditModal = signal<boolean>(false);
  readonly isSubmittingEdit = signal<boolean>(false);
  editCustomerForm!: FormGroup;

  // Payment Recording Modal State & Form (Single Invoice)
  readonly showPaymentModal = signal<boolean>(false);
  readonly selectedInvoiceForPayment = signal<IInvoice | null>(null);
  readonly isSubmittingPayment = signal<boolean>(false);
  paymentForm!: FormGroup;

  // Lump-Sum Account Payment Modal State & Form (FIFO Auto-Knock-off)
  readonly showLumpSumPaymentModal = signal<boolean>(false);
  readonly showLumpSumConfirmModal = signal<boolean>(false);
  readonly isSubmittingLumpSum = signal<boolean>(false);
  readonly lumpSumEnteredAmount = signal<number>(0);
  lumpSumPaymentForm!: FormGroup;

  // Pending bills available for FIFO allocation
  readonly lumpSumPendingInvoices = computed(() => {
    return this.invoices()
      .filter(
        (i) =>
          i.paymentStatus !== PaymentStatus.PAID &&
          i.status !== InvoiceStatus.CANCELLED &&
          (i.balanceAmount || 0) > 0
      )
      .sort(
        (a, b) =>
          new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime()
      );
  });

  // Reactive Live FIFO Allocation Preview
  readonly lumpSumPreview = computed(() => {
    const totalPayment = this.lumpSumEnteredAmount() || 0;
    let remaining = totalPayment;
    const bills = this.lumpSumPendingInvoices();

    const items = bills.map((bill) => {
      const balance = Number((bill.balanceAmount || 0).toFixed(2));
      const allocated = remaining > 0 ? Number(Math.min(balance, remaining).toFixed(2)) : 0;
      const remainingBalance = Number(Math.max(0, balance - allocated).toFixed(2));
      let newStatus: 'PAID' | 'PARTIAL' | 'UNPAID' = bill.paymentStatus as any;

      if (allocated > 0) {
        newStatus = remainingBalance === 0 ? 'PAID' : 'PARTIAL';
      }

      if (remaining > 0) {
        remaining = Number(Math.max(0, remaining - allocated).toFixed(2));
      }

      return {
        id: bill.id,
        invoiceNumber: bill.invoiceNumber,
        invoiceDate: bill.invoiceDate,
        totalAmount: bill.totalAmount,
        previousBalance: balance,
        allocatedAmount: allocated,
        newBalance: remainingBalance,
        newStatus,
      };
    });

    const totalAllocated = Number((totalPayment - remaining).toFixed(2));
    const advanceCredit = Number(remaining.toFixed(2));

    return {
      items,
      totalPayment,
      totalAllocated,
      advanceCredit,
      fullyPaidCount: items.filter((x) => x.newStatus === 'PAID').length,
      partiallyPaidCount: items.filter((x) => x.newStatus === 'PARTIAL').length,
      affectedCount: items.filter((x) => x.allocatedAmount > 0).length,
    };
  });

  // Computed Financial Analytics - Strictly calculated for THIS specific customer
  readonly totalBilled = computed(() => {
    const invs = this.invoices();
    if (invs.length > 0) {
      return invs.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    }
    return this.customer()?.totalBilled ?? 0;
  });

  readonly totalPaid = computed(() => {
    const invs = this.invoices();
    if (invs.length > 0) {
      return invs.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
    }
    return this.customer()?.totalPaid ?? 0;
  });

  readonly currentBalance = computed(() => {
    const invs = this.invoices();
    if (invs.length > 0) {
      const pendingFromInvoices = invs.reduce(
        (sum, inv) => sum + (inv.balanceAmount || 0),
        0
      );
      return pendingFromInvoices + (this.customer()?.openingBalance || 0);
    }
    return this.customer()?.currentBalance ?? 0;
  });

  readonly paidInvoicesCount = computed(
    () => this.invoices().filter((i) => i.paymentStatus === 'PAID').length
  );

  readonly pendingInvoicesCount = computed(
    () => this.invoices().filter((i) => i.paymentStatus !== 'PAID').length
  );

  readonly ledgerTotalDebit = computed(() =>
    this.ledger().reduce((sum, item) => sum + (item.debit || 0), 0)
  );

  readonly ledgerTotalCredit = computed(() =>
    this.ledger().reduce((sum, item) => sum + (item.credit || 0), 0)
  );

  // Computed Payments History extracted from customer ledger
  readonly paymentRecords = computed(() => {
    return this.ledger()
      .filter((e) => e.type === 'PAYMENT')
      .map((e) => ({
        id: e.id,
        receiptNumber: e.referenceNo,
        amount: e.credit,
        paymentDate: e.date,
        description: e.description,
      }))
      .sort(
        (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
      );
  });

  // Initials for avatar monogram
  readonly companyInitials = computed(() => {
    const name = this.customer()?.companyName?.trim();
    if (!name) return 'BY';
    const words = name.split(/\s+/);
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  });

  // =========================================================================
  // 1. Khata Ledger Table Pagination
  // =========================================================================
  readonly ledgerPage = signal<number>(1);
  readonly ledgerPageSize = signal<number>(10);

  readonly ledgerTotalPages = computed(() => {
    const total = this.ledger().length;
    return Math.max(1, Math.ceil(total / this.ledgerPageSize()));
  });

  readonly ledgerPagesArray = computed(() =>
    this.computePagesArray(this.ledgerPage(), this.ledgerTotalPages())
  );

  readonly pagedLedger = computed(() => {
    const page = this.ledgerPage();
    const size = this.ledgerPageSize();
    const start = (page - 1) * size;
    return this.ledger().slice(start, start + size);
  });

  readonly ledgerPaginationInfo = computed(() => {
    const total = this.ledger().length;
    if (total === 0) return { start: 0, end: 0, total: 0 };
    const page = this.ledgerPage();
    const size = this.ledgerPageSize();
    const start = (page - 1) * size + 1;
    const end = Math.min(page * size, total);
    return { start, end, total };
  });

  setLedgerPage(page: number): void {
    if (page >= 1 && page <= this.ledgerTotalPages()) {
      this.ledgerPage.set(page);
    }
  }

  prevLedgerPage(): void {
    if (this.ledgerPage() > 1) {
      this.ledgerPage.update((p) => p - 1);
    }
  }

  nextLedgerPage(): void {
    if (this.ledgerPage() < this.ledgerTotalPages()) {
      this.ledgerPage.update((p) => p + 1);
    }
  }

  setLedgerPageSize(size: number): void {
    this.ledgerPageSize.set(size);
    this.ledgerPage.set(1);
  }

  // =========================================================================
  // 2. Sales Invoices Table Pagination
  // =========================================================================
  readonly invoicesPage = signal<number>(1);
  readonly invoicesPageSize = signal<number>(10);

  readonly invoicesTotalPages = computed(() => {
    const total = this.invoices().length;
    return Math.max(1, Math.ceil(total / this.invoicesPageSize()));
  });

  readonly invoicesPagesArray = computed(() =>
    this.computePagesArray(this.invoicesPage(), this.invoicesTotalPages())
  );

  readonly pagedInvoices = computed(() => {
    const page = this.invoicesPage();
    const size = this.invoicesPageSize();
    const start = (page - 1) * size;
    return this.invoices().slice(start, start + size);
  });

  readonly invoicesPaginationInfo = computed(() => {
    const total = this.invoices().length;
    if (total === 0) return { start: 0, end: 0, total: 0 };
    const page = this.invoicesPage();
    const size = this.invoicesPageSize();
    const start = (page - 1) * size + 1;
    const end = Math.min(page * size, total);
    return { start, end, total };
  });

  setInvoicesPage(page: number): void {
    if (page >= 1 && page <= this.invoicesTotalPages()) {
      this.invoicesPage.set(page);
    }
  }

  prevInvoicesPage(): void {
    if (this.invoicesPage() > 1) {
      this.invoicesPage.update((p) => p - 1);
    }
  }

  nextInvoicesPage(): void {
    if (this.invoicesPage() < this.invoicesTotalPages()) {
      this.invoicesPage.update((p) => p + 1);
    }
  }

  setInvoicesPageSize(size: number): void {
    this.invoicesPageSize.set(size);
    this.invoicesPage.set(1);
  }

  // =========================================================================
  // 3. Payment Receipts Table Pagination
  // =========================================================================
  readonly paymentsPage = signal<number>(1);
  readonly paymentsPageSize = signal<number>(10);

  readonly paymentsTotalPages = computed(() => {
    const total = this.paymentRecords().length;
    return Math.max(1, Math.ceil(total / this.paymentsPageSize()));
  });

  readonly paymentsPagesArray = computed(() =>
    this.computePagesArray(this.paymentsPage(), this.paymentsTotalPages())
  );

  readonly pagedPayments = computed(() => {
    const page = this.paymentsPage();
    const size = this.paymentsPageSize();
    const start = (page - 1) * size;
    return this.paymentRecords().slice(start, start + size);
  });

  readonly paymentsPaginationInfo = computed(() => {
    const total = this.paymentRecords().length;
    if (total === 0) return { start: 0, end: 0, total: 0 };
    const page = this.paymentsPage();
    const size = this.paymentsPageSize();
    const start = (page - 1) * size + 1;
    const end = Math.min(page * size, total);
    return { start, end, total };
  });

  setPaymentsPage(page: number): void {
    if (page >= 1 && page <= this.paymentsTotalPages()) {
      this.paymentsPage.set(page);
    }
  }

  prevPaymentsPage(): void {
    if (this.paymentsPage() > 1) {
      this.paymentsPage.update((p) => p - 1);
    }
  }

  nextPaymentsPage(): void {
    if (this.paymentsPage() < this.paymentsTotalPages()) {
      this.paymentsPage.update((p) => p + 1);
    }
  }

  setPaymentsPageSize(size: number): void {
    this.paymentsPageSize.set(size);
    this.paymentsPage.set(1);
  }

  // Helper for responsive pagination numbers
  private computePagesArray(current: number, total: number): number[] {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages = new Set<number>();
    pages.add(1);
    pages.add(total);
    for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) {
      pages.add(i);
    }
    return Array.from(pages).sort((a, b) => a - b);
  }

  ngOnInit(): void {
    this.initEditForm();
    this.initPaymentForm();
    this.initLumpSumPaymentForm();

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.customerId.set(id);
        this.loadCustomerAllData(id);
      } else {
        this.router.navigate(['/customers']);
      }
    });
  }

  private initEditForm(): void {
    this.editCustomerForm = this.fb.group({
      companyName: ['', [Validators.required, Validators.minLength(2)]],
      contactPerson: [''],
      mobile: ['', [Validators.required, Validators.minLength(10)]],
      email: ['', [Validators.email]],
      gstin: [''],
      pan: [''],
      line1: ['', [Validators.required]],
      line2: [''],
      city: ['', [Validators.required]],
      state: ['Maharashtra', [Validators.required]],
      stateCode: ['27', [Validators.required]],
      pincode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
      notes: [''],
    });
  }

  private initPaymentForm(): void {
    this.paymentForm = this.fb.group({
      amount: [0, [Validators.required, Validators.min(1)]],
      paymentDate: [new Date().toISOString().split('T')[0], [Validators.required]],
      paymentMode: [PaymentMode.NEFT_RTGS, [Validators.required]],
      transactionReference: [''],
      notes: [''],
    });
  }

  private initLumpSumPaymentForm(): void {
    this.lumpSumPaymentForm = this.fb.group({
      amount: [null, [Validators.required, Validators.min(1)]],
      paymentDate: ['', [Validators.required]],
      paymentMode: [null, [Validators.required]],
      transactionReference: [''],
      notes: [''],
    });

    this.lumpSumPaymentForm.get('amount')?.valueChanges.subscribe((val) => {
      this.lumpSumEnteredAmount.set(Number(val) || 0);
    });
  }

  loadCustomerAllData(id: string): void {
    this.isLoading.set(true);

    // 1. Load customer details
    this.customersService.getCustomerById(id).subscribe({
      next: (cust) => {
        this.customer.set(cust);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.showAlert('error', err.error?.message || 'Failed to load buyer details.');
      },
    });

    // 2. Load Khata ledger statements
    this.isLedgerLoading.set(true);
    this.customersService.getCustomerLedger(id).subscribe({
      next: (entries) => {
        this.ledger.set(entries);
        this.isLedgerLoading.set(false);
      },
      error: () => {
        this.isLedgerLoading.set(false);
      },
    });

    // 3. Load customer sales invoices
    this.isInvoicesLoading.set(true);
    this.invoicesService.getInvoices({ customerId: id }).subscribe({
      next: (invList) => {
        this.invoices.set(invList);
        this.isInvoicesLoading.set(false);
      },
      error: () => {
        this.isInvoicesLoading.set(false);
      },
    });
  }

  // Edit Modal Handling
  openEditModal(): void {
    const cust = this.customer();
    if (!cust) return;

    this.editCustomerForm.patchValue({
      companyName: cust.companyName,
      contactPerson: cust.contactPerson || '',
      mobile: cust.mobile,
      email: cust.email || '',
      gstin: cust.gstin || '',
      pan: cust.pan || '',
      line1: cust.billingAddress.line1,
      line2: cust.billingAddress.line2 || '',
      city: cust.billingAddress.city,
      state: cust.billingAddress.state,
      stateCode: cust.billingAddress.stateCode,
      pincode: cust.billingAddress.pincode,
      notes: cust.notes || '',
    });

    this.showEditModal.set(true);
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
  }

  onEditSubmit(): void {
    if (this.editCustomerForm.invalid) {
      this.editCustomerForm.markAllAsTouched();
      return;
    }

    const val = this.editCustomerForm.value;
    const dto: UpdateCustomerDto = {
      companyName: val.companyName,
      contactPerson: val.contactPerson || undefined,
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
      notes: val.notes || undefined,
    };

    this.isSubmittingEdit.set(true);
    this.customersService.updateCustomer(this.customerId(), dto).subscribe({
      next: (updated) => {
        this.isSubmittingEdit.set(false);
        this.customer.set(updated);
        this.closeEditModal();
        this.showAlert('success', `Buyer "${updated.companyName}" profile updated successfully!`);
      },
      error: (err) => {
        this.isSubmittingEdit.set(false);
        this.showAlert('error', err.error?.message || 'Failed to update customer details.');
      },
    });
  }

  // Toggle Active / Inactive Status
  async toggleStatus(): Promise<void> {
    const cust = this.customer();
    if (!cust) return;

    const newStatus = !cust.isActive;
    const confirmed = await this.confirmDialogService.confirm({
      title: newStatus ? 'Re-activate Buyer?' : 'Deactivate Buyer?',
      message: newStatus
        ? `Are you sure you want to re-activate "${cust.companyName}"? They will appear in the buyer directory and in quick sales billing.`
        : `Are you sure you want to deactivate "${cust.companyName}"? They will be hidden from quick billing autocomplete searches.`,
      confirmText: newStatus ? 'Yes, Activate' : 'Yes, Deactivate',
      cancelText: 'Keep Current Status',
      type: newStatus ? 'primary' : 'danger',
    });

    if (!confirmed) return;

    this.customersService.toggleCustomerStatus(cust.id, newStatus).subscribe({
      next: (updated) => {
        this.customer.set(updated);
        this.showAlert(
          'success',
          `Buyer "${updated.companyName}" is now ${updated.isActive ? 'Active' : 'Inactive'}.`
        );
      },
      error: (err) => {
        this.showAlert('error', err.error?.message || 'Failed to change status.');
      },
    });
  }

  // Create Bill / Invoice for this customer
  createNewBill(): void {
    const cust = this.customer();
    if (!cust) return;
    this.router.navigate(['/invoices/new'], {
      queryParams: { customerId: cust.id },
    });
  }

  // Navigate to edit invoice
  editInvoice(invoice: IInvoice): void {
    this.router.navigate(['/invoices', invoice.id, 'edit']);
  }

  // Download PDF directly
  downloadInvoicePdf(invoice: IInvoice): void {
    this.invoicesService.downloadInvoiceDirectly(invoice.id, invoice.invoiceNumber);
  }

  // Print Invoice
  printInvoice(invoice: IInvoice): void {
    const printUrl = `/invoices/${invoice.id}/print`;
    window.open(printUrl, '_blank', 'width=1000,height=800');
  }

  // Open Dedicated Customer Statement Page
  printLedger(): void {
    const custId = this.customer()?.id;
    if (!custId) return;
    window.open(`/customers/${custId}/statement`, '_blank');
  }

  // Record Payment Modal (Single Invoice)
  openPaymentModal(invoice: IInvoice): void {
    this.selectedInvoiceForPayment.set(invoice);
    const pendingDue = (invoice.balanceAmount !== undefined && invoice.balanceAmount !== null)
      ? Number(invoice.balanceAmount)
      : Math.max(0, Number(((invoice.totalAmount || 0) - (invoice.paidAmount || 0)).toFixed(2)));

    this.paymentForm.reset({
      amount: pendingDue,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMode: PaymentMode.NEFT_RTGS,
      transactionReference: '',
      notes: `Payment for ${invoice.invoiceNumber}`,
    });
    this.paymentForm
      .get('amount')
      ?.setValidators([
        Validators.required,
        Validators.min(1),
        Validators.max(pendingDue),
      ]);
    this.paymentForm.get('amount')?.updateValueAndValidity();
    this.showPaymentModal.set(true);
  }

  closePaymentModal(): void {
    this.showPaymentModal.set(false);
    this.selectedInvoiceForPayment.set(null);
  }

  onPaymentSubmit(): void {
    const inv = this.selectedInvoiceForPayment();
    if (!inv || this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    const formVal = this.paymentForm.value;
    const dto: RecordPaymentDto = {
      amount: Number(formVal.amount),
      paymentDate: formVal.paymentDate,
      paymentMode: formVal.paymentMode,
      transactionReference: formVal.transactionReference || undefined,
      notes: formVal.notes || undefined,
    };

    this.isSubmittingPayment.set(true);
    this.invoicesService.recordPayment(inv.id, dto).subscribe({
      next: () => {
        this.isSubmittingPayment.set(false);
        this.closePaymentModal();
        this.showAlert(
          'success',
          `Payment of ₹${dto.amount.toFixed(2)} recorded for ${inv.invoiceNumber}!`
        );
        // Refresh all buyer data (customer balance, ledger, invoices)
        this.loadCustomerAllData(this.customerId());
      },
      error: (err) => {
        this.isSubmittingPayment.set(false);
        this.showAlert('error', err.error?.message || 'Failed to record payment.');
      },
    });
  }

  // Lump-Sum Account Payment Handlers (FIFO Auto-Knock-off)
  openLumpSumPaymentModal(): void {
    this.lumpSumPaymentForm.reset({
      amount: null,
      paymentDate: '',
      paymentMode: null,
      transactionReference: '',
      notes: '',
    });
    this.lumpSumEnteredAmount.set(0);
    this.showLumpSumConfirmModal.set(false);
    this.showLumpSumPaymentModal.set(true);
  }

  closeLumpSumPaymentModal(): void {
    this.showLumpSumConfirmModal.set(false);
    this.showLumpSumPaymentModal.set(false);
  }

  cancelLumpSumConfirmation(): void {
    this.showLumpSumConfirmModal.set(false);
  }

  setQuickLumpSumAmount(val: number): void {
    this.lumpSumPaymentForm.patchValue({ amount: val });
    this.lumpSumEnteredAmount.set(val);
  }

  // Triggers confirmation popup before final execution
  onLumpSumSubmit(): void {
    if (this.lumpSumPaymentForm.invalid || this.lumpSumEnteredAmount() <= 0) {
      this.lumpSumPaymentForm.markAllAsTouched();
      return;
    }

    this.showLumpSumConfirmModal.set(true);
  }

  // Executes confirmed FIFO allocation
  proceedLumpSumSubmit(): void {
    if (this.lumpSumPaymentForm.invalid || this.lumpSumEnteredAmount() <= 0) {
      this.lumpSumPaymentForm.markAllAsTouched();
      this.showLumpSumConfirmModal.set(false);
      return;
    }

    const formVal = this.lumpSumPaymentForm.value;
    const dto: RecordPaymentDto = {
      amount: Number(formVal.amount),
      paymentDate: formVal.paymentDate,
      paymentMode: formVal.paymentMode,
      transactionReference: formVal.transactionReference || undefined,
      notes: formVal.notes || undefined,
    };

    this.isSubmittingLumpSum.set(true);
    this.invoicesService
      .allocateCustomerPayment(this.customerId(), dto)
      .subscribe({
        next: (res) => {
          this.isSubmittingLumpSum.set(false);
          this.showLumpSumConfirmModal.set(false);
          this.closeLumpSumPaymentModal();
          const count = res.allocations?.length || 0;
          let msg = `Payment of ₹${dto.amount.toFixed(2)} recorded (${res.receipt?.receiptNumber})! `;
          if (count > 0) {
            msg += `Auto-allocated across ${count} bill(s).`;
          }
          if (res.unallocatedAdvance > 0) {
            msg += ` Remaining ₹${res.unallocatedAdvance.toFixed(2)} kept as account advance credit.`;
          }
          this.showAlert('success', msg);
          this.loadCustomerAllData(this.customerId());
        },
        error: (err) => {
          this.isSubmittingLumpSum.set(false);
          this.showLumpSumConfirmModal.set(false);
          this.showAlert(
            'error',
            err.error?.message || 'Failed to allocate payment.'
          );
        },
      });
  }

  getPaymentModeLabel(mode: string | undefined): string {
    switch (mode) {
      case PaymentMode.NEFT_RTGS:
        return 'Bank Transfer (NEFT/RTGS)';
      case PaymentMode.UPI:
        return 'UPI / QR Code';
      case PaymentMode.CHEQUE:
        return 'Cheque';
      case PaymentMode.CASH:
        return 'Cash';
      default:
        return mode || '—';
    }
  }

  // Copy text to clipboard helper
  copyToClipboard(text: string, label: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.showAlert('success', `${label} copied to clipboard!`);
    }).catch(() => {
      this.showAlert('error', 'Failed to copy to clipboard.');
    });
  }

  private showAlert(type: 'success' | 'error', text: string): void {
    this.alertMessage.set({ type, text });
    this.snackbarService.show(text, type);
    setTimeout(() => this.alertMessage.set(null), 5000);
  }
}
