import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { CombatEvent, CombatantInstance } from '../core/models';

@Component({
  selector: 'app-timeline',
  imports: [DatePipe],
  template: `
    <section class="card">
      <div class="card-header">
        <h3>{{ title() }}</h3>
        <span class="pill">{{ events().length }} events</span>
      </div>
      <div class="timeline">
        @for (event of events(); track event.id) {
          <article class="timeline-item">
            <div class="timeline-meta">
              @if (event.round !== undefined) {
                <span class="pill">Round {{ event.round }}</span>
              }
              <span>{{ event.timestamp | date: 'shortTime' }}</span>
            </div>
            <h4>{{ describe(event) }}</h4>
            <p>{{ detail(event) }}</p>
          </article>
        }
      </div>
    </section>
  `,
})
export class TimelineComponent {
  readonly title = input('Timeline');
  readonly events = input.required<CombatEvent[]>();
  readonly combatants = input.required<CombatantInstance[]>();
  readonly combatantMap = computed(
    () => new Map(this.combatants().map((combatant) => [combatant.id, combatant])),
  );

  describe(event: CombatEvent): string {
    const actor = this.combatantMap().get(event.actorId)?.name ?? 'Unknown actor';
    const targets = event.targetIds
      .map((targetId) => this.combatantMap().get(targetId)?.name ?? 'Unknown target')
      .join(', ');

    switch (event.type) {
      case 'attack-roll':
        return `${actor} made an attack roll${targets ? ` against ${targets}` : ''}`;
      case 'damage':
        return `${actor} dealt damage${targets ? ` to ${targets}` : ''}`;
      case 'healing':
        return `${actor} healed${targets ? ` ${targets}` : ''}`;
      case 'saving-throw':
        return `${actor} rolled a save`;
      case 'support':
        return `${actor} made a support play${targets ? ` for ${targets}` : ''}`;
      case 'utility':
        return `${actor} used a utility action`;
      case 'kill':
        return `${actor} secured a kill${targets ? ` on ${targets}` : ''}`;
      case 'death':
        return `${actor} was defeated`;
      case 'condition':
        return `${actor} applied or tracked a condition`;
      default:
        return `${actor} added a note`;
    }
  }

  detail(event: CombatEvent): string {
    const parts = [
      event.diceFormula ? `Dice ${event.diceFormula}` : '',
      event.rollTotal !== undefined ? `Roll ${event.rollTotal}` : '',
      event.modifier !== undefined ? `Mod ${event.modifier}` : '',
      event.amount !== undefined ? `Amount ${event.amount}` : '',
      event.damageType ? `Type ${event.damageType}` : '',
      event.outcome ? `Outcome ${event.outcome}` : '',
      event.supportTags?.length ? `Tags ${event.supportTags.join(', ')}` : '',
      event.note || '',
    ].filter(Boolean);

    return parts.join(' • ') || 'No extra detail';
  }
}
