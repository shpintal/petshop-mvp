import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { and, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { DB, type Db } from "../../db/client.js";
import * as s from "../../db/schema.js";
import type { Executor } from "../../common/types.js";

export interface Availability {
  total: number; warehouse: number; storesInStock: number;
  stores: { locationId: number; slug: string; name: string; address: string; citySlug: string; qty: number }[];
}
export const RESERVATION_TTL_MIN = 60;

@Injectable()
export class InventoryService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Доступно = qty − reserved; за містом фільтрується список магазинів (склад враховується завжди). */
  async availability(variantIds: number[], citySlug?: string, ex: Executor = this.db): Promise<Map<number, Availability>> {
    const out = new Map<number, Availability>(variantIds.map((id) => [id, { total: 0, warehouse: 0, storesInStock: 0, stores: [] }]));
    if (!variantIds.length) return out;
    const rows = await ex.select({ st: s.stock, l: s.locations, c: s.cities }).from(s.stock)
      .innerJoin(s.locations, eq(s.stock.locationId, s.locations.id)).innerJoin(s.cities, eq(s.locations.cityId, s.cities.id))
      .where(inArray(s.stock.variantId, variantIds));
    for (const { st, l, c } of rows) {
      const free = st.qty - st.reserved; if (free <= 0) continue;
      const a = out.get(st.variantId)!; a.total += free;
      if (l.kind === "warehouse") a.warehouse += free;
      else { a.storesInStock++; if (!citySlug || c.slug === citySlug) a.stores.push({ locationId: l.id, slug: l.slug, name: l.name, address: l.address, citySlug: c.slug, qty: free }); }
    }
    return out;
  }

  /** Атомарний резерв: умовний UPDATE захищає від гонок (qty − reserved ≥ n). */
  async reserve(tx: Executor, orderId: number, items: { variantId: number; qty: number }[], candidates: number[]) {
    const expiresAt = new Date(Date.now() + RESERVATION_TTL_MIN * 60_000);
    for (const it of items) {
      let left = it.qty;
      for (const locationId of candidates) {
        if (left === 0) break;
        const [row] = await tx.select().from(s.stock).where(and(eq(s.stock.variantId, it.variantId), eq(s.stock.locationId, locationId)));
        const take = Math.min(left, row ? row.qty - row.reserved : 0); if (take <= 0) continue;
        const upd = await tx.update(s.stock).set({ reserved: sql`${s.stock.reserved} + ${take}` })
          .where(and(eq(s.stock.variantId, it.variantId), eq(s.stock.locationId, locationId), sql`${s.stock.qty} - ${s.stock.reserved} >= ${take}`)).returning();
        if (!upd.length) continue;
        await tx.insert(s.reservations).values({ orderId, variantId: it.variantId, locationId, qty: take, expiresAt });
        left -= take;
      }
      if (left > 0) throw new ConflictException(`Недостатньо товару (variant ${it.variantId})`);
    }
  }

  /** Знімає прострочені резерви неоплачених замовлень (запускається планувальником). */
  async releaseExpired(now = new Date()) {
    return this.db.transaction(async (tx) => {
      const expired = await tx.select().from(s.reservations).where(and(eq(s.reservations.released, false), lt(s.reservations.expiresAt, now)));
      for (const r of expired) {
        await tx.update(s.stock).set({ reserved: sql`greatest(${s.stock.reserved} - ${r.qty}, 0)` }).where(and(eq(s.stock.variantId, r.variantId), eq(s.stock.locationId, r.locationId)));
        await tx.update(s.reservations).set({ released: true }).where(eq(s.reservations.id, r.id));
      }
      return expired.length;
    });
  }
  async hasAll(locationId: number, items: { variantId: number; qty: number }[], ex: Executor = this.db) {
    if (!items.length) return false;
    const rows = await ex.select().from(s.stock).where(and(eq(s.stock.locationId, locationId), inArray(s.stock.variantId, items.map((i) => i.variantId)), gt(s.stock.qty, 0)));
    return items.every((i) => { const r = rows.find((x) => x.variantId === i.variantId); return !!r && r.qty - r.reserved >= i.qty; });
  }
}
