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
  private readonly apiBase = this.resolveApiBase();

  get<T>(url: string): Promise<T> {
    return firstValueFrom(this.http.get<T>(this.buildUrl(url)));
  }

  post<T>(url: string, body: unknown): Promise<T> {
    return this.trackMutation(firstValueFrom(this.http.post<T>(this.buildUrl(url), body)));
  }

  patch<T>(url: string, body: unknown): Promise<T> {
    return this.trackMutation(firstValueFrom(this.http.patch<T>(this.buildUrl(url), body)));
  }

  put<T>(url: string, body: unknown): Promise<T> {
    return this.trackMutation(firstValueFrom(this.http.put<T>(this.buildUrl(url), body)));
  }

  delete<T = void>(url: string, body?: unknown): Promise<T> {
    return this.trackMutation(firstValueFrom(this.http.delete<T>(this.buildUrl(url), body === undefined ? undefined : { body })));
  }

  upload<T>(url: string, formData: FormData): Promise<T> {
    return this.trackMutation(firstValueFrom(this.http.post<T>(this.buildUrl(url), formData)));
  }

  private buildUrl(url: string): string {
    if (!this.apiBase || /^https?:\/\//.test(url)) {
      return url;
    }

    const normalizedBase = this.apiBase.replace(/\/+$/, '');

    if (url === '/api') {
      return normalizedBase;
    }

    if (url.startsWith('/api/')) {
      return `${normalizedBase}${url.slice(4)}`;
    }

    return `${normalizedBase}${url.startsWith('/') ? url : `/${url}`}`;
  }

  private resolveApiBase(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const query = new URLSearchParams(window.location.search);
    const queryValue = query.get('apiBase');
    if (queryValue !== null) {
      const trimmed = queryValue.trim();
      if (trimmed) {
        window.localStorage.setItem('cosmere.apiBase', trimmed);
        return trimmed;
      }

      window.localStorage.removeItem('cosmere.apiBase');
      return null;
    }

    const storedValue = window.localStorage.getItem('cosmere.apiBase')?.trim();
    if (storedValue) {
      return storedValue;
    }

    const globalValue = (window as typeof window & { __COSMERE_API_BASE__?: string }).__COSMERE_API_BASE__?.trim();
    return globalValue || null;
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
