import { Inject, Injectable, Logger } from "@nestjs/common";
import { isNull, inArray } from "drizzle-orm";
import { DB, type Db } from "../../db/client.js";
import * as s from "../../db/schema.js";
import type { Executor } from "../../common/types.js";

export type DomainEvent = "OrderPlaced" | "PaymentSucceeded" | "OrderCancelled" | "CustomerRegistered";

/** Transactional outbox (ADR-0007). `add` викликається в транзакції бізнес-операції. */
@Injectable()
export class OutboxService {
  private readonly log = new Logger("Outbox");
  constructor(@Inject(DB) private readonly db: Db) {}
  async add(tx: Executor, type: DomainEvent, aggregateId: string, payload: unknown) {
    await tx.insert(s.outbox).values({ type, aggregateId, payload: payload as object });
  }
  /** Relay: у проді публікує в NATS/RabbitMQ; у прототипі — логування й позначка published. */
  async relay(publish: (e: typeof s.outbox.$inferSelect) => Promise<void> = async (e) => this.log.log(`${e.type} ${e.aggregateId}`)) {
    const pending = await this.db.select().from(s.outbox).where(isNull(s.outbox.publishedAt)).limit(100);
    for (const e of pending) await publish(e);
    if (pending.length) await this.db.update(s.outbox).set({ publishedAt: new Date() }).where(inArray(s.outbox.id, pending.map((e) => e.id)));
    return pending.length;
  }
}
