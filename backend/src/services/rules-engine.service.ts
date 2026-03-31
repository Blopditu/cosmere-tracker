import {
  ActionDefinition,
  ChapterState,
  ResolutionHook,
  RuleAdvisory,
  RuleEvaluationRequest,
  RuleEvaluationResult,
  RuleMode,
  RuntimeResourceTarget,
  SceneNode,
  SceneState,
  SessionRun,
  evaluateStateExpression,
} from '@shared/domain';

interface RulesEngineContext {
  ruleMode: RuleMode;
  chapterState: ChapterState;
  sessionRun: SessionRun;
  sceneNodes: SceneNode[];
  sceneStates: SceneState[];
  actionDefinitions: ActionDefinition[];
  resolutionHooks: ResolutionHook[];
  resourceTargets: RuntimeResourceTarget[];
}

function intersects(left: string[], right: string[]): boolean {
  if (!left.length || !right.length) {
    return true;
  }
  return left.some((entry) => right.includes(entry));
}

export class RulesEngineService {
  evaluate(context: RulesEngineContext, request: RuleEvaluationRequest): RuleEvaluationResult {
    const sceneStatuses = Object.fromEntries(
      context.sceneNodes.map((scene) => [scene.id, context.sceneStates.find((state) => state.sceneNodeId === scene.id)?.status ?? 'locked']),
    );
    const action = request.actionKey
      ? context.actionDefinitions.find((definition) => definition.key === request.actionKey)
      : undefined;
    const advisories: RuleAdvisory[] = [];
    const proposedEffects = [...(action?.effects ?? [])];
    let allowed = true;

    if (request.actionKey && !action) {
      advisories.push({
        severity: 'error',
        message: `Unknown action: ${request.actionKey}`,
        blocking: true,
        ruleReferenceIds: [],
      });
      return {
        mode: context.ruleMode,
        allowed: false,
        requiresOverride: context.ruleMode === 'strict',
        advisories,
        proposedEffects,
        matchingHookIds: [],
      };
    }

    for (const expression of action?.preconditions ?? []) {
      if (evaluateStateExpression(expression, sceneStatuses, context.chapterState)) {
        continue;
      }
      allowed = false;
      advisories.push({
        severity: context.ruleMode === 'strict' ? 'error' : 'warning',
        message: `${action?.label ?? 'Action'} does not meet its current preconditions.`,
        blocking: context.ruleMode === 'strict',
        ruleReferenceIds: action?.ruleReferenceIds ?? [],
      });
    }

    if (action?.requiresTarget && !request.target) {
      allowed = false;
      advisories.push({
        severity: context.ruleMode === 'strict' ? 'error' : 'warning',
        message: `${action.label} expects a target.`,
        blocking: context.ruleMode === 'strict',
        ruleReferenceIds: action.ruleReferenceIds,
      });
    }

    if (request.actor && action) {
      const target = context.resourceTargets.find(
        (entry) => `${entry.entity.kind}:${entry.entity.id}` === `${request.actor?.kind}:${request.actor?.id}`,
      );
      if (target) {
        for (const [resourceKey, cost] of Object.entries(action.defaultCosts)) {
          const current = target.resources[resourceKey] ?? 0;
          if (current >= cost) {
            continue;
          }
          allowed = false;
          advisories.push({
            severity: context.ruleMode === 'strict' ? 'error' : 'warning',
            message: `${target.label} lacks ${resourceKey} for ${action.label}.`,
            blocking: context.ruleMode === 'strict',
            ruleReferenceIds: action.ruleReferenceIds,
          });
        }
      }
    }

    const matchingHooks = context.resolutionHooks.filter((hook) => {
      if (hook.when !== request.trigger) {
        return false;
      }
      if (hook.phase && hook.phase !== request.phase) {
        return false;
      }
      const actionTags = request.resolutionTags ?? action?.resolutionTags ?? [];
      if (!intersects(hook.resolutionTags ?? [], actionTags)) {
        return false;
      }
      return hook.conditions.every((expression) => evaluateStateExpression(expression, sceneStatuses, context.chapterState));
    });

    for (const hook of matchingHooks) {
      for (const message of hook.messages) {
        const blocking = context.ruleMode === 'strict' && hook.mode === 'enforce' && message.severity === 'error';
        if (blocking) {
          allowed = false;
        }
        advisories.push({
          severity: message.severity,
          message: message.text,
          blocking,
          ruleReferenceIds: hook.ruleReferenceIds,
        });
      }
      proposedEffects.push(...hook.effects);
    }

    return {
      mode: context.ruleMode,
      allowed,
      requiresOverride: !allowed && context.ruleMode === 'strict',
      advisories,
      proposedEffects,
      action,
      matchingHookIds: matchingHooks.map((hook) => hook.id),
    };
  }

  buildAmbientAdvisories(context: RulesEngineContext): RuleAdvisory[] {
    const sceneStatuses = Object.fromEntries(
      context.sceneNodes.map((scene) => [scene.id, context.sceneStates.find((state) => state.sceneNodeId === scene.id)?.status ?? 'locked']),
    );
    const advisories: RuleAdvisory[] = [];
    for (const hook of context.resolutionHooks) {
      if (hook.when !== 'action.attempt' && hook.when !== 'endeavor.approach.resolve') {
        continue;
      }
      if (!hook.conditions.every((expression) => evaluateStateExpression(expression, sceneStatuses, context.chapterState))) {
        continue;
      }
      for (const message of hook.messages) {
        advisories.push({
          severity: message.severity,
          message: message.text,
          blocking: false,
          ruleReferenceIds: hook.ruleReferenceIds,
        });
      }
    }
    return advisories;
  }
}
