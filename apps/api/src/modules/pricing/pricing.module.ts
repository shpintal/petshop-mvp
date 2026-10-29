import { Module } from "@nestjs/common";
import { PricingService } from "./pricing.service.js";
import { CatalogModule } from "../catalog/catalog.module.js";
@Module({ imports: [CatalogModule], providers: [PricingService], exports: [PricingService] })
export class PricingModule {}
