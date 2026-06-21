import type { RecommendationPriority } from '../domain/recommendation.entity'

/**
 * Decide the priority of a `restock` recommendation based on how far below
 * the minStock the current quantity is.
 *
 * ratio = (minStock - quantity) / minStock  ∈ [0, 1]
 *   ratio > 0.75  → high    (we're 75%+ below the minimum)
 *   ratio > 0.25  → medium  (we're 25%+ below the minimum)
 *   else          → low
 *
 * If minStock is 0 or quantity is exactly at minStock, returns 'low'.
 */
export function computeRestockPriority(
  quantity: string,
  minStock: string,
): RecommendationPriority {
  const q = Number(quantity)
  const m = Number(minStock)
  if (m <= 0) return 'low'
  if (q >= m) return 'low'
  const ratio = (m - q) / m
  if (ratio > 0.75) return 'high'
  if (ratio > 0.25) return 'medium'
  return 'low'
}

/**
 * Variant of `computeRestockPriority` that bumps the priority to `high`
 * when the latest IPC value exceeds the inflation threshold. The threshold
 * is a percentage expressed as a number (e.g. 5 means 5% MoM).
 *
 * If `ipcValue` is null, falls back to the base ratio-based priority.
 */
export const IPC_HIGH_PRIORITY_THRESHOLD = 5

export function computeRestockPriorityWithIpc(
  quantity: string,
  minStock: string,
  ipcValue: number | null,
): RecommendationPriority {
  const base = computeRestockPriority(quantity, minStock)
  if (
    ipcValue !== null &&
    ipcValue > IPC_HIGH_PRIORITY_THRESHOLD &&
    base !== 'high'
  ) {
    return 'high'
  }
  return base
}

export type IpcContext = {
  latest: { period: string; value: number }
  source: string
}

export function buildRestockDescription(
  itemName: string,
  quantity: string,
  minStock: string,
  ipcContext: IpcContext | null = null,
): string {
  const base = `Stock bajo nivel crítico: quedan ${quantity} unidades de "${itemName}" (mínimo: ${minStock}).`
  if (!ipcContext) {
    return `${base} Reponer.`
  }
  return `${base} IPC último mes: +${ipcContext.latest.value}% (${ipcContext.latest.period}, fuente: ${ipcContext.source}). Reponer y considerar ajuste de precio.`
}
