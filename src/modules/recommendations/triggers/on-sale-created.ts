import type { DB } from "../../../shared/db";
import {
  createRestockRecommendation,
  findActiveRestockByItemBranch,
} from "../infra/repository/recommendation.repository";
import {
  buildRestockDescription,
  computeRestockPriority,
} from "./restock-priority";

export type OnSaleCreatedInput = {
  branchId: string;
  itemId: string;
  itemName: string;
  newQuantity: string;
  minStock: string;
};

export async function onSaleCreated(tx: DB, input: OnSaleCreatedInput) {
  if (Number(input.newQuantity) >= Number(input.minStock)) {
    return null;
  }

  const existing = await findActiveRestockByItemBranch(
    tx,
    input.branchId,
    input.itemId,
  );
  if (existing) {
    return null;
  }

  const priority = computeRestockPriority(input.newQuantity, input.minStock);
  const description = buildRestockDescription(
    input.itemName,
    input.newQuantity,
    input.minStock,
  );

  return createRestockRecommendation(tx, {
    branchId: input.branchId,
    itemId: input.itemId,
    type: "restock",
    description,
    priority,
    status: "pending",
  });
}
