import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CHARACTER_RESOURCE_KEYS, CharacterResourceKey } from '@shared/domain';
import { resourceHighlightToken, resourceLabel, StatHighlightToken } from './character-stat-sheet-editor.helpers';

@Component({
  selector: 'app-resource-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="stat-resource-bar" aria-label="Resources">
      @for (resourceKey of resourceKeys; track resourceKey) {
        <article
          class="stat-resource-pill"
          [class.resource-investiture]="resourceKey === 'investiture'"
          [class.is-highlighted]="isHighlighted(resourceKey)">
          <span class="stat-label">{{ resourceLabel(resourceKey) }}</span>
          <strong>{{ resources()[resourceKey] }}</strong>
        </article>
      }
    </section>
  `,
})
export class ResourceBarComponent {
  readonly resources = input.required<Record<CharacterResourceKey, number>>();
  readonly highlightedTokens = input<ReadonlySet<StatHighlightToken>>(new Set<StatHighlightToken>());

  protected readonly resourceKeys = CHARACTER_RESOURCE_KEYS;
  protected readonly resourceLabel = resourceLabel;

  isHighlighted(resourceKey: CharacterResourceKey): boolean {
    return this.highlightedTokens().has(resourceHighlightToken(resourceKey));
  }
}
