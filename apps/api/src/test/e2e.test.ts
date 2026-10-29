import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { createDb, type DbHandle } from "../db/client.js";
import { migrate } from "../db/migrate.js";
import { seed, DEMO_PHONE } from "../db/seed.js";
import { createApp, openApiDocument } from "../app.js";
import { OutboxService } from "../modules/outbox/outbox.service.js";

let h: DbHandle, app: NestFastifyApplication, token = "";
const P = "/api/v1";
async function call(method: "GET" | "POST" | "PUT", url: string, body?: unknown, auth = false) {
  const res = await app.inject({ method, url: P + url, payload: body as any, headers: auth ? { authorization: `Bearer ${token}` } : {} });
  return { status: res.statusCode, json: res.body ? JSON.parse(res.body) : null, headers: res.headers };
}
before(async () => { h = await createDb("pglite://memory"); await migrate(h.db); await seed(h.db); app = await createApp(h); });
after(async () => { await app.close(); await h.close(); });

test("health і заголовки безпеки", async () => {
  const r = await call("GET", "/health");
  assert.equal(r.status, 200); assert.equal(r.headers["x-content-type-options"], "nosniff");
});
test("дерево категорій: 4 види × (корм, аксесуари) + ветаптека", async () => {
  const r = await call("GET", "/categories");
  assert.equal(r.status, 200); assert.equal(r.json.length, 9);
  assert.ok(r.json.find((c: any) => c.slug === "cat-food").children.some((c: any) => c.slug === "cat-dry-food"));
});
let slug = "", variantIds: number[] = [];
test("каталог: фасети диз'юнктивні, фільтр бренду, сортування за ціною", async () => {
  const all = await call("GET", "/products?category=cat-dry-food&pageSize=96");
  assert.equal(all.status, 200); assert.ok(all.json.total > 20, `total ${all.json.total}`);
  const brand = all.json.facets.brand[0];
  const f = await call("GET", `/products?category=cat-dry-food&brand=${brand.value}&sort=price_asc&pageSize=96`);
  assert.equal(f.json.total, brand.count);
  assert.ok(f.json.items.every((d: any) => d.brandSlug === brand.value));
  const prices = f.json.items.map((d: any) => d.minPrice); assert.deepEqual(prices, [...prices].sort((a: number, b: number) => a - b));
  // диз'юнктивність: обраний бренд не обнуляє лічильники інших брендів
  assert.ok(f.json.facets.brand.length > 1 && f.json.facets.brand.find((b: any) => b.value === brand.value).selected);
  slug = f.json.items.find((d: any) => d.packLabels.length === 3)?.slug ?? f.json.items[0].slug;
});
test("нечіткий пошук українською: «корм котам» знаходить корм для котів", async () => {
  const r = await call("GET", "/products?q=" + encodeURIComponent("корм котам"));
  assert.equal(r.status, 200); assert.ok(r.json.total > 0);
  assert.ok(r.json.items.slice(0, 5).every((d: any) => d.species === "cat"), JSON.stringify(r.json.items.slice(0, 5).map((d: any) => d.nameUk)));
  const s = await call("GET", "/search/suggest?q=" + encodeURIComponent("ласощі"));
  assert.ok(s.json.products.length > 0 && s.json.categories.length > 0);
});
test("картка товару: варіанти, ціна за кг, наявність у магазинах міста, хлібні крихти", async () => {
  const r = await call("GET", `/products/${slug}?city=kyiv`);
  assert.equal(r.status, 200); assert.ok(r.json.variants.length >= 1);
  variantIds = r.json.variants.map((v: any) => v.id);
  const v = r.json.variants[0]; assert.ok(v.availability.total > 0);
  if (v.weightG) assert.equal(v.unitPricePerKg, Math.round((v.price * 1000) / v.weightG));
  assert.equal(r.json.breadcrumbs.at(-1).slug, "cat-dry-food");
  assert.equal((await call("GET", "/products/not-exists")).status, 404);
});
test("доставка на PDP: 4 способи з ETA", async () => {
  const r = await call("GET", `/delivery/options?city=kyiv&variantId=${variantIds[0]}&qty=1`);
  assert.equal(r.status, 200); assert.deepEqual(r.json.map((o: any) => o.method).sort(), ["carrier_branch", "carrier_courier", "own_courier", "store_pickup"]);
  const own = r.json.find((o: any) => o.method === "own_courier"); assert.ok(own.available && /^\d{4}-\d{2}-\d{2}$/.test(own.etaDate));
  const k = await call("GET", `/delivery/options?city=kharkiv&variantId=${variantIds[0]}`);
  assert.equal(k.json.find((o: any) => o.method === "own_courier").available, false);
});
test("валідація: некоректний телефон → 400 з описом поля", async () => {
  const r = await call("POST", "/auth/otp", { phone: "0501234567" });
  assert.equal(r.status, 400); assert.equal(r.json.issues[0].path, "phone");
});
test("OTP-вхід демо-клієнта і картка PRESTIGE", async () => {
  const o = await call("POST", "/auth/otp", { phone: DEMO_PHONE }); assert.equal(o.status, 200); assert.match(o.json.devCode, /^\d{6}$/);
  assert.equal((await call("POST", "/auth/verify", { phone: DEMO_PHONE, code: "000000" })).status, 401);
  const v = await call("POST", "/auth/verify", { phone: DEMO_PHONE, code: o.json.devCode }); assert.equal(v.status, 200); token = v.json.token;
  const l = await call("GET", "/me/loyalty", undefined, true);
  assert.equal(l.json.tier.code, "PRESTIGE"); assert.equal(l.json.next.next, "SUPER");
  assert.equal((await call("GET", "/me/loyalty")).status, 401);
});
test("рекомендації для кішки з алергією на курку", async () => {
  const pets = await call("GET", "/me/pets", undefined, true);
  const murka = pets.json.find((p: any) => p.name === "Мурка");
  const r = await call("GET", `/me/pets/${murka.id}/recommendations`, undefined, true);
  assert.equal(r.status, 200); assert.ok(r.json.items.length > 0); assert.ok(r.json.dailyDryFoodGrams > 0);
  for (const it of r.json.items) assert.ok(!/куркою/.test(it.nameUk), it.nameUk);
});
let orderNumber = "", checkoutFields: Record<string, string> = {}, orderTotal = 0;
test("кошик + checkout: знижка картки, оплата LiqPay, резерв, outbox", async () => {
  const c = await call("POST", "/carts", undefined, true); assert.equal(c.status, 201);
  const add = await call("POST", `/carts/${c.json.id}/items`, { variantId: variantIds.at(-1), qty: 2 }, true);
  assert.equal(add.status, 201); assert.equal(add.json.items[0].qty, 2);
  const dl = await call("GET", `/carts/${c.json.id}/delivery?city=kyiv`, undefined, true);
  assert.equal(dl.status, 200); assert.equal(dl.json.length, 4);
  const line = add.json.items[0];
  assert.ok(line.appliedRule.percent >= 5 || line.oldPrice, JSON.stringify(line.appliedRule));
  const r = await call("POST", "/checkout", { cartId: c.json.id, customer: { phone: DEMO_PHONE, name: "Демо Клієнт" }, city: "kyiv",
    delivery: { method: "own_courier", address: "Київ, вул. Тестова, 1, кв. 2" }, payment: "online_now" }, true);
  assert.equal(r.status, 201, JSON.stringify(r.json));
  assert.equal(r.json.status, "pending_payment"); assert.equal(r.json.total, r.json.subtotal - r.json.discount + r.json.deliveryCost);
  assert.equal(r.json.payment.checkout.url, "https://www.liqpay.ua/api/3/checkout");
  orderNumber = r.json.number; checkoutFields = r.json.payment.checkout.fields; orderTotal = r.json.total;
  const empty = await call("GET", `/carts/${c.json.id}`); assert.equal(empty.json.items.length, 0);
});
test("вебхук LiqPay: невалідний підпис → 400; валідний → paid; повтор — ідемпотентний", async () => {
  assert.equal((await call("POST", "/payments/liqpay/callback", { data: checkoutFields.data, signature: "bad" })).status, 400);
  const data = Buffer.from(JSON.stringify({ order_id: orderNumber, status: "sandbox", payment_id: 777, amount: orderTotal / 100 })).toString("base64");
  const signature = createHash("sha1").update("sandbox_private" + data + "sandbox_private").digest("base64");
  const ok = await call("POST", "/payments/liqpay/callback", { data, signature });
  assert.equal(ok.status, 200); assert.equal(ok.json.status, "paid"); assert.equal(ok.json.idempotent, false);
  assert.equal((await call("POST", "/payments/liqpay/callback", { data, signature })).json.idempotent, true);
  const o = await call("GET", `/me/orders/${orderNumber}`, undefined, true);
  assert.equal(o.json.paymentStatus, "paid"); assert.equal(o.json.status, "confirmed");
});
test("гостьовий checkout із самовивозом: картка MEMBER, оплата при отриманні", async () => {
  const c = await call("POST", "/carts"); await call("POST", `/carts/${c.json.id}/items`, { variantId: variantIds[0], qty: 1 });
  const opts = await call("GET", `/delivery/options?city=kyiv&variantId=${variantIds[0]}`);
  const point = opts.json.find((o: any) => o.method === "store_pickup").pickupPoints[0];
  const bad = await call("POST", "/checkout", { cartId: c.json.id, customer: { phone: "+380671112233", name: "Гість" }, city: "kyiv",
    delivery: { method: "store_pickup", pickupLocationId: point.locationId }, payment: "cod" });
  assert.equal(bad.status, 400);
  const r = await call("POST", "/checkout", { cartId: c.json.id, customer: { phone: "+380671112233", name: "Гість" }, city: "kyiv",
    delivery: { method: "store_pickup", pickupLocationId: point.locationId }, payment: "cash_on_receipt" });
  assert.equal(r.status, 201, JSON.stringify(r.json)); assert.equal(r.json.deliveryCost, 0); assert.equal(r.json.payment.status, "not_required");
  assert.equal(r.json.etaDate, point.etaDate);
});
test("outbox relay публікує події OrderPlaced і PaymentSucceeded", async () => {
  const seen: string[] = [];
  const n = await app.get(OutboxService).relay(async (e) => { seen.push(e.type); });
  assert.ok(n >= 3); assert.ok(seen.includes("OrderPlaced") && seen.includes("PaymentSucceeded"));
});
test("OpenAPI-документ генерується з Zod-схем", async () => {
  const doc = openApiDocument(app);
  assert.ok(Object.keys(doc.paths).length >= 20, `${Object.keys(doc.paths).length} paths`);
  assert.ok(doc.paths["/api/v1/checkout"]?.post?.requestBody);
});
