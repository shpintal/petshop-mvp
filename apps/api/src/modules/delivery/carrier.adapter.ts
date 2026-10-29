/**
 * Адаптер перевізника (ADR-0009). Прод-реалізація звертається до JSON API Нової Пошти
 * (довідник відділень, розрахунок вартості, створення ТТН, трекінг) з кешуванням довідників.
 * У прототипі — детермінована заглушка з тим самим контрактом.
 */
export const CARRIER = Symbol("CARRIER");
export interface CarrierBranch { ref: string; name: string; address: string; }
export interface CarrierAdapter {
  readonly code: string;
  tariff(weightKg: number, method: "carrier_branch" | "carrier_courier"): Promise<number>;
  branches(citySlug: string): Promise<CarrierBranch[]>;
}
export class NovaPoshtaStubAdapter implements CarrierAdapter {
  readonly code = "nova_poshta";
  async tariff(weightKg: number, method: "carrier_branch" | "carrier_courier") {
    const kg = Math.max(1, Math.ceil(weightKg));
    return method === "carrier_branch" ? 70_00 + kg * 4_00 : 95_00 + kg * 5_00;
  }
  async branches(citySlug: string) {
    return [1, 2, 3, 5, 8].map((n) => ({ ref: `${citySlug}-np-${n}`, name: `Відділення №${n}`, address: `${citySlug}, вантажне відділення №${n}` }));
  }
}
