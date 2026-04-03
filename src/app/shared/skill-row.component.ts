import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CharacterSkillDefinition } from '@shared/domain';
import {
  attributeAbbreviation,
  attributeLabel,
  skillHighlightToken,
  StatHighlightToken,
} from './character-stat-sheet-editor.helpers';
import { SheetRankPipsComponent } from './sheet-rank-pips.component';

@Component({
  selector: 'app-skill-row',
  imports: [SheetRankPipsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="cluster-skill-row" [class.is-highlighted]="isHighlighted()">
      <div class="cluster-skill-row__copy">
        <strong>{{ skill().label }}</strong>
        <small [attr.title]="attributeLabel(skill().attributeKey)">{{ attributeAbbreviation(skill().attributeKey) }}</small>
      </div>
      <app-sheet-rank-pips
        class="cluster-skill-row__pips"
        [value]="rank()"
        [maximum]="5"
        [label]="skill().label"
        (valueChange)="setRank()($event)" />
      <div class="cluster-skill-row__modifier" [attr.title]="modifierTitle()">
        <strong>{{ modifierDisplay() }}</strong>
      </div>
    </article>
  `,
})
export class SkillRowComponent {
  readonly skill = input.required<CharacterSkillDefinition>();
  readonly rank = input.required<number>();
  readonly modifier = input.required<number>();
  readonly highlightedTokens = input<ReadonlySet<StatHighlightToken>>(new Set<StatHighlightToken>());
  readonly setRank = input.required<(value: number) => void>();

  protected readonly attributeLabel = attributeLabel;
  protected readonly attributeAbbreviation = attributeAbbreviation;

  isHighlighted(): boolean {
    return this.highlightedTokens().has(skillHighlightToken(this.skill().key));
  }

  modifierDisplay(): string {
    const value = this.modifier();
    return value >= 0 ? `+${value}` : `${value}`;
  }

  modifierTitle(): string {
    return `${this.modifier()} total modifier`;
  }
}
