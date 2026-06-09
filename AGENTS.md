# AGENTS.md — TFG Backend (Cloudflare Workers)

> Leé este archivo completo antes de tocar cualquier archivo. Es la fuente de verdad de la arquitectura, convenciones y decisiones del proyecto.

---

## 1. Contexto del proyecto

Plataforma de inteligencia analítica para almacenes y despensas pequeñas de Argentina. Transforma el registro manual de ventas, stock y clientes en decisiones basadas en datos. Diferenciadores: integración de datos externos (tendencias de búsqueda, estacionalidad, precios mayoristas) y recomendaciones accionables generadas por IA.

**Stack:**
- Runtime: Cloudflare Workers (NO Node.js, NO Bun, NO VPS)
- Framework HTTP: Hono v4 + `@hono/zod-openapi`
- Base de datos: Neon PostgreSQL serverless (HTTP, no WebSocket pool)
- ORM: Drizzle ORM
- Auth: Better Auth
- Validación: Zod
- Lenguaje: TypeScript estricto
- Deploy: Wrangler CLI

---

## 2. Modelo mental: cómo funciona un Worker

Esto es **crítico**. Ignorarlo genera bugs sutiles y difíciles de detectar.

```
Cold start (isolate nuevo):
  1. Se ejecuta TODO el código top-level del módulo (src/index.ts)
  2. Se registran rutas, middlewares, se instancian objetos sin env
  3. El isolate queda en memoria

Request entrante (isolate caliente):
  1. Se reutiliza el isolate — el código top-level NO se vuelve a ejecutar
  2. Solo se ejecuta el handler específico de la ruta
  3. c.env está disponible aquí

Request entrante (isolate frío):
  1. Cloudflare mató el isolate anterior
  2. Se repite desde el cold start
```

**Consecuencias directas:**
- Las rutas se registran en top-level → se registran UNA vez por isolate ✅
- La DB se inicializa lazy con `getDb(c.env)` → singleton por isolate ✅
- NUNCA registres rutas dentro del fetch handler → se acumularían ❌
- NUNCA uses `process.env` → usá `c.env` (Hono) o el parámetro `env` del fetch handler ❌
- No hay `Bun.serve()` ni `app.listen()` → el entry point es `export default app` ✅

---

## 3. Estructura de directorios

```
src/
├── index.ts                          # Entry point. App top-level. NO lógica de negocio.
├── modules/                          # Un directorio por feature/dominio
│   ├── branches/
│   │   ├── domain/
│   │   │   └── branch.entity.ts      # Tipos e interfaces del dominio (NO clases Drizzle)
│   │   ├── use-cases/
│   │   │   ├── get-branches-paginated.use-case.ts
│   │   │   ├── get-branch-by-id.use-case.ts
│   │   │   ├── create-branch.use-case.ts
│   │   │   ├── update-branch.use-case.ts
│   │   │   └── delete-branch.use-case.ts
│   │   └── infra/
│   │       ├── http/
│   │       │   ├── branches.router.ts     # registerBranchRoutes(app). Rutas + handlers.
│   │       │   └── branches.schemas.ts    # Schemas Zod de validación HTTP
│   │       └── repository/
│   │           └── branches.repository.ts # Acceso a DB con Drizzle
│   ├── items/
│   ├── item-categories/
│   ├── sales/
│   ├── customers/
│   ├── providers/
│   ├── provider-orders/
│   ├── warehouses/
│   ├── stock-movements/
│   ├── units/
│   ├── users/
│   ├── organizations/
│   ├── recommendations/
│   └── external-data/
└── shared/
    ├── db/
    │   ├── index.ts                  # getDb() — lazy singleton por isolate
    │   └── schema.ts                 # Schema Drizzle completo (fuente de verdad del modelo)
    ├── auth/
    │   └── index.ts                  # Better Auth setup + authMiddleware
    ├── http/
    │   ├── api-response.ts           # ApiResponse, ApiError
    │   ├── middlewares.ts            # cors, error handler, not found, request logger
    │   └── openapi.ts                # setupOpenAPI(), Scalar docs
    ├── env/
    │   └── index.ts                  # type Env — bindings y variables del Worker
    └── types/
        └── app.ts                    # AppType, Variables — tipos globales de Hono
```

