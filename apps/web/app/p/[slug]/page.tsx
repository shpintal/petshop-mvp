import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { DeliveryOption, Product } from "@/lib/types";
import { uah, date, SITE } from "@/lib/format";
import { currentCity } from "@/lib/city";
import { JsonLd } from "@/components/JsonLd";
import { AddToCart } from "@/components/client/AddToCart";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ v?: string }> };
const LIFE: Record<string, string> = { junior: "Молодняк", adult: "Дорослі", senior: "7+", all: "Усі віки" };
const CLASS: Record<string, string> = { economy: "Економ", premium: "Преміум", super_premium: "Суперпреміум", holistic: "Холістик" };

async function load(slug: string, city: string) {
  try { return await api<Product>(`/products/${slug}?city=${city}`, { revalidate: 60, tags: [`product:${slug}`] }); }
  catch (e) { if (e instanceof ApiError && e.status === 404) notFound(); throw e; }
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params; const p = await load(slug, await currentCity());
  const min = Math.min(...p.variants.map((v) => v.price));
  return { title: p.nameUk, description: `${p.nameUk} від ${uah(min)}. ${p.descriptionUk.slice(0, 120)}`, alternates: { canonical: `/p/${slug}` },
    openGraph: { title: p.nameUk, type: "website" } };
}

