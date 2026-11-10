# news-app-auto-api

Structured Node.js API built with Express, TypeScript, and Zod validation.

## Features

- Type-safe API with strict TypeScript configuration
- Resource-based route and controller modules
- Request validation using Zod schemas
- Centralized error handling and not-found middleware
- Security and API middleware (`helmet`, `cors`, `morgan`)
- Basic tests with Vitest and Supertest

## Project Structure

```text
src/
  config/
  controllers/
    health/
  middleware/
  routes/
    health/
  schemas/
  types/
  utils/
  app.ts
  server.ts
tests/
```

## Quick Start

```bash
npm install
npm run dev
```

API base URL: `http://localhost:3000/api`

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to `dist`
- `npm run start` - Run compiled server
- `npm run test:unit` - Run unit tests with dummy configuration and mocked dependencies
- `npm run test:integration` - Apply migrations and run PostgreSQL integration tests (requires `TEST_DB_URL`)
- `npm test` - Run both suites; integration configuration is required
- `npm run db:migrate` - Apply pending SQL migrations to `DB_URL`

## Database regression tests

Use a disposable PostgreSQL 16 database. Integration tests **delete test rows and
install failure triggers** in the dedicated database. They require `TEST_DB_URL`
and never use the app's `DB_URL` as a fallback. The database name must end in
`_test`. Do not supply the live database URL.

```bash
docker run --rm -d --name newsapi-test-db \
  -p 127.0.0.1:55432:5432 \
  -e POSTGRES_USER=news_test -e POSTGRES_PASSWORD=local_test \
  -e POSTGRES_DB=newsapi_test postgres:16
docker exec newsapi-test-db pg_isready -U news_test -d newsapi_test
# Continue once pg_isready reports accepting connections.
TEST_DB_URL=postgresql://news_test:local_test@127.0.0.1:55432/newsapi_test npm test
docker stop newsapi-test-db
```

The integration suite runs migrations in filename order against the empty
database, then checks a second migration run is a no-op. The migration runner
records filenames and SHA-256 checksums in `public.newsapi_migrations` and applies
pending files under a transaction and advisory lock. Keep applied SQL files
unchanged; add a new migration for later schema changes. Existing installations
that applied SQL manually need their schema and migration ledger reconciled
before using this runner; it is not automatically run during deployment.

The complex-loader regression test stubs search, classification, embeddings, and
synthesis while using real PostgreSQL for both writes. A trigger confirms the
feed insert has happened, then rejects the candidate audit insert. The test
asserts HTTP 500, no new feed or audit rows, and the prior feed remains readable.
It also covers successful publication, a feed-insert failure, and an audit-only
run. Unit tests inject failures at each external stage and verify publication
never starts. All search and model calls are stubbed; NiFi is not needed.

## Continuous integration and deployment

Every push and pull request runs a build, unit tests, and PostgreSQL integration
tests on GitHub-hosted runners. Each integration job gets a fresh PostgreSQL
service with job-only credentials. No production database or model key is used.
After a push to `main` passes both jobs, the self-hosted deployment job rebuilds
the exact tested commit. Feature-branch and pull-request jobs do not deploy.

## Endpoints

### Health

- `GET /api/health`


