import { Component, OnInit, signal, computed, inject, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { CustomersService } from '../../core/services/customers.service';
import { PdfExportService } from '../../core/services/pdf-export.service';
import { SnackbarService } from '../../core/services/snackbar.service';
import { ICustomer, ICustomerLedgerEntry } from '@rice-mill-project/shared-types';
import { convertNumberToIndianWords } from '../../core/utils/number-to-words.util';

export interface IStatementEntry extends ICustomerLedgerEntry {
  statementRunningBalance: number;
}

@Component({
  selector: 'app-customer-statement-print',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './customer-statement-print.component.html',
  styleUrls: ['./customer-statement-print.component.scss'],
})
export class CustomerStatementPrintComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly customersService = inject(CustomersService);
  private readonly pdfExportService = inject(PdfExportService);
  private readonly snackbar = inject(SnackbarService);

  @ViewChild('statementSheet') statementSheetRef!: ElementRef<HTMLElement>;

  readonly customer = signal<ICustomer | null>(null);
  readonly allLedger = signal<ICustomerLedgerEntry[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly isGeneratingPdf = signal<boolean>(false);

  readonly startDate = signal<string>('');
  readonly endDate = signal<string>('');
  readonly activePreset = signal<string>('THIS_FY');
  readonly printGeneratedAt = signal<Date>(new Date());

  readonly openingBalance = computed<number>(() => {
    const startStr = this.startDate();
    const ledger = this.allLedger();
    const cust = this.customer();
    if (!startStr || ledger.length === 0) {
      return cust?.openingBalance || 0;
    }

    const startMs = new Date(`${startStr}T00:00:00`).getTime();
    const priorEntries = ledger.filter((e) => new Date(e.date).getTime() < startMs);

    if (priorEntries.length > 0) {
      return priorEntries[priorEntries.length - 1].runningBalance;
    }

    const hasOpeningInPeriod = ledger.some(
      (e) => e.type === 'OPENING_BALANCE' && new Date(e.date).getTime() >= startMs
    );
    if (!hasOpeningInPeriod && cust?.openingBalance) {
      return cust.openingBalance;
    }
    return 0;
  });

  readonly statementData = computed<{
    entries: IStatementEntry[];
    totalDebit: number;
    totalCredit: number;
    closingBalance: number;
    debitCount: number;
    creditCount: number;
  }>(() => {
    const startStr = this.startDate();
    const endStr = this.endDate();
    const ledger = this.allLedger();
    const openBal = this.openingBalance();

    if (!startStr || !endStr) {
      return {
        entries: [],
        totalDebit: 0,
        totalCredit: 0,
        closingBalance: openBal,
        debitCount: 0,
        creditCount: 0,
      };
    }

    const startMs = new Date(`${startStr}T00:00:00`).getTime();
    const endMs = new Date(`${endStr}T23:59:59.999`).getTime();

    const periodEntries = ledger.filter((e) => {
      const t = new Date(e.date).getTime();
      return t >= startMs && t <= endMs;
    });

    let current = openBal;
    const computedEntries: IStatementEntry[] = periodEntries.map((e) => {
      current = Number((current + (e.debit || 0) - (e.credit || 0)).toFixed(2));
      return {
        ...e,
        statementRunningBalance: current,
      };
    });

    const totalDebit = Number(
      periodEntries.reduce((sum, e) => sum + (e.debit || 0), 0).toFixed(2)
    );
    const totalCredit = Number(
      periodEntries.reduce((sum, e) => sum + (e.credit || 0), 0).toFixed(2)
    );
    const debitCount = periodEntries.filter((e) => (e.debit || 0) > 0).length;
    const creditCount = periodEntries.filter((e) => (e.credit || 0) > 0).length;

    return {
      entries: computedEntries,
      totalDebit,
      totalCredit,
      closingBalance: current,
      debitCount,
      creditCount,
    };
  });

  readonly closingBalanceWords = computed<string>(() => {
    const bal = this.statementData().closingBalance;
    return convertNumberToIndianWords(bal);
  });

  ngOnInit(): void {
    this.initDefaultDates();

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.loadCustomerAndLedger(id);
      }
    });

    this.route.queryParamMap.subscribe((queryParams) => {
      const fromParam = queryParams.get('from');
      const toParam = queryParams.get('to');
      const presetParam = queryParams.get('preset');

      if (fromParam) {
        this.startDate.set(fromParam);
      }
      if (toParam) {
        this.endDate.set(toParam);
      }
      if (presetParam) {
        this.activePreset.set(presetParam);
      }
    });
  }

  private initDefaultDates(): void {
    const now = new Date();
    const currentYear = now.getFullYear();
    const isAfterMarch = now.getMonth() >= 3;
    const fyStartYear = isAfterMarch ? currentYear : currentYear - 1;

    const start = `${fyStartYear}-04-01`;
    const end = this.formatDate(now);

    this.startDate.set(start);
    this.endDate.set(end);
    this.activePreset.set('THIS_FY');
  }

  loadCustomerAndLedger(customerId: string): void {
    this.isLoading.set(true);

    this.customersService.getCustomerById(customerId).subscribe({
      next: (cust) => {
        this.customer.set(cust);

        this.customersService.getCustomerLedger(customerId).subscribe({
          next: (ledger) => {
            this.allLedger.set(ledger || []);
            this.isLoading.set(false);

            // Check autoPrint or downloadPdf query params
            const autoPrint = this.route.snapshot.queryParamMap.get('autoPrint');
            const downloadPdf = this.route.snapshot.queryParamMap.get('downloadPdf');

            if (autoPrint === 'true') {
              setTimeout(() => {
                this.triggerPrint();
              }, 600);
            } else if (downloadPdf === 'true') {
              setTimeout(() => {
                this.downloadPdf();
              }, 600);
            }
          },
          error: () => {
            this.isLoading.set(false);
          },
        });
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  applyPreset(preset: string): void {
    this.activePreset.set(preset);
    const now = new Date();
    const currentYear = now.getFullYear();

    switch (preset) {
      case 'THIS_FY': {
        const isAfterMarch = now.getMonth() >= 3;
        const fyStart = isAfterMarch ? currentYear : currentYear - 1;
        this.startDate.set(`${fyStart}-04-01`);
        this.endDate.set(this.formatDate(now));
        break;
      }
      case 'PREV_FY': {
        const isAfterMarch = now.getMonth() >= 3;
        const prevFyStart = (isAfterMarch ? currentYear : currentYear - 1) - 1;
        this.startDate.set(`${prevFyStart}-04-01`);
        this.endDate.set(`${prevFyStart + 1}-03-31`);
        break;
      }
      case 'THIS_MONTH': {
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        this.startDate.set(`${y}-${m}-01`);
        this.endDate.set(this.formatDate(now));
        break;
      }
      case 'LAST_MONTH': {
        const lastMonthFirst = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthLast = new Date(now.getFullYear(), now.getMonth(), 0);
        this.startDate.set(this.formatDate(lastMonthFirst));
        this.endDate.set(this.formatDate(lastMonthLast));
        break;
      }
      case 'LAST_3_MONTHS': {
        const d = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        this.startDate.set(this.formatDate(d));
        this.endDate.set(this.formatDate(now));
        break;
      }
      case 'LAST_6_MONTHS': {
        const d = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        this.startDate.set(this.formatDate(d));
        this.endDate.set(this.formatDate(now));
        break;
      }
      case 'ALL_TIME': {
        const ledger = this.allLedger();
        if (ledger.length > 0) {
          const firstDate = new Date(ledger[0].date);
          this.startDate.set(this.formatDate(firstDate));
        } else {
          this.startDate.set('2024-01-01');
        }
        this.endDate.set(this.formatDate(now));
        break;
      }
      case 'CUSTOM':
      default:
        break;
    }
  }

  onCustomDateChange(): void {
    this.activePreset.set('CUSTOM');
  }

  triggerPrint(): void {
    window.print();
  }

  downloadPdf(): void {
    const cust = this.customer();
    if (!cust) return;

    this.isGeneratingPdf.set(true);
    const fromStr = this.startDate().replace(/-/g, '');
    const toStr = this.endDate().replace(/-/g, '');
    const filename = `Statement_${cust.customerCode || 'Customer'}_${fromStr}_to_${toStr}.pdf`;

    const token =
      localStorage.getItem('rice_mill_token') ||
      sessionStorage.getItem('rice_mill_token') ||
      '';

    const params = new URLSearchParams();
    if (this.startDate()) params.set('startDate', this.startDate());
    if (this.endDate()) params.set('endDate', this.endDate());
    if (token) params.set('token', token);

    const directDownloadUrl = `/api/invoices/customer/${cust.id}/statement/pdf?${params.toString()}`;

    // Direct HTTP download link with Content-Disposition header from server:
    // This instructs Chrome to use the authentic filename and extension instead of an internal blob UUID.
    const downloadLink = document.createElement('a');
    downloadLink.href = directDownloadUrl;
    downloadLink.setAttribute('download', filename);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    setTimeout(() => {
      this.isGeneratingPdf.set(false);
      this.snackbar.success('Official Account Statement PDF downloaded successfully.');
    }, 600);
  }

  goBack(): void {
    const cust = this.customer();
    if (cust?.id) {
      this.router.navigate(['/customers', cust.id]);
    } else {
      this.router.navigate(['/customers']);
    }
  }

  private formatDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
