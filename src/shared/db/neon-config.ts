import { neonConfig } from '@neondatabase/serverless'

export function configureNeonForLocalProxy(localProxy?: string): void {
  if (!localProxy) return

  const proxy = localProxy.replace(/\/+$/, '')

  neonConfig.wsProxy = () => `${proxy}/v1`
  neonConfig.useSecureWebSocket = false
  neonConfig.pipelineTLS = false
  neonConfig.pipelineConnect = false
}
