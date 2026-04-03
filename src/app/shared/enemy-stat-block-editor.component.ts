import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  CHARACTER_RESOURCE_KEYS,
  CharacterDerivedKey,
  CharacterStatSheet,
  ComputedCharacterStatSheet,
} from '@shared/domain';
import {
  CharacterStatSheetEditorActions,
  derivedHighlightToken,
  ENEMY_ADVANCED_DERIVED_KEYS,
  ENEMY_STAT_CLUSTERS,
  derivedLabel,
  derivedOverrideValue,
  displayDerivedValue,
  StatHighlightToken,
  resourceLabel,
} from './character-stat-sheet-editor.helpers';
import { ResourceBarComponent } from './resource-bar.component';
import { SheetNumberStepperComponent } from './sheet-number-stepper.component';
import { StatClusterComponent } from './stat-cluster.component';

const ENEMY_VISIBLE_DERIVED_KEYS: readonly CharacterDerivedKey[] = ['movement-rate', 'senses-range'];

@Component({
  selector: 'app-enemy-stat-block-editor',
  imports: [CommonModule, ResourceBarComponent, SheetNumberStepperComponent, StatClusterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="enemy-sheet">
      <app-resource-bar [resources]="computedStats().resources" [highlightedTokens]="highlightedTokens()" />

      <div class="stat-cluster-grid">
        @for (cluster of clusters; track cluster.key) {
          <app-stat-cluster
            [cluster]="cluster"
            [stats]="stats()"
            [computedStats]="computedStats()"
            [actions]="actions()"
            [highlightedTokens]="highlightedTokens()" />
        }
      </div>

      <div class="sheet-utility-grid sheet-utility-grid--enemy">
        <section class="sheet-utility-block">
          <div class="sheet-block-header">
            <h4>Combat values</h4>
          </div>
          <div class="sheet-derived-list">
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
            @for (derivedKey of visibleDerivedKeys; track derivedKey) {
              <article class="sheet-derived-row" [class.is-highlighted]="isDerivedHighlighted(derivedKey)">
                <div>
                  <strong>{{ derivedLabel(derivedKey) }}</strong>
                  <small>Current value</small>
                </div>
                <span class="sheet-readout-value">{{ displayDerivedValue(computedStats().derived[derivedKey]) }}</span>
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
              @for (cluster of clusters; track cluster.key) {
                <article class="sheet-advanced-row">
                  <div>
                    <strong>{{ cluster.label }} Defense</strong>
                    <small>Current bonus {{ stats().defenseBonuses[cluster.defenseKey] ?? 0 }}</small>
                  </div>
                  <app-sheet-number-stepper
                    [compact]="true"
                    [value]="stats().defenseBonuses[cluster.defenseKey] ?? 0"
                    [decrementLabel]="'Lower ' + cluster.label + ' defense bonus'"
                    [incrementLabel]="'Raise ' + cluster.label + ' defense bonus'"
                    (valueChange)="actions().stepDefenseBonus(cluster.defenseKey, $event - (stats().defenseBonuses[cluster.defenseKey] ?? 0))" />
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
  readonly highlightedTokens = input<ReadonlySet<StatHighlightToken>>(new Set<StatHighlightToken>());

  readonly resourceKeys = CHARACTER_RESOURCE_KEYS;
  readonly clusters = ENEMY_STAT_CLUSTERS;
  readonly advancedDerivedKeys = ENEMY_ADVANCED_DERIVED_KEYS;
  readonly visibleDerivedKeys = ENEMY_VISIBLE_DERIVED_KEYS;
  readonly deflectValue = computed(() => {
    const value = this.computedStats().derived.deflect;
    return typeof value === 'number' ? value : 0;
  });

  protected readonly resourceLabel = resourceLabel;
  protected readonly derivedLabel = derivedLabel;
  protected readonly derivedOverrideValue = derivedOverrideValue;
  protected readonly displayDerivedValue = displayDerivedValue;

  textValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  isDerivedHighlighted(key: CharacterDerivedKey): boolean {
    return this.highlightedTokens().has(derivedHighlightToken(key));
  }
}
