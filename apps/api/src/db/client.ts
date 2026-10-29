import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import pg from "pg";
import { mkdirSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema.js";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export const DB = Symbol("DB");

export interface DbHandle { db: Db; close(): Promise<void>; driver: "pglite" | "node-postgres"; }

/**
 * ADR-0003: один код доступу до даних, два драйвери.
 *  - `pglite://memory` або `pglite://<dir>` — PostgreSQL у WASM in-process (dev, тести, демо)
 *  - `postgres://…` — node-postgres (staging/prod)
 */
export async function createDb(url = process.env.DATABASE_URL ?? "pglite://./.data/petshop"): Promise<DbHandle> {
  if (url.startsWith("pglite://")) {
    const target = url.slice("pglite://".length);
    // PGlite не створює батьківські каталоги — створюємо їх самі (свіжий checkout без .data/)
    if (target !== "memory") mkdirSync(path.dirname(path.resolve(target)), { recursive: true });
    const client = target === "memory"
      ? new PGlite({ extensions: { pg_trgm } })
      : new PGlite(target, { extensions: { pg_trgm } });
    await client.waitReady;
    const db = drizzlePglite(client, { schema }) as unknown as Db;
    return { db, driver: "pglite", close: () => client.close() };
  }
  const pool = new pg.Pool({ connectionString: url, max: Number(process.env.DB_POOL_MAX ?? 10) });
  const db = drizzlePg(pool, { schema }) as unknown as Db;
  return { db, driver: "node-postgres", close: () => pool.end() };
}
