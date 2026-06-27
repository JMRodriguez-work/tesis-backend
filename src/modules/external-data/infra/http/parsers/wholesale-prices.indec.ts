import { z } from "zod";
import type { MergedExternalData } from "../../../domain/external-data.entity";

/**
 * Parser for INDEC IPC (Índice de Precios al Consumidor) monthly series.
 *
 * Source: https://datos.gob.ar (series API)
 * Series id 103.1_I2N_2016_M_19 = IPC GBA, nivel general, base dic-2016=100,
 * frecuencia mensual. El campo `value` viene como número (nivel del índice),
 * NO como porcentaje de variación.
 *
 * Example response shape (abridged):
 * {
 *   "data": [
 *     ["2026-04-01", 11336.5576],
 *     ["2026-05-01", 11594.5499],
 *     ...
 *   ],
 *   "count": 122,
 *   "meta": [{ "frequency": "month", ... }]
 * }
 */
const indecSeriesRowSchema = z.tuple([
  z.string(),
  z.union([z.string(), z.number()]),
]);

const indecIpcResponseSchema = z.object({
  data: z.array(indecSeriesRowSchema),
});

export type IndecIpcParsed = {
  source: "INDEC IPC";
  latest: { period: string; value: number };
  /**
   * Variación porcentual mensual del último dato respecto al anterior.
   * `null` si la serie tiene menos de 2 puntos. Calculada como
   * `((latest - previous) / previous) * 100`.
   */
  latestChange: number | null;
  series: Array<{ period: string; value: number }>;
};

export function parseIndecIpc(raw: unknown): IndecIpcParsed {
  const parsed = indecIpcResponseSchema.parse(raw);
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
    source: "INDEC IPC",
    latest,
    latestChange,
    series,
  };
}

export function mergeIndecIpc(
  raw: unknown,
  fetchedAt: Date,
): MergedExternalData {
  const payload = parseIndecIpc(raw);
  return {
    type: "wholesale_prices",
    fetchedAt: fetchedAt.toISOString(),
    payload,
  };
}
