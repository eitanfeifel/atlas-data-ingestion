import db from './client';

export function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_number TEXT NOT NULL UNIQUE,
      debtor_name TEXT NOT NULL,
      phone_number TEXT,
      balance REAL NOT NULL,
      status TEXT NOT NULL,
      client_name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
}
