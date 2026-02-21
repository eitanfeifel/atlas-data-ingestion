import fs from 'fs';
import os from 'os';
import path from 'path';
import { runIngest, IngestSummary } from '../ingest';
import db from '../../db/client';
import { Account } from '../../types';

// All test rows use this prefix so afterAll can clean them up in one shot
const PREFIX = 'INGEST_TEST_';

function writeTempCsv(content: string): string {
  const tmpPath = path.join(os.tmpdir(), `ingest_test_${Date.now()}_${Math.random()}.csv`);
  fs.writeFileSync(tmpPath, content);
  return tmpPath;
}

function getRow(accountNumber: string): Account | undefined {
  return db
    .prepare('SELECT * FROM accounts WHERE account_number = ?')
    .get(accountNumber) as Account | undefined;
}

afterAll(() => {
  db.prepare(`DELETE FROM accounts WHERE account_number LIKE '${PREFIX}%'`).run();
});

describe('runIngest — happy path', () => {
  it('inserts valid rows and returns correct summary counts', () => {
    const csv = `account_number,debtor_name,phone_number,balance,status,client_name
${PREFIX}001,Alice Smith,555-111-1111,1000.00,Active,Chase Bank
${PREFIX}002,Bob Jones,555-222-2222,500.50,Closed,Wells Fargo`;

    const tmp = writeTempCsv(csv);
    const summary: IngestSummary = runIngest(tmp);
    fs.unlinkSync(tmp);

    expect(summary.total).toBe(2);
    expect(summary.inserted).toBe(2);
    expect(summary.updated).toBe(0);
    expect(summary.skipped).toBe(0);
    expect(summary.errors).toHaveLength(0);
  });

  it('stores all fields correctly in the database', () => {
    const row = getRow(`${PREFIX}001`);

    expect(row).toBeDefined();
    expect(row!.account_number).toBe(`${PREFIX}001`);
    expect(row!.debtor_name).toBe('Alice Smith');
    expect(row!.phone_number).toBe('555-111-1111');
    expect(row!.balance).toBe(1000.0);
    expect(row!.status).toBe('Active');
    expect(row!.client_name).toBe('Chase Bank');
  });
});

describe('runIngest — duplicate account_number (upsert)', () => {
  it('counts first occurrence as insert and second as update', () => {
    const csv = `account_number,debtor_name,phone_number,balance,status,client_name
${PREFIX}003,Carol Lee,555-333-3333,200.00,Active,Discover
${PREFIX}003,Carol Lee,555-333-3333,999.99,Active,Discover`;

    const tmp = writeTempCsv(csv);
    const summary = runIngest(tmp);
    fs.unlinkSync(tmp);

    expect(summary.total).toBe(2);
    expect(summary.inserted).toBe(1);
    expect(summary.updated).toBe(1);
    expect(summary.skipped).toBe(0);
  });

  it('stores the updated balance after upsert', () => {
    const row = getRow(`${PREFIX}003`);

    expect(row!.balance).toBe(999.99);
  });

  it('overwrites an existing row when run again with new data', () => {
    const csv = `account_number,debtor_name,phone_number,balance,status,client_name
${PREFIX}003,Carol Lee,555-333-3333,1.00,Closed,Discover`;

    const tmp = writeTempCsv(csv);
    const summary = runIngest(tmp);
    fs.unlinkSync(tmp);

    expect(summary.updated).toBe(1);
    expect(summary.inserted).toBe(0);
    expect(getRow(`${PREFIX}003`)!.balance).toBe(1.0);
  });
});

describe('runIngest — validation: missing account_number', () => {
  it('skips the row and records an error', () => {
    const csv = `account_number,debtor_name,phone_number,balance,status,client_name
,Missing Account,555-000-0001,300.00,Active,Chase Bank`;

    const tmp = writeTempCsv(csv);
    const summary = runIngest(tmp);
    fs.unlinkSync(tmp);

    expect(summary.total).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(summary.inserted).toBe(0);
    expect(summary.errors[0]).toMatch(/Missing account_number/);
  });
});

