import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { ApiZodQuery, ZodPipe, boolish, csv } from "../../common/zod.js";
import { CatalogService } from "./catalog.service.js";
import { SEARCH_PROVIDER, type SearchProvider } from "../search/search.provider.js";
import { InventoryService } from "../inventory/inventory.service.js";

export const ListQuery = z.object({
  q: z.string().max(100).optional(), category: z.string().optional(), species: z.enum(["dog", "cat", "bird", "rodent"]).optional(),
  brand: csv, foodClass: csv, lifeStage: csv, proteinSource: csv, grainFree: boolish, sterilised: boolish, sensitiveDigestion: boolish,
  priceMin: z.coerce.number().int().nonnegative().optional(), priceMax: z.coerce.number().int().nonnegative().optional(),
  sort: z.enum(["popular", "price_asc", "price_desc", "new", "rating"]).optional(),
  page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(96).default(24),
});
const SuggestQuery = z.object({ q: z.string().min(2).max(100) });
const CityQuery = z.object({ city: z.string().optional() });

@ApiTags("catalog")
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService, @Inject(SEARCH_PROVIDER) private readonly search: SearchProvider,
              private readonly inventory: InventoryService) {}

  @Get("categories") tree() { return this.catalog.categoryTree(); }
  @Get("categories/:slug") category(@Param("slug") slug: string) { return this.catalog.category(slug); }

  @Get("products") @ApiZodQuery(ListQuery)
  list(@Query(new ZodPipe(ListQuery)) q: z.infer<typeof ListQuery>) { return this.search.search(q); }

  @Get("search/suggest") @ApiZodQuery(SuggestQuery)
  suggest(@Query(new ZodPipe(SuggestQuery)) q: z.infer<typeof SuggestQuery>) { return this.search.suggest(q.q); }

  @Get("products/:slug") @ApiZodQuery(CityQuery)
  async product(@Param("slug") slug: string, @Query(new ZodPipe(CityQuery)) q: z.infer<typeof CityQuery>) {
    const p = await this.catalog.product(slug);
    const avail = await this.inventory.availability(p.variants.map((v) => v.id), q.city);
    return { ...p, variants: p.variants.map((v) => ({ ...v, availability: avail.get(v.id) })) };
  }
}
