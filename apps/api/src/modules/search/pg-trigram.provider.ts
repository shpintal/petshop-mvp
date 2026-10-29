import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DB, type Db } from "../../db/client.js";
import { rowsOf } from "../../common/types.js";
import { CatalogService, type ProductDoc } from "../catalog/catalog.service.js";
import type { FacetValue, SearchProvider, SearchQuery, SearchResult } from "./search.provider.js";

const LABELS: Record<string, Record<string, string>> = {
  foodClass: { economy: "Економ", premium: "Преміум", super_premium: "Суперпреміум", holistic: "Холістик" },
  lifeStage: { junior: "Молодняк", adult: "Дорослі", senior: "7+", all: "Усі віки" },
  grainFree: { true: "Беззерновий" }, sterilised: { true: "Для стерилізованих" },
};
type FacetKey = keyof SearchResult["facets"];
const facetValue = (d: ProductDoc, k: FacetKey): string | null => {
  switch (k) { case "brand": return d.brandSlug; case "foodClass": return d.foodClass; case "lifeStage": return d.lifeStage;
    case "proteinSource": return d.proteinSource; case "grainFree": return d.grainFree ? "true" : null; case "sterilised": return d.sterilised ? "true" : null; }
};

/** MVP-провайдер: нечіткий пошук pg_trgm (українська морфологія наближено), фасети — диз'юнктивні, у пам'яті. */
@Injectable()
export class PgTrigramSearchProvider implements SearchProvider {
  constructor(@Inject(DB) private readonly db: Db, private readonly catalog: CatalogService) {}

  private async textScores(q: string): Promise<Map<number, number>> {
    const words = q.toLowerCase().split(/\s+/).filter((w) => w.length >= 2).slice(0, 6);
    if (!words.length) return new Map();
    const conds = words.map((w) => sql`(word_similarity(${w}, lower(name_uk)) >= 0.45 or lower(name_uk) like ${"%" + w + "%"})`);
    const score = words.map((w) => sql`word_similarity(${w}, lower(name_uk))`);
    const res = await this.db.execute(sql`select id, (${sql.join(score, sql` + `)})::float as score from products where ${sql.join(conds, sql` and `)}`);
    return new Map(rowsOf<{ id: number; score: number }>(res).map((r) => [r.id, r.score]));
  }

  async search(q: SearchQuery): Promise<SearchResult> {
    const { docs } = await this.catalog.index();
    const scores = q.q ? await this.textScores(q.q) : null;
    const base = docs.filter((d) => (!q.category || d.categorySlugs.includes(q.category)) && (!q.species || d.species === q.species) && (!scores || scores.has(d.id)));
    const sel: Partial<Record<FacetKey, string[]>> = { brand: q.brand, foodClass: q.foodClass, lifeStage: q.lifeStage, proteinSource: q.proteinSource,
      grainFree: q.grainFree ? ["true"] : undefined, sterilised: q.sterilised ? ["true"] : undefined };
    const passes = (d: ProductDoc, skip?: FacetKey) => {
      for (const [k, vals] of Object.entries(sel) as [FacetKey, string[] | undefined][]) {
        if (k === skip || !vals?.length) continue; const v = facetValue(d, k); if (!v || !vals.includes(v)) return false; }
      if (q.sensitiveDigestion && !d.sensitiveDigestion) return false;
      if (q.priceMin != null && d.minPrice < q.priceMin) return false;
      if (q.priceMax != null && d.minPrice > q.priceMax) return false;
      return true;
    };
    const filtered = base.filter((d) => passes(d));
    const facets = {} as SearchResult["facets"];
    for (const k of ["brand", "foodClass", "lifeStage", "proteinSource", "grainFree", "sterilised"] as FacetKey[]) {
      const counts = new Map<string, { label: string; count: number }>();
      for (const d of base) { if (!passes(d, k)) continue; const v = facetValue(d, k); if (!v) continue;
        const label = k === "brand" ? d.brandName : (LABELS[k]?.[v] ?? v); const c = counts.get(v) ?? { label, count: 0 }; c.count++; counts.set(v, c); }
      facets[k] = [...counts].map<FacetValue>(([value, c]) => ({ value, label: c.label, count: c.count, selected: !!sel[k]?.includes(value) }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "uk"));
    }
    const sorters: Record<string, (a: ProductDoc, b: ProductDoc) => number> = {
      price_asc: (a, b) => a.minPrice - b.minPrice, price_desc: (a, b) => b.minPrice - a.minPrice,
      new: (a, b) => Number(b.isNew) - Number(a.isNew) || b.createdAt.localeCompare(a.createdAt),
      rating: (a, b) => b.ratingAvg - a.ratingAvg || b.reviewsCount - a.reviewsCount,
      popular: (a, b) => (scores ? (scores.get(b.id)! - scores.get(a.id)!) : 0) || b.reviewsCount - a.reviewsCount || a.id - b.id,
    };
    filtered.sort(sorters[q.sort ?? "popular"]);
    const prices = base.map((d) => d.minPrice);
    const start = (q.page - 1) * q.pageSize;
    return { items: filtered.slice(start, start + q.pageSize), total: filtered.length, page: q.page, pageSize: q.pageSize, facets,
      priceRange: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null };
  }

  async suggest(q: string, limit = 6) {
    const r = await this.search({ q, page: 1, pageSize: limit, sort: "popular" });
    const { cats } = await this.catalog.index(); const ql = q.toLowerCase();
    return { products: r.items.map((d) => ({ slug: d.slug, nameUk: d.nameUk, minPrice: d.minPrice })),
      categories: cats.filter((c) => c.nameUk.toLowerCase().includes(ql)).slice(0, 4).map((c) => ({ slug: c.slug, nameUk: c.nameUk })) };
  }
}