describe('runIngest — validation: non-numeric balance', () => {
  it('skips the row and records an error naming the bad value', () => {
    const csv = `account_number,debtor_name,phone_number,balance,status,client_name
${PREFIX}004,Dave Brown,555-444-4444,notanumber,Active,Capital One`;

    const tmp = writeTempCsv(csv);
    const summary = runIngest(tmp);
    fs.unlinkSync(tmp);

    expect(summary.total).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(summary.inserted).toBe(0);
    expect(summary.errors[0]).toMatch(/Invalid balance/);
    expect(summary.errors[0]).toMatch(/notanumber/);
  });
});

describe('runIngest — validation: missing required fields', () => {
  it('skips a row with an empty debtor_name', () => {
    const csv = `account_number,debtor_name,phone_number,balance,status,client_name
${PREFIX}005,,555-555-5555,400.00,Active,Wells Fargo`;

    const tmp = writeTempCsv(csv);
    const summary = runIngest(tmp);
    fs.unlinkSync(tmp);

    expect(summary.skipped).toBe(1);
    expect(summary.errors[0]).toMatch(/Missing required field/);
  });

  it('skips a row with an empty status', () => {
    const csv = `account_number,debtor_name,phone_number,balance,status,client_name
${PREFIX}005,Dave Brown,555-555-5555,400.00,,Wells Fargo`;

    const tmp = writeTempCsv(csv);
    const summary = runIngest(tmp);
    fs.unlinkSync(tmp);

    expect(summary.skipped).toBe(1);
    expect(summary.errors[0]).toMatch(/Missing required field/);
  });

  it('skips a row with an empty client_name', () => {
    const csv = `account_number,debtor_name,phone_number,balance,status,client_name
${PREFIX}005,Dave Brown,555-555-5555,400.00,Active,`;

    const tmp = writeTempCsv(csv);
    const summary = runIngest(tmp);
    fs.unlinkSync(tmp);

    expect(summary.skipped).toBe(1);
    expect(summary.errors[0]).toMatch(/Missing required field/);
  });
});

describe('runIngest — optional field: phone_number', () => {
  it('stores null for an empty phone_number and still inserts the row', () => {
    const csv = `account_number,debtor_name,phone_number,balance,status,client_name
${PREFIX}006,Eve Turner,,750.00,Active,Amex`;

    const tmp = writeTempCsv(csv);
    const summary = runIngest(tmp);
    fs.unlinkSync(tmp);

    expect(summary.inserted).toBe(1);
    expect(summary.skipped).toBe(0);
    expect(getRow(`${PREFIX}006`)!.phone_number).toBeNull();
  });
});

describe('runIngest — mixed valid and invalid rows', () => {
  it('inserts valid rows and skips invalid ones in a single pass', () => {
    const csv = `account_number,debtor_name,phone_number,balance,status,client_name
${PREFIX}007,Frank Green,555-777-7777,100.00,Active,Chase Bank
,Missing Name,555-888-8888,200.00,Active,Chase Bank
${PREFIX}008,Grace Hall,555-999-9999,badbalance,Active,Chase Bank
${PREFIX}009,Henry King,555-000-0000,300.00,Closed,Wells Fargo`;

    const tmp = writeTempCsv(csv);
    const summary = runIngest(tmp);
    fs.unlinkSync(tmp);

    expect(summary.total).toBe(4);
    expect(summary.inserted).toBe(2);
    expect(summary.skipped).toBe(2);
    expect(summary.errors).toHaveLength(2);

    expect(getRow(`${PREFIX}007`)).toBeDefined();
    expect(getRow(`${PREFIX}009`)).toBeDefined();
    expect(getRow(`${PREFIX}008`)).toBeUndefined(); // bad balance — never inserted
  });
});
