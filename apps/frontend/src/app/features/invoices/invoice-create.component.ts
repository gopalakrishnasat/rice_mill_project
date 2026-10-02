import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
  ElementRef,
  ViewChild,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
  FormsModule,
} from '@angular/forms';
import { Subject, of } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  takeUntil,
  catchError,
} from 'rxjs/operators';
import { InvoicesService } from '../../core/services/invoices.service';
import { CustomersService } from '../../core/services/customers.service';
import { ProductsService } from '../../core/services/products.service';
import { AuthService } from '../../core/services/auth.service';
import { SnackbarService } from '../../core/services/snackbar.service';
import {
  ICustomer,
  IProduct,
  InvoiceType,
  InvoiceStatus,
  CreateInvoiceDto,
  UpdateInvoiceDto,
  CreateCustomerDto,
} from '@rice-mill-project/shared-types';

@Component({
  selector: 'app-invoice-create',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule],
  templateUrl: './invoice-create.component.html',
  styleUrls: ['./invoice-create.component.scss'],
})
export class InvoiceCreateComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly invoicesService = inject(InvoicesService);
  private readonly customersService = inject(CustomersService);
  private readonly productsService = inject(ProductsService);
  private readonly authService = inject(AuthService);
  private readonly snackbarService = inject(SnackbarService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly currentUser = this.authService.currentUser;
  readonly isSuperAdmin = this.authService.isSuperAdmin;

  // Edit Mode state
  readonly isEditMode = signal<boolean>(false);
  readonly editingInvoiceId = signal<string | null>(null);

  // Data Signals
  readonly customers = signal<ICustomer[]>([]);
  readonly products = signal<IProduct[]>([]);
  readonly autoInvoiceNumber = signal<string>('MU2627-VC-0001');
  readonly isSubmitting = signal<boolean>(false);
  readonly isLoading = signal<boolean>(false);
  readonly alertMessage = signal<{ type: 'success' | 'error'; text: string } | null>(null);

  // Buyer Searchable Dropdown state
  readonly isBuyerDropdownOpen = signal<boolean>(false);
  readonly buyerFilterSearch = signal<string>('');
  readonly isSearchingBuyers = signal<boolean>(false);
  readonly searchedCustomers = signal<ICustomer[]>([]);
  private readonly buyerFilterSearch$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  @ViewChild('buyerFilterInput') buyerFilterInputRef?: ElementRef<HTMLInputElement>;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.buyer-dropdown-container')) {
      this.isBuyerDropdownOpen.set(false);
    }
  }

  // Full Buyer Registration Modal
  readonly showRegisterBuyerModal = signal<boolean>(false);
  readonly autoCustomerCode = signal<string>('CUST-001');
  registerBuyerForm!: FormGroup;

  // Invoice Form & Live Reactive Form Value Signal
  invoiceForm!: FormGroup;
  readonly formValue = signal<any>({});

  // Computed displayed customers: combines loaded list and backend search results
  readonly displayedCustomers = computed(() => {
    const term = this.buyerFilterSearch().trim().toLowerCase();
    const searched = this.searchedCustomers();

    if (term.length > 0 && searched.length > 0) {
      return searched;
    }

    if (!term) {
      return this.customers();
    }

    // Instant local filtering fallback
    return this.customers().filter((c) => {
      const codeMatch = c.customerCode?.toLowerCase().includes(term);
      const nameMatch = c.companyName?.toLowerCase().includes(term);
      const cityMatch = c.billingAddress?.city?.toLowerCase().includes(term);
      const phoneMatch = c.mobile?.includes(term);
      const gstMatch = c.gstin?.toLowerCase().includes(term);
      return !!(codeMatch || nameMatch || cityMatch || phoneMatch || gstMatch);
    });
  });

  // Computed Live Values for WYSIWYG Bill Preview
  readonly liveItems = computed(() => {
    const raw = this.formValue()?.items || [];
    return raw.map((item: any) => {
      const qty = item?.qty ? Number(item.qty) : 0;
      const rate = item?.rate ? Number(item.rate) : 0;
      return {
        description: item?.description || '',
        hsnCode: item?.hsnCode || '',
        qty: qty,
        unit: item?.unit || 'Bag',
        rate: rate,
        amount: Number((qty * rate).toFixed(2)),
      };
    });
  });

  readonly liveSubTotal = computed(() =>
    this.liveItems().reduce((sum: number, it: any) => sum + it.amount, 0),
  );

  readonly liveTransport = computed(() => Number(this.formValue()?.transportCharges) || 0);
  readonly liveHamali = computed(() => Number(this.formValue()?.hamaliCharges) || 0);
  readonly liveDiscount = computed(() => Number(this.formValue()?.discount) || 0);

  readonly liveTaxableAmount = computed(() =>
    Math.max(
      0,
      this.liveSubTotal() + this.liveTransport() + this.liveHamali() - this.liveDiscount(),
    ),
  );

  readonly liveIsTaxInvoice = computed(
    () => this.formValue()?.invoiceType === InvoiceType.TAX_INVOICE,
  );

  readonly liveIsInterState = computed(
    () => !!this.formValue()?.isInterState,
  );

  readonly liveCgstAmount = computed(() => {
    if (!this.liveIsTaxInvoice() || this.liveIsInterState()) return 0;
    return Number(((this.liveTaxableAmount() * 2.5) / 100).toFixed(2));
  });

  readonly liveSgstAmount = computed(() => {
    if (!this.liveIsTaxInvoice() || this.liveIsInterState()) return 0;
    return Number(((this.liveTaxableAmount() * 2.5) / 100).toFixed(2));
  });

  readonly liveIgstAmount = computed(() => {
    if (!this.liveIsTaxInvoice() || !this.liveIsInterState()) return 0;
    return Number(((this.liveTaxableAmount() * 5.0) / 100).toFixed(2));
  });

  readonly liveTotalAmount = computed(() => {
    const raw =
      this.liveTaxableAmount() +
      this.liveCgstAmount() +
      this.liveSgstAmount() +
      this.liveIgstAmount();
    return Math.round(raw);
  });

  readonly selectedCustomerObj = computed(() => {
    const custId = this.formValue()?.customerId;
    return this.customers().find((c) => c.id === custId) || null;
  });

  readonly liveInvoiceDate = computed(() => this.formValue()?.invoiceDate || new Date());
  readonly liveReference = computed(() => this.formValue()?.reference || '—');
  readonly liveVehicleNumber = computed(() => this.formValue()?.vehicleNumber || '—');
  readonly liveTransportDetails = computed(() => this.formValue()?.transportDetails || '—');

  ngOnInit(): void {
    this.initForms();
    this.loadCatalogData();
    this.setupBuyerFilterPipeline();

    // Check if edit mode or preselected customer
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.isEditMode.set(true);
        this.editingInvoiceId.set(id);
        this.loadInvoiceForEdit(id);
      }
    });

    this.route.queryParamMap.subscribe((q) => {
      const custId = q.get('customerId');
      if (custId && !this.isEditMode()) {
        this.invoiceForm.get('customerId')?.setValue(custId);
        this.formValue.set(this.invoiceForm.value);
        if (!this.customers().some((c) => c.id === custId)) {
          this.customersService.getCustomerById(custId).subscribe({
            next: (c) => {
              this.customers.update((prev) => [c, ...prev]);
              this.formValue.set(this.invoiceForm.value);
            },
          });
        }
      }
    });
  }

  private initForms(): void {
    this.invoiceForm = this.fb.group({
      invoiceType: [InvoiceType.TAX_INVOICE, [Validators.required]],
      invoiceDate: [new Date().toISOString().split('T')[0], [Validators.required]],
      customerId: ['', [Validators.required]],
      reference: [''],
      vehicleNumber: ['', [Validators.pattern(/^[A-Z0-9 -]{4,15}$/i)]],
      transportDetails: [''],
      lrNumber: [''],
      items: this.fb.array([]),
      transportCharges: [0, [Validators.min(0)]],
      hamaliCharges: [0, [Validators.min(0)]],
      discount: [0, [Validators.min(0)]],
      isInterState: [false],
      notes: [''],
    });

    // Subscribe to form value changes to drive reactive preview
    this.invoiceForm.valueChanges.subscribe((val) => {
      this.formValue.set(val);
    });

    // Start with 1 blank item row (no prefilled data)
    this.addItemRow();

    this.registerBuyerForm = this.fb.group({
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

  get itemsFormArray(): FormArray {
    return this.invoiceForm.get('items') as FormArray;
  }

  addItemRow(item?: {
    description?: string;
    hsnCode?: string;
    qty?: number | string;
    unit?: string;
    rate?: number | string;
  }): void {
    const group = this.fb.group({
      description: [item?.description ?? '', [Validators.required]],
      hsnCode: [item?.hsnCode ?? '', [Validators.required]],
      qty: [item?.qty !== undefined && item?.qty !== '' ? item.qty : '', [Validators.required, Validators.min(0.1)]],
      unit: [item?.unit || 'Bag', [Validators.required]],
      rate: [item?.rate !== undefined && item?.rate !== '' ? item.rate : '', [Validators.required, Validators.min(0)]],
    });
    this.itemsFormArray.push(group);
    this.formValue.set(this.invoiceForm.value);
  }

  removeItemRow(index: number): void {
    if (this.itemsFormArray.length > 1) {
      this.itemsFormArray.removeAt(index);
      this.formValue.set(this.invoiceForm.value);
    }
  }

  onProductSelect(index: number, event: Event): void {
    const target = event.target as HTMLSelectElement;
    const prodId = target.value;
    const prod = this.products().find((p) => p.id === prodId);
    if (prod) {
      const row = this.itemsFormArray.at(index);
      row.patchValue({
        description: prod.name,
        hsnCode: prod.hsnCode,
        rate: prod.defaultRate,
        unit: prod.unit === 'BAG' ? 'Bag' : prod.unit,
      });
      this.formValue.set(this.invoiceForm.value);
    }
  }

  private loadCatalogData(): void {
    this.customersService.getCustomers().subscribe({
      next: (custs) => {
        this.customers.set(custs);
        this.formValue.set(this.invoiceForm.value);
      },
    });

    this.productsService.getProducts().subscribe({
      next: (prods) => this.products.set(prods),
    });

    if (!this.isEditMode()) {
      this.invoicesService.getNextInvoiceNumber().subscribe({
        next: (num) => this.autoInvoiceNumber.set(num),
      });
    }
  }

  private loadInvoiceForEdit(id: string): void {
    this.isLoading.set(true);
    this.invoicesService.getInvoiceById(id).subscribe({
      next: (inv) => {
        this.isLoading.set(false);

        if (inv.paymentStatus === 'PAID') {
          this.showAlert(
            'error',
            `Invoice ${inv.invoiceNumber} is FULLY PAID and cannot be edited because payments are already settled.`,
          );
          setTimeout(() => {
            this.router.navigate(['/invoices']);
          }, 2500);
          return;
        }

        this.autoInvoiceNumber.set(inv.invoiceNumber);

        // Clear default item
        while (this.itemsFormArray.length > 0) {
          this.itemsFormArray.removeAt(0);
        }

        inv.items.forEach((it) => {
          this.addItemRow(it);
        });

        this.invoiceForm.patchValue({
          invoiceType: inv.invoiceType,
          invoiceDate: new Date(inv.invoiceDate).toISOString().split('T')[0],
          customerId: inv.customerId,
          reference: inv.reference || '',
          vehicleNumber: inv.vehicleNumber || '',
          transportDetails: inv.transportDetails || '',
          lrNumber: inv.lrNumber || '',
          transportCharges: inv.transportCharges || 0,
          hamaliCharges: inv.hamaliCharges || 0,
          discount: inv.discount || 0,
          isInterState: inv.isInterState,
          notes: inv.notes || '',
        });

        // Ensure customer details are loaded if not in list
        if (inv.customerId && !this.customers().some((c) => c.id === inv.customerId)) {
          this.customersService.getCustomerById(inv.customerId).subscribe({
            next: (c) => {
              this.customers.update((prev) => [c, ...prev]);
              this.formValue.set(this.invoiceForm.value);
            },
            error: (err) => console.warn('Could not fetch customer details for edit:', err),
          });
        }

        this.formValue.set(this.invoiceForm.value);
      },
      error: () => {
        this.isLoading.set(false);
        this.showAlert('error', 'Failed to load invoice details.');
      },
    });
  }

  openRegisterBuyerModal(prefillName?: string): void {
    this.closeBuyerDropdown();
    this.registerBuyerForm.reset({
      companyName: prefillName?.trim() || '',
      contactPerson: '',
      mobile: '',
      email: '',
      gstin: '',
      pan: '',
      line1: '',
      line2: '',
      city: '',
      state: 'Maharashtra',
      stateCode: '27',
      pincode: '',
      notes: '',
    });
    this.customersService.getNextCustomerCode().subscribe({
      next: (c) => this.autoCustomerCode.set(c),
      error: () => this.autoCustomerCode.set('CUST-001'),
    });
    this.showRegisterBuyerModal.set(true);
  }

  closeRegisterBuyerModal(): void {
    this.showRegisterBuyerModal.set(false);
  }

  onRegisterBuyerSubmit(): void {
    if (this.registerBuyerForm.invalid) {
      this.registerBuyerForm.markAllAsTouched();
      return;
    }

    const val = this.registerBuyerForm.value;
    const dto: CreateCustomerDto = {
      customerCode: this.autoCustomerCode(),
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

    this.isSubmitting.set(true);
    this.customersService.createCustomer(dto).subscribe({
      next: (newCust) => {
        this.isSubmitting.set(false);
        this.closeRegisterBuyerModal();
        this.customers.update((prev) => [...prev, newCust]);
        this.invoiceForm.get('customerId')?.setValue(newCust.id);
        this.invoiceForm.get('customerId')?.markAsDirty();
        this.invoiceForm.get('customerId')?.markAsTouched();
        this.formValue.set(this.invoiceForm.value);
        this.showAlert(
          'success',
          `Buyer "${newCust.companyName}" (${newCust.customerCode}) registered and selected!`,
        );
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.showAlert('error', err.error?.message || 'Failed to register buyer.');
      },
    });
  }

  saveInvoice(andPrint = false): void {
    if (this.invoiceForm.invalid) {
      this.invoiceForm.markAllAsTouched();
      this.showAlert('error', 'Please complete all required fields (*).');
      return;
    }

    const val = this.invoiceForm.value;
    const items = val.items.map((it: any) => ({
      description: it.description,
      hsnCode: it.hsnCode,
      qty: Number(it.qty),
      unit: it.unit,
      rate: Number(it.rate),
      amount: Number((Number(it.qty) * Number(it.rate)).toFixed(2)),
    }));

    this.isSubmitting.set(true);

    if (this.isEditMode() && this.editingInvoiceId()) {
      const updateDto: UpdateInvoiceDto = {
        invoiceType: val.invoiceType,
        invoiceDate: val.invoiceDate,
        reference: val.reference || undefined,
        vehicleNumber: val.vehicleNumber || undefined,
        transportDetails: val.transportDetails || undefined,
        lrNumber: val.lrNumber || undefined,
        items,
        transportCharges: Number(val.transportCharges) || 0,
        hamaliCharges: Number(val.hamaliCharges) || 0,
        discount: Number(val.discount) || 0,
        isInterState: val.isInterState,
        notes: val.notes || undefined,
      };

      this.invoicesService.updateInvoice(this.editingInvoiceId()!, updateDto).subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          if (andPrint) {
            this.router.navigate(['/invoices', res.id, 'print']);
          } else {
            this.showAlert('success', `Invoice ${res.invoiceNumber} updated successfully!`);
            setTimeout(() => this.router.navigate(['/invoices']), 1200);
          }
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.showAlert('error', err.error?.message || 'Failed to update invoice.');
        },
      });
    } else {
      const createDto: CreateInvoiceDto = {
        invoiceNumber: this.autoInvoiceNumber(),
        invoiceType: val.invoiceType,
        invoiceDate: val.invoiceDate,
        customerId: val.customerId,
        reference: val.reference || undefined,
        vehicleNumber: val.vehicleNumber || undefined,
        transportDetails: val.transportDetails || undefined,
        lrNumber: val.lrNumber || undefined,
        items,
        transportCharges: Number(val.transportCharges) || 0,
        hamaliCharges: Number(val.hamaliCharges) || 0,
        discount: Number(val.discount) || 0,
        isInterState: val.isInterState,
        status: InvoiceStatus.ISSUED,
        notes: val.notes || undefined,
      };

      this.invoicesService.createInvoice(createDto).subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          if (andPrint) {
            this.router.navigate(['/invoices', res.id, 'print']);
          } else {
            this.showAlert('success', `Invoice ${res.invoiceNumber} created and saved to DB!`);
            setTimeout(() => this.router.navigate(['/invoices']), 1200);
          }
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.showAlert('error', err.error?.message || 'Failed to create invoice.');
        },
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupBuyerFilterPipeline(): void {
    this.buyerFilterSearch$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((term) => {
          const trimmed = term.trim();
          if (!trimmed) {
            this.isSearchingBuyers.set(false);
            this.searchedCustomers.set([]);
            return of([]);
          }
          this.isSearchingBuyers.set(true);
          return this.customersService
            .getCustomers({ search: trimmed, limit: 30 })
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
        this.searchedCustomers.set(results);
        this.isSearchingBuyers.set(false);
        if (results.length > 0) {
          this.customers.update((prev) => {
            const existingIds = new Set(prev.map((c) => c.id));
            const additions = results.filter((c) => !existingIds.has(c.id));
            return additions.length > 0 ? [...prev, ...additions] : prev;
          });
        }
      });
  }

  toggleBuyerDropdown(event: Event): void {
    event.stopPropagation();
    const willOpen = !this.isBuyerDropdownOpen();
    this.isBuyerDropdownOpen.set(willOpen);
    if (willOpen) {
      setTimeout(() => {
        this.buyerFilterInputRef?.nativeElement?.focus();
      }, 60);
    }
  }

  openBuyerDropdown(): void {
    this.isBuyerDropdownOpen.set(true);
    setTimeout(() => {
      this.buyerFilterInputRef?.nativeElement?.focus();
    }, 60);
  }

  closeBuyerDropdown(): void {
    this.isBuyerDropdownOpen.set(false);
  }

  selectCustomer(cust: ICustomer, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.invoiceForm.get('customerId')?.setValue(cust.id);
    this.invoiceForm.get('customerId')?.markAsDirty();
    this.invoiceForm.get('customerId')?.markAsTouched();
    this.formValue.set(this.invoiceForm.value);
    this.isBuyerDropdownOpen.set(false);
    this.buyerFilterSearch.set('');
    this.searchedCustomers.set([]);
  }

  clearSelectedCustomer(event: Event): void {
    event.stopPropagation();
    this.invoiceForm.get('customerId')?.setValue('');
    this.invoiceForm.get('customerId')?.markAsDirty();
    this.invoiceForm.get('customerId')?.markAsTouched();
    this.formValue.set(this.invoiceForm.value);
    this.buyerFilterSearch.set('');
    this.searchedCustomers.set([]);
  }

  onBuyerFilterSearchChange(val: string): void {
    this.buyerFilterSearch.set(val);
    this.buyerFilterSearch$.next(val);
  }

  clearBuyerFilterSearch(event: Event): void {
    event.stopPropagation();
    this.buyerFilterSearch.set('');
    this.searchedCustomers.set([]);
    this.buyerFilterSearch$.next('');
    this.buyerFilterInputRef?.nativeElement?.focus();
  }

  onBuyerFilterKeydownEnter(event: Event): void {
    event.preventDefault();
    const list = this.displayedCustomers();
    if (list.length > 0) {
      this.selectCustomer(list[0]);
    }
  }

  openRegisterBuyerFromSearch(name: string): void {
    this.openRegisterBuyerModal(name);
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
