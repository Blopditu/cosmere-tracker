import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  CHARACTER_ATTRIBUTE_METADATA,
  CHARACTER_EXPERTISE_CATEGORIES,
  CHARACTER_SKILL_DEFINITIONS,
  CharacterAttributeKey,
  CharacterDerivedKey,
  CharacterExpertiseCategory,
  CharacterStatSheet,
  computeCharacterStatSheet,
  createEmptyCharacterStatSheet,
  derivedDisplayValue,
  normalizeCharacterStatSheet,
} from '@shared/domain';

const ENEMY_SKILL_KEYS = new Set([
  'athletics',
  'deception',
  'discipline',
  'heavy-weaponry',
  'insight',
  'intimidation',
  'light-weaponry',
  'perception',
  'stealth',
  'survival',
  'thievery',
]);

const PARTY_DERIVED_KEYS: readonly CharacterDerivedKey[] = [
  'deflect',
  'movement-rate',
  'lifting-capacity',
  'carrying-capacity',
  'recovery-die',
  'senses-range',
  'established-connections',
];

const ENEMY_DERIVED_KEYS: readonly CharacterDerivedKey[] = [
  'deflect',
  'movement-rate',
  'senses-range',
];

const DERIVED_OVERRIDE_KEYS = new Set<CharacterDerivedKey>(['deflect']);

