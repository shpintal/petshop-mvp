// Використовується лише в серверних компонентах (у проді — пакет `server-only`).
/** Серверний клієнт Commerce API. У проді типи генеруються з openapi.json (openapi-typescript). */
const API_URL = process.env.API_URL ?? "http://127.0.0.1:4000/api/v1";
// Render free: API (і Neon під ним) засинає після простою і прокидається до ~1,5 хв,
// віддаючи 5xx, обриваючи або підвішуючи з'єднання
const RETRY_STATUS = new Set([502, 503, 504]);
const WAKE_TIMEOUT_MS = 150_000;
const ATTEMPT_TIMEOUT_MS = 30_000;
export class ApiError extends Error { constructor(public status: number, msg: string) { super(msg); } }
export async function api<T>(path: string, init?: RequestInit & { revalidate?: number; tags?: string[] }): Promise<T> {
  const idempotent = !init?.method || init.method === "GET";
  const deadline = Date.now() + WAKE_TIMEOUT_MS;
  for (let delay = 1000; ; delay = Math.min(delay * 2, 8000)) {
    const canRetry = idempotent && Date.now() + delay < deadline;
    let res: Response;
    try {
      res = await fetch(API_URL + path, { signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS), ...init, next: { revalidate: init?.revalidate ?? 60, tags: init?.tags } });
    } catch (e) {
      if (!canRetry) throw e;
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }
    if (res.ok) return res.json() as Promise<T>;
    if (!canRetry || !RETRY_STATUS.has(res.status)) throw new ApiError(res.status, `${res.status} ${path}`);
    await new Promise((r) => setTimeout(r, delay));
  }
}
