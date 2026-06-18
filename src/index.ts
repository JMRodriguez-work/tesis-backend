import { OpenAPIHono } from '@hono/zod-openapi'
import { setupMiddleware } from './shared/http/middlewares'
import { dbMiddleware } from './shared/db'
import { mountBetterAuth } from './shared/auth/mount'
import { registerAuthRoutes } from './modules/auth/infra/http/auth.router'
import { registerOnboardingRoutes } from './modules/onboarding/infra/http/onboarding.router'
import { registerOrganizationRoutes } from './modules/organizations/infra/http/organizations.router'
import { registerBranchRoutes } from './modules/branches/infra/http/branches.router'
import { registerUserRoutes } from './modules/users/infra/http/users.router'
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
registerOrganizationRoutes(app)
registerUserRoutes(app)

export default app
