import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  signal,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  FormsModule,
} from '@angular/forms';
import { Subject, of } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  catchError,
  takeUntil,
} from 'rxjs/operators';
import { InvoicesService } from '../../core/services/invoices.service';
import { CustomersService } from '../../core/services/customers.service';
import { AuthService } from '../../core/services/auth.service';
import { SnackbarService } from '../../core/services/snackbar.service';
import {
  IInvoice,
  ICustomer,
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
export class InvoiceListComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly invoicesService = inject(InvoicesService);
  private readonly customersService = inject(CustomersService);
  private readonly authService = inject(AuthService);
  private readonly snackbarService = inject(SnackbarService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly currentUser = this.authService.currentUser;
  readonly isSuperAdmin = this.authService.isSuperAdmin;

  readonly invoices = signal<IInvoice[]>([]);
  readonly customers = signal<ICustomer[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);
  readonly searchTerm = signal<string>('');
  readonly buyerFilter = signal<string>('');
  readonly buyerSearchInput = signal<string>('');
  readonly selectedPaymentFilter = signal<'ALL' | 'UNPAID' | 'PARTIAL' | 'PAID'>('ALL');

  // Date Range Filter Signals
  readonly startDate = signal<string>('');
  readonly endDate = signal<string>('');
  readonly selectedDatePreset = signal<string>('ALL');

  readonly alertMessage = signal<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Scalable Buyer Autocomplete & Search Signals
  readonly buyerSuggestions = signal<ICustomer[]>([]);
  readonly isSearchingBuyers = signal<boolean>(false);
  readonly isBuyerDropdownOpen = signal<boolean>(false);
  readonly selectedBuyerCustomer = signal<ICustomer | null>(null);
  private readonly buyerSearch$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  // Scalable Table Pagination Signals
  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(25);

  // Payment Recording Modal
  readonly selectedInvoiceForPayment = signal<IInvoice | null>(null);
  paymentForm!: FormGroup;

  // Active matched buyer info (resolved from explicit selection, loaded suggestions, or cache)
  readonly activeBuyerInfo = computed(() => {
    const query = this.buyerFilter().trim().toLowerCase();
    if (!query) return null;

    // 1. If explicitly selected customer object matches
    const selected = this.selectedBuyerCustomer();
    if (
      selected &&
      (selected.customerCode.toLowerCase() === query ||
        selected.companyName.toLowerCase() === query ||
        selected.id.toLowerCase() === query ||
        selected.customerCode.toLowerCase().includes(query) ||
        selected.companyName.toLowerCase().includes(query))
    ) {
      return selected;
    }

    // 2. Check in buyerSuggestions cache
    const suggestionMatch = this.buyerSuggestions().find(
      (c) =>
        c.customerCode.toLowerCase() === query ||
        c.companyName.toLowerCase() === query ||
        c.id.toLowerCase() === query ||
        c.customerCode.toLowerCase().includes(query) ||
        c.companyName.toLowerCase().includes(query),
    );
    if (suggestionMatch) return suggestionMatch;

    // 3. Fallback to loaded customers
    return (
      this.customers().find(
        (c) =>
          c.customerCode.toLowerCase() === query ||
          c.companyName.toLowerCase() === query ||
          c.id.toLowerCase() === query,
      ) || null
    );
  });

  // Filtered Invoices (Buyer filter + payment status + search term)
  readonly filteredInvoices = computed(() => {
    let list = this.invoices();

    // 1. Filter by Buyer (Customer Code, Company Name, or Customer ID)
    const buyer = this.buyerFilter().toLowerCase().trim();
    if (buyer) {
      list = list.filter((i) => {
        const code = (i.customerSnapshot?.customerCode || '').toLowerCase();
        const name = (i.customerSnapshot?.companyName || '').toLowerCase();
        const id = (i.customerId || '').toLowerCase();
        return code.includes(buyer) || name.includes(buyer) || id.includes(buyer);
      });
    }

    // 2. Filter by Payment Status
    const payFilter = this.selectedPaymentFilter();
    if (payFilter !== 'ALL') {
      list = list.filter((i) => i.paymentStatus === payFilter);
    }

    // 3. Search Term (Invoice number, vehicle number, reference, etc.)
    const term = this.searchTerm().toLowerCase().trim();
    if (term) {
      list = list.filter(
        (i) =>
          i.invoiceNumber.toLowerCase().includes(term) ||
          (i.vehicleNumber && i.vehicleNumber.toLowerCase().includes(term)) ||
          (i.customerSnapshot?.companyName &&
            i.customerSnapshot.companyName.toLowerCase().includes(term)) ||
          (i.customerSnapshot?.customerCode &&
            i.customerSnapshot.customerCode.toLowerCase().includes(term)) ||
          (i.reference && i.reference.toLowerCase().includes(term)),
      );
    }

    // 4. Date Range Filter (From / To)
    const start = this.startDate();
    const end = this.endDate();
    if (start || end) {
      list = list.filter((i) => {
        if (!i.invoiceDate) return false;
        const d = new Date(i.invoiceDate);
        if (isNaN(d.getTime())) return false;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${day}`;

        if (start && dateStr < start) return false;
        if (end && dateStr > end) return false;
        return true;
      });
    }

    return list;
  });

  // Computed Metrics (Reactively calculated for the filtered buyer & invoices)
  readonly totalBilled = computed(() =>
    this.filteredInvoices().reduce((sum, inv) => sum + (inv.totalAmount || 0), 0),
  );
  readonly totalPaid = computed(() =>
    this.filteredInvoices().reduce((sum, inv) => sum + (inv.paidAmount || 0), 0),
  );
  readonly totalPendingReceivables = computed(() =>
    this.filteredInvoices().reduce((sum, inv) => sum + (inv.balanceAmount || 0), 0),
  );
  readonly totalInvoicesCount = computed(() => this.filteredInvoices().length);

  // Pagination computations for fast DOM rendering with large invoice counts
  readonly totalPages = computed(() => {
    const total = this.filteredInvoices().length;
    return Math.max(1, Math.ceil(total / this.pageSize()));
  });

  readonly pagesArray = computed(() =>
    Array.from({ length: this.totalPages() }, (_, i) => i + 1),
  );

  readonly pagedInvoices = computed(() => {
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size;
    return this.filteredInvoices().slice(start, start + size);
  });

  readonly paginationInfo = computed(() => {
    const total = this.filteredInvoices().length;
    if (total === 0) {
      return { start: 0, end: 0, total: 0 };
    }
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size + 1;
    const end = Math.min(page * size, total);
    return { start, end, total };
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.buyer-filter-box')) {
      this.isBuyerDropdownOpen.set(false);
    }
  }

  ngOnInit(): void {
    this.initPaymentForm();
    this.loadInvoices();
    this.setupBuyerSearchPipeline();

    // Auto-apply buyer and date filters if provided in query params (e.g. /invoices?buyer=CUST-001&startDate=2026-09-01)
    this.route.queryParamMap.subscribe((params) => {
      const buyerParam =
        params.get('buyer') ||
        params.get('customerId') ||
        params.get('customerCode');
      if (buyerParam && buyerParam.trim()) {
        this.setBuyerFilter(buyerParam.trim());
      }

      const startParam = params.get('startDate') || params.get('from');
      const endParam = params.get('endDate') || params.get('to');
      if (startParam) {
        this.startDate.set(startParam);
        this.selectedDatePreset.set('CUSTOM');
      }
      if (endParam) {
        this.endDate.set(endParam);
        this.selectedDatePreset.set('CUSTOM');
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupBuyerSearchPipeline(): void {
    // Initial fetch of top 15 buyers for quick selection without downloading thousands of records
    this.customersService.getCustomers({ limit: 15 }).subscribe({
      next: (list) => {
        this.customers.set(list);
        this.buyerSuggestions.set(list);
      },
      error: (err) => {
        console.warn('Failed to load initial buyer suggestions:', err);
      },
    });

    // Reactive debounced search pipeline querying the server with limit: 15
    this.buyerSearch$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((term) => {
          const trimmed = term.trim();
          if (!trimmed) {
            this.isSearchingBuyers.set(false);
            return this.customersService.getCustomers({ limit: 15 });
          }
          this.isSearchingBuyers.set(true);
          return this.customersService
            .getCustomers({ search: trimmed, limit: 15 })
            .pipe(
              catchError(() => of([])),
              switchMap((res) => {
                this.isSearchingBuyers.set(false);
                return of(res);
              }),
            );
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((results) => {
        this.buyerSuggestions.set(results);
        this.isSearchingBuyers.set(false);
      });
  }

  onBuyerInputChange(val: string): void {
    this.buyerSearchInput.set(val);
    this.isBuyerDropdownOpen.set(true);
    this.buyerSearch$.next(val);
  }

  onBuyerFocus(): void {
    this.isBuyerDropdownOpen.set(true);
    if (this.buyerSuggestions().length === 0) {
      this.buyerSearch$.next(this.buyerSearchInput());
    }
  }

  onBuyerInputEnter(): void {
    const suggestions = this.buyerSuggestions();
    if (suggestions.length > 0) {
      this.selectBuyerSuggestion(suggestions[0]);
    }
  }

  selectBuyerSuggestion(cust: ICustomer): void {
    this.selectedBuyerCustomer.set(cust);
    this.buyerSearchInput.set(cust.companyName);
    this.buyerFilter.set(cust.customerCode);
    this.isBuyerDropdownOpen.set(false);
    this.currentPage.set(1);
  }

  setBuyerFilter(val: string, cust?: ICustomer): void {
    this.buyerFilter.set(val);
    this.isBuyerDropdownOpen.set(false);
    this.currentPage.set(1);

    if (cust) {
      this.selectedBuyerCustomer.set(cust);
      this.buyerSearchInput.set(cust.companyName);
    } else if (val.trim()) {
      // Find exact customer details for active banner & input display
      this.customersService.getCustomers({ search: val.trim(), limit: 1 }).subscribe({
        next: (res) => {
          if (res.length > 0) {
            this.selectedBuyerCustomer.set(res[0]);
            this.buyerSearchInput.set(res[0].companyName);
          } else {
            this.buyerSearchInput.set(val);
          }
        },
      });
    } else {
      this.buyerSearchInput.set('');
    }
  }

  clearBuyerFilter(): void {
    this.buyerSearchInput.set('');
    this.buyerFilter.set('');
    this.selectedBuyerCustomer.set(null);
    this.isBuyerDropdownOpen.set(false);
    this.currentPage.set(1);
    this.router.navigate([], {
      queryParams: { buyer: null, customerId: null, customerCode: null },
      queryParamsHandling: 'merge',
    });
  }

  resetAllFilters(): void {
    this.buyerSearchInput.set('');
    this.buyerFilter.set('');
    this.searchTerm.set('');
    this.selectedPaymentFilter.set('ALL');
    this.selectedBuyerCustomer.set(null);
    this.startDate.set('');
    this.endDate.set('');
    this.selectedDatePreset.set('ALL');
    this.isBuyerDropdownOpen.set(false);
    this.currentPage.set(1);
    this.router.navigate([], {
      queryParams: {
        buyer: null,
        customerId: null,
        customerCode: null,
        startDate: null,
        endDate: null,
        from: null,
        to: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  onStartDateChange(val: string): void {
    this.startDate.set(val || '');
    this.selectedDatePreset.set('CUSTOM');
    this.currentPage.set(1);
  }

  onEndDateChange(val: string): void {
    this.endDate.set(val || '');
    this.selectedDatePreset.set('CUSTOM');
    this.currentPage.set(1);
  }

  clearDateFilter(): void {
    this.startDate.set('');
    this.endDate.set('');
    this.selectedDatePreset.set('ALL');
    this.currentPage.set(1);
  }

  applyDatePreset(preset: string): void {
    this.selectedDatePreset.set(preset);
    const today = new Date();
    const formatDate = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    if (preset === 'ALL') {
      this.startDate.set('');
      this.endDate.set('');
    } else if (preset === 'TODAY') {
      const str = formatDate(today);
      this.startDate.set(str);
      this.endDate.set(str);
    } else if (preset === 'THIS_WEEK') {
      const dayOfWeek = today.getDay(); // 0 is Sunday
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(today);
      monday.setDate(today.getDate() - diffToMonday);
      this.startDate.set(formatDate(monday));
      this.endDate.set(formatDate(today));
    } else if (preset === 'THIS_MONTH') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      this.startDate.set(formatDate(firstDay));
      this.endDate.set(formatDate(lastDay));
    } else if (preset === 'LAST_30_DAYS') {
      const past30 = new Date(today);
      past30.setDate(today.getDate() - 29);
      this.startDate.set(formatDate(past30));
      this.endDate.set(formatDate(today));
    } else if (preset === 'THIS_FY') {
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth(); // 0-indexed (April is 3)
      const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
      const fyEndYear = fyStartYear + 1;
      this.startDate.set(`${fyStartYear}-04-01`);
      this.endDate.set(`${fyEndYear}-03-31`);
    }
    this.currentPage.set(1);
  }

  onSearchChange(term: string): void {
    this.searchTerm.set(term);
    this.currentPage.set(1);
  }

  onPaymentFilterChange(filter: 'ALL' | 'UNPAID' | 'PARTIAL' | 'PAID'): void {
    this.selectedPaymentFilter.set(filter);
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update((p) => p + 1);
    }
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update((p) => p - 1);
    }
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
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
    const pendingDue = (invoice.balanceAmount !== undefined && invoice.balanceAmount !== null)
      ? Number(invoice.balanceAmount)
      : Math.max(0, Number(((invoice.totalAmount || 0) - (invoice.paidAmount || 0)).toFixed(2)));

    this.paymentForm.reset({
      amount: pendingDue,
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
        Validators.max(pendingDue),
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
      next: () => {
        this.isSubmitting.set(false);
        this.closePaymentModal();
        const formattedAmount = new Intl.NumberFormat('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(dto.amount);
        this.showAlert(
          'success',
          `Payment of ₹${formattedAmount} successfully recorded against invoice ${inv.invoiceNumber}!`,
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
    this.invoicesService.downloadInvoiceDirectly(invoice.id, invoice.invoiceNumber);
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
    this.snackbarService.show(text, type);
    setTimeout(() => this.alertMessage.set(null), 5000);
  }
}
