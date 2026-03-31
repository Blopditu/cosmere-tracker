import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export type SqliteDatabase = Database.Database;

export function openSqliteDatabase(filePath: string): SqliteDatabase {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const database = new Database(filePath);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
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
