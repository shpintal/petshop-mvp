import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { ApiZodBody, ZodPipe, phoneSchema } from "../../common/zod.js";
import { CheckoutService } from "./checkout.service.js";
import { OptionalAuthGuard, Customer } from "../auth/auth.guard.js";
import type { AuthClaims } from "../auth/auth.service.js";

export const PlaceOrder = z.object({
  cartId: z.uuid(),
  customer: z.object({ phone: phoneSchema, name: z.string().trim().min(2).max(100), email: z.email().optional() }),
  city: z.string(),
  delivery: z.object({ method: z.enum(["own_courier", "carrier_courier", "store_pickup", "carrier_branch"]), pickupLocationId: z.number().int().optional(),
    carrierBranch: z.string().optional(), address: z.string().trim().min(5).max(300).optional(), zoneId: z.number().int().optional() }),
  payment: z.enum(["online_now", "online_later", "cash_on_receipt", "card_on_receipt", "cod"]),
});
const Callback = z.object({ data: z.string(), signature: z.string() });

@ApiTags("checkout")
@Controller()
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}
  @Post("checkout") @HttpCode(201) @UseGuards(OptionalAuthGuard) @ApiZodBody(PlaceOrder)
  place(@Body(new ZodPipe(PlaceOrder)) b: z.infer<typeof PlaceOrder>, @Customer() c: AuthClaims | null) { return this.checkout.place(b, c?.sub); }
  @Post("payments/liqpay/callback") @HttpCode(200) @ApiZodBody(Callback)
  callback(@Body(new ZodPipe(Callback)) b: z.infer<typeof Callback>) { return this.checkout.paymentCallback(b); }
}
