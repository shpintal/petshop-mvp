/** Створює/оновлює БД: міграції + сід. node dist/db/tools/reset.js */
import { createDb } from "../client.js";
import { migrate } from "../migrate.js";
import { seed } from "../seed.js";
const h = await createDb();
console.log("driver:", h.driver, "migrations applied:", await migrate(h.db));
console.log("seed:", JSON.stringify(await seed(h.db)));
await h.close();
