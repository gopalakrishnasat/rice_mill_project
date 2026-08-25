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
      .pipe(map((res) => (res.data || []).map(this.normalizeInvoice)));
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

  downloadPdfStream(id: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/pdf`, {
      responseType: 'blob',
    });
  }

  private normalizeInvoice(i: any): IInvoice {
    return {
      ...i,
      id: i.id || i._id,
    };
  }
}
