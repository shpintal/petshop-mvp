import "reflect-metadata";
import { Global, Module, type DynamicModule, Controller, Get, Inject } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";
import { sql } from "drizzle-orm";
import { DB, type DbHandle, type Db } from "./db/client.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { CatalogModule } from "./modules/catalog/catalog.module.js";
import { DeliveryModule } from "./modules/delivery/delivery.module.js";
import { CommerceModule } from "./modules/commerce.module.js";

@Controller("health")
class HealthController {
  constructor(@Inject(DB) private readonly db: Db) {}
  @Get() async health() { await this.db.execute(sql`select 1`); return { status: "ok" }; }
}
@Global()
@Module({})
class DbModule {
  static forRoot(h: DbHandle): DynamicModule { return { module: DbModule, providers: [{ provide: DB, useValue: h.db }], exports: [DB] }; }
}
@Module({})
export class AppModule {
  static forRoot(h: DbHandle): DynamicModule {
    return { module: AppModule, imports: [DbModule.forRoot(h), AuthModule, CatalogModule, DeliveryModule, CommerceModule], controllers: [HealthController] };
  }
}

export const API_PREFIX = "api/v1";
export async function createApp(h: DbHandle, opts: { logger?: boolean } = {}): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule.forRoot(h), new FastifyAdapter({ trustProxy: true, bodyLimit: 256 * 1024 }), { logger: opts.logger ? ["log", "warn", "error"] : false });
  app.setGlobalPrefix(API_PREFIX);
  app.enableCors({ origin: (process.env.WEB_ORIGIN ?? "http://localhost:3000").split(","), credentials: true });
  // Базові заголовки безпеки (у проді — також на рівні CDN/WAF)
  app.getHttpAdapter().getInstance().addHook("onSend", async (_req: unknown, reply: { header(k: string, v: string): void }) => {
    reply.header("x-content-type-options", "nosniff"); reply.header("referrer-policy", "strict-origin-when-cross-origin");
    reply.header("x-frame-options", "DENY"); reply.header("content-security-policy", "default-src 'none'; frame-ancestors 'none'");
  });
  await app.init(); await app.getHttpAdapter().getInstance().ready();
  return app;
}
export function openApiDocument(app: NestFastifyApplication): OpenAPIObject {
  return SwaggerModule.createDocument(app, new DocumentBuilder().setTitle("PetShop Platform API").setVersion("0.1.0")
    .setDescription("Commerce API зоомагазину: каталог, пошук, ціни, доставка, кошик, checkout, лояльність, улюбленці.")
    .addBearerAuth().build());
}
