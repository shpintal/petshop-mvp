"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getCartId, authHeaders, notifyCart } from "@/components/client/cart-store";
import { uah } from "@/lib/format";

type Line = { variantId: number; productSlug: string; name: string; packLabel: string; qty: number; unitPrice: number; net: number; oldPrice: number | null; available: number; appliedRule: { label: string; percent: number } };
type Cart = { id: string; items: Line[]; tierCode: string | null; quote: { subtotal: number; discount: number; total: number } | null };

export default function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null); const [loading, setLoading] = useState(true);
  async function load() { const id = getCartId(); if (!id) { setLoading(false); return; }
    const r = await fetch(`/api/v1/carts/${id}`, { headers: authHeaders() }); if (r.ok) { const c = await r.json(); setCart(c); notifyCart(c.items.reduce((a: number, i: Line) => a + i.qty, 0)); } setLoading(false); }
  useEffect(() => { load(); }, []);
  async function setQty(variantId: number, qty: number) {
    const r = await fetch(`/api/v1/carts/${cart!.id}/items/${variantId}`, { method: "PUT", headers: { "content-type": "application/json", ...authHeaders() }, body: JSON.stringify({ qty }) });
    if (r.ok) { const c = await r.json(); setCart(c); notifyCart(c.items.reduce((a: number, i: Line) => a + i.qty, 0)); }
  }
  if (loading) return <><h1>Кошик</h1><p>Завантаження…</p></>;
  if (!cart || cart.items.length === 0) return <><h1>Кошик</h1><p>Кошик порожній. <Link href="/">Перейти до каталогу</Link></p></>;
  return (
    <>
      <h1>Кошик</h1>
      <div className="layout-cat" style={{ gridTemplateColumns: "1fr 320px" }}>
        <section className="card">{cart.items.map((l) => (
          <div key={l.variantId} style={{ display: "flex", gap: 12, justifyContent: "space-between", borderBottom: "1px solid var(--line)", padding: "10px 0" }}>
            <div><Link href={`/p/${l.productSlug}?v=${l.variantId}`}><b>{l.name}</b></Link><div className="muted">{l.packLabel} · {uah(l.unitPrice)}/шт · {l.appliedRule.label}</div>
              {l.qty > l.available && <div className="error">Доступно лише {l.available} шт.</div>}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button className="btn secondary" aria-label="Зменшити" onClick={() => setQty(l.variantId, l.qty - 1)}>−</button><span aria-live="polite">{l.qty}</span>
              <button className="btn secondary" aria-label="Збільшити" onClick={() => setQty(l.variantId, l.qty + 1)}>+</button>
              <b style={{ minWidth: 90, textAlign: "right" }}>{uah(l.net)}</b></div>
          </div>))}</section>
        <aside className="card" style={{ alignSelf: "start", display: "grid", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Товари</span><span>{uah(cart.quote!.subtotal)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }} className="ok"><span>Знижка{cart.tierCode ? ` (картка ${cart.tierCode})` : ""}</span><span>−{uah(cart.quote!.discount)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20 }}><b>Разом</b><b>{uah(cart.quote!.total)}</b></div>
          {!cart.tierCode && <p className="muted">Увійдіть у <Link href="/account">кабінет</Link>, щоб отримати знижку за карткою.</p>}
          <Link className="btn" href="/checkout">Оформити замовлення</Link>
        </aside>
      </div>
    </>
  );
}
