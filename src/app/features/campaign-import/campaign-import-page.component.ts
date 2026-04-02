import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ImportCandidateKind, JsonValue } from '@shared/domain';
import { RosharIconComponent } from '../../shared/roshar-icon.component';
import { CampaignImportStore } from './campaign-import.store';

const CANDIDATE_KIND_REVIEW_ORDER: readonly ImportCandidateKind[] = [
  'resource-definition',
  'statistic-definition',
  'stat-table-definition',
  'skill-definition',
  'rule-section',
  'action-definition',
  'condition-definition',
  'combat-procedure',
  'conversation-procedure',
  'endeavor-procedure',
  'duration-mechanic',
];
const DEFAULT_ARTIFACT_PATH = '.import-cache/chapter-3-character-statistics';

@Component({
  selector: 'app-campaign-import-page',
  imports: [CommonModule, FormsModule, RosharIconComponent],
  template: `
    <section class="page-header card engraved-panel import-header">
      <div class="route-heading">
        <p class="eyebrow">Handbook Intake</p>
        <h2>Import review desk</h2>
        <p>Load deterministic Python or curated chapter artifacts, review extracted candidates, and publish modeled handbook rules without touching the live board.</p>
      </div>
      <div class="import-toolbar">
        <label class="compact-field">
          <span>Artifact path</span>
          <input [ngModel]="artifactPath()" (ngModelChange)="artifactPath.set($event)" type="text" />
        </label>
        <button type="button" (click)="registerArtifact()">Register artifact</button>
      </div>
    </section>

    <div class="import-shell">
      <section class="card engraved-panel import-column">
        <div class="card-header">
          <div class="section-heading">
            <app-roshar-icon key="chronicle" label="Documents" tone="sapphire" [size]="18" />
            <h3>Documents</h3>
          </div>
          <span class="pill">{{ store.documents().length }}</span>
        </div>
        <div class="list-stack compact-stack">
          @for (summary of store.documents(); track summary.document.id) {
            <button type="button" class="import-list-item" [class.import-list-item-active]="selectedDocumentId() === summary.document.id" (click)="selectDocument(summary.document.id)">
              <strong>{{ summary.document.title }}</strong>
              <span>{{ summary.pendingCount }} pending • {{ summary.publishedCount }} published</span>
            </button>
          } @empty {
            <article class="empty-card">No import artifacts registered yet.</article>
          }
        </div>
      </section>

      <section class="card engraved-panel import-column">
        <div class="card-header">
          <div class="section-heading">
            <app-roshar-icon key="aid" label="Candidates" tone="topaz" [size]="18" />
            <h3>Candidates</h3>
          </div>
          <span class="pill">{{ filteredCandidates().length }}</span>
        </div>
        <label class="compact-field">
          <span>Search</span>
          <input [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)" type="search" placeholder="title, kind, excerpt..." />
        </label>
        <div class="list-stack compact-stack">
          @for (candidate of filteredCandidates(); track candidate.id) {
            <button type="button" class="import-list-item" [class.import-list-item-active]="selectedCandidateId() === candidate.id" (click)="selectCandidate(candidate.id)">
              <strong>{{ candidate.title }}</strong>
              <span>{{ candidate.kind }} • {{ candidate.decision }}</span>
              <small>{{ candidate.excerpt }}</small>
            </button>
          } @empty {
            <article class="empty-card">Pick a document to review its extracted candidates.</article>
          }
        </div>
      </section>

      <section class="card engraved-panel import-detail">
        @if (store.selectedCandidate(); as detail) {
          <div class="card-header">
            <div class="section-heading">
              <app-roshar-icon key="dashboard" label="Candidate" tone="gold" [size]="18" />
              <div>
                <h3>{{ detail.candidate.title }}</h3>
                <p>{{ detail.candidate.kind }} • {{ detail.pageNumbers.join(', ') }}</p>
              </div>
            </div>
            @if (store.selectedDocument(); as document) {
              <button type="button" class="button-outline" (click)="publishDocument(document.summary.document.id)">Publish document</button>
            }
          </div>

          <div class="detail-grid">
            <section class="inset-panel">
              <p class="eyebrow">Source excerpt</p>
              @for (block of detail.blocks; track block.id) {
                <article class="source-block">
                  <strong>Page {{ block.pageNumber }}</strong>
                  <p>{{ block.text }}</p>
                </article>
              }
            </section>

            <section class="inset-panel">
              <p class="eyebrow">Review editor</p>
              <p class="editor-caption">Use kind to correct extractor misclassification before accepting.</p>
              <label class="compact-field">
                <span>Title</span>
                <input [ngModel]="candidateTitle()" (ngModelChange)="candidateTitle.set($event)" type="text" />
              </label>
              <label class="compact-field">
                <span>Key</span>
                <input [ngModel]="candidateKey()" (ngModelChange)="candidateKey.set($event)" type="text" />
              </label>
              <label class="compact-field">
                <span>Kind</span>
                <select [ngModel]="selectedKind()" (ngModelChange)="selectedKind.set($event)">
                  @for (kind of candidateKinds; track kind) {
                    <option [ngValue]="kind">{{ kind }}</option>
                  }
                </select>
              </label>
              <p class="kind-description">{{ kindDescriptions[selectedKind()] }}</p>
              <label class="compact-field">
                <span>Payload JSON</span>
                <textarea rows="12" [ngModel]="payloadText()" (ngModelChange)="payloadText.set($event)"></textarea>
              </label>
              <div class="button-row">
                <button type="button" (click)="decide('accept')">Accept</button>
                <button type="button" class="button-outline" (click)="decide('edit')">Save edit</button>
                <button type="button" class="button-outline" (click)="decide('reject')">Reject</button>
              </div>
              <label class="compact-field">
                <span>Merge candidate ids</span>
                <input [ngModel]="mergeIds()" (ngModelChange)="mergeIds.set($event)" type="text" placeholder="id-one,id-two" />
              </label>
              <div class="button-row">
                <button type="button" class="button-outline" (click)="decide('merge')">Merge</button>
              </div>
              <label class="compact-field">
                <span>Split JSON array</span>
                <textarea rows="6" [ngModel]="splitCandidatesText()" (ngModelChange)="splitCandidatesText.set($event)"></textarea>
              </label>
              <p class="split-caption">Split is only for breaking one candidate into multiple new candidates.</p>
              <div class="button-row">
                <button type="button" class="button-outline" (click)="decide('split')">Split</button>
              </div>
              @if (errorMessage()) {
                <p class="shell-error-chip">{{ errorMessage() }}</p>
              }
            </section>
          </div>
        } @else {
          <article class="empty-card">Select a candidate to review its source blocks and published payload.</article>
        }
      </section>
    </div>
  `,
  styleUrl: './campaign-import-page.component.scss',
})
export class CampaignImportPageComponent {
  readonly store = inject(CampaignImportStore);
  readonly candidateKinds: ImportCandidateKind[] = [
    'resource-definition',
    'statistic-definition',
    'stat-table-definition',
    'skill-definition',
    'action-definition',
    'condition-definition',
    'combat-procedure',
    'conversation-procedure',
    'endeavor-procedure',
    'duration-mechanic',
    'rule-section',
  ];
  readonly kindDescriptions: Record<ImportCandidateKind, string> = {
    'resource-definition': 'Named tracked stat or pool.',
    'statistic-definition': 'Structured attribute, defense, or derived statistic.',
    'stat-table-definition': 'Lookup table that maps a source stat to derived outputs.',
    'skill-definition': 'Reusable skill metadata tied to an attribute and facet.',
    'action-definition': 'Discrete action or reaction a character can take.',
    'condition-definition': 'Named applied status or ongoing effect.',
    'combat-procedure': 'Combat flow or resolution guidance.',
    'conversation-procedure': 'Structured social flow guidance.',
    'endeavor-procedure': 'Reusable non-combat scene procedure.',
    'duration-mechanic': 'Duration or timing rule.',
    'rule-section': 'Preserved reference text that is not a stronger model.',
  };

