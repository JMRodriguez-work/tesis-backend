import { z } from "zod";
import type { MergedExternalData } from "../../../domain/external-data.entity";

/**
 * Parser for seasonality data. Expects a JSON document with monthly peaks
 * useful for forecasting demand (e.g. December: pan dulce, fireworks).
 *
 * If no public API is available, organizations can host this JSON themselves
 * or use the built-in default calendar (see `defaultSeasonalityCalendar`).
 */
const peakSchema = z.object({
  month: z.number().int().min(1).max(12),
  category: z.string().min(1).max(100),
  intensity: z.number().min(0).max(1),
});

const seasonalityResponseSchema = z.object({
  peaks: z.array(peakSchema),
});

export type SeasonalityParsed = {
  peaks: Array<{ month: number; category: string; intensity: number }>;
};

export function parseSeasonality(raw: unknown): SeasonalityParsed {
  const parsed = seasonalityResponseSchema.parse(raw);
  return { peaks: parsed.peaks };
}

export function mergeSeasonality(
  raw: unknown,
  fetchedAt: Date,
): MergedExternalData {
  const payload = parseSeasonality(raw);
  return {
    type: "seasonality",
    fetchedAt: fetchedAt.toISOString(),
    payload,
  };
}

/**
 * Fallback calendar used when no URL is configured (or for local dev).
 * Reflects typical Argentine small-store seasonality.
 */
export const defaultSeasonalityCalendar: SeasonalityParsed = {
  peaks: [
    { month: 3, category: "Útiles escolares", intensity: 0.8 },
    { month: 5, category: "Día de la Madre (regalos)", intensity: 0.6 },
    { month: 6, category: "Abrigado e invierno", intensity: 0.5 },
    { month: 7, category: "Vacaciones de invierno", intensity: 0.7 },
    { month: 8, category: "Día del Niño", intensity: 0.7 },
    { month: 10, category: "Día de la Madre (regalos)", intensity: 0.6 },
    { month: 12, category: "Fiestas y pan dulce", intensity: 0.95 },
  ],
};
