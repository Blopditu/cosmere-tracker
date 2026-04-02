import { Injectable, signal } from '@angular/core';
import {
  CombatRecord,
  CombatSummary,
  CommitCurrentRoundInput,
  CreateActionEventInput,
  CreateCombatInput,
  CreateConditionEventInput,
  CreateFocusEventInput,
  CreateHealthEventInput,
  ReorderCurrentRoundInput,
  UpdateCombatStrikePresetInput,
} from '@shared/domain';
import { ApiService } from '../../core/api.service';

@Injectable({
  providedIn: 'root',
})
export class CombatStore {
  readonly combats = signal<CombatRecord[]>([]);
  readonly combat = signal<CombatRecord | null>(null);
  readonly summary = signal<CombatSummary | null>(null);
  readonly loading = signal(false);

  constructor(private readonly api: ApiService) {}

  private syncCombatRecord(combat: CombatRecord): void {
    this.combat.set(combat);
    this.combats.update((items) => {
      const index = items.findIndex((entry) => entry.id === combat.id);
      if (index === -1) {
        return [combat, ...items];
      }
      const next = [...items];
      next[index] = combat;
      return next;
    });
  }

  async loadForSession(sessionId: string): Promise<void> {
    this.combats.set(await this.api.get<CombatRecord[]>(`/api/sessions/${sessionId}/combats`));
  }

  async create(sessionId: string, input: CreateCombatInput): Promise<CombatRecord> {
    const combat = await this.api.post<CombatRecord>(`/api/sessions/${sessionId}/combats`, input);
    this.combats.update((items) => [combat, ...items]);
    return combat;
  }

  async loadCombat(combatId: string): Promise<void> {
    this.loading.set(true);
    try {
      this.syncCombatRecord(await this.api.get<CombatRecord>(`/api/combats/${combatId}`));
      this.summary.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  async startCombat(combatId: string): Promise<void> {
    this.syncCombatRecord(await this.api.post<CombatRecord>(`/api/combats/${combatId}/start`, {}));
  }

  async finishCombat(combatId: string): Promise<void> {
    this.syncCombatRecord(await this.api.post<CombatRecord>(`/api/combats/${combatId}/finish`, {}));
  }

  async commitCurrentRound(combatId: string, input: CommitCurrentRoundInput): Promise<void> {
    this.syncCombatRecord(await this.api.post<CombatRecord>(`/api/combats/${combatId}/rounds/current/commit`, input));
  }

  async advanceCurrentPhase(combatId: string): Promise<void> {
    this.syncCombatRecord(await this.api.post<CombatRecord>(`/api/combats/${combatId}/rounds/current/advance`, {}));
  }

  async reorderCurrentRound(combatId: string, input: ReorderCurrentRoundInput): Promise<void> {
    this.syncCombatRecord(await this.api.post<CombatRecord>(`/api/combats/${combatId}/rounds/current/reorder`, input));
  }

  async completeTurn(combatId: string, turnId: string): Promise<void> {
    this.syncCombatRecord(await this.api.post<CombatRecord>(`/api/combats/${combatId}/turns/${turnId}/complete`, {}));
  }

  async spendReaction(combatId: string, participantId: string): Promise<void> {
    this.syncCombatRecord(
      await this.api.post<CombatRecord>(`/api/combats/${combatId}/participants/${participantId}/reaction/spend`, {}),
    );
  }

  async updateStrikePreset(combatId: string, participantId: string, input: UpdateCombatStrikePresetInput): Promise<void> {
    this.syncCombatRecord(
      await this.api.patch<CombatRecord>(`/api/combats/${combatId}/participants/${participantId}/strike-preset`, input),
    );
  }

  async logAction(combatId: string, input: CreateActionEventInput): Promise<void> {
    this.syncCombatRecord(await this.api.post<CombatRecord>(`/api/combats/${combatId}/actions`, input));
  }

  async revertAction(combatId: string, actionEventId: string): Promise<void> {
    const result = await this.api.delete<{ combat: CombatRecord }>(`/api/combats/${combatId}/actions/${actionEventId}`);
    this.syncCombatRecord(result.combat);
  }

  async logFocus(combatId: string, input: CreateFocusEventInput): Promise<void> {
    this.syncCombatRecord(await this.api.post<CombatRecord>(`/api/combats/${combatId}/focus-events`, input));
  }

  async logHealth(combatId: string, input: CreateHealthEventInput): Promise<void> {
    this.syncCombatRecord(await this.api.post<CombatRecord>(`/api/combats/${combatId}/health-events`, input));
  }

  async logCondition(combatId: string, input: CreateConditionEventInput): Promise<void> {
    this.syncCombatRecord(await this.api.post<CombatRecord>(`/api/combats/${combatId}/condition-events`, input));
  }

  async loadSummary(combatId: string): Promise<void> {
    this.summary.set(await this.api.get<CombatSummary>(`/api/combats/${combatId}/summary`));
  }
}
