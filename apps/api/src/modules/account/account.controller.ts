import { Body, Controller, Get, Inject, NotFoundException, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { DB, type Db } from "../../db/client.js";
import * as s from "../../db/schema.js";
import { ApiZodBody, ZodPipe } from "../../common/zod.js";
import { AuthGuard, Customer } from "../auth/auth.guard.js";
import type { AuthClaims } from "../auth/auth.service.js";
import { CatalogService } from "../catalog/catalog.service.js";
import { recommend, dailyDryFoodGrams, lifeStageFor, packLastsDays, type PetProfile } from "../pets/recommendation.rules.js";
import { toNextTier } from "../loyalty/loyalty.rules.js";

const NewPet = z.object({ name: z.string().trim().min(1).max(50), species: z.enum(["dog", "cat", "bird", "rodent"]), breed: z.string().max(80).optional(),
  birthDate: z.iso.date().optional(), sterilised: z.boolean().default(false), weightKg: z.number().positive().max(120).optional(),
  allergies: z.array(z.string().max(40)).max(10).default([]), sensitiveDigestion: z.boolean().default(false) });

/** Особистий кабінет: картка лояльності, улюбленці, рекомендації, замовлення. */
@ApiTags("account")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller("me")
export class AccountController {
  constructor(@Inject(DB) private readonly db: Db, private readonly catalog: CatalogService) {}

  @Get() async me(@Customer() c: AuthClaims) {
    const [cust] = await this.db.select().from(s.customers).where(eq(s.customers.id, c.sub));
    return cust;
  }
  @Get("loyalty") async loyalty(@Customer() c: AuthClaims) {
    const [row] = await this.db.select({ card: s.loyaltyCards, tier: s.loyaltyTiers }).from(s.loyaltyCards)
      .innerJoin(s.loyaltyTiers, eq(s.loyaltyCards.tierCode, s.loyaltyTiers.code)).where(eq(s.loyaltyCards.customerId, c.sub));
    if (!row) throw new NotFoundException("Картку не знайдено");
    const tiers = await this.db.select().from(s.loyaltyTiers).orderBy(asc(s.loyaltyTiers.minSpend));
    return { number: row.card.number, tier: row.tier, bonusBalance: row.card.bonusBalance, totalSpent: row.card.totalSpent, next: toNextTier(row.card.totalSpent, tiers), tiers };
  }
  @Get("pets") pets(@Customer() c: AuthClaims) { return this.db.select().from(s.pets).where(eq(s.pets.customerId, c.sub)).orderBy(asc(s.pets.id)); }
  @Post("pets") @ApiZodBody(NewPet)
  async addPet(@Body(new ZodPipe(NewPet)) b: z.infer<typeof NewPet>, @Customer() c: AuthClaims) {
    const [p] = await this.db.insert(s.pets).values({ ...b, customerId: c.sub, breed: b.breed ?? null, birthDate: b.birthDate ?? null, weightKg: b.weightKg ?? null }).returning();
    return p;
  }
  @Get("pets/:id/recommendations")
  async recommendations(@Param("id") id: string, @Customer() c: AuthClaims) {
    const [pet] = await this.db.select().from(s.pets).where(and(eq(s.pets.id, Number(id)), eq(s.pets.customerId, c.sub)));
    if (!pet) throw new NotFoundException("Улюбленця не знайдено");
    const today = new Date();
    const profile: PetProfile = { species: pet.species, birthDate: pet.birthDate, sterilised: pet.sterilised, allergies: pet.allergies, sensitiveDigestion: pet.sensitiveDigestion, weightKg: pet.weightKg };
    const { docs } = await this.catalog.index();
    const recs = recommend(profile, docs.map((d) => ({ id: d.id, species: d.species as PetProfile["species"], isFood: d.kind === "food", lifeStage: d.lifeStage as any,
      foodClass: d.foodClass, allergens: d.allergens, sterilised: d.sterilised, sensitiveDigestion: d.sensitiveDigestion, grainFree: d.grainFree,
      ratingAvg: d.ratingAvg, reviewsCount: d.reviewsCount })), today);
    const daily = dailyDryFoodGrams(profile, today);
    const byId = new Map(docs.map((d) => [d.id, d]));
    const vars = recs.length ? await this.db.select().from(s.variants).where(inArray(s.variants.productId, recs.map((r) => r.productId))) : [];
    return { pet: { ...pet, lifeStage: lifeStageFor(pet.species, pet.birthDate, today) }, dailyDryFoodGrams: daily,
      disclaimer: "Рекомендації інформаційні та не замінюють консультацію ветеринарного лікаря.",
      items: recs.map((r) => { const d = byId.get(r.productId)!;
        const packs = vars.filter((v) => v.productId === r.productId && v.weightG).map((v) => ({ packLabel: v.packLabel, lastsDays: daily ? packLastsDays(v.weightG!, daily) : null }));
        return { ...r, slug: d.slug, nameUk: d.nameUk, brandName: d.brandName, minPrice: d.minPrice, ratingAvg: d.ratingAvg, packs }; }) };
  }
  @Get("orders") orders(@Customer() c: AuthClaims) { return this.db.select().from(s.orders).where(eq(s.orders.customerId, c.sub)).orderBy(desc(s.orders.createdAt)).limit(50); }
  @Get("orders/:number") async order(@Param("number") n: string, @Customer() c: AuthClaims) {
    const [o] = await this.db.select().from(s.orders).where(and(eq(s.orders.number, n), eq(s.orders.customerId, c.sub)));
    if (!o) throw new NotFoundException("Замовлення не знайдено");
    return { ...o, lines: await this.db.select().from(s.orderLines).where(eq(s.orderLines.orderId, o.id)) };
  }
}
