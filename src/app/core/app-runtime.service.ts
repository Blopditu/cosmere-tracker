import { Injectable, signal } from '@angular/core';

export type MutationState = 'idle' | 'saving' | 'saved' | 'error';

@Injectable({
  providedIn: 'root',
})
export class AppRuntimeService {
  readonly mutationState = signal<MutationState>('idle');
  readonly lastSavedAt = signal<string | null>(null);
  readonly lastError = signal<string | null>(null);
  readonly liveSceneTitle = signal<string | null>(null);
  readonly liveSessionId = signal<string | null>(null);

  private pendingMutations = 0;

  beginMutation(): void {
    this.pendingMutations += 1;
    this.mutationState.set('saving');
    this.lastError.set(null);
  }

  completeMutation(): void {
    this.pendingMutations = Math.max(0, this.pendingMutations - 1);
    if (this.pendingMutations === 0) {
      this.mutationState.set('saved');
      this.lastSavedAt.set(new Date().toISOString());
    }
  }

  failMutation(message: string): void {
    this.pendingMutations = Math.max(0, this.pendingMutations - 1);
    this.mutationState.set('error');
    this.lastError.set(message);
  }

  resetLiveScene(sessionId: string | null, title: string | null): void {
    this.liveSessionId.set(sessionId);
    this.liveSceneTitle.set(title);
  }
}
