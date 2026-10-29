import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { ApiZodBody, ApiZodQuery, ZodPipe } from "../../common/zod.js";
import { CartService } from "./cart.service.js";
import { DeliveryService } from "../delivery/delivery.service.js";
import { PricingService } from "../pricing/pricing.service.js";
import { OptionalAuthGuard, Customer } from "../auth/auth.guard.js";
import type { AuthClaims } from "../auth/auth.service.js";

const AddItem = z.object({ variantId: z.number().int(), qty: z.number().int().min(1).max(99).default(1) });
const SetItem = z.object({ qty: z.number().int().min(0).max(99) });
const CityQ = z.object({ city: z.string().optional() });

@ApiTags("cart")
@Controller("carts")
@UseGuards(OptionalAuthGuard)
export class CartController {
  constructor(private readonly carts: CartService, private readonly delivery: DeliveryService, private readonly pricing: PricingService) {}
  @Post() @HttpCode(201) create(@Customer() c: AuthClaims | null) { return this.carts.create(c?.sub); }
  @Get(":id") @ApiZodQuery(CityQ)
  view(@Param("id", ParseUUIDPipe) id: string, @Query(new ZodPipe(CityQ)) q: z.infer<typeof CityQ>, @Customer() c: AuthClaims | null) { return this.carts.view(id, c?.sub, q.city); }
  /** Варіанти доставки для всього кошика (checkout) з урахуванням знижок і рівня картки. */
  @Get(":id/delivery") @ApiZodQuery(CityQ)
  async deliveryOptions(@Param("id", ParseUUIDPipe) id: string, @Query(new ZodPipe(CityQ)) q: z.infer<typeof CityQ>, @Customer() c: AuthClaims | null) {
    const { items } = await this.carts.items(id);
    if (!items.length) return [];
    const cp = await this.pricing.customerPricing(c?.sub);
    const lines = items.map((i) => ({ variantId: i.variantId, qty: i.qty }));
    const quote = await this.pricing.quoteItems(lines, cp?.tier ?? null);
    return this.delivery.options({ citySlug: q.city ?? "kyiv", items: lines, totalAfterDiscounts: quote.total, hasFreeShippingItem: quote.hasFreeShippingItem,
      tierFreeShippingAlways: !!cp?.tier?.freeShippingAlways });
  }
  @Post(":id/items") @ApiZodBody(AddItem)
  async add(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(AddItem)) b: z.infer<typeof AddItem>, @Customer() c: AuthClaims | null) {
    await this.carts.setQty(id, b.variantId, b.qty, "add"); return this.carts.view(id, c?.sub);
  }
  @Put(":id/items/:variantId") @ApiZodBody(SetItem)
  async set(@Param("id", ParseUUIDPipe) id: string, @Param("variantId") v: string, @Body(new ZodPipe(SetItem)) b: z.infer<typeof SetItem>, @Customer() c: AuthClaims | null) {
    await this.carts.setQty(id, Number(v), b.qty, "set"); return this.carts.view(id, c?.sub);
  }
}