### Módulos presentes (uno por tabla principal)

| Módulo | Tablas que gestiona |
|---|---|
| `organizations` | organizations |
| `branches` | branches |
| `users` | user (Better Auth extendida) |
| `items` | items |
| `item-categories` | item_categories |
| `units` | units |
| `warehouses` | warehouses, warehouse_branches, warehouse_item_stocks |
| `stock-movements` | stock_movements |
| `sales` | sales, sale_items |
| `customers` | customers |
| `providers` | providers |
| `provider-orders` | provider_orders, provider_order_items |
| `recommendations` | recommendations |
| `external-data` | external_data_sources |

---

## 4. Convenciones de nomenclatura

| Artefacto | Convención | Ejemplo |
|---|---|---|
| Archivos | kebab-case | `get-branches-paginated.use-case.ts` |
| Clases | PascalCase | `BranchRepository`, `GetBranchesPaginated` |
| Funciones de registro | `register<Módulo>Routes` | `registerBranchRoutes` |
| Schemas Zod | sufijo `Schema` | `createBranchSchema`, `updateBranchSchema` |
| Tablas Drizzle | snake_case plural | `branches`, `sale_items` |
| Variables de entorno | UPPER_SNAKE_CASE | `DATABASE_URL` |
| Rutas HTTP | `/api/v1/<recurso>` | `/api/v1/branches` |
| Tags OpenAPI | PascalCase singular | `Branches`, `SaleItems` |

---

## 5. Tipos globales

```typescript
// shared/env/index.ts
export type Env = {
  DATABASE_URL: string
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
  // Agregar bindings de Cloudflare aquí (R2, Queue, KV) cuando se necesiten
}

// shared/types/app.ts
import type { OpenAPIHono } from '@hono/zod-openapi'
import type { Env } from '../env'

export type AuthUser = {
  id: string
  email: string
  name: string
  organizationId: string
  branchId: string
  roleId: number
  isActive: boolean
}

export type Variables = {
  user: AuthUser
}

export type AppType = OpenAPIHono<{
  Bindings: Env
  Variables: Variables
}>
```

---

## 6. Base de datos — getDb y schema

### 6.1 getDb — lazy singleton por isolate

```typescript
// shared/db/index.ts
import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import * as schema from './schema'
import type { Env } from '../env'

export type DB = ReturnType<typeof getDb>

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDb(env: Env) {
  if (!_db) {
    _db = drizzle(neon(env.DATABASE_URL), { schema })
  }
  return _db
}
```

**Regla:** Llamá `getDb(c.env)` dentro de los handlers o repositorios. NUNCA en top-level (no tenés `env` ahí).

### 6.2 Schema Drizzle (modelo completo)

El schema implementa exactamente el modelo del DER con los siguientes ajustes acordados:

- `user` → tabla de Better Auth extendida (campos `organization_id`, `branch_id`, `role_id`, `is_active`, `deleted_at` agregados)
- `sale_items` → tiene `unit_id` (FK nullable a `units`)
- `provider_order_items` → tiene `unit_id` (FK nullable a `units`)
- `recommendations` → tiene `item_id` (FK nullable a `items`)
- `stock_movements.reference_id` → polimórfico (se mantiene como está)
- Better Auth genera sus propias tablas `session`, `account`, `verification` — NO las toques

