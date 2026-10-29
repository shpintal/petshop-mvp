/**
 * Pricing & Promo engine (ADR-0008) — чисті детерміновані функції.
 * Кожна знижка в результаті має пояснення (appliedRule), щоб клієнт і підтримка бачили, звідки ціна.
 */
import { pct } from "../../common/money.js";

export interface PriceLineInput {
  variantId: number; productId: number; brandId: number; categoryId: number;
  name: string; qty: number; unitPrice: number; onSale: boolean; freeShipping: boolean;
}
export interface PromoRule { id: number; title: string; percent: number; brandId: number | null; categoryId: number | null; }
export interface TierRule { code: string; discountPct: number; freeShippingAlways: boolean; }
/** best_of — застосовується більша зі знижок (картка або акція); stack — послідовно (1-a)(1-b) */
export type CombinationPolicy = "best_of" | "stack";

export interface AppliedRule { type: "tier" | "promo" | "tier+promo" | "none"; label: string; percent: number; }
export interface QuotedLine extends PriceLineInput { gross: number; discount: number; net: number; appliedRule: AppliedRule; }
export interface Quote {
  lines: QuotedLine[]; subtotal: number; discount: number; total: number;
  /** true, якщо хоча б один товар має прапорець безкоштовної доставки */
  hasFreeShippingItem: boolean; tierCode: string | null; policy: CombinationPolicy;
}

export interface QuoteContext {
  tier?: TierRule | null; promos: PromoRule[]; policy?: CombinationPolicy;
  /** categoryId → [categoryId, parentId, …] для акцій на батьківські категорії */
  categoryAncestors: Map<number, number[]>;
}

export function bestPromoFor(line: PriceLineInput, promos: PromoRule[], ancestors: Map<number, number[]>): PromoRule | null {
  const cats = ancestors.get(line.categoryId) ?? [line.categoryId];
  let best: PromoRule | null = null;
  for (const p of promos) {
    const brandOk = p.brandId == null || p.brandId === line.brandId;
    const catOk = p.categoryId == null || cats.includes(p.categoryId);
    if (brandOk && catOk && (p.brandId != null || p.categoryId != null) && (!best || p.percent > best.percent)) best = p;
  }
  return best;
}

export function quote(lines: PriceLineInput[], ctx: QuoteContext): Quote {
  const policy = ctx.policy ?? "best_of";
  const quoted = lines.map<QuotedLine>((l) => {
    if (!Number.isInteger(l.qty) || l.qty <= 0) throw new RangeError(`qty must be positive integer: ${l.qty}`);
    const gross = l.unitPrice * l.qty;
    // Уцінені товари (є стара ціна) не отримують додаткових знижок — типова роздрібна політика
    if (l.onSale) return { ...l, gross, discount: 0, net: gross, appliedRule: { type: "none", label: "Уцінка: додаткові знижки не діють", percent: 0 } };
    const promo = bestPromoFor(l, ctx.promos, ctx.categoryAncestors);
    const tierPct = ctx.tier?.discountPct ?? 0, promoPct = promo?.percent ?? 0;
    let rule: AppliedRule;
    if (policy === "stack" && tierPct > 0 && promoPct > 0) {
      const combined = Math.round((1 - (1 - tierPct / 100) * (1 - promoPct / 100)) * 10000) / 100;
      rule = { type: "tier+promo", label: `${promo!.title} + картка ${ctx.tier!.code}`, percent: combined };
    } else if (promoPct >= tierPct && promoPct > 0) rule = { type: "promo", label: promo!.title, percent: promoPct };
    else if (tierPct > 0) rule = { type: "tier", label: `Картка ${ctx.tier!.code} −${tierPct} %`, percent: tierPct };
    else rule = { type: "none", label: "Без знижки", percent: 0 };
    const discount = pct(gross, rule.percent);
    return { ...l, gross, discount, net: gross - discount, appliedRule: rule };
  });
  const subtotal = quoted.reduce((a, l) => a + l.gross, 0);
  const discount = quoted.reduce((a, l) => a + l.discount, 0);
  return { lines: quoted, subtotal, discount, total: subtotal - discount, hasFreeShippingItem: quoted.some((l) => l.freeShipping),
    tierCode: ctx.tier?.code ?? null, policy };
}
