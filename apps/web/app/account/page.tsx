"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getToken } from "@/components/client/cart-store";
import { uah } from "@/lib/format";

type Loyalty = { number: string; tier: { code: string; discountPct: number }; bonusBalance: number; totalSpent: number; next: { next: string; remaining: number } | null };
type Pet = { id: number; name: string; species: string; breed: string | null; birthDate: string | null; sterilised: boolean; allergies: string[] };
type Recs = { pet: Pet & { lifeStage: string }; dailyDryFoodGrams: number | null; disclaimer: string;
  items: { productId: number; slug: string; nameUk: string; brandName: string; minPrice: number; score: number; reasons: string[]; packs: { packLabel: string; lastsDays: number | null }[] }[] };
type Order = { number: string; status: string; total: number; etaDate: string; paymentStatus: string };

function Login({ onDone }: { onDone: () => void }) {
  const [phone, setPhone] = useState("+380500000001"); const [code, setCode] = useState(""); const [hint, setHint] = useState(""); const [step, setStep] = useState<1 | 2>(1); const [err, setErr] = useState("");
  async function request(e: React.FormEvent) { e.preventDefault(); setErr("");
    const r = await fetch("/api/v1/auth/otp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone }) }); const j = await r.json();
    if (!r.ok) return setErr(j.message ?? "Помилка"); setStep(2); if (j.devCode) setHint(`Демо-режим: код ${j.devCode}`); }
  async function verify(e: React.FormEvent) { e.preventDefault(); setErr("");
    const r = await fetch("/api/v1/auth/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone, code }) }); const j = await r.json();
    if (!r.ok) return setErr(j.message ?? "Невірний код"); localStorage.setItem("token", j.token); onDone(); }
  return step === 1 ? (
    <form className="form card" onSubmit={request}><h1>Вхід за номером телефону</h1><label>Телефон<input value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
      <button className="btn">Отримати код</button>{err && <p className="error">{err}</p>}<p className="muted">Демо-клієнт: +380500000001</p></form>
  ) : (
    <form className="form card" onSubmit={verify}><h1>Введіть код із SMS</h1><label>Код<input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} /></label>
      {hint && <p className="muted">{hint}</p>}<button className="btn">Увійти</button>{err && <p className="error">{err}</p>}</form>
  );
}

export default function AccountPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [loyalty, setLoyalty] = useState<Loyalty | null>(null); const [pets, setPets] = useState<Pet[]>([]); const [recs, setRecs] = useState<Recs | null>(null); const [orders, setOrders] = useState<Order[]>([]);
  const h = () => ({ authorization: `Bearer ${getToken()}` });
  async function load() {
    if (!getToken()) return setAuthed(false);
    const r = await fetch("/api/v1/me/loyalty", { headers: h() }); if (r.status === 401) { localStorage.removeItem("token"); return setAuthed(false); }
    setLoyalty(await r.json()); setAuthed(true);
    const ps: Pet[] = await (await fetch("/api/v1/me/pets", { headers: h() })).json(); setPets(ps);
    setOrders(await (await fetch("/api/v1/me/orders", { headers: h() })).json());
    if (ps[0]) showRecs(ps[0].id);
  }
  async function showRecs(id: number) { setRecs(await (await fetch(`/api/v1/me/pets/${id}/recommendations`, { headers: h() })).json()); }
  useEffect(() => { load(); }, []);
  if (authed === null) return <><h1>Особистий кабінет</h1><p>Завантаження…</p></>;
  if (!authed) return <Login onDone={load} />;
  return (
    <>
      <h1>Особистий кабінет</h1>
      {loyalty && <section className="card"><h2 style={{ marginTop: 0 }}>Картка {loyalty.tier.code} · −{loyalty.tier.discountPct} %</h2>
        <p>№ {loyalty.number} · бонуси: {uah(loyalty.bonusBalance)} · покупок на {uah(loyalty.totalSpent)}</p>
        {loyalty.next && <p className="muted">До рівня {loyalty.next.next} залишилось {uah(loyalty.next.remaining)}</p>}</section>}
      <section className="card" style={{ marginTop: 16 }}><h2 style={{ marginTop: 0 }}>Мої улюбленці</h2>
        <div style={{ display: "flex", gap: 8 }}>{pets.map((p) => <button key={p.id} className={recs?.pet.id === p.id ? "btn" : "btn secondary"} onClick={() => showRecs(p.id)}>{p.name}</button>)}</div>
        {recs && <><p><b>{recs.pet.name}</b> — {recs.pet.breed ?? recs.pet.species}{recs.pet.sterilised ? ", стерилізований(а)" : ""}{recs.pet.allergies.length ? `, алергія: ${recs.pet.allergies.join(", ")}` : ""}.
          {recs.dailyDryFoodGrams && <> Орієнтовна добова норма сухого корму: <b>{recs.dailyDryFoodGrams} г</b>.</>}</p>
          <ol>{recs.items.map((it) => <li key={it.productId} style={{ marginBottom: 8 }}><Link href={`/p/${it.slug}`}><b>{it.nameUk}</b></Link> — від {uah(it.minPrice)}
            <div className="muted">{it.reasons.join("; ")}{it.packs.filter((p) => p.lastsDays).length > 0 && ` · вистачить: ${it.packs.filter((p) => p.lastsDays).map((p) => `${p.packLabel} ≈ ${p.lastsDays} дн.`).join(", ")}`}</div></li>)}</ol>
          <p className="muted">{recs.disclaimer}</p></>}
      </section>
      <section className="card" style={{ marginTop: 16 }}><h2 style={{ marginTop: 0 }}>Замовлення</h2>
        {orders.length === 0 ? <p className="muted">Замовлень ще немає.</p> : <table className="attrs"><tbody>{orders.map((o) => <tr key={o.number}><td>{o.number}</td><td>{o.status} · оплата: {o.paymentStatus} · {uah(o.total)} · {o.etaDate}</td></tr>)}</tbody></table>}</section>
      <p><button className="btn secondary" onClick={() => { localStorage.removeItem("token"); setAuthed(false); }}>Вийти</button></p>
    </>
  );
}
