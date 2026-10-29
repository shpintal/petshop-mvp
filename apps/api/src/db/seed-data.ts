/**
 * Детермінований генератор СИНТЕТИЧНИХ демо-даних. Бренди, адреси, тексти вигадані;
 * жоден контент стороннього сайту не використовується.
 */
import { slugify } from "../common/slug.js";

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
type Species = "dog" | "cat" | "bird" | "rodent";
type Kind = "food" | "treats" | "accessory" | "care" | "pharmacy";
type LifeStage = "junior" | "adult" | "senior" | "all";
type FoodClass = "economy" | "premium" | "super_premium" | "holistic";

export const CITIES = [
  { slug: "kyiv", nameUk: "Київ", nameEn: "Kyiv", ownCourier: true },
  { slug: "lviv", nameUk: "Львів", nameEn: "Lviv", ownCourier: true },
  { slug: "odesa", nameUk: "Одеса", nameEn: "Odesa", ownCourier: true },
  { slug: "dnipro", nameUk: "Дніпро", nameEn: "Dnipro", ownCourier: true },
  { slug: "kharkiv", nameUk: "Харків", nameEn: "Kharkiv", ownCourier: false },
];
export const LOCATIONS = [
  { slug: "kyiv-warehouse", kind: "warehouse", city: "kyiv", name: "Центральний склад", address: "Київ, вул. Складська, 1" },
  { slug: "kyiv-podil", kind: "store", city: "kyiv", name: "PetShop Поділ", address: "Київ, вул. Річкова, 12", lat: 50.465, lng: 30.515 },
  { slug: "kyiv-obolon", kind: "store", city: "kyiv", name: "PetShop Оболонь", address: "Київ, просп. Озерний, 7", lat: 50.501, lng: 30.498 },
  { slug: "kyiv-pozniaky", kind: "store", city: "kyiv", name: "PetShop Позняки", address: "Київ, вул. Садова, 41", lat: 50.397, lng: 30.633, isNew: true },
  { slug: "kyiv-sviatoshyn", kind: "store", city: "kyiv", name: "PetShop Святошин", address: "Київ, вул. Лісова, 3", lat: 50.457, lng: 30.365 },
  { slug: "lviv-center", kind: "store", city: "lviv", name: "PetShop Центр", address: "Львів, вул. Каштанова, 5", lat: 49.842, lng: 24.031 },
  { slug: "lviv-sykhiv", kind: "store", city: "lviv", name: "PetShop Сихів", address: "Львів, просп. Квітковий, 18", lat: 49.799, lng: 24.058 },
  { slug: "odesa-arcadia", kind: "store", city: "odesa", name: "PetShop Аркадія", address: "Одеса, вул. Морська, 22", lat: 46.429, lng: 30.761 },
  { slug: "odesa-center", kind: "store", city: "odesa", name: "PetShop Центр", address: "Одеса, вул. Липова, 9", lat: 46.482, lng: 30.735 },
  { slug: "dnipro-center", kind: "store", city: "dnipro", name: "PetShop Набережна", address: "Дніпро, наб. Світла, 14", lat: 48.466, lng: 35.046 },
  { slug: "kharkiv-center", kind: "store", city: "kharkiv", name: "PetShop Центр", address: "Харків, вул. Сонячна, 30", lat: 49.993, lng: 36.231, isNew: true },
] as const;
export const ZONES = [
  { city: "kyiv", name: "Київ (місто)", weekdays: [1, 2, 3, 4, 5, 6], cutoffHour: 14 },
  { city: "kyiv", name: "Ірпінський напрямок", weekdays: [4], cutoffHour: 12 },
  { city: "kyiv", name: "Боярський напрямок", weekdays: [2], cutoffHour: 12 },
  { city: "lviv", name: "Львів (місто)", weekdays: [1, 2, 3, 4, 5], cutoffHour: 14 },
  { city: "odesa", name: "Одеса (місто)", weekdays: [1, 2, 3, 4, 5], cutoffHour: 14 },
  { city: "dnipro", name: "Дніпро (місто)", weekdays: [1, 3, 5], cutoffHour: 14 },
];
export const TIERS = [
  { code: "MEMBER", name: "Member", discountPct: 3, minSpend: 0, freeShippingAlways: false },
  { code: "PRESTIGE", name: "Prestige", discountPct: 5, minSpend: 15_000_00, freeShippingAlways: false },
  { code: "SUPER", name: "Super", discountPct: 10, minSpend: 50_000_00, freeShippingAlways: true },
];
export const BRANDS = [
  { name: "Northpaw", country: "Канада", classes: ["holistic"] },
  { name: "Vitalis Pet", country: "Італія", classes: ["super_premium"] },
  { name: "Karpaty Natural", country: "Україна", classes: ["premium", "super_premium"] },
  { name: "Meadow & Co", country: "Велика Британія", classes: ["holistic", "super_premium"] },
  { name: "PurrLine", country: "Франція", classes: ["premium"], species: ["cat"] },
  { name: "Dobryi Pes", country: "Україна", classes: ["economy", "premium"], species: ["dog"] },
  { name: "Nordic Bowl", country: "Швеція", classes: ["super_premium"] },
  { name: "Feathery", country: "Бельгія", classes: ["premium"], species: ["bird"] },
  { name: "Hammy Joy", country: "Чехія", classes: ["premium"], species: ["rodent"] },
  { name: "SmartBite", country: "Польща", classes: ["economy", "premium"] },
  { name: "PlayPet", country: "Китай", kinds: ["accessory"] },
  { name: "VetLine", country: "Німеччина", kinds: ["pharmacy", "care"] },
] as { name: string; country: string; classes?: FoodClass[]; species?: Species[]; kinds?: Kind[] }[];

