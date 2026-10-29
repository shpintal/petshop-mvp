/**
 * Delivery rules (ADR-0009): вартість і ETA для 4 способів доставки. Чисті функції.
 * Усі дати — календарні дати за часовим поясом Europe/Kyiv у форматі YYYY-MM-DD.
 */
export type DeliveryMethod = "own_courier" | "carrier_courier" | "store_pickup" | "carrier_branch";
export const METHOD_LABEL: Record<DeliveryMethod, string> = {
  own_courier: "Кур'єр магазину", carrier_courier: "Кур'єр Нової Пошти",
  store_pickup: "Самовивіз з магазину", carrier_branch: "Відділення Нової Пошти",
};
/** Пороги безкоштовної доставки, коп. (сума ПІСЛЯ знижок) */
export const FREE_THRESHOLD: Record<DeliveryMethod, number> = {
  own_courier: 1000_00, carrier_courier: 3000_00, carrier_branch: 3000_00, store_pickup: 0,
};
export const OWN_COURIER_COST = 105_00;

export interface KyivParts { y: number; m: number; d: number; hour: number; isoWeekday: number; }
export function kyivParts(now: Date): KyivParts {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" });
  const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
  const wd = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday!) + 1;
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), hour: Number(p.hour), isoWeekday: wd };
}
const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
export function addDays(dateIso: string, n: number): string {
  const [y, m, d] = dateIso.split("-").map(Number); return iso(y!, m!, d! + n);
}
export const isoWeekday = (dateIso: string): number => { const wd = new Date(dateIso + "T00:00:00Z").getUTCDay(); return wd === 0 ? 7 : wd; };
export const todayKyiv = (now: Date): string => { const p = kyivParts(now); return iso(p.y, p.m, p.d); };

/** Наступна дата доставки власним кур'єром: з завтра (до cut-off) або післязавтра, у дні графіка зони. */
export function ownCourierEta(now: Date, zone: { weekdays: number[]; cutoffHour: number }): string {
  if (zone.weekdays.length === 0) throw new Error("zone without delivery days");
  const p = kyivParts(now);
  let date = addDays(iso(p.y, p.m, p.d), p.hour < zone.cutoffHour ? 1 : 2);
  for (let i = 0; i < 14; i++, date = addDays(date, 1)) if (zone.weekdays.includes(isoWeekday(date))) return date;
  throw new Error("no delivery day within 14 days");
}
/** Самовивіз: завтра, якщо все є в магазині; +2 дні при переміщенні зі складу; null — недоступно. */
export function pickupEta(now: Date, source: "store" | "warehouse" | null): string | null {
  if (!source) return null;
  return addDays(todayKyiv(now), source === "store" ? 1 : 2);
}
/** Перевізник: відділення +2, кур'єр +3 дні; неділя переноситься на понеділок. */
export function carrierEta(now: Date, method: "carrier_branch" | "carrier_courier"): string {
  let d = addDays(todayKyiv(now), method === "carrier_branch" ? 2 : 3);
  if (isoWeekday(d) === 7) d = addDays(d, 1);
  return d;
}

export interface CostContext {
  totalAfterDiscounts: number; hasFreeShippingItem: boolean; tierFreeShippingAlways: boolean;
  /** Тариф перевізника (коп.) — від адаптера; для own_courier ігнорується */
  carrierTariff?: number;
}
export interface CostResult { cost: number; free: boolean; reason: string; }
export function deliveryCost(method: DeliveryMethod, c: CostContext): CostResult {
  if (method === "store_pickup") return { cost: 0, free: true, reason: "Самовивіз завжди безкоштовний" };
  if (c.tierFreeShippingAlways) return { cost: 0, free: true, reason: "Безкоштовна доставка за рівнем картки" };
  if (c.hasFreeShippingItem) return { cost: 0, free: true, reason: "У кошику товар із безкоштовною доставкою" };
  const threshold = FREE_THRESHOLD[method];
  if (c.totalAfterDiscounts >= threshold) return { cost: 0, free: true, reason: `Замовлення від ${threshold / 100} ₴ (після знижок)` };
  const cost = method === "own_courier" ? OWN_COURIER_COST : (c.carrierTariff ?? 0);
  return { cost, free: false, reason: `До безкоштовної доставки бракує ${((threshold - c.totalAfterDiscounts) / 100).toFixed(2)} ₴` };
}
