import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { DB, type Db } from "../../db/client.js";
import * as s from "../../db/schema.js";
import { CatalogService } from "../catalog/catalog.service.js";
import { PricingService } from "../pricing/pricing.service.js";
import { InventoryService } from "../inventory/inventory.service.js";
import { unitPricePerKg } from "../catalog/unit-price.js";

@Injectable()
export class CartService {
  constructor(@Inject(DB) private readonly db: Db, private readonly catalog: CatalogService, private readonly pricing: PricingService,
              private readonly inventory: InventoryService) {}
  async create(customerId?: number | null) {
    const [c] = await this.db.insert(s.carts).values({ customerId: customerId ?? null }).returning(); return { id: c!.id };
  }
  async items(cartId: string) {
    const [c] = await this.db.select().from(s.carts).where(eq(s.carts.id, cartId));
    if (!c) throw new NotFoundException("Кошик не знайдено");
    return { cart: c, items: await this.db.select().from(s.cartItems).where(eq(s.cartItems.cartId, cartId)) };
  }
  async setQty(cartId: string, variantId: number, qty: number, mode: "add" | "set") {
    await this.items(cartId);
    await this.pricing.quoteItems([{ variantId, qty: 1 }], null); // валідація варіанта
    if (mode === "set" && qty === 0) await this.db.delete(s.cartItems).where(and(eq(s.cartItems.cartId, cartId), eq(s.cartItems.variantId, variantId)));
    else await this.db.insert(s.cartItems).values({ cartId, variantId, qty })
      .onConflictDoUpdate({ target: [s.cartItems.cartId, s.cartItems.variantId], set: { qty: mode === "add" ? sql`${s.cartItems.qty} + ${qty}` : qty } });
    await this.db.update(s.carts).set({ updatedAt: new Date() }).where(eq(s.carts.id, cartId));
  }
  /** Кошик з актуальними цінами, знижками та наявністю. */
  async view(cartId: string, customerId?: number | null, citySlug?: string) {
    const { items } = await this.items(cartId);
    const cp = await this.pricing.customerPricing(customerId);
    if (!items.length) return { id: cartId, items: [], quote: null, tierCode: cp?.tier?.code ?? null };
    const quote = await this.pricing.quoteItems(items.map((i) => ({ variantId: i.variantId, qty: i.qty })), cp?.tier ?? null);
    const rows = await this.catalog.variantsWithProduct(items.map((i) => i.variantId));
    const avail = await this.inventory.availability(items.map((i) => i.variantId), citySlug);
    return { id: cartId, tierCode: cp?.tier?.code ?? null, quote,
      items: quote.lines.map((l) => { const r = rows.find((x) => x.v.id === l.variantId)!;
        return { variantId: l.variantId, sku: r.v.sku, productSlug: r.p.slug, name: r.p.nameUk, packLabel: r.v.packLabel, qty: l.qty,
          unitPrice: l.unitPrice, oldPrice: r.v.oldPrice, unitPricePerKg: unitPricePerKg(r.v.price, r.v.weightG), net: l.net, appliedRule: l.appliedRule,
          available: avail.get(l.variantId)!.total }; }) };
  }
}
