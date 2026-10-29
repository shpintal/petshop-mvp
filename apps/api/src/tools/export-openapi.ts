import { writeFile } from "node:fs/promises";
import { createDb } from "../db/client.js";
import { createApp, openApiDocument } from "../app.js";
const h = await createDb("pglite://memory");
const app = await createApp(h);
const doc = openApiDocument(app);
await writeFile("openapi.json", JSON.stringify(doc, null, 2));
console.log(`openapi.json: ${Object.keys(doc.paths).length} paths`);
await app.close(); await h.close();
