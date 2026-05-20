import pg from "pg";
import { Kysely, PostgresDialect } from "kysely";
import { env } from "./env.js";
import type { DB } from "./db.types.js";

export const db = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool: new pg.Pool({ connectionString: env.DB_URL })
  })
});

