import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// Use Railway's mounted volume if present, otherwise fall back to project root
const dbPath = fs.existsSync('/data')
  ? '/data/atlas.db'
  : path.resolve(__dirname, '../../atlas.db');

const db = new Database(dbPath);

export default db;
