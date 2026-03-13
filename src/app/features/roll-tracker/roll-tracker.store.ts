import { Injectable, signal } from '@angular/core';
import { CreateRollInput, RollAnalytics, RollEvent } from '@shared/domain';
import { ApiService } from '../../core/api.service';

@Injectable({
  providedIn: 'root',
})
export class RollTrackerStore {
  readonly rolls = signal<RollEvent[]>([]);
  readonly analytics = signal<RollAnalytics | null>(null);
  readonly loading = signal(false);

  constructor(private readonly api: ApiService) {}

  async load(sessionId: string): Promise<void> {
    this.loading.set(true);
    try {
      const [rolls, analytics] = await Promise.all([
        this.api.get<RollEvent[]>(`/api/sessions/${sessionId}/rolls`),
        this.api.get<RollAnalytics>(`/api/sessions/${sessionId}/rolls/analytics`),
      ]);
      this.rolls.set(rolls);
      this.analytics.set(analytics);
    } finally {
      this.loading.set(false);
    }
  }

  async create(sessionId: string, input: CreateRollInput): Promise<void> {
    await this.api.post(`/api/sessions/${sessionId}/rolls`, input);
    await this.load(sessionId);
  }
}
