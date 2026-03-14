import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AppRuntimeService } from './app-runtime.service';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly runtime = inject(AppRuntimeService);

  get<T>(url: string): Promise<T> {
    return firstValueFrom(this.http.get<T>(url));
  }

  post<T>(url: string, body: unknown): Promise<T> {
    return this.trackMutation(firstValueFrom(this.http.post<T>(url, body)));
  }

  patch<T>(url: string, body: unknown): Promise<T> {
    return this.trackMutation(firstValueFrom(this.http.patch<T>(url, body)));
  }

  put<T>(url: string, body: unknown): Promise<T> {
    return this.trackMutation(firstValueFrom(this.http.put<T>(url, body)));
  }

  delete<T = void>(url: string): Promise<T> {
    return this.trackMutation(firstValueFrom(this.http.delete<T>(url)));
  }

  upload<T>(url: string, formData: FormData): Promise<T> {
    return this.trackMutation(firstValueFrom(this.http.post<T>(url, formData)));
  }

  private async trackMutation<T>(request: Promise<T>): Promise<T> {
    this.runtime.beginMutation();
    try {
      const result = await request;
      this.runtime.completeMutation();
      return result;
    } catch (error) {
      this.runtime.failMutation(this.errorMessage(error));
      throw error;
    }
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return typeof error.error?.message === 'string' ? error.error.message : error.message;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'Request failed.';
  }
}
