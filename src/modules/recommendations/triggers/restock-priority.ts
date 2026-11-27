import type { RecommendationPriority } from '../domain/recommendation.entity'
import {
  formatPeriodEs,
  formatQuantityWithUnit,
  type UnitType,
} from '../../../shared/format'

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
  if (priceContext.latestChange !== null) {
    const sign = priceContext.latestChange >= 0 ? '+' : '';
    return `${base} Precios mayoristas: ${sign}${priceContext.latestChange.toFixed(1)}% el último mes medido (fuente: ${priceContext.source}). Reponer y considerar ajustar el precio de venta.`
  }
  return `${base} Precios mayoristas (fuente: ${priceContext.source}) sin variación calculable. Reponer.`
}
