import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// Use Railway's mounted volume if present, otherwise fall back to project root
const dbPath = fs.existsSync('/data')
  ? '/data/atlas.db'
  : path.resolve(__dirname, '../../atlas.db');

const db = new Database(dbPath);

// Run schema immediately so the table exists before any module calls db.prepare()
db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    account_number TEXT NOT NULL UNIQUE,
    debtor_name    TEXT NOT NULL,
    phone_number   TEXT,
    balance        REAL NOT NULL,
    status         TEXT NOT NULL,
    client_name    TEXT NOT NULL,
    created_at     TEXT DEFAULT (datetime('now')),
    updated_at     TEXT DEFAULT (datetime('now'))
  )
`);

export default db;
