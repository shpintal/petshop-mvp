import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { DB, type Db } from "../../db/client.js";
import * as s from "../../db/schema.js";
import { unitPricePerKg } from "./unit-price.js";
import type { Executor } from "../../common/types.js";

export interface ProductDoc {
  id: number; slug: string; nameUk: string; nameEn: string; brandId: number; brandName: string; brandSlug: string;
  categoryId: number; categorySlugs: string[]; kind: string; species: string; lifeStage: string; foodClass: string | null;
  proteinSource: string | null; grainFree: boolean; sterilised: boolean; sensitiveDigestion: boolean; allergens: string[];
  attributes: Record<string, string>; ratingAvg: number; reviewsCount: number; isNew: boolean; createdAt: string;
  minPrice: number; oldPrice: number | null; unitPricePerKg: number | null; packLabels: string[]; variantIds: number[];
}
export interface CategoryNode { id: number; slug: string; nameUk: string; nameEn: string; kind: string; species: string | null; children: CategoryNode[]; }
interface Index { at: number; docs: ProductDoc[]; cats: (typeof s.categories.$inferSelect)[]; ancestors: Map<number, number[]>; }

/** Catalog/PIM read-модель. Індекс кешується (TTL 30 с) і скидається при змінах (invalidate). */
@Injectable()
export class CatalogService {
  private idx?: Index; private loading?: Promise<Index>;
  constructor(@Inject(DB) private readonly db: Db) {}
  invalidate() { this.idx = undefined; }

  async index(): Promise<Index> {
    if (this.idx && Date.now() - this.idx.at < 30_000) return this.idx;
    this.loading ??= this.build().then((i) => { this.idx = i; this.loading = undefined; return i; });
    return this.loading;
  }
  private async build(): Promise<Index> {
    const cats = await this.db.select().from(s.categories).orderBy(asc(s.categories.sort));
    const byId = new Map(cats.map((c) => [c.id, c]));
    const ancestors = new Map<number, number[]>();
    for (const c of cats) { const chain: number[] = []; let cur: typeof c | undefined = c;
      while (cur) { chain.push(cur.id); cur = cur.parentId ? byId.get(cur.parentId) : undefined; } ancestors.set(c.id, chain); }
    const rows = await this.db.select({ p: s.products, b: s.brands }).from(s.products).innerJoin(s.brands, eq(s.products.brandId, s.brands.id));
    const vars = await this.db.select().from(s.variants).where(eq(s.variants.isActive, true)).orderBy(asc(s.variants.price));
    const vByP = new Map<number, (typeof vars)[number][]>();
    for (const v of vars) (vByP.get(v.productId) ?? vByP.set(v.productId, []).get(v.productId)!).push(v);
    const docs: ProductDoc[] = rows.flatMap(({ p, b }) => {
      const vs = vByP.get(p.id) ?? []; if (!vs.length) return [];
      const cheapest = vs[0]!;
      const perKg = vs.map((v) => unitPricePerKg(v.price, v.weightG)).filter((x): x is number => x !== null);
      return [{ id: p.id, slug: p.slug, nameUk: p.nameUk, nameEn: p.nameEn, brandId: b.id, brandName: b.name, brandSlug: b.slug,
        categoryId: p.categoryId, categorySlugs: (ancestors.get(p.categoryId) ?? []).map((id) => byId.get(id)!.slug),
        kind: byId.get(p.categoryId)!.kind, species: p.species, lifeStage: p.lifeStage, foodClass: p.foodClass, proteinSource: p.proteinSource,
        grainFree: p.grainFree, sterilised: p.sterilised, sensitiveDigestion: p.sensitiveDigestion, allergens: p.allergens, attributes: p.attributes,
        ratingAvg: p.ratingAvg, reviewsCount: p.reviewsCount, isNew: p.isNew, createdAt: p.createdAt.toISOString(),
        minPrice: cheapest.price, oldPrice: cheapest.oldPrice, unitPricePerKg: perKg.length ? Math.min(...perKg) : null,
        packLabels: vs.map((v) => v.packLabel), variantIds: vs.map((v) => v.id) }];
    });
    return { at: Date.now(), docs, cats, ancestors };
  }

  async categoryTree(): Promise<CategoryNode[]> {
    const { cats } = await this.index();
    const nodes = new Map<number, CategoryNode>(cats.map((c) => [c.id, { id: c.id, slug: c.slug, nameUk: c.nameUk, nameEn: c.nameEn, kind: c.kind, species: c.species, children: [] }]));
    const roots: CategoryNode[] = [];
    for (const c of cats) (c.parentId ? nodes.get(c.parentId)!.children : roots).push(nodes.get(c.id)!);
    return roots;
  }
  async category(slug: string) {
    const { cats } = await this.index();
    const c = cats.find((x) => x.slug === slug); if (!c) throw new NotFoundException("Категорію не знайдено");
    return { ...c, breadcrumbs: await this.breadcrumbs(c.id) };
  }
  async breadcrumbs(categoryId: number) {
    const { cats, ancestors } = await this.index();
    return (ancestors.get(categoryId) ?? []).slice().reverse().map((id) => { const c = cats.find((x) => x.id === id)!; return { slug: c.slug, nameUk: c.nameUk, nameEn: c.nameEn }; });
  }

  async product(slug: string) {
    const [row] = await this.db.select({ p: s.products, b: s.brands }).from(s.products)
      .innerJoin(s.brands, eq(s.products.brandId, s.brands.id)).where(eq(s.products.slug, slug));
    if (!row) throw new NotFoundException("Товар не знайдено");
    const vs = await this.db.select().from(s.variants).where(and(eq(s.variants.productId, row.p.id), eq(s.variants.isActive, true))).orderBy(asc(s.variants.price));
    const reviews = await this.db.select().from(s.reviews).where(eq(s.reviews.productId, row.p.id)).orderBy(desc(s.reviews.createdAt)).limit(10);
    const dist = await this.db.select({ rating: s.reviews.rating, n: sql<number>`count(*)::int` }).from(s.reviews).where(eq(s.reviews.productId, row.p.id)).groupBy(s.reviews.rating);
    return {
      ...row.p, brand: { id: row.b.id, slug: row.b.slug, name: row.b.name, country: row.b.country },
      breadcrumbs: await this.breadcrumbs(row.p.categoryId),
      variants: vs.map((v) => ({ id: v.id, sku: v.sku, ean: v.ean, packLabel: v.packLabel, weightG: v.weightG, price: v.price, oldPrice: v.oldPrice,
        unitPricePerKg: unitPricePerKg(v.price, v.weightG), freeShipping: v.freeShipping })),
      reviews: { items: reviews, distribution: Object.fromEntries([5, 4, 3, 2, 1].map((r) => [r, dist.find((d) => d.rating === r)?.n ?? 0])) },
    };
  }
  async docsByIds(ids: number[]) { const { docs } = await this.index(); const set = new Set(ids); return docs.filter((d) => set.has(d.id)); }
  async variantsWithProduct(variantIds: number[], ex: Executor = this.db) {
    if (!variantIds.length) return [];
    return ex.select({ v: s.variants, p: { id: s.products.id, slug: s.products.slug, nameUk: s.products.nameUk, brandId: s.products.brandId, categoryId: s.products.categoryId } })
      .from(s.variants).innerJoin(s.products, eq(s.variants.productId, s.products.id)).where(inArray(s.variants.id, variantIds));
  }
}
