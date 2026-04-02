import { FormControl, FormGroup } from '@angular/forms';
import { ActionKind, CombatParticipantState, CombatPhase, CombatTurn, HitResult } from '@shared/domain';

export type ResolutionMode = 'action' | 'reaction';
export type BattleLaneKey = 'pc' | 'opposition';
export type CombatParticipantTone = 'sapphire' | 'ruby';

export type PhaseGroup = {
  phase: CombatPhase;
  label: string;
  turns: CombatTurn[];
  active: boolean;
};

export type BattleLane = {
  key: BattleLaneKey;
  label: string;
  tone: CombatParticipantTone;
  participants: CombatParticipantState[];
};

export type ChronicleEntry = {
  id: string;
  timestamp: string;
  category: 'action' | 'resource';
  icon: { key: string; label: string; tone?: string };
  result?: { key: string; label: string; tone?: string };
  title: string;
  detail: string;
  note: string;
};

export type ResultChip = {
  value: HitResult;
  label: string;
  tone: 'emerald' | 'ruby' | 'topaz' | 'sapphire' | 'muted';
};

export type ResolutionModeOption = {
  key: ResolutionMode;
  label: string;
  description: string;
};

export type ResolutionActionChoice = {
  id: string;
  label: string;
  actionType: string;
  actionKind: ActionKind;
  presetActionId?: string;
  requiresTarget: boolean;
  requiresRoll: boolean;
  supportsDamage: boolean;
  defaultActionCost: number;
  defaultFocusCost: number;
  defaultModifier?: number;
  defaultDamageFormula?: string;
  tags: string[];
  warnOncePerCombat?: boolean;
  repeatablePerTurn?: boolean;
  variableActionCost?: boolean;
  helperText?: string;
  source: 'catalog' | 'preset';
};

export type ResolutionActionGroup = {
  key: string;
  label: string;
  choices: ResolutionActionChoice[];
};

export type ResolutionTargetChip = {
  id: string;
  name: string;
  tone: CombatParticipantTone;
  healthLabel: string;
  focusLabel: string;
  active: boolean;
};

export type CombatActionForm = FormGroup<{
  actionType: FormControl<string>;
  actionKind: FormControl<ActionKind>;
  presetActionId: FormControl<string>;
  actionCost: FormControl<number>;
  targetId: FormControl<string>;
  rawD20: FormControl<number>;
  modifier: FormControl<number>;
  hitResult: FormControl<HitResult>;
  damageAmount: FormControl<number>;
  focusCost: FormControl<number>;
  opportunityCount: FormControl<number>;
  complicationCount: FormControl<number>;
  damageFormula: FormControl<string>;
  damageBreakdown: FormControl<string>;
  note: FormControl<string>;
}>;

export type CombatConditionForm = FormGroup<{
  conditionName: FormControl<string>;
}>;

export type LoggerStatusTone = 'emerald' | 'ruby' | 'topaz' | 'sapphire' | 'muted';

export type LoggerStatusChip = {
  label: string;
  tone: LoggerStatusTone;
};

export type ResolutionSupportText = {
  actorStatus: string;
  targetStatus: string;
  reactionStatus: string;
};
