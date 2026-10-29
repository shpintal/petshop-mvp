import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { sql } from "drizzle-orm";
import type { Db } from "./client.js";

const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../migrations");

/** Застосовує SQL-міграції з каталогу `migrations/` у лексикографічному порядку (ідемпотентно). */
export async function migrate(db: Db, dir = MIGRATIONS_DIR): Promise<string[]> {
  await db.execute(sql`create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())`);
  const res = (await db.execute(sql`select name from _migrations`)) as unknown as { rows: { name: string }[] };
  const done = new Set(res.rows.map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const applied: string[] = [];
  for (const f of files) {
    if (done.has(f)) continue;
    const text = await readFile(path.join(dir, f), "utf8");
    const statements = text.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
    await db.transaction(async (tx) => {
      for (const st of statements) await tx.execute(sql.raw(st));
      await tx.execute(sql`insert into _migrations(name) values (${f})`);
    });
    applied.push(f);
  }
  return applied;
}
