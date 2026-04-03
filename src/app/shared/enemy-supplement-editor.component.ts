import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RosharIconComponent } from './roshar-icon.component';

@Component({
  selector: 'app-enemy-supplement-editor',
  imports: [CommonModule, RosharIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="enemy-supplement-editor inset-panel">
      <div class="sheet-block-header">
        <div class="section-heading">
          <app-roshar-icon key="chronicle" label="Enemy guidance" tone="topaz" [size]="16" />
          <h4>Features and tactics</h4>
        </div>
        @if (sourceAdversaryName()) {
          <span class="tag-chip">Source {{ sourceAdversaryName() }}</span>
        }
      </div>

      <div class="enemy-supplement-grid">
        <section class="enemy-supplement-block">
          <div class="sheet-block-header">
            <h4>Features</h4>
            <button type="button" class="button-outline micro-button" (click)="addFeature.emit()">Add feature</button>
          </div>
          <div class="enemy-feature-list">
            @for (feature of features(); track $index; let index = $index) {
              <div class="enemy-feature-row">
                <label class="compact-field">
                  <span>Feature {{ index + 1 }}</span>
                  <input
                    type="text"
                    [value]="feature"
                    placeholder="Enhanced Senses"
                    (input)="featureChange.emit({ index, value: textValue($event) })" />
                </label>
                <button type="button" class="button-outline button-danger micro-button" (click)="removeFeature.emit(index)">
                  Remove
                </button>
              </div>
            } @empty {
              <article class="empty-card enemy-supplement-empty">No features yet. Add short trait entries for this adversary.</article>
            }
          </div>
        </section>

        <section class="enemy-supplement-block">
          <div class="sheet-block-header">
            <h4>Optional tactics</h4>
          </div>
          <label class="compact-field">
            <span>GM tactics note</span>
            <textarea
              rows="6"
              [value]="tactics()"
              placeholder="How this enemy opens, repositions, pressures targets, or retreats."
              (input)="tacticsChange.emit(textValue($event))"></textarea>
          </label>
        </section>
      </div>
    </section>
  `,
})
export class EnemySupplementEditorComponent {
  readonly features = input.required<readonly string[]>();
  readonly tactics = input('');
  readonly sourceAdversaryName = input('');

  readonly addFeature = output<void>();
  readonly removeFeature = output<number>();
  readonly featureChange = output<{ index: number; value: string }>();
  readonly tacticsChange = output<string>();

  textValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }
}