  readonly artifactPath = signal(DEFAULT_ARTIFACT_PATH);
  readonly searchQuery = signal('');
  readonly selectedDocumentId = signal('');
  readonly selectedCandidateId = signal('');
  readonly candidateTitle = signal('');
  readonly candidateKey = signal('');
  readonly selectedKind = signal<ImportCandidateKind>('rule-section');
  readonly payloadText = signal('{}');
  readonly mergeIds = signal('');
  readonly splitCandidatesText = signal('[]');
  readonly errorMessage = signal('');

  readonly filteredCandidates = computed(() => {
    const document = this.store.selectedDocument();
    if (!document) {
      return [];
    }
    const query = this.searchQuery().trim().toLowerCase();
    const filtered = !query
      ? document.candidates
      : document.candidates.filter((candidate) =>
          `${candidate.title} ${candidate.kind} ${candidate.excerpt}`.toLowerCase().includes(query),
        );
    return [...filtered].sort((left, right) => {
      const leftIndex = CANDIDATE_KIND_REVIEW_ORDER.indexOf(left.kind);
      const rightIndex = CANDIDATE_KIND_REVIEW_ORDER.indexOf(right.kind);
      return leftIndex - rightIndex || left.title.localeCompare(right.title);
    });
  });

  constructor() {
    void this.store.loadDocuments();
  }

