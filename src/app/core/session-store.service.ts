import { Injectable, signal } from '@angular/core';
import {
  CampaignRoster,
  CreateSessionInput,
  FullAppBackup,
  ImportResult,
  SessionAnalytics,
  SessionBackup,
  SessionDashboard,
  SessionSummary,
  UpdateSessionInput,
} from '@shared/domain';
import { ApiService } from './api.service';
import { AppRuntimeService } from './app-runtime.service';

@Injectable({
  providedIn: 'root',
})
export class SessionStoreService {
  readonly sessions = signal<SessionSummary[]>([]);
  readonly loading = signal(false);
  readonly activeSessionId = signal('');
  constructor(
    private readonly api: ApiService,
    private readonly runtime: AppRuntimeService,
  ) {
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

  async uploadEnemySheet(sessionId: string, file: File): Promise<string> {
    const formData = new FormData();
    formData.append('sessionId', sessionId);
    formData.append('uploadType', 'enemy-sheets');
    formData.append('image', file);
    const response = await this.api.upload<{ imagePath: string }>('/api/uploads/enemy-sheet', formData);
    return response.imagePath;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.api.delete(`/api/sessions/${sessionId}`);
    this.sessions.update((items) => items.filter((entry) => entry.id !== sessionId));
  }

  async getDashboard(sessionId: string): Promise<SessionDashboard> {
    return this.api.get<SessionDashboard>(`/api/sessions/${sessionId}/dashboard`);
  }

  async getCampaignRoster(): Promise<CampaignRoster> {
    return this.api.get<CampaignRoster>('/api/sessions/campaign/roster');
  }

  async updateCampaignRoster(patch: CampaignRoster): Promise<CampaignRoster> {
    const roster = await this.api.patch<CampaignRoster>('/api/sessions/campaign/roster', patch);
    await this.loadSessions();
    return roster;
  }

  async getAnalytics(sessionId: string): Promise<SessionAnalytics> {
    return this.api.get<SessionAnalytics>(`/api/sessions/${sessionId}/analytics`);
  }

  async exportSession(sessionId: string): Promise<SessionBackup> {
    return this.api.get<SessionBackup>(`/api/sessions/${sessionId}/export`);
  }

  async importSession(backup: SessionBackup): Promise<ImportResult> {
    const result = await this.api.post<ImportResult>('/api/sessions/import', backup);
    await this.loadSessions();
    return result;
  }

  async exportFullApp(): Promise<FullAppBackup> {
    return this.api.get<FullAppBackup>('/api/backup/export');
  }

  async importFullApp(backup: FullAppBackup): Promise<ImportResult> {
    const result = await this.api.post<ImportResult>('/api/backup/import', backup);
    await this.loadSessions();
    return result;
  }

  async refreshLiveScene(sessionId: string): Promise<void> {
    const [liveState, scenes] = await Promise.all([
      this.api.get<{ liveSceneId: string | null }>(`/api/sessions/${sessionId}/live-stage`),
      this.api.get<Array<{ id: string; title: string }>>(`/api/sessions/${sessionId}/stage-scenes`),
    ]);
    const liveTitle = scenes.find((scene) => scene.id === liveState.liveSceneId)?.title ?? null;
    this.runtime.resetLiveScene(sessionId, liveTitle);
  }

  setActiveSession(sessionId: string): void {
    this.activeSessionId.set(sessionId);
  }
}
