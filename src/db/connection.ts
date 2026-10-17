import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { SCHEMA } from './schema.js';

export type Db = Database.Database;

export function openDb(path: string): Db {
    if (path !== ':memory:') {
        mkdirSync(dirname(path), { recursive: true });
    }
    const db = new Database(path);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(SCHEMA);
    return db;
}

export function isDbUp(db: Db): boolean {
    try {
        db.prepare('SELECT 1').get();
        return true;
    } catch {
        return false;
    }
}
