import {
  Component,
  OnInit,
  signal,
  computed,
  inject,
  HostListener,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BillInvoicesService } from '../../core/services/bill-invoices.service';
import { CustomersService } from '../../core/services/customers.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { SnackbarService } from '../../core/services/snackbar.service';
import { IBillInvoice, ICustomer } from '@rice-mill-project/shared-types';

@Component({
  selector: 'app-bill-invoice-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './bill-invoice-list.component.html',
  styleUrls: ['./bill-invoice-list.component.scss'],
})
export class BillInvoiceListComponent implements OnInit {
  private readonly billInvoicesService = inject(BillInvoicesService);
  private readonly customersService = inject(CustomersService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly snackbar = inject(SnackbarService);

  @ViewChild('customerFilterInput') customerFilterInputRef?: ElementRef<HTMLInputElement>;

  readonly bills = signal<IBillInvoice[]>([]);
  readonly customers = signal<ICustomer[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly searchQuery = signal<string>('');
  readonly selectedCustomerId = signal<string>('');
  readonly startDate = signal<string>('');
  readonly endDate = signal<string>('');

  // Searchable Customer Filter State
  readonly isCustomerFilterOpen = signal<boolean>(false);
  readonly customerFilterSearch = signal<string>('');

  readonly selectedCustomerObj = computed(() => {
    return this.customers().find((c) => c.id === this.selectedCustomerId());
  });

  readonly filteredCustomersForFilter = computed(() => {
    const query = this.customerFilterSearch().toLowerCase().trim();
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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.customer-filter-dropdown-wrapper')) {
      this.isCustomerFilterOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.isCustomerFilterOpen.set(false);
  }

  readonly totalBillsCount = computed(() => this.bills().length);
  readonly totalBilledAmount = computed(() =>
    this.bills().reduce((sum, b) => sum + (b.totalAmount || 0), 0)
  );

  ngOnInit(): void {
    this.loadCustomers();
    this.loadBills();
  }

  loadCustomers(): void {
    this.customersService.getCustomers({ isActive: true }).subscribe({
      next: (data) => this.customers.set(data),
      error: (err) => console.error('Failed to load customers for filter:', err),
    });
  }

  loadBills(): void {
    this.isLoading.set(true);
    this.billInvoicesService
      .getBills({
        search: this.searchQuery().trim() || undefined,
        customerId: this.selectedCustomerId() || undefined,
        startDate: this.startDate() || undefined,
        endDate: this.endDate() || undefined,
      })
      .subscribe({
        next: (data) => {
          this.bills.set(data);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Failed to load bill invoices:', err);
          this.snackbar.error('Failed to load bill invoices.');
          this.isLoading.set(false);
        },
      });
  }

  onSearch(): void {
    this.loadBills();
  }

  toggleCustomerFilter(event?: MouseEvent): void {
    if (event) event.stopPropagation();
    const nextState = !this.isCustomerFilterOpen();
    this.isCustomerFilterOpen.set(nextState);
    if (nextState) {
      this.customerFilterSearch.set('');
      setTimeout(() => this.customerFilterInputRef?.nativeElement.focus(), 60);
    }
  }

  selectCustomerFilter(customerId: string): void {
    this.selectedCustomerId.set(customerId);
    this.isCustomerFilterOpen.set(false);
    this.loadBills();
  }

  clearCustomerFilter(event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.selectedCustomerId.set('');
    this.isCustomerFilterOpen.set(false);
    this.loadBills();
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.selectedCustomerId.set('');
    this.customerFilterSearch.set('');
    this.isCustomerFilterOpen.set(false);
    this.startDate.set('');
    this.endDate.set('');
    this.loadBills();
  }

  getDownloadUrl(id: string): string {
    return this.billInvoicesService.getBillDownloadUrl(id);
  }

  getDownloadFilename(billNumber?: string): string {
    return this.billInvoicesService.getBillDownloadFilename(billNumber);
  }

  onDownloadClick(bill: IBillInvoice): void {
    this.snackbar.success(`Bill Invoice download started: ${this.getDownloadFilename(bill.billNumber)}`);
  }

  async deleteBill(bill: IBillInvoice): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete Bill Invoice',
      message: `Are you sure you want to delete bill "${bill.billNumber}" for ${bill.customerSnapshot?.companyName || 'Buyer'}? This action cannot be undone.`,
      confirmText: 'Delete',
      type: 'danger',
    });

    if (!confirmed) return;

    this.billInvoicesService.deleteBill(bill.id).subscribe({
      next: () => {
        this.snackbar.success(`Bill invoice ${bill.billNumber} deleted successfully.`);
        this.bills.update((list) => list.filter((item) => item.id !== bill.id));
      },
      error: (err) => {
        console.error('Failed to delete bill invoice:', err);
        this.snackbar.error('Failed to delete bill invoice.');
      },
    });
  }
}
