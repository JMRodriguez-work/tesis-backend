import { apiReference } from '@scalar/hono-api-reference'
import type { AppType } from '../types/app'

export function setupOpenAPI(app: AppType) {
  app.doc('/doc', {
    openapi: '3.0.0',
    info: { version: '1.0.0', title: 'TFG Backend API' },
  })

  app.get(
    '/docs',
    apiReference({
      spec: {
        url: '/doc',
      },
    }),
  )
}
