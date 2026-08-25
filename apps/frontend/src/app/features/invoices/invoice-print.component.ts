import { Component, OnInit, signal, inject, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { InvoicesService } from '../../core/services/invoices.service';
import { PdfExportService } from '../../core/services/pdf-export.service';
import { IInvoice } from '@rice-mill-project/shared-types';

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
    const filename = `Invoice_${inv.invoiceNumber}.pdf`;

    this.invoicesService.downloadPdfStream(inv.id).subscribe({
      next: (blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
          if (document.body.contains(a)) {
            document.body.removeChild(a);
          }
          URL.revokeObjectURL(blobUrl);
          this.isGeneratingPdf.set(false);
        }, 1000);
      },
      error: async (err) => {
        console.warn('Backend PDF stream failed, using client-side fallback:', err);
        if (this.invoiceSheetRef) {
          try {
            await this.pdfExportService.downloadElementAsPdf(
              this.invoiceSheetRef.nativeElement,
              filename,
            );
          } catch (clientErr) {
            console.error('Client PDF export failed:', clientErr);
          }
        }
        this.isGeneratingPdf.set(false);
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/invoices']);
  }
}
