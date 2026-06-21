import { eq } from "drizzle-orm";
import { ApiError } from "../../../shared/http/api-response";
import type { DB } from "../../../shared/db";
import * as schema from "../../../shared/db/schema";
import {
  countSales,
  findSalesPaginated,
  type ListSalesFilters,
} from "../infra/repository/sale.repository";
import {
  resolveSaleListScope,
  type ResolveSaleListInput,
} from "./resolve-sale-branch";

export type GetSalesPaginatedInput = ResolveSaleListInput & {
  filters: Omit<ListSalesFilters, "branchId">;
  page: number;
  limit: number;
};

function startOfTodayUtc(): Date {
  const d = new Date();
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

export class GetSalesPaginated {
  constructor(private readonly db: DB) {}

  async execute(input: GetSalesPaginatedInput) {
    const scope = resolveSaleListScope(input);
    if (!scope.organizationId) throw new ApiError("No autorizado", 403);

    if (input.requestedBranchId && !scope.isAdmin) {
      throw new ApiError("No autorizado", 403);
    }

    let branchId: string | null;
    if (scope.isAdmin) {
      branchId = scope.branchId;
      if (branchId) {
        const branch = await this.db
          .select({ organizationId: schema.branches.organizationId })
          .from(schema.branches)
          .where(eq(schema.branches.id, branchId))
          .limit(1);
        if (!branch[0] || branch[0].organizationId !== scope.organizationId) {
          throw new ApiError("La sucursal no pertenece a tu organización", 400);
        }
      }
    } else {
      branchId = scope.branchId;
    }

    const filters: ListSalesFilters = {
      branchId,
      customerId: input.filters.customerId,
      from: input.filters.from ?? startOfTodayUtc(),
      to: input.filters.to,
      includeCancelled: input.filters.includeCancelled,
    };

    const offset = (input.page - 1) * input.limit;
    const [data, total] = await Promise.all([
      findSalesPaginated(
        this.db,
        scope.organizationId,
        filters,
        input.limit,
        offset,
      ),
      countSales(this.db, scope.organizationId, filters),
    ]);

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
