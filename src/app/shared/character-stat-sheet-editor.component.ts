import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import {
  CharacterAttributeKey,
  CharacterDefenseKey,
  CharacterDerivedKey,
  CharacterExpertiseCategory,
  CharacterResourceKey,
  CharacterStatSheet,
  computeCharacterStatSheet,
  createEmptyCharacterStatSheet,
  normalizeCharacterStatSheet,
} from '@shared/domain';
import { createId } from '../core/default-data';
import {
  CharacterStatSheetEditorActions,
  cloneNormalizedStatSheet,
  highlightsForAttribute,
  highlightsForSkill,
  nextSteppedValue,
  StatHighlightToken,
} from './character-stat-sheet-editor.helpers';
import { EnemyStatBlockEditorComponent } from './enemy-stat-block-editor.component';
import { PartyStatSheetEditorComponent } from './party-stat-sheet-editor.component';

const ZERO = 0;
const SKILL_RANK_MINIMUM = 0;
const SKILL_RANK_MAXIMUM = 5;
const RESOURCE_MINIMUM = 0;
const ATTRIBUTE_MINIMUM = 0;
const DEFLECT_MINIMUM = 0;
const HIGHLIGHT_DURATION_MS = 950;
const EMPTY_HIGHLIGHTS = new Set<StatHighlightToken>();
const EXPERTISE_ID_PREFIX = 'expertise';

