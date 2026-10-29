import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { DB, type Db } from "../../db/client.js";
import * as s from "../../db/schema.js";
import { AuthService } from "../auth/auth.service.js";
import { CartService } from "../cart/cart.service.js";
import { PricingService } from "../pricing/pricing.service.js";
import { DeliveryService } from "../delivery/delivery.service.js";
import { InventoryService } from "../inventory/inventory.service.js";
import { OutboxService } from "../outbox/outbox.service.js";
import { PAYMENT_PROVIDER, type PaymentProvider, type CheckoutSession } from "../payments/payment.provider.js";
import type { DeliveryMethod } from "../delivery/delivery.rules.js";

export interface PlaceOrderInput {
  cartId: string; customer: { phone: string; name: string; email?: string }; city: string;
  delivery: { method: DeliveryMethod; pickupLocationId?: number; carrierBranch?: string; address?: string; zoneId?: number };
  payment: "online_now" | "online_later" | "cash_on_receipt" | "card_on_receipt" | "cod";
}
const PAYMENT_ALLOWED: Record<DeliveryMethod, PlaceOrderInput["payment"][]> = {
  own_courier: ["online_now", "online_later", "cash_on_receipt", "card_on_receipt"],
  store_pickup: ["online_now", "online_later", "cash_on_receipt", "card_on_receipt"],
  carrier_courier: ["online_now", "online_later", "cod"], carrier_branch: ["online_now", "online_later", "cod"],
};

@Injectable()
export class CheckoutService {
  constructor(@Inject(DB) private readonly db: Db, private readonly auth: AuthService, private readonly carts: CartService,
              private readonly pricing: PricingService, private readonly delivery: DeliveryService, private readonly inventory: InventoryService,
              private readonly outbox: OutboxService, @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider) {}

