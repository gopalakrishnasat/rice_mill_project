import { Component, OnInit, signal, inject, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { InvoicesService } from '../../core/services/invoices.service';
import { PdfExportService } from '../../core/services/pdf-export.service';
import { IInvoice } from '@rice-mill-project/shared-types';

import { SnackbarService } from '../../core/services/snackbar.service';

@Component({
  selector: 'app-invoice-print',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './invoice-print.component.html',
  styleUrls: ['./invoice-print.component.scss'],
})
export class InvoicePrintComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly invoicesService = inject(InvoicesService);
  private readonly pdfExportService = inject(PdfExportService);
  private readonly snackbar = inject(SnackbarService);

  @ViewChild('invoiceSheet') invoiceSheetRef!: ElementRef<HTMLElement>;

  readonly invoice = signal<IInvoice | null>(null);
  readonly isLoading = signal<boolean>(true);
  readonly isGeneratingPdf = signal<boolean>(false);

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.loadInvoice(id);
      }
    });
  }

  loadInvoice(id: string): void {
    this.isLoading.set(true);
    this.invoicesService.getInvoiceById(id).subscribe({
      next: (inv) => {
        this.invoice.set(inv);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  triggerPrint(): void {
    window.print();
  }

  downloadPdf(): void {
    const inv = this.invoice();
    if (!inv) return;

    this.isGeneratingPdf.set(true);
    this.invoicesService.downloadInvoiceDirectly(inv.id, inv.invoiceNumber);

    setTimeout(() => {
      this.isGeneratingPdf.set(false);
      this.snackbar.success(`Tax Invoice PDF downloaded successfully: Invoice_${inv.invoiceNumber}.pdf`);
    }, 800);
  }

  goBack(): void {
    this.router.navigate(['/invoices']);
  }
}