const SPECIES_UK: Record<Species, { gen: string; title: string }> = {
  dog: { gen: "собак", title: "Собаки" }, cat: { gen: "котів", title: "Коти" },
  bird: { gen: "птахів", title: "Птахи" }, rodent: { gen: "гризунів", title: "Гризуни" },
};
const SPECIES_EN: Record<Species, string> = { dog: "dogs", cat: "cats", bird: "birds", rodent: "rodents" };

export interface CategorySeed { slug: string; parent?: string; nameUk: string; nameEn: string; kind: Kind; species?: Species; sort: number; }
export function buildCategories(): CategorySeed[] {
  const out: CategorySeed[] = [];
  let sort = 0;
  for (const sp of ["dog", "cat", "bird", "rodent"] as Species[]) {
    const u = SPECIES_UK[sp], root = `${sp}-food`;
    out.push({ slug: root, nameUk: `Корм для ${u.gen}`, nameEn: `Food for ${SPECIES_EN[sp]}`, kind: "food", species: sp, sort: sort++ });
    out.push({ slug: `${sp}-dry-food`, parent: root, nameUk: `Сухий корм для ${u.gen}`, nameEn: `Dry food for ${SPECIES_EN[sp]}`, kind: "food", species: sp, sort: sort++ });
    if (sp === "dog" || sp === "cat")
      out.push({ slug: `${sp}-wet-food`, parent: root, nameUk: `Вологий корм для ${u.gen}`, nameEn: `Wet food for ${SPECIES_EN[sp]}`, kind: "food", species: sp, sort: sort++ });
    out.push({ slug: `${sp}-treats`, parent: root, nameUk: `Ласощі для ${u.gen}`, nameEn: `Treats for ${SPECIES_EN[sp]}`, kind: "treats", species: sp, sort: sort++ });
    out.push({ slug: `${sp}-accessories`, nameUk: `Аксесуари для ${u.gen}`, nameEn: `Accessories for ${SPECIES_EN[sp]}`, kind: "accessory", species: sp, sort: sort++ });
  }
  out.push({ slug: "pharmacy", nameUk: "Ветаптека", nameEn: "Vet pharmacy", kind: "pharmacy", sort: sort++ });
  out.push({ slug: "pharmacy-antiparasitic", parent: "pharmacy", nameUk: "Від бліх і кліщів", nameEn: "Flea & tick", kind: "pharmacy", sort: sort++ });
  out.push({ slug: "pharmacy-vitamins", parent: "pharmacy", nameUk: "Вітаміни та добавки", nameEn: "Vitamins & supplements", kind: "pharmacy", sort: sort++ });
  return out;
}

