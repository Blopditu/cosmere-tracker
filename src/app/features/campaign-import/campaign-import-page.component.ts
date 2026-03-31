import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RosharIconComponent } from '../../shared/roshar-icon.component';
import { CampaignImportStore } from './campaign-import.store';

@Component({
  selector: 'app-campaign-import-page',
  imports: [CommonModule, FormsModule, RosharIconComponent],
  template: `
    <section class="page-header card engraved-panel import-header">
      <div class="route-heading">
        <p class="eyebrow">Handbook Intake</p>
        <h2>Import review desk</h2>
        <p>Load deterministic Python artifacts, review extracted candidates, and publish modeled handbook rules without touching the live board.</p>
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
              <p class="eyebrow">Payload editor</p>
              <label class="compact-field">
                <span>Title</span>
                <input [ngModel]="candidateTitle()" (ngModelChange)="candidateTitle.set($event)" type="text" />
              </label>
              <label class="compact-field">
                <span>Key</span>
                <input [ngModel]="candidateKey()" (ngModelChange)="candidateKey.set($event)" type="text" />
              </label>
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

  readonly artifactPath = signal('.import-cache/stormlight-handbook');
  readonly searchQuery = signal('');
  readonly selectedDocumentId = signal('');
  readonly selectedCandidateId = signal('');
  readonly candidateTitle = signal('');
  readonly candidateKey = signal('');
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
    if (!query) {
      return document.candidates;
    }
    return document.candidates.filter((candidate) =>
      `${candidate.title} ${candidate.kind} ${candidate.excerpt}`.toLowerCase().includes(query),
    );
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
    this.payloadText.set(JSON.stringify(detail.candidate.payload, null, 2));
  }

  async decide(action: 'accept' | 'edit' | 'reject' | 'split' | 'merge'): Promise<void> {
    const candidateId = this.selectedCandidateId();
    if (!candidateId) {
      return;
    }
    try {
      this.errorMessage.set('');
      const payload = this.payloadText().trim() ? JSON.parse(this.payloadText()) : {};
      const splitCandidates = this.splitCandidatesText().trim() ? JSON.parse(this.splitCandidatesText()) : [];
      await this.store.decideCandidate(candidateId, {
        action,
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
