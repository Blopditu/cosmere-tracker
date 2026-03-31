import { Injectable, signal } from '@angular/core';
import {
  ImportDocumentSummary,
  ImportReviewCandidateDetail,
  ImportReviewDocumentData,
  RegisterArtifactInput,
  ReviewDecisionInput,
} from '@shared/domain';
import { ApiService } from '../../core/api.service';

@Injectable({
  providedIn: 'root',
})
export class CampaignImportStore {
  readonly documents = signal<ImportDocumentSummary[]>([]);
  readonly selectedDocument = signal<ImportReviewDocumentData | null>(null);
  readonly selectedCandidate = signal<ImportReviewCandidateDetail | null>(null);
  readonly loading = signal(false);

  constructor(private readonly api: ApiService) {}

  async loadDocuments(): Promise<ImportDocumentSummary[]> {
    this.loading.set(true);
    try {
      const documents = await this.api.get<ImportDocumentSummary[]>('/api/import/review');
      this.documents.set(documents);
      return documents;
    } finally {
      this.loading.set(false);
    }
  }

  async registerArtifact(input: RegisterArtifactInput): Promise<ImportReviewDocumentData> {
    this.loading.set(true);
    try {
      const document = await this.api.post<ImportReviewDocumentData>('/api/import/artifacts/register-local', input);
      this.selectedDocument.set(document);
      this.selectedCandidate.set(null);
      await this.loadDocuments();
      return document;
    } finally {
      this.loading.set(false);
    }
  }

  async loadDocument(documentId: string): Promise<ImportReviewDocumentData> {
    this.loading.set(true);
    try {
      const document = await this.api.get<ImportReviewDocumentData>(`/api/import/review/documents/${documentId}`);
      this.selectedDocument.set(document);
      return document;
    } finally {
      this.loading.set(false);
    }
  }

  async loadCandidate(candidateId: string): Promise<ImportReviewCandidateDetail> {
    this.loading.set(true);
    try {
      const detail = await this.api.get<ImportReviewCandidateDetail>(`/api/import/review/candidates/${candidateId}`);
      this.selectedCandidate.set(detail);
      return detail;
    } finally {
      this.loading.set(false);
    }
  }

  async decideCandidate(candidateId: string, input: ReviewDecisionInput): Promise<ImportReviewCandidateDetail> {
    this.loading.set(true);
    try {
      const detail = await this.api.post<ImportReviewCandidateDetail>(
        `/api/import/review/candidates/${candidateId}/decision`,
        input,
      );
      this.selectedCandidate.set(detail);
      const documentId = detail.candidate.documentId;
      this.selectedDocument.set(await this.api.get<ImportReviewDocumentData>(`/api/import/review/documents/${documentId}`));
      await this.loadDocuments();
      return detail;
    } finally {
      this.loading.set(false);
    }
  }

  async publishDocument(documentId: string): Promise<ImportReviewDocumentData> {
    this.loading.set(true);
    try {
      const document = await this.api.post<ImportReviewDocumentData>(`/api/import/review/documents/${documentId}/publish`, {});
      this.selectedDocument.set(document);
      await this.loadDocuments();
      return document;
    } finally {
      this.loading.set(false);
    }
  }
}
