import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  CHARACTER_RESOURCE_KEYS,
  CharacterDerivedKey,
  CharacterStatSheet,
  ComputedCharacterStatSheet,
} from '@shared/domain';
import {
  ATTRIBUTE_METADATA,
  CharacterStatSheetEditorActions,
  EXPERTISE_CATEGORIES,
  PARTY_ADVANCED_DERIVED_KEYS,
  PARTY_SKILL_GROUPS,
  attributeAbbreviation,
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
  selector: 'app-party-stat-sheet-editor',
  imports: [CommonModule, SheetNumberStepperComponent, SheetRankPipsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="party-sheet">
      <section class="sheet-summary-band party-sheet-summary">
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

      <div class="party-sheet-grid">
        <section id="party-sheet-attributes" class="sheet-block sheet-block--attributes">
          <div class="sheet-block-header">
            <h4>Attributes</h4>
          </div>
          <div class="party-attribute-grid">
            @for (attribute of attributes; track attribute.key) {
              <article class="sheet-stat-card">
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
        </section>

        <section id="party-sheet-resources" class="sheet-block sheet-block--resources">
          <div class="sheet-block-header">
            <h4>Resources</h4>
          </div>
          <div class="sheet-readout-list">
            @for (resourceKey of resourceKeys; track resourceKey) {
                <article class="sheet-readout-row">
                  <div>
                    <strong>{{ resourceLabel(resourceKey) }}</strong>
                    <small>Maximum</small>
                  </div>
                  <span class="sheet-readout-value">{{ computedStats().resources[resourceKey] }}</span>
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
        </section>

        <section id="party-sheet-skills" class="sheet-block sheet-block--skills">
          <div class="sheet-block-header">
            <h4>Skills</h4>
          </div>
          <div class="party-skill-groups">
            @for (group of skillGroups; track group.facet) {
              <section class="skill-group" [class.physical]="group.facet === 'physical'" [class.cognitive]="group.facet === 'cognitive'" [class.spiritual]="group.facet === 'spiritual'">
                <div class="skill-group-header">
                  <h5>{{ group.label }}</h5>
                </div>
                <div class="skill-group-list">
                  @for (skill of group.skills; track skill.key) {
                    <article class="skill-matrix-row">
                      <div class="skill-matrix-copy">
                        <strong>{{ skill.label }}</strong>
                        <small [attr.title]="attributeLabel(skill.attributeKey)">{{ attributeAbbreviation(skill.attributeKey) }}</small>
                      </div>
                      <app-sheet-rank-pips
                        class="skill-matrix-pips"
                        [value]="skillRank(skill.key)"
                        [maximum]="5"
                        [label]="skill.label"
                        (valueChange)="actions().setSkillRank(skill.key, $event)" />
                      <div class="skill-matrix-modifier" [attr.title]="modifierTitle(skill.key)">
                        <strong>{{ modifierDisplay(skill.key) }}</strong>
                      </div>
                    </article>
                  }
                </div>
              </section>
            }
          </div>
        </section>

        <section id="party-sheet-derived" class="sheet-block sheet-block--derived">
          <div class="sheet-block-header">
            <h4>Derived</h4>
          </div>
          <div class="sheet-derived-list">
            <article class="sheet-derived-row sheet-derived-row--interactive">
              <div>
                <strong>Deflect</strong>
                <small>Manual until items and armor imports land.</small>
              </div>
              <app-sheet-number-stepper
                [value]="deflectValue()"
                [minimum]="0"
                decrementLabel="Lower deflect"
                incrementLabel="Raise deflect"
                (valueChange)="actions().stepDerivedNumber('deflect', $event - deflectValue())" />
            </article>
            @for (derivedKey of nonDeflectDerivedKeys; track derivedKey) {
              <article class="sheet-derived-row">
                <div>
                  <strong>{{ derivedLabel(derivedKey) }}</strong>
                  <small>Current value</small>
                </div>
                <span class="sheet-readout-value">{{ displayDerivedValue(computedStats().derived[derivedKey]) }}</span>
              </article>
            }
          </div>
        </section>

        <section id="party-sheet-expertises" class="sheet-block sheet-block--expertises">
          <div class="sheet-block-header">
            <h4>Expertises</h4>
            <button type="button" class="button-outline micro-button" (click)="actions().addExpertise()">Add expertise</button>
          </div>
          <div class="expertise-list">
            @for (expertise of stats().expertises; track expertise.id; let index = $index) {
              <article class="expertise-card">
                <label class="compact-field">
                  <span>Name</span>
                  <input
                    type="text"
                    [value]="expertise.name"
                    placeholder="History of Alethkar"
                    (input)="actions().updateExpertiseName(index, textValue($event))" />
                </label>
                <div class="expertise-category-row">
                  @for (category of expertiseCategories; track category) {
                    <button
                      type="button"
                      class="compact-chip"
                      [class.active]="expertise.category === category"
                      (click)="actions().updateExpertiseCategory(index, category)">
                      {{ category }}
                    </button>
                  }
                </div>
                <button type="button" class="button-outline button-danger micro-button" (click)="actions().removeExpertise(index)">
                  Remove
                </button>
              </article>
            } @empty {
              <article class="empty-card">No expertises added yet.</article>
            }
          </div>
        </section>
      </div>

      <details id="party-sheet-advanced" class="sheet-advanced-panel">
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
export class PartyStatSheetEditorComponent {
  readonly stats = input.required<CharacterStatSheet>();
  readonly computedStats = input.required<ComputedCharacterStatSheet>();
  readonly actions = input.required<CharacterStatSheetEditorActions>();

  readonly attributes = ATTRIBUTE_METADATA;
  readonly resourceKeys = CHARACTER_RESOURCE_KEYS;
  readonly expertiseCategories = EXPERTISE_CATEGORIES;
  readonly skillGroups = PARTY_SKILL_GROUPS;
  readonly nonDeflectDerivedKeys = PARTY_ADVANCED_DERIVED_KEYS;
  readonly advancedDerivedKeys = PARTY_ADVANCED_DERIVED_KEYS;
  readonly defenses = computed(() => defenseRows(this.computedStats()));
  readonly deflectValue = computed(() => {
    const value = this.computedStats().derived.deflect;
    return typeof value === 'number' ? value : 0;
  });

  protected readonly resourceLabel = resourceLabel;
  protected readonly attributeLabel = attributeLabel;
  protected readonly attributeAbbreviation = attributeAbbreviation;
  protected readonly derivedLabel = derivedLabel;
  protected readonly derivedOverrideValue = derivedOverrideValue;
  protected readonly displayDerivedValue = displayDerivedValue;

  textValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  attributeMeta(facet: string): string {
    return `${facet} attribute`;
  }

  modifierDisplay(skillKey: string): string {
    const value = this.computedStats().skillModifiers[skillKey];
    return value >= 0 ? `+${value}` : `${value}`;
  }

  modifierTitle(skillKey: string): string {
    return `${this.computedStats().skillModifiers[skillKey]} total modifier`;
  }

  skillRank(key: string): number {
    return this.stats().skillRanks[key] || 0;
  }
}
