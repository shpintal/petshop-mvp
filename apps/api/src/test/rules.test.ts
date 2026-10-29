import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { quote, type PriceLineInput } from "../modules/pricing/pricing.rules.js";
import { deliveryCost, ownCourierEta, pickupEta, carrierEta, isoWeekday } from "../modules/delivery/delivery.rules.js";
import { lifeStageFor, recommend, scoreProduct, dailyDryFoodGrams, packLastsDays, type CandidateProduct, type PetProfile } from "../modules/pets/recommendation.rules.js";
import { tierFor, toNextTier, cardNumber } from "../modules/loyalty/loyalty.rules.js";
import { unitPricePerKg } from "../modules/catalog/unit-price.js";
import { slugify } from "../common/slug.js";

const line = (o: Partial<PriceLineInput> = {}): PriceLineInput => ({ variantId: 1, productId: 1, brandId: 10, categoryId: 100, name: "x", qty: 1, unitPrice: 500_00, onSale: false, freeShipping: false, ...o });
const anc = new Map([[100, [100, 1]], [200, [200, 2]]]);
const PRESTIGE = { code: "PRESTIGE", discountPct: 5, freeShippingAlways: false };

describe("pricing.quote", () => {
  test("знижка картки застосовується до кожного рядка", () => {
    const q = quote([line({ qty: 2 })], { tier: PRESTIGE, promos: [], categoryAncestors: anc });
    assert.equal(q.subtotal, 1000_00); assert.equal(q.discount, 50_00); assert.equal(q.total, 950_00);
    assert.equal(q.lines[0]!.appliedRule.type, "tier");
  });
  test("best_of: акція −15 % на бренд переважає картку −5 %", () => {
    const q = quote([line()], { tier: PRESTIGE, promos: [{ id: 1, title: "−15 % бренд", percent: 15, brandId: 10, categoryId: null }], categoryAncestors: anc });
    assert.equal(q.discount, 75_00); assert.equal(q.lines[0]!.appliedRule.type, "promo");
  });
  test("акція на батьківську категорію діє на дочірню", () => {
    const q = quote([line()], { tier: null, promos: [{ id: 2, title: "−10 % корм", percent: 10, brandId: null, categoryId: 1 }], categoryAncestors: anc });
    assert.equal(q.discount, 50_00);
  });
  test("stack: (1−0.05)(1−0.10) → 14.5 %", () => {
    const q = quote([line()], { tier: PRESTIGE, promos: [{ id: 2, title: "−10 %", percent: 10, brandId: 10, categoryId: null }], policy: "stack", categoryAncestors: anc });
    assert.equal(q.lines[0]!.appliedRule.percent, 14.5); assert.equal(q.discount, 72_50);
  });
  test("уцінений товар не отримує додаткових знижок", () => {
    const q = quote([line({ onSale: true })], { tier: PRESTIGE, promos: [], categoryAncestors: anc });
    assert.equal(q.discount, 0);
  });
  test("некоректна кількість → помилка", () => {
    assert.throws(() => quote([line({ qty: 0 })], { promos: [], categoryAncestors: anc }), RangeError);
  });
});

describe("delivery rules", () => {
  const base = { hasFreeShippingItem: false, tierFreeShippingAlways: false, carrierTariff: 85_00 };
  test("кур'єр: 999.99 ₴ → 105 ₴; 1000 ₴ → безкоштовно (поріг після знижок)", () => {
    assert.equal(deliveryCost("own_courier", { ...base, totalAfterDiscounts: 999_99 }).cost, 105_00);
    assert.equal(deliveryCost("own_courier", { ...base, totalAfterDiscounts: 1000_00 }).free, true);
  });
  test("перевізник: поріг 3000 ₴, інакше тариф адаптера", () => {
    assert.equal(deliveryCost("carrier_branch", { ...base, totalAfterDiscounts: 2999_00 }).cost, 85_00);
    assert.equal(deliveryCost("carrier_courier", { ...base, totalAfterDiscounts: 3000_00 }).cost, 0);
  });
  test("самовивіз, рівень SUPER, товар з безкоштовною доставкою → 0", () => {
    assert.equal(deliveryCost("store_pickup", { ...base, totalAfterDiscounts: 1 }).cost, 0);
    assert.equal(deliveryCost("own_courier", { ...base, totalAfterDiscounts: 1, tierFreeShippingAlways: true }).cost, 0);
    assert.equal(deliveryCost("carrier_branch", { ...base, totalAfterDiscounts: 1, hasFreeShippingItem: true }).cost, 0);
  });
  // 2026-10-28 — середа. 10:00 за Києвом = 08:00 UTC (EET, UTC+2 після переходу на зимовий час 25.10)
  const wedMorning = new Date("2026-10-28T08:00:00Z"), wedEvening = new Date("2026-10-28T15:00:00Z");
  test("власний кур'єр: до cut-off → завтра (чт), після → пт", () => {
    const zone = { weekdays: [1, 2, 3, 4, 5, 6], cutoffHour: 14 };
    assert.equal(ownCourierEta(wedMorning, zone), "2026-10-29");
    assert.equal(ownCourierEta(wedEvening, zone), "2026-10-30");
  });
  test("напрямок з доставкою лише у вівторок → наступний вівторок", () => {
    assert.equal(ownCourierEta(wedMorning, { weekdays: [2], cutoffHour: 12 }), "2026-11-03");
    assert.equal(isoWeekday("2026-11-03"), 2);
  });
  test("самовивіз: магазин → завтра, склад → +2, нема → null", () => {
    assert.equal(pickupEta(wedMorning, "store"), "2026-10-29");
    assert.equal(pickupEta(wedMorning, "warehouse"), "2026-10-30");
    assert.equal(pickupEta(wedMorning, null), null);
  });
  test("перевізник: неділя переноситься на понеділок", () => {
    const fri = new Date("2026-10-30T08:00:00Z");
    assert.equal(carrierEta(fri, "carrier_branch"), "2026-11-02");
    assert.equal(carrierEta(wedMorning, "carrier_courier"), "2026-10-31");
  });
});

