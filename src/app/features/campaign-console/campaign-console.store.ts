import { Injectable, signal } from '@angular/core';
import {
  Campaign,
  CampaignConsoleData,
  ConditionMutationInput,
  DiceRollInput,
  FavorAdjustmentInput,
  QuickNoteInput,
  ResourceAdjustmentInput,
  SceneStateMutationInput,
} from '@shared/domain';
import { ApiService } from '../../core/api.service';

@Injectable({
  providedIn: 'root',
})
export class CampaignConsoleStore {
  readonly campaigns = signal<Campaign[]>([]);
  readonly consoleData = signal<CampaignConsoleData | null>(null);
  readonly loading = signal(false);

  constructor(private readonly api: ApiService) {}

  async loadCampaigns(): Promise<Campaign[]> {
    const campaigns = await this.api.get<Campaign[]>('/api/campaigns');
    this.campaigns.set(campaigns);
    return campaigns;
  }

  async loadConsole(campaignId: string): Promise<CampaignConsoleData> {
    this.loading.set(true);
    try {
      const data = await this.api.get<CampaignConsoleData>(`/api/campaigns/${campaignId}/console`);
      this.consoleData.set(data);
      return data;
    } finally {
      this.loading.set(false);
    }
  }

  updateSceneState(campaignId: string, input: SceneStateMutationInput): Promise<CampaignConsoleData> {
    return this.mutate(this.api.patch<CampaignConsoleData>(`/api/campaigns/${campaignId}/scenes/state`, input));
  }

  addQuickNote(campaignId: string, input: QuickNoteInput): Promise<CampaignConsoleData> {
    return this.mutate(this.api.post<CampaignConsoleData>(`/api/campaigns/${campaignId}/runtime/notes`, input));
  }

  adjustFavor(campaignId: string, input: FavorAdjustmentInput): Promise<CampaignConsoleData> {
    return this.mutate(this.api.post<CampaignConsoleData>(`/api/campaigns/${campaignId}/runtime/favors`, input));
  }

  adjustResource(campaignId: string, input: ResourceAdjustmentInput): Promise<CampaignConsoleData> {
    return this.mutate(this.api.post<CampaignConsoleData>(`/api/campaigns/${campaignId}/runtime/resources`, input));
  }

  mutateCondition(campaignId: string, input: ConditionMutationInput): Promise<CampaignConsoleData> {
    return this.mutate(this.api.post<CampaignConsoleData>(`/api/campaigns/${campaignId}/runtime/conditions`, input));
  }

  logDiceRoll(campaignId: string, input: DiceRollInput): Promise<CampaignConsoleData> {
    return this.mutate(this.api.post<CampaignConsoleData>(`/api/campaigns/${campaignId}/runtime/dice-rolls`, input));
  }

  private async mutate(request: Promise<CampaignConsoleData>): Promise<CampaignConsoleData> {
    this.loading.set(true);
    try {
      const data = await request;
      this.consoleData.set(data);
      return data;
    } finally {
      this.loading.set(false);
    }
  }
}
