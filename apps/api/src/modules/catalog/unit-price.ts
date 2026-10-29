/** Ціна за одиницю виміру: ₴/кг для вагових товарів (коп. за кг), null для штучних. */
export function unitPricePerKg(priceKop: number, weightG: number | null): number | null {
  if (!weightG || weightG <= 0) return null;
  return Math.round((priceKop * 1000) / weightG);
}
