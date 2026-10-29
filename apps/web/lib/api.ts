// Використовується лише в серверних компонентах (у проді — пакет `server-only`).
/** Серверний клієнт Commerce API. У проді типи генеруються з openapi.json (openapi-typescript). */
const API_URL = process.env.API_URL ?? "http://127.0.0.1:4000/api/v1";
export class ApiError extends Error { constructor(public status: number, msg: string) { super(msg); } }
export async function api<T>(path: string, init?: RequestInit & { revalidate?: number; tags?: string[] }): Promise<T> {
  const res = await fetch(API_URL + path, { ...init, next: { revalidate: init?.revalidate ?? 60, tags: init?.tags } });
  if (!res.ok) throw new ApiError(res.status, `${res.status} ${path}`);
  return res.json() as Promise<T>;
}
