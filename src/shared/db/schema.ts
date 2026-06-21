import {
  pgTable,
  uuid,
  text,
  varchar,
  boolean,
  integer,
  decimal,
  timestamp,
  jsonb,
  primaryKey,
} from "drizzle-orm/pg-core";

// ─── Better Auth (tablas base) ───────────────────────────────────────────────
// Better Auth genera y mantiene: user, session, account, verification.
// Extendemos `user` con campos del dominio. NO tocar las otras tres.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),

  // Campos extendidos del dominio
  organizationId: uuid("organization_id").references(() => organizations.id),
  branchId: uuid("branch_id").references(() => branches.id),
  roleId: integer("role_id").references(() => roles.id),
  isActive: boolean("is_active").notNull().default(true),
  deletedAt: timestamp("deleted_at"),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

// ─── Dominio ────────────────────────────────────────────────────────────────

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const branches = pgTable("branches", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: varchar("name", { length: 255 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const roles = pgTable("roles", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 50 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const units = pgTable("units", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  baseUnitId: integer("base_unit_id").references((): any => units.id),
  name: text("name").notNull(),
  abbreviation: text("abbreviation").notNull(),
  unitType: text("unit_type").notNull(),
  conversionFactor: decimal("conversion_factor", { precision: 15, scale: 6 })
    .notNull()
    .default("1"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const itemCategories = pgTable("item_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const items = pgTable("items", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id),
  categoryId: uuid("category_id").references(() => itemCategories.id),
  baseUnitId: integer("base_unit_id").references(() => units.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  purchasePrice: decimal("purchase_price", { precision: 15, scale: 2 }),
  salePrice: decimal("sale_price", { precision: 15, scale: 2 }),
  code: text("code"),
  barcode: text("barcode"),
  isActive: boolean("is_active").notNull().default(true),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const warehouses = pgTable("warehouses", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const warehouseBranches = pgTable(
  "warehouse_branches",
  {
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.warehouseId, t.branchId] }),
  }),
);

export const warehouseItemStocks = pgTable("warehouse_item_stocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id")
    .notNull()
    .references(() => items.id),
  warehouseId: uuid("warehouse_id")
    .notNull()
    .references(() => warehouses.id),
  quantity: decimal("quantity", { precision: 15, scale: 3 })
    .notNull()
    .default("0"),
  minStock: decimal("min_stock", { precision: 15, scale: 3 })
    .notNull()
    .default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const stockMovements = pgTable("stock_movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id),
  itemId: uuid("item_id")
    .notNull()
    .references(() => items.id),
  fromWarehouseId: uuid("from_warehouse_id").references(() => warehouses.id),
  toWarehouseId: uuid("to_warehouse_id").references(() => warehouses.id),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id),
  type: varchar("type", { length: 20 }).notNull(), // 'in' | 'out' | 'transfer' | 'adjustment'
  quantity: decimal("quantity", { precision: 15, scale: 3 }).notNull(),
  referenceId: uuid("reference_id"),
  referenceType: text("reference_type"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id),
  fullname: varchar("fullname", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: text("phone"),
  address: text("address"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sales = pgTable("sales", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id),
  customerId: uuid("customer_id").references(() => customers.id),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id),
  total: decimal("total", { precision: 15, scale: 2 }).notNull(),
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  cancellationReason: text("cancellation_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const saleItems = pgTable("sale_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  saleId: uuid("sale_id")
    .notNull()
    .references(() => sales.id),
  itemId: uuid("item_id")
    .notNull()
    .references(() => items.id),
  unitId: integer("unit_id").references(() => units.id),
  quantity: decimal("quantity", { precision: 15, scale: 3 }).notNull(),
  price: decimal("price", { precision: 15, scale: 2 }).notNull(),
});

export const providers = pgTable("providers", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: varchar("name", { length: 255 }).notNull(),
  companyName: text("company_name"),
  contactName: varchar("contact_name", { length: 100 }),
  contactEmail: varchar("contact_email", { length: 100 }),
  contactPhone: text("contact_phone"),
  isActive: boolean("is_active").notNull().default(true),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const providerOrders = pgTable("provider_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id),
  providerId: uuid("provider_id")
    .notNull()
    .references(() => providers.id),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id),
  total: decimal("total", { precision: 15, scale: 2 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  estimatedDelivery: timestamp("estimated_delivery"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const providerOrderItems = pgTable("provider_order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => providerOrders.id),
  itemId: uuid("item_id")
    .notNull()
    .references(() => items.id),
  unitId: integer("unit_id").references(() => units.id),
  quantity: decimal("quantity", { precision: 15, scale: 3 }).notNull(),
  cost: decimal("cost", { precision: 15, scale: 2 }).notNull(),
});

export const recommendations = pgTable("recommendations", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id),
  itemId: uuid("item_id").references(() => items.id),
  type: varchar("type", { length: 50 }).notNull(),
  description: text("description").notNull(),
  priority: varchar("priority", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
});

export const externalDataSources = pgTable("external_data_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  url: text("url"),
  lastFetchedAt: timestamp("last_fetched_at"),
  data: jsonb("data"),
});

export const rateLimit = pgTable("rateLimit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: text("last_request").notNull(),
});
