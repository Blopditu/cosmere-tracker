import { Injectable, signal } from '@angular/core';
import {
  CampaignAnalyticsSummary,
  Campaign,
  CampaignConsoleData,
  ConditionMutationInput,
  CreateSimulationInput,
  DiceRollInput,
  EndeavorApproachResolutionInput,
  FavorAdjustmentInput,
  QuickNoteInput,
  ResourceAdjustmentInput,
  RuleEvaluationRequest,
  RuleEvaluationResult,
  SceneStateMutationInput,
  SimulationResult,
} from '@shared/domain';
import { ApiService } from '../../core/api.service';

@Injectable({
  providedIn: 'root',
})
export class CampaignConsoleStore {
  readonly campaigns = signal<Campaign[]>([]);
  readonly consoleData = signal<CampaignConsoleData | null>(null);
  readonly lastRuleEvaluation = signal<RuleEvaluationResult | null>(null);
  readonly simulationResults = signal<SimulationResult[]>([]);
  readonly analytics = signal<CampaignAnalyticsSummary | null>(null);
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
      this.analytics.set(data.analytics);
      this.simulationResults.set(data.simulationResults);
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

  async evaluateRules(input: RuleEvaluationRequest): Promise<RuleEvaluationResult> {
    this.loading.set(true);
    try {
      const result = await this.api.post<RuleEvaluationResult>('/api/rules/evaluate', input);
      this.lastRuleEvaluation.set(result);
      return result;
    } finally {
      this.loading.set(false);
    }
  }

  startEndeavorRun(campaignId: string, endeavorId: string): Promise<CampaignConsoleData> {
    return this.mutate(this.api.post<CampaignConsoleData>(`/api/campaigns/${campaignId}/endeavors/${endeavorId}/start`, {}));
  }

  resolveEndeavorApproach(
    campaignId: string,
    runId: string,
    input: EndeavorApproachResolutionInput,
  ): Promise<CampaignConsoleData> {
    return this.mutate(this.api.post<CampaignConsoleData>(`/api/campaigns/${campaignId}/endeavor-runs/${runId}/resolve`, input));
  }

  createSimulation(input: CreateSimulationInput): Promise<import('@shared/domain').SimulationDefinition> {
    return this.api.post<import('@shared/domain').SimulationDefinition>('/api/simulations', input);
  }

  async runSimulation(campaignId: string, simulationDefinitionId: string): Promise<SimulationResult> {
    this.loading.set(true);
    try {
      const result = await this.api.post<SimulationResult>(`/api/simulations/${simulationDefinitionId}/run`, {});
      const results = await this.api.get<SimulationResult[]>(`/api/simulations/${simulationDefinitionId}/results`);
      this.simulationResults.set(results);
      const data = await this.api.get<CampaignConsoleData>(`/api/campaigns/${campaignId}/console`);
      this.consoleData.set(data);
      this.analytics.set(data.analytics);
      return result;
    } finally {
      this.loading.set(false);
    }
  }

  async loadAnalytics(campaignId: string): Promise<CampaignAnalyticsSummary> {
    const analytics = await this.api.get<CampaignAnalyticsSummary>(`/api/analytics/campaigns/${campaignId}`);
    this.analytics.set(analytics);
    return analytics;
  }

  private async mutate(request: Promise<CampaignConsoleData>): Promise<CampaignConsoleData> {
    this.loading.set(true);
    try {
      const data = await request;
      this.consoleData.set(data);
      this.analytics.set(data.analytics);
      this.simulationResults.set(data.simulationResults);
      return data;
    } finally {
      this.loading.set(false);
    }
  }
}
