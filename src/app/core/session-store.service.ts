import { Injectable, signal } from '@angular/core';
import { CreateSessionInput, SessionDashboard, SessionSummary, UpdateSessionInput } from '@shared/domain';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root',
})
export class SessionStoreService {
  readonly sessions = signal<SessionSummary[]>([]);
  readonly loading = signal(false);

  constructor(private readonly api: ApiService) {
    void this.loadSessions();
  }

  async loadSessions(): Promise<void> {
    this.loading.set(true);
    try {
      this.sessions.set(await this.api.get<SessionSummary[]>('/api/sessions'));
    } finally {
      this.loading.set(false);
    }
  }

  async createSession(input: CreateSessionInput): Promise<SessionSummary> {
    const session = await this.api.post<SessionSummary>('/api/sessions', input);
    this.sessions.update((items) => [session, ...items]);
    return session;
  }

  async updateSession(sessionId: string, patch: UpdateSessionInput): Promise<SessionSummary> {
    const session = await this.api.patch<SessionSummary>(`/api/sessions/${sessionId}`, patch);
    this.sessions.update((items) => items.map((entry) => (entry.id === sessionId ? session : entry)));
    return session;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.api.delete(`/api/sessions/${sessionId}`);
    this.sessions.update((items) => items.filter((entry) => entry.id !== sessionId));
  }

  async getDashboard(sessionId: string): Promise<SessionDashboard> {
    return this.api.get<SessionDashboard>(`/api/sessions/${sessionId}/dashboard`);
  }
}