export default async function ProductPage({ params, searchParams }: Props) {
  const [{ slug }, { v }, city] = await Promise.all([params, searchParams, currentCity()]);
  const p = await load(slug, city);
  const variant = p.variants.find((x) => String(x.id) === v) ?? p.variants[0]!;
  const delivery = await api<DeliveryOption[]>(`/delivery/options?city=${city}&variantId=${variant.id}`, { revalidate: 60 });
  const inStock = variant.availability.total > 0;
  const jsonLd = {
    "@context": "https://schema.org", "@type": "Product", name: p.nameUk, description: p.descriptionUk, brand: { "@type": "Brand", name: p.brand.name },
    sku: variant.sku, gtin13: variant.ean ?? undefined, url: `${SITE}/p/${slug}`,
    offers: p.variants.map((x) => ({ "@type": "Offer", sku: x.sku, price: (x.price / 100).toFixed(2), priceCurrency: "UAH", url: `${SITE}/p/${slug}?v=${x.id}`,
      availability: x.availability.total > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", itemCondition: "https://schema.org/NewCondition" })),
    ...(p.reviewsCount > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: p.ratingAvg, reviewCount: p.reviewsCount, bestRating: 5, worstRating: 1 },
      review: p.reviews.items.slice(0, 5).map((r) => ({ "@type": "Review", author: { "@type": "Person", name: r.author }, datePublished: r.createdAt.slice(0, 10), reviewBody: r.body, reviewRating: { "@type": "Rating", ratingValue: r.rating } })) } : {}),
  };
  const crumbs = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [...p.breadcrumbs.map((b, i) => ({ "@type": "ListItem", position: i + 1, name: b.nameUk, item: `${SITE}/c/${b.slug}` })),
    { "@type": "ListItem", position: p.breadcrumbs.length + 1, name: p.nameUk }] };
  const attrs: [string, string | null][] = [["Бренд", `${p.brand.name} (${p.brand.country})`], ["Клас корму", p.foodClass ? CLASS[p.foodClass]! : null], ["Вік", LIFE[p.lifeStage] ?? null],
    ["Основне джерело білка", p.proteinSource], ["Білок / жир", p.proteinPct ? `${p.proteinPct} % / ${p.fatPct} %` : null], ["Беззерновий", p.grainFree ? "так" : null],
    ["Для стерилізованих", p.sterilised ? "так" : null], ["Чутливе травлення", p.sensitiveDigestion ? "так" : null], ["Може містити", p.allergens.join(", ") || null],
    ...Object.entries(p.attributes) as [string, string][], ["Артикул", variant.sku], ["Штрихкод", variant.ean]];
  return (
    <>
      <JsonLd data={jsonLd} /><JsonLd data={crumbs} />
      <nav className="crumbs" aria-label="Хлібні крихти"><Link href="/">Головна</Link>{p.breadcrumbs.map((b) => <span key={b.slug}>/ <Link href={`/c/${b.slug}`}>{b.nameUk}</Link></span>)}</nav>
      <div className="pdp">
        <div><div className={`ph ${p.species}`} style={{ aspectRatio: "1/1", borderRadius: 16, display: "grid", placeItems: "center", fontSize: 120, color: "#fff", fontWeight: 800 }} aria-hidden>{p.brand.name[0]}</div></div>
        <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
          <h1 style={{ margin: 0, fontSize: 26 }}>{p.nameUk}</h1>
          <div className="muted"><Link href={`/c/${p.breadcrumbs.at(-1)?.slug}?brand=${p.brand.slug}`}>{p.brand.name}</Link> · {p.reviewsCount > 0 ? <><span className="stars">★</span> {p.ratingAvg.toFixed(1)} ({p.reviewsCount} відгуків)</> : "Ще немає відгуків"} · Артикул {variant.sku}</div>
          <div className="variants" role="radiogroup" aria-label="Фасування">{p.variants.map((x) =>
            <Link key={x.id} href={`/p/${slug}?v=${x.id}`} scroll={false} className={x.id === variant.id ? "sel" : ""} role="radio" aria-checked={x.id === variant.id}>{x.packLabel}<br /><b>{uah(x.price)}</b></Link>)}</div>
          <div><span className="price" style={{ fontSize: 30 }}>{uah(variant.price)}</span>{variant.oldPrice && <span className="old">{uah(variant.oldPrice)}</span>}
            {variant.unitPricePerKg && <span className="muted" style={{ marginLeft: 10 }}>({uah(variant.unitPricePerKg)}/кг)</span>}</div>
          {variant.freeShipping && <span className="badge">Безкоштовна доставка для цього товару</span>}
          <AddToCart variantId={variant.id} disabled={!inStock} />
          <div className="muted">{inStock ? `В наявності в ${variant.availability.storesInStock} магазинах${variant.availability.warehouse > 0 ? " і на складі" : ""}` : "Немає в наявності"}</div>
          <section className="card"><h2 style={{ fontSize: 17, marginTop: 0 }}>Доставка: {delivery[0] ? "" : ""}<span className="muted">місто змінюється у шапці</span></h2>
            <div className="dl">{delivery.map((d) => (
              <div key={d.method} className={`row ${d.available ? "" : "na"}`}>
                <div><b>{d.label}</b><div className="muted">{d.available ? (d.etaDate ? `Орієнтовно ${date(d.etaDate)}` : "") : d.reason}{d.zone ? ` · ${d.zone.name}` : ""}</div></div>
                <div style={{ textAlign: "right" }}>{d.available && (d.free ? <b className="ok">Безкоштовно</b> : <b>{uah(d.cost)}</b>)}{d.available && !d.free && <div className="muted" style={{ fontSize: 12 }}>{d.reason}</div>}</div>
              </div>))}</div>
            {variant.availability.stores.length > 0 && <details style={{ marginTop: 10 }}><summary>Магазини з наявністю у вашому місті ({variant.availability.stores.length})</summary>
              <ul>{variant.availability.stores.map((st) => <li key={st.locationId}>{st.name}, {st.address} — {st.qty > 5 ? "достатньо" : `${st.qty} шт.`}</li>)}</ul></details>}
          </section>
        </div>
      </div>
      <section className="card" style={{ marginTop: 24 }}><h2>Опис</h2><p>{p.descriptionUk}</p>
        <table className="attrs"><tbody>{attrs.filter(([, v]) => v).map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody></table></section>
      <section className="card" style={{ marginTop: 24 }}><h2>Відгуки ({p.reviewsCount})</h2>
        {p.reviewsCount > 0 && <p className="muted">{[5, 4, 3, 2, 1].map((r) => `${r}★: ${p.reviews.distribution[r] ?? 0}`).join(" · ")}</p>}
        {p.reviews.items.map((r) => <article key={r.id} style={{ borderTop: "1px solid var(--line)", padding: "10px 0" }}>
          <b>{r.author}</b> <span className="stars">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span> <span className="muted">{new Date(r.createdAt).toLocaleDateString("uk-UA")}</span><p style={{ margin: "4px 0" }}>{r.body}</p></article>)}
        {p.reviewsCount === 0 && <p className="muted">Будьте першим, хто залишить відгук.</p>}
      </section>
    </>
  );
}
