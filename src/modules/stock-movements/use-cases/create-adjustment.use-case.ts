import { and, eq } from "drizzle-orm";
import { ApiError } from "../../../shared/http/api-response";
import type { DB } from "../../../shared/db";
import * as schema from "../../../shared/db/schema";
import {
  atomicDecrementStock,
  upsertIncrementStock,
} from "../../sales/infra/repository/sale.repository";
import {
  createStockMovement,
  findBranchByIdRaw,
  findItemByIdRaw,
  findWarehouseBranchAssignment,
  findWarehouseByIdRaw,
} from "../infra/repository/stock-movement.repository";
import { onSaleCreated } from "../../recommendations/triggers/on-sale-created";
import { onStockIncreased } from "../../recommendations/triggers/on-stock-increased";

export type CreateAdjustmentInput = {
  branchId: string;
  warehouseId: string;
  itemId: string;
  direction: "in" | "out";
  quantity: string;
  notes?: string;
  userId: string;
  userOrganizationId: string | null;
};

export class CreateAdjustment {
  constructor(private readonly db: DB) {}

  async execute(input: CreateAdjustmentInput) {
    if (!input.userOrganizationId) throw new ApiError("No autorizado", 403);

    const qty = Number(input.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new ApiError("La cantidad debe ser mayor a 0", 400);
    }

    const branch = await findBranchByIdRaw(this.db, input.branchId);
    if (!branch || branch.organizationId !== input.userOrganizationId) {
      throw new ApiError("La sucursal no pertenece a tu organización", 400);
    }

    const warehouse = await findWarehouseByIdRaw(this.db, input.warehouseId);
    if (
      !warehouse ||
      warehouse.deletedAt !== null ||
      warehouse.organizationId !== input.userOrganizationId
    ) {
      throw new ApiError(
        "El depósito no existe o no pertenece a tu organización",
        400,
      );
    }
    const assigned = await findWarehouseBranchAssignment(
      this.db,
      input.warehouseId,
      input.branchId,
    );
    if (!assigned) {
      throw new ApiError("El depósito no está asignado a la sucursal", 400);
    }

    const item = await findItemByIdRaw(this.db, input.itemId);
    if (!item || item.deletedAt !== null || !item.isActive) {
      throw new ApiError("El item no existe o está inactivo", 400);
    }
    if (item.branchId !== input.branchId) {
      throw new ApiError("El item no pertenece a la sucursal", 400);
    }

    const movement = await this.db.transaction(async (tx) => {
      let resultingQuantity = "0";
      let minStock = "0";
      if (input.direction === "out") {
        const stockRow = await tx
          .select({
            id: schema.warehouseItemStocks.id,
            minStock: schema.warehouseItemStocks.minStock,
          })
          .from(schema.warehouseItemStocks)
          .where(
            and(
              eq(schema.warehouseItemStocks.itemId, input.itemId),
              eq(schema.warehouseItemStocks.warehouseId, input.warehouseId),
            ),
          )
          .limit(1);
        if (!stockRow[0]) {
          throw new ApiError(
            "No hay registro de stock para este item en el depósito",
            400,
          );
        }
        const decremented = await atomicDecrementStock(
          tx as unknown as DB,
          stockRow[0].id,
          input.quantity,
        );
        if (!decremented) {
          throw new ApiError(
            `Stock insuficiente en el depósito (no se puede restar ${input.quantity})`,
            400,
          );
        }
        resultingQuantity = decremented.newQuantity;
        minStock = stockRow[0].minStock;
      } else {
        const upserted = await upsertIncrementStock(
          tx as unknown as DB,
          input.itemId,
          input.warehouseId,
          input.quantity,
        );
        resultingQuantity = upserted.quantity;
        const stockRow = await tx
          .select({ minStock: schema.warehouseItemStocks.minStock })
          .from(schema.warehouseItemStocks)
          .where(
            and(
              eq(schema.warehouseItemStocks.itemId, input.itemId),
              eq(schema.warehouseItemStocks.warehouseId, input.warehouseId),
            ),
          )
          .limit(1);
        minStock = stockRow[0]?.minStock ?? "0";
      }

      if (input.direction === "out") {
        await onSaleCreated(tx as unknown as DB, {
          branchId: input.branchId,
          itemId: input.itemId,
          itemName: item.name,
          newQuantity: resultingQuantity,
          minStock,
        });
      } else {
        await onStockIncreased(tx as unknown as DB, {
          branchId: input.branchId,
          itemId: input.itemId,
          newQuantity: resultingQuantity,
          minStock,
        });
      }

      const signedQty =
        input.direction === "out" ? `-${input.quantity}` : input.quantity;

      const [created] = await tx
        .insert(schema.stockMovements)
        .values({
          branchId: input.branchId,
          itemId: input.itemId,
          fromWarehouseId: input.direction === "out" ? input.warehouseId : null,
          toWarehouseId: input.direction === "in" ? input.warehouseId : null,
          createdBy: input.userId,
          type: "adjustment",
          quantity: signedQty,
          referenceId: null,
          referenceType: "manual",
          notes: input.notes ?? null,
        })
        .returning();
      if (!created) throw new ApiError("No se pudo crear el movimiento", 500);
      return created;
    });

    return movement;
  }
}
