/**
 * Доменна модель PetShop Platform (PostgreSQL 18).
 * Гроші — цілі копійки (integer), щоб уникнути похибок float.
 */
import {
  pgTable, pgEnum, serial, integer, text, boolean, timestamp, jsonb, date, real,
  primaryKey, uniqueIndex, index, uuid, smallint,
} from "drizzle-orm/pg-core";

export const speciesEnum = pgEnum("species", ["dog", "cat", "bird", "rodent"]);
export const categoryKindEnum = pgEnum("category_kind", ["food", "treats", "accessory", "care", "pharmacy"]);
export const lifeStageEnum = pgEnum("life_stage", ["junior", "adult", "senior", "all"]);
export const foodClassEnum = pgEnum("food_class", ["economy", "premium", "super_premium", "holistic"]);
export const locationKindEnum = pgEnum("location_kind", ["store", "warehouse"]);
export const deliveryMethodEnum = pgEnum("delivery_method", ["own_courier", "carrier_courier", "store_pickup", "carrier_branch"]);
export const paymentMethodEnum = pgEnum("payment_method", ["online_now", "online_later", "cash_on_receipt", "card_on_receipt", "cod"]);
export const orderStatusEnum = pgEnum("order_status", ["pending_payment", "confirmed", "assembling", "shipped", "ready_for_pickup", "completed", "cancelled"]);
export const paymentStatusEnum = pgEnum("payment_status", ["not_required", "pending", "paid", "failed", "refunded"]);

// ---------- Довідники ----------
export const cities = pgTable("cities", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  nameUk: text("name_uk").notNull(),
  nameEn: text("name_en").notNull(),
  ownCourier: boolean("own_courier").notNull().default(false),
});

export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  kind: locationKindEnum("kind").notNull().default("store"),
  cityId: integer("city_id").notNull().references(() => cities.id),
  name: text("name").notNull(),
  address: text("address").notNull(),
  phone: text("phone"),
  opensAt: text("opens_at").notNull().default("09:00"),
  closesAt: text("closes_at").notNull().default("20:00"),
  lat: real("lat"),
  lng: real("lng"),
  rating: real("rating"),
  reviewsCount: integer("reviews_count").notNull().default(0),
  isNew: boolean("is_new").notNull().default(false),
});

export const deliveryZones = pgTable("delivery_zones", {
  id: serial("id").primaryKey(),
  cityId: integer("city_id").notNull().references(() => cities.id),
  name: text("name").notNull(),
  /** ISO-дні тижня, коли працює власний кур'єр: 1 = пн … 7 = нд */
  weekdays: smallint("weekdays").array().notNull(),
  cutoffHour: smallint("cutoff_hour").notNull().default(14),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  parentId: integer("parent_id"),
  slug: text("slug").notNull().unique(),
  nameUk: text("name_uk").notNull(),
  nameEn: text("name_en").notNull(),
  kind: categoryKindEnum("kind").notNull(),
  species: speciesEnum("species"),
  sort: integer("sort").notNull().default(0),
}, (t) => [index("categories_parent_idx").on(t.parentId)]);

export const brands = pgTable("brands", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  country: text("country").notNull(),
});

// ---------- Каталог: Product → Variant ----------
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  categoryId: integer("category_id").notNull().references(() => categories.id),
  brandId: integer("brand_id").notNull().references(() => brands.id),
  nameUk: text("name_uk").notNull(),
  nameEn: text("name_en").notNull(),
  descriptionUk: text("description_uk").notNull(),
  species: speciesEnum("species").notNull(),
  lifeStage: lifeStageEnum("life_stage").notNull().default("all"),
  foodClass: foodClassEnum("food_class"),
  proteinSource: text("protein_source"),
  proteinPct: real("protein_pct"),
  fatPct: real("fat_pct"),
  grainFree: boolean("grain_free").notNull().default(false),
  sterilised: boolean("sterilised").notNull().default(false),
  sensitiveDigestion: boolean("sensitive_digestion").notNull().default(false),
  /** Алергени складу (курка, яловичина, злаки, …) — для рекомендацій */
  allergens: text("allergens").array().notNull().default([]),
  /** Решта атрибутів для фасетів: тип шерсті, розмір породи тощо */
  attributes: jsonb("attributes").$type<Record<string, string>>().notNull().default({}),
  ratingAvg: real("rating_avg").notNull().default(0),
  reviewsCount: integer("reviews_count").notNull().default(0),
  isNew: boolean("is_new").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("products_category_idx").on(t.categoryId), index("products_brand_idx").on(t.brandId)]);

