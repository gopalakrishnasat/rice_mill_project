import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges,
  HostListener,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import {
  IInvoice,
  PaymentMode,
  RecordPaymentDto,
} from '@rice-mill-project/shared-types';
import { InvoicesService } from '../../../core/services/invoices.service';
import { SnackbarService } from '../../../core/services/snackbar.service';

@Component({
  selector: 'app-record-payment-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './record-payment-modal.component.html',
  styleUrls: ['./record-payment-modal.component.scss'],
})
export class RecordPaymentModalComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly invoicesService = inject(InvoicesService);
  private readonly snackbarService = inject(SnackbarService);

  @Input({ required: true }) invoice!: IInvoice;
  @Output() closed = new EventEmitter<void>();
  @Output() paymentRecorded = new EventEmitter<{
    invoice: IInvoice;
    amount: number;
    receipt?: any;
  }>();

  readonly isSubmitting = signal<boolean>(false);
  readonly pendingDueAmount = signal<number>(0);

  paymentForm!: FormGroup;

  readonly paymentModes = [
    { value: PaymentMode.UPI, label: 'UPI / QR Code' },
    { value: PaymentMode.NEFT_RTGS, label: 'Bank Transfer (NEFT/RTGS/IMPS)' },
    { value: PaymentMode.CASH, label: 'Cash' },
    { value: PaymentMode.CHEQUE, label: 'Cheque' },
  ];

  ngOnInit(): void {
    this.initForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['invoice'] && this.invoice) {
      this.initForm();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.isSubmitting()) {
      this.close();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (
      (event.target as HTMLElement).classList.contains('modal-backdrop') &&
      !this.isSubmitting()
    ) {
      this.close();
    }
  }

  close(): void {
    if (!this.isSubmitting()) {
      this.closed.emit();
    }
  }

  private initForm(): void {
    if (!this.invoice) return;

    const pendingDue =
      this.invoice.balanceAmount !== undefined &&
      this.invoice.balanceAmount !== null
        ? Number(this.invoice.balanceAmount)
        : Math.max(
            0,
            Number(
              (
                (this.invoice.totalAmount || 0) - (this.invoice.paidAmount || 0)
              ).toFixed(2),
            ),
          );

    this.pendingDueAmount.set(pendingDue);

    this.paymentForm = this.fb.group({
      amount: [
        pendingDue,
        [Validators.required, Validators.min(1), Validators.max(pendingDue)],
      ],
      paymentDate: [
        new Date().toISOString().split('T')[0],
        [Validators.required],
      ],
      paymentMode: [PaymentMode.UPI, [Validators.required]],
      transactionReference: [''],
      notes: [`Payment for ${this.invoice.invoiceNumber}`],
    });
  }

  onSubmit(): void {
    if (this.paymentForm.invalid || !this.invoice) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    const val = this.paymentForm.value;
    const dto: RecordPaymentDto = {
      amount: Number(val.amount),
      paymentDate: val.paymentDate,
      paymentMode: val.paymentMode,
      transactionReference: val.transactionReference?.trim() || undefined,
      notes: val.notes?.trim() || undefined,
    };

    const targetInvoice = this.invoice;
    this.isSubmitting.set(true);

    this.invoicesService.recordPayment(targetInvoice.id, dto).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        const formattedAmount = new Intl.NumberFormat('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(dto.amount);

        this.snackbarService.show(
          `Payment of ₹${formattedAmount} successfully recorded for invoice ${targetInvoice.invoiceNumber}!`,
          'success',
        );

        this.paymentRecorded.emit({
          invoice: res.invoice || targetInvoice,
          amount: dto.amount,
          receipt: res.receipt,
        });
        this.closed.emit();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.snackbarService.show(
          err.error?.message || 'Failed to record payment.',
          'error',
        );
      },
    });
  }
}