@Component({
  selector: 'app-character-stat-sheet-editor',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="stat-sheet-editor inset-panel">
      <div class="card-header compact-card-header">
        <div>
          <p class="eyebrow">{{ mode() === 'party' ? 'Full sheet' : 'Encounter stat block' }}</p>
          <h4>{{ mode() === 'party' ? 'Chapter 3 statistics' : 'Combat-facing statistics' }}</h4>
        </div>
        <div class="session-command-chips">
          <span class="tag-chip">HP {{ computedStats().resources.health }}</span>
          <span class="tag-chip">Focus {{ computedStats().resources.focus }}</span>
          <span class="tag-chip">Investiture {{ computedStats().resources.investiture }}</span>
        </div>
      </div>

      <div class="stat-sheet-layout">
        <section class="stat-sheet-card">
          <p class="eyebrow">Attributes</p>
          <div class="stat-sheet-attribute-grid">
            @for (attribute of attributes; track attribute.key) {
              <label class="compact-field">
                <span>{{ attribute.label }}</span>
                <input
                  type="number"
                  [value]="normalizedStats().attributeScores[attribute.key]"
                  (input)="updateAttribute(attribute.key, $any($event.target).value)" />
              </label>
            }
          </div>
        </section>

        <section class="stat-sheet-card">
          <p class="eyebrow">Resources</p>
          <div class="stat-sheet-resource-grid">
            @for (resourceKey of resourceKeys; track resourceKey) {
              <article class="stat-sheet-resource-row">
                <div>
                  <strong>{{ resourceLabel(resourceKey) }}</strong>
                  <small>Computed max {{ computedStats().resources[resourceKey] }}</small>
                </div>
                <label class="compact-field">
                  <span>Bonus</span>
                  <input
                    type="number"
                    [value]="normalizedStats().resourceBonuses[resourceKey] ?? ''"
                    (input)="updateResourceBonus(resourceKey, $any($event.target).value)" />
                </label>
                <label class="compact-field">
                  <span>Override</span>
                  <input
                    type="number"
                    [value]="normalizedStats().resourceOverrides[resourceKey] ?? ''"
                    (input)="updateResourceOverride(resourceKey, $any($event.target).value)" />
                </label>
              </article>
            }
          </div>
        </section>

        <section class="stat-sheet-card">
          <p class="eyebrow">Defenses</p>
          <div class="stat-sheet-defense-grid">
            @for (defense of defenseRows(); track defense.key) {
              <article class="stat-sheet-defense-row">
                <div>
                  <strong>{{ defense.label }}</strong>
                  <small>Current {{ defense.value }}</small>
                </div>
                <label class="compact-field">
                  <span>Bonus</span>
                  <input
                    type="number"
                    [value]="normalizedStats().defenseBonuses[defense.key] ?? ''"
                    (input)="updateDefenseBonus(defense.key, $any($event.target).value)" />
                </label>
              </article>
            }
          </div>
        </section>

        <section class="stat-sheet-card stat-sheet-card--wide">
          <div class="card-header compact-card-header">
            <div>
              <p class="eyebrow">Skills</p>
              <h4>{{ mode() === 'party' ? 'All base skills' : 'Lean combat-relevant skill ranks' }}</h4>
            </div>
            <span class="pill">{{ displayedSkills().length }}</span>
          </div>
          <div class="stat-sheet-skill-list">
            @for (skill of displayedSkills(); track skill.key) {
              <article class="stat-sheet-skill-row">
                <div>
                  <strong>{{ skill.label }}</strong>
                  <small>{{ attributeLabel(skill.attributeKey) }} · {{ skill.facet }}</small>
                </div>
                <label class="compact-field">
                  <span>Rank</span>
                  <input
                    type="number"
                    [value]="normalizedStats().skillRanks[skill.key]"
                    (input)="updateSkillRank(skill.key, $any($event.target).value)" />
                </label>
                <span class="tag-chip">Mod {{ computedStats().skillModifiers[skill.key] }}</span>
              </article>
            }
          </div>
        </section>

        <section class="stat-sheet-card stat-sheet-card--wide">
          <div class="card-header compact-card-header">
            <div>
              <p class="eyebrow">Derived readouts</p>
              <h4>{{ mode() === 'party' ? 'Movement, carrying, recovery, and more' : 'Movement, senses, and deflect' }}</h4>
            </div>
          </div>
          <div class="stat-sheet-derived-grid">
            @for (derivedKey of displayedDerivedKeys(); track derivedKey) {
              <article class="stat-sheet-derived-row">
                <div>
                  <strong>{{ derivedLabel(derivedKey) }}</strong>
                  <small>{{ derivedDisplayValue(computedStats().derived[derivedKey]) }}</small>
                </div>
                @if (allowDerivedOverride(derivedKey)) {
                  <label class="compact-field">
                    <span>Override</span>
                    <input
                      type="text"
                      [value]="derivedOverrideValue(derivedKey)"
                      (input)="updateDerivedOverride(derivedKey, $any($event.target).value)" />
                  </label>
                }
              </article>
            }
          </div>
        </section>

        @if (mode() === 'party') {
          <section class="stat-sheet-card stat-sheet-card--wide">
            <div class="card-header compact-card-header">
              <div>
                <p class="eyebrow">Expertises</p>
                <h4>Freeform areas of knowledge</h4>
              </div>
              <button type="button" class="button-outline micro-button" (click)="addExpertise()">Add expertise</button>
            </div>
            <div class="stat-sheet-expertise-list">
              @for (expertise of normalizedStats().expertises; track expertise.id; let index = $index) {
                <article class="stat-sheet-expertise-row">
                  <label class="compact-field">
                    <span>Name</span>
                    <input
                      type="text"
                      [value]="expertise.name"
                      (input)="updateExpertiseName(index, $any($event.target).value)" />
                  </label>
                  <label class="compact-field">
                    <span>Category</span>
                    <select
                      [value]="expertise.category"
                      (change)="updateExpertiseCategory(index, $any($event.target).value)">
                      @for (category of expertiseCategories; track category) {
                        <option [value]="category">{{ category }}</option>
                      }
                    </select>
                  </label>
                  <button type="button" class="button-outline button-danger micro-button" (click)="removeExpertise(index)">
                    Remove
                  </button>
                </article>
              } @empty {
                <article class="empty-card">No expertises added yet.</article>
              }
            </div>
          </section>
        }
      </div>
    </section>
  `,
})
export class CharacterStatSheetEditorComponent {
  readonly stats = input<CharacterStatSheet>(createEmptyCharacterStatSheet());
  readonly mode = input<'party' | 'enemy'>('party');
  readonly statsChange = output<CharacterStatSheet>();

  readonly attributes = CHARACTER_ATTRIBUTE_METADATA;
  readonly resourceKeys = ['health', 'focus', 'investiture'] as const;
  readonly expertiseCategories = CHARACTER_EXPERTISE_CATEGORIES;
  readonly normalizedStats = computed(() => normalizeCharacterStatSheet(this.stats()));
  readonly computedStats = computed(() => computeCharacterStatSheet(this.normalizedStats()));
  readonly displayedSkills = computed(() =>
    this.mode() === 'party'
      ? CHARACTER_SKILL_DEFINITIONS
      : CHARACTER_SKILL_DEFINITIONS.filter((skill) => ENEMY_SKILL_KEYS.has(skill.key)),
  );
  readonly displayedDerivedKeys = computed(() => (this.mode() === 'party' ? PARTY_DERIVED_KEYS : ENEMY_DERIVED_KEYS));
  readonly defenseRows = computed(() => [
    { key: 'physical-defense' as const, label: 'Physical Defense', value: this.computedStats().defenses['physical-defense'] },
    { key: 'cognitive-defense' as const, label: 'Cognitive Defense', value: this.computedStats().defenses['cognitive-defense'] },
    { key: 'spiritual-defense' as const, label: 'Spiritual Defense', value: this.computedStats().defenses['spiritual-defense'] },
  ]);

  resourceLabel(key: (typeof this.resourceKeys)[number]): string {
    switch (key) {
      case 'health':
        return 'Health';
      case 'focus':
        return 'Focus';
      case 'investiture':
        return 'Investiture';
    }
  }

  attributeLabel(key: CharacterAttributeKey): string {
    return this.attributes.find((attribute) => attribute.key === key)?.label ?? key;
  }

  derivedLabel(key: CharacterDerivedKey): string {
    switch (key) {
      case 'deflect':
        return 'Deflect';
      case 'movement-rate':
        return 'Movement Rate';
      case 'lifting-capacity':
        return 'Lifting Capacity';
      case 'carrying-capacity':
        return 'Carrying Capacity';
      case 'recovery-die':
        return 'Recovery Die';
      case 'senses-range':
        return 'Senses Range';
      case 'established-connections':
        return 'Established Connections';
    }
  }

  derivedDisplayValue(value: unknown): string {
    return derivedDisplayValue(value as never);
  }

  allowDerivedOverride(key: CharacterDerivedKey): boolean {
    return DERIVED_OVERRIDE_KEYS.has(key);
  }

  derivedOverrideValue(key: CharacterDerivedKey): string {
    const value = this.normalizedStats().derivedOverrides[key];
    return value === undefined ? '' : `${value}`;
  }

  updateAttribute(key: CharacterAttributeKey, value: string): void {
    const parsed = this.parseNumber(value) ?? 0;
    this.emitStats((next) => {
      next.attributeScores[key] = parsed;
    });
  }

  updateSkillRank(key: string, value: string): void {
    const parsed = this.parseNumber(value) ?? 0;
    this.emitStats((next) => {
      next.skillRanks[key] = parsed;
    });
  }

  updateResourceBonus(key: (typeof this.resourceKeys)[number], value: string): void {
    this.emitStats((next) => {
      const parsed = this.parseNumber(value);
      if (parsed === undefined) {
        delete next.resourceBonuses[key];
        return;
      }
      next.resourceBonuses[key] = parsed;
    });
  }

  updateResourceOverride(key: (typeof this.resourceKeys)[number], value: string): void {
    this.emitStats((next) => {
      const parsed = this.parseNumber(value);
      if (parsed === undefined) {
        delete next.resourceOverrides[key];
        return;
      }
      next.resourceOverrides[key] = parsed;
    });
  }

  updateDefenseBonus(key: 'physical-defense' | 'cognitive-defense' | 'spiritual-defense', value: string): void {
    this.emitStats((next) => {
      const parsed = this.parseNumber(value);
      if (parsed === undefined) {
        delete next.defenseBonuses[key];
        return;
      }
      next.defenseBonuses[key] = parsed;
    });
  }

  updateDerivedOverride(key: CharacterDerivedKey, value: string): void {
    this.emitStats((next) => {
      const trimmed = value.trim();
      if (!trimmed) {
        delete next.derivedOverrides[key];
        return;
      }
      const numericValue = this.parseNumber(trimmed);
      next.derivedOverrides[key] = numericValue ?? trimmed;
    });
  }

  addExpertise(): void {
    this.emitStats((next) => {
      next.expertises = [
        ...next.expertises,
        {
          id: crypto.randomUUID(),
          name: '',
          category: 'utility',
        },
      ];
    });
  }

  updateExpertiseName(index: number, value: string): void {
    this.emitStats((next) => {
      next.expertises = next.expertises.map((expertise, currentIndex) =>
        currentIndex === index ? { ...expertise, name: value } : expertise,
      );
    });
  }

  updateExpertiseCategory(index: number, value: string): void {
    this.emitStats((next) => {
      const category = this.isExpertiseCategory(value) ? value : 'utility';
      next.expertises = next.expertises.map((expertise, currentIndex) =>
        currentIndex === index ? { ...expertise, category } : expertise,
      );
    });
  }

  removeExpertise(index: number): void {
    this.emitStats((next) => {
      next.expertises = next.expertises.filter((_, currentIndex) => currentIndex !== index);
    });
  }

  private emitStats(mutator: (next: CharacterStatSheet) => void): void {
    const next = normalizeCharacterStatSheet(structuredClone(this.normalizedStats()));
    mutator(next);
    this.statsChange.emit(normalizeCharacterStatSheet(next));
  }

  private isExpertiseCategory(value: string): value is CharacterExpertiseCategory {
    return this.expertiseCategories.includes(value as CharacterExpertiseCategory);
  }

  private parseNumber(value: string): number | undefined {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
}
