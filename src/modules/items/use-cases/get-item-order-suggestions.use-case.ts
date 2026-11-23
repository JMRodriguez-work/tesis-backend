import { eq } from "drizzle-orm";
import type { DB } from "../../../shared/db";
import * as schema from "../../../shared/db/schema";
import { findItemById } from "../infra/repository/item.repository";
import { findLastOrderItemCostByItemId } from "../../provider-orders/infra/repository/provider-order.repository";
import { sumItemUnitsSoldSince } from "../../sales/infra/repository/sale.repository";
import { findLatestActiveByType } from "../../external-data/infra/repository/external-data.repository";
import {
  ADMIN_ROLE_ID,
  type ResolveItemBranchInput,
} from "./resolve-item-branch";

export type GetItemOrderSuggestionsInput = ResolveItemBranchInput & {
  id: string;
};

export type ItemCostSuggestion = {
  lastCost: number;
  /** Fecha de la orden de la que sale el último costo. Null si viene de la ficha del producto. */
  lastCostAt: string | null;
  lastCostSource: "provider_order" | "item";
  ipimSourceName: string | null;
  /** Variación % del índice mayorista aplicada (acumulada desde la última compra, o del último mes). Null si no hay datos. */
  ipimVariationPct: number | null;
  ipimVariationFromPeriod: string | null;
  ipimVariationToPeriod: string | null;
  suggestedCost: number;
};

export type ItemOrderSuggestions = {
  itemId: string;
  /** Tipo de unidad normalizado: sin unidad → "count". Define el redondeo de la demanda sugerida. */
  unitType: "count" | "weight" | "volume";
  quantitySuggestion: {
    /** Demanda semanal ya redondeada según la unidad (count → entero por exceso; weight/volume → 2 decimales). */
    weeklyDemandUnits: number;
    windowDays: number;
  };
  costSuggestion: ItemCostSuggestion | null;
};

/** Ventana de ventas para estimar la demanda semanal (4 semanas de historial). */
export const WEEKLY_DEMAND_WINDOW_DAYS = 28;

/**
 * Contexto para armar una orden de reposición de un producto:
 *
 * - **Cantidad sugerida**: además del déficit (minStock - stock), la demanda
 *   semanal promedio de los últimos 28 días. Reponer solo el déficit deja el
 *   stock pegado al mínimo — la próxima venta vuelve a disparar la alerta.
 *   El mínimo es el piso, no el objetivo.
 * - **Costo sugerido**: último costo cargado en una orden a proveedor (o, si
 *   no hay, el precio de compra de la ficha), ajustado por la variación
 *   acumulada del índice mayorista del INDEC (IPIM) desde el mes de esa
 *   compra. Si el producto nunca se compró, se usa la variación del último
 *   mes sobre el precio de la ficha.
 *
 * Si el INDEC no tiene datos, la sugerencia sale igual sin ajuste (falla en
 * silencio, mismo criterio que el resto de las integraciones externas).
 */
export class GetItemOrderSuggestions {
  constructor(private readonly db: DB) {}

  async execute(
    input: GetItemOrderSuggestionsInput,
  ): Promise<ItemOrderSuggestions | null> {
    const item = await findItemById(this.db, input.id);
    if (!item || !input.userOrganizationId) return null;

    const isAdmin = input.userRoleId === ADMIN_ROLE_ID;
    if (isAdmin) {
      const [branch] = await this.db
        .select({ organizationId: schema.branches.organizationId })
        .from(schema.branches)
        .where(eq(schema.branches.id, item.branchId))
        .limit(1);
      if (!branch || branch.organizationId !== input.userOrganizationId) {
        return null;
      }
    } else {
      if (input.userBranchId === null || item.branchId !== input.userBranchId) {
        return null;
      }
    }

    const since = new Date(
      Date.now() - WEEKLY_DEMAND_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );
    const unitsSold = await sumItemUnitsSoldSince(this.db, item.id, since);
    const weeks = WEEKLY_DEMAND_WINDOW_DAYS / 7;
    const rawWeekly = unitsSold / weeks;

    // Convención: un producto sin unidad se trata como contable. La demanda
    // sugerida se redondea según la unidad acá (backend), no en la UI — es
    // semántica del dominio, no presentación: "comprar 10,25 unidades" no
    // existe; "comprar 10,25 kg" sí.
    const rawUnitType = item.baseUnit?.unitType ?? null;
    const unitType =
      rawUnitType === "weight" || rawUnitType === "volume"
        ? rawUnitType
        : "count";
    const weeklyDemandUnits =
      unitType === "count" ? Math.ceil(rawWeekly) : Math.round(rawWeekly * 100) / 100;

    const costSuggestion = await this.buildCostSuggestion(
      item.id,
      item.purchasePrice,
    );

    return {
      itemId: item.id,
      unitType,
      quantitySuggestion: {
        weeklyDemandUnits,
        windowDays: WEEKLY_DEMAND_WINDOW_DAYS,
      },
      costSuggestion,
    };
  }