@Component({
  selector: 'app-character-stat-sheet-editor',
  imports: [PartyStatSheetEditorComponent, EnemyStatBlockEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (mode() === 'party') {
      <app-party-stat-sheet-editor
        [stats]="normalizedStats()"
        [computedStats]="computedStats()"
        [actions]="editorActions"
        [highlightedTokens]="highlightedTokens()" />
    } @else {
      <app-enemy-stat-block-editor
        [stats]="normalizedStats()"
        [computedStats]="computedStats()"
        [actions]="editorActions"
        [highlightedTokens]="highlightedTokens()" />
    }
  `,
})
export class CharacterStatSheetEditorComponent {
  readonly stats = input<CharacterStatSheet>(createEmptyCharacterStatSheet());
  readonly mode = input<'party' | 'enemy'>('party');
  readonly statsChange = output<CharacterStatSheet>();

  private readonly destroyRef = inject(DestroyRef);
  readonly normalizedStats = computed(() => normalizeCharacterStatSheet(this.stats()));
  readonly computedStats = computed(() => computeCharacterStatSheet(this.normalizedStats()));
  readonly highlightedTokens = signal<ReadonlySet<StatHighlightToken>>(EMPTY_HIGHLIGHTS);

  private highlightTimeoutId: ReturnType<typeof setTimeout> | null = null;

  readonly editorActions: CharacterStatSheetEditorActions = {
    stepAttribute: (key, delta) => this.stepAttributeAndHighlight(key, delta),
    setSkillRank: (key, value) => this.setSkillRankAndHighlight(key, value),
    stepResourceBonus: (key, delta) => this.stepResourceBonus(key, delta),
    stepResourceOverride: (key, delta) => this.stepResourceOverride(key, delta),
    stepDefenseBonus: (key, delta) => this.stepDefenseBonus(key, delta),
    stepDerivedNumber: (key, delta) => this.stepDerivedNumber(key, delta),
    updateDerivedOverride: (key, value) => this.updateDerivedOverride(key, value),
    addExpertise: () => this.addExpertise(),
    updateExpertiseName: (index, value) => this.updateExpertiseName(index, value),
    updateExpertiseCategory: (index, category) => this.updateExpertiseCategory(index, category),
    removeExpertise: (index) => this.removeExpertise(index),
  };

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.highlightTimeoutId !== null) {
        clearTimeout(this.highlightTimeoutId);
      }
    });
  }

  private stepAttributeAndHighlight(key: CharacterAttributeKey, delta: number): void {
    if (delta === ZERO) {
      return;
    }
    this.setHighlights(highlightsForAttribute(key));
    this.stepAttribute(key, delta);
  }

  private setSkillRankAndHighlight(key: string, value: number): void {
    if ((this.normalizedStats().skillRanks[key] ?? ZERO) === value) {
      return;
    }
    this.setHighlights(highlightsForSkill(key));
    this.setSkillRank(key, value);
  }

  private stepAttribute(key: CharacterAttributeKey, delta: number): void {
    this.emitStats((next) => {
      next.attributeScores[key] = nextSteppedValue(next.attributeScores[key] ?? ZERO, delta, ATTRIBUTE_MINIMUM);
    });
  }

  private setSkillRank(key: string, value: number): void {
    this.emitStats((next) => {
      const clamped = Math.min(SKILL_RANK_MAXIMUM, Math.max(SKILL_RANK_MINIMUM, value));
      if (clamped === ZERO) {
        delete next.skillRanks[key];
        return;
      }
      next.skillRanks[key] = clamped;
    });
  }

  private stepResourceBonus(key: CharacterResourceKey, delta: number): void {
    this.emitStats((next) => {
      const current = next.resourceBonuses[key] ?? ZERO;
      const updated = current + delta;
      if (updated === ZERO) {
        delete next.resourceBonuses[key];
        return;
      }
      next.resourceBonuses[key] = updated;
    });
  }

  private stepResourceOverride(key: CharacterResourceKey, delta: number): void {
    this.emitStats((next) => {
      const fallback = this.computedStats().resources[key];
      const current = next.resourceOverrides[key] ?? fallback;
      const updated = nextSteppedValue(current, delta, RESOURCE_MINIMUM);
      if (updated === fallback) {
        delete next.resourceOverrides[key];
        return;
      }
      next.resourceOverrides[key] = updated;
    });
  }

  private stepDefenseBonus(key: CharacterDefenseKey, delta: number): void {
    this.emitStats((next) => {
      const current = next.defenseBonuses[key] ?? ZERO;
      const updated = current + delta;
      if (updated === ZERO) {
        delete next.defenseBonuses[key];
        return;
      }
      next.defenseBonuses[key] = updated;
    });
  }

  private stepDerivedNumber(key: CharacterDerivedKey, delta: number): void {
    this.emitStats((next) => {
      const currentValue = next.derivedOverrides[key];
      const numericCurrent =
        typeof currentValue === 'number'
          ? currentValue
          : typeof this.computedStats().derived[key] === 'number'
            ? (this.computedStats().derived[key] as number)
            : ZERO;
      const updated = nextSteppedValue(numericCurrent, delta, key === 'deflect' ? DEFLECT_MINIMUM : undefined);
      if ((key === 'deflect' && updated === ZERO) || updated === numericCurrent) {
        if (key === 'deflect' && updated === ZERO) {
          delete next.derivedOverrides[key];
        }
        return;
      }
      next.derivedOverrides[key] = updated;
    });
  }

  private updateDerivedOverride(key: CharacterDerivedKey, value: string): void {
    this.emitStats((next) => {
      const trimmed = value.trim();
      if (!trimmed) {
        delete next.derivedOverrides[key];
        return;
      }
      const parsed = Number(trimmed);
      next.derivedOverrides[key] = Number.isFinite(parsed) ? parsed : trimmed;
    });
  }

  private addExpertise(): void {
    console.log('Adding expertise');
    this.emitStats((next) => {
      next.expertises = [
        ...next.expertises,
        {
          id: createId(EXPERTISE_ID_PREFIX),
          name: '',
          category: 'utility',
        },
      ];
    });
  }

  private updateExpertiseName(index: number, value: string): void {
    this.emitStats((next) => {
      next.expertises = next.expertises.map((expertise, currentIndex) =>
        currentIndex === index ? { ...expertise, name: value } : expertise,
      );
    });
  }

  private updateExpertiseCategory(index: number, category: CharacterExpertiseCategory): void {
    this.emitStats((next) => {
      next.expertises = next.expertises.map((expertise, currentIndex) =>
        currentIndex === index ? { ...expertise, category } : expertise,
      );
    });
  }

  private removeExpertise(index: number): void {
    this.emitStats((next) => {
      next.expertises = next.expertises.filter((_, currentIndex) => currentIndex !== index);
    });
  }

  private emitStats(mutator: (next: CharacterStatSheet) => void): void {
    const next = cloneNormalizedStatSheet(this.normalizedStats());
    mutator(next);
    this.statsChange.emit(normalizeCharacterStatSheet(next));
  }

  private setHighlights(tokens: ReadonlySet<StatHighlightToken>): void {
    this.highlightedTokens.set(tokens);
    if (this.highlightTimeoutId !== null) {
      clearTimeout(this.highlightTimeoutId);
    }
    this.highlightTimeoutId = setTimeout(() => {
      this.highlightedTokens.set(EMPTY_HIGHLIGHTS);
      this.highlightTimeoutId = null;
    }, HIGHLIGHT_DURATION_MS);
  }
}
