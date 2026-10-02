import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  IInvoice,
  CreateInvoiceDto,
  UpdateInvoiceDto,
  RecordPaymentDto,
  ApiResponse,
  InvoiceStatus,
  PaymentStatus,
} from '@rice-mill-project/shared-types';

@Injectable({
  providedIn: 'root',
})
export class InvoicesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/invoices';

  getNextInvoiceNumber(): Observable<string> {
    return this.http
      .get<ApiResponse<{ nextInvoiceNumber: string }>>(`${this.apiUrl}/next-number`)
      .pipe(map((res) => res.data?.nextInvoiceNumber || 'MU2627-VC-0001'));
  }

  getInvoices(params?: {
    customerId?: string;
    search?: string;
    status?: InvoiceStatus;
    paymentStatus?: PaymentStatus;
  }): Observable<IInvoice[]> {
    return this.http
      .get<ApiResponse<IInvoice[]>>(this.apiUrl, { params: params as any })
      .pipe(map((res) => (res.data || []).map((inv) => this.normalizeInvoice(inv))));
  }

  getInvoiceById(id: string): Observable<IInvoice> {
    return this.http
      .get<ApiResponse<IInvoice>>(`${this.apiUrl}/${id}`)
      .pipe(map((res) => this.normalizeInvoice(res.data!)));
  }

  createInvoice(dto: CreateInvoiceDto): Observable<IInvoice> {
    return this.http
      .post<ApiResponse<IInvoice>>(this.apiUrl, dto)
      .pipe(map((res) => this.normalizeInvoice(res.data!)));
  }

  updateInvoice(id: string, dto: UpdateInvoiceDto): Observable<IInvoice> {
    return this.http
      .put<ApiResponse<IInvoice>>(`${this.apiUrl}/${id}`, dto)
      .pipe(map((res) => this.normalizeInvoice(res.data!)));
  }

  recordPayment(
    invoiceId: string,
    dto: RecordPaymentDto,
  ): Observable<{ invoice: IInvoice; receipt: any }> {
    return this.http
      .post<ApiResponse<{ invoice: any; receipt: any }>>(
        `${this.apiUrl}/${invoiceId}/payments`,
        dto,
      )
      .pipe(
        map((res) => ({
          invoice: this.normalizeInvoice(res.data!.invoice),
          receipt: res.data!.receipt,
        })),
      );
  }

  allocateCustomerPayment(
    customerId: string,
    dto: RecordPaymentDto,
  ): Observable<{
    receipt: any;
    allocations: Array<{
      invoiceId: string;
      invoiceNumber: string;
      allocatedAmount: number;
      previousBalance: number;
      newBalance: number;
      status: string;
    }>;
    unallocatedAdvance: number;
    customer: any;
  }> {
    return this.http
      .post<ApiResponse<any>>(
        `${this.apiUrl}/customer/${customerId}/allocate-payment`,
        dto,
      )
      .pipe(map((res) => res.data!));
  }

  downloadPdfStream(id: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/pdf`, {
      responseType: 'blob',
    });
  }

  downloadInvoiceDirectly(invoiceId: string, invoiceNumber: string): void {
    const token =
      localStorage.getItem('rice_mill_token') ||
      sessionStorage.getItem('rice_mill_token') ||
      '';
    const filename = `Invoice_${invoiceNumber}.pdf`;
    const directDownloadUrl = `${this.apiUrl}/${invoiceId}/pdf${token ? `?token=${encodeURIComponent(token)}` : ''}`;

    const a = document.createElement('a');
    a.href = directDownloadUrl;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
    }, 1000);
  }

  private normalizeInvoice(i: any): IInvoice {
    const defaultAddress = {
      line1: '',
      city: 'Pune',
      state: 'Maharashtra',
      stateCode: '27',
      pincode: '',
    };
    const totalAmount = Number(i.totalAmount ?? 0);
    const paidAmount = Number(i.paidAmount ?? 0);
    const balanceAmount = (i.balanceAmount !== undefined && i.balanceAmount !== null)
      ? Number(i.balanceAmount)
      : Math.max(0, Number((totalAmount - paidAmount).toFixed(2)));

    return {
      ...i,
      id: i.id || i._id,
      totalAmount,
      paidAmount,
      balanceAmount,
      customerSnapshot: {
        customerCode: i.customerSnapshot?.customerCode || '',
        companyName: i.customerSnapshot?.companyName || 'Unknown Buyer',
        contactPerson: i.customerSnapshot?.contactPerson || '',
        mobile: i.customerSnapshot?.mobile || '',
        email: i.customerSnapshot?.email || '',
        gstin: i.customerSnapshot?.gstin || '',
        billingAddress: i.customerSnapshot?.billingAddress || defaultAddress,
      },
    };
  }
}

