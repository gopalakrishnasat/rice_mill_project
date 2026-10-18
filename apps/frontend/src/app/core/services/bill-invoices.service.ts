import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  IBillInvoice,
  CreateBillInvoiceDto,
  UpdateBillInvoiceDto,
  ApiResponse,
} from '@rice-mill-project/shared-types';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class BillInvoicesService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly apiUrl = '/api/bill-invoices';

  getNextBillNumber(): Observable<string> {
    return this.http
      .get<ApiResponse<{ nextBillNumber: string }>>(`${this.apiUrl}/next-number`)
      .pipe(map((res) => res.data?.nextBillNumber || 'BILL-2627-0001'));
  }

  getBills(params?: {
    search?: string;
    customerId?: string;
    startDate?: string;
    endDate?: string;
  }): Observable<IBillInvoice[]> {
    let httpParams = new HttpParams();
    if (params?.search && params.search.trim()) {
      httpParams = httpParams.set('search', params.search.trim());
    }
    if (params?.customerId && params.customerId.trim()) {
      httpParams = httpParams.set('customerId', params.customerId.trim());
    }
    if (params?.startDate && params.startDate.trim()) {
      httpParams = httpParams.set('startDate', params.startDate.trim());
    }
    if (params?.endDate && params.endDate.trim()) {
      httpParams = httpParams.set('endDate', params.endDate.trim());
    }

    return this.http
      .get<ApiResponse<IBillInvoice[]>>(this.apiUrl, { params: httpParams })
      .pipe(map((res) => res.data || []));
  }

  getBillById(id: string): Observable<IBillInvoice> {
    return this.http
      .get<ApiResponse<IBillInvoice>>(`${this.apiUrl}/${id}`)
      .pipe(map((res) => res.data!));
  }

  createBill(dto: CreateBillInvoiceDto): Observable<IBillInvoice> {
    return this.http
      .post<ApiResponse<IBillInvoice>>(this.apiUrl, dto)
      .pipe(map((res) => res.data!));
  }

  updateBill(id: string, dto: UpdateBillInvoiceDto): Observable<IBillInvoice> {
    return this.http
      .put<ApiResponse<IBillInvoice>>(`${this.apiUrl}/${id}`, dto)
      .pipe(map((res) => res.data!));
  }

  deleteBill(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/${id}`);
  }

  getBillDownloadUrl(id: string): string {
    const token =
      this.authService.getToken() ||
      localStorage.getItem('rice_mill_token') ||
      sessionStorage.getItem('rice_mill_token') ||
      '';
    return `${this.apiUrl}/${id}/pdf${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  }

  getBillDownloadFilename(billNumber?: string): string {
    const cleanNum = (billNumber || 'BILL').replace(/[^a-zA-Z0-9_-]/g, '_');
    return `Bill_Invoice_${cleanNum}.pdf`;
  }

  downloadBillDirectly(id: string, billNumber?: string): Observable<boolean> {
    const filename = this.getBillDownloadFilename(billNumber);
    const directDownloadUrl = this.getBillDownloadUrl(id);

    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = directDownloadUrl;
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
    }, 1500);

    return of(true);
  }
}
