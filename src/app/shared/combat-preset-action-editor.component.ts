import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ActionKind, CombatPresetAction } from '@shared/domain';
import { RosharIconComponent } from './roshar-icon.component';

const ACTION_KIND_OPTIONS: ActionKind[] = ['action', 'reaction', 'free'];

function createPresetAction(kind: ActionKind): CombatPresetAction {
  return {
    id: crypto.randomUUID(),
    name: '',
    kind,
    actionCost: kind === 'action' ? 1 : 0,
    focusCost: 0,
    requiresTarget: false,
    requiresRoll: false,
    supportsDamage: false,
  };
}

@Component({
  selector: 'app-combat-preset-action-editor',
  imports: [CommonModule, RosharIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="preset-action-editor" [class.compact]="compact()">
      <div class="preset-action-editor-header">
        <div class="section-heading">
          <app-roshar-icon key="combat" [label]="title()" tone="ruby" [size]="16" />
          <h4>{{ title() }}</h4>
        </div>
        <div class="button-row">
          <button type="button" class="button-outline micro-button" (click)="addAction('action')">Add action</button>
          <button type="button" class="button-outline micro-button" (click)="addAction('reaction')">Add reaction</button>
          <button type="button" class="button-outline micro-button" (click)="addAction('free')">Add free</button>
        </div>
      </div>

      <div class="preset-action-list">
        @for (action of actions(); track action.id; let isFirst = $first; let isLast = $last) {
          <article class="preset-action-card inset-panel">
            <div class="preset-action-card-header">
              <div>
                <strong>{{ action.name || 'Unnamed preset' }}</strong>
                <small>{{ action.kind }}</small>
              </div>
              <div class="button-row">
                <button type="button" class="button-outline micro-button" [disabled]="isFirst" (click)="moveAction(action.id, -1)">Up</button>
                <button type="button" class="button-outline micro-button" [disabled]="isLast" (click)="moveAction(action.id, 1)">Down</button>
                <button type="button" class="button-outline button-danger micro-button" (click)="removeAction(action.id)">Remove</button>
              </div>
            </div>

            <div class="preset-action-grid">
              <label class="compact-field">
                <span>Name</span>
                <input type="text" [value]="action.name" (input)="updateText(action.id, 'name', asText($event))" placeholder="Debilitate" />
              </label>

              <label class="compact-field">
                <span>Kind</span>
                <select [value]="action.kind" (change)="updateKind(action.id, asKind($event))">
                  @for (option of actionKinds; track option) {
                    <option [value]="option">{{ option }}</option>
                  }
                </select>
              </label>

              <label class="compact-field">
                <span>Action cost</span>
                <input type="number" min="0" [value]="action.actionCost" (input)="updateNumber(action.id, 'actionCost', asNumber($event))" />
              </label>

              <label class="compact-field">
                <span>Focus cost</span>
                <input type="number" min="0" [value]="action.focusCost" (input)="updateNumber(action.id, 'focusCost', asNumber($event))" />
              </label>

              <label class="compact-field">
                <span>Modifier</span>
                <input type="number" [value]="action.defaultModifier ?? ''" (input)="updateOptionalNumber(action.id, 'defaultModifier', asOptionalNumber($event))" />
              </label>

              <label class="compact-field preset-action-grid-span">
                <span>Damage formula</span>
                <input type="text" [value]="action.defaultDamageFormula ?? ''" (input)="updateOptionalText(action.id, 'defaultDamageFormula', asOptionalText($event))" placeholder="2d8 + 5" />
              </label>
            </div>

            <div class="preset-action-flag-row">
              <label class="preset-action-flag">
                <input type="checkbox" [checked]="action.requiresTarget" (change)="updateBoolean(action.id, 'requiresTarget', asChecked($event))" />
                <span>Target</span>
              </label>
              <label class="preset-action-flag">
                <input type="checkbox" [checked]="action.requiresRoll" (change)="updateBoolean(action.id, 'requiresRoll', asChecked($event))" />
                <span>Roll</span>
              </label>
              <label class="preset-action-flag">
                <input type="checkbox" [checked]="action.supportsDamage" (change)="updateBoolean(action.id, 'supportsDamage', asChecked($event))" />
                <span>Damage</span>
              </label>
            </div>
          </article>
        } @empty {
          <article class="empty-card">{{ emptyLabel() }}</article>
        }
      </div>
    </section>
  `,
})
export class CombatPresetActionEditorComponent {
  readonly actions = input.required<CombatPresetAction[]>();
  readonly title = input('Preset actions');
  readonly emptyLabel = input('No preset actions yet.');
  readonly compact = input(false);

  readonly actionsChange = output<CombatPresetAction[]>();
  protected readonly actionKinds = ACTION_KIND_OPTIONS;

  addAction(kind: ActionKind): void {
    this.actionsChange.emit([...this.actions(), createPresetAction(kind)]);
  }

  removeAction(actionId: string): void {
    this.actionsChange.emit(this.actions().filter((action) => action.id !== actionId));
  }

  moveAction(actionId: string, direction: -1 | 1): void {
    const items = [...this.actions()];
    const index = items.findIndex((action) => action.id === actionId);
    const nextIndex = index + direction;
    if (index === -1 || nextIndex < 0 || nextIndex >= items.length) {
      return;
    }
    const [moved] = items.splice(index, 1);
    items.splice(nextIndex, 0, moved);
    this.actionsChange.emit(items);
  }

  updateText(actionId: string, field: 'name', value: string): void {
    this.actionsChange.emit(this.actions().map((action) => (action.id === actionId ? { ...action, [field]: value } : action)));
  }

  updateOptionalText(actionId: string, field: 'defaultDamageFormula', value: string | undefined): void {
    this.actionsChange.emit(
      this.actions().map((action) => (action.id === actionId ? { ...action, [field]: value } : action)),
    );
  }

  updateNumber(actionId: string, field: 'actionCost' | 'focusCost', value: number): void {
    this.actionsChange.emit(
      this.actions().map((action) => (action.id === actionId ? { ...action, [field]: Math.max(0, value) } : action)),
    );
  }

  updateOptionalNumber(actionId: string, field: 'defaultModifier', value: number | undefined): void {
    this.actionsChange.emit(
      this.actions().map((action) => (action.id === actionId ? { ...action, [field]: value } : action)),
    );
  }

  updateBoolean(
    actionId: string,
    field: 'requiresTarget' | 'requiresRoll' | 'supportsDamage',
    value: boolean,
  ): void {
    this.actionsChange.emit(
      this.actions().map((action) => (action.id === actionId ? { ...action, [field]: value } : action)),
    );
  }

  updateKind(actionId: string, kind: ActionKind): void {
    this.actionsChange.emit(
      this.actions().map((action) =>
        action.id === actionId
          ? {
              ...action,
              kind,
              actionCost: kind === 'action' ? Math.max(1, action.actionCost) : 0,
            }
          : action,
      ),
    );
  }

  asText(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  asOptionalText(event: Event): string | undefined {
    const value = (event.target as HTMLInputElement).value.trim();
    return value || undefined;
  }

  asNumber(event: Event): number {
    return Number((event.target as HTMLInputElement).value) || 0;
  }

  asOptionalNumber(event: Event): number | undefined {
    const value = (event.target as HTMLInputElement).value;
    if (value === '') {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  asChecked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  asKind(event: Event): ActionKind {
    const value = (event.target as HTMLSelectElement).value;
    return value === 'reaction' || value === 'free' ? value : 'action';
  }
}
