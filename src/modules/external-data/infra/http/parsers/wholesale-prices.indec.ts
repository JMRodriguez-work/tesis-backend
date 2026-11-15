import { z } from "zod";
import type { MergedExternalData } from "../../../domain/external-data.entity";

/**
 * Parser for the INDEC wholesale price index (IPIM) monthly series.
 *
 * Source: https://datos.gob.ar (series API)
 * Series id 449.1_NIVEL_GENERAL_0_0_13_97 = "Índice de Precios Internos
 * Básicos al por Mayor", nivel general, base dic-2015=100, frecuencia
 * mensual. Es la referencia de precios a la que compran los comercios
 * relevados (declarada en el documento, §Variables externas seleccionadas).
 *
 * Nota histórica: la serie anterior (103.1_I2N_2016_M_19, IPC GBA) fue
 * descontinuada por INDEC (último dato: 2020-07) y devolvía un payload
 * vacío, por lo que el fetch terminaba en parse error. El cambio de serie
 * se aplica en la migración 0012.
 *
 * El campo `value` viene como número (nivel del índice), NO como
 * porcentaje de variación. La variación mensual se calcula acá.
 *
 * Example response shape (abridged):
 * {
 *   "data": [
 *     ["2026-08-01", 16287.17],
 *     ["2026-09-01", 16655.83],
 *     ...
 *   ],
 *   "count": 24,
 *   "meta": [{ "frequency": "month", ... }]
 * }
 */
const indecSeriesRowSchema = z.tuple([
  z.string(),
  z.union([z.string(), z.number()]),
]);

const indecWholesaleResponseSchema = z.object({
  data: z.array(indecSeriesRowSchema),
});

export type IndecWholesaleParsed = {
  source: "INDEC IPIM";
  latest: { period: string; value: number };
  /**
   * Variación porcentual mensual de los precios mayoristas del último
   * período respecto al anterior. `null` si la serie tiene menos de 2
   * puntos. Calculada como `((latest - previous) / previous) * 100`.
   */
  latestChange: number | null;
  series: Array<{ period: string; value: number }>;
};

export function parseIndecWholesalePrices(raw: unknown): IndecWholesaleParsed {
  const parsed = indecWholesaleResponseSchema.parse(raw);
  if (parsed.data.length === 0) {
    throw new Error("INDEC response has empty data array");
  }
  const series = parsed.data.map(([period, value]) => ({
    period,
    value: Number(value),
  }));
  const latest = series[series.length - 1]!;
  const previous = series.length >= 2 ? series[series.length - 2]! : null;
  const latestChange =
    previous && previous.value !== 0
      ? ((latest.value - previous.value) / previous.value) * 100
      : null;
  return {
    source: "INDEC IPIM",
    latest,
    latestChange,
    series,
  };
}

export function mergeIndecWholesalePrices(
  raw: unknown,
  fetchedAt: Date,
): MergedExternalData {
  const payload = parseIndecWholesalePrices(raw);
  return {
    type: "wholesale_prices",
    fetchedAt: fetchedAt.toISOString(),
    payload,
  };
}
