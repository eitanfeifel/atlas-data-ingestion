import Database from 'better-sqlite3';
import path from 'path';

const dbPath = process.env.DATABASE_PATH ?? path.resolve(__dirname, '../../atlas.db');
const db = new Database(dbPath);

export default db;
