import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  IProduct,
  CreateProductDto,
  ApiResponse,
} from '@rice-mill-project/shared-types';

@Injectable({
  providedIn: 'root',
})
export class ProductsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/products';

  getProducts(): Observable<IProduct[]> {
    return this.http
      .get<ApiResponse<IProduct[]>>(this.apiUrl)
      .pipe(map((res) => (res.data || []).map(this.normalizeProduct)));
  }

  createProduct(dto: CreateProductDto): Observable<IProduct> {
    return this.http
      .post<ApiResponse<IProduct>>(this.apiUrl, dto)
      .pipe(map((res) => this.normalizeProduct(res.data!)));
  }

  private normalizeProduct(p: any): IProduct {
    return {
      ...p,
      id: p.id || p._id,
    };
  }
}
