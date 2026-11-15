import type { RecommendationPriority } from '../domain/recommendation.entity'
import {
  formatPeriodEs,
  formatQuantityWithUnit,
  type UnitType,
} from '../../../shared/format'

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
 * when the latest month-over-month variation of the INDEC wholesale price
 * index (IPIM) exceeds the threshold. The threshold is a percentage
 * expressed as a number (e.g. 5 means 5% MoM).
 *
 * Rationale: if what it costs to restock is rising fast, restocking can't
 * wait — the same deficit is more urgent today than tomorrow.
 *
 * If `wholesaleChangeMoM` is null, falls back to the base ratio-based
 * priority.
 */
export const WHOLESALE_PRICE_HIGH_THRESHOLD = 5

export function computeRestockPriorityWithWholesalePrices(
  quantity: string,
  minStock: string,
  wholesaleChangeMoM: number | null,
): RecommendationPriority {
  const base = computeRestockPriority(quantity, minStock)
  if (
    wholesaleChangeMoM !== null &&
    wholesaleChangeMoM > WHOLESALE_PRICE_HIGH_THRESHOLD &&
    base !== 'high'
  ) {
    return 'high'
  }
  return base
}

export type WholesalePriceContext = {
  latest: { period: string; value: number }
  /** Variación porcentual mensual de los precios mayoristas (último vs anterior). Null si no hay datos. */
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
    priceContext?: WholesalePriceContext | null;
  },
): string {
  const priceContext = options.priceContext ?? null;
  const qty = formatQuantityWithUnit(quantity, options.unitType, options.unitName, options.unitAbbreviation);
  const min = formatQuantityWithUnit(minStock, options.unitType, options.unitName, options.unitAbbreviation);
  const base = `Stock bajo nivel crítico: quedan ${qty} de "${itemName}" (mínimo: ${min}).`
  if (!priceContext) {
    return `${base} Reponer.`
  }
  const periodEs = formatPeriodEs(priceContext.latest.period)
  if (priceContext.latestChange !== null) {
    const sign = priceContext.latestChange >= 0 ? '+' : '';
    return `${base} Precios mayoristas: ${sign}${priceContext.latestChange.toFixed(1)}% el último mes (fuente: ${priceContext.source}, ${periodEs}). Reponer y considerar ajustar el precio de venta.`
  }
  return `${base} Precios mayoristas (fuente: ${priceContext.source}, ${periodEs}) sin variación calculable. Reponer.`
}
