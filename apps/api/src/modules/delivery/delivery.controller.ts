import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { ApiZodQuery, ZodPipe } from "../../common/zod.js";
import { DeliveryService } from "./delivery.service.js";
import { PricingService } from "../pricing/pricing.service.js";
import { OptionalAuthGuard, Customer } from "../auth/auth.guard.js";
import type { AuthClaims } from "../auth/auth.service.js";

const Q = z.object({ city: z.string(), variantId: z.coerce.number().int(), qty: z.coerce.number().int().min(1).default(1), zoneId: z.coerce.number().int().optional() });

/** Блок «Доставка» на картці товару: 4 способи з ETA і вартістю для обраного міста. */
@ApiTags("delivery")
@Controller("delivery")
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService, private readonly pricing: PricingService) {}
  @Get("options") @UseGuards(OptionalAuthGuard) @ApiZodQuery(Q)
  async options(@Query(new ZodPipe(Q)) q: z.infer<typeof Q>, @Customer() c: AuthClaims | null) {
    const cp = await this.pricing.customerPricing(c?.sub);
    const items = [{ variantId: q.variantId, qty: q.qty }];
    const quote = await this.pricing.quoteItems(items, cp?.tier ?? null);
    return this.delivery.options({ citySlug: q.city, items, totalAfterDiscounts: quote.total, hasFreeShippingItem: quote.hasFreeShippingItem,
      tierFreeShippingAlways: !!cp?.tier?.freeShippingAlways, zoneId: q.zoneId });
  }
}
