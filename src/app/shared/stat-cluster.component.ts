import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CharacterAttributeKey, CharacterStatSheet, ComputedCharacterStatSheet } from '@shared/domain';
import {
  attributeMetadataForKey,
  CharacterStatSheetEditorActions,
  defenseHighlightToken,
  defenseLabel,
  StatClusterDefinition,
  StatHighlightToken,
} from './character-stat-sheet-editor.helpers';
import { AttributeControlComponent } from './attribute-control.component';
import { SkillRowComponent } from './skill-row.component';

@Component({
  selector: 'app-stat-cluster',
  imports: [AttributeControlComponent, SkillRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="stat-cluster"
      [class.cluster-physical]="cluster().key === 'physical'"
      [class.cluster-cognitive]="cluster().key === 'cognitive'"
      [class.cluster-spiritual]="cluster().key === 'spiritual'">
      <header class="stat-cluster__header">
        <h3>{{ cluster().label }}</h3>
      </header>

      <div class="stat-cluster__attributes">
        @for (attribute of attributes(); track attribute.key) {
          <app-attribute-control
            [attribute]="attribute"
            [value]="stats().attributeScores[attribute.key]"
            [highlightedTokens]="highlightedTokens()"
            [step]="attributeStepper(attribute.key)" />
        }
      </div>

      <article class="stat-cluster__defense" [class.is-highlighted]="isDefenseHighlighted()">
        <span class="stat-label">{{ defenseLabel(cluster().defenseKey) }}</span>
        <strong>{{ computedStats().defenses[cluster().defenseKey] }}</strong>
        <small>{{ cluster().formulaHint }}</small>
      </article>

      <div class="stat-cluster__skills">
        @for (skill of cluster().skills; track skill.key) {
          <app-skill-row
            [skill]="skill"
            [rank]="stats().skillRanks[skill.key]"
            [modifier]="computedStats().skillModifiers[skill.key]"
            [highlightedTokens]="highlightedTokens()"
            [setRank]="skillSetter(skill.key)" />
        }
      </div>
    </section>
  `,
})
export class StatClusterComponent {
  readonly cluster = input.required<StatClusterDefinition>();
  readonly stats = input.required<CharacterStatSheet>();
  readonly computedStats = input.required<ComputedCharacterStatSheet>();
  readonly actions = input.required<CharacterStatSheetEditorActions>();
  readonly highlightedTokens = input<ReadonlySet<StatHighlightToken>>(new Set<StatHighlightToken>());

  readonly attributes = computed(() => this.cluster().attributeKeys.map((key) => attributeMetadataForKey(key)));

  protected readonly defenseLabel = defenseLabel;

  attributeStepper(attributeKey: CharacterAttributeKey): (delta: number) => void {
    return (delta) => this.actions().stepAttribute(attributeKey, delta);
  }

  skillSetter(skillKey: string): (value: number) => void {
    return (value) => this.actions().setSkillRank(skillKey, value);
  }

  isDefenseHighlighted(): boolean {
    return this.highlightedTokens().has(defenseHighlightToken(this.cluster().defenseKey));
  }
}
