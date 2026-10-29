/**
 * Генерує SQL-міграцію з TypeScript-схеми через програмний API drizzle-kit
 * (без CLI). Використання: node dist/db/tools/generate-migration.js <name>
 */
import { createRequire } from "node:module";
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import path from "node:path";
import * as schema from "../schema.js";

const require = createRequire(import.meta.url);
const { generateDrizzleJson, generateMigration } = require("drizzle-kit/api") as typeof import("drizzle-kit/api");

const dir = path.resolve("migrations");
await mkdir(path.join(dir, "meta"), { recursive: true });
const snapPath = path.join(dir, "meta", "snapshot.json");
let prev: any;
try { prev = JSON.parse(await readFile(snapPath, "utf8")); } catch { prev = generateDrizzleJson({}); }
const cur = generateDrizzleJson(schema as Record<string, unknown>, prev.id);
const statements = await generateMigration(prev, cur);
if (statements.length === 0) { console.log("Схема не змінилась — міграція не потрібна"); process.exit(0); }
const n = (await readdir(dir)).filter((f) => f.endsWith(".sql")).length;
const name = `${String(n).padStart(4, "0")}_${process.argv[2] ?? "auto"}.sql`;
await writeFile(path.join(dir, name), statements.join("\n--> statement-breakpoint\n") + "\n");
await writeFile(snapPath, JSON.stringify(cur, null, 2));
console.log(`Створено migrations/${name}: ${statements.length} statements`);
