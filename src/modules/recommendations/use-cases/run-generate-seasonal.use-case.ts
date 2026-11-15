import { and, eq, isNull, type SQL } from "drizzle-orm";
import { ApiError } from "../../../shared/http/api-response";
import type { DB } from "../../../shared/db";
import * as schema from "../../../shared/db/schema";
import { findLatestActiveByType } from "../../external-data/infra/repository/external-data.repository";
import { findActiveSeasonalByItemBranch } from "../infra/repository/recommendation.repository";

export type GenerateSeasonalInput = {
  organizationId: string | null;
  branchId: string | null;
};

export type GenerateSeasonalResult = {
  scanned: number;
  created: number;
  skipped: number;
  reason?: string;
};

const MONTH_NAMES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

type SeasonalityPayload = {
  peaks: Array<{ month: number; category: string; intensity: number }>;
};

type ItemWithCategory = {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
};

type BranchRow = { id: string; organizationId: string };
type Peak = { month: number; category: string; intensity: number };

function parseSeasonalityPayload(data: unknown): SeasonalityPayload | null {
  if (typeof data !== "object" || data === null) return null;
  const obj = data as { type?: string; payload?: unknown };
  if (!obj.payload || typeof obj.payload !== "object") return null;
  const payload = obj.payload as { peaks?: unknown };
  if (!Array.isArray(payload.peaks)) return null;
  const peaks: Peak[] = [];
  for (const p of payload.peaks) {
    if (typeof p !== "object" || p === null) continue;
    const peak = p as { month?: unknown; category?: unknown; intensity?: unknown };
    if (
      typeof peak.month === "number" &&
      typeof peak.category === "string" &&
      typeof peak.intensity === "number"
    ) {
      peaks.push({
        month: peak.month,
        category: peak.category,
        intensity: peak.intensity,
      });
    }
  }
  return { peaks };
}

function matchPeak(item: ItemWithCategory, monthPeaks: Peak[]): Peak | null {
  const categoryLower = (item.categoryName ?? "").toLowerCase();
  const itemNameLower = item.name.toLowerCase();
  for (const peak of monthPeaks) {
    const peakLower = peak.category.toLowerCase();
    if (
      (categoryLower && categoryLower.includes(peakLower)) ||
      (itemNameLower && itemNameLower.includes(peakLower))
    ) {
      return peak;
    }
  }
  return null;
}

export class GenerateSeasonalRecommendations {
  constructor(private readonly db: DB) {}

  /**
   * Genera recomendaciones estacionales mirando el calendario con
   * anticipación: compara los picos del mes en curso y del mes próximo con
   * las categorías de los productos activos. La anticipación es el objetivo
   * de la estacionalidad — asegurar stock ANTES del pico, no cuando el pico
   * ya empezó. Idempotente: 1 recomendación estacional pendiente por
   * (sucursal, producto) dentro del mes calendario.
   */
  async execute(input: GenerateSeasonalInput): Promise<GenerateSeasonalResult> {
    const source = await findLatestActiveByType(this.db, "seasonality");
    if (!source?.data) {
      return { scanned: 0, created: 0, skipped: 0, reason: "no seasonality data" };
    }

    const payload = parseSeasonalityPayload(source.data);
    if (!payload || payload.peaks.length === 0) {
      return { scanned: 0, created: 0, skipped: 0, reason: "empty peaks" };
    }

    const now = new Date();
    const currentMonth = now.getUTCMonth() + 1;
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const currentPeaks = payload.peaks.filter((p) => p.month === currentMonth);
    const nextPeaks = payload.peaks.filter((p) => p.month === nextMonth);
    if (currentPeaks.length === 0 && nextPeaks.length === 0) {
      return {
        scanned: 0,
        created: 0,
        skipped: 0,
        reason: "no peaks this or next month",
      };
    }

    const branches = await this.loadBranches(input.organizationId, input.branchId);
    if (branches.length === 0) {
      return { scanned: 0, created: 0, skipped: 0, reason: "no branches" };
    }

    const currentMonthName =
      MONTH_NAMES_ES[currentMonth - 1] ?? "el mes actual";
    const nextMonthName = MONTH_NAMES_ES[nextMonth - 1] ?? "el mes próximo";

    let scanned = 0;
    let created = 0;
    let skipped = 0;

    for (const branch of branches) {
      const items = await this.loadActiveItemsWithCategory(
        branch.organizationId,
        branch.id,
      );
      for (const item of items) {
        const inCurrent = matchPeak(item, currentPeaks);
        const inNext = inCurrent ? null : matchPeak(item, nextPeaks);
        const matched = inCurrent ?? inNext;
        if (!matched) continue;
        scanned++;

        const existing = await findActiveSeasonalByItemBranch(
          this.db,
          branch.id,
          item.id,
        );
        if (existing) {
          skipped++;
          continue;
        }

        const priority =
          matched.intensity > 0.7
            ? "high"
            : matched.intensity > 0.4
              ? "medium"
              : "low";
        const description = inCurrent
          ? `Pico estacional de "${matched.category}" este mes (${currentMonthName}, intensidad ${(matched.intensity * 100).toFixed(0)}%). Asegurá stock de "${item.name}" y considerá destacar el producto.`
          : `Pico estacional de "${matched.category}" esperado en ${nextMonthName} (intensidad ${(matched.intensity * 100).toFixed(0)}%). El pico llega el mes próximo: asegurá stock de "${item.name}" con tiempo.`;

        await this.db.insert(schema.recommendations).values({
          branchId: branch.id,
          itemId: item.id,
          customerId: null,
          type: "seasonal",
          description,
          priority,
          status: "pending",
        });
        created++;
      }
    }

    return { scanned, created, skipped };
  }

  private async loadBranches(
    organizationId: string | null,
    branchId: string | null,
  ): Promise<BranchRow[]> {
    const conditions: SQL[] = [isNull(schema.branches.deletedAt)];
    if (organizationId) {
      conditions.push(eq(schema.branches.organizationId, organizationId));
    }
    if (branchId) {
      conditions.push(eq(schema.branches.id, branchId));
    }
    return this.db
      .select({
        id: schema.branches.id,
        organizationId: schema.branches.organizationId,
      })
      .from(schema.branches)
      .where(and(...conditions));
  }

  private async loadActiveItemsWithCategory(
    organizationId: string,
    branchId: string,
  ): Promise<ItemWithCategory[]> {
    return this.db
      .select({
        id: schema.items.id,
        name: schema.items.name,
        categoryId: schema.items.categoryId,
        categoryName: schema.itemCategories.name,
      })
      .from(schema.items)
      .innerJoin(schema.branches, eq(schema.branches.id, schema.items.branchId))
      .leftJoin(
        schema.itemCategories,
        eq(schema.itemCategories.id, schema.items.categoryId),
      )
      .where(
        and(
          eq(schema.branches.organizationId, organizationId),
          eq(schema.items.branchId, branchId),
          eq(schema.items.isActive, true),
          isNull(schema.items.deletedAt),
        ),
      );
  }
}

