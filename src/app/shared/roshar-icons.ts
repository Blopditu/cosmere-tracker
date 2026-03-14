import { RosharIconDescriptor } from './roshar-icon.types';

const ACTION_NAME_TO_KEY: Record<string, string> = {
  Strike: 'strike',
  Move: 'move',
  Brace: 'brace',
  Disengage: 'disengage',
  'Gain Advantage': 'gain-advantage',
  'Interact / Use Skill': 'interact-skill',
  Grapple: 'grapple',
  Ready: 'ready',
  Recover: 'recover',
  Shove: 'shove',
  Aid: 'aid',
  Dodge: 'dodge',
  'Reactive Strike': 'reactive-strike',
  'Avoid Danger': 'avoid-danger',
  Custom: 'custom',
};

export function createIcon(
  key: string,
  label: string,
  tone: RosharIconDescriptor['tone'] = 'default',
): RosharIconDescriptor {
  return { key, label, tone };
}

export function actionIcon(actionType: string, label?: string): RosharIconDescriptor {
  return {
    key: ACTION_NAME_TO_KEY[label ?? ''] ?? actionType,
    label: label ?? actionType,
    tone: 'gold',
  };
}

export function resultIcon(result: string | undefined): RosharIconDescriptor {
  switch (result) {
    case 'crit':
    case 'criticalHit':
      return createIcon('crit', 'Critical hit', 'topaz');
    case 'criticalSuccess':
      return createIcon('crit', 'Critical success', 'topaz');
    case 'graze':
      return createIcon('hit', 'Graze', 'topaz');
    case 'hit':
    case 'success':
      return createIcon('hit', 'Success', 'emerald');
    case 'miss':
    case 'failure':
      return createIcon('miss', 'Failure', 'ruby');
    case 'criticalMiss':
      return createIcon('miss', 'Critical miss', 'ruby');
    case 'support':
      return createIcon('support', 'Support', 'sapphire');
    case 'criticalFailure':
      return createIcon('miss', 'Critical failure', 'ruby');
    default:
      return createIcon('chronicle', 'Neutral result', 'muted');
  }
}

export function rollCategoryIcon(category: string): RosharIconDescriptor {
  switch (category) {
    case 'attack':
      return createIcon('strike', 'Attack', 'ruby');
    case 'skill':
      return createIcon('skill', 'Skill', 'sapphire');
    case 'defense':
      return createIcon('defense', 'Defense', 'emerald');
    case 'recovery':
      return createIcon('recover', 'Recovery', 'emerald');
    case 'injury':
      return createIcon('damage', 'Injury', 'ruby');
    default:
      return createIcon('chronicle', 'Generic roll', 'muted');
  }
}
