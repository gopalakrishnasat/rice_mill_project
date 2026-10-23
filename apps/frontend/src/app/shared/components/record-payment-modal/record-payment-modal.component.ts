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
  computed,
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
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';

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
  private readonly confirmDialogService = inject(ConfirmDialogService);

  @Input({ required: true }) invoice!: IInvoice;
  @Output() closed = new EventEmitter<void>();
  @Output() paymentRecorded = new EventEmitter<{
    invoice: IInvoice;
    amount: number;
    receipt?: any;
  }>();

  readonly isSubmitting = signal<boolean>(false);
  readonly pendingDueAmount = signal<number>(0);
  readonly enteredAmount = signal<number>(0);
  readonly enteredDiscount = signal<number>(0);

  readonly effectiveSettlement = computed(() =>
    Number((this.enteredAmount() + this.enteredDiscount()).toFixed(2))
  );

  readonly resultingBalance = computed(() =>
    Math.max(
      0,
      Number((this.pendingDueAmount() - this.effectiveSettlement()).toFixed(2))
    )
  );

  readonly willBeFullyPaid = computed(
    () => this.resultingBalance() === 0 && this.effectiveSettlement() > 0
  );

  readonly isDiscountOverDue = computed(
    () => this.enteredDiscount() > this.pendingDueAmount()
  );

  readonly isOverSettled = computed(
    () =>
      this.isDiscountOverDue() ||
      this.effectiveSettlement() > this.pendingDueAmount()
  );

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
    if (!this.isSubmitting() && !this.confirmDialogService.state().isOpen) {
      this.close();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (
      (event.target as HTMLElement).classList.contains('modal-backdrop') &&
      !this.isSubmitting() &&
      !this.confirmDialogService.state().isOpen
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
              ).toFixed(2)
            )
          );

    this.pendingDueAmount.set(pendingDue);
    this.enteredAmount.set(0);
    this.enteredDiscount.set(0);

    this.paymentForm = this.fb.group({
      amount: [
        null,
        [Validators.required, Validators.min(0)],
      ],
      discount: [
        0,
        [Validators.min(0)],
      ],
      paymentDate: [
        new Date().toISOString().split('T')[0],
        [Validators.required],
      ],
      paymentMode: [PaymentMode.UPI, [Validators.required]],
      transactionReference: [''],
      notes: [`Payment for ${this.invoice.invoiceNumber}`],
    });

    this.paymentForm.get('amount')?.valueChanges.subscribe((v) => {
      this.enteredAmount.set(v === null || v === '' ? 0 : Number(v) || 0);
    });

    this.paymentForm.get('discount')?.valueChanges.subscribe((v) => {
      const disc = Math.max(0, Number(v) || 0);
      this.enteredDiscount.set(disc);
    });
  }

  async onSubmit(): Promise<void> {
    if (
      this.paymentForm.invalid ||
      !this.invoice ||
      this.isOverSettled() ||
      this.effectiveSettlement() <= 0
    ) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    const val = this.paymentForm.value;
    const dto: RecordPaymentDto = {
      amount: Number(val.amount) || 0,
      discount: Number(val.discount) || 0,
      paymentDate: val.paymentDate,
      paymentMode: val.paymentMode,
      transactionReference: val.transactionReference?.trim() || undefined,
      notes: val.notes?.trim() || undefined,
    };

    const formattedAmount = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(dto.amount);

    const modeLabel =
      this.paymentModes.find((m) => m.value === dto.paymentMode)?.label ||
      dto.paymentMode;

    let confirmationMsg = `Are you sure you want to record a payment of ${formattedAmount} via ${modeLabel} for invoice ${this.invoice.invoiceNumber}?`;
    if (dto.discount && dto.discount > 0) {
      const formattedDiscount = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
      }).format(dto.discount);
      confirmationMsg += ` (Includes a settlement discount of ${formattedDiscount})`;
    }
    confirmationMsg += ' This will permanently update the invoice balance and khata ledger.';

    const confirmed = await this.confirmDialogService.confirm({
      title: 'Confirm Payment Receipt',
      message: confirmationMsg,
      confirmText: 'Record Payment',
      cancelText: 'Cancel',
      type: 'success',
    });

    if (!confirmed) {
      return;
    }

    const targetInvoice = this.invoice;
    this.isSubmitting.set(true);

    this.invoicesService.recordPayment(targetInvoice.id, dto).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        const successFormattedAmount = new Intl.NumberFormat('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(dto.amount);

        let msg = `Payment of ₹${successFormattedAmount} recorded for invoice ${targetInvoice.invoiceNumber}!`;
        if (dto.discount && dto.discount > 0) {
          msg += ` (Discount given: ₹${dto.discount.toFixed(2)})`;
        }

        this.snackbarService.show(msg, 'success');

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
