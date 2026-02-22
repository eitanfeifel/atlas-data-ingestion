# Atlas Data Ingestion

REST API that ingests debtor account data from a CSV file into SQLite and exposes it for lookup by account number.

## Stack

- **Runtime:** Node.js + TypeScript (ts-node, no build step)
- **Database:** SQLite via better-sqlite3
- **API:** Express 5
- **Tests:** Jest + ts-jest + supertest
- **Hosting:** Railway (persistent volume at `/data`)

## Project Structure

```
src/
  api/
    app.ts               # Express app setup
    server.ts            # HTTP server entry point (binds port, runs ingest)
    routes/accounts.ts   # GET /accounts route handlers
    __tests__/           # API integration tests
  db/
    client.ts            # SQLite connection + schema creation
    schema.ts            # initSchema() helper
  ingest/
    ingest.ts            # CSV ingestion logic (runIngest)
    __tests__/           # Ingestion unit tests
  types/index.ts         # Shared TypeScript types
data/
  atlas_inventory.csv    # Source CSV file
```

## API

### GET /accounts/:accountNumber
### GET /accounts?account_number=ACC1001

Returns account details for the given account number.

**Response 200:**
```json
{
  "account_number": "ACC1001",
  "debtor_name": "John Doe",
  "phone_number": "555-123-4567",
  "balance": 1250.50,
  "status": "Active",
  "client_name": "Chase Bank"
}
```

**Response 404:**
```json
{ "error": "Account not found" }
```

## CSV Format

The ingestion script expects `data/atlas_inventory.csv` with the following columns:

| Column | Required | Notes |
|--------|----------|-------|
| `account_number` | Yes | Must be present and unique. Rows without it are skipped. |
| `debtor_name` | Yes | Skipped if blank. |
| `balance` | Yes | Must be a valid number. Skipped if non-numeric. |
| `status` | Yes | Skipped if blank. |
| `client_name` | Yes | Skipped if blank. |
| `phone_number` | No | Stored as null if missing. |

Extra columns are ignored. Duplicate `account_number` rows trigger an upsert — the existing record is updated with the latest values.

## Running Locally

```bash
npm install
npm start        # Ingests CSV then starts the API server on port 3000
```

Run just the ingestion script:
```bash
npm run ingest
```

Run tests:
```bash
npm test
```

## Deployment (Railway)

The `start` script (`ts-node src/api/server.ts`) is the deployment command. On startup:

1. The HTTP server binds the port immediately (Railway health check passes)
2. The CSV is ingested into SQLite in the listen callback
3. The API is ready to serve requests

The SQLite database is stored on a Railway persistent volume mounted at `/data/atlas.db`. Locally it falls back to `atlas.db` in the project root.

**Required Railway configuration:**
- Networking → Target port: `8080`
- Volume mounted at `/data`
