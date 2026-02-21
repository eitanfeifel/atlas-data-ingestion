import request from 'supertest';
import app from '../app';
import db from '../../db/client';

const TEST_ACCOUNT = {
  account_number: 'TEST_001',
  debtor_name: 'Test User',
  phone_number: '555-000-0000',
  balance: 1234.56,
  status: 'Active',
  client_name: 'Test Bank',
};

beforeAll(() => {
  db.prepare(`
    INSERT OR REPLACE INTO accounts
      (account_number, debtor_name, phone_number, balance, status, client_name)
    VALUES
      (@account_number, @debtor_name, @phone_number, @balance, @status, @client_name)
  `).run(TEST_ACCOUNT);
});

afterAll(() => {
  db.prepare('DELETE FROM accounts WHERE account_number = ?').run(TEST_ACCOUNT.account_number);
});

const EXPECTED_BODY = {
  account_number: TEST_ACCOUNT.account_number,
  debtor_name: TEST_ACCOUNT.debtor_name,
  phone_number: TEST_ACCOUNT.phone_number,
  balance: TEST_ACCOUNT.balance,
  status: TEST_ACCOUNT.status,
  client_name: TEST_ACCOUNT.client_name,
};

describe('GET /accounts/:accountNumber', () => {
  it('returns 200 and the correct account data for a valid account number', async () => {
    const res = await request(app).get(`/accounts/${TEST_ACCOUNT.account_number}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject(EXPECTED_BODY);
  });

  it('returns 404 for a non-existent account number', async () => {
    const res = await request(app).get('/accounts/DOES_NOT_EXIST');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Account not found' });
  });
});

describe('GET /accounts?account_number=...', () => {
  it('returns 200 and the correct account data for a valid account_number query param', async () => {
    const res = await request(app).get(`/accounts?account_number=${TEST_ACCOUNT.account_number}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject(EXPECTED_BODY);
  });

  it('returns 404 for a non-existent account_number query param', async () => {
    const res = await request(app).get('/accounts?account_number=DOES_NOT_EXIST');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Account not found' });
  });

  it('returns 400 when account_number query param is missing', async () => {
    const res = await request(app).get('/accounts');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Missing required query parameter: account_number' });
  });
});