  async registerArtifact(): Promise<void> {
    const document = await this.store.registerArtifact({ artifactPath: this.artifactPath().trim() });
    this.selectedDocumentId.set(document.summary.document.id);
  }

  async selectDocument(documentId: string): Promise<void> {
    this.selectedDocumentId.set(documentId);
    this.selectedCandidateId.set('');
    this.errorMessage.set('');
    await this.store.loadDocument(documentId);
  }

  async selectCandidate(candidateId: string): Promise<void> {
    this.selectedCandidateId.set(candidateId);
    this.errorMessage.set('');
    const detail = await this.store.loadCandidate(candidateId);
    this.candidateTitle.set(detail.candidate.title);
    this.candidateKey.set(detail.candidate.key);
    this.selectedKind.set(detail.candidate.kind);
    this.payloadText.set(JSON.stringify(detail.candidate.payload, null, 2));
  }

  async decide(action: 'accept' | 'edit' | 'reject' | 'split' | 'merge'): Promise<void> {
    const candidateId = this.selectedCandidateId();
    if (!candidateId) {
      return;
    }
    try {
      this.errorMessage.set('');
      let payload: Record<string, JsonValue> = {};
      if (action !== 'merge' && action !== 'split') {
        try {
          payload = this.payloadText().trim() ? (JSON.parse(this.payloadText()) as Record<string, JsonValue>) : {};
        } catch {
          this.errorMessage.set('Payload JSON must be valid JSON before you can save this review decision.');
          return;
        }
      } else if (action === 'merge') {
        try {
          payload = this.payloadText().trim() ? (JSON.parse(this.payloadText()) as Record<string, JsonValue>) : {};
        } catch {
          this.errorMessage.set('Payload JSON must be valid JSON before you can merge candidates.');
          return;
        }
      }

      let splitCandidates: Array<{
        title: string;
        key: string;
        kind: ImportCandidateKind;
        excerpt: string;
        sourceBlockIds: string[];
        payload: Record<string, JsonValue>;
      }> = [];
      if (action === 'split') {
        try {
          splitCandidates = this.splitCandidatesText().trim()
            ? (JSON.parse(this.splitCandidatesText()) as typeof splitCandidates)
            : [];
        } catch {
          this.errorMessage.set('Split JSON array must be valid JSON before you can create replacement candidates.');
          return;
        }
      }
      await this.store.decideCandidate(candidateId, {
        action,
        kind: this.selectedKind(),
        title: this.candidateTitle().trim(),
        key: this.candidateKey().trim(),
        payload,
        mergeCandidateIds: this.mergeIds()
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        splitCandidates,
      });
      await this.selectCandidate(candidateId);
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Decision failed.');
    }
  }

  async publishDocument(documentId: string): Promise<void> {
    await this.store.publishDocument(documentId);
  }
}
