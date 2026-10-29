import { createDb } from "./db/client.js";
import { migrate } from "./db/migrate.js";
import { seed } from "./db/seed.js";
import { createApp } from "./app.js";

const h = await createDb();
await migrate(h.db);
if (process.env.DEMO_SEED !== "0") await seed(h.db);
const app = await createApp(h, { logger: true });
const port = Number(process.env.PORT ?? 4000), host = process.env.HOST ?? "127.0.0.1";
await app.listen(port, host);
console.log(`API: http://${host}:${port}/api/v1  (db driver: ${h.driver})`);
const shutdown = async () => { await app.close(); await h.close(); process.exit(0); };
process.on("SIGINT", shutdown); process.on("SIGTERM", shutdown);