const PROTEINS = [
  { uk: "курка", en: "chicken", gen: "куркою", allergen: "курка" },
  { uk: "індичка", en: "turkey", gen: "індичкою", allergen: "індичка" },
  { uk: "лосось", en: "salmon", gen: "лососем", allergen: "риба" },
  { uk: "ягня", en: "lamb", gen: "ягням", allergen: "ягня" },
  { uk: "качка", en: "duck", gen: "качкою", allergen: "качка" },
  { uk: "яловичина", en: "beef", gen: "яловичиною", allergen: "яловичина" },
];
const STAGES: { v: LifeStage; dogUk: string; catUk: string; en: string }[] = [
  { v: "junior", dogUk: "для цуценят", catUk: "для кошенят", en: "Junior" },
  { v: "adult", dogUk: "для дорослих собак", catUk: "для дорослих котів", en: "Adult" },
  { v: "senior", dogUk: "для собак 7+", catUk: "для котів 7+", en: "Senior" },
];
const LINES = [
  { key: "classic", uk: "Classic", en: "Classic" },
  { key: "sterilised", uk: "Sterilised", en: "Sterilised", cat: true },
  { key: "sensitive", uk: "Sensitive", en: "Sensitive" },
  { key: "light", uk: "Light", en: "Light" },
];
const PRICE_PER_KG: Record<FoodClass, number> = { economy: 110, premium: 230, super_premium: 400, holistic: 560 };

export interface ProductSeed {
  slug: string; category: string; brand: string; nameUk: string; nameEn: string; descriptionUk: string; species: Species;
  lifeStage: LifeStage; foodClass?: FoodClass; proteinSource?: string; proteinPct?: number; fatPct?: number;
  grainFree: boolean; sterilised: boolean; sensitiveDigestion: boolean; allergens: string[]; attributes: Record<string, string>;
  isNew: boolean; variants: { sku: string; weightG: number | null; packLabel: string; price: number; oldPrice?: number; freeShipping: boolean; ean: string }[];
}

const round = (x: number) => Math.max(1, Math.round(x)) * 100; // ₴ → коп., ціле число гривень
const ean = (n: number) => { const base = ("482" + String(n).padStart(9, "0")).slice(0, 12);
  const s = base.split("").reduce((acc, d, i) => acc + Number(d) * (i % 2 ? 3 : 1), 0); return base + ((10 - (s % 10)) % 10); };

