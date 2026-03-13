import { randomUUID } from 'node:crypto';
import { CreateSessionInput, SessionDashboard, SessionEntity, SessionSummary, UpdateSessionInput } from '@shared/domain';
import { HttpError } from '../lib/http';
import { nowIso } from '../lib/time';
import { CombatRepository } from '../repositories/combat.repository';
import { RollRepository } from '../repositories/roll.repository';
import { SessionRepository } from '../repositories/session.repository';
import { StageSceneRepository } from '../repositories/stage-scene.repository';
import { LiveStageRepository } from '../repositories/live-stage.repository';

export class SessionService {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly rollRepository: RollRepository,
    private readonly combatRepository: CombatRepository,
    private readonly stageSceneRepository: StageSceneRepository,
    private readonly liveStageRepository: LiveStageRepository,
  ) {}

  private async summarizeSession(session: SessionEntity): Promise<SessionSummary> {
    const [rolls, combats, scenes] = await Promise.all([
      this.rollRepository.list(),
      this.combatRepository.list(),
      this.stageSceneRepository.list(),
    ]);

    return {
      ...session,
      rollCount: rolls.filter((roll) => roll.sessionId === session.id).length,
      combatCount: combats.filter((combat) => combat.sessionId === session.id).length,
      stageSceneCount: scenes.filter((scene) => scene.sessionId === session.id).length,
    };
  }

  async list(): Promise<SessionSummary[]> {
    const sessions = await this.sessionRepository.list();
    return Promise.all(
      sessions
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .map((session) => this.summarizeSession(session)),
    );
  }

  async get(sessionId: string): Promise<SessionSummary> {
    const session = await this.sessionRepository.get(sessionId);
    if (!session) {
      throw new HttpError(404, 'Session not found.');
    }
    return this.summarizeSession(session);
  }

  async create(input: CreateSessionInput): Promise<SessionSummary> {
    const timestamp = nowIso();
    const session: SessionEntity = {
      id: randomUUID(),
      title: input.title.trim(),
      notes: input.notes?.trim(),
      createdAt: timestamp,
      updatedAt: timestamp,
      partyMembers: (input.partyMembers ?? []).map((member) => ({
        ...member,
        id: randomUUID(),
        sessionId: '',
      })),
      participantTemplates: (input.participantTemplates ?? []).map((participant) => ({
        ...participant,
        id: randomUUID(),
        sessionId: '',
      })),
    };

    session.partyMembers = session.partyMembers.map((member) => ({ ...member, sessionId: session.id }));
    session.participantTemplates = session.participantTemplates.map((template) => ({
      ...template,
      sessionId: session.id,
    }));

    await this.sessionRepository.upsert(session);
    await this.liveStageRepository.upsert({
      sessionId: session.id,
      liveSceneId: null,
      updatedAt: timestamp,
    });
    return this.summarizeSession(session);
  }

  async update(sessionId: string, patch: UpdateSessionInput): Promise<SessionSummary> {
    const session = await this.sessionRepository.get(sessionId);
    if (!session) {
      throw new HttpError(404, 'Session not found.');
    }

    const next: SessionEntity = {
      ...session,
      title: patch.title?.trim() || session.title,
      notes: patch.notes ?? session.notes,
      updatedAt: nowIso(),
      partyMembers: patch.partyMembers?.map((member) => ({ ...member, sessionId })) ?? session.partyMembers,
      participantTemplates:
        patch.participantTemplates?.map((template) => ({ ...template, sessionId })) ?? session.participantTemplates,
    };

    await this.sessionRepository.upsert(next);
    return this.summarizeSession(next);
  }

  async delete(sessionId: string): Promise<void> {
    await this.sessionRepository.remove(sessionId);

    const [rolls, combats, scenes] = await Promise.all([
      this.rollRepository.list(),
      this.combatRepository.list(),
      this.stageSceneRepository.list(),
    ]);

    await Promise.all([
      this.rollRepository.saveAll(rolls.filter((roll) => roll.sessionId !== sessionId)),
      this.combatRepository.saveAll(combats.filter((combat) => combat.sessionId !== sessionId)),
      this.stageSceneRepository.saveAll(scenes.filter((scene) => scene.sessionId !== sessionId)),
      this.liveStageRepository.remove(sessionId),
    ]);
  }

  async dashboard(sessionId: string): Promise<SessionDashboard> {
    const session = await this.get(sessionId);
    const [rolls, combats] = await Promise.all([
      this.rollRepository.list(),
      this.combatRepository.list(),
    ]);

    return {
      session,
      recentRolls: rolls
        .filter((roll) => roll.sessionId === sessionId)
        .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
        .slice(0, 8),
      recentCombats: combats
        .filter((combat) => combat.sessionId === sessionId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 5),
    };
  }
}
