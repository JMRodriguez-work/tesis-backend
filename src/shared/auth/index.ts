import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import type { MiddlewareHandler } from 'hono'
import { ApiError } from '../http/api-response'
import type { Env } from '../env'
import type { Variables } from '../types/app'

export function getAuth(env: Env, db: Variables['db']) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: 'pg' }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      autoSignIn: true,
    },
    user: {
      additionalFields: {
        organizationId: { type: 'string', required: false },
        branchId: { type: 'string', required: false },
        roleId: { type: 'number', required: false },
        isActive: { type: 'boolean', required: false, defaultValue: true },
        deletedAt: { type: 'date', required: false },
      },
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60, max: 5 },
        '/forget-password': { window: 60, max: 3 },
      },
    },
    advanced: {
      ipAddress: {
        ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'],
      },
    },
  })
}

export type Auth = ReturnType<typeof getAuth>

type AuthEnv = { Bindings: Env; Variables: Variables }

export const authMiddleware: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const auth = getAuth(c.env, c.get('db'))
  const session = await auth.api.getSession({ headers: c.req.raw.headers })

  if (!session?.user) {
    throw new ApiError('No autenticado', 401)
  }

  const u = session.user as typeof session.user & {
    organizationId?: string | null
    branchId?: string | null
    roleId?: number | null
    isActive?: boolean
  }

  c.set('user', {
    id: u.id,
    email: u.email,
    name: u.name,
    organizationId: u.organizationId ?? null,
    branchId: u.branchId ?? null,
    roleId: u.roleId ?? null,
    isActive: u.isActive ?? true,
  })

  await next()
}
