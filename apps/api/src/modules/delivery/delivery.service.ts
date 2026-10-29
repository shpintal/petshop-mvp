import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import { DB, type Db } from "../../db/client.js";
import * as s from "../../db/schema.js";
import type { Executor } from "../../common/types.js";
import { CatalogService } from "../catalog/catalog.service.js";
import { InventoryService } from "../inventory/inventory.service.js";
import { CARRIER, type CarrierAdapter, type CarrierBranch } from "./carrier.adapter.js";
import { METHOD_LABEL, carrierEta, deliveryCost, ownCourierEta, pickupEta, type DeliveryMethod } from "./delivery.rules.js";

export interface PickupPoint { locationId: number; name: string; address: string; etaDate: string; source: "store" | "warehouse"; }
export interface DeliveryOption {
  method: DeliveryMethod; label: string; available: boolean; cost: number; free: boolean; reason: string; etaDate: string | null;
  zone?: { id: number; name: string }; pickupPoints?: PickupPoint[]; branches?: CarrierBranch[];
}
export interface DeliveryInput { citySlug: string; items: { variantId: number; qty: number }[]; totalAfterDiscounts: number;
  hasFreeShippingItem: boolean; tierFreeShippingAlways: boolean; zoneId?: number; now?: Date; }

@Injectable()
export class DeliveryService {
  constructor(@Inject(DB) private readonly db: Db, private readonly catalog: CatalogService, private readonly inventory: InventoryService,
              @Inject(CARRIER) private readonly carrier: CarrierAdapter) {}

  async city(slug: string, ex: Executor = this.db) {
    const [c] = await ex.select().from(s.cities).where(eq(s.cities.slug, slug));
    if (!c) throw new NotFoundException(`Місто ${slug} не обслуговується`); return c;
  }
  async weightKg(items: { variantId: number; qty: number }[], ex: Executor = this.db) {
    const rows = await this.catalog.variantsWithProduct(items.map((i) => i.variantId), ex);
    return items.reduce((a, i) => a + ((rows.find((r) => r.v.id === i.variantId)?.v.weightG ?? 500) * i.qty) / 1000, 0);
  }

  async options(inp: DeliveryInput, ex: Executor = this.db): Promise<DeliveryOption[]> {
    const now = inp.now ?? new Date();
    const city = await this.city(inp.citySlug, ex);
    const zones = await ex.select().from(s.deliveryZones).where(eq(s.deliveryZones.cityId, city.id)).orderBy(asc(s.deliveryZones.id));
    const weight = await this.weightKg(inp.items, ex);
    const costCtx = { totalAfterDiscounts: inp.totalAfterDiscounts, hasFreeShippingItem: inp.hasFreeShippingItem, tierFreeShippingAlways: inp.tierFreeShippingAlways };
    const avail = await this.inventory.availability(inp.items.map((i) => i.variantId), city.slug, ex);
    const warehouseOk = inp.items.every((i) => (avail.get(i.variantId)?.warehouse ?? 0) >= i.qty);
    const anyOk = inp.items.every((i) => (avail.get(i.variantId)?.total ?? 0) >= i.qty);
    const out: DeliveryOption[] = [];

    const zone = zones.find((z) => z.id === inp.zoneId) ?? zones[0];
    if (city.ownCourier && zone && anyOk) {
      const c = deliveryCost("own_courier", costCtx);
      out.push({ method: "own_courier", label: METHOD_LABEL.own_courier, available: true, ...c, etaDate: ownCourierEta(now, zone), zone: { id: zone.id, name: zone.name } });
    } else out.push({ method: "own_courier", label: METHOD_LABEL.own_courier, available: false, cost: 0, free: false, etaDate: null,
      reason: city.ownCourier ? "Немає в наявності" : "Власна доставка в цьому місті недоступна" });

    const stores = await ex.select().from(s.locations).where(and(eq(s.locations.cityId, city.id), eq(s.locations.kind, "store"))).orderBy(asc(s.locations.id));
    const points: PickupPoint[] = [];
    for (const st of stores) {
      const source = (await this.inventory.hasAll(st.id, inp.items, ex)) ? "store" : warehouseOk ? "warehouse" : null;
      const eta = pickupEta(now, source); if (eta && source) points.push({ locationId: st.id, name: st.name, address: st.address, etaDate: eta, source });
    }
    points.sort((a, b) => a.etaDate.localeCompare(b.etaDate));
    out.push({ method: "store_pickup", label: METHOD_LABEL.store_pickup, available: points.length > 0, ...deliveryCost("store_pickup", costCtx),
      etaDate: points[0]?.etaDate ?? null, pickupPoints: points });

    for (const m of ["carrier_courier", "carrier_branch"] as const) {
      if (!warehouseOk) { out.push({ method: m, label: METHOD_LABEL[m], available: false, cost: 0, free: false, etaDate: null, reason: "Немає на складі" }); continue; }
      const c = deliveryCost(m, { ...costCtx, carrierTariff: await this.carrier.tariff(weight, m) });
      out.push({ method: m, label: METHOD_LABEL[m], available: true, ...c, etaDate: carrierEta(now, m), ...(m === "carrier_branch" ? { branches: await this.carrier.branches(city.slug) } : {}) });
    }
    return out;
  }
}
