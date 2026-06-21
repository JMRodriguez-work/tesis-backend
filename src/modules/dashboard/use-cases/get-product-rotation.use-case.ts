import { ApiError } from "../../../shared/http/api-response";
import type { DB } from "../../../shared/db";
import {
  countProductRotation,
  findBranchOrg,
  getCatalogItemsNotSold,
  getProductRotation,
  type ProductRotationFilters,
} from "../infra/repository/dashboard.repository";
import {
  resolveDashboardScope,
  type ResolveDashboardScopeInput,
} from "./resolve-dashboard-scope";
import type { ProductRotationRow } from "../domain/dashboard.entity";

export type GetProductRotationInput = ResolveDashboardScopeInput & {
  from?: Date;
  to?: Date;
  categoryId?: string;
  includeZeroSales: boolean;
  page: number;
  limit: number;
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export class GetProductRotation {
  constructor(private readonly db: DB) {}

  async execute(input: GetProductRotationInput) {
    const scope = resolveDashboardScope(input);
    if (!scope.organizationId) throw new ApiError("No autorizado", 403);

    let branchId = scope.branchId;
    if (branchId) {
      const org = await findBranchOrg(this.db, branchId, scope.organizationId);
      if (!org) {
        throw new ApiError("La sucursal no pertenece a tu organización", 400);
      }
    }

    const now = new Date();
    const to = input.to ?? now;
    const from = input.from ?? new Date(to.getTime() - THIRTY_DAYS_MS);

    const filters: ProductRotationFilters = {
      organizationId: scope.organizationId,
      branchId,
      from,
      to,
      categoryId: input.categoryId,
    };

    const offset = (input.page - 1) * input.limit;
    const [soldRows, soldCount] = await Promise.all([
      getProductRotation(this.db, filters, input.limit, offset),
      countProductRotation(this.db, filters),
    ]);

    if (!input.includeZeroSales) {
      return {
        data: soldRows,
        meta: {
          page: input.page,
          limit: input.limit,
          total: soldCount,
          totalPages: soldCount === 0 ? 0 : Math.ceil(soldCount / input.limit),
        },
      };
    }

    const soldIds = soldRows.map((r) => r.itemId);
    const unsold = await getCatalogItemsNotSold(this.db, filters, soldIds);

    const unsoldRows: ProductRotationRow[] = unsold.map((u) => ({
      itemId: u.itemId,
      itemName: u.itemName,
      itemCode: u.itemCode,
      categoryId: u.categoryId,
      categoryName: u.categoryName,
      totalQuantitySold: "0",
      totalRevenue: "0.00",
      transactionCount: 0,
      lastSoldAt: null,
    }));

    let data: ProductRotationRow[];
    let total: number;
    if (input.page === 1) {
      data = [...soldRows, ...unsoldRows];
      total = soldCount + unsold.length;
    } else {
      data = soldRows;
      total = soldCount + unsold.length;
    }

    return {
      data,
      meta: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / input.limit),
      },
    };
  }
}
