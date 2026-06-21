import { ApiError } from '../../../shared/http/api-response'
import type { TrendInterval } from '../domain/report.entity'

export const MAX_BUCKETS: Record<TrendInterval, number> = {
  day: 366,
  week: 104,
  month: 60,
}

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS
const MONTH_MS = 30 * DAY_MS

export function approxBucketsInRange(
  from: Date,
  to: Date,
  interval: TrendInterval,
): number {
  const ms = Math.max(0, to.getTime() - from.getTime())
  switch (interval) {
    case 'day':
      return Math.ceil(ms / DAY_MS)
    case 'week':
      return Math.ceil(ms / WEEK_MS)
    case 'month':
      return Math.ceil(ms / MONTH_MS)
  }
}

export function validateBucketRange(
  from: Date,
  to: Date,
  interval: TrendInterval,
): void {
  if (to.getTime() < from.getTime()) {
    throw new ApiError('`to` debe ser mayor o igual a `from`', 400)
  }
  const max = MAX_BUCKETS[interval]
  const approx = approxBucketsInRange(from, to, interval)
  if (approx > max) {
    throw new ApiError(
      `El rango excede el máximo de ${max} buckets para interval=${interval} (aprox ${approx} buckets)`,
      400,
    )
  }
}
