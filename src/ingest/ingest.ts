import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import db from '../db/client';
import { initSchema } from '../db/schema';
import { Account, RawCSVRow } from '../types';

export interface IngestSummary {
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export function runIngest(csvPath: string): IngestSummary {
  initSchema();

  const summary: IngestSummary = {
    total: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  const fileContent = fs.readFileSync(csvPath);
  const rows: RawCSVRow[] = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const validRows: Account[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    summary.total++;

    const accountNumber = row.account_number?.trim();
    if (!accountNumber) {
      const msg = `Row ${rowNum}: Missing account_number — skipped`;
      console.warn(`Warning: ${msg}`);
      summary.errors.push(msg);
      summary.skipped++;
      continue;
    }

    const rawBalance = row.balance?.trim();
    const balance = parseFloat(rawBalance ?? '');
    if (!isFinite(balance)) {
      const msg = `Row ${rowNum}: Invalid balance "${rawBalance}" — skipped`;
      console.warn(`Warning: ${msg}`);
      summary.errors.push(msg);
      summary.skipped++;
      continue;
    }

    const debtorName = row.debtor_name?.trim();
    const status = row.status?.trim();
    const clientName = row.client_name?.trim();

    if (!debtorName || !status || !clientName) {
      const msg = `Row ${rowNum}: Missing required field (debtor_name, status, or client_name) — skipped`;
      console.warn(`Warning: ${msg}`);
      summary.errors.push(msg);
      summary.skipped++;
      continue;
    }

    const phoneNumber = row.phone_number?.trim() || null;

    validRows.push({
      account_number: accountNumber,
      debtor_name: debtorName,
      phone_number: phoneNumber,
      balance,
      status,
      client_name: clientName,
    });
  }

  const checkExists = db.prepare<[string], { id: number }>(
    'SELECT id FROM accounts WHERE account_number = ?'
  );

  const upsertStmt = db.prepare(`
    INSERT INTO accounts (account_number, debtor_name, phone_number, balance, status, client_name, updated_at)
    VALUES (@account_number, @debtor_name, @phone_number, @balance, @status, @client_name, datetime('now'))
    ON CONFLICT(account_number) DO UPDATE SET
      debtor_name  = excluded.debtor_name,
      phone_number = excluded.phone_number,
      balance      = excluded.balance,
      status       = excluded.status,
      client_name  = excluded.client_name,
      updated_at   = datetime('now')
  `);

  const runTransaction = db.transaction((accounts: Account[]) => {
    for (const account of accounts) {
      const existing = checkExists.get(account.account_number);
      upsertStmt.run(account);
      if (existing) {
        summary.updated++;
      } else {
        summary.inserted++;
      }
    }
  });

  runTransaction(validRows);

  return summary;
}

// Script entry point — only executes when run directly (npm run ingest)
if (require.main === module) {
  const csvPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(__dirname, '../../data/atlas_inventory.csv');

  if (!fs.existsSync(csvPath)) {
    console.error(`Error: CSV file not found at ${csvPath}`);
    process.exit(1);
  }

  const summary = runIngest(csvPath);

  console.log(`\nIngest complete.`);
  console.log(`  Total rows:   ${summary.total}`);
  console.log(`  Inserted:     ${String(summary.inserted).padStart(2)}`);
  console.log(`  Updated:      ${String(summary.updated).padStart(2)}`);
  console.log(`  Skipped:      ${String(summary.skipped).padStart(2)}`);

  if (summary.errors.length > 0) {
    console.log(`\nWarnings:`);
    for (const err of summary.errors) {
      console.log(`  ${err}`);
    }
  }
}
