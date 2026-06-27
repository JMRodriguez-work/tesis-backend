import type { RecommendationPriority } from '../domain/recommendation.entity'
import { formatQuantityWithUnit, type UnitType } from '../../../shared/format'

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
 * when the latest month-over-month IPC variation exceeds the inflation
 * threshold. The threshold is a percentage expressed as a number
 * (e.g. 5 means 5% MoM).
 *
 * If `ipcChangeMoM` is null, falls back to the base ratio-based priority.
 */
export const IPC_HIGH_PRIORITY_THRESHOLD = 5

export function computeRestockPriorityWithIpc(
  quantity: string,
  minStock: string,
  ipcChangeMoM: number | null,
): RecommendationPriority {
  const base = computeRestockPriority(quantity, minStock)
  if (
    ipcChangeMoM !== null &&
    ipcChangeMoM > IPC_HIGH_PRIORITY_THRESHOLD &&
    base !== 'high'
  ) {
    return 'high'
  }
  return base
}

export type IpcContext = {
  latest: { period: string; value: number }
  /** Variación porcentual mensual del IPC (último vs anterior). Null si no hay datos. */
  latestChange: number | null
  source: string
}

export function buildRestockDescription(
  itemName: string,
  quantity: string,
  minStock: string,
  options: {
    unitType: UnitType | null;
    unitName: string | null;
    unitAbbreviation: string | null;
    ipcContext?: IpcContext | null;
  },
): string {
  const ipcContext = options.ipcContext ?? null;
  const qty = formatQuantityWithUnit(quantity, options.unitType, options.unitName, options.unitAbbreviation);
  const min = formatQuantityWithUnit(minStock, options.unitType, options.unitName, options.unitAbbreviation);
  const base = `Stock bajo nivel crítico: quedan ${qty} de "${itemName}" (mínimo: ${min}).`
  if (!ipcContext) {
    return `${base} Reponer.`
  }
  if (ipcContext.latestChange !== null) {
    const sign = ipcContext.latestChange >= 0 ? '+' : '';
    return `${base} IPC último mes: ${sign}${ipcContext.latestChange.toFixed(1)}% (${ipcContext.latest.period}, fuente: ${ipcContext.source}). Reponer y considerar ajuste de precio.`
  }
  return `${base} IPC (${ipcContext.latest.period}, fuente: ${ipcContext.source}) sin variación calculable. Reponer.`
}
