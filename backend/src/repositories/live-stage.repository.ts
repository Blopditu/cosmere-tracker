import path from 'node:path';
import { LiveStageState } from '@shared/domain';
import { readJsonFile, writeJsonFile } from '../lib/json-store';

export class LiveStageRepository {
  private readonly filePath: string;

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, 'live-stage-state.json');
  }

  async list(): Promise<LiveStageState[]> {
    return readJsonFile(this.filePath, []);
  }

  async get(sessionId: string): Promise<LiveStageState | undefined> {
    return (await this.list()).find((entry) => entry.sessionId === sessionId);
  }

  async upsert(state: LiveStageState): Promise<LiveStageState> {
    const items = await this.list();
    const index = items.findIndex((entry) => entry.sessionId === state.sessionId);
    if (index >= 0) {
      items[index] = state;
    } else {
      items.push(state);
    }
    await writeJsonFile(this.filePath, items);
    return state;
  }

  async remove(sessionId: string): Promise<void> {
    const items = await this.list();
    await writeJsonFile(
      this.filePath,
      items.filter((entry) => entry.sessionId !== sessionId),
    );
  }
}
