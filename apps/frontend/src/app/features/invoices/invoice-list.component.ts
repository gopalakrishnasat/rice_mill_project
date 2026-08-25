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
import { InvoicesService } from '../../core/services/invoices.service';
import { AuthService } from '../../core/services/auth.service';
import {
  IInvoice,
  InvoiceStatus,
  PaymentStatus,
  PaymentMode,
  RecordPaymentDto,
} from '@rice-mill-project/shared-types';
@Component({
  selector: 'app-invoice-list',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule],
  templateUrl: './invoice-list.component.html',
  styleUrls: ['./invoice-list.component.scss'],
})
export class InvoiceListComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly invoicesService = inject(InvoicesService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly currentUser = this.authService.currentUser;
  readonly isSuperAdmin = this.authService.isSuperAdmin;

  readonly invoices = signal<IInvoice[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);
  readonly searchTerm = signal<string>('');
  readonly selectedPaymentFilter = signal<'ALL' | 'UNPAID' | 'PARTIAL' | 'PAID'>('ALL');
  readonly alertMessage = signal<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Payment Recording Modal
  readonly selectedInvoiceForPayment = signal<IInvoice | null>(null);
  paymentForm!: FormGroup;

  // Computed Metrics
  readonly totalBilled = computed(() =>
    this.invoices().reduce((sum, inv) => sum + (inv.totalAmount || 0), 0),
  );
  readonly totalPaid = computed(() =>
    this.invoices().reduce((sum, inv) => sum + (inv.paidAmount || 0), 0),
  );
  readonly totalPendingReceivables = computed(() =>
    this.invoices().reduce((sum, inv) => sum + (inv.balanceAmount || 0), 0),
  );
  readonly totalInvoicesCount = computed(() => this.invoices().length);

  // Filtered Invoices
  readonly filteredInvoices = computed(() => {
    let list = this.invoices();
    const payFilter = this.selectedPaymentFilter();
    if (payFilter !== 'ALL') {
      list = list.filter((i) => i.paymentStatus === payFilter);
    }

    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return list;

    return list.filter(
      (i) =>
        i.invoiceNumber.toLowerCase().includes(term) ||
        (i.vehicleNumber && i.vehicleNumber.toLowerCase().includes(term)) ||
        (i.customerSnapshot?.companyName &&
          i.customerSnapshot.companyName.toLowerCase().includes(term)) ||
        (i.customerSnapshot?.customerCode &&
          i.customerSnapshot.customerCode.toLowerCase().includes(term)),
    );
  });

  ngOnInit(): void {
    this.initPaymentForm();
    this.loadInvoices();
  }

  private initPaymentForm(): void {
    this.paymentForm = this.fb.group({
      amount: [0, [Validators.required, Validators.min(1)]],
      paymentDate: [new Date().toISOString().split('T')[0], [Validators.required]],
      paymentMode: [PaymentMode.UPI, [Validators.required]],
      transactionReference: [''],
      notes: [''],
    });
  }

  loadInvoices(): void {
    this.isLoading.set(true);
    this.invoicesService.getInvoices().subscribe({
      next: (data) => {
        this.invoices.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.showAlert('error', err.error?.message || 'Failed to load invoices.');
      },
    });
  }

  openPaymentModal(invoice: IInvoice): void {
    this.selectedInvoiceForPayment.set(invoice);
    this.paymentForm.reset({
      amount: invoice.balanceAmount,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMode: PaymentMode.UPI,
      transactionReference: '',
      notes: '',
    });
    this.paymentForm
      .get('amount')
      ?.setValidators([
        Validators.required,
        Validators.min(1),
        Validators.max(invoice.balanceAmount),
      ]);
    this.paymentForm.get('amount')?.updateValueAndValidity();
  }

  closePaymentModal(): void {
    this.selectedInvoiceForPayment.set(null);
  }

  onPaymentSubmit(): void {
    if (this.paymentForm.invalid || !this.selectedInvoiceForPayment()) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    const val = this.paymentForm.value;
    const dto: RecordPaymentDto = {
      amount: Number(val.amount),
      paymentDate: val.paymentDate,
      paymentMode: val.paymentMode,
      transactionReference: val.transactionReference || undefined,
      notes: val.notes || undefined,
    };

    const inv = this.selectedInvoiceForPayment()!;
    this.isSubmitting.set(true);
    this.invoicesService.recordPayment(inv.id, dto).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.closePaymentModal();
        this.showAlert(
          'success',
          `Payment of ₹${dto.amount} successfully recorded against invoice ${inv.invoiceNumber}!`,
        );
        this.loadInvoices();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.showAlert('error', err.error?.message || 'Failed to record payment.');
      },
    });
  }

  downloadInvoiceDirectly(invoice: IInvoice): void {
    const filename = `Invoice_${invoice.invoiceNumber}.pdf`;
    this.invoicesService.downloadPdfStream(invoice.id).subscribe({
      next: (blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          if (document.body.contains(a)) {
            document.body.removeChild(a);
          }
          URL.revokeObjectURL(blobUrl);
        }, 1000);
      },
      error: () => {
        this.router.navigate(['/invoices', invoice.id, 'print']);
      },
    });
  }

  printInvoice(invoice: IInvoice): void {
    this.router.navigate(['/invoices', invoice.id, 'print']);
  }

  editInvoice(invoice: IInvoice): void {
    this.router.navigate(['/invoices', invoice.id, 'edit']);
  }

  logout(): void {
    this.authService.logout();
  }

  private showAlert(type: 'success' | 'error', text: string): void {
    this.alertMessage.set({ type, text });
    setTimeout(() => this.alertMessage.set(null), 5000);
  }
}
