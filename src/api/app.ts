import express from 'express';
import { initSchema } from '../db/schema';
import accountsRouter from './routes/accounts';

initSchema();

const app = express();
app.use(express.json());
app.use('/accounts', accountsRouter);

export default app;
