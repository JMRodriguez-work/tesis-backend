import { ApiError } from "../../../shared/http/api-response";
import type { DB } from "../../../shared/db";
import * as schema from "../../../shared/db/schema";
import {
  atomicDecrementStock,
  findBranchByIdRaw,
  findCustomerByIdRaw,
  findItemByIdRaw,
  findSaleById,
  findStockInBranchWarehousesForItem,
  findWarehouseBranchAssignment,
  findWarehouseByIdRaw,
  type WarehouseStockRow,
} from "../infra/repository/sale.repository";
import {
  resolveSaleBranchForWrite,
  type ResolveSaleBranchInput,
} from "./resolve-sale-branch";
import { onSaleCreated } from "../../recommendations/triggers/on-sale-created";

export type CreateSaleItemInput = {
  itemId: string;
  warehouseId?: string;
  quantity: string;
  price: string;
  unitId?: number;
};

export type CreateSaleInput = ResolveSaleBranchInput & {
  customerId?: string;
  discountPercent?: string;
  notes?: string;
  items: CreateSaleItemInput[];
};

type ResolvedItem = {
  itemId: string;
  itemName: string;
  quantity: number;
  price: number;
  lineTotal: number;
  unitId: number | null;
  warehouseId: string;
  stockId: string;
  minStock: string;
};

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

export class CreateSale {
  constructor(private readonly db: DB) {}

  async execute(input: CreateSaleInput) {
    if (!input.userOrganizationId) throw new ApiError("No autorizado", 403);
    if (input.items.length === 0) {
      throw new ApiError("La venta debe tener al menos un item", 400);
    }

    const { branchId } = resolveSaleBranchForWrite(input);

    const branch = await findBranchByIdRaw(this.db, branchId);
    if (!branch || branch.organizationId !== input.userOrganizationId) {
      throw new ApiError("La sucursal no pertenece a tu organización", 400);
    }

    const discountStr = input.discountPercent ?? "0";
    const discountNum = Number(discountStr);
    if (Number.isNaN(discountNum) || discountNum < 0 || discountNum > 100) {
      throw new ApiError("El descuento debe estar entre 0 y 100", 400);
    }

    const resolvedItems: ResolvedItem[] = [];

    for (const raw of input.items) {
      if (Number(raw.quantity) <= 0) {
        throw new ApiError("La cantidad debe ser mayor a 0", 400);
      }
      if (Number(raw.price) < 0) {
        throw new ApiError("El precio no puede ser negativo", 400);
      }

      const item = await findItemByIdRaw(this.db, raw.itemId);
      if (!item || item.deletedAt !== null || !item.isActive) {
        throw new ApiError(
          `El item ${raw.itemId} no existe o está inactivo`,
          400,
        );
      }
      if (item.branchId !== branchId) {
        throw new ApiError(
          `El item "${item.name}" no pertenece a la sucursal de la venta`,
          400,
        );
      }

      let stock: WarehouseStockRow | null = null;
      if (raw.warehouseId) {
        const wh = await findWarehouseByIdRaw(this.db, raw.warehouseId);
        if (
          !wh ||
          wh.deletedAt !== null ||
          wh.organizationId !== input.userOrganizationId
        ) {
          throw new ApiError(
            `El depósito ${raw.warehouseId} no existe o no pertenece a tu organización`,
            400,
          );
        }
        const assigned = await findWarehouseBranchAssignment(
          this.db,
          raw.warehouseId,
          branchId,
        );
        if (!assigned) {
          throw new ApiError(
            `El depósito "${wh.name}" no está asignado a la sucursal de la venta`,
            400,
          );
        }
        const candidates = await findStockInBranchWarehousesForItem(
          this.db,
          raw.itemId,
          branchId,
        );
        stock =
          candidates.find((c) => c.warehouseId === raw.warehouseId) ?? null;
        if (!stock) {
          throw new ApiError(
            `No hay registro de stock para "${item.name}" en el depósito "${wh.name}"`,
            400,
          );
        }
      } else {
        const candidates = await findStockInBranchWarehousesForItem(
          this.db,
          raw.itemId,
          branchId,
        );
        if (candidates.length === 0) {
          throw new ApiError(
            `No hay depósitos con stock registrado para "${item.name}" en esta sucursal`,
            400,
          );
        }
        const requested = Number(raw.quantity);
        stock =
          candidates.find((c) => Number(c.quantity) >= requested) ??
          candidates[0]!;
      }

      const requested = Number(raw.quantity);
      if (Number(stock.quantity) < requested) {
        throw new ApiError(
          `Stock insuficiente para "${item.name}" en el depósito elegido`,
          400,
        );
      }

      resolvedItems.push({
        itemId: item.id,
        itemName: item.name,
        quantity: requested,
        price: Number(raw.price),
        lineTotal: requested * Number(raw.price),
        unitId: raw.unitId ?? null,
        warehouseId: stock.warehouseId,
        stockId: stock.stockId,
        minStock: stock.minStock,
      });
    }

    if (input.customerId) {
      const customer = await findCustomerByIdRaw(this.db, input.customerId);
      if (!customer || customer.organizationId !== input.userOrganizationId) {
        throw new ApiError(
          "El cliente no existe o no pertenece a tu organización",
          400,
        );
      }
      if (customer.branchId !== branchId) {
        throw new ApiError(
          "El cliente no pertenece a la sucursal de la venta",
          400,
        );
      }
      if (!customer.isActive) {
        throw new ApiError("El cliente está inactivo", 400);
      }
    }

    const subtotal = resolvedItems.reduce((acc, it) => acc + it.lineTotal, 0);
    const total = subtotal * (1 - discountNum / 100);
    const totalStr = round2(total);
    const discountStrNorm = round2(discountNum);

    const sale = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(schema.sales)
        .values({
          branchId,
          customerId: input.customerId ?? null,
          createdBy: input.userId!,
          total: totalStr,
          discountPercent: discountStrNorm,
          notes: input.notes ?? null,
          isActive: true,
        })
        .returning();

      if (!created) throw new ApiError("No se pudo crear la venta", 500);

      const itemsToInsert = resolvedItems.map((it) => ({
        saleId: created.id,
        itemId: it.itemId,
        unitId: it.unitId,
        quantity: it.quantity.toString(),
        price: it.price.toString(),
      }));
      await tx.insert(schema.saleItems).values(itemsToInsert);

      for (const it of resolvedItems) {
        const decremented = await atomicDecrementStock(
          tx as unknown as DB,
          it.stockId,
          it.quantity.toString(),
        );
        if (!decremented) {
          throw new ApiError(
            `Stock insuficiente para "${it.itemName}" (cambió durante la operación)`,
            400,
          );
        }
        await tx.insert(schema.stockMovements).values({
          branchId,
          itemId: it.itemId,
          fromWarehouseId: it.warehouseId,
          toWarehouseId: null,
          createdBy: input.userId!,
          type: "out",
          quantity: it.quantity.toString(),
          referenceId: created.id,
          referenceType: "sale",
        });
        await onSaleCreated(tx as unknown as DB, {
          branchId,
          itemId: it.itemId,
          itemName: it.itemName,
          newQuantity: decremented.newQuantity,
          minStock: it.minStock,
        });
      }

      return created;
    });

    const enriched = await findSaleById(this.db, sale.id);
    if (!enriched)
      throw new ApiError("No se pudo recuperar la venta creada", 500);
    return enriched;
  }
}
