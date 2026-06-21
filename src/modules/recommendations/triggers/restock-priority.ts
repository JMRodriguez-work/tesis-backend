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

export function buildRestockDescription(
  itemName: string,
  quantity: string,
  minStock: string,
): string {
  return `Stock bajo nivel crítico: quedan ${quantity} unidades de "${itemName}" (mínimo: ${minStock}). Reponer.`
}