export function buildProducts(seed = 42): ProductSeed[] {
  const r = rng(seed); const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)]!;
  const out: ProductSeed[] = []; let skuN = 1000;
  const foodBrands = (sp: Species) => BRANDS.filter((b) => b.classes && (!b.species || b.species.includes(sp)));
  const mk = (p: Omit<ProductSeed, "slug" | "variants">, packs: { g: number | null; label: string; perUnit: number }[]) => {
    let slug = slugify(p.nameUk); while (out.some((o) => o.slug === slug)) slug += "-2";
    const variants = packs.map((pk) => { skuN++; const price = round(pk.perUnit);
      const sale = r() < 0.12; return { sku: `PS-${skuN}`, weightG: pk.g, packLabel: pk.label, price,
        oldPrice: sale ? round((price / 100) * 1.15) : undefined, freeShipping: r() < 0.1, ean: ean(skuN) }; });
    out.push({ ...p, slug, variants });
  };
  // ---- Сухі корми для собак і котів
  for (const sp of ["dog", "cat"] as Species[]) {
    for (const b of foodBrands(sp)) for (const st of STAGES) for (const line of LINES) {
      if (line.cat && sp !== "cat") continue;
      if (r() < 0.55) continue;
      const fc = pick(b.classes!), pr = pick(PROTEINS); const gf = fc === "holistic" || r() < 0.25;
      const stageUk = sp === "dog" ? st.dogUk : st.catUk;
      const nameUk = `${b.name} ${line.uk} ${gf ? "беззерновий " : ""}сухий корм ${stageUk} з ${pr.gen}`;
      const perKg = PRICE_PER_KG[fc] * (0.9 + r() * 0.3);
      const packs = sp === "cat" ? [{ g: 400, label: "400 г", perUnit: perKg * 0.4 * 1.25 }, { g: 2000, label: "2 кг", perUnit: perKg * 2 }, { g: 7000, label: "7 кг", perUnit: perKg * 7 * 0.88 }]
                                 : [{ g: 1500, label: "1.5 кг", perUnit: perKg * 1.5 * 1.1 }, { g: 3000, label: "3 кг", perUnit: perKg * 3 }, { g: 12000, label: "12 кг", perUnit: perKg * 12 * 0.85 }];
      const attributes: Record<string, string> = sp === "dog" ? { breedSize: pick(["малі породи", "середні породи", "великі породи", "усі породи"]) } : { coat: pick(["коротка шерсть", "довга шерсть", "будь-яка"]) };
      mk({ category: `${sp}-dry-food`, brand: b.name, nameUk, nameEn: `${b.name} ${line.en} ${gf ? "grain-free " : ""}dry food ${st.en} ${pr.en}`,
        descriptionUk: `Повнораціонний ${fc === "holistic" ? "холістик" : fc === "super_premium" ? "суперпреміум" : fc === "premium" ? "преміум" : ""} корм ${stageUk}. Основне джерело білка — ${pr.uk}.${gf ? " Без злаків." : ""}${line.key === "sensitive" ? " Підходить для чутливого травлення." : ""}${line.key === "sterilised" ? " Для стерилізованих тварин, контроль ваги." : ""}`,
        species: sp, lifeStage: st.v, foodClass: fc, proteinSource: pr.uk, proteinPct: Math.round(24 + r() * 14), fatPct: Math.round(10 + r() * 10),
        grainFree: gf, sterilised: line.key === "sterilised", sensitiveDigestion: line.key === "sensitive",
        allergens: [pr.allergen, ...(gf ? [] : ["злаки"])], attributes, isNew: r() < 0.08 }, packs);
    }
    // ---- Вологі корми
    for (const b of foodBrands(sp)) for (const pr of PROTEINS) {
      if (r() < 0.6) continue; const fc = pick(b.classes!); const st = pick(STAGES);
      const stageUk = sp === "dog" ? st.dogUk : st.catUk;
      mk({ category: `${sp}-wet-food`, brand: b.name, nameUk: `${b.name} вологий корм ${stageUk}, ${pr.uk} у соусі`, nameEn: `${b.name} wet food ${st.en} ${pr.en} in gravy`,
        descriptionUk: `Вологий корм ${stageUk} зі шматочками (${pr.uk}).`, species: sp, lifeStage: st.v, foodClass: fc, proteinSource: pr.uk,
        proteinPct: Math.round(8 + r() * 4), fatPct: Math.round(4 + r() * 4), grainFree: r() < 0.5, sterilised: false, sensitiveDigestion: false,
        allergens: [pr.allergen], attributes: {}, isNew: r() < 0.08 },
        sp === "cat" ? [{ g: 85, label: "85 г", perUnit: PRICE_PER_KG[fc] * 0.085 * 1.6 }] : [{ g: 400, label: "400 г", perUnit: PRICE_PER_KG[fc] * 0.4 * 1.2 }]);
    }
  }
  // ---- Корми для птахів і гризунів
  for (const sp of ["bird", "rodent"] as Species[]) for (const b of foodBrands(sp)) {
    const kinds = sp === "bird" ? ["хвилястих папуг", "канарок", "великих папуг", "екзотичних птахів"] : ["кроликів", "морських свинок", "шиншил", "хом'яків", "щурів"];
    for (const k of kinds) for (const v of ["Base", "Premium Mix"]) {
      const fc = pick(b.classes!);
      mk({ category: `${sp}-dry-food`, brand: b.name, nameUk: `${b.name} ${v} корм для ${k}`, nameEn: `${b.name} ${v} food for ${k}`,
        descriptionUk: `Збалансована зернова суміш для ${k}.`, species: sp, lifeStage: "all", foodClass: fc, grainFree: false, sterilised: false,
        sensitiveDigestion: false, allergens: ["злаки"], attributes: { animal: k }, isNew: r() < 0.08 },
        [{ g: 500, label: "500 г", perUnit: PRICE_PER_KG[fc] * 0.5 * 1.1 }, { g: 1000, label: "1 кг", perUnit: PRICE_PER_KG[fc] }]);
    }
  }
  // ---- Ласощі
  const TREATS = ["палички", "снеки", "кісточки", "подушечки", "сушене м'ясо"];
  for (const sp of ["dog", "cat", "bird", "rodent"] as Species[]) for (const t of TREATS) for (const pr of PROTEINS.slice(0, 3)) {
    if (r() < 0.55) continue; const b = pick(foodBrands(sp));
    const nameUk = sp === "bird" || sp === "rodent" ? `${b.name} ласощі ${t} для ${SPECIES_UK[sp].gen} з фруктами` : `${b.name} ласощі ${t} для ${SPECIES_UK[sp].gen} з ${pr.gen}`;
    if (out.some((o) => o.nameUk === nameUk)) continue;
    mk({ category: `${sp}-treats`, brand: b.name, nameUk, nameEn: `${b.name} ${t} treats`, descriptionUk: `Ласощі для заохочення та дресирування.`,
      species: sp, lifeStage: "all", grainFree: r() < 0.5, sterilised: false, sensitiveDigestion: false, allergens: sp === "bird" || sp === "rodent" ? [] : [pr.allergen],
      attributes: {}, isNew: r() < 0.1 }, [{ g: 100, label: "100 г", perUnit: 60 + r() * 90 }]);
  }
  // ---- Аксесуари
  const ACC: Record<Species, string[]> = {
    dog: ["Шлейка", "Повідець рулетка", "Лежак", "Миска нержавіюча", "Іграшка м'яч", "Іграшка канат", "Нашийник світловідбивний"],
    cat: ["Когтеточка-стовпчик", "Будиночок", "Іграшка вудка", "Лоток закритий", "Наповнювач бентонітовий", "Переноска"],
    bird: ["Клітка", "Жердинка", "Годівниця", "Поїлка", "Дзеркальце з дзвіночком"],
    rodent: ["Клітка", "Колесо бігове", "Будиночок дерев'яний", "Підстилка деревна", "Поїлка кулькова"],
  };
  const pb = BRANDS.find((b) => b.name === "PlayPet")!;
  for (const sp of ["dog", "cat", "bird", "rodent"] as Species[]) for (const a of ACC[sp]) {
    const sized = ["Шлейка", "Лежак", "Клітка", "Нашийник світловідбивний"].includes(a);
    const base = 120 + r() * 900;
    mk({ category: `${sp}-accessories`, brand: pb.name, nameUk: `${pb.name} ${a} для ${SPECIES_UK[sp].gen}`, nameEn: `${pb.name} ${a}`,
      descriptionUk: `${a} для ${SPECIES_UK[sp].gen}. Безпечні матеріали.`, species: sp, lifeStage: "all", grainFree: false, sterilised: false,
      sensitiveDigestion: false, allergens: [], attributes: {}, isNew: r() < 0.1 },
      sized ? [{ g: null, label: "S", perUnit: base }, { g: null, label: "M", perUnit: base * 1.25 }, { g: null, label: "L", perUnit: base * 1.5 }]
            : [{ g: null, label: "1 шт", perUnit: base }]);
  }
  // ---- Ветаптека
  const vb = BRANDS.find((b) => b.name === "VetLine")!;
  for (const sp of ["dog", "cat"] as Species[]) {
    for (const w of sp === "dog" ? ["до 10 кг", "10–25 кг", "25–40 кг"] : ["до 4 кг", "4–8 кг"])
      mk({ category: "pharmacy-antiparasitic", brand: vb.name, nameUk: `${vb.name} краплі від бліх і кліщів для ${SPECIES_UK[sp].gen} ${w}`, nameEn: `${vb.name} spot-on ${w}`,
        descriptionUk: `Ветеринарний засіб. Перед застосуванням проконсультуйтеся з ветеринарним лікарем.`, species: sp, lifeStage: "adult",
        grainFree: false, sterilised: false, sensitiveDigestion: false, allergens: [], attributes: { weightRange: w }, isNew: false },
        [{ g: null, label: "1 піпетка", perUnit: 180 + r() * 120 }, { g: null, label: "3 піпетки", perUnit: 480 + r() * 250 }]);
    for (const v of ["Мультивітаміни", "Для шерсті та шкіри", "Для суглобів", "Пробіотик"])
      mk({ category: "pharmacy-vitamins", brand: vb.name, nameUk: `${vb.name} ${v} для ${SPECIES_UK[sp].gen}`, nameEn: `${vb.name} ${v}`,
        descriptionUk: `Кормова добавка. Не є лікарським засобом.`, species: sp, lifeStage: "all", grainFree: false, sterilised: false,
        sensitiveDigestion: v === "Пробіотик", allergens: [], attributes: {}, isNew: r() < 0.1 }, [{ g: null, label: "60 таблеток", perUnit: 250 + r() * 300 }]);
  }
  return out;
}

