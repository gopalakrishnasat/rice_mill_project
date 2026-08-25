import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ICustomer,
  CreateCustomerDto,
  UpdateCustomerDto,
  ApiResponse,
  ICustomerLedgerEntry,
} from '@rice-mill-project/shared-types';

@Injectable({
  providedIn: 'root',
})
export class CustomersService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/customers';

  getNextCustomerCode(): Observable<string> {
    return this.http
      .get<ApiResponse<{ nextCustomerCode: string }>>(`${this.apiUrl}/next-code`)
      .pipe(map((res) => res.data?.nextCustomerCode || 'CUST-001'));
  }

  getCustomers(params?: {
    search?: string;
    isActive?: boolean;
    hasBalance?: boolean;
  }): Observable<ICustomer[]> {
    return this.http
      .get<ApiResponse<ICustomer[]>>(this.apiUrl, { params: params as any })
      .pipe(map((res) => (res.data || []).map(this.normalizeCustomer)));
  }

  getCustomerById(id: string): Observable<ICustomer> {
    return this.http
      .get<ApiResponse<ICustomer>>(`${this.apiUrl}/${id}`)
      .pipe(map((res) => this.normalizeCustomer(res.data!)));
  }

  createCustomer(dto: CreateCustomerDto): Observable<ICustomer> {
    return this.http
      .post<ApiResponse<ICustomer>>(this.apiUrl, dto)
      .pipe(map((res) => this.normalizeCustomer(res.data!)));
  }

  updateCustomer(id: string, dto: UpdateCustomerDto): Observable<ICustomer> {
    return this.http
      .put<ApiResponse<ICustomer>>(`${this.apiUrl}/${id}`, dto)
      .pipe(map((res) => this.normalizeCustomer(res.data!)));
  }

  toggleCustomerStatus(id: string, isActive: boolean): Observable<ICustomer> {
    return this.http
      .patch<ApiResponse<ICustomer>>(`${this.apiUrl}/${id}/status`, { isActive })
      .pipe(map((res) => this.normalizeCustomer(res.data!)));
  }

  getCustomerLedger(customerId: string): Observable<ICustomerLedgerEntry[]> {
    return this.http
      .get<ApiResponse<ICustomerLedgerEntry[]>>(`/api/invoices/customer/${customerId}/ledger`)
      .pipe(map((res) => res.data || []));
  }

  private normalizeCustomer(c: any): ICustomer {
    return {
      ...c,
      id: c.id || c._id,
    };
  }
}
