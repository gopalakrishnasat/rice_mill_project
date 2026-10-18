import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { BillInvoicesService } from '../../core/services/bill-invoices.service';
import { SnackbarService } from '../../core/services/snackbar.service';
import { IBillInvoice } from '@rice-mill-project/shared-types';

@Component({
  selector: 'app-bill-invoice-print',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './bill-invoice-print.component.html',
  styleUrls: ['./bill-invoice-print.component.scss'],
})
export class BillInvoicePrintComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly billInvoicesService = inject(BillInvoicesService);
  private readonly snackbar = inject(SnackbarService);

  readonly bill = signal<IBillInvoice | null>(null);
  readonly isLoading = signal<boolean>(true);

  readonly downloadUrl = computed(() => {
    const b = this.bill();
    if (!b) return '';
    return this.billInvoicesService.getBillDownloadUrl(b.id);
  });

  readonly downloadFilename = computed(() => {
    const b = this.bill();
    if (!b) return 'Bill_Invoice.pdf';
    return this.billInvoicesService.getBillDownloadFilename(b.billNumber);
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.loadBill(id);
      }
    });
  }

  loadBill(id: string): void {
    this.isLoading.set(true);
    this.billInvoicesService.getBillById(id).subscribe({
      next: (data) => {
        this.bill.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load bill invoice:', err);
        this.snackbar.error('Failed to load bill invoice.');
        this.isLoading.set(false);
      },
    });
  }

  triggerPrint(): void {
    window.print();
  }

  onDownloadClick(): void {
    const b = this.bill();
    if (b) {
      this.snackbar.success(`Bill Invoice PDF download started: ${this.downloadFilename()}`);
    }
  }

  goBack(): void {
    this.router.navigate(['/bill-invoices']);
  }
}
