"use client";
import { useState } from "react";
import { ensureCart, authHeaders, notifyCart } from "./cart-store";
export function AddToCart({ variantId, disabled }: { variantId: number; disabled?: boolean }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  async function add() {
    setState("busy");
    try {
      let id = await ensureCart();
      let r = await fetch(`/api/v1/carts/${id}/items`, { method: "POST", headers: { "content-type": "application/json", ...authHeaders() }, body: JSON.stringify({ variantId, qty: 1 }) });
      if (r.status === 404) { localStorage.removeItem("cartId"); id = await ensureCart();
        r = await fetch(`/api/v1/carts/${id}/items`, { method: "POST", headers: { "content-type": "application/json", ...authHeaders() }, body: JSON.stringify({ variantId, qty: 1 }) }); }
      if (!r.ok) throw new Error(String(r.status));
      const cart = await r.json(); notifyCart(cart.items.reduce((a: number, i: { qty: number }) => a + i.qty, 0)); setState("done");
    } catch { setState("error"); }
  }
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <button className="btn" onClick={add} disabled={disabled || state === "busy"}>{disabled ? "Немає в наявності" : state === "busy" ? "Додаємо…" : "Купити"}</button>
      {state === "done" && <a href="/cart" className="ok">Додано — перейти до кошика</a>}{state === "error" && <span className="error">Не вдалося додати</span>}
    </div>
  );
}
