import { mkdirSync, promises as fs } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export type SqliteDatabase = Database.Database;
const SQLITE_CONNECTIONS = new Map<string, SqliteDatabase>();

export function openSqliteDatabase(filePath: string): SqliteDatabase {
  const normalizedPath = path.resolve(filePath);
  const existing = SQLITE_CONNECTIONS.get(normalizedPath);
  if (existing) {
    return existing;
  }

  mkdirSync(path.dirname(normalizedPath), { recursive: true });
  const database = new Database(normalizedPath);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  SQLITE_CONNECTIONS.set(normalizedPath, database);
  return database;
}

export class SqliteJsonRepository<T extends { id: string }> {
  private readonly listStatement;
  private readonly getStatement;
  private readonly upsertStatement;
  private readonly deleteStatement;
  private readonly countStatement;

  constructor(
    private readonly database: SqliteDatabase,
    private readonly tableName: string,
  ) {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );
    `);

    this.listStatement = this.database.prepare(`SELECT data FROM ${this.tableName}`);
    this.getStatement = this.database.prepare(`SELECT data FROM ${this.tableName} WHERE id = ?`);
    this.upsertStatement = this.database.prepare(`
      INSERT INTO ${this.tableName} (id, data)
      VALUES (@id, @data)
      ON CONFLICT(id) DO UPDATE SET data = excluded.data
    `);
    this.deleteStatement = this.database.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`);
    this.countStatement = this.database.prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`);
  }

  list(): T[] {
    return this.listStatement.all().map((row) => JSON.parse(String((row as { data: string }).data)) as T);
  }

  get(id: string): T | undefined {
    const row = this.getStatement.get(id) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as T) : undefined;
  }

  count(): number {
    const row = this.countStatement.get() as { count: number };
    return row.count;
  }

  saveAll(items: T[]): void {
    const deleteAll = this.database.prepare(`DELETE FROM ${this.tableName}`);
    const transaction = this.database.transaction((nextItems: T[]) => {
      deleteAll.run();
      for (const item of nextItems) {
        this.upsert(item);
      }
    });
    transaction(items);
  }

  upsert(item: T): T {
    this.upsertStatement.run({
      id: item.id,
      data: JSON.stringify(item, null, 2),
    });
    return item;
  }

  remove(id: string): void {
    this.deleteStatement.run(id);
  }
}

export class SqliteKeyedJsonRepository<T> {
  private readonly listStatement;
  private readonly getStatement;
  private readonly upsertStatement;
  private readonly deleteStatement;
  private readonly countStatement;

  constructor(
    private readonly database: SqliteDatabase,
    private readonly tableName: string,
    private readonly keyField: string,
  ) {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        ${this.keyField} TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );
    `);

    this.listStatement = this.database.prepare(`SELECT data FROM ${this.tableName}`);
    this.getStatement = this.database.prepare(`SELECT data FROM ${this.tableName} WHERE ${this.keyField} = ?`);
    this.upsertStatement = this.database.prepare(`
      INSERT INTO ${this.tableName} (${this.keyField}, data)
      VALUES (@key, @data)
      ON CONFLICT(${this.keyField}) DO UPDATE SET data = excluded.data
    `);
    this.deleteStatement = this.database.prepare(`DELETE FROM ${this.tableName} WHERE ${this.keyField} = ?`);
    this.countStatement = this.database.prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`);
  }

  list(): T[] {
    return this.listStatement.all().map((row) => JSON.parse(String((row as { data: string }).data)) as T);
  }

  get(key: string): T | undefined {
    const row = this.getStatement.get(key) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as T) : undefined;
  }

  count(): number {
    const row = this.countStatement.get() as { count: number };
    return row.count;
  }

  saveAll(items: T[], keySelector: (item: T) => string): void {
    const deleteAll = this.database.prepare(`DELETE FROM ${this.tableName}`);
    const transaction = this.database.transaction((nextItems: T[]) => {
      deleteAll.run();
      for (const item of nextItems) {
        this.upsert(keySelector(item), item);
      }
    });
    transaction(items);
  }

  upsert(key: string, item: T): T {
    this.upsertStatement.run({
      key,
      data: JSON.stringify(item, null, 2),
    });
    return item;
  }

  remove(key: string): void {
    this.deleteStatement.run(key);
  }
}

async function readLegacyItems<T>(filePath: string, fallback: T[]): Promise<T[]> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return fallback;
    }
    throw error;
  }
}

export class AsyncSqliteJsonRepository<T extends { id: string }> {
  private readonly repository: SqliteJsonRepository<T>;
  private initialization: Promise<void> | null = null;

  constructor(
    databasePath: string,
    tableName: string,
    private readonly legacyFilePath?: string,
    private readonly seed: T[] = [],
  ) {
    this.repository = new SqliteJsonRepository<T>(openSqliteDatabase(databasePath), tableName);
  }

  async list(): Promise<T[]> {
    await this.ensureInitialized();
    return this.repository.list();
  }

  async get(id: string): Promise<T | undefined> {
    await this.ensureInitialized();
    return this.repository.get(id);
  }

  async saveAll(items: T[]): Promise<void> {
    await this.ensureInitialized();
    this.repository.saveAll(items);
  }

  async upsert(item: T): Promise<T> {
    await this.ensureInitialized();
    return this.repository.upsert(item);
  }

  async remove(id: string): Promise<void> {
    await this.ensureInitialized();
    this.repository.remove(id);
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialization) {
      return this.initialization;
    }

    this.initialization = (async () => {
      if (this.repository.count() > 0) {
        return;
      }
      if (!this.legacyFilePath) {
        if (this.seed.length > 0) {
          this.repository.saveAll(this.seed);
        }
        return;
      }
      const legacyItems = await readLegacyItems(this.legacyFilePath, this.seed);
      if (legacyItems.length > 0) {
        this.repository.saveAll(legacyItems);
      }
    })();

    return this.initialization;
  }
}

export class AsyncSqliteKeyedJsonRepository<T> {
  private readonly repository: SqliteKeyedJsonRepository<T>;
  private initialization: Promise<void> | null = null;

  constructor(
    databasePath: string,
    tableName: string,
    private readonly keySelector: (item: T) => string,
    private readonly legacyFilePath?: string,
    private readonly seed: T[] = [],
  ) {
    this.repository = new SqliteKeyedJsonRepository<T>(openSqliteDatabase(databasePath), tableName, 'id');
  }

  async list(): Promise<T[]> {
    await this.ensureInitialized();
    return this.repository.list();
  }

  async get(key: string): Promise<T | undefined> {
    await this.ensureInitialized();
    return this.repository.get(key);
  }

  async saveAll(items: T[]): Promise<void> {
    await this.ensureInitialized();
    this.repository.saveAll(items, this.keySelector);
  }

  async upsert(item: T): Promise<T> {
    await this.ensureInitialized();
    return this.repository.upsert(this.keySelector(item), item);
  }

  async remove(key: string): Promise<void> {
    await this.ensureInitialized();
    this.repository.remove(key);
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialization) {
      return this.initialization;
    }

    this.initialization = (async () => {
      if (this.repository.count() > 0) {
        return;
      }
      if (!this.legacyFilePath) {
        if (this.seed.length > 0) {
          this.repository.saveAll(this.seed, this.keySelector);
        }
        return;
      }
      const legacyItems = await readLegacyItems(this.legacyFilePath, this.seed);
      if (legacyItems.length > 0) {
        this.repository.saveAll(legacyItems, this.keySelector);
      }
    })();

    return this.initialization;
  }
}
