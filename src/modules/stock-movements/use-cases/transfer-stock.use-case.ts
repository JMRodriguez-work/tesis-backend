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

export type TransferStockInput = {
  branchId: string;
  itemId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: string;
  notes?: string;
  userId: string;
  userOrganizationId: string | null;
};

export class TransferStock {
  constructor(private readonly db: DB) {}

  async execute(input: TransferStockInput) {
    if (!input.userOrganizationId) throw new ApiError("No autorizado", 403);

    if (input.fromWarehouseId === input.toWarehouseId) {
      throw new ApiError(
        "El depósito de origen y destino no pueden ser iguales",
        400,
      );
    }

    const qty = Number(input.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new ApiError("La cantidad debe ser mayor a 0", 400);
    }

    const branch = await findBranchByIdRaw(this.db, input.branchId);
    if (!branch || branch.organizationId !== input.userOrganizationId) {
      throw new ApiError("La sucursal no pertenece a tu organización", 400);
    }

    const fromWh = await findWarehouseByIdRaw(this.db, input.fromWarehouseId);
    if (
      !fromWh ||
      fromWh.deletedAt !== null ||
      fromWh.organizationId !== input.userOrganizationId
    ) {
      throw new ApiError(
        "El depósito de origen no existe o no pertenece a tu organización",
        400,
      );
    }
    const toWh = await findWarehouseByIdRaw(this.db, input.toWarehouseId);
    if (
      !toWh ||
      toWh.deletedAt !== null ||
      toWh.organizationId !== input.userOrganizationId
    ) {
      throw new ApiError(
        "El depósito de destino no existe o no pertenece a tu organización",
        400,
      );
    }

    const fromAssigned = await findWarehouseBranchAssignment(
      this.db,
      input.fromWarehouseId,
      input.branchId,
    );
    if (!fromAssigned) {
      throw new ApiError(
        "El depósito de origen no está asignado a la sucursal",
        400,
      );
    }
    const toAssigned = await findWarehouseBranchAssignment(
      this.db,
      input.toWarehouseId,
      input.branchId,
    );
    if (!toAssigned) {
      throw new ApiError(
        "El depósito de destino no está asignado a la sucursal",
        400,
      );
    }

    const item = await findItemByIdRaw(this.db, input.itemId);
    if (!item || item.deletedAt !== null || !item.isActive) {
      throw new ApiError("El item no existe o está inactivo", 400);
    }
    if (item.branchId !== input.branchId) {
      throw new ApiError("El item no pertenece a la sucursal", 400);
    }

    const movement = await this.db.transaction(async (tx) => {
      const fromStock = await tx
        .select({ id: schema.warehouseItemStocks.id })
        .from(schema.warehouseItemStocks)
        .where(
          and(
            eq(schema.warehouseItemStocks.itemId, input.itemId),
            eq(schema.warehouseItemStocks.warehouseId, input.fromWarehouseId),
          ),
        )
        .limit(1);
      if (!fromStock[0]) {
        throw new ApiError(
          "No hay registro de stock del item en el depósito de origen",
          400,
        );
      }

      const decremented = await atomicDecrementStock(
        tx as unknown as DB,
        fromStock[0].id,
        input.quantity,
      );
      if (!decremented) {
        throw new ApiError(
          `Stock insuficiente en el depósito de origen (no se puede transferir ${input.quantity})`,
          400,
        );
      }

      await upsertIncrementStock(
        tx as unknown as DB,
        input.itemId,
        input.toWarehouseId,
        input.quantity,
      );

      const [created] = await tx
        .insert(schema.stockMovements)
        .values({
          branchId: input.branchId,
          itemId: input.itemId,
          fromWarehouseId: input.fromWarehouseId,
          toWarehouseId: input.toWarehouseId,
          createdBy: input.userId,
          type: "transfer",
          quantity: input.quantity,
          referenceId: null,
          referenceType: "manual",
          notes: input.notes ?? null,
        })
        .returning();
      if (!created)
        throw new ApiError(
          "No se pudo crear el movimiento de transferencia",
          500,
        );
      return created;
    });

    return movement;
  }
}
