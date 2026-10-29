export interface TierDef { code: string; minSpend: number; discountPct: number; }
/** Рівень за сумою покупок (коп.): найвищий, поріг якого досягнуто. */
export function tierFor(totalSpent: number, tiers: TierDef[]): TierDef {
  const sorted = [...tiers].sort((a, b) => a.minSpend - b.minSpend);
  let cur = sorted[0]!;
  for (const t of sorted) if (totalSpent >= t.minSpend) cur = t;
  return cur;
}
/** Скільки лишилось до наступного рівня (коп.) або null, якщо рівень максимальний. */
export function toNextTier(totalSpent: number, tiers: TierDef[]): { next: string; remaining: number } | null {
  const next = [...tiers].sort((a, b) => a.minSpend - b.minSpend).find((t) => t.minSpend > totalSpent);
  return next ? { next: next.code, remaining: next.minSpend - totalSpent } : null;
}
/** Номер картки EAN-13 з контрольною цифрою (префікс 2 — внутрішня нумерація). */
export function cardNumber(seq: number): string {
  const base = ("200" + String(seq).padStart(9, "0")).slice(0, 12);
  const s = base.split("").reduce((a, d, i) => a + Number(d) * (i % 2 ? 3 : 1), 0);
  return base + ((10 - (s % 10)) % 10);
}
