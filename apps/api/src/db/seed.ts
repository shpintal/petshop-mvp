import { sql, eq } from "drizzle-orm";
import type { Db } from "./client.js";
import * as s from "./schema.js";
import { CITIES, LOCATIONS, ZONES, TIERS, BRANDS, buildCategories, buildProducts, buildReviews, rng } from "./seed-data.js";
import { slugify } from "../common/slug.js";
import { cardNumber } from "../modules/loyalty/loyalty.rules.js";

export const DEMO_PHONE = "+380500000001";

/** Заповнює порожню БД синтетичними даними. Повертає статистику. */
export async function seed(db: Db) {
  const existing = await db.select({ n: sql<number>`count(*)::int` }).from(s.products);
  if ((existing[0]?.n ?? 0) > 0) return { skipped: true };
  const r = rng(99);
  const cityRows = await db.insert(s.cities).values(CITIES).returning();
  const cityId = Object.fromEntries(cityRows.map((c) => [c.slug, c.id]));
  const locRows = await db.insert(s.locations).values(LOCATIONS.map((l) => ({
    slug: l.slug, kind: l.kind, cityId: cityId[l.city]!, name: l.name, address: l.address, lat: "lat" in l ? l.lat : null, lng: "lng" in l ? l.lng : null,
    phone: l.kind === "store" ? "+38044" + String(1000000 + Math.floor(r() * 8999999)) : null,
    rating: l.kind === "store" ? Math.round((4.3 + r() * 0.7) * 10) / 10 : null, reviewsCount: l.kind === "store" ? Math.floor(r() * 120) : 0,
    isNew: "isNew" in l ? !!l.isNew : false, opensAt: r() < 0.5 ? "09:00" : "10:00", closesAt: "20:00",
  }))).returning();
  await db.insert(s.deliveryZones).values(ZONES.map((z) => ({ cityId: cityId[z.city]!, name: z.name, weekdays: z.weekdays, cutoffHour: z.cutoffHour })));
  await db.insert(s.loyaltyTiers).values(TIERS);
  const brandRows = await db.insert(s.brands).values(BRANDS.map((b) => ({ slug: slugify(b.name), name: b.name, country: b.country }))).returning();
  const brandId = Object.fromEntries(brandRows.map((b) => [b.name, b.id]));
  const catIds: Record<string, number> = {};
  for (const c of buildCategories()) {
    const [row] = await db.insert(s.categories).values({ slug: c.slug, parentId: c.parent ? catIds[c.parent]! : null, nameUk: c.nameUk, nameEn: c.nameEn, kind: c.kind, species: c.species ?? null, sort: c.sort }).returning();
    catIds[c.slug] = row!.id;
  }
  const products = buildProducts();
  const reviews = buildReviews(products);
  const prodIds: Record<string, number> = {};
  let variantCount = 0;
  const stockRows: (typeof s.stock.$inferInsert)[] = [];
  for (const p of products) {
    const [row] = await db.insert(s.products).values({
      slug: p.slug, categoryId: catIds[p.category]!, brandId: brandId[p.brand]!, nameUk: p.nameUk, nameEn: p.nameEn, descriptionUk: p.descriptionUk,
      species: p.species, lifeStage: p.lifeStage, foodClass: p.foodClass ?? null, proteinSource: p.proteinSource ?? null, proteinPct: p.proteinPct ?? null,
      fatPct: p.fatPct ?? null, grainFree: p.grainFree, sterilised: p.sterilised, sensitiveDigestion: p.sensitiveDigestion, allergens: p.allergens,
      attributes: p.attributes, isNew: p.isNew,
    }).returning({ id: s.products.id });
    prodIds[p.slug] = row!.id;
    const vRows = await db.insert(s.variants).values(p.variants.map((v) => ({ ...v, productId: row!.id, erpCode: v.sku.replace("PS-", "ERP") }))).returning({ id: s.variants.id });
    variantCount += vRows.length;
    for (const v of vRows) for (const l of locRows) {
      const qty = l.kind === "warehouse" ? 20 + Math.floor(r() * 200) : (r() < 0.62 ? Math.floor(r() * 12) + 1 : 0);
      if (qty > 0) stockRows.push({ variantId: v.id, locationId: l.id, qty });
    }
  }
  for (let i = 0; i < stockRows.length; i += 500) await db.insert(s.stock).values(stockRows.slice(i, i + 500));
  const now = Date.now();
  const reviewRows = reviews.map((rv) => ({ productId: prodIds[rv.slug]!, author: rv.author, rating: rv.rating, body: rv.body, createdAt: new Date(now - rv.daysAgo * 86400000) }));
  for (let i = 0; i < reviewRows.length; i += 500) await db.insert(s.reviews).values(reviewRows.slice(i, i + 500));
  await db.execute(sql`update products p set rating_avg = coalesce(x.avg, 0), reviews_count = coalesce(x.n, 0)
    from (select product_id, round(avg(rating)::numeric, 2)::real avg, count(*)::int n from reviews group by product_id) x where x.product_id = p.id`);
  const start = new Date(now - 7 * 86400000), end = new Date(now + 60 * 86400000);
  await db.insert(s.promotions).values([
    { title: "−15 % на Northpaw", percent: 15, brandId: brandId["Northpaw"]!, startsAt: start, endsAt: end },
    { title: "−10 % на ласощі для собак", percent: 10, categoryId: catIds["dog-treats"]!, startsAt: start, endsAt: end },
  ]);
  const [cust] = await db.insert(s.customers).values({ phone: DEMO_PHONE, email: "demo@example.com", name: "Демо Клієнт", marketingConsent: true }).returning();
  await db.insert(s.loyaltyCards).values({ number: cardNumber(1), customerId: cust!.id, tierCode: "PRESTIGE", totalSpent: 18_250_00, bonusBalance: 120_00 });
  await db.insert(s.pets).values([
    { customerId: cust!.id, name: "Мурка", species: "cat", breed: "Британська короткошерста", birthDate: "2021-03-14", sterilised: true, weightKg: 4.6, allergies: ["курка"] },
    { customerId: cust!.id, name: "Рекс", species: "dog", breed: "Лабрадор-ретривер", birthDate: "2017-11-02", sterilised: false, weightKg: 31, allergies: [], sensitiveDigestion: true },
  ]);
  return { skipped: false, cities: cityRows.length, locations: locRows.length, categories: Object.keys(catIds).length, brands: brandRows.length,
    products: products.length, variants: variantCount, stockRows: stockRows.length, reviews: reviewRows.length };
}
