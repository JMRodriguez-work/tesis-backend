import type { DB } from "../../../shared/db";
import {
  createRetentionRecommendation,
  getActiveRetentionCustomers,
  getCustomersWithLastPurchase,
} from "../infra/repository/customer-analytics.repository";
import type { DetectInactiveResult } from "../domain/customer-analytics.entity";

const DAY_MS = 24 * 60 * 60 * 1000;

export type RunDetectInactiveInput = {
  organizationId: string;
  branchId: string | null;
  days: number;
};

export class RunDetectInactive {
  constructor(private readonly db: DB) {}

  async execute(input: RunDetectInactiveInput): Promise<DetectInactiveResult> {
    const allCustomers = await getCustomersWithLastPurchase(
      this.db,
      input.organizationId,
      input.branchId,
    );

    const now = new Date();
    const threshold = now.getTime() - input.days * DAY_MS;
    const inactive = allCustomers.filter(
      (c) => c.lastPurchaseAt && c.lastPurchaseAt.getTime() < threshold,
    );

    const activeRecommendations = await getActiveRetentionCustomers(
      this.db,
      input.organizationId,
      input.branchId,
    );
    const existingSet = new Set(activeRecommendations.map((r) => r.customerId));

    let created = 0;
    let skipped = 0;

    for (const c of inactive) {
      if (existingSet.has(c.customerId)) {
        skipped++;
        continue;
      }
      const lastStr = c.lastPurchaseAt
        ? c.lastPurchaseAt.toISOString().slice(0, 10)
        : "nunca";
      await createRetentionRecommendation(this.db, {
        branchId: c.branchId,
        itemId: null,
        customerId: c.customerId,
        type: "retention",
        description: `Cliente sin compras hace ${input.days} días. Última compra: ${lastStr}. Total acumulado: $${c.totalSpent} (${c.purchaseCount} compras).`,
        priority: "medium",
        status: "pending",
      });
      created++;
    }

    return {
      scanned: allCustomers.length,
      created,
      skipped,
    };
  }
}
