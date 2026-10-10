import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  IProduct,
  CreateProductDto,
  UpdateProductDto,
  ApiResponse,
} from '@rice-mill-project/shared-types';

@Injectable({
  providedIn: 'root',
})
export class ProductsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/products';

  getProducts(all = false): Observable<IProduct[]> {
    let params = new HttpParams();
    if (all) {
      params = params.set('all', 'true');
    }
    return this.http
      .get<ApiResponse<IProduct[]>>(this.apiUrl, { params })
      .pipe(map((res) => (res.data || []).map(this.normalizeProduct)));
  }

  getProductById(id: string): Observable<IProduct> {
    return this.http
      .get<ApiResponse<IProduct>>(`${this.apiUrl}/${id}`)
      .pipe(map((res) => this.normalizeProduct(res.data!)));
  }

  createProduct(dto: CreateProductDto): Observable<IProduct> {
    return this.http
      .post<ApiResponse<IProduct>>(this.apiUrl, dto)
      .pipe(map((res) => this.normalizeProduct(res.data!)));
  }

  updateProduct(id: string, dto: UpdateProductDto): Observable<IProduct> {
    return this.http
      .put<ApiResponse<IProduct>>(`${this.apiUrl}/${id}`, dto)
      .pipe(map((res) => this.normalizeProduct(res.data!)));
  }

  toggleProductStatus(id: string): Observable<IProduct> {
    return this.http
      .patch<ApiResponse<IProduct>>(`${this.apiUrl}/${id}/toggle`, {})
      .pipe(map((res) => this.normalizeProduct(res.data!)));
  }

  private normalizeProduct(p: any): IProduct {
    return {
      ...p,
      id: p.id || p._id,
    };
  }
}
