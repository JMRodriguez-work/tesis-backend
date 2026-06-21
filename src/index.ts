import { OpenAPIHono } from '@hono/zod-openapi'
import { setupMiddleware } from './shared/http/middlewares'
import { dbMiddleware } from './shared/db'
import { mountBetterAuth } from './shared/auth/mount'
import { handleQueueBatch } from './shared/queue'
import type { AnalyticsJobMessage } from './shared/queue'
import { registerAuthRoutes } from './modules/auth/infra/http/auth.router'
import { registerOnboardingRoutes } from './modules/onboarding/infra/http/onboarding.router'
import { registerOrganizationRoutes } from './modules/organizations/infra/http/organizations.router'
import { registerBranchRoutes } from './modules/branches/infra/http/branches.router'
import { registerUserRoutes } from './modules/users/infra/http/users.router'
import { registerUnitRoutes } from './modules/units/infra/http/units.router'
import { registerItemCategoryRoutes } from './modules/item-categories/infra/http/item-categories.router'
import { registerItemRoutes } from './modules/items/infra/http/items.router'
import { registerWarehouseRoutes } from './modules/warehouses/infra/http/warehouses.router'
import { registerCustomerRoutes } from './modules/customers/infra/http/customers.router'
import { registerSaleRoutes } from './modules/sales/infra/http/sales.router'
import { registerProviderOrderRoutes } from './modules/provider-orders/infra/http/provider-orders.router'
import { registerProviderRoutes } from './modules/providers/infra/http/providers.router'
import { registerRecommendationRoutes } from './modules/recommendations/infra/http/recommendations.router'
import { registerStockMovementRoutes } from './modules/stock-movements/infra/http/stock-movements.router'
import { registerDashboardRoutes } from './modules/dashboard/infra/http/dashboard.router'
import { registerReportRoutes } from './modules/reports/infra/http/reports.router'
import { registerCustomerAnalyticsRoutes } from './modules/customer-analytics/infra/http/customer-analytics.router'
import { registerExternalDataRoutes } from './modules/external-data/infra/http/external-data.router'
import { handleScheduledFetchExternalData } from './modules/external-data/triggers/on-cron-fetch-external-data'
import type { Env } from './shared/env'
import type { Variables } from './shared/types/app'

const app = new OpenAPIHono<{ Bindings: Env; Variables: Variables }>()

setupMiddleware(app)
app.use('*', dbMiddleware)

app.get('/health', (c) =>
  c.json({ status: 'ok', timestamp: new Date().toISOString() }),
)

mountBetterAuth(app)

registerAuthRoutes(app)
registerOnboardingRoutes(app)
registerBranchRoutes(app)
registerCustomerRoutes(app)
registerCustomerAnalyticsRoutes(app)
registerDashboardRoutes(app)
registerExternalDataRoutes(app)
registerItemCategoryRoutes(app)
registerItemRoutes(app)
registerOrganizationRoutes(app)
registerProviderOrderRoutes(app)
registerProviderRoutes(app)
registerRecommendationRoutes(app)
registerReportRoutes(app)
registerSaleRoutes(app)
registerStockMovementRoutes(app)
registerUnitRoutes(app)
registerUserRoutes(app)
registerWarehouseRoutes(app)

/**
 * Triple export: the same Worker handles HTTP requests, queue
 * messages, and scheduled (cron) invocations. See AGENTS.md §6.3 for
 * the architecture rationale.
 *
 * - `fetch` delegates to the Hono app.
 * - `queue` is invoked by Cloudflare with a batch of messages from
 *   `ANALYTICS_QUEUE`. The dispatcher in `shared/queue/dispatcher.ts`
 *   routes each message to the right handler.
 * - `scheduled` is invoked by the Cron Trigger configured in
 *   `wrangler.jsonc` (`triggers.crons`). Phase 3.4 uses it to enqueue
 *   `fetch-external-data` jobs for every configured source.
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx)
  },
  async queue(batch: MessageBatch<AnalyticsJobMessage>, env: Env, ctx: ExecutionContext) {
    return handleQueueBatch(batch, env, ctx)
  },
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleScheduledFetchExternalData(env, ctx))
  },
} satisfies ExportedHandler<Env, AnalyticsJobMessage>
