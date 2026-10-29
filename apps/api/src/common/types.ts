import type { Db } from "../db/client.js";
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Executor = Db | Tx;
export const rowsOf = <T>(res: unknown): T[] => ((res as { rows?: T[] }).rows ?? []);
