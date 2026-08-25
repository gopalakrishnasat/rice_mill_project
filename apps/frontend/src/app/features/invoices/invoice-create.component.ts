import {
  Component,
  OnInit,
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
  FormArray,
  Validators,
  FormsModule,
} from '@angular/forms';
import { InvoicesService } from '../../core/services/invoices.service';
import { CustomersService } from '../../core/services/customers.service';
import { ProductsService } from '../../core/services/products.service';
import { AuthService } from '../../core/services/auth.service';
import {
  IInvoice,
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
export class InvoiceCreateComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly invoicesService = inject(InvoicesService);
  private readonly customersService = inject(CustomersService);
  private readonly productsService = inject(ProductsService);
  private readonly authService = inject(AuthService);
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

  // Quick Add Customer Modal
  readonly showQuickCustomerModal = signal<boolean>(false);
  readonly autoQuickCustomerCode = signal<string>('CUST-001');
  quickCustomerForm!: FormGroup;

  // Invoice Form & Live Reactive Form Value Signal
  invoiceForm!: FormGroup;
  readonly formValue = signal<any>({});

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

    this.quickCustomerForm = this.fb.group({
      companyName: ['', [Validators.required]],
      contactPerson: [''],
      mobile: ['', [Validators.required, Validators.minLength(10)]],
      gstin: [''],
      city: ['Pune', [Validators.required]],
      line1: ['Market Road', [Validators.required]],
      state: ['Maharashtra', [Validators.required]],
      stateCode: ['27', [Validators.required]],
      pincode: ['411001', [Validators.required]],
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

        this.formValue.set(this.invoiceForm.value);
      },
      error: () => {
        this.isLoading.set(false);
        this.showAlert('error', 'Failed to load invoice details.');
      },
    });
  }

  openQuickCustomerModal(): void {
    this.quickCustomerForm.reset({
      city: 'Pune',
      line1: 'Market Road',
      state: 'Maharashtra',
      stateCode: '27',
      pincode: '411001',
    });
    this.customersService.getNextCustomerCode().subscribe({
      next: (c) => this.autoQuickCustomerCode.set(c),
    });
    this.showQuickCustomerModal.set(true);
  }

  closeQuickCustomerModal(): void {
    this.showQuickCustomerModal.set(false);
  }

  onQuickCustomerSubmit(): void {
    if (this.quickCustomerForm.invalid) {
      this.quickCustomerForm.markAllAsTouched();
      return;
    }

    const val = this.quickCustomerForm.value;
    const dto: CreateCustomerDto = {
      customerCode: this.autoQuickCustomerCode(),
      companyName: val.companyName,
      contactPerson: val.contactPerson,
      mobile: val.mobile,
      gstin: val.gstin || undefined,
      billingAddress: {
        line1: val.line1,
        city: val.city,
        state: val.state,
        stateCode: val.stateCode,
        pincode: val.pincode,
      },
    };

    this.isSubmitting.set(true);
    this.customersService.createCustomer(dto).subscribe({
      next: (newCust) => {
        this.isSubmitting.set(false);
        this.closeQuickCustomerModal();
        this.customers.update((prev) => [...prev, newCust]);
        this.invoiceForm.get('customerId')?.setValue(newCust.id);
        this.formValue.set(this.invoiceForm.value);
        this.showAlert('success', `Buyer "${newCust.companyName}" added and selected!`);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.showAlert('error', err.error?.message || 'Failed to add buyer.');
      },
    });
  }

  saveInvoice(andPrint: boolean = false): void {
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

  logout(): void {
    this.authService.logout();
  }

  private showAlert(type: 'success' | 'error', text: string): void {
    this.alertMessage.set({ type, text });
    setTimeout(() => this.alertMessage.set(null), 5000);
  }
}
