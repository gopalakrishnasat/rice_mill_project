import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  CreateUserRequestDto,
  IUser,
  UserRole,
} from '../models/auth.models';

@Injectable({
  providedIn: 'root',
})
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = 'http://localhost:3000/api/users';

  getUsers(query?: {
    role?: string;
    isActive?: boolean;
    search?: string;
  }): Observable<ApiResponse<IUser[]>> {
    let params = new HttpParams();
    if (query?.role) {
      params = params.set('role', query.role);
    }
    if (query?.isActive !== undefined) {
      params = params.set('isActive', String(query.isActive));
    }
    if (query?.search) {
      params = params.set('search', query.search);
    }

    return this.http.get<ApiResponse<IUser[]>>(this.API_URL, { params });
  }

  getNextEmployeeId(): Observable<ApiResponse<{ nextEmployeeId: string }>> {
    return this.http.get<ApiResponse<{ nextEmployeeId: string }>>(
      `${this.API_URL}/next-employee-id`,
    );
  }

  createUser(dto: CreateUserRequestDto): Observable<ApiResponse<IUser>> {
    return this.http.post<ApiResponse<IUser>>(this.API_URL, dto);
  }

  updateUserStatus(
    id: string,
    isActive: boolean,
    reason?: string,
  ): Observable<ApiResponse<IUser>> {
    return this.http.patch<ApiResponse<IUser>>(`${this.API_URL}/${id}/status`, {
      isActive,
      reason,
    });
  }

  updateUserRole(id: string, role: UserRole): Observable<ApiResponse<IUser>> {
    return this.http.patch<ApiResponse<IUser>>(`${this.API_URL}/${id}/role`, {
      role,
    });
  }

  resetPassword(id: string, newPassword: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(
      `${this.API_URL}/${id}/reset-password`,
      { newPassword },
    );
  }
}
