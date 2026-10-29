import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { asc, eq, and } from "drizzle-orm";
import { z } from "zod";
import { DB, type Db } from "../../db/client.js";
import * as s from "../../db/schema.js";
import { ApiZodQuery, ZodPipe } from "../../common/zod.js";

const Q = z.object({ city: z.string().optional() });
@ApiTags("stores")
@Controller()
export class StoresController {
  constructor(@Inject(DB) private readonly db: Db) {}
  @Get("cities") cities() { return this.db.select().from(s.cities).orderBy(asc(s.cities.id)); }
  @Get("stores") @ApiZodQuery(Q)
  async stores(@Query(new ZodPipe(Q)) q: z.infer<typeof Q>) {
    const rows = await this.db.select({ l: s.locations, c: s.cities }).from(s.locations).innerJoin(s.cities, eq(s.locations.cityId, s.cities.id))
      .where(q.city ? and(eq(s.locations.kind, "store"), eq(s.cities.slug, q.city)) : eq(s.locations.kind, "store")).orderBy(asc(s.locations.id));
    return rows.map(({ l, c }) => ({ ...l, city: { slug: c.slug, nameUk: c.nameUk } }));
  }
}
