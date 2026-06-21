import type { CustomerSegment } from "../domain/customer-analytics.entity";

export const SEGMENT_THRESHOLDS = {
  vipMinSpent: 50000,
  vipMinPurchases: 5,
  frequentMinPurchases: 5,
  occasionalMinPurchases: 2,
  newMaxDays: 30,
  inactiveMinDays: 60,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export function computeSegment(input: {
  purchaseCount: number;
  totalSpent: string;
  lastPurchaseAt: Date | null;
  now: Date;
}): CustomerSegment {
  const { purchaseCount, totalSpent, lastPurchaseAt, now } = input;
  const spent = Number(totalSpent);

  if (purchaseCount === 0 || lastPurchaseAt === null) {
    return "dormant";
  }

  if (
    spent >= SEGMENT_THRESHOLDS.vipMinSpent &&
    purchaseCount >= SEGMENT_THRESHOLDS.vipMinPurchases
  ) {
    return "vip";
  }

  if (purchaseCount >= SEGMENT_THRESHOLDS.frequentMinPurchases) {
    return "frequent";
  }

  if (purchaseCount >= SEGMENT_THRESHOLDS.occasionalMinPurchases) {
    const daysSinceLast = (now.getTime() - lastPurchaseAt.getTime()) / DAY_MS;
    if (daysSinceLast >= SEGMENT_THRESHOLDS.inactiveMinDays) {
      return "inactive";
    }
    return "occasional";
  }

  if (purchaseCount === 1) {
    const daysSinceLast = (now.getTime() - lastPurchaseAt.getTime()) / DAY_MS;
    if (daysSinceLast <= SEGMENT_THRESHOLDS.newMaxDays) {
      return "new";
    }
    return "inactive";
  }

  return "occasional";
}
