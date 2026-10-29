import { Module } from "@nestjs/common";
import { CatalogModule } from "./catalog/catalog.module.js";
import { InventoryModule } from "./inventory/inventory.module.js";
import { PricingModule } from "./pricing/pricing.module.js";
import { DeliveryModule } from "./delivery/delivery.module.js";
import { CartService } from "./cart/cart.service.js";
import { CartController } from "./cart/cart.controller.js";
import { CheckoutService } from "./checkout/checkout.service.js";
import { CheckoutController } from "./checkout/checkout.controller.js";
import { OutboxService } from "./outbox/outbox.service.js";
import { PAYMENT_PROVIDER, LiqPayProvider } from "./payments/payment.provider.js";
import { StoresController } from "./stores/stores.controller.js";
import { ReviewsController } from "./reviews/reviews.controller.js";
import { AccountController } from "./account/account.controller.js";

/** Модулі, що оркеструють кілька bounded contexts (кошик → checkout → замовлення → оплата). */
@Module({
  imports: [CatalogModule, InventoryModule, PricingModule, DeliveryModule],
  controllers: [CartController, CheckoutController, StoresController, ReviewsController, AccountController],
  providers: [CartService, CheckoutService, OutboxService, { provide: PAYMENT_PROVIDER, useFactory: () => new LiqPayProvider() }],
  exports: [OutboxService],
})
export class CommerceModule {}
