import { Chapter, NPC, NPCAppearance, PCGoal, ResolvedSceneNode, SceneEdge, SceneNodeStatus, resolveLayered } from '@shared/domain';

export interface FlowLaneSummary {
  key: string;
  label: string;
  count: number;
}

export interface ConnectedSceneEntry {
  edgeId: string;
  direction: 'incoming' | 'outgoing';
  label: string;
  scene: ResolvedSceneNode;
}

export interface LinkedNpcEntry {
  npc: NPC;
  appearance?: NPCAppearance;
  summary: string;
}

const SEARCH_TEXT_SEPARATOR = ' ';
const DEFAULT_LANE_KEY = 'core';
const FALLBACK_LANE_LABEL = 'Core';
const FALLBACK_SCENE_FOCUS = 'No focus has been written for this node yet.';

export const SCENE_KIND_LABELS: Record<ResolvedSceneNode['sceneKind'], string> = {
  social: 'Social',
  investigation: 'Investigation',
  combat: 'Combat',
  endeavor: 'Endeavor',
  transition: 'Transition',
};

export const SCENE_STATUS_LABELS: Record<SceneNodeStatus, string> = {
  locked: 'Locked',
  available: 'Available',
  active: 'In play',
  completed: 'Visited',
  skipped: 'Skipped',
};

export const FLOW_NODE_CLASSIFICATION_LABELS: Record<ResolvedSceneNode['resolvedPlanning']['classification'], string> = {
  critical: 'Critical',
  optional: 'Optional',
  hub: 'Hub',
};

export const FLOW_NODE_READINESS_LABELS: Record<ResolvedSceneNode['resolvedPlanning']['readiness'], string> = {
  rough: 'Rough',
  draft: 'Draft',
  ready: 'Ready',
};

export const SCENE_STATUS_MUTATION_ORDER: Array<Extract<SceneNodeStatus, 'available' | 'active' | 'completed' | 'skipped'>> = [
  'available',
  'active',
  'completed',
  'skipped',
];

function formatLaneLabel(laneKey: string): string {
  if (laneKey === DEFAULT_LANE_KEY) {
    return FALLBACK_LANE_LABEL;
  }

  return laneKey
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function buildFlowLaneSummaries(nodes: ResolvedSceneNode[]): FlowLaneSummary[] {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    const key = node.board.lane ?? DEFAULT_LANE_KEY;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, label: formatLaneLabel(key), count }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function buildNodeSearchText(node: ResolvedSceneNode): string {
  return [
    node.title,
    node.sceneKind,
    node.resolvedPlanning.classification,
    node.resolvedPlanning.readiness,
    node.resolvedPlanning.focus,
    ...node.tags,
    ...node.resolvedContent.summaryBlocks.map((block) => block.text),
    ...node.resolvedContent.gmBlocks.map((block) => block.text),
  ]
    .join(SEARCH_TEXT_SEPARATOR)
    .toLowerCase();
}

export function buildConnectedSceneEntries(
  scene: ResolvedSceneNode,
  edges: SceneEdge[],
  sceneIndex: Record<string, ResolvedSceneNode>,
): ConnectedSceneEntry[] {
  const entries: ConnectedSceneEntry[] = [];

  for (const edge of edges) {
    if (edge.fromSceneId === scene.id) {
      const nextScene = sceneIndex[edge.toSceneId];
      if (nextScene) {
        entries.push({
          edgeId: edge.id,
          direction: 'outgoing',
          label: edge.label ?? 'Next',
          scene: nextScene,
        });
      }
    }

    if (edge.toSceneId === scene.id) {
      const previousScene = sceneIndex[edge.fromSceneId];
      if (previousScene) {
        entries.push({
          edgeId: `${edge.id}-incoming`,
          direction: 'incoming',
          label: edge.label ?? 'From',
          scene: previousScene,
        });
      }
    }
  }

  return entries;
}

export function buildLinkedNpcEntries(
  scene: ResolvedSceneNode,
  npcs: NPC[],
  appearances: NPCAppearance[],
): LinkedNpcEntry[] {
  const entries: LinkedNpcEntry[] = [];
  for (const appearanceId of scene.linkedNpcAppearanceIds) {
    const appearance = appearances.find((entry) => entry.id === appearanceId);
    if (!appearance) {
      continue;
    }

    const npc = npcs.find((entry) => entry.id === appearance.npcId);
    if (!npc) {
      continue;
    }

    const resolved = resolveLayered(npc.content);
    entries.push({
      npc,
      appearance,
      summary:
        appearance.notes[0]?.text ??
        resolved.canonicalSummary[0]?.text ??
        resolved.privateTruth[0]?.text ??
        'No NPC summary yet.',
    });
  }
  return entries;
}

export function isGoalLinkedToScene(goal: PCGoal, scene: ResolvedSceneNode): boolean {
  return scene.linkedGoalIds.includes(goal.id) || goal.triggerSceneIds.includes(scene.id);
}

export function sceneGridColumn(node: ResolvedSceneNode): string {
  return String(node.board.x + 1);
}

export function sceneGridRow(node: ResolvedSceneNode): string {
  return String(node.board.y + 1);
}

export function sceneProgressLabel(scene: ResolvedSceneNode, chapter: Chapter): string {
  if (chapter.defaultStartSceneId === scene.id) {
    return 'Start';
  }

  return chapter.requiredBeatSceneIds.includes(scene.id) ? 'Main beat' : 'Branch';
}

export function sceneFocusText(scene: ResolvedSceneNode): string {
  return scene.resolvedPlanning.focus || FALLBACK_SCENE_FOCUS;
}
