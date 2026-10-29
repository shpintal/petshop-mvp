/**
 * Рекомендації корму за профілем тварини (rule-based). Контракт сумісний з майбутнім AI-консультантом (ADR-0012).
 */
export type Species = "dog" | "cat" | "bird" | "rodent";
export type LifeStage = "junior" | "adult" | "senior" | "all";
export interface PetProfile { species: Species; birthDate: string | null; sterilised: boolean; allergies: string[]; sensitiveDigestion: boolean; weightKg: number | null; }
export interface CandidateProduct {
  id: number; species: Species; isFood: boolean; lifeStage: LifeStage; foodClass: string | null; allergens: string[];
  sterilised: boolean; sensitiveDigestion: boolean; grainFree: boolean; ratingAvg: number; reviewsCount: number;
}
export interface Scored { productId: number; score: number; reasons: string[]; }

export function ageYears(birthDate: string, today: Date): number {
  const b = new Date(birthDate + "T00:00:00Z");
  return (today.getTime() - b.getTime()) / (365.25 * 86400000);
}
export function lifeStageFor(species: Species, birthDate: string | null, today: Date): LifeStage {
  if (!birthDate || species === "bird" || species === "rodent") return "all";
  const a = ageYears(birthDate, today);
  if (a < 1) return "junior";
  return a >= 7 ? "senior" : "adult";
}
const CLASS_W: Record<string, number> = { holistic: 1.5, super_premium: 1, premium: 0.5, economy: 0 };

export function scoreProduct(pet: PetProfile, p: CandidateProduct, today: Date): Scored | null {
  if (p.species !== pet.species || !p.isFood) return null;
  const allergies = pet.allergies.map((a) => a.toLowerCase());
  const conflict = p.allergens.find((a) => allergies.includes(a.toLowerCase()));
  if (conflict) return null;
  const stage = lifeStageFor(pet.species, pet.birthDate, today);
  if (p.lifeStage !== "all" && stage !== "all" && p.lifeStage !== stage) return null;
  const reasons: string[] = []; let score = 0;
  if (stage !== "all" && p.lifeStage === stage) { score += 3; reasons.push(`відповідає віку (${stage === "junior" ? "молодняк" : stage === "senior" ? "7+" : "доросла тварина"})`); }
  if (pet.sterilised && p.sterilised) { score += 2; reasons.push("для стерилізованих"); }
  if (pet.sensitiveDigestion && p.sensitiveDigestion) { score += 2; reasons.push("для чутливого травлення"); }
  if (allergies.length) reasons.push(`без алергенів: ${pet.allergies.join(", ")}`);
  if (p.grainFree && allergies.includes("злаки")) score += 1;
  score += CLASS_W[p.foodClass ?? "economy"] ?? 0;
  if (p.reviewsCount >= 3) score += (p.ratingAvg - 3) * 0.5;
  return { productId: p.id, score: Math.round(score * 100) / 100, reasons };
}
export function recommend(pet: PetProfile, products: CandidateProduct[], today: Date, limit = 8): Scored[] {
  return products.map((p) => scoreProduct(pet, p, today)).filter((x): x is Scored => x !== null)
    .sort((a, b) => b.score - a.score || a.productId - b.productId).slice(0, limit);
}
/**
 * Орієнтовна добова норма сухого корму, г: RER = 70·m^0.75 ккал; MER = RER·k; енергетичність 3.7 ккал/г.
 * k: цуценя/кошеня 2.0 (собака) / 2.5 (кіт), дорослий стерилізований 1.6/1.2, нестерилізований 1.8/1.4, 7+ 1.4/1.1.
 * Інформаційна оцінка, не ветеринарна рекомендація.
 */
export function dailyDryFoodGrams(pet: PetProfile, today: Date): number | null {
  if (!pet.weightKg || (pet.species !== "dog" && pet.species !== "cat")) return null;
  const stage = lifeStageFor(pet.species, pet.birthDate, today);
  const dog = pet.species === "dog";
  const k = stage === "junior" ? (dog ? 2.0 : 2.5) : stage === "senior" ? (dog ? 1.4 : 1.1) : pet.sterilised ? (dog ? 1.6 : 1.2) : (dog ? 1.8 : 1.4);
  return Math.round((70 * Math.pow(pet.weightKg, 0.75) * k) / 3.7);
}
export function packLastsDays(packGrams: number, dailyGrams: number): number { return Math.floor(packGrams / dailyGrams); }