describe("pets recommendations", () => {
  const today = new Date("2026-10-28T00:00:00Z");
  const cat: PetProfile = { species: "cat", birthDate: "2021-03-14", sterilised: true, allergies: ["курка"], sensitiveDigestion: false, weightKg: 4.6 };
  const P = (o: Partial<CandidateProduct>): CandidateProduct => ({ id: 1, species: "cat", isFood: true, lifeStage: "adult", foodClass: "premium", allergens: [], sterilised: false, sensitiveDigestion: false, grainFree: false, ratingAvg: 0, reviewsCount: 0, ...o });
  test("вікова група", () => {
    assert.equal(lifeStageFor("cat", "2026-05-01", today), "junior");
    assert.equal(lifeStageFor("dog", "2017-11-02", today), "senior");
    assert.equal(lifeStageFor("cat", cat.birthDate, today), "adult");
    assert.equal(lifeStageFor("bird", null, today), "all");
  });
  test("алерген і невідповідний вік виключають товар", () => {
    assert.equal(scoreProduct(cat, P({ allergens: ["Курка"] }), today), null);
    assert.equal(scoreProduct(cat, P({ lifeStage: "junior" }), today), null);
    assert.equal(scoreProduct(cat, P({ species: "dog" }), today), null);
  });
  test("ранжування: стерилізований + холістик вище", () => {
    const r = recommend(cat, [P({ id: 1 }), P({ id: 2, sterilised: true, foodClass: "holistic" }), P({ id: 3, allergens: ["курка"] })], today);
    assert.deepEqual(r.map((x) => x.productId), [2, 1]);
    assert.ok(r[0]!.reasons.includes("для стерилізованих"));
  });
  test("добова норма і на скільки днів вистачить пачки", () => {
    const g = dailyDryFoodGrams(cat, today)!;
    assert.ok(g > 40 && g < 90, `cat daily grams ${g}`);
    assert.equal(packLastsDays(2000, g), Math.floor(2000 / g));
  });
});

describe("loyalty, catalog, slug", () => {
  const tiers = [{ code: "MEMBER", minSpend: 0, discountPct: 3 }, { code: "PRESTIGE", minSpend: 15_000_00, discountPct: 5 }, { code: "SUPER", minSpend: 50_000_00, discountPct: 10 }];
  test("рівень за сумою покупок", () => {
    assert.equal(tierFor(0, tiers).code, "MEMBER"); assert.equal(tierFor(15_000_00, tiers).code, "PRESTIGE"); assert.equal(tierFor(60_000_00, tiers).code, "SUPER");
    assert.deepEqual(toNextTier(18_250_00, tiers), { next: "SUPER", remaining: 31_750_00 }); assert.equal(toNextTier(50_000_00, tiers), null);
  });
  test("номер картки — валідний EAN-13", () => {
    const valid = (code: string) => code.split("").reduce((a, d, i) => a + Number(d) * (i % 2 ? 3 : 1), 0) % 10 === 0;
    for (const seq of [1, 2, 99, 123456]) { const n = cardNumber(seq); assert.equal(n.length, 13); assert.ok(valid(n), n); }
    assert.equal(cardNumber(1), "2000000000015");
  });
  test("ціна за кг", () => { assert.equal(unitPricePerKg(1581_00, 2000), 790_50); assert.equal(unitPricePerKg(100_00, null), null); });
  test("транслітерація", () => { assert.equal(slugify("Сухий корм для котів з індичкою"), "sukhyi-korm-dlia-kotiv-z-indychkoiu"); });
});
