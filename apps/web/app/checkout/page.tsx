"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getCartId, authHeaders, notifyCart } from "@/components/client/cart-store";
import type { DeliveryOption } from "@/lib/types";
import { uah, date } from "@/lib/format";

const PAYMENTS: Record<string, [string, string][]> = {
  own_courier: [["online_now", "Карткою онлайн зараз"], ["online_later", "Онлайн пізніше з кабінету"], ["cash_on_receipt", "Готівкою кур'єру"], ["card_on_receipt", "Карткою кур'єру"]],
  store_pickup: [["online_now", "Карткою онлайн зараз"], ["online_later", "Онлайн пізніше з кабінету"], ["cash_on_receipt", "Готівкою в магазині"], ["card_on_receipt", "Карткою в магазині"]],
  carrier_courier: [["online_now", "Карткою онлайн зараз"], ["online_later", "Онлайн пізніше з кабінету"], ["cod", "Накладений платіж"]],
  carrier_branch: [["online_now", "Карткою онлайн зараз"], ["online_later", "Онлайн пізніше з кабінету"], ["cod", "Накладений платіж"]],
};
type Result = { number: string; total: number; etaDate: string; payment: { checkout: { url: string; fields: Record<string, string> } | null } };

export default function CheckoutPage() {
  const [city, setCity] = useState("kyiv"); const [opts, setOpts] = useState<DeliveryOption[]>([]);
  const [method, setMethod] = useState(""); const [payment, setPayment] = useState("online_now");
  const [form, setForm] = useState({ phone: "+380", name: "", address: "", pickupLocationId: "", carrierBranch: "" });
  const [error, setError] = useState(""); const [result, setResult] = useState<Result | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { setCity(document.cookie.match(/(?:^|; )city=([^;]+)/)?.[1] ?? "kyiv"); }, []);
  useEffect(() => { const id = getCartId(); if (!id) return;
    fetch(`/api/v1/carts/${id}/delivery?city=${city}`, { headers: authHeaders() }).then((r) => r.json()).then((o: DeliveryOption[]) => {
      setOpts(o); const first = o.find((x) => x.available); if (first) setMethod(first.method); }); }, [city]);
  const sel = useMemo(() => opts.find((o) => o.method === method), [opts, method]);
  useEffect(() => { if (method && !PAYMENTS[method]!.some(([k]) => k === payment)) setPayment(PAYMENTS[method]![0]![0]); }, [method, payment]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setBusy(true);
    const delivery: Record<string, unknown> = { method };
    if (method === "own_courier" || method === "carrier_courier") delivery.address = form.address;
    if (method === "store_pickup") delivery.pickupLocationId = Number(form.pickupLocationId || sel?.pickupPoints?.[0]?.locationId);
    if (method === "carrier_branch") delivery.carrierBranch = form.carrierBranch || sel?.branches?.[0]?.ref;
    const r = await fetch("/api/v1/checkout", { method: "POST", headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify({ cartId: getCartId(), customer: { phone: form.phone, name: form.name }, city, delivery, payment }) });
    const j = await r.json(); setBusy(false);
    if (!r.ok) { setError(j.issues ? j.issues.map((i: { path: string; message: string }) => `${i.path}: ${i.message}`).join("; ") : j.message); return; }
    notifyCart(0); setResult(j);
  }
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <><h1>Оформлення замовлення</h1><p>Завантаження…</p></>;
  if (!getCartId() && !result) return <><h1>Оформлення замовлення</h1><p>Кошик порожній. <Link href="/">До каталогу</Link></p></>;
  if (result) return (
    <div className="card form"><h1>Замовлення {result.number} прийнято</h1><p>Сума: <b>{uah(result.total)}</b>. Орієнтовна дата: <b>{date(result.etaDate)}</b>.</p>
      {result.payment.checkout && <form method={"POST"} action={result.payment.checkout.url}>{Object.entries(result.payment.checkout.fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <button className="btn">Перейти до оплати (LiqPay)</button></form>}
      <Link href="/account">Переглянути в кабінеті</Link></div>);
  return (
    <form className="form" onSubmit={submit}>
      <h1>Оформлення замовлення</h1>
      <label>Телефон<input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" pattern="\+380\d{9}" /></label>
      <label>Ім&apos;я та прізвище<input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
      <fieldset className="dl" style={{ border: 0, padding: 0 }}><legend><b>Доставка</b></legend>
        {opts.map((o) => (<label key={o.method} className="opt" style={{ opacity: o.available ? 1 : 0.5 }}>
          <input type="radio" name="method" disabled={!o.available} checked={method === o.method} onChange={() => setMethod(o.method)} />
          <span style={{ flex: 1 }}><b>{o.label}</b><br /><span className="muted">{o.available ? `${o.etaDate ? date(o.etaDate) : ""} · ${o.reason}` : o.reason}</span></span>
          <b>{o.available ? (o.free ? "Безкоштовно" : uah(o.cost)) : ""}</b></label>))}
      </fieldset>
      {(method === "own_courier" || method === "carrier_courier") && <label>Адреса<input required minLength={5} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>}
      {method === "store_pickup" && <label>Магазин<select value={form.pickupLocationId} onChange={(e) => setForm({ ...form, pickupLocationId: e.target.value })}>
        {sel?.pickupPoints?.map((p) => <option key={p.locationId} value={p.locationId}>{p.name}, {p.address} — {date(p.etaDate)}</option>)}</select></label>}
      {method === "carrier_branch" && <label>Відділення<select value={form.carrierBranch} onChange={(e) => setForm({ ...form, carrierBranch: e.target.value })}>
        {sel?.branches?.map((b) => <option key={b.ref} value={b.ref}>{b.name}</option>)}</select></label>}
      {method && <fieldset className="dl" style={{ border: 0, padding: 0 }}><legend><b>Оплата</b></legend>
        {PAYMENTS[method]!.map(([k, l]) => <label key={k} className="opt"><input type="radio" name="payment" checked={payment === k} onChange={() => setPayment(k)} /> {l}</label>)}</fieldset>}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn" disabled={busy || !method}>{busy ? "Оформлюємо…" : "Підтвердити замовлення"}</button>
    </form>
  );
}
