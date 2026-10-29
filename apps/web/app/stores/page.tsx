import type { Metadata } from "next";
import { api } from "@/lib/api";
import type { Store } from "@/lib/types";
import { JsonLd } from "@/components/JsonLd";
export const metadata: Metadata = { title: "Магазини", description: "Адреси магазинів, графік роботи, самовивіз замовлень.", alternates: { canonical: "/stores" } };
export const dynamic = "force-dynamic";
export default async function StoresPage() {
  const stores = await api<Store[]>("/stores", { revalidate: 3600 });
  const byCity = Object.entries(stores.reduce<Record<string, Store[]>>((a, s) => { (a[s.city.nameUk] ??= []).push(s); return a; }, {}));
  return (
    <>
      <JsonLd data={stores.map((s) => ({ "@context": "https://schema.org", "@type": "PetStore", name: s.name, address: s.address, telephone: s.phone ?? undefined,
        openingHours: `Mo-Su ${s.opensAt}-${s.closesAt}`, ...(s.lat ? { geo: { "@type": "GeoCoordinates", latitude: s.lat, longitude: s.lng } } : {}),
        ...(s.rating ? { aggregateRating: { "@type": "AggregateRating", ratingValue: s.rating, reviewCount: s.reviewsCount } } : {}) }))} />
      <h1>Магазини ({stores.length})</h1>
      {byCity.map(([city, list]) => (<section key={city}><h2>{city}</h2><div className="grid">{list.map((s) => (
        <article key={s.id} className="card"><b>{s.name}</b> {s.isNew && <span className="badge new">Новий</span>}<div>{s.address}</div>
          <div className="muted">{s.opensAt}–{s.closesAt} · {s.phone}</div>{s.rating && <div className="muted"><span className="stars">★</span> {s.rating} ({s.reviewsCount})</div>}</article>))}</div></section>))}
    </>
  );
}
