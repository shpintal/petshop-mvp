import { createHash } from "node:crypto";

export const PAYMENT_PROVIDER = Symbol("PAYMENT_PROVIDER");
export interface CheckoutSession { provider: string; method: "POST"; url: string; fields: Record<string, string>; }
export interface WebhookResult { orderNumber: string; status: "paid" | "failed"; providerRef: string; amount: number; }
/** ADR-0010: контракт платіжного провайдера. */
export interface PaymentProvider {
  readonly code: string;
  createCheckout(o: { orderNumber: string; amount: number; description: string; resultUrl: string; serverUrl: string }): CheckoutSession;
  verifyWebhook(body: Record<string, string>): WebhookResult | null;
}
/**
 * LiqPay (API v3 checkout): data = base64(JSON), signature = base64(sha1(private_key + data + private_key)).
 * Ключі — зі змінних середовища; у прототипі sandbox-значення за замовчуванням.
 * Перед продакшн-інтеграцією звірити поля з чинною документацією провайдера.
 */
export class LiqPayProvider implements PaymentProvider {
  readonly code = "liqpay";
  constructor(private readonly publicKey = process.env.LIQPAY_PUBLIC_KEY ?? "sandbox_public", private readonly privateKey = process.env.LIQPAY_PRIVATE_KEY ?? "sandbox_private") {}
  sign(data: string) { return createHash("sha1").update(this.privateKey + data + this.privateKey).digest("base64"); }
  createCheckout(o: { orderNumber: string; amount: number; description: string; resultUrl: string; serverUrl: string }): CheckoutSession {
    const payload = { version: 3, public_key: this.publicKey, action: "pay", amount: (o.amount / 100).toFixed(2), currency: "UAH",
      description: o.description, order_id: o.orderNumber, result_url: o.resultUrl, server_url: o.serverUrl, sandbox: this.publicKey.startsWith("sandbox") ? 1 : 0 };
    const data = Buffer.from(JSON.stringify(payload)).toString("base64");
    return { provider: this.code, method: "POST", url: "https://www.liqpay.ua/api/3/checkout", fields: { data, signature: this.sign(data) } };
  }
  verifyWebhook(body: Record<string, string>): WebhookResult | null {
    if (!body.data || !body.signature || this.sign(body.data) !== body.signature) return null;
    const d = JSON.parse(Buffer.from(body.data, "base64").toString("utf8")) as { order_id: string; status: string; payment_id?: string | number; amount: number };
    return { orderNumber: d.order_id, status: ["success", "sandbox"].includes(d.status) ? "paid" : "failed", providerRef: String(d.payment_id ?? ""), amount: Math.round(d.amount * 100) };
  }
}
