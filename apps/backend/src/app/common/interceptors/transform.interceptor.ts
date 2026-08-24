import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '@rice-mill-project/shared-types';

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // If already structured as an ApiResponse, pass through
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        let message = 'Operation successful';
        let responseData = data;

        if (data && typeof data === 'object' && 'message' in data && 'data' in data) {
          message = data.message;
          responseData = data.data;
        }

        return {
          success: true,
          message,
          data: responseData,
          statusCode: context.switchToHttp().getResponse().statusCode,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
