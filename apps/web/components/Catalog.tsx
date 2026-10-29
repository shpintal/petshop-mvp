import Link from "next/link";
import type { SearchResult } from "@/lib/types";
import { ProductCard } from "./ProductCard";
import { uah } from "@/lib/format";

const FACET_TITLES: Record<string, string> = { brand: "Бренд", foodClass: "Клас корму", lifeStage: "Вік", proteinSource: "Основне джерело білка", grainFree: "Особливості", sterilised: "Призначення" };
const SORTS: [string, string][] = [["popular", "Популярні"], ["price_asc", "Дешевші"], ["price_desc", "Дорожчі"], ["rating", "За рейтингом"], ["new", "Новинки"]];

export function buildQuery(sp: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const q = new URLSearchParams(); for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) q.set(k, v);
  return q.toString() ? `?${q}` : "";
}
function toggle(cur: string | undefined, v: string) { const set = new Set((cur ?? "").split(",").filter(Boolean)); set.has(v) ? set.delete(v) : set.add(v); return [...set].join(",") || undefined; }

export function Catalog({ base, sp, data }: { base: string; sp: Record<string, string | undefined>; data: SearchResult }) {
  const pages = Math.ceil(data.total / data.pageSize);
  return (
    <div className="layout-cat">
      <aside className="card facet" aria-label="Фільтри">
        {data.priceRange && <div className="muted">Ціни: {uah(data.priceRange.min)} – {uah(data.priceRange.max)}</div>}
        {Object.entries(data.facets).filter(([, vals]) => vals.length).map(([key, vals]) => (
          <div key={key}><h3>{FACET_TITLES[key] ?? key}</h3>
            {vals.slice(0, 12).map((v) => (
              <Link key={v.value} rel="nofollow" className={v.selected ? "sel" : ""} href={base + buildQuery(sp, { [key]: key === "grainFree" || key === "sterilised" ? (v.selected ? undefined : "true") : toggle(sp[key], v.value), page: undefined })}>
                <span>{v.selected ? "✓ " : ""}{v.label}</span><span className="muted">{v.count}</span></Link>))}
          </div>))}
        {Object.keys(sp).some((k) => k !== "sort" && k !== "q" && k !== "page") && <p><Link href={base + buildQuery({ q: sp.q }, {})} className="muted">Скинути фільтри</Link></p>}
      </aside>
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span className="muted">Знайдено товарів: {data.total}</span>
          <nav style={{ display: "flex", gap: 8 }} aria-label="Сортування">{SORTS.map(([k, l]) => <Link key={k} rel="nofollow" href={base + buildQuery(sp, { sort: k === "popular" ? undefined : k, page: undefined })} style={{ fontWeight: (sp.sort ?? "popular") === k ? 700 : 400 }}>{l}</Link>)}</nav>
        </div>
        <div className="grid" style={{ marginTop: 12 }}>{data.items.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        {pages > 1 && <nav style={{ display: "flex", gap: 8, marginTop: 16 }} aria-label="Сторінки">{Array.from({ length: pages }, (_, i) => i + 1).map((n) =>
          <Link key={n} href={base + buildQuery(sp, { page: n === 1 ? undefined : String(n) })} className={n === data.page ? "btn" : "btn secondary"}>{n}</Link>)}</nav>}
      </section>
    </div>
  );
}
