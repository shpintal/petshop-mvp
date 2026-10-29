import Link from "next/link";
import type { ProductDoc } from "@/lib/types";
import { uah } from "@/lib/format";
export function ProductCard({ p }: { p: ProductDoc }) {
  return (
    <article className="card pcard">
      <Link href={`/p/${p.slug}`} aria-label={p.nameUk}><div className={`ph ${p.species}`} aria-hidden>{p.brandName[0]}</div></Link>
      <div style={{ display: "flex", gap: 6 }}>{p.isNew && <span className="badge new">Новинка</span>}{p.oldPrice && <span className="badge sale">Знижка</span>}</div>
      <Link href={`/p/${p.slug}`}><h3 style={{ fontSize: 15, margin: 0, fontWeight: 600 }}>{p.nameUk}</h3></Link>
      <div className="muted">{p.reviewsCount > 0 ? <><span className="stars">★</span> {p.ratingAvg.toFixed(1)} · {p.reviewsCount} відгуків</> : "Ще немає відгуків"}</div>
      <div><span className="price">від {uah(p.minPrice)}</span>{p.oldPrice && <span className="old">{uah(p.oldPrice)}</span>}</div>
      {p.unitPricePerKg && <div className="muted">від {uah(p.unitPricePerKg)}/кг · {p.packLabels.join(" / ")}</div>}
    </article>
  );
}