export const variants = pgTable("variants", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  sku: text("sku").notNull().unique(),
  ean: text("ean"),
  erpCode: text("erp_code"),
  /** Маса нетто, г (null для штучних товарів) */
  weightG: integer("weight_g"),
  packLabel: text("pack_label").notNull(),
  price: integer("price").notNull(),
  oldPrice: integer("old_price"),
  freeShipping: boolean("free_shipping").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
}, (t) => [index("variants_product_idx").on(t.productId)]);

export const stock = pgTable("stock", {
  variantId: integer("variant_id").notNull().references(() => variants.id, { onDelete: "cascade" }),
  locationId: integer("location_id").notNull().references(() => locations.id),
  qty: integer("qty").notNull().default(0),
  reserved: integer("reserved").notNull().default(0),
}, (t) => [primaryKey({ columns: [t.variantId, t.locationId] })]);

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  variantId: integer("variant_id").references(() => variants.id),
  author: text("author").notNull(),
  rating: smallint("rating").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("reviews_product_idx").on(t.productId)]);

export const promotions = pgTable("promotions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  percent: integer("percent").notNull(),
  brandId: integer("brand_id").references(() => brands.id),
  categoryId: integer("category_id").references(() => categories.id),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  active: boolean("active").notNull().default(true),
});

// ---------- Клієнти, лояльність, тварини ----------
export const loyaltyTiers = pgTable("loyalty_tiers", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  discountPct: integer("discount_pct").notNull(),
  /** Сума покупок (коп.) для переходу на рівень */
  minSpend: integer("min_spend").notNull(),
  freeShippingAlways: boolean("free_shipping_always").notNull().default(false),
});

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  email: text("email"),
  name: text("name"),
  marketingConsent: boolean("marketing_consent").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const loyaltyCards = pgTable("loyalty_cards", {
  id: serial("id").primaryKey(),
  number: text("number").notNull().unique(),
  customerId: integer("customer_id").notNull().references(() => customers.id).unique(),
  tierCode: text("tier_code").notNull().references(() => loyaltyTiers.code),
  bonusBalance: integer("bonus_balance").notNull().default(0),
  totalSpent: integer("total_spent").notNull().default(0),
});

export const pets = pgTable("pets", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  species: speciesEnum("species").notNull(),
  breed: text("breed"),
  birthDate: date("birth_date"),
  sterilised: boolean("sterilised").notNull().default(false),
  weightKg: real("weight_kg"),
  allergies: text("allergies").array().notNull().default([]),
  sensitiveDigestion: boolean("sensitive_digestion").notNull().default(false),
});

// ---------- Кошик, замовлення, платежі ----------
export const carts = pgTable("carts", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: integer("customer_id").references(() => customers.id),
  cityId: integer("city_id").references(() => cities.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cartItems = pgTable("cart_items", {
  cartId: uuid("cart_id").notNull().references(() => carts.id, { onDelete: "cascade" }),
  variantId: integer("variant_id").notNull().references(() => variants.id),
  qty: integer("qty").notNull(),
}, (t) => [primaryKey({ columns: [t.cartId, t.variantId] })]);

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  number: text("number").notNull().unique(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  status: orderStatusEnum("status").notNull(),
  cityId: integer("city_id").notNull().references(() => cities.id),
  deliveryMethod: deliveryMethodEnum("delivery_method").notNull(),
  pickupLocationId: integer("pickup_location_id").references(() => locations.id),
  carrierBranch: text("carrier_branch"),
  address: text("address"),
  etaDate: date("eta_date").notNull(),
  subtotal: integer("subtotal").notNull(),
  discount: integer("discount").notNull(),
  deliveryCost: integer("delivery_cost").notNull(),
  total: integer("total").notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  paymentStatus: paymentStatusEnum("payment_status").notNull(),
  pricingBreakdown: jsonb("pricing_breakdown").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("orders_customer_idx").on(t.customerId)]);

export const orderLines = pgTable("order_lines", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  variantId: integer("variant_id").notNull().references(() => variants.id),
  nameSnapshot: text("name_snapshot").notNull(),
  qty: integer("qty").notNull(),
  unitPrice: integer("unit_price").notNull(),
  discount: integer("discount").notNull(),
  lineTotal: integer("line_total").notNull(),
});

export const reservations = pgTable("reservations", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  variantId: integer("variant_id").notNull().references(() => variants.id),
  locationId: integer("location_id").notNull().references(() => locations.id),
  qty: integer("qty").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  released: boolean("released").notNull().default(false),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  status: paymentStatusEnum("status").notNull(),
  amount: integer("amount").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  providerRef: text("provider_ref"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("payments_idem_uq").on(t.idempotencyKey)]);

/** Transactional outbox (ADR-0007): події для ERP/CRM/SMS публікуються relay-воркером */
export const outbox = pgTable("outbox", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  aggregateId: text("aggregate_id").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
}, (t) => [index("outbox_unpublished_idx").on(t.publishedAt)]);
