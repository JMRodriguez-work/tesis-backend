import { eq } from "drizzle-orm";
import { ApiError } from "../../../shared/http/api-response";
import type { DB } from "../../../shared/db";
import * as schema from "../../../shared/db/schema";
import {
  countItemStockHistory,
  type ItemHistoryFilters,
} from "../infra/repository/stock-movement.repository";
import {
  findStockMovementsPaginated,
  type ListStockMovementsFilters,
} from "../infra/repository/stock-movement.repository";
import {
  resolveStockMovementListScope,
  type ResolveStockMovementListInput,
} from "./resolve-stock-movement-access";
import type {
  StockHistoryRow,
  StockMovementListRow,
} from "../domain/stock-movement.entity";

export type GetItemStockHistoryInput = ResolveStockMovementListInput & {
  itemId: string;
  from?: Date;
  to?: Date;
  warehouseId?: string;
  page: number;
  limit: number;
};

/**
 * Returns a signed delta for a movement relative to the total stock of the item
 * (across all warehouses). For a `transfer` we count 0 net (the total stock
 * of the item doesn't change when you move it between warehouses).
 *
 * If `warehouseId` is provided, the delta is relative to that warehouse only.
 */
function signedDelta(
  type: string,
  quantity: string,
  warehouseId: string | undefined,
  fromWarehouseId: string | null,
  toWarehouseId: string | null,
): number {
  const q = Number(quantity);
  if (type === "in") {
    if (warehouseId && toWarehouseId !== warehouseId) return 0;
    return q;
  }
  if (type === "out") {
    if (warehouseId && fromWarehouseId !== warehouseId) return 0;
    return q;
  }
  if (type === "adjustment") {
    if (warehouseId) {
      if (toWarehouseId === warehouseId) return Math.abs(q);
      if (fromWarehouseId === warehouseId) return -Math.abs(q);
      return 0;
    }
    return q;
  }
  if (type === "transfer") {
    if (warehouseId) {
      if (fromWarehouseId === warehouseId) return -q;
      if (toWarehouseId === warehouseId) return q;
      return 0;
    }
    return 0;
  }
  return 0;
}

export class GetItemStockHistory {
  constructor(private readonly db: DB) {}

  async execute(input: GetItemStockHistoryInput) {
    const scope = resolveStockMovementListScope(input);
    if (!scope.organizationId) throw new ApiError("No autorizado", 403);

    const item = await this.db
      .select({
        id: schema.items.id,
        branchId: schema.items.branchId,
        deletedAt: schema.items.deletedAt,
      })
      .from(schema.items)
      .where(eq(schema.items.id, input.itemId))
      .limit(1);

    if (!item[0] || item[0].deletedAt !== null) {
      throw new ApiError("Item no encontrado", 404);
    }

    const branch = await this.db
      .select({ organizationId: schema.branches.organizationId })
      .from(schema.branches)
      .where(eq(schema.branches.id, item[0].branchId))
      .limit(1);
    if (!branch[0] || branch[0].organizationId !== scope.organizationId) {
      throw new ApiError("Item no encontrado", 404);
    }
    if (!scope.isAdmin) {
      if (scope.branchId !== item[0].branchId) {
        throw new ApiError("Item no encontrado", 404);
      }
    }

    // Fetch the page in DESC, then fetch all matching rows in ASC to compute
    // running balance. Cap the ASC fetch at the total to bound memory.
    const filters: ListStockMovementsFilters & ItemHistoryFilters = {
      itemId: input.itemId,
      branchId: scope.branchId,
      warehouseId: input.warehouseId,
      from: input.from,
      to: input.to,
    };
    const total = await countItemStockHistory(
      this.db,
      scope.organizationId,
      filters,
    );

    const offset = (input.page - 1) * input.limit;

    const allAsc = await findStockMovementsPaginated(
      this.db,
      scope.organizationId,
      filters,
      Math.max(total, 1),
      0,
    );
    const asc = [...allAsc].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    let running = 0;
    const balanceById = new Map<string, number>();
    for (const r of asc) {
      running += signedDelta(
        r.type,
        r.quantity,
        input.warehouseId,
        r.fromWarehouseId,
        r.toWarehouseId,
      );
      balanceById.set(r.id, running);
    }

    const pageDesc = await findStockMovementsPaginated(
      this.db,
      scope.organizationId,
      filters,
      input.limit,
      offset,
    );

    const rows: StockHistoryRow[] = pageDesc.map((r) => ({
      ...r,
      runningBalance: (balanceById.get(r.id) ?? 0).toFixed(3),
    }));

    return {
      data: rows,
      meta: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / input.limit),
      },
    };
  }
}
