import { Module } from "@nestjs/common";
import { CatalogService } from "./catalog.service.js";
import { CatalogController } from "./catalog.controller.js";
import { PgTrigramSearchProvider } from "../search/pg-trigram.provider.js";
import { SEARCH_PROVIDER } from "../search/search.provider.js";
import { InventoryModule } from "../inventory/inventory.module.js";
@Module({
  imports: [InventoryModule],
  controllers: [CatalogController],
  providers: [CatalogService, { provide: SEARCH_PROVIDER, useClass: PgTrigramSearchProvider }],
  exports: [CatalogService, SEARCH_PROVIDER],
})
export class CatalogModule {}
