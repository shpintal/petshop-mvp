"use client";
/** Ідентифікатор кошика гостя/клієнта зберігається локально; сам кошик — на сервері (API). */
export const getCartId = () => (typeof window === "undefined" ? null : localStorage.getItem("cartId"));
export const getToken = () => (typeof window === "undefined" ? null : localStorage.getItem("token"));
export const authHeaders = (): Record<string, string> => { const t = getToken(); return t ? { authorization: `Bearer ${t}` } : {}; };
export async function ensureCart(): Promise<string> {
  const id = getCartId(); if (id) return id;
  const r = await fetch("/api/v1/carts", { method: "POST", headers: authHeaders() }); const j = await r.json();
  localStorage.setItem("cartId", j.id); return j.id;
}
export const notifyCart = (count: number) => { localStorage.setItem("cartCount", String(count)); window.dispatchEvent(new CustomEvent("cart", { detail: count })); };
