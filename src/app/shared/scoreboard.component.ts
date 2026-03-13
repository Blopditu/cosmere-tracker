import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { ActorSummary } from '../core/models';

@Component({
  selector: 'app-scoreboard',
  imports: [CommonModule],
  template: `
    <div class="grid-two">
      <section class="card">
        <div class="card-header">
          <h3>{{ partyLabel() }}</h3>
          <span class="pill pill-party">{{ party().length }} combatants</span>
        </div>
        <div class="scoreboard-list">
          @for (actor of party(); track actor.actorId) {
            <article class="scoreboard-row scoreboard-row-party">
              <header>
                <div>
                  <h4>{{ actor.name }}</h4>
                  <p>{{ actor.role || 'Party member' }}</p>
                </div>
                <div class="badge-row">
                  @for (badge of actor.badges; track badge) {
                    <span class="badge">{{ badge }}</span>
                  }
                </div>
              </header>
              <dl class="scoreboard-stats">
                <div><dt>K / D / A</dt><dd>{{ actor.kills }} / {{ actor.deaths }} / {{ actor.assists }}</dd></div>
                <div><dt>Damage</dt><dd>{{ actor.damageDealt }}</dd></div>
                <div><dt>Taken</dt><dd>{{ actor.damageTaken }}</dd></div>
                <div><dt>Healing</dt><dd>{{ actor.healingDone }}</dd></div>
                <div><dt>Rolls</dt><dd>{{ actor.rollCount }}</dd></div>
                <div><dt>Accuracy</dt><dd>{{ actor.accuracy | percent: '1.0-0' }}</dd></div>
                <div><dt>Crits</dt><dd>{{ actor.critCount }}</dd></div>
                <div><dt>Saves</dt><dd>{{ actor.saveSuccesses }} / {{ actor.saveFailures }}</dd></div>
              </dl>
              @if (tagList(actor).length) {
                <div class="tag-cloud">
                  @for (tag of tagList(actor); track tag) {
                    <span class="tag-chip">{{ tag }} {{ actor.tagCounts[tag] }}</span>
                  }
                </div>
              }
            </article>
          }
        </div>
      </section>

      <section class="card">
        <div class="card-header">
          <h3>{{ enemyLabel() }}</h3>
          <span class="pill pill-enemy">{{ enemies().length }} combatants</span>
        </div>
        <div class="scoreboard-list">
          @for (actor of enemies(); track actor.actorId) {
            <article class="scoreboard-row scoreboard-row-enemy">
              <header>
                <div>
                  <h4>{{ actor.name }}</h4>
                  <p>{{ actor.role || 'Enemy' }}</p>
                </div>
                <div class="badge-row">
                  @for (badge of actor.badges; track badge) {
                    <span class="badge">{{ badge }}</span>
                  }
                </div>
              </header>
              <dl class="scoreboard-stats">
                <div><dt>K / D / A</dt><dd>{{ actor.kills }} / {{ actor.deaths }} / {{ actor.assists }}</dd></div>
                <div><dt>Damage</dt><dd>{{ actor.damageDealt }}</dd></div>
                <div><dt>Taken</dt><dd>{{ actor.damageTaken }}</dd></div>
                <div><dt>Healing</dt><dd>{{ actor.healingDone }}</dd></div>
                <div><dt>Rolls</dt><dd>{{ actor.rollCount }}</dd></div>
                <div><dt>Accuracy</dt><dd>{{ actor.accuracy | percent: '1.0-0' }}</dd></div>
                <div><dt>Crits</dt><dd>{{ actor.critCount }}</dd></div>
                <div><dt>Saves</dt><dd>{{ actor.saveSuccesses }} / {{ actor.saveFailures }}</dd></div>
              </dl>
              @if (tagList(actor).length) {
                <div class="tag-cloud">
                  @for (tag of tagList(actor); track tag) {
                    <span class="tag-chip">{{ tag }} {{ actor.tagCounts[tag] }}</span>
                  }
                </div>
              }
            </article>
          }
        </div>
      </section>
    </div>
  `,
})
export class ScoreboardComponent {
  readonly party = input.required<ActorSummary[]>();
  readonly enemies = input.required<ActorSummary[]>();
  readonly partyLabel = input('Party');
  readonly enemyLabel = input('Enemies');

  tagList(actor: ActorSummary): string[] {
    return Object.keys(actor.tagCounts).sort();
  }
}
