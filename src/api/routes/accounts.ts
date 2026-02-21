import { Router } from 'express';
import db from '../../db/client';
import { Account } from '../../types';

const router = Router();

const getAccountStmt = db.prepare<[string], Account>(`
  SELECT account_number, debtor_name, phone_number, balance, status, client_name
  FROM accounts
  WHERE account_number = ?
`);

function lookupAccount(accountNumber: string, res: import('express').Response): void {
  const result = getAccountStmt.get(accountNumber);
  if (result === undefined) {
    res.status(404).json({ error: 'Account not found' });
  } else {
    res.status(200).json(result as Account);
  }
}

// GET /accounts?account_number=ACC1001
router.get('/', (req, res) => {
  try {
    const accountNumber = req.query.account_number;
    if (typeof accountNumber !== 'string' || accountNumber.trim() === '') {
      res.status(400).json({ error: 'Missing required query parameter: account_number' });
      return;
    }
    lookupAccount(accountNumber.trim(), res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /accounts/:accountNumber
router.get('/:accountNumber', (req, res) => {
  try {
    const { accountNumber } = req.params;
    lookupAccount(accountNumber, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
