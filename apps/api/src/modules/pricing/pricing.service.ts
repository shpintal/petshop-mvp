import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, lte } from "drizzle-orm";
import { DB, type Db } from "../../db/client.js";
import * as s from "../../db/schema.js";
import { CatalogService } from "../catalog/catalog.service.js";
import { quote, type Quote, type TierRule, type CombinationPolicy } from "./pricing.rules.js";

export interface CustomerPricing { customerId: number; tier: (typeof s.loyaltyTiers.$inferSelect) | null; cardNumber: string | null; }

@Injectable()
export class PricingService {
  readonly policy: CombinationPolicy = (process.env.PROMO_POLICY as CombinationPolicy) ?? "best_of";
  constructor(@Inject(DB) private readonly db: Db, private readonly catalog: CatalogService) {}

  async customerPricing(customerId: number | null | undefined): Promise<CustomerPricing | null> {
    if (!customerId) return null;
    const [row] = await this.db.select({ card: s.loyaltyCards, tier: s.loyaltyTiers }).from(s.loyaltyCards)
      .innerJoin(s.loyaltyTiers, eq(s.loyaltyCards.tierCode, s.loyaltyTiers.code)).where(eq(s.loyaltyCards.customerId, customerId));
    return { customerId, tier: row?.tier ?? null, cardNumber: row?.card.number ?? null };
  }
  async activePromos(now = new Date()) {
    return this.db.select().from(s.promotions).where(and(eq(s.promotions.active, true), lte(s.promotions.startsAt, now), gte(s.promotions.endsAt, now)));
  }
  async quoteItems(items: { variantId: number; qty: number }[], tier: TierRule | null): Promise<Quote> {
    const rows = await this.catalog.variantsWithProduct(items.map((i) => i.variantId));
    const missing = items.filter((i) => !rows.some((r) => r.v.id === i.variantId && r.v.isActive));
    if (missing.length) throw new BadRequestException(`Варіант недоступний: ${missing.map((m) => m.variantId).join(", ")}`);
    const { ancestors } = await this.catalog.index();
    return quote(items.map((i) => { const r = rows.find((x) => x.v.id === i.variantId)!;
      return { variantId: r.v.id, productId: r.p.id, brandId: r.p.brandId, categoryId: r.p.categoryId, name: `${r.p.nameUk}, ${r.v.packLabel}`,
        qty: i.qty, unitPrice: r.v.price, onSale: r.v.oldPrice != null, freeShipping: r.v.freeShipping }; }),
      { tier, promos: await this.activePromos(), policy: this.policy, categoryAncestors: ancestors });
  }
}
