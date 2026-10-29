// Запускає API і вітрину в одному контейнері; якщо будь-який процес падає — завершуємо контейнер,
// щоб Render його перезапустив, а не лишив напівживим.
import { spawn } from "node:child_process";
import path from "node:path";

const root = process.env.APP_ROOT ?? "/app";
const procs = [
  spawn("node", ["--max-old-space-size=160", "dist/main.js"], {
    cwd: path.join(root, "api"), stdio: "inherit", env: { ...process.env, PORT: process.env.API_PORT ?? "4000", HOST: "127.0.0.1" },
  }),
  spawn("node", ["--max-old-space-size=240", "node_modules/next/dist/bin/next", "start", "-p", process.env.PORT ?? "10000", "-H", "0.0.0.0"], {
    cwd: path.join(root, "web"), stdio: "inherit",
  }),
];
for (const p of procs) p.on("exit", (code) => { for (const q of procs) q.kill(); process.exit(code ?? 1); });
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => { for (const p of procs) p.kill(sig); });