```typescript
// shared/db/schema.ts — estructura completa

import {
  pgTable, uuid, text, varchar, boolean, integer,
  decimal, timestamp, jsonb, primaryKey
} from 'drizzle-orm/pg-core'

// ─── Better Auth (base) ───────────────────────────────────────────────────────
// Better Auth genera: user, session, account, verification
// Extendemos `user` con campos propios del dominio

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  // Campos extendidos del dominio
  organizationId: uuid('organization_id').references(() => organizations.id),
  branchId: uuid('branch_id').references(() => branches.id),
  roleId: integer('role_id').references(() => roles.id),
  isActive: boolean('is_active').notNull().default(true),
  deletedAt: timestamp('deleted_at'),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
})

// ─── Dominio ──────────────────────────────────────────────────────────────────

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const branches = pgTable('branches', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  name: varchar('name', { length: 255 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const roles = pgTable('roles', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: varchar('name', { length: 50 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const units = pgTable('units', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  baseUnitId: integer('base_unit_id').references((): any => units.id),
  name: text('name').notNull(),
  abbreviation: text('abbreviation').notNull(),
  unitType: text('unit_type').notNull(),
  conversionFactor: decimal('conversion_factor', { precision: 15, scale: 6 }).notNull().default('1'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const itemCategories = pgTable('item_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const items = pgTable('items', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  categoryId: uuid('category_id').references(() => itemCategories.id),
  baseUnitId: integer('base_unit_id').references(() => units.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  purchasePrice: decimal('purchase_price', { precision: 15, scale: 2 }),
  salePrice: decimal('sale_price', { precision: 15, scale: 2 }),
  code: text('code'),
  barcode: text('barcode'),
  isActive: boolean('is_active').notNull().default(true),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const warehouses = pgTable('warehouses', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const warehouseBranches = pgTable('warehouse_branches', {
  warehouseId: uuid('warehouse_id').notNull().references(() => warehouses.id),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.warehouseId, t.branchId] }),
}))

export const warehouseItemStocks = pgTable('warehouse_item_stocks', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemId: uuid('item_id').notNull().references(() => items.id),
  warehouseId: uuid('warehouse_id').notNull().references(() => warehouses.id),
  quantity: decimal('quantity', { precision: 15, scale: 3 }).notNull().default('0'),
  minStock: decimal('min_stock', { precision: 15, scale: 3 }).notNull().default('0'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const stockMovements = pgTable('stock_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  itemId: uuid('item_id').notNull().references(() => items.id),
  fromWarehouseId: uuid('from_warehouse_id').references(() => warehouses.id),
  toWarehouseId: uuid('to_warehouse_id').references(() => warehouses.id),
  createdBy: text('created_by').notNull().references(() => user.id),
  type: varchar('type', { length: 20 }).notNull(), // 'in' | 'out' | 'transfer' | 'adjustment'
  quantity: decimal('quantity', { precision: 15, scale: 3 }).notNull(),
  referenceId: uuid('reference_id'),               // polimórfico: sale_id | order_id
  referenceType: text('reference_type'),           // 'sale' | 'provider_order' | 'manual'
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  fullname: varchar('fullname', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: text('phone'),
  address: text('address'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const sales = pgTable('sales', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  customerId: uuid('customer_id').references(() => customers.id),
  createdBy: text('created_by').notNull().references(() => user.id),
  total: decimal('total', { precision: 15, scale: 2 }).notNull(),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  cancellationReason: text('cancellation_reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
})

export const saleItems = pgTable('sale_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  saleId: uuid('sale_id').notNull().references(() => sales.id),
  itemId: uuid('item_id').notNull().references(() => items.id),
  unitId: integer('unit_id').references(() => units.id),   // agregado
  quantity: decimal('quantity', { precision: 15, scale: 3 }).notNull(),
  price: decimal('price', { precision: 15, scale: 2 }).notNull(),
})

export const providers = pgTable('providers', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  name: varchar('name', { length: 255 }).notNull(),
  companyName: text('company_name'),
  contactName: varchar('contact_name', { length: 100 }),
  contactEmail: varchar('contact_email', { length: 100 }),
  contactPhone: text('contact_phone'),
  isActive: boolean('is_active').notNull().default(true),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const providerOrders = pgTable('provider_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  providerId: uuid('provider_id').notNull().references(() => providers.id),
  createdBy: text('created_by').notNull().references(() => user.id),
  total: decimal('total', { precision: 15, scale: 2 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending | received | cancelled
  estimatedDelivery: timestamp('estimated_delivery'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const providerOrderItems = pgTable('provider_order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => providerOrders.id),
  itemId: uuid('item_id').notNull().references(() => items.id),
  unitId: integer('unit_id').references(() => units.id),   // agregado
  quantity: decimal('quantity', { precision: 15, scale: 3 }).notNull(),
  cost: decimal('cost', { precision: 15, scale: 2 }).notNull(),
})

export const recommendations = pgTable('recommendations', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  itemId: uuid('item_id').references(() => items.id),      // agregado, nullable
  type: varchar('type', { length: 50 }).notNull(),         // 'restock' | 'pricing' | 'trend' | 'seasonal'
  description: text('description').notNull(),
  priority: varchar('priority', { length: 20 }).notNull(), // 'high' | 'medium' | 'low'
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending | dismissed | applied
  generatedAt: timestamp('generated_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'),
})

export const externalDataSources = pgTable('external_data_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'search_trends' | 'wholesale_prices' | 'seasonality'
  url: text('url'),
  lastFetchedAt: timestamp('last_fetched_at'),
  data: jsonb('data'),
})
```

