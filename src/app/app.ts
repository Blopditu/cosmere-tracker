import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AppStoreService } from './core/app-store.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly store = inject(AppStoreService);
  readonly activeCount = computed(() => this.store.sessions().filter((entry) => !entry.archived).length);
}
