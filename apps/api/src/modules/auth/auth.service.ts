import { Inject, Injectable, UnauthorizedException, HttpException, HttpStatus } from "@nestjs/common";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { DB, type Db } from "../../db/client.js";
import * as s from "../../db/schema.js";
import { cardNumber } from "../loyalty/loyalty.rules.js";

export interface AuthClaims { sub: number; phone: string; exp: number; }
const b64u = (b: Buffer | string) => Buffer.from(b).toString("base64url");

/**
 * Passwordless OTP (ADR-0011). Прототип: код зберігається в пам'яті, у dev-режимі повертається у відповіді.
 * Прод: Redis + SMS/Viber-провайдер, CAPTCHA, захист від SMS-pumping.
 */
@Injectable()
export class AuthService {
  private codes = new Map<string, { code: string; exp: number; attempts: number }>();
  private sent = new Map<string, number[]>();
  private readonly secret = process.env.AUTH_SECRET ?? "dev-only-secret-change-me";
  // DEMO_OTP=1 — показувати код і в production (публічне демо без SMS-провайдера)
  readonly devMode = process.env.NODE_ENV !== "production" || process.env.DEMO_OTP === "1";
  constructor(@Inject(DB) private readonly db: Db) {}

  requestOtp(phone: string, now = Date.now()): { sent: true; devCode?: string } {
    const recent = (this.sent.get(phone) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= 3) throw new HttpException("Забагато запитів коду, спробуйте за хвилину", HttpStatus.TOO_MANY_REQUESTS);
    const code = String(randomInt(100000, 1000000));
    this.codes.set(phone, { code, exp: now + 5 * 60_000, attempts: 0 }); this.sent.set(phone, [...recent, now]);
    return this.devMode ? { sent: true, devCode: code } : { sent: true };
  }

  async verifyOtp(phone: string, code: string): Promise<{ token: string; customerId: number }> {
    const e = this.codes.get(phone);
    if (!e || e.exp < Date.now() || e.attempts >= 5) throw new UnauthorizedException("Код недійсний або прострочений");
    e.attempts++;
    if (!timingSafeEqual(Buffer.from(e.code), Buffer.from(code.padEnd(6).slice(0, 6)))) throw new UnauthorizedException("Невірний код");
    this.codes.delete(phone);
    const customerId = await this.ensureCustomer(phone);
    return { token: this.sign({ sub: customerId, phone, exp: Math.floor(Date.now() / 1000) + 7 * 86400 }), customerId };
  }

  /** Кожен клієнт автоматично отримує картку лояльності рівня MEMBER. */
  async ensureCustomer(phone: string, name?: string, email?: string): Promise<number> {
    const [found] = await this.db.select({ id: s.customers.id }).from(s.customers).where(eq(s.customers.phone, phone));
    if (found) return found.id;
    const [c] = await this.db.insert(s.customers).values({ phone, name: name ?? null, email: email ?? null }).returning({ id: s.customers.id });
    const [{ n }] = (await this.db.select({ n: sql<number>`coalesce(max(id),0)::int + 1` }).from(s.loyaltyCards)) as [{ n: number }];
    await this.db.insert(s.loyaltyCards).values({ number: cardNumber(n), customerId: c!.id, tierCode: "MEMBER" });
    return c!.id;
  }

  sign(claims: AuthClaims): string {
    const body = b64u(JSON.stringify(claims));
    return `${body}.${b64u(createHmac("sha256", this.secret).update(body).digest())}`;
  }
  verify(token: string): AuthClaims | null {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const expected = b64u(createHmac("sha256", this.secret).update(body).digest());
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const claims = JSON.parse(Buffer.from(body, "base64url").toString()) as AuthClaims;
    return claims.exp * 1000 > Date.now() ? claims : null;
  }
}
