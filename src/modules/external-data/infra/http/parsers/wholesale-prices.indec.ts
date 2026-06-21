import { z } from "zod";
import type { MergedExternalData } from "../../../domain/external-data.entity";

/**
 * Parser for INDEC IPC (Índice de Precios al Consumidor) monthly series.
 *
 * Source: https://datos.gob.ar (series API)
 * Series id 103.1_I2N_2016_M_19 = IPC nacional, nivel general, variación mensual.
 *
 * Example response shape (abridged):
 * {
 *   "data": [
 *     ["2024-01-01", "20.6"],
 *     ["2024-02-01", "13.2"],
 *     ...
 *   ],
 *   "meta": [{ "frequency": "monthly", ... }]
 * }
 */
const indecSeriesRowSchema = z.tuple([z.string(), z.string()]);

const indecIpcResponseSchema = z.object({
  data: z.array(indecSeriesRowSchema).min(1),
});

export type IndecIpcParsed = {
  source: "INDEC IPC";
  latest: { period: string; value: number };
  series: Array<{ period: string; value: number }>;
};

export function parseIndecIpc(raw: unknown): IndecIpcParsed {
  const parsed = indecIpcResponseSchema.parse(raw);
  const series = parsed.data.map(([period, value]) => ({
    period,
    value: Number(value),
  }));
  const latest = series[series.length - 1]!;
  return {
    source: "INDEC IPC",
    latest,
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
