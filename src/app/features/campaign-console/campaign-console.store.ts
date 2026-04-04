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
  GoalDeleteInput,
  GoalUpsertInput,
  LiveStageState,
  LocationDeleteInput,
  LocationUpsertInput,
  NpcDeleteInput,
  NpcUpsertInput,
  QuickNoteInput,
  ResourceAdjustmentInput,
  RuleEvaluationRequest,
  RuleEvaluationResult,
  SceneEdgeCreateInput,
  SceneEdgeDeleteInput,
  SceneNodeDeleteInput,
  SceneNodeDeletePreview,
  SceneNodeUpsertInput,
  SceneOutcomeSelectionInput,
  SceneStageLinkInput,
  SceneStateMutationInput,
  SimulationResult,
  StageScene,
} from '@shared/domain';
import { ApiService } from '../../core/api.service';
import { AppRuntimeService } from '../../core/app-runtime.service';

@Injectable({
  providedIn: 'root',
})
export class CampaignConsoleStore {
  readonly campaigns = signal<Campaign[]>([]);
  readonly consoleData = signal<CampaignConsoleData | null>(null);
  readonly lastRuleEvaluation = signal<RuleEvaluationResult | null>(null);
  readonly simulationResults = signal<SimulationResult[]>([]);
  readonly analytics = signal<CampaignAnalyticsSummary | null>(null);
  readonly stageScenes = signal<StageScene[]>([]);
  readonly liveStageState = signal<LiveStageState | null>(null);
  readonly stageSessionId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly stageLoading = signal(false);

  constructor(
    private readonly api: ApiService,
    private readonly runtime: AppRuntimeService,
  ) {}

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

  selectSceneOutcome(campaignId: string, input: SceneOutcomeSelectionInput): Promise<CampaignConsoleData> {
    return this.mutate(this.api.post<CampaignConsoleData>(`/api/campaigns/${campaignId}/scenes/outcomes`, input));
  }

  linkSceneStage(campaignId: string, input: SceneStageLinkInput): Promise<CampaignConsoleData> {
    return this.mutate(this.api.patch<CampaignConsoleData>(`/api/campaigns/${campaignId}/scenes/stage-link`, input));
  }

  previewSceneDelete(campaignId: string, sceneNodeId: string): Promise<SceneNodeDeletePreview> {
    return this.api.get<SceneNodeDeletePreview>(`/api/campaigns/${campaignId}/scenes/${sceneNodeId}/delete-preview`);
  }

  upsertSceneNode(campaignId: string, input: SceneNodeUpsertInput): Promise<CampaignConsoleData> {
    return this.mutate(this.api.post<CampaignConsoleData>(`/api/campaigns/${campaignId}/scenes`, input));
  }

  deleteSceneNode(campaignId: string, input: SceneNodeDeleteInput): Promise<CampaignConsoleData> {
    return this.mutate(this.api.delete<CampaignConsoleData>(`/api/campaigns/${campaignId}/scenes`, input));
  }

  createSceneEdge(campaignId: string, input: SceneEdgeCreateInput): Promise<CampaignConsoleData> {
    return this.mutate(this.api.post<CampaignConsoleData>(`/api/campaigns/${campaignId}/scene-edges`, input));
  }

  deleteSceneEdge(campaignId: string, input: SceneEdgeDeleteInput): Promise<CampaignConsoleData> {
    return this.mutate(this.api.delete<CampaignConsoleData>(`/api/campaigns/${campaignId}/scene-edges`, input));
  }

  upsertNpc(campaignId: string, input: NpcUpsertInput): Promise<CampaignConsoleData> {
    return this.mutate(this.api.post<CampaignConsoleData>(`/api/campaigns/${campaignId}/npcs`, input));
  }

  deleteNpc(campaignId: string, input: NpcDeleteInput): Promise<CampaignConsoleData> {
    return this.mutate(this.api.delete<CampaignConsoleData>(`/api/campaigns/${campaignId}/npcs`, input));
  }

  upsertLocation(campaignId: string, input: LocationUpsertInput): Promise<CampaignConsoleData> {
    return this.mutate(this.api.post<CampaignConsoleData>(`/api/campaigns/${campaignId}/locations`, input));
  }

  deleteLocation(campaignId: string, input: LocationDeleteInput): Promise<CampaignConsoleData> {
    return this.mutate(this.api.delete<CampaignConsoleData>(`/api/campaigns/${campaignId}/locations`, input));
  }

  upsertGoal(campaignId: string, input: GoalUpsertInput): Promise<CampaignConsoleData> {
    return this.mutate(this.api.post<CampaignConsoleData>(`/api/campaigns/${campaignId}/goals`, input));
  }

  deleteGoal(campaignId: string, input: GoalDeleteInput): Promise<CampaignConsoleData> {
    return this.mutate(this.api.delete<CampaignConsoleData>(`/api/campaigns/${campaignId}/goals`, input));
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

  async loadStageBridge(sessionId: string): Promise<void> {
    this.stageLoading.set(true);
    try {
      const [stageScenes, liveStageState] = await Promise.all([
        this.api.get<StageScene[]>(`/api/sessions/${sessionId}/stage-scenes`),
        this.api.get<LiveStageState>(`/api/sessions/${sessionId}/live-stage`),
      ]);
      this.stageSessionId.set(sessionId);
      this.stageScenes.set(stageScenes);
      this.liveStageState.set(liveStageState);
      const liveTitle = stageScenes.find((scene) => scene.id === liveStageState.liveSceneId)?.title ?? null;
      this.runtime.resetLiveScene(sessionId, liveTitle);
    } finally {
      this.stageLoading.set(false);
    }
  }

  clearStageBridge(): void {
    this.stageSessionId.set(null);
    this.stageScenes.set([]);
    this.liveStageState.set(null);
  }

  async publishStageScene(sessionId: string, liveSceneId: string | null): Promise<void> {
    const liveStageState = await this.api.put<LiveStageState>(`/api/sessions/${sessionId}/live-stage`, { liveSceneId });
    this.liveStageState.set(liveStageState);
    const liveTitle = this.stageScenes().find((scene) => scene.id === liveSceneId)?.title ?? null;
    this.runtime.resetLiveScene(sessionId, liveTitle);
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
