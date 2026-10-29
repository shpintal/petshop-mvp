import { Body, Controller, Get, Inject, NotFoundException, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { DB, type Db } from "../../db/client.js";
import * as s from "../../db/schema.js";
import { ApiZodBody, ApiZodQuery, ZodPipe } from "../../common/zod.js";
import { AuthGuard, Customer } from "../auth/auth.guard.js";
import type { AuthClaims } from "../auth/auth.service.js";
import { CatalogService } from "../catalog/catalog.service.js";

const Page = z.object({ page: z.coerce.number().int().min(1).default(1) });
const NewReview = z.object({ rating: z.number().int().min(1).max(5), body: z.string().trim().min(10).max(2000), variantId: z.number().int().optional() });

/** Відгуки на рівні Product (ADR-0005) — агрегуються для всіх варіантів. */
@ApiTags("reviews")
@Controller("products/:slug/reviews")
export class ReviewsController {
  constructor(@Inject(DB) private readonly db: Db, private readonly catalog: CatalogService) {}
  private async productId(slug: string) {
    const [p] = await this.db.select({ id: s.products.id }).from(s.products).where(eq(s.products.slug, slug));
    if (!p) throw new NotFoundException("Товар не знайдено"); return p.id;
  }
  @Get() @ApiZodQuery(Page)
  async list(@Param("slug") slug: string, @Query(new ZodPipe(Page)) q: z.infer<typeof Page>) {
    const id = await this.productId(slug);
    return this.db.select().from(s.reviews).where(eq(s.reviews.productId, id)).orderBy(desc(s.reviews.createdAt)).limit(20).offset((q.page - 1) * 20);
  }
  @Post() @UseGuards(AuthGuard) @ApiBearerAuth() @ApiZodBody(NewReview)
  async create(@Param("slug") slug: string, @Body(new ZodPipe(NewReview)) b: z.infer<typeof NewReview>, @Customer() c: AuthClaims) {
    const id = await this.productId(slug);
    const [cust] = await this.db.select({ name: s.customers.name }).from(s.customers).where(eq(s.customers.id, c.sub));
    const [row] = await this.db.insert(s.reviews).values({ productId: id, variantId: b.variantId ?? null, rating: b.rating, body: b.body, author: cust?.name ?? "Покупець" }).returning();
    await this.db.execute(sql`update products set rating_avg = x.avg, reviews_count = x.n from (select round(avg(rating)::numeric,2)::real avg, count(*)::int n from reviews where product_id = ${id}) x where id = ${id}`);
    this.catalog.invalidate();
    return row;
  }
}