---

## 7. Patrón de implementación por módulo

Seguí este patrón para TODOS los módulos. No improvises variantes.

### 7.1 Repository

```typescript
// modules/branches/infra/repository/branches.repository.ts
import { eq, and, isNull, count } from 'drizzle-orm'
import type { DB } from '../../../../shared/db'
import * as schema from '../../../../shared/db/schema'

export class BranchRepository {
  constructor(private readonly db: DB) {}

  async findAllByOrganization(organizationId: string, limit: number, offset: number) {
    return this.db
      .select()
      .from(schema.branches)
      .where(
        and(
          eq(schema.branches.organizationId, organizationId),
          isNull(schema.branches.deletedAt)
        )
      )
      .limit(limit)
      .offset(offset)
  }

  async findById(id: string) {
    const result = await this.db
      .select()
      .from(schema.branches)
      .where(and(eq(schema.branches.id, id), isNull(schema.branches.deletedAt)))
      .limit(1)
    return result[0] ?? null
  }

  async create(data: typeof schema.branches.$inferInsert) {
    const result = await this.db
      .insert(schema.branches)
      .values(data)
      .returning()
    return result[0]
  }

  async update(id: string, data: Partial<typeof schema.branches.$inferInsert>) {
    const result = await this.db
      .update(schema.branches)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.branches.id, id))
      .returning()
    return result[0] ?? null
  }

  async softDelete(id: string) {
    await this.db
      .update(schema.branches)
      .set({ deletedAt: new Date(), isActive: false })
      .where(eq(schema.branches.id, id))
  }

  async countByOrganization(organizationId: string) {
    const result = await this.db
      .select({ value: count() })
      .from(schema.branches)
      .where(
        and(
          eq(schema.branches.organizationId, organizationId),
          isNull(schema.branches.deletedAt)
        )
      )
    return result[0]?.value ?? 0
  }
}
```

### 7.2 Use Case

```typescript
// modules/branches/use-cases/get-branches-paginated.use-case.ts
import type { BranchRepository } from '../infra/repository/branches.repository'

export type GetBranchesPaginatedInput = {
  organizationId: string
  page: number
  limit: number
}

export class GetBranchesPaginated {
  constructor(private readonly repo: BranchRepository) {}

  async execute({ organizationId, page, limit }: GetBranchesPaginatedInput) {
    const offset = (page - 1) * limit
    const [data, total] = await Promise.all([
      this.repo.findAllByOrganization(organizationId, limit, offset),
      this.repo.countByOrganization(organizationId),
    ])
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
  }
}
```

### 7.3 Schemas Zod

