import { ApiError } from "../../../shared/http/api-response";
import type { DB } from "../../../shared/db";
import {
  findSalesForExport,
  type ListSalesFilters,
} from "../infra/repository/sale.repository";
import type { ResolveSaleListInput } from "./resolve-sale-branch";
import { resolveSaleListScope } from "./resolve-sale-branch";

export type GetSalesExportInput = ResolveSaleListInput & {
  format: "csv" | "json";
  from?: Date;
  to?: Date;
};

const CSV_HEADERS = [
  "saleId",
  "createdAt",
  "branchName",
  "customerName",
  "itemName",
  "itemCode",
  "quantity",
  "price",
  "lineTotal",
  "discountPercent",
  "saleTotal",
  "status",
  "createdByName",
] as const;

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (
    s.includes('"') ||
    s.includes(",") ||
    s.includes("\n") ||
    s.includes("\r")
  ) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(rows: Awaited<ReturnType<typeof findSalesForExport>>): string {
  const header = CSV_HEADERS.join(",");
  const lines = rows.map((r) =>
    [
      r.saleId,
      r.createdAt,
      r.branchName,
      r.customerName,
      r.itemName,
      r.itemCode,
      r.quantity,
      r.price,
      r.lineTotal,
      r.discountPercent,
      r.saleTotal,
      r.status,
      r.createdByName,
    ]
      .map(csvEscape)
      .join(","),
  );
  return "\uFEFF" + header + "\n" + lines.join("\n");
}

export class GetSalesExport {
  constructor(private readonly db: DB) {}

  async execute(input: GetSalesExportInput) {
    const scope = resolveSaleListScope(input);
    if (!scope.organizationId) throw new ApiError("No autorizado", 403);

    if (input.requestedBranchId && !scope.isAdmin) {
      throw new ApiError("No autorizado", 403);
    }

    const filters: ListSalesFilters = {
      branchId: scope.isAdmin ? scope.branchId : scope.branchId,
      from: input.from,
      to: input.to,
      includeCancelled: true,
    };

    const EXPORT_LIMIT = 10_000;
    const rows = await findSalesForExport(
      this.db,
      scope.organizationId,
      filters,
      EXPORT_LIMIT,
    );

    if (input.format === "json") {
      return {
        contentType: "application/json",
        body: JSON.stringify(rows, null, 2),
        filename: buildFilename(input.from, input.to, "json"),
      };
    }
    return {
      contentType: "text/csv; charset=utf-8",
      body: toCsv(rows),
      filename: buildFilename(input.from, input.to, "csv"),
    };
  }
}

function buildFilename(
  from: Date | undefined,
  to: Date | undefined,
  ext: string,
): string {
  const f = from ? from.toISOString().slice(0, 10) : "all";
  const t = to ? to.toISOString().slice(0, 10) : "all";
  return `sales-${f}-${t}.${ext}`;
}
