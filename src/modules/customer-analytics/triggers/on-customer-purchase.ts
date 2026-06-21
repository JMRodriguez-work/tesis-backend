import type { DB } from "../../../shared/db";
import { markRetentionAsResolvedForCustomer } from "../infra/repository/customer-analytics.repository";

export async function onCustomerPurchase(
  tx: DB,
  input: { organizationId: string; customerId: string },
): Promise<number> {
  return markRetentionAsResolvedForCustomer(
    tx,
    input.organizationId,
    input.customerId,
  );
}
