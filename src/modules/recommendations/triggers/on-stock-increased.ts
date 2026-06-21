import type { DB } from '../../../shared/db'
import { markRestockRecommendationsAsApplied } from '../infra/repository/recommendation.repository'

export type OnStockIncreasedInput = {
  branchId: string
  itemId: string
  newQuantity: string
  minStock: string
}

/**
 * Called from `CancelSale`, `ReceiveProviderOrder` and `CreateAdjustment(
 * direction='in')` inside their transactions, after the stock increment.
 *
 * If the resulting quantity is at or above the item's minStock, marks all
 * pending `restock` recommendations for the (branch, item) as `applied`.
 *
 * Returns the number of recommendations that were marked applied.
 */
export async function onStockIncreased(tx: DB, input: OnStockIncreasedInput) {
  if (Number(input.newQuantity) < Number(input.minStock)) {
    return 0
  }
  return markRestockRecommendationsAsApplied(tx, input.branchId, input.itemId)
}