```typescript
// modules/branches/infra/http/branches.schemas.ts
import { z } from '@hono/zod-openapi'

export const createBranchSchema = z.object({
  name: z.string().min(1).max(255),
  isActive: z.boolean().optional().default(true),
})

export const updateBranchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  isActive: z.boolean().optional(),
})

export const getBranchesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const branchParamsSchema = z.object({
  id: z.string().uuid(),
})
```

### 7.4 Router

```typescript
// modules/branches/infra/http/branches.router.ts
import { createRoute } from '@hono/zod-openapi'
import { getDb } from '../../../../shared/db'
import { ApiResponse, ApiError } from '../../../../shared/http/api-response'
import { authMiddleware } from '../../../../shared/auth'
import { BranchRepository } from '../repository/branches.repository'
import { GetBranchesPaginated } from '../../use-cases/get-branches-paginated.use-case'
import { GetBranchById } from '../../use-cases/get-branch-by-id.use-case'
import { CreateBranch } from '../../use-cases/create-branch.use-case'
import { UpdateBranch } from '../../use-cases/update-branch.use-case'
import { DeleteBranch } from '../../use-cases/delete-branch.use-case'
import {
  createBranchSchema,
  updateBranchSchema,
  getBranchesQuerySchema,
  branchParamsSchema,
} from './branches.schemas'
import type { AppType } from '../../../../shared/types/app'

export function registerBranchRoutes(app: AppType) {
  // GET /api/v1/branches
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/branches',
      tags: ['Branches'],
      summary: 'Listar sucursales paginadas',
      middleware: [authMiddleware] as const,
      request: { query: getBranchesQuerySchema },
      responses: {
        200: { description: 'Sucursales obtenidas' },
        401: { description: 'No autenticado' },
      },
    }),
    async (c) => {
      const db = getDb(c.env)
      const repo = new BranchRepository(db)
      const useCase = new GetBranchesPaginated(repo)
      const user = c.get('user')
      const query = c.req.valid('query')
      const data = await useCase.execute({ organizationId: user.organizationId, ...query })
      return c.json(new ApiResponse({ data, message: 'Sucursales obtenidas', status: 200 }), 200)
    }
  )

  // GET /api/v1/branches/:id
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/branches/{id}',
      tags: ['Branches'],
      summary: 'Obtener sucursal por ID',
      middleware: [authMiddleware] as const,
      request: { params: branchParamsSchema },
      responses: {
        200: { description: 'Sucursal encontrada' },
        404: { description: 'No encontrada' },
      },
    }),
    async (c) => {
      const db = getDb(c.env)
      const repo = new BranchRepository(db)
      const useCase = new GetBranchById(repo)
      const { id } = c.req.valid('param')
      const data = await useCase.execute(id)
      if (!data) throw new ApiError('Sucursal no encontrada', 404)
      return c.json(new ApiResponse({ data, message: 'Sucursal encontrada', status: 200 }), 200)
    }
  )

  // POST /api/v1/branches
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/v1/branches',
      tags: ['Branches'],
      summary: 'Crear sucursal',
      middleware: [authMiddleware] as const,
      request: {
        body: { content: { 'application/json': { schema: createBranchSchema } } },
      },
      responses: {
        201: { description: 'Sucursal creada' },
      },
    }),
    async (c) => {
      const db = getDb(c.env)
      const repo = new BranchRepository(db)
      const useCase = new CreateBranch(repo)
      const user = c.get('user')
      const body = c.req.valid('json')
      const data = await useCase.execute({ ...body, organizationId: user.organizationId })
      return c.json(new ApiResponse({ data, message: 'Sucursal creada', status: 201 }), 201)
    }
  )

  // PUT /api/v1/branches/:id
  app.openapi(
    createRoute({
      method: 'put',
      path: '/api/v1/branches/{id}',
      tags: ['Branches'],
      summary: 'Actualizar sucursal',
      middleware: [authMiddleware] as const,
      request: {
        params: branchParamsSchema,
        body: { content: { 'application/json': { schema: updateBranchSchema } } },
      },
      responses: {
        200: { description: 'Sucursal actualizada' },
        404: { description: 'No encontrada' },
      },
    }),
    async (c) => {
      const db = getDb(c.env)
      const repo = new BranchRepository(db)
      const useCase = new UpdateBranch(repo)
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      const data = await useCase.execute({ id, ...body })
      if (!data) throw new ApiError('Sucursal no encontrada', 404)
      return c.json(new ApiResponse({ data, message: 'Sucursal actualizada', status: 200 }), 200)
    }
  )

  // DELETE /api/v1/branches/:id
  app.openapi(
    createRoute({
      method: 'delete',
      path: '/api/v1/branches/{id}',
      tags: ['Branches'],
      summary: 'Eliminar sucursal (soft delete)',
      middleware: [authMiddleware] as const,
      request: { params: branchParamsSchema },
      responses: {
        200: { description: 'Sucursal eliminada' },
        404: { description: 'No encontrada' },
      },
    }),
    async (c) => {
      const db = getDb(c.env)
      const repo = new BranchRepository(db)
      const useCase = new DeleteBranch(repo)
      const { id } = c.req.valid('param')
      await useCase.execute(id)
      return c.json(new ApiResponse({ data: null, message: 'Sucursal eliminada', status: 200 }), 200)
    }
  )
}
```

