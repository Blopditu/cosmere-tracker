import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  CHARACTER_RESOURCE_KEYS,
  CharacterStatSheet,
  ComputedCharacterStatSheet,
} from '@shared/domain';
import {
  ATTRIBUTE_METADATA,
  CharacterStatSheetEditorActions,
  ENEMY_ADVANCED_DERIVED_KEYS,
  LEAN_ENEMY_SKILLS,
  attributeLabel,
  defenseRows,
  derivedLabel,
  derivedOverrideValue,
  displayDerivedValue,
  resourceLabel,
} from './character-stat-sheet-editor.helpers';
import { SheetNumberStepperComponent } from './sheet-number-stepper.component';
import { SheetRankPipsComponent } from './sheet-rank-pips.component';

@Component({
  selector: 'app-enemy-stat-block-editor',
  imports: [CommonModule, SheetNumberStepperComponent, SheetRankPipsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="enemy-sheet">
      <section class="sheet-summary-band enemy-sheet-summary">
        @for (resourceKey of resourceKeys; track resourceKey) {
          <article class="sheet-summary-metric" [class.resource-investiture]="resourceKey === 'investiture'">
            <span class="stat-label">{{ resourceLabel(resourceKey) }}</span>
            <strong>{{ computedStats().resources[resourceKey] }}</strong>
          </article>
        }
        @for (defense of defenses(); track defense.key) {
          <article class="sheet-summary-metric defense-metric">
            <span class="stat-label">{{ defense.label }}</span>
            <strong>{{ defense.value }}</strong>
          </article>
        }
      </section>

      <div class="enemy-sheet-grid">
        <section id="enemy-sheet-core" class="sheet-block sheet-block--enemy-core">
          <div class="sheet-block-header">
            <h4>Core stats</h4>
          </div>

          <div class="enemy-attribute-grid">
            @for (attribute of attributes; track attribute.key) {
              <article class="sheet-stat-card sheet-stat-card--compact">
                <div class="sheet-stat-copy">
                  <strong>{{ attribute.label }}</strong>
                  <small>{{ attributeMeta(attribute.facet) }}</small>
                </div>
                <app-sheet-number-stepper
                  [compact]="true"
                  [value]="stats().attributeScores[attribute.key]"
                  [minimum]="0"
                  [decrementLabel]="'Lower ' + attribute.label"
                  [incrementLabel]="'Raise ' + attribute.label"
                  (valueChange)="actions().stepAttribute(attribute.key, $event - stats().attributeScores[attribute.key])" />
              </article>
            }
          </div>

          <div class="sheet-readout-list">
            @for (defense of defenses(); track defense.key) {
              <article class="sheet-readout-row">
                <div>
                  <strong>{{ defense.label }}</strong>
                  <small>Defense</small>
                </div>
                <span class="sheet-readout-value">{{ defense.value }}</span>
              </article>
            }
          </div>

          <div class="enemy-derived-grid">
            <article class="sheet-derived-row sheet-derived-row--interactive">
              <div>
                <strong>Deflect</strong>
                <small>Manual combat stat</small>
              </div>
              <app-sheet-number-stepper
                [value]="deflectValue()"
                [minimum]="0"
                decrementLabel="Lower deflect"
                incrementLabel="Raise deflect"
                (valueChange)="actions().stepDerivedNumber('deflect', $event - deflectValue())" />
            </article>
            <article class="sheet-derived-row">
              <div>
                <strong>Movement Rate</strong>
                <small>Current value</small>
              </div>
              <span class="sheet-readout-value">{{ displayDerivedValue(computedStats().derived['movement-rate']) }}</span>
            </article>
            <article class="sheet-derived-row">
              <div>
                <strong>Senses Range</strong>
                <small>Current value</small>
              </div>
              <span class="sheet-readout-value">{{ displayDerivedValue(computedStats().derived['senses-range']) }}</span>
            </article>
          </div>
        </section>

        <section id="enemy-sheet-skills" class="sheet-block sheet-block--enemy-skills">
          <div class="sheet-block-header">
            <h4>Skills</h4>
          </div>
          <div class="enemy-skill-list">
            @for (skill of displayedSkills; track skill.key) {
              <article class="enemy-skill-row">
                <div class="enemy-skill-copy">
                  <strong>{{ skill.label }}</strong>
                  <small>{{ attributeLabel(skill.attributeKey) }}</small>
                </div>
                <app-sheet-rank-pips
                  [value]="skillRank(skill.key)"
                  [maximum]="5"
                  [label]="skill.label"
                  (valueChange)="actions().setSkillRank(skill.key, $event)" />
                <div class="skill-matrix-modifier">
                  <span class="stat-label">Modifier</span>
                  <strong>{{ computedStats().skillModifiers[skill.key] }}</strong>
                </div>
              </article>
            }
          </div>
        </section>
      </div>

      <details id="enemy-sheet-advanced" class="sheet-advanced-panel">
        <summary>
          <strong>Advanced</strong>
          <span class="compact-chip">Show details</span>
        </summary>
        <div class="sheet-advanced-grid">
          <section class="sheet-advanced-block">
            <p class="eyebrow">Resources</p>
            <div class="sheet-advanced-list">
              @for (resourceKey of resourceKeys; track resourceKey) {
                <article class="sheet-advanced-row">
                  <div>
                    <strong>{{ resourceLabel(resourceKey) }}</strong>
                    <small>Bonus and override</small>
                  </div>
                  <div class="sheet-advanced-controls">
                    <div class="sheet-advanced-control">
                      <span class="stat-label">Bonus</span>
                      <app-sheet-number-stepper
                        [compact]="true"
                        [value]="stats().resourceBonuses[resourceKey] ?? 0"
                        [decrementLabel]="'Lower ' + resourceLabel(resourceKey) + ' bonus'"
                        [incrementLabel]="'Raise ' + resourceLabel(resourceKey) + ' bonus'"
                        (valueChange)="actions().stepResourceBonus(resourceKey, $event - (stats().resourceBonuses[resourceKey] ?? 0))" />
                    </div>
                    <div class="sheet-advanced-control">
                      <span class="stat-label">Override</span>
                      <app-sheet-number-stepper
                        [compact]="true"
                        [value]="stats().resourceOverrides[resourceKey] ?? computedStats().resources[resourceKey]"
                        [minimum]="0"
                        [decrementLabel]="'Lower ' + resourceLabel(resourceKey) + ' override'"
                        [incrementLabel]="'Raise ' + resourceLabel(resourceKey) + ' override'"
                        (valueChange)="actions().stepResourceOverride(resourceKey, $event - (stats().resourceOverrides[resourceKey] ?? computedStats().resources[resourceKey]))" />
                    </div>
                  </div>
                </article>
              }
            </div>
          </section>

          <section class="sheet-advanced-block">
            <p class="eyebrow">Defenses</p>
            <div class="sheet-advanced-list">
              @for (defense of defenses(); track defense.key) {
                <article class="sheet-advanced-row">
                  <div>
                    <strong>{{ defense.label }}</strong>
                    <small>Current bonus {{ stats().defenseBonuses[defense.key] ?? 0 }}</small>
                  </div>
                  <app-sheet-number-stepper
                    [compact]="true"
                    [value]="stats().defenseBonuses[defense.key] ?? 0"
                    [decrementLabel]="'Lower ' + defense.label + ' bonus'"
                    [incrementLabel]="'Raise ' + defense.label + ' bonus'"
                    (valueChange)="actions().stepDefenseBonus(defense.key, $event - (stats().defenseBonuses[defense.key] ?? 0))" />
                </article>
              }
            </div>
          </section>

          <section class="sheet-advanced-block sheet-advanced-block--span">
            <p class="eyebrow">Derived overrides</p>
            <div class="derived-override-grid">
              @for (derivedKey of advancedDerivedKeys; track derivedKey) {
                <label class="compact-field">
                  <span>{{ derivedLabel(derivedKey) }}</span>
                  <input
                    type="text"
                    [value]="derivedOverrideValue(stats(), derivedKey)"
                    [placeholder]="displayDerivedValue(computedStats().derived[derivedKey])"
                    (input)="actions().updateDerivedOverride(derivedKey, textValue($event))" />
                </label>
              }
            </div>
          </section>
        </div>
      </details>
    </section>
  `,
})
export class EnemyStatBlockEditorComponent {
  readonly stats = input.required<CharacterStatSheet>();
  readonly computedStats = input.required<ComputedCharacterStatSheet>();
  readonly actions = input.required<CharacterStatSheetEditorActions>();

  readonly attributes = ATTRIBUTE_METADATA;
  readonly resourceKeys = CHARACTER_RESOURCE_KEYS;
  readonly displayedSkills = LEAN_ENEMY_SKILLS;
  readonly advancedDerivedKeys = ENEMY_ADVANCED_DERIVED_KEYS;
  readonly defenses = computed(() => defenseRows(this.computedStats()));
  readonly deflectValue = computed(() => {
    const value = this.computedStats().derived.deflect;
    return typeof value === 'number' ? value : 0;
  });

  protected readonly resourceLabel = resourceLabel;
  protected readonly attributeLabel = attributeLabel;
  protected readonly derivedLabel = derivedLabel;
  protected readonly derivedOverrideValue = derivedOverrideValue;
  protected readonly displayDerivedValue = displayDerivedValue;

  textValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  attributeMeta(facet: string): string {
    return `${facet} attribute`;
  }

  skillRank(key: string): number {
    return this.stats().skillRanks[key] || 0;
  }
}
