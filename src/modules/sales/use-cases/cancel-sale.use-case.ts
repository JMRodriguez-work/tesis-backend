import { and, eq } from "drizzle-orm";
import { ApiError } from "../../../shared/http/api-response";
import type { DB } from "../../../shared/db";
import * as schema from "../../../shared/db/schema";
import {
  findSaleById,
  findSaleByIdRaw,
  findSaleItemsRawBySaleId,
  softDeleteSale,
  upsertIncrementStock,
} from "../infra/repository/sale.repository";
import { onStockIncreased } from "../../recommendations/triggers/on-stock-increased";

export type CancelSaleInput = {
  saleId: string;
  reason: string;
  userId: string;
  userOrganizationId: string | null;
  userBranchId: string | null;
  userRoleId: number | null;
  isAdmin: boolean;
};

export class CancelSale {
  constructor(private readonly db: DB) {}

  async execute(input: CancelSaleInput) {
    if (!input.userOrganizationId) throw new ApiError("No autorizado", 403);
    if (!input.reason || input.reason.trim().length < 3) {
      throw new ApiError(
        "El motivo de cancelación es obligatorio (mínimo 3 caracteres)",
        400,
      );
    }
    const reason = input.reason.trim();

    const sale = await findSaleByIdRaw(this.db, input.saleId);
    if (!sale) throw new ApiError("Venta no encontrada", 404);

    const branch = await this.db
      .select({ organizationId: schema.branches.organizationId })
      .from(schema.branches)
      .where(eq(schema.branches.id, sale.branchId))
      .limit(1);
    if (!branch[0] || branch[0].organizationId !== input.userOrganizationId) {
      throw new ApiError("Venta no encontrada", 404);
    }
    if (!input.isAdmin) {
      if (input.userBranchId === null || sale.branchId !== input.userBranchId) {
        throw new ApiError("Venta no encontrada", 404);
      }
    }

    if (!sale.isActive || sale.deletedAt !== null) {
      const enriched = await findSaleById(this.db, input.saleId);
      if (!enriched) throw new ApiError("Venta no encontrada", 404);
      return { sale: enriched, alreadyCancelled: true as const };
    }

    const items = await findSaleItemsRawBySaleId(this.db, input.saleId);

    const outMovements = await this.db
      .select({
        itemId: schema.stockMovements.itemId,
        warehouseId: schema.stockMovements.fromWarehouseId,
        quantity: schema.stockMovements.quantity,
      })
      .from(schema.stockMovements)
      .where(eq(schema.stockMovements.referenceId, input.saleId));
    const outByKey = new Map<string, string>();
    for (const m of outMovements) {
      if (m.warehouseId) {
        outByKey.set(`${m.itemId}|${m.quantity}`, m.warehouseId);
      }
    }

    await this.db.transaction(async (tx) => {
      const cancelled = await softDeleteSale(
        tx as unknown as DB,
        input.saleId,
        reason,
      );
      if (!cancelled) throw new ApiError("No se pudo cancelar la venta", 500);

      for (const it of items) {
        const warehouseId = outByKey.get(`${it.itemId}|${it.quantity}`);
        if (!warehouseId) {
          throw new ApiError(
            `No se encontró el depósito original del item ${it.itemId}; no se puede restaurar el stock`,
            500,
          );
        }
        const upserted = await upsertIncrementStock(
          tx as unknown as DB,
          it.itemId,
          warehouseId,
          it.quantity,
        );
        await tx.insert(schema.stockMovements).values({
          branchId: sale.branchId,
          itemId: it.itemId,
          fromWarehouseId: null,
          toWarehouseId: warehouseId,
          createdBy: input.userId,
          type: "in",
          quantity: it.quantity,
          referenceId: sale.id,
          referenceType: "sale_cancellation",
        });
        const stockRow = await tx
          .select({ minStock: schema.warehouseItemStocks.minStock })
          .from(schema.warehouseItemStocks)
          .where(
            and(
              eq(schema.warehouseItemStocks.itemId, it.itemId),
              eq(schema.warehouseItemStocks.warehouseId, warehouseId),
            ),
          )
          .limit(1);
        const minStock = stockRow[0]?.minStock ?? "0";
        await onStockIncreased(tx as unknown as DB, {
          branchId: sale.branchId,
          itemId: it.itemId,
          newQuantity: upserted.quantity,
          minStock,
        });
      }
    });

    const enriched = await findSaleById(this.db, input.saleId);
    if (!enriched) throw new ApiError("Venta no encontrada", 404);
    return { sale: enriched, alreadyCancelled: false as const };
  }
}
