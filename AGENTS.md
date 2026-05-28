# Agents.md — Project Guide for AI Coding Agents

## Project Overview

`news-app-auto-api` is a **TypeScript Node.js REST API** built with Express. It is designed to serve as the backend for a news UI application that uses **OpenAI's API** to automatically summarize daily and weekly news stories. The current codebase is a **template/starter** that establishes the core patterns every new feature should follow as the project grows.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js >= 20 (ESM modules) |
| Language | TypeScript |
| Web Framework | Express |
| Database | PostgreSQL via **Kysely** (query builder) |
| Caching / Pub-Sub | Redis via **ioredis** |
| Real-time | Socket.io |
| Validation | **Zod** |
| Logging | Pino (via `src/config/logger.ts`) |
| Testing | Vitest + Supertest |
| Security | Helmet, CORS |
| HTTP Logging | Morgan |

---

## Repository Structure

```
src/
  app.ts               # Express app setup — middleware registration, route mounting
  server.ts            # HTTP server bootstrap — binds port, initialises Socket.io
  config/
    db.ts              # Kysely + PostgreSQL connection
    db.types.ts        # Kysely database type definitions (table shapes)
    env.ts             # Environment variable parsing and validation
    logger.ts          # Shared Pino logger instance
    redis.ts           # ioredis client
    socket.ts          # Socket.io initialisation
  controllers/
    <resource>/
      <resource>.controller.ts
  middleware/
    errorHandler.ts    # Global Express error handler — consumes AppError
    notFound.ts        # 404 catch-all handler
    validate.ts        # Reusable Zod validation middleware factory
  routes/
    index.ts           # apiRouter — mounts all resource routers under /api
    <resource>/
      <resource>.routes.ts
  schemas/
    <resource>/
      <resource>.schemas.ts
  types/
    api.ts             # Shared API-level TypeScript types
  utils/
    appError.ts        # AppError class for structured HTTP errors
    asyncHandler.ts    # Wraps async route handlers to forward errors to Express
tests/
  <resource>.test.ts
```

---

## Core Patterns — Follow These Consistently

### 1. Resource Module Structure

Every new resource managed by the API (e.g. `article`, `summary`, `category`) must have its own dedicated folder in each of the three layers:

```
src/controllers/<resource>/<resource>.controller.ts
src/routes/<resource>/<resource>.routes.ts
src/schemas/<resource>/<resource>.schemas.ts
```

Then register the new router in `src/routes/index.ts`:

```typescript
apiRouter.use("/articles", articleRouter);
```

### 2. Controllers

- Wrap every async handler in `asyncHandler()` — this forwards thrown errors to the Express error handler automatically, keeping controllers free of try/catch boilerplate.
- Use `AppError` to throw structured HTTP errors (status code + message).
- Use explicit, descriptive variable names — avoid single-letter variables or cryptic abbreviations.

```typescript
// Good
const existingUser = await db.selectFrom("template_app.users")...

// Avoid
const u = await db.selectFrom("template_app.users")...
```

**Example pattern:**

```typescript
export const createArticleController = asyncHandler(
  async (req: Request<{}, {}, CreateArticleBody>, res: Response) => {
    const { title, content, sourceUrl } = req.body;

    const existingArticle = await db
      .selectFrom("newsapi.articles")
      .select(["id", "title"])
      .where("source_url", "=", sourceUrl)
      .executeTakeFirst();

    if (existingArticle) {
      res.status(200).json({ articleId: existingArticle.id });
      return;
    }

    const createdArticle = await db
      .insertInto("newsapi.articles")
      .values({ id: sql`gen_random_uuid()`, title, content, source_url: sourceUrl })
      .returning(["id", "title"])
      .executeTakeFirst();

    if (!createdArticle) {
      throw new AppError(500, "Failed to create article");
    }

    res.status(201).json({ articleId: createdArticle.id, title: createdArticle.title });
  }
);
```

### 3. Zod Schemas

- Every route with a request body or query parameters must have a Zod schema in `src/schemas/<resource>/`.
- Export both the schema object and its inferred TypeScript type.
- Schema names should be descriptive and match the action they validate.

