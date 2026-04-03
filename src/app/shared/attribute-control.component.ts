import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CharacterAttributeKey } from '@shared/domain';
import { attributeHighlightToken, StatHighlightToken } from './character-stat-sheet-editor.helpers';
import { SheetNumberStepperComponent } from './sheet-number-stepper.component';

interface AttributeDisplay {
  key: CharacterAttributeKey;
  label: string;
  facet: string;
  summary: string;
}

@Component({
  selector: 'app-attribute-control',
  imports: [SheetNumberStepperComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="cluster-attribute" [class.is-highlighted]="isHighlighted()">
      <div class="cluster-attribute__copy">
        <span class="stat-label">{{ attribute().label }}</span>
        <strong>{{ value() }}</strong>
      </div>
      <app-sheet-number-stepper
        [compact]="true"
        [value]="value()"
        [minimum]="0"
        [decrementLabel]="'Lower ' + attribute().label"
        [incrementLabel]="'Raise ' + attribute().label"
        (valueChange)="step()($event - value())" />
    </article>
  `,
})
export class AttributeControlComponent {
  readonly attribute = input.required<AttributeDisplay>();
  readonly value = input.required<number>();
  readonly highlightedTokens = input<ReadonlySet<StatHighlightToken>>(new Set<StatHighlightToken>());
  readonly step = input.required<(delta: number) => void>();

  isHighlighted(): boolean {
    return this.highlightedTokens().has(attributeHighlightToken(this.attribute().key));
  }
}
