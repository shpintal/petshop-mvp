import { Global, Module } from "@nestjs/common";
import { AuthService } from "./auth.service.js";
import { AuthController } from "./auth.controller.js";
import { AuthGuard, OptionalAuthGuard } from "./auth.guard.js";
@Global()
@Module({ controllers: [AuthController], providers: [AuthService, AuthGuard, OptionalAuthGuard], exports: [AuthService, AuthGuard, OptionalAuthGuard] })
export class AuthModule {}
