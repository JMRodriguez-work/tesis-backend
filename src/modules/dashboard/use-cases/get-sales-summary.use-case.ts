import { ApiError } from "../../../shared/http/api-response";
import type { DB } from "../../../shared/db";
import {
  findBranchOrg,
  getSalesSummaryForPeriod,
} from "../infra/repository/dashboard.repository";
import {
  resolveDashboardScope,
  type ResolveDashboardScopeInput,
} from "./resolve-dashboard-scope";
import type { SalesSummary } from "../domain/dashboard.entity";

function startOfTodayUtc(): Date {
  const d = new Date();
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function deltaPct(current: number, previous: number): number {
  if (previous === 0) return 0;
  return (current - previous) / previous;
}

export type GetSalesSummaryInput = ResolveDashboardScopeInput & {
  from?: Date;
  to?: Date;
};

export class GetSalesSummary {
  constructor(private readonly db: DB) {}

  async execute(input: GetSalesSummaryInput): Promise<SalesSummary> {
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
    const todayStart = startOfTodayUtc();

    const today = await getSalesSummaryForPeriod(this.db, {
      organizationId: scope.organizationId,
      branchId,
      from: todayStart,
      to: now,
    });

    let thisWeekFrom: Date;
    let thisWeekTo: Date;
    if (input.from && input.to) {
      thisWeekFrom = input.from;
      thisWeekTo = input.to;
    } else {
      thisWeekTo = now;
      thisWeekFrom = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
    }

    const thisWeek = await getSalesSummaryForPeriod(this.db, {
      organizationId: scope.organizationId,
      branchId,
      from: thisWeekFrom,
      to: thisWeekTo,
    });

    const prevFrom = new Date(thisWeekFrom.getTime() - 7 * 24 * 60 * 60 * 1000);
    const prevTo = thisWeekFrom;
    const previousWeek = await getSalesSummaryForPeriod(this.db, {
      organizationId: scope.organizationId,
      branchId,
      from: prevFrom,
      to: prevTo,
    });

    const totalSalesThis = Number(thisWeek.totalSales);
    const totalSalesPrev = Number(previousWeek.totalSales);
    const totalSalesDelta = deltaPct(totalSalesThis, totalSalesPrev);
    const transactionCountDelta = deltaPct(
      thisWeek.transactionCount,
      previousWeek.transactionCount,
    );
    const averageTicketDelta = deltaPct(
      Number(thisWeek.averageTicket),
      Number(previousWeek.averageTicket),
    );

    return {
      today: {
        date: isoDate(todayStart),
        totalSales: today.totalSales,
        transactionCount: today.transactionCount,
        averageTicket: today.averageTicket,
      },
      thisWeek: {
        fromDate: isoDate(thisWeekFrom),
        toDate: isoDate(thisWeekTo),
        totalSales: thisWeek.totalSales,
        transactionCount: thisWeek.transactionCount,
        averageTicket: thisWeek.averageTicket,
      },
      previousWeek: {
        fromDate: isoDate(prevFrom),
        toDate: isoDate(prevTo),
        totalSales: previousWeek.totalSales,
        transactionCount: previousWeek.transactionCount,
        averageTicket: previousWeek.averageTicket,
      },
      comparison: {
        totalSalesDelta: Number(round2(totalSalesDelta)),
        transactionCountDelta: Number(round2(transactionCountDelta)),
        averageTicketDelta: Number(round2(averageTicketDelta)),
      },
    };
  }
}
