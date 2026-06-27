import type { DB } from "../../../shared/db";
import type { UnitType } from "../../../shared/format";
import {
  createRestockRecommendation,
  findActiveRestockByItemBranch,
} from "../infra/repository/recommendation.repository";
import {
  buildRestockDescription,
  computeRestockPriorityWithIpc,
  type IpcContext,
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
  ipcContext?: IpcContext | null;
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

  const ipcChange = input.ipcContext?.latestChange ?? null;
  const priority = computeRestockPriorityWithIpc(
    input.newQuantity,
    input.minStock,
    ipcChange,
  );
  const description = buildRestockDescription(
    input.itemName,
    input.newQuantity,
    input.minStock,
    {
      unitType: input.unitType,
      unitName: input.unitName,
      unitAbbreviation: input.unitAbbreviation,
      ipcContext: input.ipcContext ?? null,
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
