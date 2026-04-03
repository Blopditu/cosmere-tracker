import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const TEMP_FILE_EXTENSION = '.tmp';

async function ensureParentDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await writeJsonFile(filePath, fallback);
      return fallback;
    }
    throw error;
  }
}

export async function writeJsonFile<T>(filePath: string, value: T): Promise<void> {
  await ensureParentDir(filePath);
  const tempPath = `${filePath}.${randomUUID()}${TEMP_FILE_EXTENSION}`;
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2), 'utf8');
  await fs.rename(tempPath, filePath);
}

export class JsonCollectionRepository<T extends { id: string }> {
  constructor(
    private readonly filePath: string,
    private readonly seed: T[] = [],
  ) {}

  async list(): Promise<T[]> {
    return readJsonFile<T[]>(this.filePath, this.seed);
  }

  async get(id: string): Promise<T | undefined> {
    return (await this.list()).find((item) => item.id === id);
  }

  async saveAll(items: T[]): Promise<void> {
    await writeJsonFile(this.filePath, items);
  }

  async upsert(item: T): Promise<T> {
    const items = await this.list();
    const index = items.findIndex((entry) => entry.id === item.id);
    if (index >= 0) {
      items[index] = item;
    } else {
      items.push(item);
    }
    await this.saveAll(items);
    return item;
  }

  async remove(id: string): Promise<void> {
    const items = await this.list();
    await this.saveAll(items.filter((item) => item.id !== id));
  }
}