---

## 8. Shared — piezas clave

### 8.1 ApiResponse y ApiError

```typescript
// shared/http/api-response.ts
export class ApiResponse<T = unknown> {
  data: T
  message: string
  status: number

  constructor({ data, message, status }: { data: T; message: string; status: number }) {
    this.data = data
    this.message = message
    this.status = status
  }
}

export class ApiError extends Error {
  status: number
  data?: unknown

  constructor(message: string, status: number, data?: unknown) {
    super(message)
    this.status = status
    this.data = data
  }
}
```

### 8.2 Middlewares

```typescript
// shared/http/middlewares.ts
import { cors } from 'hono/cors'
import type { AppType } from '../types/app'

export function setupMiddleware(app: AppType) {
  app.use('*', cors({
    origin: ['http://localhost:5173', 'https://tu-frontend.pages.dev'],
    credentials: true,
  }))

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json({ message: err.message, ...(err.data ? { data: err.data } : {}) }, err.status as any)
    }
    console.error(err)
    return c.json({ message: 'Internal server error' }, 500)
  })

  app.notFound((c) => {
    return c.json({ message: `Ruta no encontrada: ${c.req.path}` }, 404)
  })
}
```

### 8.3 OpenAPI / Docs

```typescript
// shared/http/openapi.ts
import { Scalar } from '@scalar/hono-api-reference'
import type { AppType } from '../types/app'

export function setupOpenAPI(app: AppType) {
  app.doc('/doc', {
    openapi: '3.0.0',
    info: { version: '1.0.0', title: 'TFG Backend API' },
  })

  app.get('/docs', Scalar({ url: '/doc' }))
}
```

### 8.4 Auth

```typescript
// shared/auth/index.ts
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { createMiddleware } from 'hono/factory'
import { getDb } from '../db'
import type { AppType, Variables } from '../types/app'
import { ApiError } from '../http/api-response'

// Better Auth se inicializa con la DB lazy
export function getAuth(env: Env) {
  const db = getDb(env)
  return betterAuth({
    database: drizzleAdapter(db, { provider: 'pg' }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    emailAndPassword: { enabled: true },
    // additionalFields para los campos extendidos de user
    user: {
      additionalFields: {
        organizationId: { type: 'string', required: false },
        branchId: { type: 'string', required: false },
        roleId: { type: 'number', required: false },
        isActive: { type: 'boolean', required: false, defaultValue: true },
      },
    },
  })
}

export function setupAuth(app: AppType) {
  app.on(['POST', 'GET'], '/api/auth/**', (c) => {
    const auth = getAuth(c.env)
    return auth.handler(c.req.raw)
  })
}

// Middleware de autenticación para rutas protegidas
export const authMiddleware = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    const auth = getAuth(c.env)
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    if (!session?.user) throw new ApiError('No autenticado', 401)
    c.set('user', {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      organizationId: (session.user as any).organizationId,
      branchId: (session.user as any).branchId,
      roleId: (session.user as any).roleId,
      isActive: (session.user as any).isActive ?? true,
    })
    await next()
  }
)
```

