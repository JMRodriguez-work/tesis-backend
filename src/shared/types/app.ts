import type { OpenAPIHono } from '@hono/zod-openapi'
import type { Pool } from '@neondatabase/serverless'
import type { Env } from '../env'
import type { DB } from '../db'

export type AuthUser = {
  id: string
  email: string
  name: string
  organizationId: string | null
  branchId: string | null
  roleId: number | null
  isActive: boolean
}

export type Variables = {
  user: AuthUser
  db: DB
  pool: Pool
}

export type AppType = OpenAPIHono<{
  Bindings: Env
  Variables: Variables
}>