  private async buildCostSuggestion(
    itemId: string,
    purchasePrice: string | null,
  ): Promise<ItemCostSuggestion | null> {
    const lastOrderCost = await findLastOrderItemCostByItemId(this.db, itemId);

    let lastCost: number | null = null;
    let lastCostAt: string | null = null;
    let lastCostSource: ItemCostSuggestion["lastCostSource"] | null = null;
    if (lastOrderCost) {
      lastCost = Number(lastOrderCost.cost);
      lastCostAt = lastOrderCost.orderCreatedAt.toISOString();
      lastCostSource = "provider_order";
    } else if (purchasePrice !== null) {
      lastCost = Number(purchasePrice);
      lastCostSource = "item";
    }
    if (lastCost === null || lastCostSource === null) return null;

    const ipim = await this.loadIpimVariation(lastCostAt);
    const variationPct = ipim?.variationPct ?? 0;
    const suggestedCost = round2(lastCost * (1 + variationPct / 100));

    return {
      lastCost,
      lastCostAt,
      lastCostSource,
      ipimSourceName: ipim?.sourceName ?? null,
      ipimVariationPct: ipim?.variationPct ?? null,
      ipimVariationFromPeriod: ipim?.fromPeriod ?? null,
      ipimVariationToPeriod: ipim?.toPeriod ?? null,
      suggestedCost,
    };
  }

  /**
   * Variación del índice mayorista a aplicar sobre el último costo:
   * - con fecha de última compra: acumulada entre el punto de la serie del
   *   mes de esa compra (o el más viejo disponible) y el último punto.
   * - sin fecha (ficha del producto): la variación del último mes.
   * - sin serie: null (la sugerencia sale sin ajuste).
   */
  private async loadIpimVariation(
    lastCostAtIso: string | null,
  ): Promise<{
    sourceName: string;
    variationPct: number | null;
    fromPeriod: string | null;
    toPeriod: string;
  } | null> {
    try {
      const source = await findLatestActiveByType(this.db, "wholesale_prices");
      if (!source?.data || typeof source.data !== "object") return null;
      const payload = (
        source.data as {
          payload?: {
            source?: string;
            series?: Array<{ period: unknown; value: unknown }>;
          };
        }
      ).payload;
      if (!payload || !Array.isArray(payload.series)) return null;

      const points = payload.series
        .map((p) => ({ period: String(p.period), value: Number(p.value) }))
        .filter((p) => p.period.length >= 7 && Number.isFinite(p.value))
        .sort((a, b) => (a.period < b.period ? -1 : 1));
      if (points.length === 0) return null;
      const latest = points[points.length - 1]!;

      let fromPoint: { period: string; value: number } | null = null;
      if (lastCostAtIso) {
        const purchaseMonth = lastCostAtIso.slice(0, 7);
        for (const p of points) {
          if (p.period.slice(0, 7) <= purchaseMonth) fromPoint = p;
        }
        // Compra más vieja que el inicio de la serie: usamos el primer punto.
        if (!fromPoint) fromPoint = points[0]!;
        // La compra es posterior al último punto publicado (INDEC publica con
        // demora): no hay variación medible desde entonces. Aplicamos la
        // última variación publicada — es una sugerencia, no un cálculo de
        // costos, y el tooltip declara la ventana usada.
        if (fromPoint.period === latest.period && points.length >= 2) {
          fromPoint = points[points.length - 2]!;
        }
      } else {
        fromPoint = points.length >= 2 ? points[points.length - 2]! : null;
      }
      if (!fromPoint || fromPoint.value <= 0) {
        return {
          sourceName: payload.source ?? source.name,
          variationPct: null,
          fromPeriod: null,
          toPeriod: latest.period,
        };
      }

      const variationPct = Math.round((latest.value / fromPoint.value - 1) * 1000) / 10;
      return {
        sourceName: payload.source ?? source.name,
        variationPct,
        fromPeriod: fromPoint.period,
        toPeriod: latest.period,
      };
    } catch (err) {
      console.warn(
        "[order-suggestions] failed to load IPIM variation, continuing without:",
        err,
      );
      return null;
    }
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