---

## 9. Entry point

```typescript
// src/index.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import type { Env } from './shared/env'
import type { Variables } from './shared/types/app'
import { setupMiddleware } from './shared/http/middlewares'
import { setupAuth } from './shared/auth'
import { setupOpenAPI } from './shared/http/openapi'

// Módulos
import { registerBranchRoutes } from './modules/branches/infra/http/branches.router'
import { registerItemRoutes } from './modules/items/infra/http/items.router'
import { registerItemCategoryRoutes } from './modules/item-categories/infra/http/item-categories.router'
import { registerSaleRoutes } from './modules/sales/infra/http/sales.router'
import { registerCustomerRoutes } from './modules/customers/infra/http/customers.router'
import { registerProviderRoutes } from './modules/providers/infra/http/providers.router'
import { registerProviderOrderRoutes } from './modules/provider-orders/infra/http/provider-orders.router'
import { registerWarehouseRoutes } from './modules/warehouses/infra/http/warehouses.router'
import { registerStockMovementRoutes } from './modules/stock-movements/infra/http/stock-movements.router'
import { registerUserRoutes } from './modules/users/infra/http/users.router'
import { registerUnitRoutes } from './modules/units/infra/http/units.router'
import { registerRecommendationRoutes } from './modules/recommendations/infra/http/recommendations.router'
import { registerExternalDataRoutes } from './modules/external-data/infra/http/external-data.router'

// App top-level: se ejecuta UNA vez por isolate
const app = new OpenAPIHono<{ Bindings: Env; Variables: Variables }>()

setupMiddleware(app)
setupAuth(app)
setupOpenAPI(app)

// Registro de rutas — agregar aquí cada nuevo módulo
registerBranchRoutes(app)
registerItemRoutes(app)
registerItemCategoryRoutes(app)
registerSaleRoutes(app)
registerCustomerRoutes(app)
registerProviderRoutes(app)
registerProviderOrderRoutes(app)
registerWarehouseRoutes(app)
registerStockMovementRoutes(app)
registerUserRoutes(app)
registerUnitRoutes(app)
registerRecommendationRoutes(app)
registerExternalDataRoutes(app)

// Health check sin auth
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

export default app
```

---

## 10. Configuración Cloudflare

### wrangler.toml

```toml
name = "tfg-backend"
main = "src/index.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[vars]
BETTER_AUTH_URL = "https://tfg-backend.<tu-usuario>.workers.dev"

# NO pongas secrets aquí. Usá: wrangler secret put <NOMBRE>
```

### package.json scripts

```json
{
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "type-check": "tsc --noEmit"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "types": ["@cloudflare/workers-types"]
  }
}
```

### drizzle.config.ts

```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/shared/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

---

Antes de terminar una feature, verificá:

- [ ] `npm run type-check` pasa sin errores
- [ ] Toda ruta nueva está registrada en `src/index.ts`
- [ ] Toda ruta protegida tiene `middleware: [authMiddleware] as const`
- [ ] Toda operación de escritura usa los tipos `$inferInsert` de Drizzle
- [ ] Soft delete: nunca `DELETE` físico en tablas con `deletedAt`
- [ ] Todos los `findAll` filtran `isNull(tabla.deletedAt)` cuando corresponde
- [ ] Paginación: todas las listas tienen `page` y `limit` en query params
- [ ] Respuestas usan `ApiResponse` y errores usan `ApiError`
- [ ] NUNCA `process.env` — siempre `c.env`
- [ ] NUNCA registrar rutas fuera de top-level

---

## 13. Lo que NO está en este proyecto (fuera de scope)

- WebSockets — no soportado en Workers (usar Durable Objects si se necesita)
