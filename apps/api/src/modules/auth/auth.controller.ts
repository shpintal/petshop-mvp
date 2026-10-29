import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { ApiZodBody, ZodPipe, phoneSchema } from "../../common/zod.js";
import { AuthService } from "./auth.service.js";

const OtpReq = z.object({ phone: phoneSchema });
const OtpVerify = z.object({ phone: phoneSchema, code: z.string().regex(/^\d{6}$/) });

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post("otp") @HttpCode(200) @ApiZodBody(OtpReq)
  request(@Body(new ZodPipe(OtpReq)) b: z.infer<typeof OtpReq>) { return this.auth.requestOtp(b.phone); }
  @Post("verify") @HttpCode(200) @ApiZodBody(OtpVerify)
  verify(@Body(new ZodPipe(OtpVerify)) b: z.infer<typeof OtpVerify>) { return this.auth.verifyOtp(b.phone, b.code); }
}
