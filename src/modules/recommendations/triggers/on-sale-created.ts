import type { DB } from "../../../shared/db";
import type { UnitType } from "../../../shared/format";
import {
  createRestockRecommendation,
  findActiveRestockByItemBranch,
} from "../infra/repository/recommendation.repository";
import {
  buildRestockDescription,
  computeRestockPriorityWithWholesalePrices,
  type WholesalePriceContext,
} from "./restock-priority";

export type OnSaleCreatedInput = {
  branchId: string;
  itemId: string;
  itemName: string;
  newQuantity: string;
  minStock: string;
  unitType: UnitType | null;
  unitName: string | null;
  unitAbbreviation: string | null;
  priceContext?: WholesalePriceContext | null;
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

  const wholesaleChange = input.priceContext?.latestChange ?? null;
  const priority = computeRestockPriorityWithWholesalePrices(
    input.newQuantity,
    input.minStock,
    wholesaleChange,
  );
  const description = buildRestockDescription(
    input.itemName,
    input.newQuantity,
    input.minStock,
    {
      unitType: input.unitType,
      unitName: input.unitName,
      unitAbbreviation: input.unitAbbreviation,
      priceContext: input.priceContext ?? null,
    },
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
