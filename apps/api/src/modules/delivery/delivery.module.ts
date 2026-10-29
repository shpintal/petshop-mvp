import { Module } from "@nestjs/common";
import { DeliveryService } from "./delivery.service.js";
import { DeliveryController } from "./delivery.controller.js";
import { CARRIER, NovaPoshtaStubAdapter } from "./carrier.adapter.js";
import { CatalogModule } from "../catalog/catalog.module.js";
import { InventoryModule } from "../inventory/inventory.module.js";
import { PricingModule } from "../pricing/pricing.module.js";
@Module({
  imports: [CatalogModule, InventoryModule, PricingModule],
  controllers: [DeliveryController],
  providers: [DeliveryService, { provide: CARRIER, useClass: NovaPoshtaStubAdapter }],
  exports: [DeliveryService],
})
export class DeliveryModule {}
