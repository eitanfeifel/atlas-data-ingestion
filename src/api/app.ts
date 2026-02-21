import express from 'express';
import { initSchema } from '../db/schema';
import accountsRouter from './routes/accounts';

initSchema();

const app = express();
app.use(express.json());
app.get('/', (_req, res) => res.sendStatus(200));
app.use('/accounts', accountsRouter);

export default app;