  async place(inp: PlaceOrderInput, authCustomerId?: number | null, now = new Date()) {
    if (!PAYMENT_ALLOWED[inp.delivery.method].includes(inp.payment)) throw new BadRequestException(`Спосіб оплати ${inp.payment} недоступний для ${inp.delivery.method}`);
    const { items } = await this.carts.items(inp.cartId);
    if (!items.length) throw new BadRequestException("Кошик порожній");
    const customerId = authCustomerId ?? (await this.auth.ensureCustomer(inp.customer.phone, inp.customer.name, inp.customer.email));
    const cp = await this.pricing.customerPricing(customerId);
    const lines = items.map((i) => ({ variantId: i.variantId, qty: i.qty }));
    const quote = await this.pricing.quoteItems(lines, cp?.tier ?? null);
    const city = await this.delivery.city(inp.city);

    return this.db.transaction(async (tx) => {
      const options = await this.delivery.options({ citySlug: inp.city, items: lines, totalAfterDiscounts: quote.total, hasFreeShippingItem: quote.hasFreeShippingItem,
        tierFreeShippingAlways: !!cp?.tier?.freeShippingAlways, zoneId: inp.delivery.zoneId, now }, tx);
      const opt = options.find((o) => o.method === inp.delivery.method);
      if (!opt?.available) throw new BadRequestException(`Спосіб доставки недоступний: ${opt?.reason ?? inp.delivery.method}`);
      let etaDate = opt.etaDate!; let candidates: number[];
      const warehouse = await tx.select({ id: s.locations.id }).from(s.locations).where(eq(s.locations.kind, "warehouse"));
      const cityStores = await tx.select({ id: s.locations.id }).from(s.locations).where(and(eq(s.locations.cityId, city.id), eq(s.locations.kind, "store")));
      if (inp.delivery.method === "store_pickup") {
        const point = opt.pickupPoints!.find((p) => p.locationId === inp.delivery.pickupLocationId);
        if (!point) throw new BadRequestException("Оберіть магазин для самовивозу зі списку доступних");
        etaDate = point.etaDate; candidates = point.source === "store" ? [point.locationId] : warehouse.map((w) => w.id);
      } else if (inp.delivery.method === "own_courier") {
        if (!inp.delivery.address) throw new BadRequestException("Вкажіть адресу доставки");
        candidates = [...warehouse.map((w) => w.id), ...cityStores.map((c) => c.id)];
      } else {
        if (inp.delivery.method === "carrier_branch" && !inp.delivery.carrierBranch) throw new BadRequestException("Оберіть відділення перевізника");
        if (inp.delivery.method === "carrier_courier" && !inp.delivery.address) throw new BadRequestException("Вкажіть адресу доставки");
        candidates = warehouse.map((w) => w.id);
      }
      const deliveryCost = opt.cost; const total = quote.total + deliveryCost;
      const online = inp.payment === "online_now" || inp.payment === "online_later";
      const [seqRow] = (await tx.select({ n: sql<number>`coalesce(max(id),0)::int + 1` }).from(s.orders)) as [{ n: number }];
      const number = `PS-${now.toISOString().slice(2, 10).replace(/-/g, "")}-${String(seqRow.n).padStart(5, "0")}`;
      const [order] = await tx.insert(s.orders).values({
        number, customerId, status: inp.payment === "online_now" ? "pending_payment" : "confirmed", cityId: city.id, deliveryMethod: inp.delivery.method,
        pickupLocationId: inp.delivery.pickupLocationId ?? null, carrierBranch: inp.delivery.carrierBranch ?? null, address: inp.delivery.address ?? null,
        etaDate, subtotal: quote.subtotal, discount: quote.discount, deliveryCost, total, paymentMethod: inp.payment,
        paymentStatus: online ? "pending" : "not_required", pricingBreakdown: { lines: quote.lines.map((l) => ({ variantId: l.variantId, appliedRule: l.appliedRule })), delivery: { method: opt.method, reason: opt.reason } },
      }).returning();
      await tx.insert(s.orderLines).values(quote.lines.map((l) => ({ orderId: order!.id, variantId: l.variantId, nameSnapshot: l.name, qty: l.qty, unitPrice: l.unitPrice, discount: l.discount, lineTotal: l.net })));
      await this.inventory.reserve(tx, order!.id, lines, candidates);
      let checkout: CheckoutSession | null = null;
      if (online) {
        await tx.insert(s.payments).values({ orderId: order!.id, provider: this.payments.code, status: "pending", amount: total, idempotencyKey: `order:${number}` });
        if (inp.payment === "online_now") checkout = this.payments.createCheckout({ orderNumber: number, amount: total, description: `Замовлення ${number}`,
          resultUrl: `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/account/orders/${number}`, serverUrl: `${process.env.API_ORIGIN ?? "http://localhost:4000"}/api/v1/payments/liqpay/callback` });
      }
      await this.outbox.add(tx, "OrderPlaced", number, { number, customerId, total, deliveryMethod: opt.method, etaDate, payment: inp.payment });
      await tx.delete(s.cartItems).where(eq(s.cartItems.cartId, inp.cartId));
      return { orderId: order!.id, number, status: order!.status, total, subtotal: quote.subtotal, discount: quote.discount, deliveryCost, etaDate,
        payment: { method: inp.payment, status: order!.paymentStatus, checkout } };
    });
  }

  /** Вебхук платіжного провайдера: ідемпотентне оновлення платежу та замовлення. */
  async paymentCallback(body: Record<string, string>) {
    const r = this.payments.verifyWebhook(body);
    if (!r) throw new BadRequestException("Невалідний підпис");
    return this.db.transaction(async (tx) => {
      const [o] = await tx.select().from(s.orders).where(eq(s.orders.number, r.orderNumber));
      if (!o) throw new NotFoundException("Замовлення не знайдено");
      if (o.paymentStatus === "paid") return { orderNumber: o.number, status: "paid", idempotent: true };
      if (r.status === "paid" && r.amount !== o.total) throw new BadRequestException("Сума платежу не збігається");
      await tx.update(s.payments).set({ status: r.status, providerRef: r.providerRef }).where(eq(s.payments.orderId, o.id));
      await tx.update(s.orders).set({ paymentStatus: r.status, status: r.status === "paid" ? "confirmed" : o.status }).where(eq(s.orders.id, o.id));
      if (r.status === "paid") await this.outbox.add(tx, "PaymentSucceeded", o.number, { number: o.number, amount: r.amount });
      return { orderNumber: o.number, status: r.status, idempotent: false };
    });
  }
}
