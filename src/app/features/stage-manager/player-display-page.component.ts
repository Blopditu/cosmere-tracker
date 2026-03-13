import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { interval, startWith } from 'rxjs';
import { LiveStageState, StageScene } from '@shared/domain';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-player-display-page',
  imports: [CommonModule],
  template: `
    <div class="player-display" [style.background-image]="backgroundImage()">
      @if (!backgroundImage()) {
        <div class="player-display-fallback">No scene is live.</div>
      }
    </div>
  `,
})
export class PlayerDisplayPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  readonly sessionId = signal('');
  readonly backgroundImage = signal('');

  constructor() {
    const routeSub = this.route.paramMap.subscribe((params) => {
      const sessionId = params.get('sessionId');
      if (!sessionId) {
        return;
      }
      this.sessionId.set(sessionId);
      const pollSub = interval(1500)
        .pipe(startWith(0))
        .subscribe(() => void this.refresh());
      this.destroyRef.onDestroy(() => pollSub.unsubscribe());
    });
    this.destroyRef.onDestroy(() => routeSub.unsubscribe());
  }

  private async refresh(): Promise<void> {
    const sessionId = this.sessionId();
    if (!sessionId) {
      return;
    }
    const [liveState, scenes] = await Promise.all([
      this.api.get<LiveStageState>(`/api/sessions/${sessionId}/live-stage`),
      this.api.get<StageScene[]>(`/api/sessions/${sessionId}/stage-scenes`),
    ]);
    const liveScene = scenes.find((scene) => scene.id === liveState.liveSceneId);
    this.backgroundImage.set(liveScene?.backgroundImagePath ? `url(${liveScene.backgroundImagePath})` : '');
  }
}
