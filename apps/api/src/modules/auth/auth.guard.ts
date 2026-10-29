import { Injectable, UnauthorizedException, createParamDecorator, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { AuthService, type AuthClaims } from "./auth.service.js";

type Req = { headers: Record<string, string | undefined>; customer?: AuthClaims | null };
export function readClaims(auth: AuthService, req: Req): AuthClaims | null {
  const h = req.headers["authorization"];
  return h?.startsWith("Bearer ") ? auth.verify(h.slice(7)) : null;
}
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Req>();
    req.customer = readClaims(this.auth, req);
    if (!req.customer) throw new UnauthorizedException("Потрібна автентифікація");
    return true;
  }
}
/** Опціональна автентифікація: гість або клієнт */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Req>(); req.customer = readClaims(this.auth, req); return true;
  }
}
export const Customer = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<Req>().customer ?? null);
