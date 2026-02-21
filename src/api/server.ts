import fs from 'fs';
import path from 'path';
import app from './app';
import { runIngest } from '../ingest/ingest';

const port = Number(process.env.PORT ?? 3000);

// Bind the port first so Railway's health check passes immediately,
// then run the ingest synchronously inside the callback.
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);

  const csvPath = path.resolve(__dirname, '../../data/atlas_inventory.csv');

  if (fs.existsSync(csvPath)) {
    const summary = runIngest(csvPath);
    console.log(
      `Ingest complete: inserted=${summary.inserted} updated=${summary.updated} skipped=${summary.skipped}`
    );
  } else {
    console.log(`No CSV found at ${csvPath}, skipping ingest`);
  }
});
