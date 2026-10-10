import { Component, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { InvoicesService } from '../../core/services/invoices.service';
import { CustomersService } from '../../core/services/customers.service';
import { ProductsService } from '../../core/services/products.service';
import { CompanyService } from '../../core/services/company.service';
import {
  IInvoice,
  ICustomer,
  IProduct,
  ICompanyDetails,
  UserRole,
  PaymentStatus,
  ProductCategory,
} from '@rice-mill-project/shared-types';

export interface TopBuyerStat {
  id: string;
  name: string;
  code: string;
  city: string;
  billsCount: number;
  billed: number;
  paid: number;
  balance: number;
  collectionRate: number;
}

export interface TopProductStat {
  name: string;
  category: string;
  bags: number;
  revenue: number;
  percent: number;
  uom: string;
}

@Component({
  selector: 'app-dashboard-placeholder',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard-placeholder.component.html',
  styleUrls: ['./dashboard-placeholder.component.scss'],
})
export class DashboardPlaceholderComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly invoicesService = inject(InvoicesService);
  private readonly customersService = inject(CustomersService);
  private readonly productsService = inject(ProductsService);
  private readonly companyService = inject(CompanyService);

  readonly user = this.authService.currentUser;
  readonly permissions = this.authService.permissions;
  readonly company = this.companyService.currentCompany;

  readonly isSuperAdmin = computed(
    () => this.user()?.role === UserRole.SUPER_ADMIN,
  );
  readonly isAdmin = computed(
    () =>
      this.user()?.role === UserRole.SUPER_ADMIN ||
      this.user()?.role === UserRole.ADMIN,
  );

  // Loading state
  readonly isLoading = signal<boolean>(true);
  readonly lastUpdated = signal<Date>(new Date());

  // Dynamic Current Financial Year (Runs April 1st to March 31st based on live date)
  readonly currentFinancialYear = computed(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0 is Jan, 3 is April

    const startYear = currentMonth >= 3 ? currentYear : currentYear - 1;
    const endYear = startYear + 1;
    const shortEnd = String(endYear).slice(-2);

    return {
      label: `FY ${startYear}-${shortEnd}`,
      startYear,
      endYear,
      start: new Date(startYear, 3, 1, 0, 0, 0, 0),
      end: new Date(endYear, 2, 31, 23, 59, 59, 999),
    };
  });

  // Period filter
  readonly selectedPeriod = signal<'ALL' | 'FY' | 'MONTH'>('ALL');

  // Raw data signals populated dynamically from DB
  readonly allInvoices = signal<IInvoice[]>([]);
  readonly allCustomers = signal<ICustomer[]>([]);
  readonly allProducts = signal<IProduct[]>([]);

  private autoRefreshTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.loadDashboardData();
    // Auto-refresh every 45 seconds so daily sales & customer payments sync continuously in real time
    this.autoRefreshTimer = setInterval(() => {
      this.loadDashboardData(false);
    }, 45000);
  }

  ngOnDestroy(): void {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
  }

  loadDashboardData(showLoadingIndicator: boolean = true): void {
    if (showLoadingIndicator) {
      this.isLoading.set(true);
    }
    forkJoin({
      invoices: this.invoicesService.getInvoices(),
      customers: this.customersService.getCustomers(),
      products: this.productsService.getProducts(true),
      company: this.companyService.getCompanyDetails(),
    }).subscribe({
      next: ({ invoices, customers, products }) => {
        this.allInvoices.set(invoices);
        this.allCustomers.set(customers);
        this.allProducts.set(products);
        this.lastUpdated.set(new Date());
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  setPeriod(period: 'ALL' | 'FY' | 'MONTH'): void {
    this.selectedPeriod.set(period);
    this.visibleProductCount.set(5);
  }

  // Filtered invoices based on live period selection
  readonly filteredInvoices = computed(() => {
    const list = this.allInvoices();
    const period = this.selectedPeriod();

    if (period === 'ALL') {
      return list;
    }

    if (period === 'FY') {
      const fy = this.currentFinancialYear();
      return list.filter((inv) => {
        const d = new Date(inv.invoiceDate);
        return d >= fy.start && d <= fy.end;
      });
    }

    if (period === 'MONTH') {
      // Recent active month or last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const filtered = list.filter((inv) => new Date(inv.invoiceDate) >= thirtyDaysAgo);
      return filtered.length > 0 ? filtered : list.slice(0, 15);
    }

    return list;
  });

  // Meta Analysis KPI 1: Gross Mill Turnover (Dynamic sum from DB invoices)
  readonly totalTurnover = computed(() => {
    return this.filteredInvoices().reduce(
      (sum, inv) => sum + (inv.totalAmount || 0),
      0,
    );
  });

  // Meta Analysis KPI 2: Realized Collections (Dynamic sum of customer payments)
  readonly totalCollected = computed(() => {
    return this.filteredInvoices().reduce(
      (sum, inv) => sum + (inv.paidAmount || 0),
      0,
    );
  });

  // Meta Analysis KPI 3: Outstanding Receivables (Dynamic live Khata dues)
  readonly totalOutstanding = computed(() => {
    return this.filteredInvoices().reduce(
      (sum, inv) => sum + (inv.balanceAmount || 0),
      0,
    );
  });

  // Collection Recovery Rate %
  readonly collectionRatePercent = computed(() => {
    const turnover = this.totalTurnover();
    if (!turnover) return 0;
    return Math.round((this.totalCollected() / turnover) * 1000) / 10;
  });

  readonly outstandingRatePercent = computed(() => {
    const turnover = this.totalTurnover();
    if (!turnover) return 0;
    return Math.round((this.totalOutstanding() / turnover) * 1000) / 10;
  });

  // Meta Analysis KPI 4: Total Dispatch Volume (Dynamic bags sum across items)
  readonly totalBagsDispatched = computed(() => {
    return this.filteredInvoices().reduce((sum, inv) => {
      const bagSum = (inv.items || []).reduce((iSum, it) => iSum + (it.qty || 0), 0);
      return sum + bagSum;
    }, 0);
  });

  // Dynamic Metric Tons: Accurately calculated from live invoice item UOM & catalog bagWeightKg
  readonly dynamicMetricTons = computed(() => {
    const invoices = this.filteredInvoices();
    const products = this.allProducts();
    const productWeightMap = new Map<string, number>();

    for (const p of products) {
      if (p.name) {
        productWeightMap.set(p.name.trim().toLowerCase(), p.bagWeightKg || 50);
      }
    }

    let totalKg = 0;
    for (const inv of invoices) {
      for (const it of inv.items || []) {
        const qty = it.qty || 0;
        let weightPerBag = 50;

        // Check if uom specifies weight e.g. "9kg", "25kg", "50kg"
        if (it.uom && it.uom.toLowerCase().includes('kg')) {
          const parsed = parseFloat(it.uom);
          if (!isNaN(parsed) && parsed > 0) {
            weightPerBag = parsed;
          }
        } else if (it.description && productWeightMap.has(it.description.trim().toLowerCase())) {
          weightPerBag = productWeightMap.get(it.description.trim().toLowerCase())!;
        }

        totalKg += qty * weightPerBag;
      }
    }

    // Convert kg to Metric Tons (1 MT = 1,000 kg)
    return Math.round((totalKg / 1000) * 10) / 10;
  });

  // Average Invoice Size
  readonly avgInvoiceValue = computed(() => {
    const invoices = this.filteredInvoices();
    if (invoices.length === 0) return 0;
    return Math.round(this.totalTurnover() / invoices.length);
  });

  // Payment Status Meta Breakdown (Computed dynamically from invoice settlement records)
  readonly paymentBreakdown = computed(() => {
    const invoices = this.filteredInvoices();
    const total = invoices.length || 1;

    let paidCount = 0;
    let partialCount = 0;
    let unpaidCount = 0;

    let paidVolume = 0;
    let partialVolume = 0;
    let unpaidVolume = 0;

    for (const inv of invoices) {
      if (inv.paymentStatus === PaymentStatus.PAID) {
        paidCount++;
        paidVolume += inv.totalAmount || 0;
      } else if (inv.paymentStatus === PaymentStatus.PARTIAL) {
        partialCount++;
        partialVolume += inv.totalAmount || 0;
      } else {
        unpaidCount++;
        unpaidVolume += inv.totalAmount || 0;
      }
    }

    return {
      paidCount,
      partialCount,
      unpaidCount,
      paidVolume,
      partialVolume,
      unpaidVolume,
      paidPct: Math.round((paidCount / total) * 100),
      partialPct: Math.round((partialCount / total) * 100),
      unpaidPct: Math.round((unpaidCount / total) * 100),
    };
  });

  // Tax & Freight Levies Breakdown (Computed dynamically across all billed transactions)
  readonly taxBreakdown = computed(() => {
    const invoices = this.filteredInvoices();
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalTransport = 0;
    let totalHamali = 0;

    for (const inv of invoices) {
      totalCgst += inv.cgstAmount || 0;
      totalSgst += inv.sgstAmount || 0;
      totalIgst += inv.igstAmount || 0;
      totalTransport += inv.transportCharges || 0;
      totalHamali += inv.hamaliCharges || 0;
    }

    return {
      totalCgst: Math.round(totalCgst),
      totalSgst: Math.round(totalSgst),
      totalIgst: Math.round(totalIgst),
      totalTax: Math.round(totalCgst + totalSgst + totalIgst),
      totalTransport: Math.round(totalTransport),
      totalHamali: Math.round(totalHamali),
      totalLogistics: Math.round(totalTransport + totalHamali),
    };
  });

  // Top Buyers Khata Leaderboard (Dynamic across all registered buyers & live invoice data)
  readonly topBuyers = computed<TopBuyerStat[]>(() => {
    const invoices = this.filteredInvoices();
    const customers = this.allCustomers();
    const custMap = new Map<string, ICustomer>();
    for (const c of customers) {
      if (c.id) custMap.set(c.id, c);
      if (c.customerCode) custMap.set(c.customerCode, c);
    }

    const buyerMap = new Map<string, TopBuyerStat>();

    for (const inv of invoices) {
      const id = inv.customerId || inv.customerSnapshot?.customerCode || 'unknown';
      const cust = custMap.get(id) || (inv.customerId ? custMap.get(inv.customerId) : undefined);

      const name = cust?.companyName || inv.customerSnapshot?.companyName || 'Buyer';
      const code = cust?.customerCode || inv.customerSnapshot?.customerCode || 'CUST';
      const city = cust?.billingAddress?.city || inv.customerSnapshot?.billingAddress?.city || '';

      if (!buyerMap.has(id)) {
        buyerMap.set(id, {
          id,
          name,
          code,
          city,
          billsCount: 0,
          billed: 0,
          paid: 0,
          balance: 0,
          collectionRate: 0,
        });
      }

      const stat = buyerMap.get(id)!;
      stat.billsCount++;
      stat.billed += inv.totalAmount || 0;
      stat.paid += inv.paidAmount || 0;
      stat.balance += inv.balanceAmount || 0;
    }

    const list = Array.from(buyerMap.values());
    for (const b of list) {
      b.collectionRate = b.billed > 0 ? Math.round((b.paid / b.billed) * 100) : 100;
    }

    return list.sort((a, b) => b.billed - a.billed).slice(0, 5);
  });

  // Number of product varieties to show (starts at 5, increments by 5 on vertical scroll down)
  readonly visibleProductCount = signal<number>(5);
  readonly isLoadingMoreProducts = signal<boolean>(false);

  // All Product Varieties with Sales Analytics (Dynamically merged from Catalog & Invoiced Sales)
  readonly allProductVarieties = computed<TopProductStat[]>(() => {
    const invoices = this.filteredInvoices();
    const catalog = this.allProducts();
    const totalRev = this.totalTurnover() || 1;

    // Lookup map of all official products in the mill catalog
    const catalogMap = new Map<string, IProduct>();
    for (const p of catalog) {
      if (p.name) {
        catalogMap.set(p.name.trim().toLowerCase(), p);
      }
    }

    const productMap = new Map<
      string,
      {
        displayName: string;
        category: string;
        bags: number;
        revenue: number;
        uom: string;
      }
    >();

    // 1. Seed with all catalog products so all available varieties are included
    for (const p of catalog) {
      const key = p.name.trim().toLowerCase();
      productMap.set(key, {
        displayName: p.name.trim(),
        category: p.category || ProductCategory.RICE,
        bags: 0,
        revenue: 0,
        uom: `${p.bagWeightKg || 25}kg`,
      });
    }

    // 2. Aggregate actual dispatch bags and revenues from invoices
    for (const inv of invoices) {
      for (const it of inv.items || []) {
        const rawName = (it.description || 'Other Rice').trim();
        const key = rawName.toLowerCase();
        const catalogMatch = catalogMap.get(key);

        if (!productMap.has(key)) {
          let category: string = ProductCategory.RICE;
          if (catalogMatch?.category) {
            category = catalogMatch.category;
          } else if (
            key.includes('bran') ||
            key.includes('broken') ||
            key.includes('bhusa') ||
            key.includes('kani')
          ) {
            category = ProductCategory.BY_PRODUCT;
          } else if (key.includes('murmura') || key.includes('puffed')) {
            category = ProductCategory.PACKAGED;
          }

          const uom =
            it.uom ||
            (catalogMatch ? `${catalogMatch.bagWeightKg}kg` : (it.unit || 'Bag'));

          productMap.set(key, {
            displayName: rawName,
            category,
            bags: 0,
            revenue: 0,
            uom,
          });
        }

        const p = productMap.get(key)!;
        p.bags += it.qty || 0;
        p.revenue += it.amount || 0;
        if (it.uom && !p.uom.includes('kg')) {
          p.uom = it.uom;
        }
      }
    }

    // 3. Format and rank by revenue descending, then bags descending, then alphabetical
    return Array.from(productMap.values())
      .map((item) => ({
        name: item.displayName,
        category: item.category,
        bags: item.bags,
        revenue: item.revenue,
        uom: item.uom,
        percent:
          totalRev > 0
            ? Math.round((item.revenue / totalRev) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => {
        if (b.revenue !== a.revenue) {
          return b.revenue - a.revenue;
        }
        if (b.bags !== a.bags) {
          return b.bags - a.bags;
        }
        return a.name.localeCompare(b.name);
      });
  });

  // Displayed batch based on progressive vertical scroll
  readonly displayedProducts = computed<TopProductStat[]>(() => {
    const all = this.allProductVarieties();
    return all.slice(0, this.visibleProductCount());
  });

  // Compatibility alias
  readonly topProducts = this.displayedProducts;

  readonly totalProductVarietiesCount = computed<number>(
    () => this.allProductVarieties().length,
  );

  readonly hasMoreProducts = computed<boolean>(
    () => this.visibleProductCount() < this.allProductVarieties().length,
  );

  // Progressive scroll handler: fetches next 5 items when scrolled near bottom
  onProductListScroll(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target) return;

    const threshold = 35; // px from the bottom
    const isNearBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight <= threshold;

    if (isNearBottom && this.hasMoreProducts() && !this.isLoadingMoreProducts()) {
      this.loadNextProductBatch();
    }
  }

  loadNextProductBatch(): void {
    if (!this.hasMoreProducts() || this.isLoadingMoreProducts()) return;

    this.isLoadingMoreProducts.set(true);
    // Smooth micro-delay for high-fidelity infinite loading feedback
    setTimeout(() => {
      this.visibleProductCount.update((current) => current + 5);
      this.isLoadingMoreProducts.set(false);
    }, 250);
  }

  // Recent 5 Invoices Stream
  readonly recentInvoices = computed(() => {
    return [...this.allInvoices()]
      .sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime())
      .slice(0, 5);
  });

  // Quick stats counts
  readonly totalCustomerCount = computed(() => this.allCustomers().length);
  readonly totalProductCount = computed(() => this.allProducts().length);

  // Helper method for resolving customer billing city dynamically without hardcoding
  getInvoiceCity(inv: IInvoice): string {
    if (inv.customerSnapshot?.billingAddress?.city) {
      return inv.customerSnapshot.billingAddress.city;
    }
    const cust = this.allCustomers().find((c) => c.id === inv.customerId);
    return cust?.billingAddress?.city || '';
  }

  // Helper method for category badge label
  getCategoryLabel(category: string): string {
    if (category === ProductCategory.BY_PRODUCT) return 'By-Product';
    if (category === ProductCategory.PACKAGED) return 'Packaged';
    return 'Rice';
  }

  // Indian Rupee Currency Formatter
  formatInr(amount: number): string {
    if (isNaN(amount) || amount === null || amount === undefined) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  formatCompactInr(amount: number): string {
    if (isNaN(amount) || amount === null || amount === undefined) return '₹0';
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(2)} Cr`;
    }
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)} Lakh`;
    }
    if (amount >= 1000) {
      return `₹${(amount / 1000).toFixed(1)}k`;
    }
    return `₹${amount}`;
  }

  logout(): void {
    this.authService.logout();
  }
}

