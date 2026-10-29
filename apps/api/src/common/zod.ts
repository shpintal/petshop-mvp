import { BadRequestException, applyDecorators, type PipeTransform } from "@nestjs/common";
import { ApiBody, ApiQuery } from "@nestjs/swagger";
import { z, type ZodType } from "zod";

/** Валідація входу схемою Zod (джерело правди для типів, валідації та OpenAPI). */
export class ZodPipe<T extends ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}
  transform(value: unknown): z.output<T> {
    const r = this.schema.safeParse(value);
    if (!r.success) throw new BadRequestException({ message: "Validation failed",
      issues: r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
    return r.data;
  }
}
const js = (s: ZodType) => z.toJSONSchema(s, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
export const ApiZodBody = (schema: ZodType) => ApiBody({ schema: js(schema) as any });
export const ApiZodQuery = (schema: z.ZodObject) =>
  applyDecorators(...Object.entries(schema.shape).map(([name, s]) =>
    ApiQuery({ name, required: !(s as ZodType).safeParse(undefined).success, schema: js(s as ZodType) as any })));

export const csv = z.string().optional().transform((s) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : undefined));
export const boolish = z.enum(["true", "false", "1", "0"]).optional().transform((v) => (v === undefined ? undefined : v === "true" || v === "1"));
export const phoneSchema = z.string().regex(/^\+380\d{9}$/, "Телефон у форматі +380XXXXXXXXX");
