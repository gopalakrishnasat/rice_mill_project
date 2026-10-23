import {
  Component,
  OnInit,
  signal,
  computed,
  inject,
  HostListener,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BillInvoicesService } from '../../core/services/bill-invoices.service';
import { CustomersService } from '../../core/services/customers.service';
import { ProductsService } from '../../core/services/products.service';
import { SnackbarService } from '../../core/services/snackbar.service';
import { AuthService } from '../../core/services/auth.service';
import {
  ICustomer,
  IProduct,
  IBillInvoice,
  IBillInvoiceItem,
  CreateBillInvoiceDto,
  UpdateBillInvoiceDto,
  UserRole,
} from '@rice-mill-project/shared-types';

export interface FormItemRow {
  description: string;
  quantity: number | null;
  unit: string;
  rate: number;
  amount: number;
}

@Component({
  selector: 'app-bill-invoice-create',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './bill-invoice-create.component.html',
  styleUrls: ['./bill-invoice-create.component.scss'],
})
export class BillInvoiceCreateComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly billInvoicesService = inject(BillInvoicesService);
  private readonly customersService = inject(CustomersService);
  private readonly productsService = inject(ProductsService);
  private readonly authService = inject(AuthService);
  private readonly snackbar = inject(SnackbarService);
  private readonly elementRef = inject(ElementRef);

  @ViewChild('customerSearchInput') customerSearchInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('productSearchInput') productSearchInputRef?: ElementRef<HTMLInputElement>;

  readonly currentUser = this.authService.currentUser;
  readonly canManageBills = computed(() => {
    const role = this.currentUser()?.role;
    return role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;
  });

  readonly isEditMode = signal<boolean>(false);
  readonly editingId = signal<string | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);

  readonly customers = signal<ICustomer[]>([]);
  readonly products = signal<IProduct[]>([]);

  // Search & Filter Dropdown State
  readonly isCustomerDropdownOpen = signal<boolean>(false);
  readonly customerSearchQuery = signal<string>('');

  readonly activeProductPickerIndex = signal<number | null>(null);
  readonly productSearchQuery = signal<string>('');

  // Form Fields
  readonly selectedCustomerId = signal<string>('');
  readonly billNumber = signal<string>('');
  billDate = '';
  vehicleNumber = '';
  buyerCompanyName = '';
  buyerBillingAddress = '';
  buyerMobile = '';
  notes = '';

  items: FormItemRow[] = [
    { description: '', quantity: null, unit: 'Bag', rate: 0, amount: 0 },
  ];

  // Filtered Customers based on live search filter
  readonly filteredCustomers = computed(() => {
    const query = this.customerSearchQuery().toLowerCase().trim();
    const list = this.customers();
    if (!query) return list;
    return list.filter((c) => {
      const name = (c.companyName || '').toLowerCase();
      const code = (c.customerCode || '').toLowerCase();
      const mobile = (c.mobile || '').toLowerCase();
      const city = (c.billingAddress?.city || '').toLowerCase();
      return name.includes(query) || code.includes(query) || mobile.includes(query) || city.includes(query);
    });
  });

  // Selected customer object
  readonly selectedCustomerObj = computed(() => {
    const id = this.selectedCustomerId();
    if (!id) return undefined;
    return this.customers().find((c) => c.id === id || (c as any)._id === id);
  });

  // Filtered Products based on live search filter
  readonly filteredProducts = computed(() => {
    const query = this.productSearchQuery().toLowerCase().trim();
    const list = this.products();
    if (!query) return list;
    return list.filter((p) => {
      const name = (p.name || '').toLowerCase();
      const code = (p.productCode || '').toLowerCase();
      const rate = String(p.defaultRate || '');
      return name.includes(query) || code.includes(query) || rate.includes(query);
    });
  });

  readonly itemsChange = signal<number>(0);

  readonly subTotal = computed(() => {
    this.itemsChange();
    return this.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  });

  readonly totalAmount = computed(() => {
    return this.subTotal();
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    // Close customer dropdown if clicked outside
    if (!target.closest('.customer-search-dropdown-wrapper')) {
      this.isCustomerDropdownOpen.set(false);
    }
    // Close product picker if clicked outside
    if (!target.closest('.product-picker-dropdown-wrapper')) {
      this.activeProductPickerIndex.set(null);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.isCustomerDropdownOpen.set(false);
    this.activeProductPickerIndex.set(null);
  }

  ngOnInit(): void {
    // Set default date to today YYYY-MM-DD
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    this.billDate = `${yyyy}-${mm}-${dd}`;

    this.loadCustomers();
    this.loadProducts();

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.isEditMode.set(true);
        this.editingId.set(id);
        this.loadExistingBill(id);
      } else {
        this.loadNextBillNumber();
      }
    });
  }

  loadCustomers(): void {
    this.customersService.getCustomers({ isActive: true }).subscribe({
      next: (data) => this.customers.set(data),
      error: (err) => console.error('Failed to load customers:', err),
    });
  }

  loadProducts(): void {
    this.productsService.getProducts().subscribe({
      next: (data) => {
        this.products.set(data);
      },
      error: (err) => console.error('Failed to load products:', err),
    });
  }

  loadNextBillNumber(): void {
    this.billInvoicesService.getNextBillNumber().subscribe({
      next: (num) => {
        if (!this.billNumber()) {
          this.billNumber.set(num);
        }
      },
      error: (err) => console.error('Failed to load next bill number:', err),
    });
  }

  loadExistingBill(id: string): void {
    this.isLoading.set(true);
    this.billInvoicesService.getBillById(id).subscribe({
      next: (bill) => {
        this.selectedCustomerId.set(bill.customerId || '');
        this.billNumber.set(bill.billNumber || '');
        if (bill.date) {
          const d = new Date(bill.date);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          this.billDate = `${yyyy}-${mm}-${dd}`;
        }
        this.vehicleNumber = bill.vehicleNumber || '';
        this.buyerCompanyName = bill.customerSnapshot?.companyName || '';
        this.buyerBillingAddress = bill.customerSnapshot?.billingAddress || '';
        this.buyerMobile = bill.customerSnapshot?.mobile || '';
        this.notes = bill.notes || '';

        if (bill.items && bill.items.length > 0) {
          this.items = bill.items.map((it) => ({
            description: it.description,
            quantity: it.quantity,
            unit: it.unit || 'Bag',
            rate: it.rate,
            amount: it.amount,
          }));
          this.itemsChange.update((v) => v + 1);
        }

        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load bill:', err);
        this.snackbar.error('Failed to load existing bill details.');
        this.isLoading.set(false);
      },
    });
  }

  // --- Customer Dropdown with Search Filter ---
  toggleCustomerDropdown(event?: MouseEvent): void {
    if (event) event.stopPropagation();
    const nextState = !this.isCustomerDropdownOpen();
    this.isCustomerDropdownOpen.set(nextState);
    if (nextState) {
      this.customerSearchQuery.set('');
      setTimeout(() => this.customerSearchInputRef?.nativeElement.focus(), 60);
    }
  }

  selectCustomer(customer: ICustomer): void {
    const custId = customer.id || (customer as any)._id || '';
    this.selectedCustomerId.set(custId);
    this.buyerCompanyName = customer.companyName;
    this.buyerMobile = customer.mobile || '';

    const addressLines: string[] = [];
    if (customer.billingAddress?.line1) addressLines.push(customer.billingAddress.line1);
    if (customer.billingAddress?.line2) addressLines.push(customer.billingAddress.line2);

    const cityPin = [
      customer.billingAddress?.city,
      customer.billingAddress?.pincode ? `- ${customer.billingAddress.pincode}` : '',
    ]
      .filter(Boolean)
      .join(' ');
    if (cityPin) addressLines.push(cityPin);

    this.buyerBillingAddress = addressLines.join('\n');
    this.isCustomerDropdownOpen.set(false);
  }

  clearCustomerSelection(event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.selectedCustomerId.set('');
  }

  // --- Product Picker with Search Filter for Items ---
  toggleProductPicker(index: number, event: MouseEvent): void {
    event.stopPropagation();
    if (this.activeProductPickerIndex() === index) {
      this.activeProductPickerIndex.set(null);
    } else {
      this.activeProductPickerIndex.set(index);
      this.productSearchQuery.set('');
      setTimeout(() => this.productSearchInputRef?.nativeElement.focus(), 60);
    }
  }

  selectProductForItem(index: number, product: IProduct): void {
    const item = this.items[index];
    item.description = product.name;
    item.unit = product.unit === 'BAG' ? 'Bag' : (product.unit === 'KG' ? 'Kg' : product.unit || 'Bag');
    if (product.defaultRate) {
      item.rate = product.defaultRate;
    }
    this.recalculateItem(index);
    this.activeProductPickerIndex.set(null);
  }

  addItemRow(): void {
    this.items.push({
      description: '',
      quantity: null,
      unit: 'Bag',
      rate: 0,
      amount: 0,
    });
    this.itemsChange.update((v) => v + 1);
  }

  removeItemRow(index: number): void {
    if (this.items.length <= 1) {
      this.snackbar.error('At least one item is required in the bill.');
      return;
    }
    this.items.splice(index, 1);
    this.itemsChange.update((v) => v + 1);
  }

  recalculateItem(index: number): void {
    const item = this.items[index];
    const qty = Number(item.quantity) || 0;
    const rate = Number(item.rate) || 0;
    item.amount = Number((qty * rate).toFixed(2));
    this.itemsChange.update((v) => v + 1);
  }

  saveBill(): void {
    if (!this.canManageBills()) {
      this.snackbar.error('Access denied: You do not have permission to modify bill invoices.');
      return;
    }

    if (!this.buyerCompanyName.trim()) {
      this.snackbar.error('Please select or specify a Buyer / Company Name.');
      return;
    }

    if (!this.billNumber().trim()) {
      this.snackbar.error('Bill Number is required.');
      return;
    }

    // Validate items
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if (!it.description.trim()) {
        this.snackbar.error(`Please provide a description for item #${i + 1}.`);
        return;
      }
      if (!it.quantity || Number(it.quantity) <= 0) {
        this.snackbar.error(`Quantity must be greater than 0 for item #${i + 1}.`);
        return;
      }
      if (it.rate < 0) {
        this.snackbar.error(`Rate cannot be negative for item #${i + 1}.`);
        return;
      }
    }

    this.isSaving.set(true);

    const payloadItems: IBillInvoiceItem[] = this.items.map((it) => ({
      description: it.description.trim(),
      quantity: Number(it.quantity),
      unit: it.unit || 'Bag',
      rate: Number(it.rate),
      amount: Number(it.amount),
    }));

    const customerSnapshot = {
      companyName: this.buyerCompanyName.trim(),
      billingAddress: this.buyerBillingAddress.trim(),
      mobile: this.buyerMobile.trim() || undefined,
    };

    if (this.isEditMode() && this.editingId()) {
      const dto: UpdateBillInvoiceDto = {
        billNumber: this.billNumber().trim(),
        date: this.billDate,
        vehicleNumber: this.vehicleNumber.trim() || undefined,
        customerId: this.selectedCustomerId() || undefined,
        customerSnapshot,
        items: payloadItems,
        notes: this.notes.trim() || undefined,
      };

      this.billInvoicesService.updateBill(this.editingId()!, dto).subscribe({
        next: (saved) => {
          this.snackbar.success(`Bill invoice ${saved.billNumber} updated successfully.`);
          this.isSaving.set(false);
          this.router.navigate(['/bill-invoices', saved.id, 'print']);
        },
        error: (err) => {
          console.error('Failed to update bill:', err);
          const errorMsg =
            err.status === 403
              ? (err.error?.message || 'Access denied: You do not have permission to update bill invoices.')
              : (err.error?.message || 'Failed to update bill invoice.');
          this.snackbar.error(errorMsg);
          this.isSaving.set(false);
        },
      });
    } else {
      const dto: CreateBillInvoiceDto = {
        billNumber: this.billNumber().trim(),
        date: this.billDate,
        vehicleNumber: this.vehicleNumber.trim() || undefined,
        customerId: this.selectedCustomerId() || undefined,
        customerSnapshot,
        items: payloadItems,
        notes: this.notes.trim() || undefined,
      };

      this.billInvoicesService.createBill(dto).subscribe({
        next: (created) => {
          this.snackbar.success(`Bill invoice ${created.billNumber} created successfully.`);
          this.isSaving.set(false);
          this.router.navigate(['/bill-invoices', created.id, 'print']);
        },
        error: (err) => {
          console.error('Failed to create bill:', err);
          const errorMsg =
            err.status === 403
              ? (err.error?.message || 'Access denied: You do not have permission to create bill invoices.')
              : (err.error?.message || 'Failed to create bill invoice.');
          this.snackbar.error(errorMsg);
          this.isSaving.set(false);
        },
      });
    }
  }

  cancel(): void {
    this.router.navigate(['/bill-invoices']);
  }
}