const AUTHORS = ["Олена К.", "Андрій М.", "Ірина С.", "Тарас П.", "Марія Д.", "Сергій Л.", "Наталія В.", "Богдан Г.", "Оксана Р.", "Дмитро Ш."];
const REVIEW_TEXTS: Record<number, string[]> = {
  5: ["Улюбленець їсть із задоволенням, рекомендую.", "Чудова якість, беремо вже вдруге.", "Шерсть стала блискучою, травлення в нормі."],
  4: ["Добрий товар, але хотілося б більшу упаковку.", "Загалом задоволені, доставка швидка."],
  3: ["Нормально, але кіт їсть без ентузіазму.", "Середньо, очікували більшого."],
  2: ["Не підійшов нашому улюбленцю."],
  1: ["Не сподобалось, повернули."],
};
export function buildReviews(products: ProductSeed[], seed = 7) {
  const r = rng(seed); const out: { slug: string; author: string; rating: number; body: string; daysAgo: number }[] = [];
  for (const p of products) { const n = Math.floor(r() ** 2 * 14);
    for (let i = 0; i < n; i++) { const x = r(); const rating = x < 0.55 ? 5 : x < 0.8 ? 4 : x < 0.92 ? 3 : x < 0.97 ? 2 : 1;
      const texts = REVIEW_TEXTS[rating]!; out.push({ slug: p.slug, author: AUTHORS[Math.floor(r() * AUTHORS.length)]!, rating, body: texts[Math.floor(r() * texts.length)]!, daysAgo: Math.floor(r() * 400) }); } }
  return out;
}
