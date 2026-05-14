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
- `npm run test` - Run tests once

## Endpoints

### Health

- `GET /api/health`


