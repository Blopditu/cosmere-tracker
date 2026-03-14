import { CommonModule } from '@angular/common';
import { Component, computed, input } from '@angular/core';

type Tone = 'default' | 'gold' | 'sapphire' | 'emerald' | 'ruby' | 'topaz' | 'muted';

@Component({
  selector: 'app-roshar-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="roshar-icon"
      [class.gold]="tone() === 'gold'"
      [class.sapphire]="tone() === 'sapphire'"
      [class.emerald]="tone() === 'emerald'"
      [class.ruby]="tone() === 'ruby'"
      [class.topaz]="tone() === 'topaz'"
      [class.muted]="tone() === 'muted'"
      [style.--icon-size.px]="size()"
      [attr.aria-label]="label()"
      [title]="label()"
    >
      @switch (normalizedKey()) {
        @case ('sessions') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="5" y="4.5" width="14" height="15" rx="2"></rect>
            <path d="M8 8.5h8M8 12h8M8 15.5h5"></path>
          </svg>
        }
        @case ('dashboard') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 13.5 12 5l8 8.5"></path>
            <path d="M6.5 12.5v6h11v-6"></path>
            <path d="M10.5 18.5v-4h3v4"></path>
          </svg>
        }
        @case ('rolls') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m12 3 7 5v8l-7 5-7-5V8z"></path>
            <circle cx="12" cy="12" r="1.6"></circle>
            <circle cx="9" cy="9.5" r="1"></circle>
            <circle cx="15" cy="14.5" r="1"></circle>
          </svg>
        }
        @case ('combat') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 18 18 6"></path>
            <path d="m8 6 10 10"></path>
            <path d="M8 18h8"></path>
          </svg>
        }
        @case ('stage') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="4" y="5.5" width="16" height="13" rx="2"></rect>
            <path d="m7 15 3.5-3.5 2.5 2.5 3-4 1.5 2"></path>
          </svg>
        }
        @case ('help') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="8"></circle>
            <path d="M9.6 9.4a2.7 2.7 0 1 1 4.1 2.3c-.9.5-1.4 1.1-1.4 2.3"></path>
            <circle cx="12" cy="17.2" r="0.7" class="fill-mark"></circle>
          </svg>
        }
        @case ('focus') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m12 3.8 4 5.3-4 10.9-4-10.9z"></path>
            <path d="M8 9.1h8"></path>
          </svg>
        }
        @case ('health') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 19.2 5.5 12.8a4.3 4.3 0 0 1 6.1-6.1L12 7.1l.4-.4a4.3 4.3 0 0 1 6.1 6.1z"></path>
          </svg>
        }
        @case ('damage') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m13.6 3.5-5 8h3.4l-1.6 9 5-8h-3.4z"></path>
          </svg>
        }
        @case ('condition') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3.8 19 7.4v9.2L12 20.2 5 16.6V7.4z"></path>
            <path d="m9.4 12 1.6 1.7 3.7-4.2"></path>
          </svg>
        }
        @case ('live') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8.8 7.4A6.1 6.1 0 0 1 12 6.5a6.1 6.1 0 0 1 3.2.9"></path>
            <path d="M6.8 5.2A9 9 0 0 1 12 3.8a9 9 0 0 1 5.2 1.4"></path>
            <circle cx="12" cy="12.4" r="2.2"></circle>
            <path d="M7.5 18.8h9"></path>
          </svg>
        }
        @case ('fast') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5.5 12h7.5"></path>
            <path d="m11 8 4-4"></path>
            <path d="m11 16 7.5-7.5"></path>
          </svg>
        }
        @case ('slow') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="7"></circle>
            <path d="M12 8v4l2.8 1.7"></path>
          </svg>
        }
        @case ('reaction') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 8.5A6.5 6.5 0 1 0 19 12"></path>
            <path d="m18 5.6.1 3.8-3.7-.1"></path>
          </svg>
        }
        @case ('hit') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="7"></circle>
            <path d="m9.1 12.3 1.9 2 4-4.7"></path>
          </svg>
        }
        @case ('miss') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="7"></circle>
            <path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6"></path>
          </svg>
        }
        @case ('crit') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m12 4.2 2 5.2 5.5.5-4.2 3.5 1.4 5.3-4.7-2.9-4.7 2.9 1.4-5.3L4.5 9.9l5.5-.5z"></path>
          </svg>
        }
        @case ('support') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="9" cy="10" r="2.2"></circle>
            <circle cx="15" cy="10" r="2.2"></circle>
            <path d="M6.5 17.5a4.3 4.3 0 0 1 5.5-2.6 4.3 4.3 0 0 1 5.5 2.6"></path>
          </svg>
        }
        @case ('strike') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m7 17 10-10"></path>
            <path d="m8.3 8.3 7.4 7.4"></path>
          </svg>
        }
        @case ('move') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m12 4 3.8 3.8L12 11.6 8.2 7.8z"></path>
            <path d="M12 12.4v7.4"></path>
          </svg>
        }
        @case ('brace') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 18V7.8l5-2 5 2V18"></path>
            <path d="M9.5 12h5"></path>
          </svg>
        }
        @case ('disengage') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 17 17 7"></path>
            <path d="m7 12 4.8-4.8"></path>
            <path d="M12.2 17H17"></path>
          </svg>
        }
        @case ('gain-advantage') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m12 4.2 2.4 4.9 5.4.8-3.9 3.8.9 5.3-4.8-2.5-4.8 2.5.9-5.3-3.9-3.8 5.4-.8z"></path>
          </svg>
        }
        @case ('interact-skill') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10" cy="10" r="4.1"></circle>
            <path d="m13.2 13.2 5 5"></path>
          </svg>
        }
        @case ('grapple') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 8.5h3.2v3.2H8zM12.8 12.3H16v3.2h-3.2z"></path>
            <path d="M11.2 10.1h1.6v3.8h-1.6z"></path>
          </svg>
        }
        @case ('ready') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6.5 18h11"></path>
            <path d="M12 6.2v8.4"></path>
            <path d="m9.2 9 2.8-2.8L14.8 9"></path>
          </svg>
        }
        @case ('recover') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8.2 8.2A5.4 5.4 0 1 1 6.6 12H4"></path>
            <path d="m4 8.8 0 3.2h3.2"></path>
          </svg>
        }
        @case ('shove') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 12h8.5"></path>
            <path d="m12.5 8.3 4.2 3.7-4.2 3.7"></path>
          </svg>
        }
        @case ('aid') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 6v12"></path>
            <path d="M6 12h12"></path>
            <circle cx="12" cy="12" r="6.5"></circle>
          </svg>
        }
        @case ('dodge') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6.5 14.8c1.7-4.7 5.6-7.1 11-7.1"></path>
            <path d="M9.2 17.8c2.8-4.1 6.1-6.4 9.8-6.9"></path>
          </svg>
        }
        @case ('reactive-strike') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7.5 16.5 17 7"></path>
            <path d="M6.3 8.8A4.7 4.7 0 0 1 10 6.7"></path>
            <path d="m8.7 11.2 5.1 5.1"></path>
          </svg>
        }
        @case ('avoid-danger') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 4.5a7.5 7.5 0 1 0 7.5 7.5"></path>
            <path d="m14.5 6.1 3.4.1-.1 3.4"></path>
          </svg>
        }
        @case ('skill') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 4.5 16.6 7v5L12 19.5 7.4 12V7z"></path>
            <path d="m10.2 11.8 1.2 1.3 2.4-2.7"></path>
          </svg>
        }
        @case ('defense') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 4.5 17 6.8V12c0 3.7-2.2 5.8-5 7.5-2.8-1.7-5-3.8-5-7.5V6.8z"></path>
          </svg>
        }
        @default {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 4.2 19 8v8l-7 3.8L5 16V8z"></path>
            <path d="M12 8.4v7.2"></path>
            <path d="M8.4 12h7.2"></path>
          </svg>
        }
      }
    </span>
  `,
})
export class RosharIconComponent {
  readonly key = input.required<string>();
  readonly label = input<string>('');
  readonly tone = input<Tone>('default');
  readonly size = input<number>(18);
  readonly normalizedKey = computed(() => normalizeKey(this.key()));
}

function normalizeKey(key: string): string {
  switch (key) {
    case 'session-index':
      return 'sessions';
    case 'roll-tracker':
      return 'rolls';
    case 'stage-manager':
      return 'stage';
    case 'generic':
      return 'chronicle';
    default:
      return key;
  }
}