```typescript
// src/schemas/article/article.schemas.ts
import { z } from "zod";

export const createArticleSchema = z.object({
  title: z.string().min(1, "title is required"),
  content: z.string().min(1, "content is required"),
  sourceUrl: z.string().url("sourceUrl must be a valid URL"),
});

export type CreateArticleBody = z.infer<typeof createArticleSchema>;
```

### 4. Route Files

- Apply the `validate` middleware with the appropriate Zod schema before the controller to ensure requests are validated before any business logic runs.
- Keep route files thin — they should only declare HTTP methods, paths, middleware, and the controller. No logic.

```typescript
// src/routes/article/article.routes.ts
import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { createArticleSchema } from "../../schemas/article/article.schemas.js";
import { createArticleController } from "../../controllers/article/article.controller.js";

export const articleRouter = Router();

articleRouter.post("/", validate(createArticleSchema), createArticleController);
```

### 5. Error Handling

- **`AppError`** — throw this whenever you need to return a specific HTTP status and message.
- **`asyncHandler`** — always wrap async controllers with this utility. Never write bare try/catch inside a controller.
- The global `errorHandler` middleware in `src/middleware/errorHandler.ts` handles all errors uniformly.

### 6. Environment Variables

- All environment variables are parsed and validated in `src/config/env.ts`.
- Always add new variables there with Zod validation — do not access `process.env` directly elsewhere in the codebase.

### 7. Database

- Use **Kysely** for all database queries. Do not use raw SQL strings except where Kysely's `sql` tagged template is explicitly needed (e.g. `sql\`gen_random_uuid()\``).
- Add new table types to `src/config/db.types.ts` whenever a new table is introduced.
- Use descriptive column alias names in query results to keep the API response shape clear.

### 8. Naming Conventions

| Thing | Convention |
|---|---|
| Variables & functions | `camelCase`, verbose and descriptive |
| Types & interfaces | `PascalCase` |
| Files | `camelCase` with role suffix (e.g. `article.controller.ts`) |
| Database columns | `snake_case` |
| API response keys | `camelCase` |
| Zod schemas | `<action><Resource>Schema` (e.g. `createArticleSchema`) |
| Controllers | `<action><Resource>Controller` (e.g. `createArticleController`) |
| Routers | `<resource>Router` (e.g. `articleRouter`) |

### 9. Modularity

- Extract any logic that is likely to be shared across multiple controllers into a dedicated utility or service file under `src/utils/` or a new `src/services/` directory.
- Prefer small, single-purpose functions over large monolithic ones.
- OpenAI integration logic (summarisation, prompt building, etc.) should live in its own service module (e.g. `src/services/openai/openai.service.ts`) and be called from controllers — never inline API calls inside a controller.

### 10. Testing

- Use **Vitest** and **Supertest** for integration tests.
- Place test files in `tests/` named after the resource they cover (e.g. `tests/article.test.ts`).
- Each test file should cover the happy path and key error cases for every route in the matching resource module.

---

## Long-Term Feature Direction

The following features represent the expected growth path. New code should be written in a way that anticipates this direction without over-engineering prematurely.

- **Articles resource** — store fetched news articles (title, content, source URL, published date, category).
- **Summaries resource** — store AI-generated summaries linked to articles; daily and weekly summary variants. OpenAI calls should be encapsulated in a service layer.
- **Categories resource** — classify articles by topic (e.g. politics, technology, sports).
- **OpenAI service** — a shared service module responsible for building prompts and calling OpenAI's API. Controllers should call this service rather than interacting with the OpenAI SDK directly.
- **Scheduled jobs** — a background job layer (e.g. using `node-cron` or a queue) to fetch new articles and trigger summarisation on a daily/weekly cadence.
- **Socket.io** — already initialised; intended for pushing real-time summary updates to connected news UI clients.
- **Redis** — already configured; intended for caching summaries and rate-limiting OpenAI API calls.

---

## What to Avoid

- Do not access `process.env` directly — use `src/config/env.ts`.
- Do not write business logic inside route files.
- Do not skip Zod validation on routes that accept user input.
- Do not use abbreviations in variable or function names when a full word is clear and readable.
- Do not inline OpenAI or third-party API calls inside controllers — put them in a service.
- Do not add try/catch inside controllers — use `asyncHandler` and let the global error handler do its job.

