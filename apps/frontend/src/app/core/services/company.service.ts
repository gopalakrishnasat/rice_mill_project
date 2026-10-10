import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ICompanyDetails,
  UpdateCompanyDetailsDto,
  ApiResponse,
} from '@rice-mill-project/shared-types';

@Injectable({
  providedIn: 'root',
})
export class CompanyService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/company';

  // Reactive signal of current company details for fast and reactive reads across components
  readonly currentCompany = signal<ICompanyDetails | null>(null);

  getCompanyDetails(): Observable<ICompanyDetails> {
    return this.http.get<ApiResponse<ICompanyDetails>>(this.apiUrl).pipe(
      map((res) => this.normalizeCompany(res.data!)),
      tap((details) => this.currentCompany.set(details)),
    );
  }

  updateCompanyDetails(
    dto: UpdateCompanyDetailsDto,
  ): Observable<ICompanyDetails> {
    return this.http.put<ApiResponse<ICompanyDetails>>(this.apiUrl, dto).pipe(
      map((res) => this.normalizeCompany(res.data!)),
      tap((details) => this.currentCompany.set(details)),
    );
  }

  private normalizeCompany(c: any): ICompanyDetails {
    return {
      ...c,
      id: c.id || c._id,
      address: c.address || {
        street: 'Hivare Tarfe Narayangaon, Khodad Road',
        taluka: 'Tal:- Junnar',
        district: 'Dist:- Pune',
        state: 'Maharashtra',
        pincode: '410504',
      },
      bankDetails: c.bankDetails || {
        bankName: 'HDFC Bank Ltd',
        accountNumber: '50200067891234',
        ifsc: 'HDFC0001234',
        branch: 'Narayangaon Branch, Pune',
        upiId: 'slricemill@hdfcbank',
      },
      termsAndConditions: c.termsAndConditions || [
        '1. Goods once sold will not be taken back.',
        '2. Interest @ 18% p.a. will be charged if bill is not paid on due date.',
        '3. Subject to Pune jurisdiction.',
      ],
      jurisdiction: c.jurisdiction || 'Pune',
      devotionalHeaders: c.devotionalHeaders || {
        left: '|| Perantal Mata Prasana ||',
        center: '|| Shree Ganeshya Namha ||',
        right: '|| Shree Mukatai Prasana ||',
      },
    };
  }
}
